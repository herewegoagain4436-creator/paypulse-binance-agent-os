/** Shared domain types for PayPulse — A2A payment workflows */

export type PaymentAsset = "USDT" | "USDC";

export type PaymentStatus =
  | "PENDING"
  | "QUOTED"
  | "AWAITING_CONFIRM"
  | "CONFIRMED_PAPER"
  | "SUBMITTED_MOCK"
  | "FAILED"
  | "REJECTED";

export type WorkflowStage = "intent" | "quote" | "confirm" | "settle";

export interface AgentProfile {
  id: string;
  name: string;
  role: "buyer" | "seller" | "both";
  description: string;
  paperBalanceUsdt: number;
  paperBalanceUsdc: number;
}

export interface ServiceOffer {
  id: string;
  sellerAgentId: string;
  title: string;
  description: string;
  priceUsd: number;
  asset: PaymentAsset;
  memoHint: string;
}

export interface PaymentIntent {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  amount: number;
  asset: PaymentAsset;
  memo: string;
  serviceId?: string;
  createdAt: string;
}

export interface PaymentQuote {
  intentId: string;
  quoteId: string;
  amount: number;
  asset: PaymentAsset;
  feeUsd: number;
  totalUsd: number;
  expiresAt: string;
  rail: "x402";
  label: string;
}

export interface PaymentRecord {
  id: string;
  intentId: string;
  quoteId?: string;
  fromAgentId: string;
  toAgentId: string;
  amount: number;
  asset: PaymentAsset;
  memo: string;
  status: PaymentStatus;
  stage: WorkflowStage;
  createdAt: string;
  updatedAt: string;
  rejectReason?: string;
  mockLabel?: string;
  requiresConfirm: boolean;
  settledAt?: string;
  usedMock: boolean;
}

export interface RiskConfig {
  maxPaymentUsd: number;
  dailySpendCapUsd: number;
  /** Documented Binance x402 default daily cap — labeled, not a guarantee */
  x402DocumentedDailyCapUsd: number;
  requireConfirm: boolean;
  killSwitch: boolean;
}

export interface RiskCheckResult {
  ok: boolean;
  reasons: string[];
}

export interface DualAdapterMeta {
  mode: string;
  x402: {
    endpoint: string;
    usedMock: boolean;
    label: string;
    documentedDailyCapUsd: number;
  };
  mcp: {
    endpoint: string;
    oauthClientId: string;
    usedMock: boolean;
    label: string;
  };
}

export interface SettlementContext {
  buyerBalanceUsdt: number;
  sellerBalanceUsdt: number;
  buyerBalanceUsdc: number;
  sellerBalanceUsdc: number;
  dailySpendUsedUsd: number;
  dailySpendLeftUsd: number;
  source: string;
  usedMock: boolean;
}

export interface WorkflowResult {
  payment: PaymentRecord;
  quote?: PaymentQuote;
  settlement?: SettlementContext;
  adapterMeta: DualAdapterMeta;
}

export interface DemoRunResult {
  mode: string;
  agents: AgentProfile[];
  payments: PaymentRecord[];
  pending: PaymentRecord[];
  ledger: PaymentRecord[];
  adapterMeta: DualAdapterMeta;
  settlement: SettlementContext;
  successCount: number;
  rejectedCount: number;
}
