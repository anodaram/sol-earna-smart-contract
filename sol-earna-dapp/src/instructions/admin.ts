import { useState, useEffect } from 'react';
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import { getAccount, getAssociatedTokenAddress } from '@solana/spl-token';
import { PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction, Keypair } from '@solana/web3.js';

import { useSolEarnaObj } from './common';
import { Idl, Program } from '@project-serum/anchor';

export const useProgramStatus = () => {
    const { connection } = useConnection();
    const solEarnaObj = useSolEarnaObj();

    useEffect(() => {
        if (solEarnaObj) {
            (async () => {})();
        }
    }, [solEarnaObj]);

    return {};
};

export const createNewSolEarnaMint = async (
    solEarnaObj: Program<Idl>,
    feePercentHolders: number,
    feePercentMarketing: number,
    feePercentLiquidity: number
) => {
    const mint = new Keypair();
    const decimals = 9;

    const feeRecipientLiquidity = Keypair.generate();
    const feeRecipientMarketing = Keypair.generate();

    const FEE_PERCENT_HOLDERS = Math.floor(feePercentHolders * 10000);
    const FEE_PERCENT_MARKETING = Math.floor(feePercentMarketing * 10000);
    const FEE_PERCENT_LIQUIDITY = Math.floor(feePercentLiquidity * 10000);
    const TOTAL_FEE_PERCENT = FEE_PERCENT_HOLDERS + FEE_PERCENT_MARKETING + FEE_PERCENT_LIQUIDITY;

    console.log({
        feeRecipientLiquidity: feeRecipientLiquidity.secretKey,
        feeRecipientMarketing: feeRecipientMarketing.secretKey,
        FEE_PERCENT_HOLDERS,
        FEE_PERCENT_MARKETING,
        FEE_PERCENT_LIQUIDITY
    });
};
