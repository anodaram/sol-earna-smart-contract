import { useState, useEffect } from 'react';
import { useAnchorWallet, useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAccount,
  getAssociatedTokenAddress,
  getAssociatedTokenAddressSync,
  unpackAccount,
} from '@solana/spl-token';
import { PublicKey, Keypair, ParsedAccountData, Connection } from '@solana/web3.js';
import { BN } from '@project-serum/anchor';

import { mintAddress, useSolEarnaObj } from './common';
import { getFeeConfigPDA } from './pdas';
import { bigintToNumber, numberToBigint, numberToBN } from './utils';
import { claimFee, collectFee, useTokenStatus } from './admin';

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
  const [feeConfigPDA, setFeeConfigPDA] = useState<PublicKey>();

  useEffect(() => {
    if (solEarnaObj) {
      (async () => {
        const _feeConfigPDA = getFeeConfigPDA();
        setFeeConfigPDA(_feeConfigPDA);
        const _feeConfig = await solEarnaObj.account.feeConfig.fetch(_feeConfigPDA);
        console.log({ _feeConfig });
        setFeeConfig(_feeConfig as TypeFeeConfig);
      })();
    }
  }, [reloadTag, solEarnaObj]);

  return { feeConfig, feeConfigPDA };
};

export type TypeFeeRecipientWallet = {
  address: string;
  tokenAccount: string;
  unclaimedAmount: number;
  claimedAmount: number;
  claim: () => Promise<void>;
};

