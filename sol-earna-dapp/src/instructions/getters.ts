import { useState, useEffect } from 'react';
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import { getAccount, getAssociatedTokenAddress } from '@solana/spl-token';
import { PublicKey, Keypair } from '@solana/web3.js';

import { useSolEarnaObj } from './common';

const SECRET_KEY_LIQUIDITY = process.env.REACT_APP_SECRET_KEY_LIQUIDITY as string;
const SECRET_KEY_MARKETING = process.env.REACT_APP_SECRET_KEY_MARKETING as string;
const SECRET_KEY_HOLDERS = process.env.REACT_APP_SECRET_KEY_HOLDERS as string;

export const useUserInfo = () => {
  const { connection } = useConnection();
  const solEarnaObj = useSolEarnaObj();
  const [userTokenBalance, setUserTokenBalance] = useState(0);
  const wallet = useAnchorWallet();

  useEffect(() => {
    (async () => {
      // const _userTokenAccount = await getAssociatedTokenAddress()
      // const _userTokenBalance = await getAccount(connection, solEarnaObj?.publicKey as PublicKey)?.amount; await
    })();
  }, [solEarnaObj, wallet]);

  return { userTokenBalance };
};

export type TypeFeeRecipientWallet = {
  keypair: Keypair,
  address: string,
  unclaimedAmount: number,
  claimedAmount: number,
  claim: () => Promise<void>,
};

export const getFeeRecipientWallets = () => {
  const [feeRecipientLiquidity, feeRecipientMarketing, feeRecipientHolders] = [
    SECRET_KEY_LIQUIDITY,
    SECRET_KEY_MARKETING,
    SECRET_KEY_HOLDERS,
  ].map((secretKey) => {
    const keypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(secretKey)));
    const address = keypair.publicKey.toBase58();
    const unclaimedAmount = 0;
    const claimedAmount = 0;
    const claim = async () => {};
    return { keypair, address, unclaimedAmount, claimedAmount, claim };
  });

  console.log({
    feeRecipientLiquidity,
    feeRecipientMarketing,
    feeRecipientHolders,
  });

  return {
    feeRecipientLiquidity,
    feeRecipientMarketing,
    feeRecipientHolders,
  };
};
