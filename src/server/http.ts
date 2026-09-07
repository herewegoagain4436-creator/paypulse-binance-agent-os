import type { IncomingMessage, ServerResponse } from "node:http";
import { getEngine } from "./engine.js";
import { serveResource } from "../seller/resources.js";
import { loadListedServices } from "../core/agents.js";
import { handleMcp } from "../mcp/rpc.js";
import { getAuthSession, startAuthSignin, startAuthSignout } from "./authSession.js";
import type { DemoRunResult } from "../core/types.js";

function publicSnapshot(): DemoRunResult {
  const snap = getEngine().snapshot();
  snap.services = loadListedServices();
  return snap;
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function send(res: ServerResponse, status: number, body: unknown, headers?: Record<string, string>) {
  const json = typeof body === "string";
  const payload = json ? body : JSON.stringify(body);
  res.writeHead(status, {
    "content-type": json ? "text/plain; charset=utf-8" : "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...headers,
  });
  res.end(payload);
}

function header(req: IncomingMessage, name: string): string | undefined {
  const v = req.headers[name.toLowerCase()];
  return Array.isArray(v) ? v[0] : v;
}

export async function handlePaypulseHttp(
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean> {
  const host = header(req, "host") ?? "127.0.0.1";
  const url = new URL(req.url ?? "/", `http://${host}`);
  const path = url.pathname;
  const method = (req.method ?? "GET").toUpperCase();

  if (path.startsWith("/svc/")) {
    const pay =
      header(req, "payment-signature") ??
      header(req, "PAYMENT-SIGNATURE") ??
      url.searchParams.get("payment") ??
      undefined;
    const result = serveResource(path, pay, "live");
    const body =
      typeof result.body === "string" ? result.body : JSON.stringify(result.body);
    res.writeHead(result.status, result.headers);
    res.end(typeof result.body === "string" ? result.body : body);
    return true;
  }

  if (path === "/mcp" && method === "POST") {
    const raw = await readBody(req);
    let parsed: unknown = {};
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      send(res, 400, { error: "invalid JSON" });
      return true;
    }
    const out = await handleMcp(parsed);
    send(res, 200, out);
    return true;
  }

  if (!path.startsWith("/api/")) return false;

  try {
    if (path === "/api/health" && method === "GET") {
      send(res, 200, { ok: true, mode: "live", service: "paypulse" });
      return true;
    }

    if (path === "/api/snapshot" && method === "GET") {
      await getEngine().facade.refreshLive();
      send(res, 200, publicSnapshot());
      return true;
    }

    if (path === "/api/services" && method === "GET") {
      send(res, 200, { services: loadListedServices() });
      return true;
    }

    if (path === "/api/auth" && method === "GET") {
      send(res, 200, getAuthSession());
      return true;
    }

    if (path === "/api/auth/signin" && method === "POST") {
      send(res, 200, await startAuthSignin());
      return true;
    }

    if (path === "/api/auth/signout" && method === "POST") {
      send(res, 200, await startAuthSignout());
      return true;
    }

    if (path === "/api/pay" && method === "POST") {
      const raw = await readBody(req);
      const body = raw ? JSON.parse(raw) : {};
      const engine = getEngine();
      const r = await engine.payForService(
        String(body.fromAgentId ?? "agent-buyer-alpha"),
        String(body.serviceId),
        { confirm: Boolean(body.confirm) }
      );
      send(res, 200, { ...r, snapshot: publicSnapshot() });
      return true;
    }

    const confirmMatch = path.match(/^\/api\/payments\/([^/]+)\/(confirm|reject)$/);
    if (confirmMatch && method === "POST") {
      const engine = getEngine();
      const id = decodeURIComponent(confirmMatch[1]);
      const action = confirmMatch[2];
      const r =
        action === "confirm" ? await engine.confirmPayment(id) : await engine.rejectPayment(id);
      send(res, 200, { ...r, snapshot: publicSnapshot() });
      return true;
    }

    send(res, 404, { error: "not found", path });
    return true;
  } catch (e) {
    send(res, 500, { error: e instanceof Error ? e.message : String(e) });
    return true;
  }
}
