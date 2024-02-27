import type { Adapter, WalletError } from '@solana/wallet-adapter-base';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { WalletDialogProvider, WalletMultiButton } from '@solana/wallet-adapter-material-ui';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  LedgerWalletAdapter,
  MathWalletAdapter
} from '@solana/wallet-adapter-wallets';
import { clusterApiUrl, Cluster } from '@solana/web3.js';
import { useSnackbar } from 'notistack';
import type { FC, ReactNode } from 'react';
import React, { useCallback, useMemo, useState } from 'react';
import { Theme } from './Theme';

import { Box, Tabs, Tab, Button } from '@mui/material';

import styles from './App.module.css';

const NETWORK = process.env.REACT_APP_NETWORK;
const SOL_EARNA_ADDRESS = process.env.REACT_APP_SOL_EARNA_ADDRESS;

export const App: FC = () => {
  return (
    <Theme>
      <Context>
        <Content />
      </Context>
    </Theme>
  );
};

const Context: FC<{ children: ReactNode }> = ({ children }) => {
  // The network can be set to 'devnet', 'testnet', or 'mainnet-beta'.
  const network = NETWORK as Cluster;

  // You can also provide a custom RPC endpoint.
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new LedgerWalletAdapter(),
      new MathWalletAdapter()
    ],
    [network]
  );

  const { enqueueSnackbar } = useSnackbar();
  const onError = useCallback(
    (error: WalletError, adapter?: Adapter) => {
      enqueueSnackbar(error.message ? `${error.name}: ${error.message}` : error.name, { variant: 'error' });
      console.error(error, adapter);
    },
    [enqueueSnackbar]
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} onError={onError} autoConnect>
        <WalletDialogProvider>{children}</WalletDialogProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

const Content: FC = () => {
  const [activepage, setAcvitePage] = useState("Home");

  const handleChange = (e: any, activePage: any) => {
    setActivePage(activePage);
  }

  return (
    <Box className={styles.root}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={activePage} onChange={handleChange} aria-label="basic tabs example" >
          <Tab label="Home" value="Home" />
          <Tab disabled style={styles.empty} />
          <Tab label="Admin" value="Admin" />
        </Tabs>
      </Box>
      {/* {activePage === "Home" && <Home strategies={strategies} tokens={tokens} deinvestRequests={deinvestRequests} />}
      {activePage === "Admin" && <Admin strategies={strategies} tokens={tokens} deinvestRequests={deinvestRequests} />} */}
      <WalletMultiButton className={styles.walletButton} />
    </Box>
  );
};
