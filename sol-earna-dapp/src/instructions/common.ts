import { useState, useEffect } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import * as anchor from '@project-serum/anchor';

import idl from '../assets/sol_earna.json';

export const SOL_EARNA_ADDRESS = process.env.REACT_APP_SOL_EARNA_ADDRESS;
export const MINT_ADDRESS = process.env.REACT_APP_MINT_ADDRESS;

export const solEarnaProgramId: PublicKey = new PublicKey(SOL_EARNA_ADDRESS as string);
export const mintAddress: PublicKey = new PublicKey(MINT_ADDRESS as string);

export const useSolEarnaObj = () => {
  const { connection } = useConnection();
  const [solEarnaObj, setSolEarnaObj] = useState<anchor.Program<anchor.Idl>>();
  const wallet = useAnchorWallet();

  useEffect(() => {
    if (wallet) {
      const provider = new anchor.AnchorProvider(connection, wallet as anchor.Wallet, {
        preflightCommitment: 'processed',
        commitment: 'processed',
      });
      const program = new anchor.Program(idl as anchor.Idl, solEarnaProgramId, provider);
      setSolEarnaObj(program);
    }
  }, [connection, wallet]);

  return solEarnaObj;
};
