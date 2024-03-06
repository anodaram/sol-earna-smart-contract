import React, { useEffect, useState } from 'react';
import { Box, Modal, Button, TextField } from '@mui/material';
import { transferToken, useUserInfo } from '../instructions';
import { AddressInput } from '../components';
import { PublicKey } from '@solana/web3.js';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';

export function Home() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const { userTokenBalance, userTokenAccount } = useUserInfo();

  const [recipientTokenAccount, setRecipientTokenAccount] = useState<PublicKey>();
  const [transferAmount, setTransferAmount] = useState('0');

  const callTransferToken = async () => {
    if (!publicKey) {
      window.alert("Wallet Not Connected");
      return;
    }
    if (!userTokenAccount) {
      window.alert("Invalid User Token Account");
      return;
    }
    if (!recipientTokenAccount) {
      window.alert("Invalid Recipient Token Account");
      return;
    }
    await transferToken(
      connection,
      publicKey,
      sendTransaction,
      userTokenAccount,
      recipientTokenAccount,
      Number(transferAmount)
    );

  }

  return (
    <Box>
      <Box>
        <h5>Your TokenAccount: {userTokenAccount?.toBase58()}</h5>
        <h5>Your Balance: {userTokenBalance}</h5>
        <Box>
          <h4>Transfer Token To Another User</h4>
          <AddressInput label="Recipient Token Account" onChange={(address) => setRecipientTokenAccount(address)} />
          <TextField
            label="Amount"
            variant="outlined"
            value={transferAmount}
            onChange={(e) => { setTransferAmount(e.target.value) }}
            type="number"
            sx={{ width: '100px' }}
          />
          <Button onClick={callTransferToken}>Transfer</Button>
        </Box>

      </Box>
    </Box>
  );
}
