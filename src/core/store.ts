import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { envStr } from "./env.js";
import type { PaymentRecord } from "./types.js";

export function ledgerPath(): string {
  return envStr("PAYPULSE_LEDGER_PATH", ".paypulse/ledger.json");
}

export function loadLedgerFile(): PaymentRecord[] {
  try {
    const raw = readFileSync(ledgerPath(), "utf8");
    const parsed = JSON.parse(raw) as { payments?: PaymentRecord[] } | PaymentRecord[];
    return Array.isArray(parsed) ? parsed : parsed.payments ?? [];
  } catch {
    return [];
  }
}

export function saveLedgerFile(payments: PaymentRecord[]): void {
  const path = ledgerPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify({ updatedAt: new Date().toISOString(), payments }, null, 2));
}
