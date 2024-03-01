import React, { useEffect, useState } from 'react';
import { Box, Modal, Button } from '@mui/material';
import { createNewSolEarnaMint } from '../instructions';
import { useSolEarnaObj } from '../instructions/common';
import { useAnchorWallet, useWallet } from '@solana/wallet-adapter-react';

export function Admin() {
  const solEarnaObj = useSolEarnaObj();
  const { publicKey, sendTransaction } = useWallet();

  const createNewToken = async () => {
    if (!solEarnaObj) {
      console.log("solEarnaObj is not initialized");
      return;
    }
    if (!publicKey) {
      console.log("wallet not connected");
      return;
    }
    const feePercentHolders = 0.05;
    const feePercentMarketing = 0.04;
    const feePercentLiquidity = 0.01;
    const mintAddress = await createNewSolEarnaMint(
      publicKey, 
      sendTransaction, 
      solEarnaObj, 
      feePercentHolders, 
      feePercentMarketing, 
      feePercentLiquidity
    );
  }

  return (
    <Box>
      <Button color="inherit" onClick={createNewToken}>
        Create a new token
      </Button>
    </Box>
  );
}
