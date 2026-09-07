/**
 * MCP adapter — account / market-data context, not the payment rail.
 * Official Agent OS: MCP = trading + market data; payments = x402 / Agentic Wallet.
 */
import { envStr, modeFromEnv, type AdapterMode } from "../core/env.js";
import type { SettlementContext } from "../core/types.js";

export const AGENT_OS_MCP_URL = envStr(
  "BINANCE_AGENT_OS_MCP_URL",
  "https://agent.binance.com/mcp/agentic"
);

export const AGENT_OS_OAUTH_CLIENT_ID = envStr(
  "BINANCE_AGENT_OS_OAUTH_CLIENT_ID",
  "grok"
);

export interface McpAdapterResult<T> {
  data: T;
  usedMock: boolean;
  label: string;
  endpoint: string;
  oauthClientId: string;
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
    "LIVE MCP — settlement context requires host OAuth (payments are x402, not MCP)";
  private lastUsedMock = false;

  constructor(opts?: { mode?: AdapterMode }) {
    this.mode = opts?.mode ?? modeFromEnv();
    this.endpoint = AGENT_OS_MCP_URL;
    this.oauthClientId = AGENT_OS_OAUTH_CLIENT_ID;
    if (this.mode === "paper") {
      this.lastLabel = "PAPER SIM — MCP unused for settle; local balances only";
    } else if (this.mode === "mock") {
      this.lastLabel = "MOCK — MCP unused for settle; labeled mock balances";
    }
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

  async getSettlementContext(input: {
    buyerUsdt: number;
    sellerUsdt: number;
    buyerUsdc: number;
    sellerUsdc: number;
    dailySpendUsedUsd: number;
    dailySpendReservedUsd: number;
    dailyCapUsd: number;
    quotaSource: string;
  }): Promise<McpAdapterResult<Omit<SettlementContext, "quota">>> {
    const seed = (source: string, usedMock: boolean): Omit<SettlementContext, "quota"> => ({
      buyerBalanceUsdt: input.buyerUsdt,
      sellerBalanceUsdt: input.sellerUsdt,
      buyerBalanceUsdc: input.buyerUsdc,
      sellerBalanceUsdc: input.sellerUsdc,
      dailySpendUsedUsd: input.dailySpendUsedUsd,
      dailySpendReservedUsd: input.dailySpendReservedUsd,
      dailySpendLeftUsd: Math.max(0, input.dailyCapUsd - input.dailySpendUsedUsd),
      source,
      usedMock,
    });

    if (this.mode === "paper") {
      this.lastUsedMock = false;
      this.lastLabel = "PAPER — local balances; MCP is not the payment rail";
      return {
        data: seed("paper-local", false),
        usedMock: false,
        label: this.lastLabel,
        endpoint: this.endpoint,
        oauthClientId: this.oauthClientId,
      };
    }

    if (this.mode === "mock") {
      this.lastUsedMock = true;
      this.lastLabel = "MOCK — labeled balances; MCP is not the payment rail";
      return {
        data: seed("mock-labeled", true),
        usedMock: true,
        label: this.lastLabel,
        endpoint: this.endpoint,
        oauthClientId: this.oauthClientId,
      };
    }

    const ok = await tryMcpToolsList(this.endpoint);
    this.lastUsedMock = false;
    this.lastLabel = ok
      ? `LIVE MCP reachable — no in-process OAuth (client_id=${this.oauthClientId}); seed balances only. Payments use x402, not MCP.`
      : `LIVE MCP — OAuth required in MCP host (oauth_client_id=${this.oauthClientId}). Seed context only. Payments use x402.`;
    return {
      data: seed(ok ? "live-mcp-reachable-no-oauth" : "live-seed-awaiting-oauth", false),
      usedMock: false,
      label: this.lastLabel,
      endpoint: this.endpoint,
      oauthClientId: this.oauthClientId,
    };
  }
}
