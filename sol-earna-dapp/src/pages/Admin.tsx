import React, { useEffect, useState } from 'react';
import { Box, Modal, Button, Table, TableHead, TableCell, TableRow, TableBody, TextField } from '@mui/material';
import { createNewSolEarnaMint, useFeeRecipientWallets, TypeFeeRecipientWallet, createAssociatedTokenAccount, useTokenStatus } from '../instructions';
import { useSolEarnaObj } from '../instructions/common';
import { useAnchorWallet, useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';

export function Admin() {
  const { tokenStatus } = useTokenStatus();
  const { connection } = useConnection();
  const [reloadTag, setReloadTag] = useState(false);
  const solEarnaObj = useSolEarnaObj();
  const { publicKey, sendTransaction } = useWallet();
  const { feeRecipientLiquidity, feeRecipientMarketing, feeRecipientHolders } = useFeeRecipientWallets(reloadTag);
  const [userWalletAddressStr, setUserWalletAddressStr] = useState('');
  const [userWalletAddress, setUserWalletAddress] = useState<PublicKey>();
  const [userTokenAccount, setUserTokenAccount] = useState<PublicKey>();
  const [error, setError] = useState(false);
  const [admin, setAdmin] = useState<PublicKey>();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const mintAuthority = tokenStatus?.mintAuthority;
    mintAuthority && setAdmin(mintAuthority);
  }, [tokenStatus]);

  useEffect(() => {
    setIsAdmin(!(!admin || !publicKey || admin.toBase58() !== publicKey.toBase58()));
  }, [admin, publicKey]);

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
    if (PublicKey.isOnCurve(inputAddress)) {
      setUserWalletAddress(new PublicKey(inputAddress));
      setError(false);
    } else {
      setError(true);
    }
    setUserWalletAddressStr(inputAddress);
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
    console.log({ publicKey: publicKey.toBase58(), userWalletAddress: userWalletAddress.toBase58() });
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
              <TableRow>
                <TableCell>Admin</TableCell>
                <TableCell>{admin?.toBase58()}</TableCell>
                <TableCell></TableCell>
                <TableCell></TableCell>
                <TableCell></TableCell>
                <TableCell></TableCell>
              </TableRow>
              {
                [
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
              id="user-wallet-address"
              name="user-wallet-address"
              label="User Wallet Address"
              variant="outlined"
              value={userWalletAddressStr}
              onChange={handleUserWalletAddressChange}
              error={error}
              helperText={error ? 'Invalid Solana address format' : ''}
              sx={{ width: '450px' }}
            />
            <Button onClick={callCreateAssociatedTokenAccount}>Create</Button>
            <span>User Token Account: {userTokenAccount?.toBase58()}</span>
          </Box>

          <Box>
            <h4>Mint Token To A User</h4>
            {/* <TextField
              id="user-wallet-address"
              name="user-wallet-address"
              label="User Wallet Address"
              variant="outlined"
              value={userWalletAddressStr}
              onChange={handleUserWalletAddressChange}
              error={error}
              helperText={error ? 'Invalid Solana address format' : ''}
              sx={{ width: '450px' }}
            />
            <Button onClick={callCreateAssociatedTokenAccount}>Create</Button>
            <span>User Token Account: {userTokenAccount?.toBase58()}</span> */}
          </Box>
        </Box>)
      }
    </Box>
  );
}
