import { getEngine } from "../server/engine.js";
import { loadListedServices } from "../core/agents.js";

interface JsonRpc {
  jsonrpc?: string;
  id?: number | string | null;
  method?: string;
  params?: { name?: string; arguments?: Record<string, unknown> };
}

const TOOLS = [
  {
    name: "paypulse_list_services",
    description: "List PayPulse x402 paid resources (path, price, asset, seller).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "paypulse_preview_payment",
    description:
      "Create an x402 payment for a service and stop at quote/confirm. Pass confirm=false to wait.",
    inputSchema: {
      type: "object",
      properties: {
        serviceId: { type: "string" },
        confirm: { type: "boolean" },
      },
      required: ["serviceId"],
    },
  },
  {
    name: "paypulse_confirm_payment",
    description: "Sign and replay a PayPulse payment that is AWAITING_CONFIRM.",
    inputSchema: {
      type: "object",
      properties: { paymentId: { type: "string" } },
      required: ["paymentId"],
    },
  },
  {
    name: "paypulse_ledger",
    description: "Return the PayPulse A2A payment ledger snapshot.",
    inputSchema: { type: "object", properties: {} },
  },
];

function ok(id: JsonRpc["id"], result: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

function err(id: JsonRpc["id"], message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code: -32000, message } };
}

export async function handleMcp(msg: unknown): Promise<unknown> {
  const rpc = msg as JsonRpc;
  const id = rpc.id ?? null;
  const method = rpc.method ?? "";

  if (method === "initialize") {
    return ok(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "paypulse", version: "1.1.0" },
    });
  }
  if (method === "notifications/initialized") {
    return ok(id, {});
  }
  if (method === "tools/list") {
    return ok(id, { tools: TOOLS });
  }
  if (method === "tools/call") {
    const name = rpc.params?.name ?? "";
    const args = rpc.params?.arguments ?? {};
    try {
      const engine = getEngine();
      if (name === "paypulse_list_services") {
        return ok(id, {
          content: [{ type: "text", text: JSON.stringify(loadListedServices(), null, 2) }],
        });
      }
      if (name === "paypulse_preview_payment") {
        const r = await engine.payForService(
          "agent-buyer-alpha",
          String(args.serviceId),
          { confirm: Boolean(args.confirm) }
        );
        return ok(id, {
          content: [{ type: "text", text: JSON.stringify(r.payment, null, 2) }],
        });
      }
      if (name === "paypulse_confirm_payment") {
        const r = await engine.confirmPayment(String(args.paymentId));
        return ok(id, {
          content: [{ type: "text", text: JSON.stringify(r.payment, null, 2) }],
        });
      }
      if (name === "paypulse_ledger") {
        await engine.facade.refreshLive();
        return ok(id, {
          content: [{ type: "text", text: JSON.stringify(engine.snapshot(), null, 2) }],
        });
      }
      return err(id, `unknown tool ${name}`);
    } catch (e) {
      return err(id, e instanceof Error ? e.message : String(e));
    }
  }

  return err(id, `unknown method ${method}`);
}
