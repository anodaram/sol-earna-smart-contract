import { useState, useEffect } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';

import { useSolEarnaObj } from './common';

export const useUserInfo = () => {
  const { connection } = useConnection();
  const solEarnaObj = useSolEarnaObj();
  const [userTokenBalance, setUserTokenBalance] = useState(0);

  useEffect(() => {
  }, [connection]);

  return { userTokenBalance };
};
