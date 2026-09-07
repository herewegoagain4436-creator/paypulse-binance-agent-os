import { authSignin, authSignout, authVerify, probeWallet } from "../adapters/agenticWallet.js";
import { getEngine } from "./engine.js";

export type AuthPhase = "idle" | "awaiting-app" | "verifying" | "connected" | "failed";

export interface AuthSession {
  phase: AuthPhase;
  pairingCode?: string;
  urlForWeb?: string;
  qrCodeId?: string;
  expireAt?: string;
  error?: string;
  installHint?: string;
}

let session: AuthSession = { phase: "idle" };
let verifyRunning = false;

export function getAuthSession(): AuthSession {
  return { ...session };
}

async function refreshConnected(): Promise<void> {
  const wallet = await probeWallet();
  if (wallet.signedIn) {
    session = { phase: "connected" };
    await getEngine().facade.refreshLive();
  }
}

export async function startAuthSignin(): Promise<AuthSession> {
  const started = await authSignin();
  if (started.alreadyConnected) {
    session = { phase: "connected" };
    await getEngine().facade.refreshLive();
    return getAuthSession();
  }
  if (started.error || !started.qrCodeId || !started.urlForWeb || !started.pairingCode) {
    session = {
      phase: "failed",
      error: started.error ?? "signin did not return a pairing code",
      installHint: started.installHint,
    };
    return getAuthSession();
  }

  session = {
    phase: "awaiting-app",
    pairingCode: started.pairingCode,
    urlForWeb: started.urlForWeb,
    qrCodeId: started.qrCodeId,
    expireAt: started.expireAt,
  };

  if (!verifyRunning) {
    verifyRunning = true;
    const qrCodeId = started.qrCodeId;
    session.phase = "verifying";
    void authVerify(qrCodeId)
      .then(async (v) => {
        if (v.ok) {
          await refreshConnected();
          if (session.phase !== "connected") {
            session = {
              phase: "failed",
              error:
                "App may show success, but baw wallet status is still disconnected. Click Sign in again for a fresh code.",
            };
          }
        } else {
          session = {
            phase: "failed",
            error: v.error ?? "verify failed or QR expired. Click Sign in for a new code.",
          };
        }
      })
      .finally(() => {
        verifyRunning = false;
      });
  }

  return getAuthSession();
}

export async function startAuthSignout(): Promise<AuthSession> {
  const r = await authSignout();
  session = r.ok ? { phase: "idle" } : { phase: "failed", error: r.error };
  await getEngine().facade.refreshLive();
  return getAuthSession();
}
