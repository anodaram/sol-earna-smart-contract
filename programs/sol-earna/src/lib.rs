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
    ) -> Result<()> {

        // The `addExtraAccountsToInstruction` JS helper function resolving incorrectly
        let account_metas = vec![
            
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


// TODO: need to move this struct to context.rs, the problem is to access to payer(Signer) from outside
#[derive(Accounts)]
pub struct InitializeExtraAccountMetaList<'info> {
    #[account(mut)]
    payer: Signer<'info>,

    /// CHECK: ExtraAccountMetaList Account, must use these seeds
    #[account(
        mut,
        seeds = [EXTRA_ACCOUNT_METAS_TAG, mint.key().as_ref()], 
        bump
    )]
    pub extra_account_meta_list: AccountInfo<'info>,
    pub mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,

    #[account(
        init,
        seeds = [FEE_CONFIG_TAG, mint.key().as_ref(), payer.key().as_ref()],
        payer = payer,
        bump,
        space = std::mem::size_of::<FeeConfig>() + 8
    )]
    pub FeeConfig: Account<'info, FeeConfig>,
}
