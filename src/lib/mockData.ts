export interface SecuritySeries {
  id: string;
  name: string;
  symbol: string;
  type: "Equity" | "Debt" | "Fund" | "LLC";
  issuer: string;
  totalSupply: number;
  circulatingSupply: number;
  holders: number;
  price: number;
  change24h: number;
  jurisdiction: string;
  regulation: string;
  status: "active" | "paused" | "pending";
  createdAt: string;
  documentHash: string;
  mintAddress: string;
}

export interface Holding {
  security: SecuritySeries;
  balance: number;
  value: number;
  costBasis: number;
  pnl: number;
  pnlPercent: number;
}

export interface Proposal {
  id: string;
  title: string;
  description: string;
  series: string;
  status: "active" | "passed" | "rejected" | "pending";
  votesFor: number;
  votesAgainst: number;
  quorum: number;
  endDate: string;
  proposer: string;
}

export interface SettlementOrder {
  id: string;
  type: "buy" | "sell";
  security: string;
  amount: number;
  price: number;
  total: number;
  status: "pending" | "matched" | "settling" | "completed" | "failed";
  counterparty: string;
  createdAt: string;
  settledAt?: string;
}

export interface ActivityItem {
  id: string;
  type: "transfer" | "settlement" | "vote" | "mint" | "governance";
  title: string;
  description: string;
  timestamp: string;
  amount?: string;
  txHash: string;
}

export const securities: SecuritySeries[] = [
  {
    id: "1",
    name: "DinoVentures Series A",
    symbol: "DINO-VA",
    type: "Equity",
    issuer: "DinoVentures LLC",
    totalSupply: 10000000,
    circulatingSupply: 3500000,
    holders: 847,
    price: 12.45,
    change24h: 3.2,
    jurisdiction: "US",
    regulation: "Reg D",
    status: "active",
    createdAt: "2026-01-15",
    documentHash: "a3f8c...e7d2",
    mintAddress: "DV1a...9xKp",
  },
  {
    id: "2",
    name: "CryptoRealty Fund I",
    symbol: "CRF-I",
    type: "Fund",
    issuer: "CryptoRealty Capital",
    totalSupply: 5000000,
    circulatingSupply: 2100000,
    holders: 312,
    price: 25.80,
    change24h: -1.4,
    jurisdiction: "US",
    regulation: "Reg D",
    status: "active",
    createdAt: "2026-02-01",
    documentHash: "b7e1d...f4a9",
    mintAddress: "CRF1...mN4q",
  },
  {
    id: "3",
    name: "GreenBond 2030",
    symbol: "GB-30",
    type: "Debt",
    issuer: "GreenEnergy Corp",
    totalSupply: 20000000,
    circulatingSupply: 18500000,
    holders: 1243,
    price: 98.50,
    change24h: 0.1,
    jurisdiction: "EU",
    regulation: "Reg S",
    status: "active",
    createdAt: "2026-01-20",
    documentHash: "c4d9e...b3f1",
    mintAddress: "GB30...xY7z",
  },
  {
    id: "4",
    name: "MetaDAO Membership",
    symbol: "META-M",
    type: "LLC",
    issuer: "MetaDAO Ricardian LLC",
    totalSupply: 1000,
    circulatingSupply: 780,
    holders: 780,
    price: 500.00,
    change24h: 5.7,
    jurisdiction: "WY",
    regulation: "Ricardian",
    status: "active",
    createdAt: "2026-03-10",
    documentHash: "d8f2a...c6e3",
    mintAddress: "META...pQ2r",
  },
  {
    id: "5",
    name: "SolTech Equity Token",
    symbol: "SOLT-E",
    type: "Equity",
    issuer: "SolTech Inc",
    totalSupply: 8000000,
    circulatingSupply: 1200000,
    holders: 156,
    price: 8.20,
    change24h: -0.8,
    jurisdiction: "US",
    regulation: "Reg A+",
    status: "active",
    createdAt: "2026-03-25",
    documentHash: "e1a5b...d9c4",
    mintAddress: "SOLT...kL8m",
  },
  {
    id: "6",
    name: "Harbor Income Note",
    symbol: "HIN-1",
    type: "Debt",
    issuer: "Harbor Finance",
    totalSupply: 15000000,
    circulatingSupply: 9800000,
    holders: 567,
    price: 101.25,
    change24h: 0.05,
    jurisdiction: "US",
    regulation: "Reg D",
    status: "active",
    createdAt: "2026-02-15",
    documentHash: "f3c7d...a2b8",
    mintAddress: "HIN1...nR5s",
  },
];

export const holdings: Holding[] = [
  {
    security: securities[0],
    balance: 15000,
    value: 186750,
    costBasis: 150000,
    pnl: 36750,
    pnlPercent: 24.5,
  },
  {
    security: securities[1],
    balance: 5000,
    value: 129000,
    costBasis: 135000,
    pnl: -6000,
    pnlPercent: -4.44,
  },
  {
    security: securities[2],
    balance: 10000,
    value: 985000,
    costBasis: 1000000,
    pnl: -15000,
    pnlPercent: -1.5,
  },
  {
    security: securities[3],
    balance: 2,
    value: 1000,
    costBasis: 800,
    pnl: 200,
    pnlPercent: 25.0,
  },
];

