import type { PaymentRecord, PaymentStatus } from "./types.js";
import { loadLedgerFile, saveLedgerFile } from "./store.js";

const FILLED: PaymentStatus[] = [
  "SETTLED",
  "DELIVERED",
  "CONFIRMED_PAPER",
  "SUBMITTED_MOCK",
];
const RESERVED: PaymentStatus[] = ["PENDING", "QUOTED", "AWAITING_CONFIRM"];

export class PaymentLedger {
  private records: PaymentRecord[] = [];
  private persist: boolean;

  constructor(opts?: { persist?: boolean; seed?: PaymentRecord[] }) {
    this.persist = opts?.persist ?? false;
    if (opts?.seed) this.records = [...opts.seed];
    else if (this.persist) this.records = loadLedgerFile();
  }

  all(): PaymentRecord[] {
    return [...this.records].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  pending(): PaymentRecord[] {
    return this.all().filter((r) => RESERVED.includes(r.status));
  }

  get(id: string): PaymentRecord | undefined {
    return this.records.find((r) => r.id === id);
  }

  upsert(record: PaymentRecord): PaymentRecord {
    const idx = this.records.findIndex((r) => r.id === record.id);
    if (idx >= 0) this.records[idx] = record;
    else this.records.push(record);
    if (this.persist) saveLedgerFile(this.records);
    return record;
  }

  private onDay(r: PaymentRecord, dayIso: string): boolean {
    return (r.settledAt ?? r.updatedAt).startsWith(dayIso);
  }

  /** Settled fills (paper/mock/live). Live PENDING is not a fill. */
  dailyFilledUsd(fromAgentId?: string, dayIso = new Date().toISOString().slice(0, 10)): number {
    return this.records
      .filter((r) => {
        if (!FILLED.includes(r.status)) return false;
        if (fromAgentId && r.fromAgentId !== fromAgentId) return false;
        return this.onDay(r, dayIso);
      })
      .reduce((sum, r) => sum + r.amount, 0);
  }

  /** Open quotes / pending / awaiting confirm — counts toward local cap. */
  dailyReservedUsd(fromAgentId?: string, dayIso = new Date().toISOString().slice(0, 10)): number {
    return this.records
      .filter((r) => {
        if (!RESERVED.includes(r.status)) return false;
        if (fromAgentId && r.fromAgentId !== fromAgentId) return false;
        return this.onDay(r, dayIso);
      })
      .reduce((sum, r) => sum + r.amount, 0);
  }

  dailySpendUsd(fromAgentId?: string, dayIso = new Date().toISOString().slice(0, 10)): number {
    return this.dailyFilledUsd(fromAgentId, dayIso) + this.dailyReservedUsd(fromAgentId, dayIso);
  }

  successCount(): number {
    return this.records.filter((r) => FILLED.includes(r.status)).length;
  }

  deliveredCount(): number {
    return this.records.filter((r) => r.status === "DELIVERED" || r.delivery).length;
  }

  rejectedCount(): number {
    return this.records.filter((r) => r.status === "FAILED" || r.status === "REJECTED").length;
  }

  attemptCount(): number {
    return this.records.length;
  }
}
