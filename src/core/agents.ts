import { envNum, envStr } from "./env.js";
import type { AgentProfile, ServiceOffer } from "./types.js";
import agentsFixture from "../data/fixtures/agents.json";
import servicesFixture from "../data/fixtures/services.json";

export function loadAgents(): AgentProfile[] {
  const buyerCash = envNum("PAPER_BUYER_USDT", 100);
  const sellerCash = envNum("PAPER_SELLER_USDT", 10);
  return (agentsFixture as AgentProfile[]).map((a) => {
    const payTo = a.payTo
      ? {
          network: a.payTo.network,
          address: envStr(
            `PAYPULSE_PAYTO_${a.id.replace(/[^A-Z0-9]+/gi, "_").toUpperCase()}`,
            a.payTo.address
          ),
        }
      : a.payTo;
    if (a.role === "buyer") {
      return { ...a, paperBalanceUsdt: buyerCash, paperBalanceUsdc: a.paperBalanceUsdc, payTo };
    }
    if (a.role === "seller") {
      return { ...a, paperBalanceUsdt: sellerCash, paperBalanceUsdc: a.paperBalanceUsdc, payTo };
    }
    return { ...a, payTo };
  });
}

export function loadServices(): ServiceOffer[] {
  return servicesFixture as ServiceOffer[];
}

export function loadListedServices(): ServiceOffer[] {
  return loadServices().filter((s) => !s.demo);
}

export function getAgent(id: string, agents = loadAgents()): AgentProfile | undefined {
  return agents.find((a) => a.id === id);
}

export function describeAgents(agents = loadAgents()): string {
  return agents.map((a) => `${a.id}(${a.role})`).join(", ");
}
