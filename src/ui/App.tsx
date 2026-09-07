import { useEffect, useState } from "react";
import type { DemoRunResult, PaymentRecord, ServiceOffer } from "../core/types";
import {
  confirmPayment,
  fetchAuth,
  fetchSnapshot,
  payService,
  rejectPayment,
  startSignin,
  startSignout,
  type AuthSession,
} from "./api";

function statusTone(status: string): string {
  if (status === "SETTLED" || status === "DELIVERED") return "ok";
  if (status === "REJECTED" || status === "FAILED") return "bad";
  return "wait";
}

export function App() {
  const [loading, setLoading] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [result, setResult] = useState<DemoRunResult | null>(null);
  const [auth, setAuth] = useState<AuthSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  const signedIn = Boolean(result?.adapterMeta.x402.wallet.signedIn);
  const waiting = auth?.phase === "awaiting-app" || auth?.phase === "verifying";
  const liveQuota =
    signedIn && result?.adapterMeta.x402.quota.source === "baw-wallet-settings"
      ? result.adapterMeta.x402.quota
      : null;
  const pending = result?.pending ?? [];

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setResult(await fetchSnapshot());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    void fetchAuth().then(setAuth).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!waiting) return;
    const t = window.setInterval(() => {
      void fetchAuth()
        .then((s) => {
          setAuth(s);
          if (s.phase === "connected") void refresh();
        })
        .catch(() => undefined);
    }, 2000);
    return () => window.clearInterval(t);
  }, [auth?.phase]);

  async function onSignin() {
    if (authBusy || waiting) return;
    setAuthBusy(true);
    setError(null);
    try {
      const s = await startSignin();
      setAuth(s);
      if (s.urlForWeb) window.open(s.urlForWeb, "paypulse-wallet-login");
      if (s.phase === "connected") await refresh();
      if (s.phase === "failed" && s.error) setError(s.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAuthBusy(false);
    }
  }

  async function onSignout() {
    setAuthBusy(true);
    setError(null);
    try {
      setAuth(await startSignout());
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAuthBusy(false);
    }
  }

  async function onPay(serviceId: string) {
    setLoading(true);
    setError(null);
    try {
      setResult((await payService(serviceId, true)).snapshot);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function onConfirm(id: string) {
    setLoading(true);
    setError(null);
    try {
      setResult((await confirmPayment(id)).snapshot);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function onReject(id: string) {
    setLoading(true);
    setError(null);
    try {
      setResult((await rejectPayment(id)).snapshot);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const quotaPct = liveQuota
    ? Math.max(0, Math.min(100, (liveQuota.left / Math.max(liveQuota.dailyLimit, 1)) * 100))
    : 0;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="mark" aria-hidden />
          <span className="brand-name">
            Pay<span>Pulse</span>
          </span>
        </div>
        <div className="top-actions">
          <span className={`chip ${signedIn ? "chip-on" : waiting ? "chip-wait" : "chip-off"}`}>
            <i className="dot" />
            {signedIn ? "Live" : waiting ? "Confirm in App" : "Signed out"}
          </span>
          {signedIn ? (
            <button className="btn ghost" onClick={() => void onSignout()} disabled={authBusy}>
              Sign out
            </button>
          ) : (
            <button className="btn" onClick={() => void onSignin()} disabled={authBusy || waiting}>
              {authBusy || waiting ? "Waiting…" : "Sign in"}
            </button>
          )}
        </div>
      </header>

      {auth?.pairingCode && waiting ? (
        <section className="panel pair-panel">
          <p className="kicker">Pairing code</p>
          <div className="pair-code">{auth.pairingCode}</div>
          <p className="muted">Confirm this code in the Binance Wallet App. Keep this tab open.</p>
          {auth.urlForWeb ? (
            <a className="link" href={auth.urlForWeb} target="_blank" rel="noreferrer">
              Open Binance login
            </a>
          ) : null}
        </section>
      ) : null}

      {error ? <p className="banner-err">{error}</p> : null}

      <section className={`panel hero ${signedIn ? "hero-on" : ""}`}>
        {signedIn ? (
          <>
            <div>
              <p className="kicker">x402 daily limit</p>
              <h2 className="hero-title">
                {liveQuota ? `$${liveQuota.left.toFixed(2)}` : "Connected"}
              </h2>
              <p className="muted">
                {liveQuota
                  ? `${liveQuota.left.toFixed(2)} of $${liveQuota.dailyLimit} remaining today`
                  : "Wallet connected. Quota loads from Binance settings."}
              </p>
            </div>
            {liveQuota ? (
              <div className="meter" aria-hidden>
                <svg viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="52" className="meter-track" />
                  <circle
                    cx="60"
                    cy="60"
                    r="52"
                    className="meter-val"
                    strokeDasharray={`${(quotaPct / 100) * 327} 327`}
                  />
                </svg>
                <span>left</span>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <div>
              <p className="kicker">Wallet</p>
              <h2 className="hero-title">Sign in to pay live</h2>
              <p className="muted">
                Connect Binance Agentic Wallet. Payments stay on the live x402 rail — nothing is
                simulated.
              </p>
            </div>
            <button className="btn lg" onClick={() => void onSignin()} disabled={authBusy || waiting}>
              {authBusy || waiting ? "Waiting…" : "Sign in"}
            </button>
          </>
        )}
      </section>

      {signedIn ? (
      <section>
        <div className="section-head">
          <h3>Services</h3>
        </div>
        <div className="cards">
          {(result?.services ?? []).map((s: ServiceOffer) => (
            <article key={s.id} className="svc">
              <div>
                <h4>{s.title}</h4>
                <p className="muted">{s.description}</p>
              </div>
              <div className="svc-foot">
                <span className="price">
                  ${s.priceUsd} <small>{s.asset}</small>
                </span>
                <button className="btn" disabled={loading} onClick={() => void onPay(s.id)}>
                  Pay
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
      ) : null}

      {signedIn && pending.length > 0 ? (
        <section className="panel">
          <div className="section-head">
            <h3>Needs confirmation</h3>
          </div>
          <ul className="rows">
            {pending.map((p) => (
              <li key={p.id} className="row">
                <span className={`pill ${statusTone(p.status)}`}>{p.status}</span>
                <span className="row-main">
                  {p.amount} {p.asset}
                </span>
                {p.status === "AWAITING_CONFIRM" ? (
                  <span className="row-actions">
                    <button className="btn sm" disabled={loading} onClick={() => void onConfirm(p.id)}>
                      Confirm
                    </button>
                    <button
                      className="btn ghost sm"
                      disabled={loading}
                      onClick={() => void onReject(p.id)}
                    >
                      Reject
                    </button>
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {signedIn ? (
      <section className="panel">
        <div className="section-head">
          <h3>Activity</h3>
        </div>
        {!result || result.ledger.length === 0 ? (
          <p className="empty">No payments yet.</p>
        ) : (
          <ul className="rows">
            {result.ledger.map((p: PaymentRecord) => (
              <li key={p.id} className="row">
                <span className={`pill ${statusTone(p.status)}`}>{p.status}</span>
                <span className="row-main">
                  {p.amount} {p.asset}
                </span>
                <span className="row-meta">{p.txHash ? p.txHash.slice(0, 12) + "…" : "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      ) : null}
    </div>
  );
}
