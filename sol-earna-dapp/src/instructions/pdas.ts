import { PublicKey } from '@solana/web3.js';
import { EXTRA_ACCOUNT_METAS_TAG, FEE_CONFIG_TAG, FEE_RECIPIENT_HOLDERS_TAG } from './constants';
import { mintAddress, solEarnaProgramId } from './common';

export const getFeeConfigPDA = (
  _mintAddress: PublicKey = mintAddress,
  _solEarnaProgramId: PublicKey = solEarnaProgramId
) => {
  const [feeConfigPDA] = PublicKey.findProgramAddressSync(
    [FEE_CONFIG_TAG, _mintAddress.toBuffer()],
    _solEarnaProgramId
  );
  return feeConfigPDA;
};

export const getExtraAccountMetaListPDA = (
  _mintAddress: PublicKey = mintAddress,
  _solEarnaProgramId: PublicKey = solEarnaProgramId
) => {
  const [extraAccountMetaListPDA] = PublicKey.findProgramAddressSync(
    [EXTRA_ACCOUNT_METAS_TAG, _mintAddress.toBuffer()],
    _solEarnaProgramId
  );
  return extraAccountMetaListPDA;
};
