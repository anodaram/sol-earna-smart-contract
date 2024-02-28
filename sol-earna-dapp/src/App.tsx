import type { Adapter, WalletError } from '@solana/wallet-adapter-base';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { WalletDialogProvider, WalletMultiButton } from '@solana/wallet-adapter-material-ui';
import { ConnectionProvider, WalletProvider, useConnection } from '@solana/wallet-adapter-react';
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

import { Button, AppBar, Toolbar, Box } from '@mui/material';
import { Home, Admin } from './pages';

import './App.css';

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

type PageType = "Home" | "Admin";

const Content: FC = () => {
  const [activePage, setActivePage] = useState<PageType>("Home");

  return (
    <>
      <AppBar position="static">
        <Box display="flex">
          <Box display="flex" flex={1} justifyContent="space-between">
            <Button
              size="large"
              aria-label="account of current user"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              color="inherit"
              onClick={() => setActivePage("Home")}
            >
              Home
            </Button>
            <Button
              size="large"
              aria-label="account of current user"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              color="inherit"
              onClick={() => setActivePage("Admin")}
            >
              Admin
            </Button>
          </Box>
          <WalletMultiButton />
        </Box>
      </AppBar>
      {activePage === "Home" && <Home />}
      {activePage === "Admin" && <Admin />}
    </>
  );
};
