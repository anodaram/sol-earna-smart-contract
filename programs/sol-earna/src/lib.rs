use anchor_lang::{
    prelude::*,
    system_program::{create_account, CreateAccount},
};
use anchor_spl::token_interface::spl_token_2022::extension::transfer_fee::instruction::withdraw_withheld_tokens_from_accounts;
use spl_tlv_account_resolution::{account::ExtraAccountMeta, state::ExtraAccountMetaList};
use spl_transfer_hook_interface::instruction::{ExecuteInstruction, TransferHookInstruction};
use std::cmp;

declare_id!("6pkLsRGjcnR8Vr8PP7uEDXtkipkUcUoj3xLSQqGCCxDD");

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
        fee_percent_liquidity: u16,
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
        ctx.accounts.fee_config.fee_percent_liquidity = fee_percent_liquidity;
        ctx.accounts.fee_config.marketing_token_account =
            ctx.accounts.marketing_token_account.key();
        ctx.accounts.fee_config.liquidity_token_account =
            ctx.accounts.liquidity_token_account.key();
        ctx.accounts.fee_config.holders_token_account = ctx.accounts.holders_token_account.key();
        ctx.accounts.fee_config.unclaimed_fee_holders = 0;
        ctx.accounts.fee_config.unclaimed_fee_liquidity = 0;
        ctx.accounts.fee_config.unclaimed_fee_marketing = 0;
        ctx.accounts.fee_config.fee_collected = 0;
        ctx.accounts.fee_config.fee_not_collected = 0;

        Ok(())
    }

    pub fn transfer_hook(ctx: Context<TransferHook>, amount: u64) -> Result<()> {
        // let fee_config = ctx.accounts.extra_account_meta_list;

        msg!("Hello Transfer Hook!");

        let fee_config = &mut ctx.accounts.fee_config;
        let total_fee_percent = fee_config.fee_percent_holders
            + fee_config.fee_percent_liquidity
            + fee_config.fee_percent_marketing;

        let total_fee: u64 = amount * total_fee_percent as u64 / 10000;

        fee_config.fee_not_collected += total_fee;

        Ok(())
    }

    pub fn fee_collected(ctx: Context<FeeCollected>, amount: u64) -> Result<()> {
        let fee_config: &mut Account<'_, FeeConfig> = &mut ctx.accounts.fee_config;

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
            ],
            &[],
        )?;

        let balance: u64 = ctx.accounts.fee_storage_token_account.amount;
        if amount > fee_config.fee_not_collected {
            fee_config.fee_not_collected = 0;
        } else {
            fee_config.fee_not_collected -= amount;
            if fee_config.fee_not_collected < DUST_LIMIT {
                fee_config.fee_not_collected = 0;
            }
        }
        fee_config.fee_collected += amount;

        msg!(
            "Fee Collected {:?} {:?} {:?}",
            balance,
            fee_config.fee_not_collected,
            fee_config.fee_collected
        );
        require!(
            balance >= fee_config.fee_collected,
            SolEarnaError::CollectFeeAmountMismatch
        );

        let total_fee_percent = fee_config.fee_percent_holders
            + fee_config.fee_percent_liquidity
            + fee_config.fee_percent_marketing;

        let holders_fee: u64 =
            amount * fee_config.fee_percent_holders as u64 / total_fee_percent as u64;
        let liquidity_fee: u64 =
            amount * fee_config.fee_percent_liquidity as u64 / total_fee_percent as u64;
        let marketing_fee: u64 =
            amount * fee_config.fee_percent_marketing as u64 / total_fee_percent as u64;

        fee_config.unclaimed_fee_holders += holders_fee;
        fee_config.unclaimed_fee_liquidity += liquidity_fee;
        fee_config.unclaimed_fee_marketing += marketing_fee;

        Ok(())
    }

    pub fn fee_claimed(ctx: Context<FeeClaimed>, amount: u64) -> Result<()> {
        if amount == 0 {
            return Ok(());
        }
        let destination_token_account = ctx.accounts.destination_token.to_account_info().key();

        let fee_config = &mut ctx.accounts.fee_config;

        let total_fee_percent = fee_config.fee_percent_holders
            + fee_config.fee_percent_liquidity
            + fee_config.fee_percent_marketing;

        if destination_token_account == fee_config.marketing_token_account {
            msg!("Claim for marketing");
            let mut _amount = amount;
            if _amount > cmp::min(fee_config.fee_collected, fee_config.unclaimed_fee_marketing) {
                _amount = cmp::min(fee_config.fee_collected, fee_config.unclaimed_fee_marketing);
                msg!("Claim Amount is too big, need to reduce to {:?}", _amount);
            }
            solana_program::program::invoke_signed(
                &withdraw_withheld_tokens_from_accounts(
                    &ctx.accounts.token_program.to_account_info().key(), // token_program_id:
                    &ctx.accounts.mint.to_account_info().key(),          // mint: &Pubkey,
                    &ctx.accounts.destination_token.to_account_info().key(), // destination: &Pubkey,
                    &ctx.accounts.owner.to_account_info().key(),             // authority: &Pubkey,
                    &[],                                                     // signers: &[&Pubkey],
                    &[&ctx.accounts.destination_token.to_account_info().key()], // sources: &[&Pubkey],
                )?,
                &[
                    ctx.accounts.token_program.to_account_info(),
                    ctx.accounts.mint.to_account_info(),
                    ctx.accounts.destination_token.to_account_info(),
                    ctx.accounts.owner.to_account_info(),
                ],
                &[],
            )?;

            if _amount > 0 {
                fee_config.unclaimed_fee_marketing -= _amount;
                fee_config.fee_collected -= _amount;
                if fee_config.unclaimed_fee_marketing < DUST_LIMIT {
                    fee_config.unclaimed_fee_marketing = 0;
                }
                if fee_config.fee_collected < DUST_LIMIT {
                    fee_config.fee_collected = 0;
                }
                let total_fee: u64 = cmp::min(_amount * total_fee_percent as u64 / 10000, fee_config.fee_not_collected);
                fee_config.fee_not_collected -= total_fee;
            }
        } else if destination_token_account == fee_config.liquidity_token_account {
            msg!("Claim for liquidity");
            let mut _amount = amount;
            if _amount > cmp::min(fee_config.fee_collected, fee_config.unclaimed_fee_liquidity) {
                _amount = cmp::min(fee_config.fee_collected, fee_config.unclaimed_fee_liquidity);
                msg!("Claim Amount is too big, need to reduce to {:?}", _amount);
            }
            solana_program::program::invoke_signed(
                &withdraw_withheld_tokens_from_accounts(
                    &ctx.accounts.token_program.to_account_info().key(), // token_program_id:
                    &ctx.accounts.mint.to_account_info().key(),          // mint: &Pubkey,
                    &ctx.accounts.destination_token.to_account_info().key(), // destination: &Pubkey,
                    &ctx.accounts.owner.to_account_info().key(),             // authority: &Pubkey,
                    &[],                                                     // signers: &[&Pubkey],
                    &[&ctx.accounts.destination_token.to_account_info().key()], // sources: &[&Pubkey],
                )?,
                &[
                    ctx.accounts.token_program.to_account_info(),
                    ctx.accounts.mint.to_account_info(),
                    ctx.accounts.destination_token.to_account_info(),
                    ctx.accounts.owner.to_account_info(),
                ],
                &[],
            )?;

            if _amount > 0 {
                fee_config.unclaimed_fee_liquidity -= _amount;
                fee_config.fee_collected -= _amount;
                if fee_config.unclaimed_fee_liquidity < DUST_LIMIT {
                    fee_config.unclaimed_fee_liquidity = 0;
                }
                if fee_config.fee_collected < DUST_LIMIT {
                    fee_config.fee_collected = 0;
                }
                let total_fee: u64 = cmp::min(_amount * total_fee_percent as u64 / 10000, fee_config.fee_not_collected);
                fee_config.fee_not_collected -= total_fee;
            }
        } else {
            msg!("Claim for holder");
            let mut _amount = amount;
            if _amount > cmp::min(fee_config.fee_collected, fee_config.unclaimed_fee_holders) {
                _amount = cmp::min(fee_config.fee_collected, fee_config.unclaimed_fee_holders);
                msg!("Claim Amount is too big, need to reduce to {:?}", _amount);
            }
            solana_program::program::invoke_signed(
                &withdraw_withheld_tokens_from_accounts(
                    &ctx.accounts.token_program.to_account_info().key(), // token_program_id:
                    &ctx.accounts.mint.to_account_info().key(),          // mint: &Pubkey,
                    &ctx.accounts.destination_token.to_account_info().key(), // destination: &Pubkey,
                    &ctx.accounts.owner.to_account_info().key(),             // authority: &Pubkey,
                    &[],                                                     // signers: &[&Pubkey],
                    &[&ctx.accounts.destination_token.to_account_info().key()], // sources: &[&Pubkey],
                )?,
                &[
                    ctx.accounts.token_program.to_account_info(),
                    ctx.accounts.mint.to_account_info(),
                    ctx.accounts.destination_token.to_account_info(),
                    ctx.accounts.owner.to_account_info(),
                ],
                &[],
            )?;
            if _amount > 0 {
                fee_config.unclaimed_fee_holders -= _amount;
                fee_config.fee_collected -= _amount;
                if fee_config.unclaimed_fee_holders < DUST_LIMIT {
                    fee_config.unclaimed_fee_holders = 0;
                }
                if fee_config.fee_collected < DUST_LIMIT {
                    fee_config.fee_collected = 0;
                }
                let total_fee: u64 = cmp::min(_amount * total_fee_percent as u64 / 10000, fee_config.fee_not_collected);
                fee_config.fee_not_collected -= total_fee;
            }
        }

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
