import type { PaymentRecord, PaymentStatus } from "./types.js";

/** In-memory A2A payment ledger. */
export class PaymentLedger {
  private records: PaymentRecord[] = [];

  all(): PaymentRecord[] {
    return [...this.records].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  pending(): PaymentRecord[] {
    return this.all().filter((r) =>
      (["PENDING", "QUOTED", "AWAITING_CONFIRM"] as PaymentStatus[]).includes(r.status)
    );
  }

  byStatus(status: PaymentStatus): PaymentRecord[] {
    return this.all().filter((r) => r.status === status);
  }

  get(id: string): PaymentRecord | undefined {
    return this.records.find((r) => r.id === id);
  }

  upsert(record: PaymentRecord): PaymentRecord {
    const idx = this.records.findIndex((r) => r.id === record.id);
    if (idx >= 0) this.records[idx] = record;
    else this.records.push(record);
    return record;
  }

  /** Only paper/mock fills count toward daily spend — live PENDING is not a fill. */
  dailySpendUsd(fromAgentId?: string, dayIso = new Date().toISOString().slice(0, 10)): number {
    return this.records
      .filter((r) => {
        if (r.status !== "CONFIRMED_PAPER" && r.status !== "SUBMITTED_MOCK") return false;
        if (fromAgentId && r.fromAgentId !== fromAgentId) return false;
        return r.settledAt?.startsWith(dayIso) || r.updatedAt.startsWith(dayIso);
      })
      .reduce((sum, r) => sum + r.amount, 0);
  }

  successCount(): number {
    return this.records.filter(
      (r) => r.status === "CONFIRMED_PAPER" || r.status === "SUBMITTED_MOCK"
    ).length;
  }

  rejectedCount(): number {
    return this.records.filter(
      (r) => r.status === "FAILED" || r.status === "REJECTED"
    ).length;
  }

  attemptCount(): number {
    return this.records.length;
  }
}
