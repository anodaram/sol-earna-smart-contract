use anchor_lang::{
    prelude::*,
    system_program::{create_account, CreateAccount},
};
use anchor_spl::token_interface::{
    accessor::mint,
    spl_token_2022::extension::transfer_fee::instruction::{
        transfer_checked_with_fee, withdraw_withheld_tokens_from_accounts
    },
};
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{
        transfer_checked, Mint, TokenAccount, TokenInterface, Transfer, TransferChecked,
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
            ExtraAccountMeta::new_with_pubkey(
                &ctx.accounts.marketing_token_account.key(),
                false,
                true,
            )?,
            ExtraAccountMeta::new_with_pubkey(
                &ctx.accounts.liquidity_token_account.key(),
                false,
                true,
            )?,
            ExtraAccountMeta::new_with_pubkey(
                &ctx.accounts.holders_token_account.key(),
                false,
                true,
            )?,
            ExtraAccountMeta::new_with_seeds(
                &[Seed::Literal {
                    bytes: "fee-recipient-holders".as_bytes().to_vec(),
                }],
                false,
                true,
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

        Ok(())
    }

    pub fn transfer_hook(ctx: Context<TransferHook>, amount: u64) -> Result<()> {
        // let fee_config = ctx.accounts.extra_account_meta_list;

        msg!("Hello Transfer Hook!");

        let source_token = ctx.accounts.source_token.key();
        let destination_token = ctx.accounts.destination_token.key();
        let fee_config = &ctx.accounts.fee_config;

        let mut fee_free: bool = false;
        if source_token == fee_config.marketing_token_account
            || destination_token == fee_config.marketing_token_account
        {
            fee_free = true;
        } else if source_token == fee_config.liquidity_token_account
            || destination_token == fee_config.liquidity_token_account
        {
            fee_free = true;
        } else if source_token == fee_config.holders_token_account
            || destination_token == fee_config.holders_token_account
        {
            fee_free = true;
        }

        if !fee_free {
            let signer_seeds: &[&[&[u8]]] = &[&[
                FEE_RECIPIENT_HOLDERS_TAG,
                &[ctx.bumps.fee_recipient_liquidity],
            ]];
            
            let holders_fee: u64 = amount * fee_config.fee_percent_holders as u64 / 10000;
            let liquidity_fee: u64 = amount * fee_config.fee_percent_liqudity as u64 / 10000;
            let marketing_fee: u64 = amount * fee_config.fee_percent_marketing as u64 / 10000;
            // TODO: need to check about the dust fee
            msg!("{:?} {:?} {:?}", liquidity_fee, marketing_fee, holders_fee);
            if liquidity_fee > 0 {
                msg!("{:?} {:?} {:?} {:?} {:?}",
                    ctx.accounts.token_program.to_account_info().key(),
                    ctx.accounts.token_program.to_account_info().key(),
                    ctx.accounts.mint.to_account_info().key(),
                    ctx.accounts.fee_recipient_liquidity.to_account_info().key(),
                    ctx.accounts.owner.to_account_info().key(),
                );
                
                let ix = withdraw_withheld_tokens_from_accounts(
                    &ctx.accounts.token_program.to_account_info().key(), // token_program_id:
                    &ctx.accounts.mint.to_account_info().key(),          // mint: &Pubkey,
                    &ctx.accounts.fee_recipient_liquidity.to_account_info().key(), // destination: &Pubkey,
                    &ctx.accounts.fee_recipient_liquidity.to_account_info().key(), // authority: &Pubkey,
                    &[&ctx.accounts.fee_recipient_liquidity.to_account_info().key()], // signers: &[&Pubkey],
                    &[], // sources: &[&Pubkey],
                )?;

                solana_program::program::invoke_signed(
                    &ix,
                    &[
                        ctx.accounts.token_program.to_account_info(),
                        ctx.accounts.mint.to_account_info(),
                        ctx.accounts.liquidity_token_account.to_account_info(),
                        ctx.accounts.fee_recipient_liquidity.to_account_info(),
                        // ctx.accounts.owner.to_account_info(),
                    ],
                    signer_seeds,
                )?;
            }
            if marketing_fee > 0 {}
            if holders_fee > 0 {}
        }

        Ok(())
    }

    pub fn claim_reward(ctx: Context<ClaimReward>) -> Result<()> {
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
