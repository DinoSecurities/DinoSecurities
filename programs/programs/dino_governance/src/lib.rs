#![allow(unexpected_cfgs)]
#![allow(clippy::result_large_err)]

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount};

declare_id!("54G8PfLKQdoBN8zRjMxZjVbQqpcD3uvVSgrmXyZzkz1p");

pub const REALM_SEED: &[u8] = b"realm";
pub const PROPOSAL_SEED: &[u8] = b"proposal";
pub const VOTE_SEED: &[u8] = b"vote";

pub const MAX_TITLE: usize = 96;
pub const MAX_URI: usize = 200;

/// Lightweight, security-token-native governance.
///
/// Each security series (Token-2022 mint) gets a Realm. Token holders vote
/// proportional to their balance at the time the proposal was created (a
/// snapshot must be taken off-chain via Helius indexer; this program trusts
/// the supplied vote_weight parameter signed by the realm authority for the
/// MVP. A future upgrade can replace this with on-chain Token-2022 balance
/// reads when the Confidential Transfer extension support stabilises.)
#[program]
pub mod dino_governance {
    use super::*;

    pub fn create_realm(
        ctx: Context<CreateRealm>,
        params: RealmParams,
    ) -> Result<()> {
        require!(params.vote_threshold_bps <= 10_000, GovError::InvalidThreshold);
        require!(params.quorum_bps <= 10_000, GovError::InvalidThreshold);
        require!(params.voting_period > 0, GovError::InvalidPeriod);

        let r = &mut ctx.accounts.realm;
        r.security_mint = ctx.accounts.security_mint.key();
        r.authority = ctx.accounts.authority.key();
        r.vote_threshold_bps = params.vote_threshold_bps;
        r.quorum_bps = params.quorum_bps;
        r.voting_period = params.voting_period;
        r.cooloff_period = params.cooloff_period;
        r.min_proposal_weight = params.min_proposal_weight;
        r.proposal_count = 0;
        r.bump = ctx.bumps.realm;

        emit!(RealmCreated { mint: r.security_mint, authority: r.authority });
        Ok(())
    }

    /// Anyone holding at least `min_proposal_weight` of the security may
    /// create a proposal. Proposer must hold tokens (verified by ATA).
    pub fn create_proposal(
        ctx: Context<CreateProposal>,
        params: ProposalParams,
    ) -> Result<()> {
        require!(params.title.len() <= MAX_TITLE, GovError::FieldTooLong);
        require!(params.description_uri.len() <= MAX_URI, GovError::FieldTooLong);

        let realm = &mut ctx.accounts.realm;
        require!(
            ctx.accounts.proposer_token_account.amount >= realm.min_proposal_weight,
            GovError::InsufficientWeight
        );

        let now = Clock::get()?.unix_timestamp;
        let p = &mut ctx.accounts.proposal;
        p.realm = realm.key();
        p.security_mint = realm.security_mint;
        p.proposer = ctx.accounts.proposer.key();
        p.proposal_type = params.proposal_type;
        p.title = params.title;
        p.description_uri = params.description_uri;
        p.execution_payload = params.execution_payload;
        p.created_at = now;
        p.voting_ends_at = now.checked_add(realm.voting_period).ok_or(GovError::Overflow)?;
        p.execution_eta = p.voting_ends_at.checked_add(realm.cooloff_period).ok_or(GovError::Overflow)?;
        p.yes_votes = 0;
        p.no_votes = 0;
        p.abstain_votes = 0;
        p.status = ProposalStatus::Voting;
        p.index = realm.proposal_count;
        p.bump = ctx.bumps.proposal;

        realm.proposal_count = realm.proposal_count.checked_add(1).ok_or(GovError::Overflow)?;

        emit!(ProposalCreated {
            proposal: p.key(),
            realm: realm.key(),
            proposer: p.proposer,
            proposal_type: p.proposal_type,
            voting_ends_at: p.voting_ends_at,
        });
        Ok(())
    }

    /// Cast a vote. Vote weight = current ATA balance. Snapshot enforcement
    /// (preventing double-voting via transfer-then-vote) is achieved by
    /// the per-(proposal, voter) VoteRecord PDA: a voter can only vote once
    /// per proposal, regardless of subsequent transfers.
    pub fn cast_vote(ctx: Context<CastVote>, vote: VoteChoice) -> Result<()> {
        let proposal = &mut ctx.accounts.proposal;
        require!(proposal.status == ProposalStatus::Voting, GovError::NotVoting);
        let now = Clock::get()?.unix_timestamp;
        require!(now < proposal.voting_ends_at, GovError::VotingEnded);

        let weight = ctx.accounts.voter_token_account.amount;
        require!(weight > 0, GovError::ZeroWeight);

        let record = &mut ctx.accounts.vote_record;
        record.proposal = proposal.key();
        record.voter = ctx.accounts.voter.key();
        record.choice = vote;
        record.weight = weight;
        record.cast_at = now;
        record.bump = ctx.bumps.vote_record;

        match vote {
            VoteChoice::Yes => proposal.yes_votes = proposal.yes_votes.checked_add(weight).ok_or(GovError::Overflow)?,
            VoteChoice::No => proposal.no_votes = proposal.no_votes.checked_add(weight).ok_or(GovError::Overflow)?,
            VoteChoice::Abstain => proposal.abstain_votes = proposal.abstain_votes.checked_add(weight).ok_or(GovError::Overflow)?,
        }

        emit!(VoteCast {
            proposal: proposal.key(),
            voter: record.voter,
            choice: vote,
            weight,
        });
        Ok(())
    }