export const useFeeRecipientWallets = (reloadTag: Boolean = false) => {
  const { connection } = useConnection();
  const { tokenStatus, admin } = useTokenStatus();
  const solEarnaObj = useSolEarnaObj();
  const { publicKey, sendTransaction } = useWallet();
  const [feeStorage, setFeeStorage] = useState<TypeFeeRecipientWallet>();
  const [feeRecipientLiquidity, setFeeRecipientLiquidity] = useState<TypeFeeRecipientWallet>();
  const [feeRecipientMarketing, setFeeRecipientMarketing] = useState<TypeFeeRecipientWallet>();
  const [feeRecipientHolders, setFeeRecipientHolders] = useState<TypeFeeRecipientWallet>();
  const { feeConfig, feeConfigPDA } = useFeeConfig(reloadTag);

  useEffect(() => {
    if (tokenStatus && admin && feeConfig && solEarnaObj && sendTransaction && feeConfigPDA) {
      const [_feeStorage, _feeRecipientLiquidity, _feeRecipientMarketing, _feeRecipientHolders] = [
        admin,
        Keypair.fromSecretKey(new Uint8Array(JSON.parse(SECRET_KEY_LIQUIDITY))).publicKey,
        Keypair.fromSecretKey(new Uint8Array(JSON.parse(SECRET_KEY_MARKETING))).publicKey,
        Keypair.fromSecretKey(new Uint8Array(JSON.parse(SECRET_KEY_HOLDERS))).publicKey,
      ].map((address) => {
        const tokenAccount = '';
        const unclaimedAmount = 0;
        const claimedAmount = 0;
        const claim = async () => {};
        return { address: address.toBase58(), tokenAccount, unclaimedAmount, claimedAmount, claim };
      });

      (async () => {
        _feeStorage.unclaimedAmount = bigintToNumber(feeConfig.feeNotCollected);
        _feeRecipientLiquidity.unclaimedAmount = bigintToNumber(feeConfig.unclaimedFeeLiquidity);
        _feeRecipientMarketing.unclaimedAmount = bigintToNumber(feeConfig.unclaimedFeeMarketing);
        _feeRecipientHolders.unclaimedAmount = bigintToNumber(feeConfig.unclaimedFeeHolders);

        const feeStorageTokenAccount = getAssociatedTokenAddressSync(
          mintAddress,
          admin,
          false,
          TOKEN_2022_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
        _feeStorage.tokenAccount = feeStorageTokenAccount.toBase58();
        _feeRecipientLiquidity.tokenAccount = feeConfig.liquidityTokenAccount.toBase58();
        _feeRecipientMarketing.tokenAccount = feeConfig.marketingTokenAccount.toBase58();
        _feeRecipientHolders.tokenAccount = feeConfig.holdersTokenAccount.toBase58();

        // TODO: need to pass decimals as a param
        _feeStorage.claimedAmount = bigintToNumber(feeConfig.feeCollected);
        _feeRecipientLiquidity.claimedAmount = bigintToNumber(
          (await getAccount(connection, feeConfig.liquidityTokenAccount, 'processed', TOKEN_2022_PROGRAM_ID)).amount
        );
        _feeRecipientMarketing.claimedAmount = bigintToNumber(
          (await getAccount(connection, feeConfig.marketingTokenAccount, 'processed', TOKEN_2022_PROGRAM_ID)).amount
        );
        _feeRecipientHolders.claimedAmount = bigintToNumber(
          (await getAccount(connection, feeConfig.holdersTokenAccount, 'processed', TOKEN_2022_PROGRAM_ID)).amount
        );

        _feeStorage.claim = async () => {
          await collectFee(
            connection,
            admin,
            sendTransaction,
            solEarnaObj,
            mintAddress,
            feeConfigPDA,
            feeStorageTokenAccount
          );
        };
        [_feeRecipientLiquidity, _feeRecipientMarketing].forEach((_feeRecipient) => {
          _feeRecipient.claim = async () => {
            await claimFee(
              connection, // connection: Connection,
              admin, // admin: PublicKey,
              sendTransaction, // sendTransaction: WalletAdapterProps['sendTransaction'],
              solEarnaObj, // solEarnaObj: Program<Idl>,
              mintAddress, // mintAddress: PublicKey,
              feeConfigPDA, // feeConfigPDA: PublicKey,
              feeStorageTokenAccount, // feeStorageTokenAccount: PublicKey,
              new PublicKey(_feeRecipient.address), // feeRecipientAddress: PublicKey,
              new PublicKey(_feeRecipient.tokenAccount), // feeRecipientTokenAccount: PublicKey,
              numberToBN(_feeRecipient.unclaimedAmount) // amount: BN,
            );
          };
        });
        _feeRecipientHolders.claim = async () => {
          const holders = await getHolders(connection, admin);
          const total = _feeRecipientHolders.unclaimedAmount;
          for (let i = 0; i < holders.length; i++) {
            const _holder = holders[i];
            const amount = total * _holder.shared;
            if (_holder.shared > 0) {
              await claimFee(
                connection, // connection: Connection,
                admin, // admin: PublicKey,
                sendTransaction, // sendTransaction: WalletAdapterProps['sendTransaction'],
                solEarnaObj, // solEarnaObj: Program<Idl>,
                mintAddress, // mintAddress: PublicKey,
                feeConfigPDA, // feeConfigPDA: PublicKey,
                feeStorageTokenAccount, // feeStorageTokenAccount: PublicKey,
                new PublicKey(_holder.address), // feeRecipientAddress: PublicKey,
                new PublicKey(_holder.tokenAccount), // feeRecipientTokenAccount: PublicKey,
                numberToBN(amount) // amount: BN,
              );
            }
          }
        };

        setFeeStorage(_feeStorage);
        setFeeRecipientLiquidity(_feeRecipientLiquidity);
        setFeeRecipientMarketing(_feeRecipientMarketing);
        setFeeRecipientHolders(_feeRecipientHolders);
      })();
    }
  }, [tokenStatus, admin, reloadTag, feeConfig, solEarnaObj, sendTransaction, feeConfigPDA]);

  return {
    feeStorage,
    feeRecipientLiquidity,
    feeRecipientMarketing,
    feeRecipientHolders,
  };
};

export type TypeHolder = {
  address: string;
  tokenAccount: string;
  amount: number;
  shared: number;
};

export const useHolders = () => {
  const [holders, setHolders] = useState<TypeHolder[]>([]);
  const { connection } = useConnection();
  const { admin } = useTokenStatus();

  useEffect(() => {
    (async () => {
      if (!admin) return;
      const _holders = await getHolders(connection, admin);
      setHolders(_holders);
    })();
  }, [connection, admin]);

  return holders;
};

const getHolders = async (connection: Connection, admin: PublicKey) => {
  const allAccounts = await connection.getProgramAccounts(TOKEN_2022_PROGRAM_ID, {
    commitment: 'confirmed',
    filters: [
      {
        memcmp: {
          offset: 0,
          bytes: mintAddress.toString(), // Mint Account address
        },
      },
    ],
  });
  console.log({ allAccounts });
  const exceptionWallets = [
    admin,
    Keypair.fromSecretKey(new Uint8Array(JSON.parse(SECRET_KEY_LIQUIDITY))).publicKey,
    Keypair.fromSecretKey(new Uint8Array(JSON.parse(SECRET_KEY_MARKETING))).publicKey,
    Keypair.fromSecretKey(new Uint8Array(JSON.parse(SECRET_KEY_HOLDERS))).publicKey,
  ].map((wallet) => wallet.toBase58());

  const validHolders = allAccounts.filter((account) => !exceptionWallets.includes(account.account.owner.toBase58()));
  const holders = (
    await Promise.all(
      validHolders.map(async (accountInfo) => {
        const tokenAccount = accountInfo.pubkey;
        const parsedAccountInfo = await connection.getParsedAccountInfo(tokenAccount);
        const address = (parsedAccountInfo.value?.data as ParsedAccountData).parsed.info.owner;
        const amount = bigintToNumber(
          (await getAccount(connection, tokenAccount, 'processed', TOKEN_2022_PROGRAM_ID)).amount
        );
        const shared = 0;
        return {
          address,
          tokenAccount: tokenAccount.toBase58(),
          amount,
          shared,
        };
      })
    )
  ).filter((holder) => holder.amount > 0 && !exceptionWallets.includes(holder.address));
  const totalSupply = holders.reduce((acc, holder) => acc + holder.amount, 0);
  if (totalSupply > 0) {
    holders.map((holder) => {
      holder.shared = holder.amount / totalSupply;
    });
  }
  return holders;
};
