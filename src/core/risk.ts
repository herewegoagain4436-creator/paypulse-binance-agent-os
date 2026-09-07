import { envBool, envNum } from "./env.js";
import type {
  PaymentIntent,
  QuotaSnapshot,
  RiskCheckResult,
  RiskConfig,
} from "./types.js";

/** Documented Binance x402 default daily cap (USD). Not a guarantee — confirm in App. */
export const X402_DOCUMENTED_DAILY_CAP_USD = 20;

const ASSETS = new Set(["USDT", "USDC", "U", "USD1"]);

export function loadRiskConfig(): RiskConfig {
  return {
    maxPaymentUsd: envNum("MAX_PAYMENT_USD", 15),
    dailySpendCapUsd: envNum("DAILY_SPEND_CAP_USD", 20),
    x402DocumentedDailyCapUsd: envNum(
      "X402_DOCUMENTED_DAILY_CAP_USD",
      X402_DOCUMENTED_DAILY_CAP_USD
    ),
    requireConfirm: envBool("REQUIRE_CONFIRM", true),
    killSwitch: envBool("KILL_SWITCH", false),
  };
}

export function checkPaymentRisk(
  intent: PaymentIntent,
  dailySpendUsedUsd: number,
  cfg: RiskConfig = loadRiskConfig(),
  quota?: QuotaSnapshot
): RiskCheckResult {
  const reasons: string[] = [];

  if (cfg.killSwitch) {
    reasons.push("KILL_SWITCH enabled — all A2A payments blocked");
  }

  if (!(intent.amount > 0) || !Number.isFinite(intent.amount)) {
    reasons.push("amount must be a positive finite number");
  }

  if (intent.amount > cfg.maxPaymentUsd) {
    reasons.push(
      `amount $${intent.amount} exceeds max payment size $${cfg.maxPaymentUsd}`
    );
  }

  const projected = dailySpendUsedUsd + intent.amount;
  if (projected > cfg.dailySpendCapUsd) {
    reasons.push(
      `projected daily spend $${projected.toFixed(2)} exceeds local daily spend cap $${cfg.dailySpendCapUsd} (includes reserved PENDING)`
    );
  }

  const documentedCap = quota?.dailyLimit ?? cfg.x402DocumentedDailyCapUsd;
  if (projected > documentedCap) {
    reasons.push(
      `projected daily spend $${projected.toFixed(2)} exceeds documented x402 daily default cap $${documentedCap} (documented default, not a guarantee — confirm in Binance App)`
    );
  }

  if (quota && quota.source === "baw-wallet-settings" && intent.amount > quota.left) {
    reasons.push(
      `amount $${intent.amount} exceeds live x402QuotaLeft $${quota.left} (baw wallet settings)`
    );
  }

  if (!intent.fromAgentId || !intent.toAgentId) {
    reasons.push("from/to agent ids required");
  }

  if (intent.fromAgentId === intent.toAgentId) {
    reasons.push("buyer and seller must be different agents");
  }

  if (!ASSETS.has(intent.asset)) {
    reasons.push("asset must be USDT, USDC, U, or USD1");
  }

  if (!intent.resourceUrl) {
    reasons.push("resourceUrl required for x402 402 flow");
  }

  return { ok: reasons.length === 0, reasons };
}
