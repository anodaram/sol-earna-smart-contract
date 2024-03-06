import React, { useState } from 'react';
import { TextField } from '@mui/material';
import { PublicKey } from '@solana/web3.js';

export function AddressInput({ label, onChange }: { label: string, onChange: ((address: PublicKey) => void) }) {
  const [error, setError] = useState(false);
  const [addressStr, setAddressStr] = useState('');

  const handleAddressStrChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const inputAddress = event.target.value;
    const solanaAddressRegex: RegExp = /^[1-9A-HJ-NP-Za-km-z]{44}$/;
    if (solanaAddressRegex.test(inputAddress)) {
      onChange(new PublicKey(inputAddress));
      setError(false);
    } else {
      setError(true);
    }
    setAddressStr(inputAddress);
  }

  return (
    <TextField
      label={label}
      variant="outlined"
      value={addressStr}
      onChange={handleAddressStrChange}
      error={error}
      helperText={error ? 'Invalid Solana address format' : ''}
      sx={{ width: '450px' }}
    />
  );
}
