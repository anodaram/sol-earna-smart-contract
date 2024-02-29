import React, { useEffect, useState } from 'react';
import { Box, Modal, Button } from '@mui/material';
import { createNewSolEarnaMint } from '../instructions';
import { useSolEarnaObj } from '../instructions/common';
import { useAnchorWallet } from '@solana/wallet-adapter-react';

export function Admin() {
  const solEarnaObj = useSolEarnaObj();
  const wallet = useAnchorWallet();

  const createNewToken = async () => {
    if (!solEarnaObj) {
      console.log("solEarnaObj is not initialized");
      return;
    }
    const mintAddress = await createNewSolEarnaMint(wallet, solEarnaObj);
  }

  return (
    <Box>
      <Button color="inherit" onClick={createNewToken}>
        Create a new token
      </Button>
    </Box>
  );
}
