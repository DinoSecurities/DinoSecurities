#![allow(unexpected_cfgs)]
#![allow(clippy::result_large_err)]

use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token_interface::Mint;
use spl_tlv_account_resolution::{
    account::ExtraAccountMeta,
    seeds::Seed,
    state::ExtraAccountMetaList,
};
use spl_transfer_hook_interface::instruction::{ExecuteInstruction, TransferHookInstruction};
#[allow(unused_imports)]
use spl_discriminator::SplDiscriminate;

use dino_core::{HolderRecord, SecuritySeries, HOLDER_SEED, SERIES_SEED};

declare_id!("AnpFxJoxNSQEg1CMxM4pe1raqRtkDWzas2UPB4L55oKn");

#[program]
pub mod dino_transfer_hook {
    use super::*;

    /// One-time per mint. Allocates the ExtraAccountMetaList PDA that tells
    /// Token-2022 which accounts to inject when calling `execute`.
    pub fn initialize_extra_account_meta_list(
        ctx: Context<InitializeExtraAccountMetaList>,
    ) -> Result<()> {
        let extra_metas = get_extra_account_metas()?;

        let account_size = ExtraAccountMetaList::size_of(extra_metas.len())? as u64;
        let lamports = Rent::get()?.minimum_balance(account_size as usize);
        let mint_key = ctx.accounts.mint.key();
        let bump = ctx.bumps.extra_account_meta_list;
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"extra-account-metas",
            mint_key.as_ref(),
            &[bump],
        ]];

        system_program::create_account(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                system_program::CreateAccount {
                    from: ctx.accounts.payer.to_account_info(),
                    to: ctx.accounts.extra_account_meta_list.to_account_info(),
                },
                signer_seeds,
            ),
            lamports,
            account_size,
            ctx.program_id,
        )?;

        let mut data = ctx.accounts.extra_account_meta_list.try_borrow_mut_data()?;
        ExtraAccountMetaList::init::<ExecuteInstruction>(&mut data, &extra_metas)?;
        Ok(())
    }

    /// Token-2022 calls this on every transfer of a hooked mint. We validate:
    ///   1. Series is not paused
    ///   2. Destination has a HolderRecord PDA (whitelisted)
    ///   3. Holder is not revoked
    ///   4. Holder is not frozen
    ///   5. Holder KYC is not expired
    ///   6. Reg D restriction: holder is accredited (when applicable)
    ///
    /// Mint authority + permanent delegate transfers (issuer / settlement
    /// agent) still pass through this hook — that's by design: compliance
    /// applies to every transfer regardless of who initiates it.
    pub fn execute(ctx: Context<Execute>, _amount: u64) -> Result<()> {
        let series = &ctx.accounts.series;
        require!(!series.paused, HookError::SeriesPaused);

        let dest_holder = &ctx.accounts.destination_holder;
        require_keys_eq!(dest_holder.mint, series.mint, HookError::HolderMintMismatch);
        require!(!dest_holder.is_revoked, HookError::HolderRevoked);
        require!(!dest_holder.is_frozen, HookError::HolderFrozen);
        require!(
            dest_holder.kyc_expiry > Clock::get()?.unix_timestamp,
            HookError::HolderKycExpired,
        );

        if matches!(series.transfer_restriction, dino_core::TransferRestriction::RegD) {
            require!(dest_holder.is_accredited, HookError::AccreditationRequired);
        }

        Ok(())
    }

    /// Fallback dispatches the SPL Transfer-Hook interface so Token-2022
    /// finds our `execute` via discriminator.
    pub fn fallback<'info>(
        program_id: &Pubkey,
        accounts: &'info [AccountInfo<'info>],
        data: &[u8],
    ) -> Result<()> {
        let instruction = TransferHookInstruction::unpack(data)?;
        match instruction {
            TransferHookInstruction::Execute { amount } => {
                let amount_bytes = amount.to_le_bytes();
                __private::__global::execute(program_id, accounts, &amount_bytes)
            }
            _ => Err(ProgramError::InvalidInstructionData.into()),
        }
    }
}

