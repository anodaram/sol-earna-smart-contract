use anchor_lang::{
    prelude::*,
    system_program::{create_account, CreateAccount},
};
use spl_tlv_account_resolution::{account::ExtraAccountMeta, state::ExtraAccountMetaList};
use spl_transfer_hook_interface::instruction::{ExecuteInstruction, TransferHookInstruction};

declare_id!("2me2g1K7KVA7RBhg1rcbpxRvCknd4v1UCA8RMEjm3hmg");

mod constants;
mod contexts;
mod errors;
mod events;
mod processors;
mod states;
mod utils;

use contexts::*;

#[program]
pub mod sol_earna {
    use self::constants::EXTRA_ACCOUNT_METAS_TAG;

    use super::*;

    pub fn initialize_extra_account_meta_list(
        ctx: Context<InitializeExtraAccountMetaList>,
        fee_percent_holders: u16,
        fee_percent_marketing: u16,
        fee_percent_liquidity: u16,
    ) -> Result<()> {
        let _a = &ctx.accounts;
        // The `addExtraAccountsToInstruction` JS helper function resolving incorrectly
        let account_metas = vec![
            ExtraAccountMeta::new_with_pubkey(&_a.token_program.key(), false, true)?,
            ExtraAccountMeta::new_with_pubkey(&_a.associated_token_program.key(), false, true)?,
            // ExtraAccountMeta::new_with_pubkey(&_a.system_program.key(), false, true)?,
            ExtraAccountMeta::new_with_pubkey(&_a.fee_config.key(), false, true)?,
            ExtraAccountMeta::new_with_pubkey(&_a.wsol_mint.key(), false, true)?,
            ExtraAccountMeta::new_with_pubkey(&_a.fee_wsol_token_account.key(), false, true)?,
            ExtraAccountMeta::new_with_pubkey(&_a.wrapper_mint.key(), false, true)?,
            ExtraAccountMeta::new_with_pubkey(&_a.fee_wrapper_token_account.key(), false, true)?,
            ExtraAccountMeta::new_with_pubkey(&_a.fee_recipient_liquidity.key(), false, true)?,
            ExtraAccountMeta::new_with_pubkey(
                &_a.fee_liquidity_wsol_token_account.key(),
                false,
                true,
            )?,
            ExtraAccountMeta::new_with_pubkey(&_a.fee_recipient_marketing.key(), false, true)?,
            ExtraAccountMeta::new_with_pubkey(
                &_a.fee_marketing_wsol_token_account.key(),
                false,
                true,
            )?,
            ExtraAccountMeta::new_with_pubkey(&_a.fee_recipient_holders.key(), false, true)?,
            ExtraAccountMeta::new_with_pubkey(
                &_a.fee_holders_wsol_token_account.key(),
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

        ctx.accounts.fee_config.wrapper_mint_address = ctx.accounts.wrapper_mint.key();
        ctx.accounts.fee_config.fee_recipient_liquidity =
            ctx.accounts.fee_recipient_liquidity.key();
        ctx.accounts.fee_config.fee_recipient_marketing =
            ctx.accounts.fee_recipient_marketing.key();
        ctx.accounts.fee_config.fee_recipient_holders = ctx.accounts.fee_recipient_holders.key();
        ctx.accounts.fee_config.fee_percent_liquidity = fee_percent_liquidity;
        ctx.accounts.fee_config.fee_percent_marketing = fee_percent_marketing;
        ctx.accounts.fee_config.fee_percent_holders = fee_percent_holders;

        Ok(())
    }

    pub fn transfer_hook(ctx: Context<TransferHook>, amount: u64) -> Result<()> {
        msg!("Hello Transfer Hook!");

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

#[derive(Accounts)]
pub struct Initialize {}
