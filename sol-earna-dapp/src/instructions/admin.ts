import { useState, useEffect } from 'react';
import { AnchorWallet, useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
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
import { PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction, Keypair } from '@solana/web3.js';

import { useSolEarnaObj } from './common';
import { Idl, Program } from '@project-serum/anchor';
import { EXTRA_ACCOUNT_METAS_TAG, FEE_CONFIG_TAG } from './constants';

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

export const createNewSolEarnaMint = async (
  wallet: AnchorWallet,
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
  });

  // 1. Create Mint Account with Transfer Hook Extension
  const transaction = new Transaction();
  const extensions = [ExtensionType.TransferFeeConfig, ExtensionType.TransferHook];
  const mintLen = getMintLen(extensions);
  const lamports = await solEarnaObj.provider.connection.getMinimumBalanceForRentExemption(mintLen);

  transaction.add(
    SystemProgram.createAccount({
      fromPubkey: wallet.publicKey,
      newAccountPubkey: mint.publicKey,
      space: mintLen,
      lamports: lamports,
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    createInitializeTransferHookInstruction(
      mint.publicKey,
      wallet.publicKey,
      solEarnaObj.programId,
      TOKEN_2022_PROGRAM_ID
    ),
    createInitializeTransferFeeConfigInstruction(
      mint.publicKey,
      wallet.publicKey,
      wallet.publicKey,
      TOTAL_FEE_PERCENT,
      BigInt(1_000_000_000),
      TOKEN_2022_PROGRAM_ID
    ),
    createInitializeMintInstruction(
      mint.publicKey,
      decimals,
      wallet.publicKey,
      null,
      TOKEN_2022_PROGRAM_ID
    )
  );

  // 2. Prepare Fee Recipient Accounts
  const [feeStorageTokenAccount, liquidityTokenAccount, marketingTokenAccount, holdersTokenAccount] = [
    wallet.publicKey,
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
    transaction.add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        tokenAccount,
        ownerPublicKey,
        mint.publicKey,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      ),
    );
    return tokenAccount;
  });

  // 3. Create ExtraAccountMetaList Account
  const [extraAccountMetaListPDA] = PublicKey.findProgramAddressSync(
    [EXTRA_ACCOUNT_METAS_TAG, mint.publicKey.toBuffer()],
    solEarnaObj.programId
  );
  const [feeConfigPDA] = PublicKey.findProgramAddressSync(
    [FEE_CONFIG_TAG, mint.publicKey.toBuffer()],
    solEarnaObj.programId
  );
  const extraAccountMetasInfo = await solEarnaObj.provider.connection.getAccountInfo(extraAccountMetaListPDA);

  console.log("Extra accounts meta: " + extraAccountMetasInfo);

  const initializeExtraAccountMetaListInstruction = await solEarnaObj.methods
    .initializeExtraAccountMetaList(
      FEE_PERCENT_HOLDERS,
      FEE_PERCENT_MARKETING,
      FEE_PERCENT_LIQUIDITY
    )
    .accounts(
      {
        extraAccountMetaList: extraAccountMetaListPDA,
        mint: mint.publicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        feeConfig: feeConfigPDA,
        liquidityTokenAccount,
        marketingTokenAccount,
        holdersTokenAccount,
      }
    )
    .instruction();

  const transaction2 = new Transaction().add(
    initializeExtraAccountMetaListInstruction
  );
};
