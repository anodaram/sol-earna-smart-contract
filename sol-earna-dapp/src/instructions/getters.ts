import { useState, useEffect } from 'react';
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import {
  getAccount, getAssociatedTokenAddress
} from '@solana/spl-token';

import { useSolEarnaObj } from './common';

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
