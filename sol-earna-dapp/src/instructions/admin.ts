import { useState, useEffect } from 'react';
import { AnchorWallet, Wallet, useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  ExtensionType,
  Mint,
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  createInitializeTransferFeeConfigInstruction,
  createInitializeTransferHookInstruction,
  createTransferCheckedWithTransferHookInstruction,
  createWithdrawWithheldTokensFromAccountsInstruction,
  getAccount,
  getAssociatedTokenAddress,
  getAssociatedTokenAddressSync,
  getMint,
  getMintLen,
  getTransferFeeAmount,
  unpackAccount,
} from '@solana/spl-token';
import {
  PublicKey,
  SystemProgram,
  Transaction,
  Keypair,
  Signer,
  sendAndConfirmTransaction,
  Connection,
} from '@solana/web3.js';

import { useSolEarnaObj } from './common';
import { BN, Idl, Program } from '@project-serum/anchor';
import { WalletAdapterProps } from '@solana/wallet-adapter-base';
import { getFeeConfigPDA, getExtraAccountMetaListPDA } from './pdas';
import { mintAddress } from './common';

export const useTokenStatus = () => {
  const { connection } = useConnection();
  const solEarnaObj = useSolEarnaObj();
  const [tokenStatus, setTokenStatus] = useState<Mint>();
  const [admin, setAdmin] = useState<PublicKey>();

  useEffect(() => {
    if (solEarnaObj) {
      (async () => {
        const mint = await getMint(connection, mintAddress, 'processed', TOKEN_2022_PROGRAM_ID);
        setTokenStatus(mint);
        const _admin = mint?.mintAuthority;
        _admin && setAdmin(_admin);
      })();
    }
  }, [solEarnaObj]);

  return { tokenStatus, admin };
};

