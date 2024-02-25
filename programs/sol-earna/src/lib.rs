use anchor_lang::{
    prelude::*,
    system_program::{create_account, CreateAccount},
};
use anchor_spl::token_interface::{
    accessor::mint,
    spl_token_2022::extension::transfer_fee::instruction::{
        transfer_checked_with_fee, withdraw_withheld_tokens_from_accounts,
    },
};
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{
        transfer_checked, Mint, TokenAccount, TokenInterface, Transfer, TransferChecked
    },
};
use spl_tlv_account_resolution::{
    account::ExtraAccountMeta, seeds::Seed, state::ExtraAccountMetaList,
};
use spl_transfer_hook_interface::instruction::{ExecuteInstruction, TransferHookInstruction};

declare_id!("xnwVapsgETFh2cz8LFPfTyneACVaMtxbR7D7KeFH3K8");

pub mod constants;
pub mod contexts;
pub mod errors;
pub mod events;
mod processors;
pub mod states;
pub mod utils;

use constants::*;
pub use contexts::*;
use states::*;
pub use utils::*;

#[program]
pub mod sol_earna {

    use errors::SolEarnaError;

    use super::*;

    pub fn initialize_extra_account_meta_list(
        ctx: Context<InitializeExtraAccountMetaList>,
        fee_percent_holders: u16,
        fee_percent_marketing: u16,
        fee_percent_liqudity: u16,
    ) -> Result<()> {
        // The `addExtraAccountsToInstruction` JS helper function resolving incorrectly
        let account_metas = vec![
            ExtraAccountMeta::new_with_pubkey(&ctx.accounts.token_program.key(), false, false)?,
            ExtraAccountMeta::new_with_pubkey(
                &ctx.accounts.associated_token_program.key(),
                false,
                false,
            )?,
            ExtraAccountMeta::new_with_pubkey(
                &ctx.accounts.fee_config.key(),
                false, // is_signer
                true,  // is_writable
            )?,
        ];

        // calculate account size
        let account_size = ExtraAccountMetaList::size_of(account_metas.len())? as u64;
        // calculate minimum required lamports
        let lamports = Rent::get()?.minimum_balance(account_size as usize);

        let mint = ctx.accounts.mint.key();
        let signer_seeds: &[&[&[u8]]] = &[&[
            EXTRA_ACCOUNT_METAS_TAG,
            &mint.as_ref(),
            &[ctx.bumps.extra_account_meta_list],
        ]];

        // create ExtraAccountMetaList account
        create_account(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                CreateAccount {
                    from: ctx.accounts.payer.to_account_info(),
                    to: ctx.accounts.extra_account_meta_list.to_account_info(),
                },
            )
            .with_signer(signer_seeds),
            lamports,
            account_size,
            ctx.program_id,
        )?;

        // initialize ExtraAccountMetaList account with extra accounts
        ExtraAccountMetaList::init::<ExecuteInstruction>(
            &mut ctx.accounts.extra_account_meta_list.try_borrow_mut_data()?,
            &account_metas,
        )?;

        ctx.accounts.fee_config.fee_percent_holders = fee_percent_holders;
        ctx.accounts.fee_config.fee_percent_marketing = fee_percent_marketing;
        ctx.accounts.fee_config.fee_percent_liqudity = fee_percent_liqudity;
        ctx.accounts.fee_config.marketing_token_account =
            ctx.accounts.marketing_token_account.key();
        ctx.accounts.fee_config.liquidity_token_account =
            ctx.accounts.liquidity_token_account.key();
        ctx.accounts.fee_config.holders_token_account = ctx.accounts.holders_token_account.key();
        ctx.accounts.fee_config.unclaimed_fee_holders = 0;
        ctx.accounts.fee_config.unclaimed_fee_liqudity = 0;
        ctx.accounts.fee_config.unclaimed_fee_marketing = 0;
        ctx.accounts.fee_config.fee_collected = 0;
        ctx.accounts.fee_config.fee_not_collected = 0;

