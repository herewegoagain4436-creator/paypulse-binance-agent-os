import type { AuthSession } from "../api";

export function SignInPanel({
  auth,
  walletSignedIn,
  busy,
  onSignin,
  onSignout,
}: {
  auth: AuthSession | null;
  walletSignedIn: boolean;
  busy: boolean;
  onSignin: () => void;
  onSignout: () => void;
}) {
  const phase = auth?.phase ?? "idle";
  const waiting = phase === "awaiting-app" || phase === "verifying";
  const connected = walletSignedIn || phase === "connected";

  return (
    <div className="card signin-card" style={{ gridColumn: "span 12" }}>
      <div className="signin-row">
        <div>
          <h2>Binance Agentic Wallet</h2>
          <p className="sub">
            {connected
              ? "Signed in. Live x402 preview/sign can use this wallet."
              : "Sign in here — PayPulse has no other login screen. Confirm the pairing code in the Binance Wallet App."}
          </p>
        </div>
        <div className="actions">
          {connected ? (
            <button className="secondary" disabled={busy} onClick={onSignout}>
              Sign out
            </button>
          ) : (
            <button disabled={busy || waiting} onClick={onSignin}>
              {busy || waiting ? "Waiting for App…" : "Sign in"}
            </button>
          )}
        </div>
      </div>

      {auth?.pairingCode && waiting ? (
        <div className="pairing">
          <div className="pairing-code">{auth.pairingCode}</div>
          <p className="sub">
            Pairing code — it must match the Binance Wallet App. Confirm in the App, then wait
            here (do not close this page).
          </p>
          {auth.urlForWeb ? (
            <p className="sub">
              If the browser did not open:{" "}
              <a href={auth.urlForWeb} target="_blank" rel="noreferrer">
                Open Binance agent login
              </a>
            </p>
          ) : null}
        </div>
      ) : null}

      {phase === "failed" && auth?.error ? (
        <p className="sub signin-error">
          {auth.error}
          {auth.installHint ? (
            <>
              {" "}
              Install: <code>{auth.installHint}</code>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
