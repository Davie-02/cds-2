import { Link } from "react-router-dom";
import { Empty, Loading, Message, PageHeader, Status } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatDate, formatDateTime, formatMoney, formatTime, humanize } from "../lib/format";
import { useLoad } from "../lib/useLoad";

interface Dashboard {
  today: string;
  lessons: {
    id: string;
    starts_at: string;
    status: string;
    student_name: string;
    instructor_name: string;
    vehicle_plate: string | null;
  }[];
  requests: { id: string; starts_at: string; student_name: string; instructor_name: string }[];
  reminders: {
    kind: string;
    subject: string;
    detail: string;
    due_on: string;
    overdue: boolean;
    link: string;
  }[];
  new_enquiries: number | null;
  active_students: number | null;
  finance: {
    outstanding: number;
    pending_payments: number;
    overdue: { invoice_id: string; number: string; full_name: string; overdue: number }[];
  } | null;
  pass_rates:
    { kind: string; instructor: string; passed: number; sat: number; rate: number | null }[] | null;
}

export function DashboardScreen() {
  const { me } = useAuth();
  const { data, error, loading, reload } = useLoad(
    () => api.get<Dashboard>("/api/admin/dashboard"),
    [],
  );

  if (loading && !data) return <Loading />;
  if (error || !data)
    return <Message type="error">{error ?? "Could not load the dashboard"}</Message>;

  async function confirm(id: string, status: "confirmed" | "cancelled") {
    await api.patch(`/api/admin/r/bookings/${id}`, { status });
    reload();
  }

  const overall = data.pass_rates?.filter((row) => row.instructor === "All instructors") ?? [];

  return (
    <>
      <PageHeader title={`Hello, ${me.name.split(" ")[0]}`} />
      <div className="stats">
        {data.active_students !== null && (
          <Stat label="Active students" value={data.active_students} to="/students" />
        )}
        {data.new_enquiries !== null && (
          <Stat
            label="New enquiries"
            value={data.new_enquiries}
            to="/r/enquiries?filter.status=new"
          />
        )}
        {data.finance && (
          <Stat
            label="Outstanding fees"
            value={formatMoney(data.finance.outstanding)}
            to="/finance/balances"
          />
        )}
        {data.finance && (
          <Stat
            label="Payments to check"
            value={data.finance.pending_payments}
            to="/r/payments?filter.status=pending"
          />
        )}
        {overall.map((row) => (
          <Stat
            key={row.kind}
            label={`${humanize(row.kind)} test pass rate`}
            value={row.rate === null ? "—" : `${row.rate}%`}
          />
        ))}
      </div>

      <section className="panel">
        <h2>Today's lessons</h2>
        {data.lessons.length ? (
          <ul className="agenda">
            {data.lessons.map((lesson) => (
              <li key={lesson.id}>
                <Link to={`/r/bookings/${lesson.id}?back=/`}>
                  <strong>{formatTime(lesson.starts_at)}</strong> {lesson.student_name}
                  <span className="muted">
                    {" "}
                    with {lesson.instructor_name}
                    {lesson.vehicle_plate && ` · ${lesson.vehicle_plate}`}
                  </span>
                </Link>
                <Status value={lesson.status} />
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No lessons today.</Empty>
        )}
      </section>

      {data.requests.length > 0 && (
        <section className="panel">
          <h2>Lesson requests to confirm</h2>
          <ul className="agenda">
            {data.requests.map((request) => (
              <li key={request.id}>
                <span>
                  <strong>{formatDateTime(request.starts_at)}</strong> {request.student_name}
                  <span className="muted"> with {request.instructor_name}</span>
                </span>
                <span className="agenda__actions">
                  <button
                    className="button button--primary"
                    onClick={() => confirm(request.id, "confirmed")}
                  >
                    Confirm
                  </button>
                  <button
                    className="button button--ghost"
                    onClick={() => confirm(request.id, "cancelled")}
                  >
                    Decline
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.reminders.length > 0 && (
        <section className="panel">
          <h2>Reminders</h2>
          <ul className="agenda">
            {data.reminders.map((reminder, index) => (
              <li key={index}>
                <Link to={reminder.link}>
                  <strong>{reminder.detail}</strong> {reminder.subject}
                </Link>
                <span className={`status status--${reminder.overdue ? "bad" : "warn"}`}>
                  {reminder.overdue ? "Overdue " : ""}
                  {formatDate(reminder.due_on)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.finance && data.finance.overdue.length > 0 && (
        <section className="panel">
          <h2>Overdue instalments</h2>
          <ul className="agenda">
            {data.finance.overdue.map((row) => (
              <li key={row.invoice_id}>
                <Link to={`/r/invoices/${row.invoice_id}?back=/`}>
                  {row.full_name} <span className="muted">{row.number}</span>
                </Link>
                <span className="status status--bad">{formatMoney(row.overdue)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function Stat({ label, value, to }: { label: string; value: string | number; to?: string }) {
  const body = (
    <>
      <strong>{value}</strong>
      <span>{label}</span>
    </>
  );
  return to ? (
    <Link className="stat" to={to}>
      {body}
    </Link>
  ) : (
    <div className="stat">{body}</div>
  );
}
