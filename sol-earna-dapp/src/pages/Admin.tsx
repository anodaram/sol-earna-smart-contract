import React, { useEffect, useState } from 'react';
import { Box, Modal, Button, Table, TableHead, TableCell, TableRow, TableBody } from '@mui/material';
import { createNewSolEarnaMint, getFeeRecipientWallets, TypeFeeRecipientWallet } from '../instructions';
import { useSolEarnaObj } from '../instructions/common';
import { useAnchorWallet, useWallet } from '@solana/wallet-adapter-react';
import { Keypair } from '@solana/web3.js';

export function Admin() {
  const solEarnaObj = useSolEarnaObj();
  const { publicKey, sendTransaction } = useWallet();
  const [feeRecipientLiquidity, setFeeRecipientLiquidity] = useState<TypeFeeRecipientWallet>();
  const [feeRecipientMarketing, seteeRecipientMarketing] = useState<TypeFeeRecipientWallet>();
  const [feeRecipientHolders, setFeeRecipientHolders] = useState<TypeFeeRecipientWallet>();

  useEffect(() => {
    const feeRecipientWallets = getFeeRecipientWallets();
    setFeeRecipientLiquidity(feeRecipientWallets.feeRecipientLiquidity);
    seteeRecipientMarketing(feeRecipientWallets.feeRecipientMarketing);
    setFeeRecipientHolders(feeRecipientWallets.feeRecipientHolders);
  }, []);

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
      <Button color="inherit" onClick={createNewToken} disabled>
        Create a new token
      </Button>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell></TableCell>
            <TableCell>Recipient Wallet Address</TableCell>
            <TableCell>Claimed Amount</TableCell>
            <TableCell>Unclaimed Amount</TableCell>
            <TableCell></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {
            [
              { label: "Liquidity", wallet: feeRecipientLiquidity },
              { label: "Marketing", wallet: feeRecipientMarketing },
              { label: "Holders", wallet: feeRecipientHolders }
            ].map(({ label, wallet }) => (
              <TableRow id={label}>
                <TableCell>{label}</TableCell>
                <TableCell>{wallet?.address}</TableCell>
                <TableCell>{wallet?.claimedAmount}</TableCell>
                <TableCell>{wallet?.unclaimedAmount}</TableCell>
                <TableCell>
                  <Button variant="contained" onClick={wallet?.claim}>Claim</Button>
                </TableCell>
              </TableRow>
            ))
          }
        </TableBody>
      </Table>
    </Box>
  );
}
