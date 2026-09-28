import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { humanize } from "../lib/format";

export function PageHeader({
  title,
  back,
  actions,
}: {
  title: string;
  back?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {back && (
          <Link className="page-header__back" to={back}>
            ← Back
          </Link>
        )}
        <h1>{title}</h1>
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  );
}

export function Message({
  type = "info",
  children,
}: {
  type?: "info" | "error" | "success";
  children: ReactNode;
}) {
  return <p className={`alert alert--${type}`}>{children}</p>;
}

export function Loading() {
  return <p className="muted">Loading…</p>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

const STATUS_TONES: Record<string, string> = {
  confirmed: "good",
  completed: "good",
  passed: "good",
  competent: "good",
  new: "warn",
  requested: "warn",
  pending: "warn",
  booked: "info",
  practising: "info",
  introduced: "info",
  test_ready: "good",
  cancelled: "muted",
  no_show: "bad",
  failed: "bad",
  rejected: "bad",
  absent: "bad",
};

export function Status({ value }: { value: unknown }) {
  const key = String(value ?? "");
  if (!key) return null;
  return <span className={`status status--${STATUS_TONES[key] ?? "muted"}`}>{humanize(key)}</span>;
}

/** A button that asks for a second tap before running a destructive action. */
export function ConfirmButton(props: {
  label: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void> | void;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={`button ${armed ? "button--danger" : "button--ghost"} ${props.className ?? ""}`}
      disabled={busy}
      onBlur={() => setArmed(false)}
      onClick={async () => {
        if (!armed) return setArmed(true);
        setBusy(true);
        try {
          await props.onConfirm();
        } finally {
          setBusy(false);
          setArmed(false);
        }
      }}
    >
      {armed ? (props.confirmLabel ?? "Tap again to confirm") : props.label}
    </button>
  );
}
