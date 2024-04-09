use anchor_lang::{
    prelude::*,
    system_program::{create_account, CreateAccount},
};
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{burn, mint_to, Burn, MintTo},
    token_interface::{transfer_checked, TransferChecked},
};
use spl_tlv_account_resolution::{
    account::ExtraAccountMeta, seeds::Seed, state::ExtraAccountMetaList,
};
use spl_transfer_hook_interface::instruction::{ExecuteInstruction, TransferHookInstruction};

declare_id!("2me2g1K7KVA7RBhg1rcbpxRvCknd4v1UCA8RMEjm3hmg");

mod constants;
mod contexts;
mod errors;
mod events;
mod processors;
mod states;
mod utils;

use constants::*;
use contexts::*;

#[program]
pub mod sol_earna {
    // use anchor_spl::token::spl_token::instruction::mint_to;

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
            // source: 0
            // mint: 1
            // destination: 2
            // owner: 3
            // ExtraAccountMetaList: 4
            ExtraAccountMeta::new_with_pubkey(&_a.token_program.key(), false, false)?, // 5
            ExtraAccountMeta::new_with_pubkey(&_a.token_program_org.key(), false, false)?, // 6
            ExtraAccountMeta::new_with_pubkey(&_a.associated_token_program.key(), false, false)?, // 7
            ExtraAccountMeta::new_with_seeds(
                &[
                    Seed::Literal {
                        bytes: "delegate".as_bytes().to_vec(),
                    },
                    Seed::AccountKey { index: 1 }, // treasury_mint
                ],
                false,
                true,
            )?, // 8
            ExtraAccountMeta::new_with_pubkey(&_a.fee_config.key(), false, true)?, // 9
            ExtraAccountMeta::new_with_seeds(
                &[
                    Seed::Literal {
                        bytes: "treasury".as_bytes().to_vec(),
                    },
                    Seed::AccountKey { index: 1 }, // treasury_mint
                ],
                false,
                true,
            )?, // 10
            ExtraAccountMeta::new_with_pubkey(&_a.wsol_mint.key(), false, true)?,  // 11
            ExtraAccountMeta::new_with_pubkey(&_a.wrapper_mint.key(), false, true)?, // 12
            ExtraAccountMeta::new_external_pda_with_seeds( // 13. fee_wrapper_token_account
                7, // associated token program index
                &[
                    Seed::AccountKey { index: 8 }, // owner index
                    Seed::AccountKey { index: 6 }, // token program index
                    Seed::AccountKey { index: 12 }, // wrapper mint index
                ],
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

        ctx.accounts.fee_config.wsol_mint_address = ctx.accounts.wsol_mint.key();
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
        let signer_seeds: &[&[&[u8]]] = &[
            &[
                TREASURY_TAG,
                ctx.accounts.treasury.treasury_mint.as_ref(),
                &[ctx.bumps.treasury],
            ],
        ];

        let fee_config = &mut ctx.accounts.fee_config;
        let total_fee_percent = fee_config.fee_percent_liquidity
            + fee_config.fee_percent_marketing
            + fee_config.fee_percent_holders;

        let total_fee: u64 = amount * total_fee_percent as u64 / 10000;

        // Step 1: mint total_fee of wrapper_mint to fee_wrapper_token_account
        mint_to(
            CpiContext::new(
                ctx.accounts.token_program_org.to_account_info(),
                MintTo {
                    mint: ctx.accounts.wrapper_mint.to_account_info(),
                    to: ctx.accounts.fee_wrapper_token_account.to_account_info(),
                    authority: ctx.accounts.treasury.to_account_info(),
                },
            )
            .with_signer(signer_seeds),
            total_fee,
        )?;

        // Step 2: through raydium, swap from wrapper_mint to wsol

        // Step 3: divide wsol to (wsol_amount_liquidity + wsol_amount_marketing + wsol_amount_holders)

        // Step 4: transfer wsol_amount_liquidity to fee_liquidity_wsol_token_account

        // Step 5: transfer wsol_amount_marketing to fee_marketing_wsol_token_account

        // Step 6: transfer wsol_amount_holders to fee_holders_wsol_token_account

        Ok(())
    }

    pub fn swap_fee_on_exchange(ctx: Context<SwapFeeOnExchange>, amount: u64) -> Result<()> {
        ctx.accounts.swap_fee_on_exchange(amount)
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

    pub fn create_treasury(ctx: Context<CreateTreasury>) -> Result<()> {
        ctx.accounts.create_treasury()
    }

    pub fn stake(ctx: Context<Stake>, amount: u64) -> Result<()> {
        ctx.accounts.stake(ctx.bumps.treasury, amount)
    }
    pub fn redeem(ctx: Context<Redeem>, amount: u64) -> Result<()> {
        ctx.accounts.redeem(ctx.bumps.treasury, amount)
    }
}

#[derive(Accounts)]
pub struct Initialize {}
