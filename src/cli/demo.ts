import { AgentOsFacade } from "../adapters/agentOsFacade.js";
import { X402_DOCUMENTED_DAILY_CAP_USD } from "../core/risk.js";
import { describeAgents } from "../core/agents.js";
import { runDemoScenario, summarizePayment } from "../core/workflow.js";

async function main(): Promise<void> {
  console.log("===========================================================");
  console.log(" PayPulse DEMO — Track A / Binance Agent OS Mini Hackathon");
  console.log(" Payment Workflows: A2A via x402 + MCP settlement context");
  console.log("===========================================================");
  console.log("Agents:", describeAgents());
  console.log("");

  const facade = new AgentOsFacade({ mode: "paper" });
  const status = facade.dualStatus();
  console.log("-- Dual-rail Agent OS --");
  console.log(`  x402: ${status.x402.endpoint}`);
  console.log(
    `        documented daily cap=$${status.x402.documentedDailyCapUsd} (default, not a guarantee)`
  );
  console.log(`        ${status.x402.label}`);
  console.log(`  MCP:  ${status.mcp.endpoint}`);
  console.log(`        oauth_client_id=${status.mcp.oauthClientId}`);
  console.log(`        ${status.mcp.label}`);
  console.log("");

  const result = await runDemoScenario();

  console.log("-- A2A payment ledger --");
  for (const p of result.ledger) {
    console.log(`  ${summarizePayment(p)}`);
  }
  console.log("");

  console.log("-- Settlement context (MCP paper) --");
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

  const ok =
    result.successCount >= 2 &&
    result.rejectedCount >= 1 &&
    result.ledger.some((p) => p.status === "CONFIRMED_PAPER") &&
    result.ledger.some((p) => p.status === "REJECTED" || p.status === "FAILED");

  if (!ok) {
    console.error("DEMO FAIL — expected >=2 successful paper A2A + >=1 rejected (over cap)");
    console.error(
      `  successCount=${result.successCount} rejectedCount=${result.rejectedCount}`
    );
    process.exit(1);
  }

  console.log("DEMO PASS");
  console.log(
    `  ${result.successCount} successful paper A2A payment(s), ${result.rejectedCount} rejected (over cap / risk)`
  );
  console.log("  Workflow: intent → quote → confirm → settle (PAPER/SIM)");
  console.log("  No secrets. No withdrawals. Mocks labeled when used.");
}

main().catch((e) => {
  console.error("DEMO FAIL", e);
  process.exit(1);
});
