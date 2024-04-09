use crate::*;
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{burn, mint_to, Burn, MintTo},
    token_interface::{transfer_checked, TransferChecked},
};
use constants::*;
use errors::*;
use events::*;
use raydium_amm_v3::amm_anchor;


impl<'info> SwapFeeOnExchange<'info> {
    pub fn swap_fee_on_exchange(&mut self, amount: u64) -> Result<()> {
        Ok(())
    }
}

impl<'info> CreateTreasury<'info> {
    pub fn create_treasury(&mut self) -> Result<()> {
        let treasury = &mut self.treasury;
        treasury.authority = self.authority.key();
        treasury.treasury_mint = self.treasury_mint.key();
        treasury.treasury_token_account = self.treasury_token_account.key();
        treasury.wrapper_mint = self.wrapper_mint.key();

        emit!(TreasuryCreated {
            authority: treasury.authority,
            treasury_mint: treasury.treasury_mint,
            treasury_token_account: treasury.treasury_token_account,
            wrapper_mint: treasury.wrapper_mint,
        });

        Ok(())
    }
}

impl<'info> Stake<'info> {
    pub fn stake(&mut self, treasury_bump: u8, amount: u64) -> Result<()> {
        if amount == 0 {
            return Ok(())
        }

        let treasury = &mut self.treasury;

        let signer_seeds: &[&[&[u8]]] = &[&[
            TREASURY_TAG,
            treasury.treasury_mint.as_ref(),
            &[treasury_bump],
        ]];

        transfer_checked(
            CpiContext::new(
                self.token_program_treasury.to_account_info(),
                TransferChecked {
                    from: self.user_token_account.to_account_info(),
                    to: self.treasury_token_account.to_account_info(),
                    mint: self.treasury_mint.to_account_info(),
                    authority: self.user.to_account_info(),
                },
            ),
            amount,
            self.treasury_mint.decimals,
        )?;

        mint_to(
            CpiContext::new(
                self.token_program.to_account_info(),
                MintTo {
                    mint: self.wrapper_mint.to_account_info(),
                    to: self.user_wrapper_token_account.to_account_info(),
                    authority: treasury.to_account_info(),
                },
            )
            .with_signer(signer_seeds),
            amount,
        )?;

        emit!(Deposited {
            treasury: treasury.key(),
            user: self.user.key(),
            amount: amount,
        });

        Ok(())
    }
}

impl<'info> Redeem<'info> {
    pub fn redeem(&mut self, treasury_bump: u8, amount: u64) -> Result<()> {
        require!(amount > 0, XError::NotAllowed);

        let treasury = &mut self.treasury;

        let signer_seeds: &[&[&[u8]]] = &[&[
            TREASURY_TAG,
            treasury.treasury_mint.as_ref(),
            &[treasury_bump],
        ]];

        burn(
            CpiContext::new(
                self.token_program.to_account_info(),
                Burn {
                    mint: self.wrapper_mint.to_account_info(),
                    from: self.user_wrapper_token_account.to_account_info(),
                    authority: self.user.to_account_info(),
                },
            )
            .with_signer(signer_seeds),
            amount,
        )?;

        transfer_checked(
            CpiContext::new(
                self.token_program_treasury.to_account_info(),
                TransferChecked {
                    from: self.treasury_token_account.to_account_info(),
                    to: self.user_token_account.to_account_info(),
                    mint: self.treasury_mint.to_account_info(),
                    authority: treasury.to_account_info(),
                },
            )
            .with_signer(signer_seeds),
            amount,
            self.treasury_mint.decimals,
        )?;

        emit!(Claimed {
            treasury: treasury.key(),
            user: self.user.key(),
            amount: amount,
        });

        Ok(())
    }
}
