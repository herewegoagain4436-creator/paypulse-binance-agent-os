import { AgentOsFacade } from "../adapters/agentOsFacade.js";
import { X402_DOCUMENTED_DAILY_CAP_USD } from "../core/risk.js";
import { describeAgents } from "../core/agents.js";
import { envStr } from "../core/env.js";
import { explainRunSummary } from "../core/reasoning.js";
import { runDemoScenario, summarizePayment } from "../core/workflow.js";

async function main(): Promise<void> {
  const mode = envStr("PAYPULSE_MODE", "live").toLowerCase();
  console.log("===========================================================");
  console.log(" PayPulse LIVE smoke — Track A / Binance Agent OS");
  console.log(" A2A payments: intent → quote → confirm → settle (x402)");
  console.log(" MCP: balances / settlement context (host-flexible OAuth)");
  console.log("===========================================================");
  console.log("Agents:", describeAgents());
  console.log("PAYPULSE_MODE:", mode, "(default live)");
  console.log("");

  // Drive adapters from env (default live). Do not force paper.
  const facade = new AgentOsFacade();
  const status = facade.dualStatus();
  console.log("-- Dual-rail Agent OS --");
  console.log(`  x402: ${status.x402.endpoint}`);
  console.log(`        mode=${status.x402.mode}`);
  console.log(
    `        documented daily cap=$${status.x402.documentedDailyCapUsd} (default, not a guarantee)`
  );
  console.log(`        ${status.x402.label}`);
  console.log(`  MCP:  ${status.mcp.endpoint}`);
  console.log(
    `        oauth_client_id=${status.mcp.oauthClientId} | mode=${status.mcp.mode}`
  );
  console.log(`        ${status.mcp.label}`);
  console.log("");

  const result = await runDemoScenario();

  console.log("-- A2A payment ledger --");
  for (const p of result.ledger) {
    console.log(`  ${summarizePayment(p)}`);
    if (p.rationale?.narrative) {
      console.log(`         rationale: ${p.rationale.narrative}`);
    }
  }
  console.log("");

  console.log("-- Payment rationales (why pay / why reject) --");
  for (const r of result.rationales) {
    console.log(`  [${r.decision}] ${r.headline}`);
    for (const f of r.factors.slice(0, 4)) console.log(`         - ${f}`);
  }
  console.log("");

  console.log("-- Settlement context (MCP) --");
  console.log(
    `  buyer USDT=${result.settlement.buyerBalanceUsdt} USDC=${result.settlement.buyerBalanceUsdc}`
  );
  console.log(
    `  seller USDT=${result.settlement.sellerBalanceUsdt} USDC=${result.settlement.sellerBalanceUsdc}`
  );
  console.log(
    `  daily spend used=$${result.settlement.dailySpendUsedUsd} left=$${result.settlement.dailySpendLeftUsd}`
  );
  console.log(`  source=${result.settlement.source} usedMock=${result.settlement.usedMock}`);
  console.log("");

  console.log("-- Adapter meta --");
  console.log(`  mode=${result.mode}`);
  console.log(`  x402: ${result.adapterMeta.x402.label}`);
  console.log(`  MCP:  ${result.adapterMeta.mcp.label}`);
  console.log(
    `  x402 documented default cap: $${X402_DOCUMENTED_DAILY_CAP_USD}/day (not a guarantee)`
  );
  console.log("");
  console.log(
    "-- Summary --\n ",
    explainRunSummary({
      mode: result.mode,
      payments: result.ledger,
      attemptCount: result.attemptCount,
      rejectedCount: result.rejectedCount,
      successCount: result.successCount,
    })
  );
  console.log("");

  const liveDefault = facade.mode === "live" || mode === "live";
  const attemptsOk = result.attemptCount >= 2;
  const riskRejectOk = result.ledger.some(
    (p) =>
      p.status === "REJECTED" &&
      (p.rejectReason?.includes("exceeds") ||
        p.rejectReason?.includes("cap") ||
        p.rejectReason?.includes("KILL_SWITCH") ||
        p.mockLabel?.includes("REJECTED by risk"))
  );
  const honestLive = result.ledger.every((p) => p.status !== "CONFIRMED_PAPER");
  const honestStatuses = result.ledger.every((p) =>
    [
      "PENDING",
      "QUOTED",
      "AWAITING_CONFIRM",
      "REJECTED",
      "FAILED",
      "SUBMITTED_MOCK",
      "CONFIRMED_PAPER",
    ].includes(p.status)
  );

  // Live must never claim paper fills
  if (facade.mode === "live" && !honestLive) {
    console.error("DEMO FAIL — live mode must not report CONFIRMED_PAPER");
    process.exit(1);
  }
  if (!attemptsOk) {
    console.error(
      `DEMO FAIL — expected >=2 payment attempts, got attemptCount=${result.attemptCount}`
    );
    process.exit(1);
  }
  if (!riskRejectOk) {
    console.error("DEMO FAIL — expected >=1 risk reject (over cap / kill)");
    process.exit(1);
  }
  if (!honestStatuses) {
    console.error("DEMO FAIL — unexpected payment status in ledger");
    process.exit(1);
  }
  if (!liveDefault && mode !== "paper" && mode !== "mock") {
    console.error("DEMO FAIL — expected live mode (or explicit paper/mock opt-in)");
    process.exit(1);
  }

  console.log("DEMO PASS");
  console.log(
    `  ${result.attemptCount} payment attempt(s), ${result.rejectedCount} rejected, paper/mock fills=${result.successCount}`
  );
  console.log("  Workflow: intent → quote → confirm → settle via x402");
  console.log(
    "  Note: LIVE PENDING / auth REJECTED are expected without interactive wallet/MCP OAuth."
  );
  console.log("  No secrets. No withdrawals. No fake live settles.");
}

main().catch((e) => {
  console.error("DEMO FAIL", e);
  process.exit(1);
});
