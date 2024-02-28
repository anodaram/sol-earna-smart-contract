import { useState, useEffect } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { useConnection } from '@solana/wallet-adapter-react';
import * as anchor from '@project-serum/anchor';

export const SOL_EARNA_ADDRESS = process.env.REACT_APP_SOL_EARNA_ADDRESS;

export const useSolEarnaObj = () => {
  const { connection } = useConnection();
  const [solEarnaObj, setSolEarnaObj] = useState(null);

  useEffect(() => {
    // const provider = anchor.getProvider();
    // console.log({provider});
    (async () => {
    })();
  }, [connection]);

  return solEarnaObj;
};
