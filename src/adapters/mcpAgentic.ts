/**
 * Binance Agent OS MCP adapter — account / settlement context for PayPulse.
 *
 * Endpoint: https://agent.binance.com/mcp/agentic
 * Auth: client OAuth (oauth_client_id=grok) — NO API keys on device.
 * Do not open the MCP URL in a browser.
 *
 * Used here for balances / settlement context (read-oriented). No withdrawals.
 * Default: paper/sim with labeled mocks when live MCP unavailable.
 */
import { envNum, envStr } from "../core/env.js";
import type { SettlementContext } from "../core/types.js";

export const AGENT_OS_MCP_URL = envStr(
  "BINANCE_AGENT_OS_MCP_URL",
  "https://agent.binance.com/mcp/agentic"
);

export const AGENT_OS_OAUTH_CLIENT_ID = envStr(
  "BINANCE_AGENT_OS_OAUTH_CLIENT_ID",
  "grok"
);

export type AdapterMode = "paper" | "mock" | "live";

export interface McpAdapterResult<T> {
  data: T;
  usedMock: boolean;
  label: string;
  endpoint: string;
  oauthClientId: string;
}

function modeFromEnv(): AdapterMode {
  const m = envStr("PAYPULSE_MODE", "paper").toLowerCase();
  if (m === "live" || m === "mock" || m === "paper") return m;
  return "paper";
}

async function tryMcpToolsList(endpoint: string): Promise<boolean> {
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      }),
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return false;
    const body = await res.json().catch(() => null);
    return body != null && typeof body === "object";
  } catch {
    return false;
  }
}

export class McpAgenticAdapter {
  readonly mode: AdapterMode;
  readonly endpoint: string;
  readonly oauthClientId: string;
  private lastLabel =
    "PAPER SIM — MCP settlement context from local paper balances (not live)";
  private lastUsedMock = false;

  constructor(opts?: { mode?: AdapterMode }) {
    this.mode = opts?.mode ?? modeFromEnv();
    this.endpoint = AGENT_OS_MCP_URL;
    this.oauthClientId = AGENT_OS_OAUTH_CLIENT_ID;
  }

  status(): McpAdapterResult<null> {
    return {
      data: null,
      usedMock: this.lastUsedMock,
      label: this.lastLabel,
      endpoint: this.endpoint,
      oauthClientId: this.oauthClientId,
    };
  }

  /**
   * Fetch settlement / balance context for A2A payments.
   * Paper: local balances. Live: probe MCP; fall back to labeled MOCK.
   */
  async getSettlementContext(input: {
    buyerUsdt: number;
    sellerUsdt: number;
    buyerUsdc: number;
    sellerUsdc: number;
    dailySpendUsedUsd: number;
    dailyCapUsd: number;
  }): Promise<McpAdapterResult<SettlementContext>> {
    const paperCtx = (): SettlementContext => ({
      buyerBalanceUsdt: input.buyerUsdt,
      sellerBalanceUsdt: input.sellerUsdt,
      buyerBalanceUsdc: input.buyerUsdc,
      sellerBalanceUsdc: input.sellerUsdc,
      dailySpendUsedUsd: input.dailySpendUsedUsd,
      dailySpendLeftUsd: Math.max(0, input.dailyCapUsd - input.dailySpendUsedUsd),
      source: "paper-local",
      usedMock: false,
    });

    if (this.mode === "paper") {
      this.lastUsedMock = false;
      this.lastLabel =
        "PAPER SIM — MCP context from local paper balances (oauth_client_id=grok; not live)";
      return {
        data: paperCtx(),
        usedMock: false,
        label: this.lastLabel,
        endpoint: this.endpoint,
        oauthClientId: this.oauthClientId,
      };
    }

    if (this.mode === "mock") {
      this.lastUsedMock = true;
      this.lastLabel = "MOCK — explicit MCP settlement context; not live Binance account";
      const ctx = { ...paperCtx(), source: "mock-labeled", usedMock: true };
      return {
        data: ctx,
        usedMock: true,
        label: this.lastLabel,
        endpoint: this.endpoint,
        oauthClientId: this.oauthClientId,
      };
    }

    const ok = await tryMcpToolsList(this.endpoint);
    if (!ok) {
      this.lastUsedMock = true;
      this.lastLabel =
        "MOCK — Agent OS MCP/OAuth not available in-process; settlement context is local (not live)";
      const ctx = { ...paperCtx(), source: "mock-fallback", usedMock: true };
      return {
        data: ctx,
        usedMock: true,
        label: this.lastLabel,
        endpoint: this.endpoint,
        oauthClientId: this.oauthClientId,
      };
    }

    // MCP reachable but we still do not invent live balances without OAuth host
    this.lastUsedMock = true;
    this.lastLabel =
      "MOCK — MCP reachable but no OAuth token in-process; labeled MOCK balances";
    const ctx = {
      ...paperCtx(),
      source: "mock-mcp-reachable-no-oauth",
      usedMock: true,
    };
    return {
      data: ctx,
      usedMock: true,
      label: this.lastLabel,
      endpoint: this.endpoint,
      oauthClientId: this.oauthClientId,
    };
  }

  /** Starting paper balances from env (for UI/CLI). */
  static defaultPaperBalances(): {
    buyerUsdt: number;
    sellerUsdt: number;
  } {
    return {
      buyerUsdt: envNum("PAPER_BUYER_USDT", 100),
      sellerUsdt: envNum("PAPER_SELLER_USDT", 10),
    };
  }
}