fn get_extra_account_metas() -> Result<Vec<ExtraAccountMeta>> {
    // Token-2022 hook account positions:
    //   0: source token account
    //   1: mint
    //   2: destination token account
    //   3: source owner
    //   4: extra_account_meta_list (this PDA)
    // Extra accounts appended below start at index 5.
    Ok(vec![
        // [5] dino_core program — referenced for PDA derivation of [6] and [7].
        ExtraAccountMeta::new_with_pubkey(&dino_core::ID, false, false)?,
        // [6] SecuritySeries PDA owned by dino_core: ["series", mint]
        ExtraAccountMeta::new_external_pda_with_seeds(
            5,
            &[
                Seed::Literal { bytes: SERIES_SEED.to_vec() },
                Seed::AccountKey { index: 1 },
            ],
            false,
            false,
        )?,
        // [7] Destination HolderRecord PDA owned by dino_core:
        //     ["holder", mint, destination_owner]
        // destination_owner is read from bytes [32..64] of the destination
        // token account (account index 2).
        ExtraAccountMeta::new_external_pda_with_seeds(
            5,
            &[
                Seed::Literal { bytes: HOLDER_SEED.to_vec() },
                Seed::AccountKey { index: 1 },
                Seed::AccountData { account_index: 2, data_index: 32, length: 32 },
            ],
            false,
            false,
        )?,
    ])
}

#[derive(Accounts)]
pub struct InitializeExtraAccountMetaList<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: PDA created and initialized by this instruction.
    #[account(
        mut,
        seeds = [b"extra-account-metas", mint.key().as_ref()],
        bump,
    )]
    pub extra_account_meta_list: UncheckedAccount<'info>,
    pub mint: InterfaceAccount<'info, Mint>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Execute<'info> {
    /// CHECK: source token account
    pub source: UncheckedAccount<'info>,
    pub mint: InterfaceAccount<'info, Mint>,
    /// CHECK: destination token account
    pub destination: UncheckedAccount<'info>,
    /// CHECK: source owner
    pub source_owner: UncheckedAccount<'info>,
    /// CHECK: ExtraAccountMetaList PDA
    #[account(
        seeds = [b"extra-account-metas", mint.key().as_ref()],
        bump,
    )]
    pub extra_account_meta_list: UncheckedAccount<'info>,

    /// CHECK: dino_core program — present for PDA derivation by TLV resolver.
    #[account(address = dino_core::ID)]
    pub dino_core_program: UncheckedAccount<'info>,

    /// SecuritySeries PDA (TLV-resolved). Must be owned by dino_core; its
    /// `mint` field must equal our mint (enforced by Anchor's account
    /// deserialization via dino_core's discriminator + mint constraint).
    #[account(
        owner = dino_core::ID,
        constraint = series.mint == mint.key() @ HookError::HolderMintMismatch,
    )]
    pub series: Account<'info, SecuritySeries>,

    /// Destination HolderRecord (TLV-resolved using destination_owner from
    /// the destination token account's data bytes [32..64]). The PDA is
    /// derived deterministically by Token-2022's TLV resolver, so if the
    /// supplied account doesn't match the derived address Token-2022 itself
    /// rejects the transfer before our hook runs.
    #[account(owner = dino_core::ID)]
    pub destination_holder: Account<'info, HolderRecord>,
}

#[error_code]
pub enum HookError {
    #[msg("Series is paused — transfers disabled")]
    SeriesPaused,
    #[msg("Holder record mint does not match transfer mint")]
    HolderMintMismatch,
    #[msg("Recipient holder has been revoked")]
    HolderRevoked,
    #[msg("Recipient holder is frozen")]
    HolderFrozen,
    #[msg("Recipient holder KYC has expired")]
    HolderKycExpired,
    #[msg("Reg D requires accredited investor status")]
    AccreditationRequired,
}
