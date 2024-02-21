use anchor_lang::{
    prelude::*,
    system_program::{create_account, CreateAccount},
};
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};
use spl_tlv_account_resolution::{
    account::ExtraAccountMeta, seeds::Seed, state::ExtraAccountMetaList,
};
use spl_transfer_hook_interface::instruction::{ExecuteInstruction, TransferHookInstruction};

declare_id!("xnwVapsgETFh2cz8LFPfTyneACVaMtxbR7D7KeFH3K8");

mod processors;
pub mod errors;
pub mod events;
pub mod states;
pub mod utils;
pub mod contexts;
pub mod constants;

pub use contexts::*;
pub use utils::*;
use states::*;
use constants::*;

#[program]
pub mod sol_earna {
    use super::*;

    pub fn initialize_extra_account_meta_list(
        ctx: Context<InitializeExtraAccountMetaList>,
        fee_percent_holders: u16,
        fee_percent_marketing: u16,
        fee_percent_liqudity: u16,
    ) -> Result<()> {
        let mut fee_config_key: Vec<u8> = Vec::new();
        fee_config_key.extend_from_slice(FEE_CONFIG_TAG);
        fee_config_key.extend_from_slice(ctx.accounts.mint.key().as_ref());

        // The `addExtraAccountsToInstruction` JS helper function resolving incorrectly
        let account_metas = vec![
            ExtraAccountMeta::new_with_seeds(
                &[Seed::Literal {
                    bytes: "fee-config".as_bytes().to_vec(),
                }],
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
        ctx.accounts.fee_config.marketing_token_account = ctx.accounts.marketing_token_account.key();
        ctx.accounts.fee_config.liquidity_token_account = ctx.accounts.liquidity_token_account.key();
        ctx.accounts.fee_config.holders_token_account = ctx.accounts.holders_token_account.key();

        Ok(())
    }

    pub fn transfer_hook(ctx: Context<TransferHook>, amount: u64) -> Result<()> {
        // let fee_config = ctx.accounts.extra_account_meta_list;

        msg!("Hello Transfer Hook!");

        // let fee_free: bool = false;
        // if ctx.accounts.source_token.key() == ctx.accounts.fee_config.marketing_token_account || ctx.accounts.destination_token.key() == ctx.accounts.fee_config.marketing_token_account {
            
        // }

        // transfer_checked(
        //     CpiContext::new
        // )

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

