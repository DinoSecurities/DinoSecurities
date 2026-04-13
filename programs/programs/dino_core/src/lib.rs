#![allow(unexpected_cfgs)]
#![allow(clippy::result_large_err)]

use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_2022::{self, Token2022};
use anchor_spl::token_interface::{Mint, TokenAccount, TransferChecked};

declare_id!("2357nPiEYZS5YFmMoviaS5f4jGBSEaV8hR5TZsXM25sA");

pub const PLATFORM_SEED: &[u8] = b"platform";
pub const ISSUER_SEED: &[u8] = b"issuer";
pub const SERIES_SEED: &[u8] = b"series";
pub const HOLDER_SEED: &[u8] = b"holder";
pub const ORDER_SEED: &[u8] = b"order";

pub const MAX_NAME: usize = 64;
pub const MAX_SYMBOL: usize = 16;
pub const MAX_JURISDICTION: usize = 8;
pub const MAX_ISIN: usize = 12;
pub const MAX_URI: usize = 200;
pub const MAX_LEGAL_NAME: usize = 128;

#[program]
pub mod dino_core {
    use super::*;

    pub fn initialize_platform(
        ctx: Context<InitializePlatform>,
        settlement_agent: Pubkey,
        kyc_oracle: Pubkey,
    ) -> Result<()> {
        let cfg = &mut ctx.accounts.platform;
        cfg.admin = ctx.accounts.admin.key();
        cfg.settlement_agent = settlement_agent;
        cfg.kyc_oracle = kyc_oracle;
        cfg.paused = false;
        cfg.bump = ctx.bumps.platform;
        emit!(PlatformInitialized {
            admin: cfg.admin,
            settlement_agent,
            kyc_oracle,
        });
        Ok(())
    }

    pub fn update_platform(
        ctx: Context<UpdatePlatform>,
        new_admin: Option<Pubkey>,
        new_settlement_agent: Option<Pubkey>,
        new_kyc_oracle: Option<Pubkey>,
        paused: Option<bool>,
    ) -> Result<()> {
        let cfg = &mut ctx.accounts.platform;
        if let Some(a) = new_admin { cfg.admin = a; }
        if let Some(s) = new_settlement_agent { cfg.settlement_agent = s; }
        if let Some(k) = new_kyc_oracle { cfg.kyc_oracle = k; }
        if let Some(p) = paused { cfg.paused = p; }
        Ok(())
    }

    pub fn register_issuer(
        ctx: Context<RegisterIssuer>,
        legal_name: String,
        jurisdiction: String,
        kyc_hash: [u8; 32],
        kyc_expiry: i64,
    ) -> Result<()> {
        require!(legal_name.len() <= MAX_LEGAL_NAME, DinoError::FieldTooLong);
        require!(jurisdiction.len() <= MAX_JURISDICTION, DinoError::FieldTooLong);
        require!(kyc_expiry > Clock::get()?.unix_timestamp, DinoError::KycExpired);

        let issuer = &mut ctx.accounts.issuer;
        issuer.authority = ctx.accounts.authority.key();
        issuer.legal_name = legal_name;
        issuer.jurisdiction = jurisdiction;
        issuer.kyc_hash = kyc_hash;
        issuer.kyc_expiry = kyc_expiry;
        issuer.is_active = true;
        issuer.series_count = 0;
        issuer.bump = ctx.bumps.issuer;

        emit!(IssuerRegistered { authority: issuer.authority });
        Ok(())
    }

