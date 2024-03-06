import { useState, useEffect } from 'react';
import { useAnchorWallet, useConnection, useWallet } from '@solana/wallet-adapter-react';
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, getAccount, getAssociatedTokenAddress, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { PublicKey, Keypair } from '@solana/web3.js';
import { BN } from '@project-serum/anchor';

import { mintAddress, useSolEarnaObj } from './common';
import { getFeeConfigPDA } from './pdas';
import { bigintToNumber } from './utils';

const SECRET_KEY_LIQUIDITY = process.env.REACT_APP_SECRET_KEY_LIQUIDITY as string;
const SECRET_KEY_MARKETING = process.env.REACT_APP_SECRET_KEY_MARKETING as string;
const SECRET_KEY_HOLDERS = process.env.REACT_APP_SECRET_KEY_HOLDERS as string;

export const useUserInfo = () => {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const solEarnaObj = useSolEarnaObj();
  const [userTokenAccount, setUserTokenAccount] = useState<PublicKey>();
  const [userTokenBalance, setUserTokenBalance] = useState(0);

  useEffect(() => {
    (async () => {
      if (!publicKey) return;
      const _userTokenAccount = getAssociatedTokenAddressSync(
        mintAddress,
        publicKey,
        false,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      setUserTokenAccount(_userTokenAccount);
      const _userTokenBalance = bigintToNumber(
        (await getAccount(connection, _userTokenAccount, 'processed', TOKEN_2022_PROGRAM_ID)).amount
      );
      setUserTokenBalance(_userTokenBalance);
    })();
  }, [solEarnaObj, publicKey]);

  return { userTokenBalance, userTokenAccount };
};

export type TypeFeeConfig = {
  marketingTokenAccount: PublicKey;
  liquidityTokenAccount: PublicKey;
  holdersTokenAccount: PublicKey;
  feePercentHolders: number;
  feePercentMarketing: number;
  feePercentLiquidity: number;
  unclaimedFeeHolders: BN;
  unclaimedFeeMarketing: BN;
  unclaimedFeeLiquidity: BN;
  feeCollected: BN;
  feeNotCollected: BN;
};

export const useFeeConfig = (reloadTag: Boolean = false) => {
  const solEarnaObj = useSolEarnaObj();
  const [feeConfig, setFeeConfig] = useState<TypeFeeConfig>();

  useEffect(() => {
    if (solEarnaObj) {
      (async () => {
        const feeConfigPDA = getFeeConfigPDA();
        const _feeConfig = await solEarnaObj.account.feeConfig.fetch(feeConfigPDA);
        setFeeConfig(_feeConfig as TypeFeeConfig);
      })();
    }
  }, [reloadTag, solEarnaObj]);

  return feeConfig;
};

export type TypeFeeRecipientWallet = {
  keypair: Keypair;
  address: string;
  tokenAccount: string;
  unclaimedAmount: number;
  claimedAmount: number;
  claim: () => Promise<void>;
};

export const useFeeRecipientWallets = (reloadTag: Boolean = false) => {
  const { connection } = useConnection();
  const [feeRecipientLiquidity, setFeeRecipientLiquidity] = useState<TypeFeeRecipientWallet>();
  const [feeRecipientMarketing, setFeeRecipientMarketing] = useState<TypeFeeRecipientWallet>();
  const [feeRecipientHolders, setFeeRecipientHolders] = useState<TypeFeeRecipientWallet>();
  const feeConfig = useFeeConfig(reloadTag);

  useEffect(() => {
    const [_feeRecipientLiquidity, _feeRecipientMarketing, _feeRecipientHolders] = [
      SECRET_KEY_LIQUIDITY,
      SECRET_KEY_MARKETING,
      SECRET_KEY_HOLDERS,
    ].map((secretKey) => {
      const keypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(secretKey)));
      const address = keypair.publicKey.toBase58();
      const tokenAccount = '';
      const unclaimedAmount = 0;
      const claimedAmount = 0;
      const claim = async () => {};
      return { keypair, address, tokenAccount, unclaimedAmount, claimedAmount, claim };
    });

    if (feeConfig) {
      (async () => {
        _feeRecipientLiquidity.unclaimedAmount = feeConfig.unclaimedFeeLiquidity.toNumber();
        _feeRecipientMarketing.unclaimedAmount = feeConfig.unclaimedFeeMarketing.toNumber();
        _feeRecipientHolders.unclaimedAmount = feeConfig.unclaimedFeeHolders.toNumber();

        _feeRecipientLiquidity.tokenAccount = feeConfig.liquidityTokenAccount.toBase58();
        _feeRecipientMarketing.tokenAccount = feeConfig.marketingTokenAccount.toBase58();
        _feeRecipientHolders.tokenAccount = feeConfig.holdersTokenAccount.toBase58();

        // TODO: need to pass decimals as a param
        _feeRecipientLiquidity.claimedAmount = bigintToNumber(
          (await getAccount(connection, feeConfig.liquidityTokenAccount, 'processed', TOKEN_2022_PROGRAM_ID)).amount
        );
        _feeRecipientMarketing.claimedAmount = bigintToNumber(
          (await getAccount(connection, feeConfig.marketingTokenAccount, 'processed', TOKEN_2022_PROGRAM_ID)).amount
        );
        _feeRecipientHolders.claimedAmount = bigintToNumber(
          (await getAccount(connection, feeConfig.holdersTokenAccount, 'processed', TOKEN_2022_PROGRAM_ID)).amount
        );

        setFeeRecipientLiquidity(_feeRecipientLiquidity);
        setFeeRecipientMarketing(_feeRecipientMarketing);
        setFeeRecipientHolders(_feeRecipientHolders);
      })();
    } else {
      setFeeRecipientLiquidity(_feeRecipientLiquidity);
      setFeeRecipientMarketing(_feeRecipientMarketing);
      setFeeRecipientHolders(_feeRecipientHolders);
    }
  }, [reloadTag, feeConfig]);

  return {
    feeRecipientLiquidity,
    feeRecipientMarketing,
    feeRecipientHolders,
  };
};
