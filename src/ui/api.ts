import type { DemoRunResult, ServiceOffer, WorkflowResult } from "../core/types";

async function parse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    /* keep text */
  }
  if (!res.ok) {
    const err =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: string }).error)
        : `${res.status} ${text.slice(0, 200)}`;
    throw new Error(err);
  }
  return body as T;
}

export async function fetchSnapshot(): Promise<DemoRunResult> {
  return parse(await fetch("/api/snapshot"));
}

export async function payService(
  serviceId: string,
  confirm: boolean
): Promise<WorkflowResult & { snapshot: DemoRunResult }> {
  return parse(
    await fetch("/api/pay", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ serviceId, confirm }),
    })
  );
}

export async function confirmPayment(
  id: string
): Promise<WorkflowResult & { snapshot: DemoRunResult }> {
  return parse(await fetch(`/api/payments/${encodeURIComponent(id)}/confirm`, { method: "POST" }));
}

export async function rejectPayment(
  id: string
): Promise<WorkflowResult & { snapshot: DemoRunResult }> {
  return parse(await fetch(`/api/payments/${encodeURIComponent(id)}/reject`, { method: "POST" }));
}

export async function fetchServices(): Promise<ServiceOffer[]> {
  const r = await parse<{ services: ServiceOffer[] }>(await fetch("/api/services"));
  return r.services;
}

export interface AuthSession {
  phase: "idle" | "awaiting-app" | "verifying" | "connected" | "failed";
  pairingCode?: string;
  urlForWeb?: string;
  qrCodeId?: string;
  expireAt?: string;
  error?: string;
  installHint?: string;
}

export async function fetchAuth(): Promise<AuthSession> {
  return parse(await fetch("/api/auth"));
}

export async function startSignin(): Promise<AuthSession> {
  return parse(await fetch("/api/auth/signin", { method: "POST" }));
}

export async function startSignout(): Promise<AuthSession> {
  return parse(await fetch("/api/auth/signout", { method: "POST" }));
}