    pub fn create_security_series(
        ctx: Context<CreateSecuritySeries>,
        params: CreateSeriesParams,
    ) -> Result<()> {
        require!(params.name.len() <= MAX_NAME, DinoError::FieldTooLong);
        require!(params.symbol.len() <= MAX_SYMBOL, DinoError::FieldTooLong);
        require!(params.doc_uri.len() <= MAX_URI, DinoError::FieldTooLong);
        require!(params.isin.len() <= MAX_ISIN, DinoError::FieldTooLong);
        require!(params.max_supply > 0, DinoError::InvalidSupply);
        require!(ctx.accounts.issuer.is_active, DinoError::IssuerInactive);
        require!(
            ctx.accounts.issuer.kyc_expiry > Clock::get()?.unix_timestamp,
            DinoError::KycExpired
        );

        let s = &mut ctx.accounts.series;
        s.issuer = ctx.accounts.issuer.key();
        s.mint = ctx.accounts.mint.key();
        s.name = params.name;
        s.symbol = params.symbol;
        s.security_type = params.security_type;
        s.doc_hash = params.doc_hash;
        s.doc_uri = params.doc_uri;
        s.isin = params.isin;
        s.max_supply = params.max_supply;
        s.current_supply = 0;
        s.transfer_restriction = params.transfer_restriction;
        s.paused = false;
        s.governance_realm = Pubkey::default();
        s.created_at = Clock::get()?.unix_timestamp;
        s.bump = ctx.bumps.series;

        let issuer = &mut ctx.accounts.issuer;
        issuer.series_count = issuer.series_count.saturating_add(1);

        emit!(SeriesCreated {
            mint: s.mint,
            issuer: s.issuer,
            symbol: s.symbol.clone(),
            max_supply: s.max_supply,
        });
        Ok(())
    }

    pub fn mint_securities(ctx: Context<MintSecurities>, amount: u64) -> Result<()> {
        require!(!ctx.accounts.series.paused, DinoError::SeriesPaused);
        let new_supply = ctx.accounts.series.current_supply
            .checked_add(amount)
            .ok_or(DinoError::Overflow)?;
        require!(new_supply <= ctx.accounts.series.max_supply, DinoError::SupplyExceeded);

        let mint_key = ctx.accounts.mint.key();
        let series_bump = ctx.accounts.series.bump;
        let signer_seeds: &[&[&[u8]]] = &[&[
            SERIES_SEED,
            mint_key.as_ref(),
            &[series_bump],
        ]];
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token_2022::MintTo {
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.recipient_token_account.to_account_info(),
                authority: ctx.accounts.series.to_account_info(),
            },
            signer_seeds,
        );
        token_2022::mint_to(cpi_ctx, amount)?;