export const proposals: Proposal[] = [
  {
    id: "1",
    title: "Increase Quarterly Dividend to 3.5%",
    description: "Proposal to increase the quarterly dividend distribution from 2.8% to 3.5% for DINO-VA holders based on Q1 performance.",
    series: "DINO-VA",
    status: "active",
    votesFor: 2100000,
    votesAgainst: 890000,
    quorum: 3000000,
    endDate: "2026-04-18",
    proposer: "7xKp...mN4q",
  },
  {
    id: "2",
    title: "Approve Series B Token Issuance",
    description: "Authorization to issue 5,000,000 additional Series B equity tokens at $15.00 per token for expansion funding.",
    series: "DINO-VA",
    status: "active",
    votesFor: 1800000,
    votesAgainst: 1200000,
    quorum: 3000000,
    endDate: "2026-04-20",
    proposer: "9aLm...kT7x",
  },
  {
    id: "3",
    title: "Update Transfer Restriction to Reg A+",
    description: "Migrate transfer restriction from Reg D to Reg A+ to enable broader investor participation.",
    series: "SOLT-E",
    status: "passed",
    votesFor: 5200000,
    votesAgainst: 800000,
    quorum: 4000000,
    endDate: "2026-04-05",
    proposer: "3bNp...xR2m",
  },
  {
    id: "4",
    title: "Redeem 10% of Fund Assets",
    description: "Proposal for partial redemption of 10% of CryptoRealty Fund I assets to distribute returns to LP token holders.",
    series: "CRF-I",
    status: "pending",
    votesFor: 0,
    votesAgainst: 0,
    quorum: 2500000,
    endDate: "2026-04-25",
    proposer: "5dQr...wM9n",
  },
];

export const settlementOrders: SettlementOrder[] = [
  { id: "1847", type: "buy", security: "DINO-VA", amount: 5000, price: 12.45, total: 62250, status: "completed", counterparty: "9aLm...kT7x", createdAt: "2026-04-11T08:30:00Z", settledAt: "2026-04-11T08:30:01Z" },
  { id: "1848", type: "sell", security: "CRF-I", amount: 1000, price: 25.80, total: 25800, status: "settling", counterparty: "3bNp...xR2m", createdAt: "2026-04-11T09:15:00Z" },
  { id: "1849", type: "buy", security: "GB-30", amount: 2000, price: 98.50, total: 197000, status: "matched", counterparty: "5dQr...wM9n", createdAt: "2026-04-11T10:00:00Z" },
  { id: "1850", type: "buy", security: "SOLT-E", amount: 10000, price: 8.20, total: 82000, status: "pending", counterparty: "—", createdAt: "2026-04-11T10:45:00Z" },
  { id: "1851", type: "sell", security: "DINO-VA", amount: 2500, price: 12.50, total: 31250, status: "completed", counterparty: "7kPq...nL4m", createdAt: "2026-04-10T14:20:00Z", settledAt: "2026-04-10T14:20:01Z" },
  { id: "1852", type: "buy", security: "META-M", amount: 1, price: 500.00, total: 500, status: "completed", counterparty: "2cRx...yJ8p", createdAt: "2026-04-10T11:05:00Z", settledAt: "2026-04-10T11:05:01Z" },
];

export const recentActivity: ActivityItem[] = [
  { id: "1", type: "settlement", title: "DvP Settlement Completed", description: "Bought 5,000 DINO-VA at $12.45", timestamp: "2m ago", amount: "$62,250", txHash: "5xKp...mN4q" },
  { id: "2", type: "vote", title: "Vote Cast", description: "Voted FOR on 'Increase Quarterly Dividend'", timestamp: "1h ago", txHash: "7aLm...kT7x" },
  { id: "3", type: "transfer", title: "Tokens Received", description: "Received 500 GB-30 from 3bNp...xR2m", timestamp: "3h ago", amount: "$49,250", txHash: "9bNp...xR2m" },
  { id: "4", type: "governance", title: "Proposal Created", description: "Created 'Approve Series B Token Issuance'", timestamp: "6h ago", txHash: "2dQr...wM9n" },
  { id: "5", type: "mint", title: "Tokens Minted", description: "Minted 1 META-M membership token", timestamp: "1d ago", amount: "$500", txHash: "4fRx...yJ8p" },
];

export const portfolioChartData = [
  { date: "Jan", value: 245000 },
  { date: "Feb", value: 268000 },
  { date: "Mar", value: 252000 },
  { date: "Apr", value: 289000 },
  { date: "May", value: 310000 },
  { date: "Jun", value: 298000 },
  { date: "Jul", value: 315000 },
  { date: "Aug", value: 342000 },
  { date: "Sep", value: 338000 },
  { date: "Oct", value: 365000 },
  { date: "Nov", value: 382000 },
  { date: "Dec", value: 401750 },
];

export const allocationData = [
  { name: "Equity", value: 187750, fill: "hsl(270, 70%, 55%)" },
  { name: "Fund", value: 129000, fill: "hsl(240, 80%, 60%)" },
  { name: "Debt", value: 985000, fill: "hsl(270, 60%, 72%)" },
  { name: "LLC", value: 1000, fill: "hsl(300, 50%, 50%)" },
];
