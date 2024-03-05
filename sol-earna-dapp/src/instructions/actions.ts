import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import { WalletAdapterProps } from '@solana/wallet-adapter-base';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { mintAddress } from './common';

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

  return userTokenAccount;
};