        let series = &mut ctx.accounts.series;
        series.current_supply = new_supply;
        let mint = series.mint;
        emit!(SecurityMinted {
            mint,
            recipient: ctx.accounts.recipient.key(),
            amount,
            new_supply,
        });
        Ok(())
    }

    pub fn register_holder(
        ctx: Context<RegisterHolder>,
        wallet: Pubkey,
        kyc_hash: [u8; 32],
        kyc_expiry: i64,
        is_accredited: bool,
        jurisdiction: [u8; 2],
    ) -> Result<()> {
        require!(
            ctx.accounts.signer.key() == ctx.accounts.platform.kyc_oracle,
            DinoError::UnauthorizedOracle
        );
        require!(kyc_expiry > Clock::get()?.unix_timestamp, DinoError::KycExpired);

        let h = &mut ctx.accounts.holder;
        h.wallet = wallet;
        h.mint = ctx.accounts.mint.key();
        h.kyc_hash = kyc_hash;
        h.kyc_expiry = kyc_expiry;
        h.is_accredited = is_accredited;
        h.is_frozen = false;
        h.is_revoked = false;
        h.jurisdiction = jurisdiction;
        h.bump = ctx.bumps.holder;

        emit!(HolderRegistered { mint: h.mint, wallet, is_accredited });
        Ok(())
    }

    pub fn update_holder_kyc(
        ctx: Context<UpdateHolder>,
        kyc_hash: [u8; 32],
        kyc_expiry: i64,
        is_accredited: bool,
    ) -> Result<()> {
        require!(
            ctx.accounts.signer.key() == ctx.accounts.platform.kyc_oracle,
            DinoError::UnauthorizedOracle
        );
        let h = &mut ctx.accounts.holder;
        h.kyc_hash = kyc_hash;
        h.kyc_expiry = kyc_expiry;
        h.is_accredited = is_accredited;
        Ok(())
    }

    pub fn revoke_holder(ctx: Context<UpdateHolder>) -> Result<()> {
        require!(
            ctx.accounts.signer.key() == ctx.accounts.platform.kyc_oracle,
            DinoError::UnauthorizedOracle
        );
        ctx.accounts.holder.is_revoked = true;
        emit!(HolderRevoked {
            mint: ctx.accounts.holder.mint,
            wallet: ctx.accounts.holder.wallet,
        });
        Ok(())
    }

    pub fn freeze_holder(ctx: Context<IssuerHolderAction>) -> Result<()> {
        ctx.accounts.holder.is_frozen = true;
        Ok(())
    }

    pub fn thaw_holder(ctx: Context<IssuerHolderAction>) -> Result<()> {
        ctx.accounts.holder.is_frozen = false;
        Ok(())
    }

    pub fn emergency_pause(ctx: Context<EmergencyPause>, paused: bool) -> Result<()> {
        ctx.accounts.series.paused = paused;
        emit!(SeriesPauseChanged { mint: ctx.accounts.series.mint, paused });
        Ok(())
    }

    pub fn create_settlement_order(
        ctx: Context<CreateSettlementOrder>,
        params: CreateOrderParams,
    ) -> Result<()> {
        require!(params.token_amount > 0, DinoError::InvalidAmount);
        require!(params.payment_amount > 0, DinoError::InvalidAmount);
        let now = Clock::get()?.unix_timestamp;
        require!(params.expires_at > now, DinoError::ExpirationInPast);

        let o = &mut ctx.accounts.order;
        o.creator = ctx.accounts.creator.key();
        o.side = params.side;
        o.security_mint = ctx.accounts.security_mint.key();
        o.payment_mint = ctx.accounts.payment_mint.key();
        o.token_amount = params.token_amount;
        o.payment_amount = params.payment_amount;
        o.expires_at = params.expires_at;
        o.nonce = params.nonce;
        o.status = OrderStatus::Open;
        o.created_at = now;
        o.bump = ctx.bumps.order;

        emit!(OrderCreated {
            order: o.key(),
            creator: o.creator,
            side: o.side,
            security_mint: o.security_mint,
            token_amount: o.token_amount,
            payment_amount: o.payment_amount,
        });
        Ok(())
    }

    pub fn cancel_settlement_order(ctx: Context<CancelSettlementOrder>) -> Result<()> {
        let o = &mut ctx.accounts.order;
        require!(o.creator == ctx.accounts.creator.key(), DinoError::UnauthorizedOrderAction);
        require!(o.status == OrderStatus::Open, DinoError::OrderNotOpen);
        o.status = OrderStatus::Cancelled;
        Ok(())
    }

    pub fn execute_settlement(ctx: Context<ExecuteSettlement>) -> Result<()> {
        require!(
            ctx.accounts.agent.key() == ctx.accounts.platform.settlement_agent,
            DinoError::UnauthorizedAgent
        );
        require!(!ctx.accounts.platform.paused, DinoError::PlatformPaused);

        let buy = &ctx.accounts.buy_order;
        let sell = &ctx.accounts.sell_order;
        require!(buy.status == OrderStatus::Open, DinoError::OrderNotOpen);
        require!(sell.status == OrderStatus::Open, DinoError::OrderNotOpen);
        require!(buy.side == OrderSide::Buy, DinoError::SideMismatch);
        require!(sell.side == OrderSide::Sell, DinoError::SideMismatch);
        require!(buy.security_mint == sell.security_mint, DinoError::MintMismatch);
        require!(buy.payment_mint == sell.payment_mint, DinoError::MintMismatch);
        require!(buy.token_amount == sell.token_amount, DinoError::AmountMismatch);
        require!(buy.payment_amount == sell.payment_amount, DinoError::AmountMismatch);
        let now = Clock::get()?.unix_timestamp;
        require!(buy.expires_at > now, DinoError::OrderExpired);
        require!(sell.expires_at > now, DinoError::OrderExpired);

        let series = &ctx.accounts.series;
        require!(!series.paused, DinoError::SeriesPaused);

        token_2022::transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.buyer_payment_ata.to_account_info(),
                    mint: ctx.accounts.payment_mint.to_account_info(),
                    to: ctx.accounts.seller_payment_ata.to_account_info(),
                    authority: ctx.accounts.agent.to_account_info(),
                },
            ),
            buy.payment_amount,
            ctx.accounts.payment_mint.decimals,
        )?;

        token_2022::transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.seller_security_ata.to_account_info(),
                    mint: ctx.accounts.security_mint.to_account_info(),
                    to: ctx.accounts.buyer_security_ata.to_account_info(),
                    authority: ctx.accounts.agent.to_account_info(),
                },
            ),
            sell.token_amount,
            ctx.accounts.security_mint.decimals,
        )?;

        let token_amount = ctx.accounts.buy_order.token_amount;
        let payment_amount = ctx.accounts.buy_order.payment_amount;
        let security_mint = series.mint;
        let buy_key = ctx.accounts.buy_order.key();
        let sell_key = ctx.accounts.sell_order.key();
        ctx.accounts.buy_order.status = OrderStatus::Settled;
        ctx.accounts.sell_order.status = OrderStatus::Settled;

        emit!(SettlementExecuted {
            buy_order: buy_key,
            sell_order: sell_key,
            security_mint,
            token_amount,
            payment_amount,
        });
        Ok(())
    }
}