// TODO: This function doesn't work for now. Error in Step.1
export const createNewSolEarnaMint = async (
  admin: PublicKey,
  sendTransaction: WalletAdapterProps['sendTransaction'],
  solEarnaObj: Program<Idl>,
  feePercentHolders: number,
  feePercentMarketing: number,
  feePercentLiquidity: number
) => {
  const mint = new Keypair();
  const decimals = 9;

  const feeRecipientLiquidity = Keypair.generate();
  const feeRecipientMarketing = Keypair.generate();
  const feeRecipientHolders = Keypair.generate();

  const FEE_PERCENT_HOLDERS = Math.floor(feePercentHolders * 10000);
  const FEE_PERCENT_MARKETING = Math.floor(feePercentMarketing * 10000);
  const FEE_PERCENT_LIQUIDITY = Math.floor(feePercentLiquidity * 10000);
  const TOTAL_FEE_PERCENT = FEE_PERCENT_HOLDERS + FEE_PERCENT_MARKETING + FEE_PERCENT_LIQUIDITY;

  console.log({
    feeRecipientLiquidity: feeRecipientLiquidity.secretKey,
    feeRecipientMarketing: feeRecipientMarketing.secretKey,
    feeRecipientHolders: feeRecipientHolders.secretKey,
    FEE_PERCENT_HOLDERS,
    FEE_PERCENT_MARKETING,
    FEE_PERCENT_LIQUIDITY,
    mint: mint.publicKey.toBase58(),
  });

  // 1. Create Mint Account with Transfer Hook Extension
  const transaction = new Transaction();
  const extensions: ExtensionType[] = [ExtensionType.TransferFeeConfig, ExtensionType.TransferHook];
  const mintLen = getMintLen(extensions);
  const lamports = await solEarnaObj.provider.connection.getMinimumBalanceForRentExemption(mintLen);

  transaction.add(
    SystemProgram.createAccount({
      fromPubkey: admin,
      newAccountPubkey: mint.publicKey,
      space: mintLen,
      lamports: lamports,
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    createInitializeTransferHookInstruction(mint.publicKey, admin, solEarnaObj.programId, TOKEN_2022_PROGRAM_ID),
    createInitializeTransferFeeConfigInstruction(
      mint.publicKey,
      admin,
      admin,
      TOTAL_FEE_PERCENT,
      BigInt(1_000_000_000),
      TOKEN_2022_PROGRAM_ID
    ),
    createInitializeMintInstruction(mint.publicKey, decimals, admin, null, TOKEN_2022_PROGRAM_ID)
  );
  transaction.recentBlockhash = (await solEarnaObj.provider.connection.getLatestBlockhash()).blockhash;

  console.log({ transaction: JSON.stringify(transaction) });
  transaction.sign(mint);
  console.log({ transaction: JSON.stringify(transaction) });

  await sendTransaction(transaction, solEarnaObj.provider.connection, {
    maxRetries: 10,
    preflightCommitment: 'processed',
    skipPreflight: false,
  });

  // 2. Prepare Fee Recipient Accounts
  const transaction2 = new Transaction();
  const [feeStorageTokenAccount, liquidityTokenAccount, marketingTokenAccount, holdersTokenAccount] = [
    admin,
    feeRecipientLiquidity.publicKey,
    feeRecipientMarketing.publicKey,
    feeRecipientHolders.publicKey,
  ].map((ownerPublicKey) => {
    const tokenAccount = getAssociatedTokenAddressSync(
      mint.publicKey,
      ownerPublicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    transaction2.add(
      createAssociatedTokenAccountInstruction(
        admin,
        tokenAccount,
        ownerPublicKey,
        mint.publicKey,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
    return tokenAccount;
  });
  transaction2.recentBlockhash = (await solEarnaObj.provider.connection.getLatestBlockhash()).blockhash;

  await sendTransaction(transaction2, solEarnaObj.provider.connection, { skipPreflight: true });
  console.log({ recentBlockhash: transaction2.recentBlockhash });

  // 3. Create ExtraAccountMetaList Account
  const extraAccountMetaListPDA = getExtraAccountMetaListPDA(mint.publicKey, solEarnaObj.programId);
  const feeConfigPDA = getFeeConfigPDA(mint.publicKey, solEarnaObj.programId);

  const extraAccountMetasInfo = await solEarnaObj.provider.connection.getAccountInfo(extraAccountMetaListPDA);

  console.log('Extra accounts meta: ' + extraAccountMetasInfo);

  const initializeExtraAccountMetaListInstruction = await solEarnaObj.methods
    .initializeExtraAccountMetaList(FEE_PERCENT_HOLDERS, FEE_PERCENT_MARKETING, FEE_PERCENT_LIQUIDITY)
    .accounts({
      extraAccountMetaList: extraAccountMetaListPDA,
      mint: mint.publicKey,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      feeConfig: feeConfigPDA,
      liquidityTokenAccount,
      marketingTokenAccount,
      holdersTokenAccount,
    })
    .instruction();

  const transaction3 = new Transaction().add(initializeExtraAccountMetaListInstruction);
  transaction3.recentBlockhash = (await solEarnaObj.provider.connection.getLatestBlockhash()).blockhash;

  await sendTransaction(transaction3, solEarnaObj.provider.connection, { skipPreflight: true });
};

export const collectFee = async (
  connection: Connection,
  admin: PublicKey,
  sendTransaction: WalletAdapterProps['sendTransaction'],
  solEarnaObj: Program<Idl>,
  mintAddress: PublicKey,
  feeConfigPDA: PublicKey,
  feeStorageTokenAccount: PublicKey
) => {
  const allAccounts = await connection.getProgramAccounts(TOKEN_2022_PROGRAM_ID, {
    commitment: 'confirmed',
    filters: [
      {
        memcmp: {
          offset: 0,
          bytes: mintAddress.toString(), // Mint Account address
        },
      },
    ],
  });
  // List of Token Accounts to withdraw fees from
  const accountsToWithdrawFrom = [];

  for (const accountInfo of allAccounts) {
    const account = unpackAccount(
      accountInfo.pubkey, // Token Account address
      accountInfo.account, // Token Account data
      TOKEN_2022_PROGRAM_ID // Token Extension Program ID
    );

    // Extract transfer fee data from each account
    const transferFeeAmount = getTransferFeeAmount(account);
    console.log(accountInfo, transferFeeAmount);

    // Check if fees are available to be withdrawn
    if (transferFeeAmount !== null && transferFeeAmount.withheldAmount > 0) {
      accountsToWithdrawFrom.push(accountInfo.pubkey); // Add account to withdrawal list
    }
  }
  console.log({ accountsToWithdrawFrom });

  const transferInstruction = createWithdrawWithheldTokensFromAccountsInstruction(
    mintAddress,
    feeStorageTokenAccount,
    admin,
    [],
    accountsToWithdrawFrom,
    TOKEN_2022_PROGRAM_ID
  );

  const balanceFeeStorageBefore = (
    await getAccount(connection, feeStorageTokenAccount, 'processed', TOKEN_2022_PROGRAM_ID)
  ).amount;

  const txSig = await sendTransaction(new Transaction().add(transferInstruction), connection, { skipPreflight: true });

  console.log('Transfer Signature:', txSig);

  const balanceFeeStorageAfter = (
    await getAccount(connection, feeStorageTokenAccount, 'processed', TOKEN_2022_PROGRAM_ID)
  ).amount;

  const collectedFee = balanceFeeStorageAfter - balanceFeeStorageBefore;
  console.log({ collectedFee, balanceFeeStorageAfter, balanceFeeStorageBefore });

  const feeCollectedInstruction = await solEarnaObj.methods
    .feeCollected(new BN(collectedFee.toString()))
    .accounts({
      owner: admin,
      mint: mintAddress,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      feeConfig: feeConfigPDA,
      feeStorageTokenAccount: feeStorageTokenAccount,
    })
    .instruction();

  const txSig2 = await sendTransaction(new Transaction().add(feeCollectedInstruction), connection, {
    skipPreflight: true,
  });
  console.log('Transfer Signature2:', txSig2);

  return collectedFee;
};

export const claimFee = async (
  connection: Connection,
  admin: PublicKey,
  sendTransaction: WalletAdapterProps['sendTransaction'],
  solEarnaObj: Program<Idl>,
  mintAddress: PublicKey,
  feeConfigPDA: PublicKey,
  feeStorageTokenAccount: PublicKey,
  feeRecipientAddress: PublicKey,
  feeRecipientTokenAccount: PublicKey,
  amount: BN,
  decimals: number = 9
) => {
  // const transferInstruction = await createTransferCheckedWithTransferHookInstruction(
  //   connection,
  //   feeStorageTokenAccount,
  //   mintAddress,
  //   feeRecipientTokenAccount,
  //   admin,
  //   BigInt(amount.toString()),
  //   decimals,
  //   [],
  //   "confirmed",
  //   TOKEN_2022_PROGRAM_ID
  // );

  // const txSig1 = await sendTransaction(new Transaction().add(transferInstruction), connection, { skipPreflight: true });
  // console.log("Transfer Signature:", txSig1);

  console.log({amount}, {
    owner: admin.toBase58(), // owner
    user: feeRecipientAddress.toBase58(), // user
    destinationToken: feeRecipientTokenAccount.toBase58(), // destination_token
    mint: mintAddress.toBase58(), // mint
    tokenProgram: TOKEN_2022_PROGRAM_ID.toBase58(), // token_program
    feeConfig: feeConfigPDA.toBase58(), // fee_config
    feeStorageTokenAccount: feeStorageTokenAccount.toBase58() // fee_storage_token_account
  });
  const feeClaimedInstruction = await solEarnaObj.methods.feeClaimed(amount).accounts({
    owner: admin, // owner
    user: feeRecipientAddress, // user
    destinationToken: feeRecipientTokenAccount, // destination_token
    mint: mintAddress, // mint
    tokenProgram: TOKEN_2022_PROGRAM_ID, // token_program
    feeConfig: feeConfigPDA, // fee_config
    feeStorageTokenAccount: feeStorageTokenAccount // fee_storage_token_account
  }).instruction();
  console.log({feeClaimedInstruction});

  const txSig2 = await sendTransaction(new Transaction().add(feeClaimedInstruction), connection, {
    skipPreflight: true,
  });

  console.log("Transfer Signature:", txSig2);
}
