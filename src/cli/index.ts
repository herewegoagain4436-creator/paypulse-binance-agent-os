/**
 * PayPulse CLI — create a single A2A payment or dump JSON snapshot.
 *
 * Usage:
 *   npx tsx src/cli/index.ts once
 *   npx tsx src/cli/index.ts pay --from agent-buyer-alpha --to agent-seller-brief --amount 5 --asset USDT --memo demo
 *
 * Mode follows PAYPULSE_MODE (default live).
 */
import { PayPulseEngine } from "../core/workflow.js";
import { AgentOsFacade } from "../adapters/agentOsFacade.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const cmd = args[0] ?? "once";
  const engine = new PayPulseEngine({ facade: new AgentOsFacade() });

  if (cmd === "once") {
    const r = await engine.payForService("agent-buyer-alpha", "svc-market-brief", {
      confirm: true,
    });
    console.log(
      JSON.stringify(
        { payment: r.payment, settlement: r.settlement, adapterMeta: r.adapterMeta },
        null,
        2
      )
    );
    return;
  }

  if (cmd === "pay") {
    const get = (flag: string, fallback = "") => {
      const i = args.indexOf(flag);
      return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
    };
    const r = await engine.runPayment({
      fromAgentId: get("--from", "agent-buyer-alpha"),
      toAgentId: get("--to", "agent-seller-brief"),
      amount: Number(get("--amount", "5")),
      asset: get("--asset", "USDT") as "USDT" | "USDC",
      memo: get("--memo", "cli-pay"),
      confirm: get("--confirm", "true") !== "false",
    });
    console.log(JSON.stringify(r, null, 2));
    return;
  }

  console.log("Usage: once | pay --from --to --amount --asset --memo");
  process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
