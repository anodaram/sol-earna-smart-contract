import React, { useEffect, useState } from 'react';
import { Box, Modal, Button, TextField } from '@mui/material';
import { useUserInfo } from '../instructions';

export function Home() {
  const { userTokenBalance } = useUserInfo();

  return (
    <Box>
      <Box>
        <h4>Your Balance: {userTokenBalance}</h4>
      </Box>
    </Box>
  );
}