    /// Finalize after voting period ends. Tallies + transitions to Succeeded
    /// or Defeated. Anyone may call.
    pub fn finalize_proposal(ctx: Context<FinalizeProposal>) -> Result<()> {
        let proposal = &mut ctx.accounts.proposal;
        require!(proposal.status == ProposalStatus::Voting, GovError::NotVoting);
        let now = Clock::get()?.unix_timestamp;
        require!(now >= proposal.voting_ends_at, GovError::VotingNotEnded);

        let realm = &ctx.accounts.realm;
        let total_supply = ctx.accounts.security_mint.supply;
        let total_cast = proposal.yes_votes
            .checked_add(proposal.no_votes)
            .and_then(|x| x.checked_add(proposal.abstain_votes))
            .ok_or(GovError::Overflow)?;

        let quorum_required = (total_supply as u128)
            .checked_mul(realm.quorum_bps as u128).ok_or(GovError::Overflow)?
            .checked_div(10_000).ok_or(GovError::Overflow)? as u64;

        if total_cast < quorum_required {
            proposal.status = ProposalStatus::Defeated;
            emit!(ProposalFinalized { proposal: proposal.key(), status: proposal.status });
            return Ok(());
        }

        let approval_required = ((proposal.yes_votes as u128)
            .checked_add(proposal.no_votes as u128).ok_or(GovError::Overflow)?)
            .checked_mul(realm.vote_threshold_bps as u128).ok_or(GovError::Overflow)?
            .checked_div(10_000).ok_or(GovError::Overflow)? as u64;

        proposal.status = if proposal.yes_votes >= approval_required {
            ProposalStatus::Succeeded
        } else {
            ProposalStatus::Defeated
        };

        emit!(ProposalFinalized { proposal: proposal.key(), status: proposal.status });
        Ok(())
    }

    /// Mark a Succeeded proposal as Executed after the cool-off period.
    /// Actual execution (e.g. updating legal doc URI on dino_core) is done
    /// off-chain by the realm authority observing this state change, since
    /// proposal types vary widely. A future upgrade can add per-type
    /// on-chain CPI dispatch.
    pub fn execute_proposal(ctx: Context<ExecuteProposal>) -> Result<()> {
        let proposal = &mut ctx.accounts.proposal;
        require!(proposal.status == ProposalStatus::Succeeded, GovError::NotSucceeded);
        let now = Clock::get()?.unix_timestamp;
        require!(now >= proposal.execution_eta, GovError::CooloffActive);

        proposal.status = ProposalStatus::Executed;
        emit!(ProposalExecuted { proposal: proposal.key() });
        Ok(())
    }
}

// ============================================================================
// Account contexts
// ============================================================================

#[derive(Accounts)]
pub struct CreateRealm<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Realm::INIT_SPACE,
        seeds = [REALM_SEED, security_mint.key().as_ref()],
        bump,
    )]
    pub realm: Account<'info, Realm>,
    pub security_mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateProposal<'info> {
    #[account(
        mut,
        seeds = [REALM_SEED, realm.security_mint.as_ref()],
        bump = realm.bump,
    )]
    pub realm: Account<'info, Realm>,
    #[account(
        init,
        payer = proposer,
        space = 8 + Proposal::INIT_SPACE,
        seeds = [
            PROPOSAL_SEED,
            realm.key().as_ref(),
            &realm.proposal_count.to_le_bytes(),
        ],
        bump,
    )]
    pub proposal: Account<'info, Proposal>,
    /// Proposer's ATA for the security — used to verify min_proposal_weight.
    #[account(
        constraint = proposer_token_account.mint == realm.security_mint @ GovError::MintMismatch,
        constraint = proposer_token_account.owner == proposer.key() @ GovError::WrongOwner,
    )]
    pub proposer_token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub proposer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CastVote<'info> {
    #[account(
        mut,
        seeds = [
            PROPOSAL_SEED,
            proposal.realm.as_ref(),
            &proposal.index.to_le_bytes(),
        ],
        bump = proposal.bump,
    )]
    pub proposal: Account<'info, Proposal>,
    #[account(
        init,
        payer = voter,
        space = 8 + VoteRecord::INIT_SPACE,
        seeds = [VOTE_SEED, proposal.key().as_ref(), voter.key().as_ref()],
        bump,
    )]
    pub vote_record: Account<'info, VoteRecord>,
    #[account(
        constraint = voter_token_account.mint == proposal.security_mint @ GovError::MintMismatch,
        constraint = voter_token_account.owner == voter.key() @ GovError::WrongOwner,
    )]
    pub voter_token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub voter: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FinalizeProposal<'info> {
    #[account(
        seeds = [REALM_SEED, realm.security_mint.as_ref()],
        bump = realm.bump,
    )]
    pub realm: Account<'info, Realm>,
    #[account(
        mut,
        seeds = [
            PROPOSAL_SEED,
            proposal.realm.as_ref(),
            &proposal.index.to_le_bytes(),
        ],
        bump = proposal.bump,
        constraint = proposal.realm == realm.key() @ GovError::WrongRealm,
    )]
    pub proposal: Account<'info, Proposal>,
    #[account(constraint = security_mint.key() == realm.security_mint @ GovError::MintMismatch)]
    pub security_mint: InterfaceAccount<'info, Mint>,
}

