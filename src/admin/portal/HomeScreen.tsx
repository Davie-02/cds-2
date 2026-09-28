import { Link } from "react-router-dom";
import { Loading, Message, Status } from "../components/ui";
import { api } from "../lib/api";
import { formatDateTime, formatMoney } from "../lib/format";
import { useLoad } from "../lib/useLoad";
import type { Lesson, Overview } from "./types";

export function HomeScreen() {
  const overview = useLoad(() => api.get<Overview>("/api/portal/overview"), []);
  const lessons = useLoad(() => api.get<Lesson[]>("/api/portal/lessons"), []);
  if (overview.loading && !overview.data) return <Loading />;
  if (overview.error || !overview.data) return <Message type="error">{overview.error}</Message>;
  const { student, readiness, balance, currency } = overview.data;
  const upcoming = (lessons.data ?? [])
    .filter(
      (lesson) =>
        ["requested", "confirmed"].includes(lesson.status) &&
        new Date(lesson.starts_at) > new Date(),
    )
    .reverse();

  return (
    <>
      <h1>Hello, {student.full_name.split(" ")[0]}</h1>
      <p className="muted">
        {student.course_name ?? "No course yet"}
        {student.instructor_name && ` · Instructor: ${student.instructor_name}`}
      </p>
      <section className="panel">
        <h2>Next lessons</h2>
        {upcoming.length ? (
          <ul className="agenda">
            {upcoming.slice(0, 3).map((lesson) => (
              <li key={lesson.id}>
                <span>
                  <strong>{formatDateTime(lesson.starts_at)}</strong> with {lesson.instructor_name}
                </span>
                <Status value={lesson.status} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No lessons booked.</p>
        )}
        <Link className="button button--primary" to="/book">
          Book a lesson
        </Link>
      </section>
      <section className="panel">
        <h2>{readiness.ready ? "You're ready for your test" : "Your progress"}</h2>
        <ul className="checklist">
          {readiness.checks.map((check) => (
            <li key={check.label} className={check.done ? "checklist__done" : ""}>
              <span aria-hidden="true">{check.done ? "✓" : "○"}</span> {check.label}
              <span className="muted"> — {check.detail}</span>
            </li>
          ))}
        </ul>
      </section>
      {balance && (
        <section className="panel">
          <h2>Fees</h2>
          <p>
            Balance: <strong>{formatMoney(balance.balance, currency)}</strong>
          </p>
          <Link className="button button--ghost" to="/payments">
            Payments
          </Link>
        </section>
      )}
    </>
  );
}