// ============================================================================
// Account contexts
// ============================================================================

#[derive(Accounts)]
pub struct InitializePlatform<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + PlatformConfig::INIT_SPACE,
        seeds = [PLATFORM_SEED],
        bump,
    )]
    pub platform: Account<'info, PlatformConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdatePlatform<'info> {
    #[account(
        mut,
        seeds = [PLATFORM_SEED],
        bump = platform.bump,
        has_one = admin @ DinoError::UnauthorizedAdmin,
    )]
    pub platform: Account<'info, PlatformConfig>,
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct RegisterIssuer<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + IssuerProfile::INIT_SPACE,
        seeds = [ISSUER_SEED, authority.key().as_ref()],
        bump,
    )]
    pub issuer: Account<'info, IssuerProfile>,
    #[account(seeds = [PLATFORM_SEED], bump = platform.bump)]
    pub platform: Account<'info, PlatformConfig>,
    #[account(constraint = oracle.key() == platform.kyc_oracle @ DinoError::UnauthorizedOracle)]
    pub oracle: Signer<'info>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateSecuritySeries<'info> {
    #[account(
        mut,
        seeds = [ISSUER_SEED, authority.key().as_ref()],
        bump = issuer.bump,
        has_one = authority @ DinoError::UnauthorizedIssuer,
    )]
    pub issuer: Account<'info, IssuerProfile>,
    #[account(
        init,
        payer = authority,
        space = 8 + SecuritySeries::INIT_SPACE,
        seeds = [SERIES_SEED, mint.key().as_ref()],
        bump,
    )]
    pub series: Account<'info, SecuritySeries>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MintSecurities<'info> {
    #[account(
        mut,
        seeds = [SERIES_SEED, mint.key().as_ref()],
        bump = series.bump,
        has_one = mint @ DinoError::MintMismatch,
        has_one = issuer @ DinoError::UnauthorizedIssuer,
    )]
    pub series: Account<'info, SecuritySeries>,
    #[account(
        seeds = [ISSUER_SEED, authority.key().as_ref()],
        bump = issuer.bump,
        has_one = authority @ DinoError::UnauthorizedIssuer,
    )]
    pub issuer: Account<'info, IssuerProfile>,
    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,
    pub recipient: SystemAccount<'info>,
    #[account(
        init_if_needed,
        payer = authority,
        associated_token::mint = mint,
        associated_token::authority = recipient,
        associated_token::token_program = token_program,
    )]
    pub recipient_token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(wallet: Pubkey)]
pub struct RegisterHolder<'info> {
    #[account(seeds = [PLATFORM_SEED], bump = platform.bump)]
    pub platform: Account<'info, PlatformConfig>,
    #[account(
        init,
        payer = signer,
        space = 8 + HolderRecord::INIT_SPACE,
        seeds = [HOLDER_SEED, mint.key().as_ref(), wallet.as_ref()],
        bump,
    )]
    pub holder: Account<'info, HolderRecord>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateHolder<'info> {
    #[account(seeds = [PLATFORM_SEED], bump = platform.bump)]
    pub platform: Account<'info, PlatformConfig>,
    #[account(
        mut,
        seeds = [HOLDER_SEED, holder.mint.as_ref(), holder.wallet.as_ref()],
        bump = holder.bump,
    )]
    pub holder: Account<'info, HolderRecord>,
    pub signer: Signer<'info>,
}

