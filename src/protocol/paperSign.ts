import { createHmac, timingSafeEqual } from "node:crypto";
import { envStr } from "../core/env.js";
import type { PaymentAsset } from "../core/types.js";

export interface PaperPayload {
  resourceUrl: string;
  amount: number;
  asset: PaymentAsset;
  payTo: string;
  intentId: string;
  exp: number;
}

export interface PaperEnvelope {
  v: 1;
  facilitator: "paypulse-paper";
  payload: PaperPayload;
  sig: string;
}

export function paperSecret(): string {
  return envStr("PAYPULSE_PAPER_SECRET", "paypulse-paper-dev-secret");
}

function hmacHex(secret: string, payload: PaperPayload): string {
  const body = canonical(payload);
  return createHmac("sha256", secret).update(body).digest("hex");
}

function canonical(payload: PaperPayload): string {
  return JSON.stringify({
    resourceUrl: payload.resourceUrl,
    amount: payload.amount,
    asset: payload.asset,
    payTo: payload.payTo,
    intentId: payload.intentId,
    exp: payload.exp,
  });
}

export function signPaper(payload: PaperPayload, secret = paperSecret()): string {
  const env: PaperEnvelope = {
    v: 1,
    facilitator: "paypulse-paper",
    payload,
    sig: hmacHex(secret, payload),
  };
  return Buffer.from(JSON.stringify(env), "utf8").toString("base64");
}

export function verifyPaper(
  headerValue: string,
  secret = paperSecret()
): { ok: true; payload: PaperPayload } | { ok: false; reason: string } {
  let parsed: PaperEnvelope;
  try {
    parsed = JSON.parse(Buffer.from(headerValue, "base64").toString("utf8")) as PaperEnvelope;
  } catch {
    return { ok: false, reason: "paper payment header is not valid base64 JSON" };
  }
  if (parsed.v !== 1 || parsed.facilitator !== "paypulse-paper" || !parsed.payload || !parsed.sig) {
    return { ok: false, reason: "paper payment envelope missing fields" };
  }
  if (parsed.payload.exp < Date.now()) {
    return { ok: false, reason: "paper payment signature expired" };
  }
  const expected = hmacHex(secret, parsed.payload);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(String(parsed.sig), "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "paper payment HMAC mismatch" };
  }
  return { ok: true, payload: parsed.payload };
}

export function looksLikePaperHeader(value: string): boolean {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64").toString("utf8")) as {
      facilitator?: string;
    };
    return parsed.facilitator === "paypulse-paper";
  } catch {
    return false;
  }
}
