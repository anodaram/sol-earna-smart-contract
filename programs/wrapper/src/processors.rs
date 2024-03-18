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

impl<'info> CreateTreasury<'info> {
    pub fn create_treasury(&mut self) -> Result<()> {
        let treasury = &mut self.treasury;
        treasury.authority = self.authority.key();
        treasury.treasury_mint = self.treasury_mint.key();
        treasury.treasury_vault = self.treasury_vault.key();
        treasury.pos_mint = self.pos_mint.key();

        emit!(TreasuryCreated {
            authority: treasury.authority,
            treasury_mint: treasury.treasury_mint,
            treasury_vault: treasury.treasury_vault,
            pos_mint: treasury.pos_mint,
        });

        Ok(())
    }
}

impl<'info> Stake<'info> {
    pub fn stake(&mut self, treasury_bump: u8, amount: u64) -> Result<()> {
        require!(amount > 0, XError::NotAllowed);

        let treasury = &mut self.treasury;

        let signer_seeds: &[&[&[u8]]] = &[&[
            TREASURY_TAG,
            treasury.treasury_mint.as_ref(),
            treasury.authority.as_ref(),
            &[treasury_bump],
        ]];

        transfer_checked(
            CpiContext::new(
                self.token_program.to_account_info(),
                TransferChecked {
                    from: self.user_vault.to_account_info(),
                    to: self.treasury_vault.to_account_info(),
                    mint: self.treasury_mint.to_account_info(),
                    authority: self.authority.to_account_info(),
                },
            ),
            amount,
            self.treasury_mint.decimals,
        )?;

        mint_to(
            CpiContext::new(
                self.token_program.to_account_info(),
                MintTo {
                    mint: self.pos_mint.to_account_info(),
                    to: self.user_pos_vault.to_account_info(),
                    authority: treasury.to_account_info(),
                },
            )
            .with_signer(signer_seeds),
            amount,
        )?;

        emit!(Deposited {
            treasury: treasury.key(),
            user: self.authority.key(),
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
            treasury.authority.as_ref(),
            &[treasury_bump],
        ]];

        burn(
            CpiContext::new(
                self.token_program.to_account_info(),
                Burn {
                    mint: self.pos_mint.to_account_info(),
                    from: self.user_pos_vault.to_account_info(),
                    authority: self.authority.to_account_info(),
                },
            )
            .with_signer(signer_seeds),
            amount,
        )?;

        transfer_checked(
            CpiContext::new(
                self.token_program.to_account_info(),
                TransferChecked {
                    from: self.treasury_vault.to_account_info(),
                    to: self.user_vault.to_account_info(),
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
            user: self.authority.key(),
            amount: amount,
        });

        Ok(())
    }
}
