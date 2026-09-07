/** Safe env reads for CLI / Node. The dashboard talks to the PayPulse HTTP API. */

export type AdapterMode = "paper" | "mock" | "live";

export function envStr(key: string, fallback = ""): string {
  try {
    if (typeof process !== "undefined" && process.env && process.env[key] != null) {
      return String(process.env[key]);
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

export function envNum(key: string, fallback: number): number {
  const v = envStr(key, "");
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function envBool(key: string, fallback = false): boolean {
  const v = envStr(key, "").toLowerCase();
  if (!v) return fallback;
  return v === "1" || v === "true" || v === "yes";
}

export function modeFromEnv(): AdapterMode {
  const m = envStr("PAYPULSE_MODE", "live").toLowerCase();
  if (m === "live" || m === "mock" || m === "paper") return m;
  return "live";
}
