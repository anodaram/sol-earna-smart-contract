import { useState, useEffect } from 'react';
import { AnchorWallet, Wallet, useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  createInitializeTransferFeeConfigInstruction,
  createInitializeTransferHookInstruction,
  getAccount,
  getAssociatedTokenAddress,
  getAssociatedTokenAddressSync,
  getMintLen,
} from '@solana/spl-token';
import { PublicKey, SystemProgram, Transaction, Keypair, Signer, sendAndConfirmTransaction } from '@solana/web3.js';

import { useSolEarnaObj } from './common';
import { Idl, Program } from '@project-serum/anchor';
import { WalletAdapterProps } from '@solana/wallet-adapter-base';
import { getFeeConfigPDA, getExtraAccountMetaListPDA } from './pdas';

export const useProgramStatus = () => {
  const { connection } = useConnection();
  const solEarnaObj = useSolEarnaObj();

  useEffect(() => {
    if (solEarnaObj) {
      (async () => {})();
    }
  }, [solEarnaObj]);

  return {};
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
