import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  createTransferCheckedWithTransferHookInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import { WalletAdapterProps } from '@solana/wallet-adapter-base';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { mintAddress } from './common';
import { numberToBigint } from './utils';

export const createAssociatedTokenAccount = async (
  connection: Connection,
  payer: PublicKey,
  sendTransaction: WalletAdapterProps['sendTransaction'],
  userWalletAddress: PublicKey,
  allowOwnerOffCurve = false,
  _mintAddress: PublicKey = mintAddress
) => {
  const userTokenAccount = getAssociatedTokenAddressSync(
    _mintAddress,
    userWalletAddress,
    allowOwnerOffCurve,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const ix = createAssociatedTokenAccountInstruction(
    payer,
    userTokenAccount,
    userWalletAddress,
    _mintAddress,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const txSig = await sendTransaction(new Transaction().add(ix), connection, { skipPreflight: true });
  console.log(`Transaction Signature: ${txSig}`);

  return userTokenAccount;
};

export const mintTokenTo = async (
  connection: Connection,
  payer: PublicKey,
  sendTransaction: WalletAdapterProps['sendTransaction'],
  userTokenAccount: PublicKey,
  amount: number,
  _mintAddress: PublicKey = mintAddress,
  decimals: number = 9
) => {
  const _amount = numberToBigint(amount, decimals);
  const ix = createMintToInstruction(_mintAddress, userTokenAccount, payer, _amount, [], TOKEN_2022_PROGRAM_ID);
  const txSig = await sendTransaction(new Transaction().add(ix), connection, { skipPreflight: true });
  console.log(`Transaction Signature: ${txSig}`);
};

export const transferToken = async (
  connection: Connection,
  sender: PublicKey,
  sendTransaction: WalletAdapterProps['sendTransaction'],
  sourceTokenAccount: PublicKey,
  destinationTokenAccount: PublicKey,
  amount: number,
  _mintAddress: PublicKey = mintAddress,
  decimals: number = 9
) => {
  const _amount = numberToBigint(amount, decimals);
  const ix = await createTransferCheckedWithTransferHookInstruction(
    connection,
    sourceTokenAccount,
    _mintAddress,
    destinationTokenAccount,
    sender,
    _amount,
    decimals,
    [sender],
    'confirmed',
    TOKEN_2022_PROGRAM_ID
  );
  const txSig = await sendTransaction(new Transaction().add(ix), connection, { skipPreflight: true });
  console.log(`Transaction Signature: ${txSig}`);
};
