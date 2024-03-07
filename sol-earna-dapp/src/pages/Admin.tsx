import React, { useEffect, useState } from 'react';
import { Box, Modal, Button, Table, TableHead, TableCell, TableRow, TableBody, TextField } from '@mui/material';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';

import { createNewSolEarnaMint, useFeeRecipientWallets, createAssociatedTokenAccount, useTokenStatus, mintTokenTo } from '../instructions';
import { useSolEarnaObj } from '../instructions/common';

import { AddressInput } from '../components';

export function Admin() {
  const [reloadTag, setReloadTag] = useState(false);
  const { connection } = useConnection();
  const { tokenStatus, admin } = useTokenStatus();
  const solEarnaObj = useSolEarnaObj();
  const { publicKey, sendTransaction } = useWallet();
  const { feeStorage, feeRecipientLiquidity, feeRecipientMarketing, feeRecipientHolders } = useFeeRecipientWallets(reloadTag);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userWalletAddress, setUserWalletAddress] = useState<PublicKey>();
  const [userTokenAccount, setUserTokenAccount] = useState<PublicKey>();
  const [mintAmount, setMintAmount] = useState('0');

  useEffect(() => {
    setIsAdmin(!(!admin || !publicKey || admin.toBase58() !== publicKey.toBase58()));
  }, [admin, publicKey]);

  const createNewToken = async () => {
    if (!solEarnaObj) {
      console.log("solEarnaObj is not initialized");
      return;
    }
    if (!publicKey) {
      window.alert("Wallet Not Connected");
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

  const callMintTo = async () => {
    if (!publicKey) {
      window.alert("Wallet Not Connected");
      return;
    }
    if (!userTokenAccount) {
      window.alert("Invalid User Token Account");
      return;
    }
    mintTokenTo(
      connection,
      publicKey,
      sendTransaction,
      userTokenAccount,
      Number(mintAmount)
    );
  }

  return (
    <Box>
      <Button color="inherit" onClick={createNewToken} disabled>
        Create a new token
      </Button>
      {!isAdmin ? (<Box>You are not admin</Box>) :
        (<Box>
          <Table color="inherit">
            <TableHead>
              <TableRow>
                <TableCell></TableCell>
                <TableCell>Recipient Wallet Address</TableCell>
                <TableCell>Recipient Token Account</TableCell>
                <TableCell>Claimed Amount</TableCell>
                <TableCell>Unclaimed Amount</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {
                [
                  { label: "Admin", wallet: feeStorage },
                  { label: "Liquidity", wallet: feeRecipientLiquidity },
                  { label: "Marketing", wallet: feeRecipientMarketing },
                  { label: "Holders", wallet: feeRecipientHolders }
                ].map(({ label, wallet }) => (
                  <TableRow key={label}>
                    <TableCell>{label}</TableCell>
                    <TableCell>{wallet?.address}</TableCell>
                    <TableCell>{wallet?.tokenAccount}</TableCell>
                    <TableCell>{wallet?.claimedAmount}</TableCell>
                    <TableCell>{wallet?.unclaimedAmount}</TableCell>
                    <TableCell>
                      <Button variant="contained" onClick={async () => {
                        if (wallet) {
                          await (wallet?.claim)();
                          setReloadTag((prev) => !prev);
                        }
                      }}>{label === "Admin" ? "Collect" : "Claim"}</Button>
                    </TableCell>
                  </TableRow>
                ))
              }
            </TableBody>
          </Table>

          <Box>
            <h4>Create Associated Token Account</h4>
            <AddressInput label="User Wallet Address" onChange={(address) => setUserWalletAddress(address)} />
            <Button onClick={callCreateAssociatedTokenAccount}>Create</Button>
            <span>User Token Account: {userTokenAccount?.toBase58()}</span>
          </Box>

          <Box>
            <h4>Mint Token To A User</h4>
            <AddressInput label="User Token Account" onChange={(address) => setUserTokenAccount(address)} />
            <TextField
              label="Amount"
              variant="outlined"
              value={mintAmount}
              onChange={(e) => { setMintAmount(e.target.value) }}
              type="number"
              sx={{ width: '100px' }}
            />
            <Button onClick={callMintTo}>Mint</Button>
          </Box>
        </Box>)
      }
    </Box>
  );
}
