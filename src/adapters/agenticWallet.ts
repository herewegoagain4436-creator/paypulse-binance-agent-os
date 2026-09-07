/**
 * Thin wrapper around the Binance Agentic Wallet CLI (`baw`).
 * Live buyer path: x402-payment preview / sign, wallet settings (x402 quota).
 * Missing CLI or unsigned session is a labeled gap — never a silent fill.
 */
import { spawn } from "node:child_process";
import { envStr } from "../core/env.js";
import type { PreviewOption, QuotaSnapshot, WalletStatus } from "../core/types.js";
import { X402_DOCUMENTED_DAILY_CAP_USD } from "../core/risk.js";

export interface BawResult {
  ok: boolean;
  code: number | null;
  stdout: string;
  stderr: string;
  available: boolean;
}

function bawBin(): string {
  const bin = envStr("PAYPULSE_BAW_BIN", "baw");
  if (process.platform === "win32" && !/\.(cmd|exe|bat)$/i.test(bin)) {
    return `${bin}.cmd`;
  }
  return bin;
}

export async function runBaw(
  args: string[],
  timeoutMs = 20_000
): Promise<BawResult> {
  const bin = bawBin();
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(bin, [...args, "--json"], {
        windowsHide: true,
        shell: process.platform === "win32",
        env: process.env,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      resolve({
        ok: false,
        code: null,
        stdout: "",
        stderr: message.includes("ENOENT") || message.includes("EINVAL")
          ? "baw not installed"
          : message,
        available: false,
      });
      return;
    }

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill();
        resolve({
          ok: false,
          code: null,
          stdout,
          stderr: stderr || "baw timed out",
          available: true,
        });
      }
    }, timeoutMs);

    child.stdout?.on("data", (d) => {
      stdout += String(d);
    });
    child.stderr?.on("data", (d) => {
      stderr += String(d);
    });
    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const missing = (err as NodeJS.ErrnoException).code === "ENOENT";
      resolve({
        ok: false,
        code: null,
        stdout,
        stderr: missing ? "baw not installed" : err.message,
        available: !missing,
      });
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        ok: code === 0,
        code,
        stdout,
        stderr,
        available: true,
      });
    });
  });
}

function parseJson(stdout: string): unknown {
  const trimmed = stdout.trim();
  if (!trimmed) return null;
  const start = trimmed.indexOf("{");
  if (start < 0) return null;
  try {
    return JSON.parse(trimmed.slice(start));
  } catch {
    return null;
  }
}

export interface SignInStart {
  alreadyConnected: boolean;
  pairingCode?: string;
  urlForWeb?: string;
  qrCodeId?: string;
  expireAt?: string;
  error?: string;
  installHint?: string;
}

export async function authSignin(): Promise<SignInStart> {
  const r = await runBaw(["auth", "signin"], 60_000);
  if (!r.available || r.stderr.includes("baw not installed")) {
    return {
      alreadyConnected: false,
      error: "Agentic Wallet CLI (baw) is not installed.",
      installHint: "npm i -g @binance/agentic-wallet",
    };
  }
  const body = parseJson(r.stdout) as {
    success?: boolean;
    data?: {
      status?: string;
      urlForWeb?: string;
      qrCodeId?: string;
      expireAt?: string;
      pairingCode?: string;
    };
    error?: { message?: string };
  } | null;
  if (body?.data?.status === "ALREADY_CONNECTED") {
    return { alreadyConnected: true };
  }
  if (!r.ok || !body?.data?.qrCodeId || !body.data.urlForWeb || !body.data.pairingCode) {
    return {
      alreadyConnected: false,
      error:
        body?.error?.message ||
        (r.stderr || r.stdout || "baw auth signin failed").slice(0, 280),
    };
  }
  return {
    alreadyConnected: false,
    pairingCode: body.data.pairingCode,
    urlForWeb: body.data.urlForWeb,
    qrCodeId: body.data.qrCodeId,
    expireAt: body.data.expireAt,
  };
}

export async function authVerify(qrCodeId: string): Promise<{ ok: boolean; error?: string }> {
  const r = await runBaw(["auth", "verify", "--qrCodeId", qrCodeId], 330_000);
  const body = parseJson(r.stdout) as {
    success?: boolean;
    data?: { status?: string };
    error?: { message?: string; name?: string };
  } | null;
  if (body?.success && body.data?.status === "SUCCESS") return { ok: true };
  return {
    ok: false,
    error:
      body?.error?.message ||
      (r.stderr || r.stdout || "auth verify failed").slice(0, 280),
  };
}

export async function authSignout(): Promise<{ ok: boolean; error?: string }> {
  const r = await runBaw(["auth", "signout"], 20_000);
  if (r.ok) return { ok: true };
  return { ok: false, error: (r.stderr || r.stdout || "signout failed").slice(0, 280) };
}

