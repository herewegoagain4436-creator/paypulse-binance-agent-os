import { AgentOsFacade } from "../adapters/agentOsFacade.js";
import { PayPulseEngine } from "../core/workflow.js";

let engine: PayPulseEngine | null = null;

export function getEngine(): PayPulseEngine {
  if (!engine) {
    engine = new PayPulseEngine({
      facade: new AgentOsFacade({ mode: "live" }),
      persist: true,
    });
  }
  return engine;
}
