import { Link } from "react-router-dom";
import { Empty, Loading, Message, PageHeader, Status } from "../components/ui";
import { api } from "../lib/api";
import { formatDate, formatDateTime, formatMoney } from "../lib/format";
import { useLoad } from "../lib/useLoad";

interface Balance {
  student_id: string;
  full_name: string;
  phone: string;
  invoiced: number;
  paid: number;
  pending: number;
  balance: number;
  next_due_on: string | null;
}

export function BalancesScreen() {
  const balances = useLoad(() => api.get<Balance[]>("/api/admin/finance/balances"), []);
  if (balances.loading && !balances.data) return <Loading />;
  if (balances.error) return <Message type="error">{balances.error}</Message>;
  const owing = (balances.data ?? []).filter((row) => row.balance > 0);
  const total = owing.reduce((sum, row) => sum + row.balance, 0);

  return (
    <>
      <PageHeader title="Balances" />
      <div className="stats">
        <div className="stat">
          <strong>{formatMoney(total)}</strong>
          <span>Outstanding across {owing.length} students</span>
        </div>
      </div>
      {balances.data?.length ? (
        <ul className="agenda">
          {balances.data.map((row) => (
            <li key={row.student_id}>
              <Link to={`/students/${row.student_id}`}>
                <strong>{row.full_name}</strong>
                <span className="muted">
                  {" "}
                  Invoiced {formatMoney(row.invoiced)} · Paid {formatMoney(row.paid)}
                  {row.pending > 0 && ` · ${formatMoney(row.pending)} awaiting check`}
                  {row.next_due_on && ` · first due ${formatDate(row.next_due_on)}`}
                </span>
              </Link>
              <span className={`status status--${row.balance > 0 ? "bad" : "good"}`}>
                {formatMoney(row.balance)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No invoices yet.</Empty>
      )}
    </>
  );
}

interface Result {
  id: string;
  score: number;
  total: number;
  passed: boolean;
  submitted_at: string;
  test_name: string;
  student_id: string;
  full_name: string;
}

export function TheoryResultsScreen() {
  const results = useLoad(() => api.get<Result[]>("/api/admin/theory/results"), []);
  if (results.loading && !results.data) return <Loading />;
  if (results.error) return <Message type="error">{results.error}</Message>;
  return (
    <>
      <PageHeader title="Theory results" />
      {results.data?.length ? (
        <ul className="agenda">
          {results.data.map((row) => (
            <li key={row.id}>
              <Link to={`/students/${row.student_id}`}>
                <strong>{row.full_name}</strong> {row.test_name}
                <span className="muted">
                  {" "}
                  {row.score}/{row.total} · {formatDateTime(row.submitted_at)}
                </span>
              </Link>
              <Status value={row.passed ? "passed" : "failed"} />
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No tests taken yet.</Empty>
      )}
    </>
  );
}
