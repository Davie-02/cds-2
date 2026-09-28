import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Permission, Role } from "../../shared/permissions";
import { api, ApiError } from "./api";

export interface Me {
  id: string;
  name: string;
  email: string;
  role: Role;
  permissions: Permission[];
  instructor_id: string | null;
  student_id: string | null;
}

interface AuthState {
  me: Me;
  can: (...anyOf: Permission[]) => boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const state = useContext(AuthContext);
  if (!state) throw new Error("useAuth must be used inside AuthGate");
  return state;
}

/** Shows the sign-in form until a session exists, then renders the app for that user. */
export function AuthGate({
  audience,
  children,
}: {
  audience: "staff" | "student";
  children: ReactNode;
}) {
  const [me, setMe] = useState<Me | null | undefined>(undefined);

  const refresh = useCallback(() => {
    api
      .get<Me>("/api/auth/me")
      .then(setMe)
      .catch(() => setMe(null));
  }, []);
  useEffect(refresh, [refresh]);

  const signOut = useCallback(async () => {
    await api.post("/api/auth/logout");
    setMe(null);
  }, []);

  if (me === undefined) return <p className="page-loading">Loading…</p>;
  if (!me) return <SignIn audience={audience} onSignedIn={refresh} />;

  const wrongArea = audience === "student" ? me.role !== "student" : me.role === "student";
  if (wrongArea) {
    const target = me.role === "student" ? "/portal" : "/admin";
    return (
      <div className="sign-in">
        <div className="sign-in__card">
          <p>You are signed in as {me.name}. Your account uses a different area.</p>
          <a className="button" href={target}>
            Go to {me.role === "student" ? "the student portal" : "the admin"}
          </a>
          <button className="button button--ghost" onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  const permissions = new Set(me.permissions);
  const can = (...anyOf: Permission[]) => anyOf.some((permission) => permissions.has(permission));
  return <AuthContext.Provider value={{ me, can, signOut }}>{children}</AuthContext.Provider>;
}

function SignIn({
  audience,
  onSignedIn,
}: {
  audience: "staff" | "student";
  onSignedIn: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/auth/login", { email, password });
      onSignedIn();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sign-in">
      <form className="sign-in__card" onSubmit={submit}>
        <img src="/images/logo.png" alt="" className="sign-in__logo" />
        <h1>{audience === "student" ? "Student portal" : "Staff sign in"}</h1>
        {error && <p className="alert alert--error">{error}</p>}
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <button className="button button--primary button--block" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="muted">Forgotten your password? Ask the office to reset it.</p>
      </form>
    </div>
  );
}
