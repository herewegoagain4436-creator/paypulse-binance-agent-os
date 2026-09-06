import { envNum } from "./env.js";
import type { AgentProfile, ServiceOffer } from "./types.js";
import agentsFixture from "../data/fixtures/agents.json";
import servicesFixture from "../data/fixtures/services.json";

export function loadAgents(): AgentProfile[] {
  const buyerCash = envNum("PAPER_BUYER_USDT", 100);
  const sellerCash = envNum("PAPER_SELLER_USDT", 10);
  return (agentsFixture as AgentProfile[]).map((a) => {
    if (a.role === "buyer") {
      return { ...a, paperBalanceUsdt: buyerCash, paperBalanceUsdc: a.paperBalanceUsdc };
    }
    if (a.role === "seller") {
      return { ...a, paperBalanceUsdt: sellerCash, paperBalanceUsdc: a.paperBalanceUsdc };
    }
    return { ...a };
  });
}

export function loadServices(): ServiceOffer[] {
  return servicesFixture as ServiceOffer[];
}

export function getAgent(id: string, agents = loadAgents()): AgentProfile | undefined {
  return agents.find((a) => a.id === id);
}

export function describeAgents(agents = loadAgents()): string {
  return agents.map((a) => `${a.id}(${a.role})`).join(", ");
}
