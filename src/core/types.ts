/** Shared domain types for PayPulse — A2A x402 payment workflows */

export type PaymentAsset = "USDT" | "USDC" | "U" | "USD1";

export type PaymentStatus =
  | "PENDING"
  | "QUOTED"
  | "AWAITING_CONFIRM"
  | "SETTLED"
  | "DELIVERED"
  | "CONFIRMED_PAPER"
  | "SUBMITTED_MOCK"
  | "FAILED"
  | "REJECTED";

export type WorkflowStage = "intent" | "quote" | "confirm" | "sign" | "settle" | "deliver";

export type FacilitatorKind = "paper-hmac" | "baw" | "b402" | "none";

export interface AgentPayTo {
  network: string;
  address: string;
}

export interface AgentProfile {
  id: string;
  name: string;
  role: "buyer" | "seller" | "both";
  description: string;
  paperBalanceUsdt: number;
  paperBalanceUsdc: number;
  payTo?: AgentPayTo;
}

export interface ServiceOffer {
  id: string;
  sellerAgentId: string;
  title: string;
  description: string;
  priceUsd: number;
  asset: PaymentAsset;
  memoHint: string;
  mimeType: string;
  path: string;
  /** Hidden from the live dashboard (fixtures used only in tests). */
  demo?: boolean;
}

export interface PaymentIntent {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  amount: number;
  asset: PaymentAsset;
  memo: string;
  serviceId?: string;
  resourceUrl: string;
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
  resourceUrl: string;
  payTo: string;
  network: string;
  tokenAddress: string;
  atomicAmount: string;
  paymentRequired: unknown;
}

export interface PreviewOption {
  index: number;
  status: "READY_TO_SIGN" | "ACTION_REQUIRED" | "NOT_SIGNABLE";
  reasons: string[];
  scheme: string;
  assetTransferMethod: string;
  tokenSymbol: string;
  amount: string;
  amountUsd: string;
  payTo: string;
  currentBalance?: string;
  needApproveFirst?: boolean;
}

export interface PaymentRationale {
  headline: string;
  narrative: string;
  factors: string[];
  decision: "pay" | "reject" | "pending" | "awaiting_confirm";
}

export interface ResourceDelivery {
  mimeType: string;
  body: string;
  deliveredAt: string;
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
  rationale?: PaymentRationale;
  resourceUrl?: string;
  payTo?: string;
  network?: string;
  tokenAddress?: string;
  atomicAmount?: string;
  paymentRequired?: unknown;
  previewOptions?: PreviewOption[];
  selectedIndex?: number;
  paymentHeaderName?: string;
  paymentHeaderValue?: string;
  signatureExpiresAt?: number;
  txHash?: string;
  facilitator?: FacilitatorKind;
  reservedUsd?: number;
  delivery?: ResourceDelivery;
}

export interface RiskConfig {
  maxPaymentUsd: number;
  dailySpendCapUsd: number;
  x402DocumentedDailyCapUsd: number;
  requireConfirm: boolean;
  killSwitch: boolean;
}

export interface RiskCheckResult {
  ok: boolean;
  reasons: string[];
}

export interface QuotaSnapshot {
  source: "baw-wallet-settings" | "documented-default";
  dailyLimit: number;
  used: number;
  left: number;
  asOf: string;
  label: string;
}

export interface WalletStatus {
  available: boolean;
  signedIn: boolean;
  label: string;
  command: string;
}

export interface DualAdapterMeta {
  mode: string;
  x402: {
    mode: string;
    endpoint: string;
    productUrl: string;
    usedMock: boolean;
    label: string;
    documentedDailyCapUsd: number;
    wallet: WalletStatus;
    quota: QuotaSnapshot;
  };
  mcp: {
    mode: string;
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
  dailySpendReservedUsd: number;
  dailySpendLeftUsd: number;
  source: string;
  usedMock: boolean;
  quota: QuotaSnapshot;
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
  services: ServiceOffer[];
  payments: PaymentRecord[];
  pending: PaymentRecord[];
  ledger: PaymentRecord[];
  adapterMeta: DualAdapterMeta;
  settlement: SettlementContext;
  successCount: number;
  rejectedCount: number;
  attemptCount: number;
  deliveredCount: number;
  rationales: PaymentRationale[];
}