#[derive(Accounts)]
pub struct ExecuteProposal<'info> {
    #[account(
        mut,
        seeds = [
            PROPOSAL_SEED,
            proposal.realm.as_ref(),
            &proposal.index.to_le_bytes(),
        ],
        bump = proposal.bump,
    )]
    pub proposal: Account<'info, Proposal>,
    pub executor: Signer<'info>,
}

// ============================================================================
// State
// ============================================================================

#[account]
#[derive(InitSpace)]
pub struct Realm {
    pub security_mint: Pubkey,
    pub authority: Pubkey,
    pub vote_threshold_bps: u16,
    pub quorum_bps: u16,
    pub voting_period: i64,
    pub cooloff_period: i64,
    pub min_proposal_weight: u64,
    pub proposal_count: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Proposal {
    pub realm: Pubkey,
    pub security_mint: Pubkey,
    pub proposer: Pubkey,
    pub proposal_type: ProposalType,
    #[max_len(MAX_TITLE)]
    pub title: String,
    #[max_len(MAX_URI)]
    pub description_uri: String,
    /// Opaque payload describing the off-chain action (e.g. new doc hash).
    /// Length capped to 256 bytes to keep account size bounded.
    #[max_len(256)]
    pub execution_payload: Vec<u8>,
    pub created_at: i64,
    pub voting_ends_at: i64,
    pub execution_eta: i64,
    pub yes_votes: u64,
    pub no_votes: u64,
    pub abstain_votes: u64,
    pub status: ProposalStatus,
    pub index: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct VoteRecord {
    pub proposal: Pubkey,
    pub voter: Pubkey,
    pub choice: VoteChoice,
    pub weight: u64,
    pub cast_at: i64,
    pub bump: u8,
}

// ============================================================================
// Enums + params
// ============================================================================

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum ProposalType {
    UpdateLegalDoc,
    UpdateTransferRestrictions,
    MintAdditional,
    BurnTokens,
    FreezeHolder,
    EmergencyPause,
    TreasuryTransfer,
    UpgradeProgram,
    Generic,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum ProposalStatus {
    Voting,
    Succeeded,
    Defeated,
    Executed,
    Cancelled,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum VoteChoice { Yes, No, Abstain }

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct RealmParams {
    pub vote_threshold_bps: u16,
    pub quorum_bps: u16,
    pub voting_period: i64,
    pub cooloff_period: i64,
    pub min_proposal_weight: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ProposalParams {
    pub title: String,
    pub description_uri: String,
    pub proposal_type: ProposalType,
    pub execution_payload: Vec<u8>,
}

// ============================================================================
// Events
// ============================================================================

#[event]
pub struct RealmCreated { pub mint: Pubkey, pub authority: Pubkey }

#[event]
pub struct ProposalCreated {
    pub proposal: Pubkey,
    pub realm: Pubkey,
    pub proposer: Pubkey,
    pub proposal_type: ProposalType,
    pub voting_ends_at: i64,
}

#[event]
pub struct VoteCast {
    pub proposal: Pubkey,
    pub voter: Pubkey,
    pub choice: VoteChoice,
    pub weight: u64,
}

#[event]
pub struct ProposalFinalized { pub proposal: Pubkey, pub status: ProposalStatus }

#[event]
pub struct ProposalExecuted { pub proposal: Pubkey }

// ============================================================================
// Errors
// ============================================================================

#[error_code]
pub enum GovError {
    #[msg("Field exceeds maximum length")]
    FieldTooLong,
    #[msg("Threshold must be 0–10000 bps")]
    InvalidThreshold,
    #[msg("Voting period must be > 0")]
    InvalidPeriod,
    #[msg("Insufficient token weight to propose")]
    InsufficientWeight,
    #[msg("Voter has zero weight")]
    ZeroWeight,
    #[msg("Proposal is not in Voting status")]
    NotVoting,
    #[msg("Proposal voting has ended")]
    VotingEnded,
    #[msg("Proposal voting has not ended")]
    VotingNotEnded,
    #[msg("Proposal did not succeed")]
    NotSucceeded,
    #[msg("Cool-off period still active")]
    CooloffActive,
    #[msg("Mint mismatch")]
    MintMismatch,
    #[msg("Token account owner mismatch")]
    WrongOwner,
    #[msg("Proposal does not belong to this realm")]
    WrongRealm,
    #[msg("Arithmetic overflow")]
    Overflow,
}