#[derive(Accounts)]
pub struct IssuerHolderAction<'info> {
    #[account(
        seeds = [ISSUER_SEED, authority.key().as_ref()],
        bump = issuer.bump,
        has_one = authority @ DinoError::UnauthorizedIssuer,
    )]
    pub issuer: Account<'info, IssuerProfile>,
    #[account(
        seeds = [SERIES_SEED, holder.mint.as_ref()],
        bump = series.bump,
        constraint = series.issuer == issuer.key() @ DinoError::UnauthorizedIssuer,
    )]
    pub series: Account<'info, SecuritySeries>,
    #[account(
        mut,
        seeds = [HOLDER_SEED, holder.mint.as_ref(), holder.wallet.as_ref()],
        bump = holder.bump,
    )]
    pub holder: Account<'info, HolderRecord>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct EmergencyPause<'info> {
    #[account(
        seeds = [ISSUER_SEED, authority.key().as_ref()],
        bump = issuer.bump,
        has_one = authority @ DinoError::UnauthorizedIssuer,
    )]
    pub issuer: Account<'info, IssuerProfile>,
    #[account(
        mut,
        seeds = [SERIES_SEED, series.mint.as_ref()],
        bump = series.bump,
        constraint = series.issuer == issuer.key() @ DinoError::UnauthorizedIssuer,
    )]
    pub series: Account<'info, SecuritySeries>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(params: CreateOrderParams)]
pub struct CreateSettlementOrder<'info> {
    #[account(
        init,
        payer = creator,
        space = 8 + SettlementOrder::INIT_SPACE,
        seeds = [
            ORDER_SEED,
            creator.key().as_ref(),
            &params.nonce.to_le_bytes(),
        ],
        bump,
    )]
    pub order: Account<'info, SettlementOrder>,
    pub security_mint: InterfaceAccount<'info, Mint>,
    pub payment_mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CancelSettlementOrder<'info> {
    #[account(
        mut,
        seeds = [
            ORDER_SEED,
            order.creator.as_ref(),
            &order.nonce.to_le_bytes(),
        ],
        bump = order.bump,
    )]
    pub order: Account<'info, SettlementOrder>,
    pub creator: Signer<'info>,
}

#[derive(Accounts)]
pub struct ExecuteSettlement<'info> {
    #[account(seeds = [PLATFORM_SEED], bump = platform.bump)]
    pub platform: Box<Account<'info, PlatformConfig>>,
    #[account(
        seeds = [SERIES_SEED, security_mint.key().as_ref()],
        bump = series.bump,
    )]
    pub series: Box<Account<'info, SecuritySeries>>,
    #[account(
        mut,
        seeds = [ORDER_SEED, buy_order.creator.as_ref(), &buy_order.nonce.to_le_bytes()],
        bump = buy_order.bump,
    )]
    pub buy_order: Box<Account<'info, SettlementOrder>>,
    #[account(
        mut,
        seeds = [ORDER_SEED, sell_order.creator.as_ref(), &sell_order.nonce.to_le_bytes()],
        bump = sell_order.bump,
    )]
    pub sell_order: Box<Account<'info, SettlementOrder>>,

    #[account(mut)]
    pub security_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(mut)]
    pub payment_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(mut)]
    pub buyer_payment_ata: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut)]
    pub seller_payment_ata: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut)]
    pub buyer_security_ata: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut)]
    pub seller_security_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    pub agent: Signer<'info>,
    pub token_program: Program<'info, Token2022>,
}

// ============================================================================
// State
// ============================================================================

