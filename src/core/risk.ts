import { envBool, envNum } from "./env.js";
import type { PaymentIntent, RiskCheckResult, RiskConfig } from "./types.js";

/** Documented Binance x402 default daily cap (USD). Not a guarantee — confirm in App. */
export const X402_DOCUMENTED_DAILY_CAP_USD = 20;

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

/**
 * Evaluate payment against local risk gates AND documented x402 daily cap.
 * The documented x402 cap is labeled as a public default, not a contractual SLA.
 */
export function checkPaymentRisk(
  intent: PaymentIntent,
  dailySpendUsedUsd: number,
  cfg: RiskConfig = loadRiskConfig()
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
      `projected daily spend $${projected.toFixed(2)} exceeds local daily spend cap $${cfg.dailySpendCapUsd}`
    );
  }

  // Documented Binance x402 default — labeled, not invented as a guarantee
  if (projected > cfg.x402DocumentedDailyCapUsd) {
    reasons.push(
      `projected daily spend $${projected.toFixed(2)} exceeds documented x402 daily default cap $${cfg.x402DocumentedDailyCapUsd} (documented default, not a guarantee — confirm in Binance App)`
    );
  }

  if (!intent.fromAgentId || !intent.toAgentId) {
    reasons.push("from/to agent ids required");
  }

  if (intent.fromAgentId === intent.toAgentId) {
    reasons.push("buyer and seller must be different agents");
  }

  if (intent.asset !== "USDT" && intent.asset !== "USDC") {
    reasons.push("asset must be USDT or USDC");
  }

  return { ok: reasons.length === 0, reasons };
}
