import { useEffect, useRef, useState } from "react";
import { Bell } from "../brand/Bell";
import { checkLogin } from "../auth";
import "../styles/login.css";

/*
 * The sign-in card — a soft dev gate on a dim scrim, in the same register as
 * the welcome card. It's not real security (there's no backend), just a way to
 * keep casual visitors out of a dev build; a valid dev login drops straight
 * into the app. Dismissed with the backdrop or Escape.
 */
export function Login({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const userRef = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    userRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(false);
    const ok = await checkLogin(user, pass);
    if (ok) {
      onSuccess();
    } else {
      setError(true);
      setPass("");
      setBusy(false);
    }
  }

  return (
    <div className="login-scrim" onClick={onClose}>
      <section
        className="login-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="login-mark">
          <Bell size={30} tone="brass" />
          <span className="login-word">Bramwell</span>
        </div>

        <h1 id="login-title" className="login-title">
          Welcome back.
        </h1>
        <p className="login-intro">Sign in to pick up where you left off.</p>

        <form className="login-form" onSubmit={submit}>
          <label className="login-field">
            <span>Username</span>
            <input
              ref={userRef}
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={user}
              onChange={(e) => {
                setUser(e.target.value);
                setError(false);
              }}
            />
          </label>
          <label className="login-field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={pass}
              onChange={(e) => {
                setPass(e.target.value);
                setError(false);
              }}
            />
          </label>

          {error ? (
            <p className="login-error" role="alert">
              Those credentials don't match. Do try again.
            </p>
          ) : null}

          <button type="submit" className="btn login-submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="login-note">
          A private dev build. No account yet? The demo is free — just{" "}
          <button type="button" className="login-linkbtn" onClick={onClose}>
            step inside
          </button>
          .
        </p>
      </section>
    </div>
  );
}
