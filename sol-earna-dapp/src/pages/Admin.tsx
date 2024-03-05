import React, { useEffect, useState } from 'react';
import { Box, Modal, Button, Table, TableHead, TableCell, TableRow, TableBody, TextField } from '@mui/material';
import { createNewSolEarnaMint, useFeeRecipientWallets, TypeFeeRecipientWallet, createAssociatedTokenAccount } from '../instructions';
import { useSolEarnaObj } from '../instructions/common';
import { useAnchorWallet, useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';

export function Admin() {
  const { connection } = useConnection();
  const [reloadTag, setReloadTag] = useState(false);
  const solEarnaObj = useSolEarnaObj();
  const { publicKey, sendTransaction } = useWallet();
  const { feeRecipientLiquidity, feeRecipientMarketing, feeRecipientHolders } = useFeeRecipientWallets(reloadTag);
  const [userWalletAddress, setUserWalletAddress] = useState<PublicKey>();
  const [userTokenAccount, setUserTokenAccount] = useState<PublicKey>();
  const [error, setError] = useState(false);

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

  const handleUserWalletAddressChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const inputAddress = event.target.value;
    // Regular expression for validating Solana address
    const solanaAddressRegex = /[1-9A-HJ-NP-Za-km-z]{32,44}/;
    if (solanaAddressRegex.test(inputAddress)) {
      setError(false);
    } else {
      setError(true);
    }
    setUserWalletAddress(new PublicKey(inputAddress));
  };

  const callCreateAssociatedTokenAccount = async () => {
    if (!publicKey) {
      window.alert("Wallet Not Connected");
      return;
    }
    if (!userWalletAddress) {
      window.alert("Invalid User Wallet Address");
      return;
    }
    const userTokenAccount = await createAssociatedTokenAccount(
      connection, publicKey, sendTransaction, userWalletAddress
    );
    setUserTokenAccount(userTokenAccount);
  }

  return (
    <Box>
      <Button color="inherit" onClick={createNewToken} disabled>
        Create a new token
      </Button>

      <Table color="inherit">
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
              <TableRow key={label}>
                <TableCell>{label}</TableCell>
                <TableCell>{wallet?.address}</TableCell>
                <TableCell>{wallet?.claimedAmount}</TableCell>
                <TableCell>{wallet?.unclaimedAmount}</TableCell>
                <TableCell>
                  <Button variant="contained" onClick={async () => {
                    if (wallet) {
                      await (wallet?.claim)();
                      setReloadTag((prev) => !prev);
                    }
                  }}>Claim</Button>
                </TableCell>
              </TableRow>
            ))
          }
        </TableBody>
      </Table>

      <Box>
        <h4>Create Associated Token Account</h4>
        <TextField
          label="User Wallet Address"
          variant="outlined"
          value={userWalletAddress}
          onChange={handleUserWalletAddressChange}
          error={error}
          helperText={error ? 'Invalid Solana address format' : ''}
          sx={{ width: '450px' }}
        />
        <Button onClick={callCreateAssociatedTokenAccount}>Create</Button>
        <span>User Token Account: {userTokenAccount?.toBase58()}</span>
      </Box>
    </Box>
  );
}