/** True only for CONNECTED / CREATING. UNCONNECTED and missing status are signed out. */
export function walletIsSignedIn(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const d = data as { status?: string; connected?: boolean };
  const status = String(d.status ?? "").toUpperCase();
  if (status === "UNCONNECTED" || status === "DISCONNECTED" || status === "LOGGED_OUT") {
    return false;
  }
  if (status === "CONNECTED" || status === "CREATING") return true;
  return d.connected === true;
}

export async function probeWallet(): Promise<WalletStatus> {
  const r = await runBaw(["wallet", "status"], 8000);
  if (!r.available || r.stderr.includes("baw not installed")) {
    return {
      available: false,
      signedIn: false,
      label: "Not signed in",
      command: "baw wallet status --json",
    };
  }
  const body = parseJson(r.stdout) as { success?: boolean; data?: unknown } | null;
  const signedIn = Boolean(r.ok && body?.success !== false && walletIsSignedIn(body?.data));
  if (!r.ok) {
    return {
      available: true,
      signedIn: false,
      label: "Not signed in",
      command: "baw auth signin --json",
    };
  }
  return {
    available: true,
    signedIn,
    label: signedIn ? "Signed in" : "Not signed in",
    command: "baw wallet status --json",
  };
}

export async function readX402Quota(): Promise<QuotaSnapshot> {
  const documented: QuotaSnapshot = {
    source: "documented-default",
    dailyLimit: X402_DOCUMENTED_DAILY_CAP_USD,
    used: 0,
    left: X402_DOCUMENTED_DAILY_CAP_USD,
    asOf: new Date().toISOString(),
    label:
      "documented x402DailyLimit default $20/day (not live wallet settings — confirm in Binance App)",
  };
  const r = await runBaw(["wallet", "settings"], 8000);
  if (!r.ok) return documented;
  const body = parseJson(r.stdout) as {
    success?: boolean;
    data?: {
      x402DailyLimit?: number;
      x402QuotaUsed?: number;
      x402QuotaLeft?: number;
    };
  } | null;
  const data = body?.data;
  if (!data || data.x402DailyLimit == null) return documented;
  const dailyLimit = Number(data.x402DailyLimit);
  const used = Number(data.x402QuotaUsed ?? 0);
  const left =
    data.x402QuotaLeft != null ? Number(data.x402QuotaLeft) : Math.max(0, dailyLimit - used);
  return {
    source: "baw-wallet-settings",
    dailyLimit,
    used,
    left,
    asOf: new Date().toISOString(),
    label: `live x402 quota left $${left} of $${dailyLimit} (baw wallet settings)`,
  };
}

export async function previewX402(paymentRequired: unknown): Promise<{
  ok: boolean;
  paymentId?: string;
  options: PreviewOption[];
  label: string;
  raw?: unknown;
}> {
  const payload = JSON.stringify(paymentRequired);
  const r = await runBaw(["x402-payment", "preview", "--paymentRequirements", payload], 20_000);
  if (!r.available || r.stderr.includes("baw not installed")) {
    return {
      ok: false,
      options: [],
      label: "baw not installed — cannot preview live x402 options",
    };
  }
  if (!r.ok) {
    return {
      ok: false,
      options: [],
      label: `baw x402-payment preview failed: ${(r.stderr || r.stdout).slice(0, 240)}`,
    };
  }
  const body = parseJson(r.stdout) as {
    success?: boolean;
    data?: { paymentId?: string; options?: PreviewOption[] };
  } | null;
  const options = body?.data?.options ?? [];
  return {
    ok: Boolean(body?.success !== false && options.length),
    paymentId: body?.data?.paymentId,
    options,
    label: options.length
      ? `baw preview: ${options.length} option(s)`
      : "baw preview returned no options",
    raw: body,
  };
}

export async function signX402(
  paymentId: string,
  selectedIndex: number
): Promise<{
  ok: boolean;
  paymentHeaderName?: string;
  paymentHeaderValue?: string;
  approveTxHash?: string | null;
  signatureExpiresAt?: number;
  label: string;
}> {
  const r = await runBaw(
    [
      "x402-payment",
      "sign",
      "--paymentId",
      paymentId,
      "--selectedIndex",
      String(selectedIndex),
    ],
    30_000
  );
  if (!r.ok) {
    return {
      ok: false,
      label: `baw x402-payment sign failed: ${(r.stderr || r.stdout).slice(0, 240)}`,
    };
  }
  const body = parseJson(r.stdout) as {
    success?: boolean;
    data?: {
      paymentHeaderName?: string;
      paymentHeaderValue?: string;
      approveTxHash?: string | null;
      signatureExpiresAt?: number;
    };
  } | null;
  const data = body?.data;
  if (!data?.paymentHeaderValue) {
    return { ok: false, label: "baw sign returned no PAYMENT-SIGNATURE" };
  }
  return {
    ok: true,
    paymentHeaderName: data.paymentHeaderName ?? "PAYMENT-SIGNATURE",
    paymentHeaderValue: data.paymentHeaderValue,
    approveTxHash: data.approveTxHash,
    signatureExpiresAt: data.signatureExpiresAt,
    label: "baw x402-payment sign produced PAYMENT-SIGNATURE",
  };
}