#[account]
#[derive(InitSpace)]
pub struct PlatformConfig {
    pub admin: Pubkey,
    pub settlement_agent: Pubkey,
    pub kyc_oracle: Pubkey,
    pub paused: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct IssuerProfile {
    pub authority: Pubkey,
    #[max_len(MAX_LEGAL_NAME)]
    pub legal_name: String,
    #[max_len(MAX_JURISDICTION)]
    pub jurisdiction: String,
    pub kyc_hash: [u8; 32],
    pub kyc_expiry: i64,
    pub is_active: bool,
    pub series_count: u32,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct SecuritySeries {
    pub issuer: Pubkey,
    pub mint: Pubkey,
    #[max_len(MAX_NAME)]
    pub name: String,
    #[max_len(MAX_SYMBOL)]
    pub symbol: String,
    pub security_type: SecurityType,
    pub doc_hash: [u8; 32],
    #[max_len(MAX_URI)]
    pub doc_uri: String,
    #[max_len(MAX_ISIN)]
    pub isin: String,
    pub max_supply: u64,
    pub current_supply: u64,
    pub transfer_restriction: TransferRestriction,
    pub paused: bool,
    pub governance_realm: Pubkey,
    pub created_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct HolderRecord {
    pub wallet: Pubkey,
    pub mint: Pubkey,
    pub kyc_hash: [u8; 32],
    pub kyc_expiry: i64,
    pub is_accredited: bool,
    pub is_frozen: bool,
    pub is_revoked: bool,
    pub jurisdiction: [u8; 2],
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct SettlementOrder {
    pub creator: Pubkey,
    pub side: OrderSide,
    pub security_mint: Pubkey,
    pub payment_mint: Pubkey,
    pub token_amount: u64,
    pub payment_amount: u64,
    pub expires_at: i64,
    pub nonce: u64,
    pub status: OrderStatus,
    pub created_at: i64,
    pub bump: u8,
}

// ============================================================================
// Enums + params
// ============================================================================

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum SecurityType { Equity, Debt, FundInterest, LlcMembership }

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum TransferRestriction { None, RegD, RegS, RegCf, RegAPlus, Ricardian }

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum OrderSide { Buy, Sell }

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum OrderStatus { Open, Cancelled, Settled, Expired }

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CreateSeriesParams {
    pub name: String,
    pub symbol: String,
    pub security_type: SecurityType,
    pub doc_hash: [u8; 32],
    pub doc_uri: String,
    pub isin: String,
    pub max_supply: u64,
    pub transfer_restriction: TransferRestriction,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CreateOrderParams {
    pub side: OrderSide,
    pub token_amount: u64,
    pub payment_amount: u64,
    pub expires_at: i64,
    pub nonce: u64,
}

// ============================================================================
// Events
// ============================================================================

#[event]
pub struct PlatformInitialized {
    pub admin: Pubkey,
    pub settlement_agent: Pubkey,
    pub kyc_oracle: Pubkey,
}

#[event]
pub struct IssuerRegistered { pub authority: Pubkey }

#[event]
pub struct SeriesCreated {
    pub mint: Pubkey,
    pub issuer: Pubkey,
    pub symbol: String,
    pub max_supply: u64,
}

#[event]
pub struct SecurityMinted {
    pub mint: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub new_supply: u64,
}

#[event]
pub struct HolderRegistered {
    pub mint: Pubkey,
    pub wallet: Pubkey,
    pub is_accredited: bool,
}

#[event]
pub struct HolderRevoked { pub mint: Pubkey, pub wallet: Pubkey }

#[event]
pub struct SeriesPauseChanged { pub mint: Pubkey, pub paused: bool }

#[event]
pub struct OrderCreated {
    pub order: Pubkey,
    pub creator: Pubkey,
    pub side: OrderSide,
    pub security_mint: Pubkey,
    pub token_amount: u64,
    pub payment_amount: u64,
}

#[event]
pub struct SettlementExecuted {
    pub buy_order: Pubkey,
    pub sell_order: Pubkey,
    pub security_mint: Pubkey,
    pub token_amount: u64,
    pub payment_amount: u64,
}

// ============================================================================
// Errors
// ============================================================================

#[error_code]
pub enum DinoError {
    #[msg("Field exceeds maximum length")]
    FieldTooLong,
    #[msg("KYC has expired")]
    KycExpired,
    #[msg("Issuer is not active")]
    IssuerInactive,
    #[msg("Invalid supply")]
    InvalidSupply,
    #[msg("Supply would exceed max_supply")]
    SupplyExceeded,
    #[msg("Series is paused")]
    SeriesPaused,
    #[msg("Platform is paused")]
    PlatformPaused,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Caller is not the configured KYC oracle")]
    UnauthorizedOracle,
    #[msg("Caller is not the configured settlement agent")]
    UnauthorizedAgent,
    #[msg("Caller is not the platform admin")]
    UnauthorizedAdmin,
    #[msg("Caller is not the issuer authority")]
    UnauthorizedIssuer,
    #[msg("Caller is not authorized for this order action")]
    UnauthorizedOrderAction,
    #[msg("Order is not in Open status")]
    OrderNotOpen,
    #[msg("Order has expired")]
    OrderExpired,
    #[msg("Order side mismatch")]
    SideMismatch,
    #[msg("Mint mismatch between accounts")]
    MintMismatch,
    #[msg("Token or payment amount mismatch")]
    AmountMismatch,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Expiration timestamp is in the past")]
    ExpirationInPast,
}