        Ok(())
    }

    pub fn transfer_hook(ctx: Context<TransferHook>, amount: u64) -> Result<()> {
        // let fee_config = ctx.accounts.extra_account_meta_list;

        msg!("Hello Transfer Hook!");

        let fee_config = &mut ctx.accounts.fee_config;
        let total_fee_percent = fee_config.fee_percent_holders + fee_config.fee_percent_liqudity + fee_config.fee_percent_marketing;

        let total_fee: u64 = amount * total_fee_percent as u64 / 10000;

        fee_config.fee_not_collected += total_fee;

        Ok(())
    }

    pub fn claim_fee(ctx: Context<ClaimFee>) -> Result<()> {
        let destination_token_account = ctx.accounts.destination_token.to_account_info().key();

        let fee_config = &mut ctx.accounts.fee_config;

        let signer_seeds: &[&[&[u8]]] = &[&[b"fee-storage", &[ctx.bumps.fee_storage]]];

        if destination_token_account == fee_config.marketing_token_account {
            msg!("Claim for marketing");
            let mut amount = fee_config.unclaimed_fee_marketing;
            let balance = ctx.accounts.fee_storage_token_account.amount;
            msg!("amount {:?} {:?}", amount, balance);
            amount = 10;
            if balance < amount {
                msg!("Need to reduce amount from {:?} to {:?}", amount, balance);
                amount = balance;
            }

            if amount > 0 {
                transfer_checked(
                    CpiContext::new_with_signer(
                        ctx.accounts.token_program.to_account_info(),
                        TransferChecked {
                            from: ctx.accounts.fee_storage_token_account.to_account_info(),
                            mint: ctx.accounts.mint.to_account_info(),
                            to: ctx.accounts.destination_token.to_account_info(),
                            authority: ctx.accounts.fee_storage.to_account_info(),
                        },
                        signer_seeds
                    ),
                    // .with_signer(signer_seeds),
                    amount,
                    ctx.accounts.mint.decimals,
                )?;

                // solana_program::program::invoke_signed(
                //     &withdraw_withheld_tokens_from_accounts(
                //         &ctx.accounts.token_program.to_account_info().key(), // token_program_id:
                //         &ctx.accounts.mint.to_account_info().key(),          // mint: &Pubkey,
                //         &ctx.accounts.destination_token.to_account_info().key(), // destination: &Pubkey,
                //         &ctx.accounts
                //             .fee_storage_token_account
                //             .to_account_info()
                //             .key(), // authority: &Pubkey,
                //         &[&ctx.accounts.fee_storage.to_account_info().key()], // signers: &[&Pubkey],
                //         &[&ctx.accounts.destination_token.to_account_info().key()], // sources: &[&Pubkey],
                //     )?,
                //     &[
                //         ctx.accounts.token_program.to_account_info(),
                //         ctx.accounts.mint.to_account_info(),
                //         ctx.accounts.fee_storage_token_account.to_account_info(),
                //         ctx.accounts.fee_storage.to_account_info(),
                //         ctx.accounts.destination_token.to_account_info(),
                //     ],
                //     &[&[FEE_STORAGE_TAG, &[ctx.bumps.fee_storage]]],
                // )?;

                // fee_config.unclaimed_fee_marketing -= amount;
                // fee_config.fee_collected -= amount;
            }
        }
        if destination_token_account == fee_config.liquidity_token_account {
            msg!("Claim for liquidity");
            let mut amount = fee_config.unclaimed_fee_liqudity;
            let balance = ctx.accounts.fee_storage_token_account.amount;
            if balance < amount {
                msg!("Need to reduce amount from {:?} to {:?}", amount, balance);
                amount = balance;
            }

            if amount > 0 {
                transfer_checked(
                    CpiContext::new(
                        ctx.accounts.token_program.to_account_info(),
                        TransferChecked {
                            from: ctx.accounts.fee_storage_token_account.to_account_info(),
                            mint: ctx.accounts.mint.to_account_info(),
                            to: ctx.accounts.destination_token.to_account_info(),
                            authority: ctx.accounts.fee_storage.to_account_info(),
                        },
                    )
                    .with_signer(signer_seeds),
                    amount,
                    ctx.accounts.mint.decimals,
                )?;

            //     solana_program::program::invoke_signed(
            //         &withdraw_withheld_tokens_from_accounts(
            //             &ctx.accounts.token_program.to_account_info().key(), // token_program_id:
            //             &ctx.accounts.mint.to_account_info().key(),          // mint: &Pubkey,
            //             &ctx.accounts.destination_token.to_account_info().key(), // destination: &Pubkey,
            //             &ctx.accounts
            //                 .fee_storage_token_account
            //                 .to_account_info()
            //                 .key(), // authority: &Pubkey,
            //             &[&ctx.accounts.fee_storage.to_account_info().key()], // signers: &[&Pubkey],
            //             &[&ctx.accounts.destination_token.to_account_info().key()], // sources: &[&Pubkey],
            //         )?,
            //         &[
            //             ctx.accounts.token_program.to_account_info(),
            //             ctx.accounts.mint.to_account_info(),
            //             ctx.accounts.fee_storage_token_account.to_account_info(),
            //             ctx.accounts.fee_storage.to_account_info(),
            //             ctx.accounts.destination_token.to_account_info(),
            //         ],
            //         &[&[FEE_STORAGE_TAG, &[ctx.bumps.fee_storage]]],
            //     )?;

            //     fee_config.unclaimed_fee_liqudity -= amount;
            //     fee_config.fee_collected -= amount;
            }
        }

        Ok(())
    }

    pub fn fee_collected(ctx: Context<FeeCollected>, amount: u64) -> Result<()> {
        msg!("Fee Collected 0");
        let fee_config: &mut Account<'_, FeeConfig> = &mut ctx.accounts.fee_config;
        msg!("Fee Collected 1");

        solana_program::program::invoke_signed(
            &withdraw_withheld_tokens_from_accounts(
                &ctx.accounts.token_program.to_account_info().key(), // token_program_id:
                &ctx.accounts.mint.to_account_info().key(),          // mint: &Pubkey,
                &ctx.accounts
                    .fee_storage_token_account
                    .to_account_info()
                    .key(), // destination: &Pubkey,
                &ctx.accounts.owner.to_account_info().key(),         // authority: &Pubkey,
                &[],                                                 // signers: &[&Pubkey],
                &[&ctx
                    .accounts
                    .fee_storage_token_account
                    .to_account_info()
                    .key()], // sources: &[&Pubkey],
            )?,
            &[
                ctx.accounts.owner.to_account_info(),
                ctx.accounts.token_program.to_account_info(),
                ctx.accounts.mint.to_account_info(),
                ctx.accounts.fee_storage_token_account.to_account_info(),
                ctx.accounts.fee_storage.to_account_info(),
            ],
            &[],
        )?;
        
        let balance: u64 = ctx.accounts.fee_storage_token_account.amount;
        if amount > fee_config.fee_not_collected {
            fee_config.fee_not_collected = 0;
        }
        else {
            fee_config.fee_not_collected -= amount;
        }
        fee_config.fee_collected += amount;
        
        msg!("Fee Collected 2 {:?} {:?} {:?}", balance, fee_config.fee_not_collected, fee_config.fee_collected);
        require!(
            balance >= fee_config.fee_collected,
            SolEarnaError::CollectFeeAmountMismatch
        );

        let total_fee_percent = fee_config.fee_percent_holders
            + fee_config.fee_percent_liqudity
            + fee_config.fee_percent_marketing;

        let holders_fee: u64 =
            amount * fee_config.fee_percent_holders as u64 / total_fee_percent as u64;
        let liquidity_fee: u64 =
            amount * fee_config.fee_percent_liqudity as u64 / total_fee_percent as u64;
        let marketing_fee: u64 =
            amount * fee_config.fee_percent_marketing as u64 / total_fee_percent as u64;
        msg!("Fee Collected 3");

        fee_config.unclaimed_fee_holders += holders_fee;
        fee_config.unclaimed_fee_liqudity += liquidity_fee;
        fee_config.unclaimed_fee_marketing += marketing_fee;

        Ok(())
    }

    // fallback instruction handler as workaround to anchor instruction discriminator check
    pub fn fallback<'info>(
        program_id: &Pubkey,
        accounts: &'info [AccountInfo<'info>],
        data: &[u8],
    ) -> Result<()> {
        let instruction = TransferHookInstruction::unpack(data)?;

        // match instruction discriminator to transfer hook interface execute instruction
        // token2022 program CPIs this instruction on token transfer
        match instruction {
            TransferHookInstruction::Execute { amount } => {
                let amount_bytes = amount.to_le_bytes();

                // invoke custom transfer hook instruction on our program
                __private::__global::transfer_hook(program_id, accounts, &amount_bytes)
            }
            _ => return Err(ProgramError::InvalidInstructionData.into()),
        }
    }
}
