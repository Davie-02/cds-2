import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { documentLabel, getResource } from "../../shared/resources";
import { FieldsForm } from "../components/FieldInput";
import { Empty, Loading, Message, PageHeader, Status } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatDate, formatDateTime, formatMoney, humanize } from "../lib/format";
import { useLoad } from "../lib/useLoad";
import { ResourceEditor } from "./ResourceScreens";

type Row = Record<string, any>;

interface Profile {
  student: Row;
  skills: { id: string; name: string; category: string | null; level: string }[];
  lessons: Row[];
  documents: Row[];
  notes: Row[];
  tests: Row[];
  attempts: Row[];
  readiness: { ready: boolean; checks: { label: string; done: boolean; detail: string }[] };
  finance: { balance: Row | null; invoices: Row[]; payments: Row[] } | null;
  portal_account: { email: string; active: boolean } | null;
}

const LEVELS = ["not_started", "introduced", "practising", "competent"];
const TABS = [
  "overview",
  "lessons",
  "skills",
  "documents",
  "notes",
  "tests",
  "payments",
  "details",
] as const;
type Tab = (typeof TABS)[number];

export function NewStudentScreen() {
  const navigate = useNavigate();
  return (
    <ResourceEditor
      def={getResource("students")!}
      id={null}
      backTo="/students"
      onSaved={(row) => navigate(`/students/${row.id}`, { replace: true })}
    />
  );
}

export function StudentScreen() {
  const { id } = useParams();
  const { can } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const profile = useLoad(() => api.get<Profile>(`/api/admin/students/${id}/profile`), [id]);

  if (profile.loading && !profile.data) return <Loading />;
  if (profile.error || !profile.data)
    return <Message type="error">{profile.error ?? "Student not found"}</Message>;
  const data = profile.data;
  const student = data.student;
  const tabs = TABS.filter((t) =>
    t === "payments" ? data.finance : t === "details" ? can("students.manage") : true,
  );
  const add = (resource: string) =>
    `/r/${resource}/new?student_id=${id}&back=${encodeURIComponent(`/students/${id}`)}`;

  return (
    <>
      <PageHeader
        title={student.full_name}
        back="/students"
        actions={
          can("bookings.manage") && (
            <Link className="button button--primary" to={add("bookings")}>
              Book lesson
            </Link>
          )
        }
      />
      <p className="muted">
        <a href={`tel:${student.phone}`}>{student.phone}</a> · <Status value={student.status} />
      </p>
      <div className="tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={tab === t ? "tab tab--active" : "tab"}
            onClick={() => setTab(t)}
          >
            {humanize(t)}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <section className="panel">
          <h2>{data.readiness.ready ? "Ready for the test" : "Test readiness"}</h2>
          <ul className="checklist">
            {data.readiness.checks.map((check) => (
              <li key={check.label} className={check.done ? "checklist__done" : ""}>
                <span aria-hidden="true">{check.done ? "✓" : "○"}</span> {check.label}
                <span className="muted"> — {check.detail}</span>
              </li>
            ))}
          </ul>
          {data.readiness.ready && student.status === "active" && can("students.manage") && (
            <button
              className="button button--primary"
              onClick={async () => {
                await api.patch(`/api/admin/r/students/${id}`, { status: "test_ready" });
                profile.reload();
              }}
            >
              Mark as test-ready
            </button>
          )}
        </section>
      )}

      {tab === "lessons" && (
        <List rows={data.lessons} empty="No lessons yet.">
          {(lesson) => (
            <Link to={`/r/bookings/${lesson.id}?back=/students/${id}`}>
              <strong>{formatDateTime(lesson.starts_at)}</strong> {lesson.instructor_name}
              {lesson.vehicle_plate && <span className="muted"> · {lesson.vehicle_plate}</span>}
              {lesson.lesson_notes && <span className="note">{lesson.lesson_notes}</span>}
              <Status value={lesson.status} />
            </Link>
          )}
        </List>
      )}

      {tab === "skills" && (
        <Skills
          studentId={id!}
          skills={data.skills}
          editable={can("students.notes", "students.manage")}
          onChange={profile.reload}
        />
      )}

      {tab === "documents" && (
        <>
          {can("students.manage") && (
            <Link className="button button--ghost" to={add("student_documents")}>
              Add document
            </Link>
          )}
          <List rows={data.documents} empty="No documents uploaded.">
            {(doc) => (
              <Link to={`/r/student_documents/${doc.id}?back=/students/${id}`}>
                <strong>{documentLabel(doc.kind)}</strong>
                {doc.expires_on && (
                  <span className="muted"> · expires {formatDate(doc.expires_on)}</span>
                )}
                <Status value={doc.verified ? "confirmed" : "pending"} />
              </Link>
            )}
          </List>
        </>
      )}

      {tab === "notes" && (
        <Notes
          studentId={id!}
          notes={data.notes}
          canWrite={can("students.notes", "students.manage")}
          onChange={profile.reload}
        />
      )}

      {tab === "tests" && (
        <>
          {can("tests.manage") && (
            <Link className="button button--ghost" to={add("official_tests")}>
              Book official test
            </Link>
          )}
          <h2>Official tests</h2>
          <List rows={data.tests} empty="No tests booked.">
            {(test) => (
              <Link to={`/r/official_tests/${test.id}?back=/students/${id}`}>
                <strong>{humanize(test.kind)} test</strong> {formatDateTime(test.scheduled_at)}
                <Status value={test.result} />
              </Link>
            )}
          </List>
          <h2>Theory practice</h2>
          <List rows={data.attempts} empty="No practice tests taken.">
            {(attempt) => (
              <span>
                <strong>{attempt.test_name}</strong> {attempt.score}/{attempt.total}{" "}
                <span className="muted">{formatDateTime(attempt.submitted_at)}</span>
                <Status value={attempt.passed ? "passed" : "failed"} />
              </span>
            )}
          </List>
        </>
      )}

      {tab === "payments" && data.finance && (
        <>
          <div className="stats">
            <div className="stat">
              <strong>{formatMoney(data.finance.balance?.balance ?? 0)}</strong>
              <span>Balance</span>
            </div>
            <div className="stat">
              <strong>{formatMoney(data.finance.balance?.paid ?? 0)}</strong>
              <span>Paid</span>
            </div>
          </div>
          {can("finance.manage") && (
            <div className="button-row">
              <Link className="button button--ghost" to={add("invoices")}>
                New invoice
              </Link>
              <Link className="button button--ghost" to={add("payments")}>
                Record payment
              </Link>
            </div>
          )}
          <h2>Invoices</h2>
          <List rows={data.finance.invoices} empty="No invoices.">
            {(invoice) => (
              <Link to={`/r/invoices/${invoice.id}?back=/students/${id}`}>
                <strong>{invoice.number}</strong> {formatDate(invoice.issued_on)}{" "}
                <span>{formatMoney(invoice.total)}</span>
              </Link>
            )}
          </List>
          <h2>Payments</h2>
          <List rows={data.finance.payments} empty="No payments.">
            {(payment) => (
              <Link to={`/r/payments/${payment.id}?back=/students/${id}`}>
                <strong>{formatMoney(payment.amount)}</strong> {formatDate(payment.paid_on)} ·{" "}
                {humanize(payment.method)}
                <Status value={payment.status} />
              </Link>
            )}
          </List>
        </>
      )}

      {tab === "details" && (
        <>
          <ResourceEditor
            def={getResource("students")!}
            id={id!}
            backTo="/students"
            onSaved={profile.reload}
          />
          <PortalAccess
            studentId={id!}
            account={data.portal_account}
            defaultEmail={student.email}
            onChange={profile.reload}
          />
        </>
      )}
    </>
  );
}

function List({
  rows,
  empty,
  children,
}: {
  rows: Row[];
  empty: string;
  children: (row: Row) => React.ReactNode;
}) {
  if (!rows.length) return <Empty>{empty}</Empty>;
  return (
    <ul className="agenda">
      {rows.map((row) => (
        <li key={row.id}>{children(row)}</li>
      ))}
    </ul>
  );
}

function Skills({
  studentId,
  skills,
  editable,
  onChange,
}: {
  studentId: string;
  skills: Profile["skills"];
  editable: boolean;
  onChange: () => void;
}) {
  if (!skills.length)
    return (
      <Empty>
        No skills set up for this licence class. Add them under School → Skills checklist.
      </Empty>
    );
  const groups = [...new Set(skills.map((skill) => skill.category ?? "Other"))];

  async function set(skillId: string, level: string) {
    await api.put(`/api/admin/students/${studentId}/skills/${skillId}`, { level });
    onChange();
  }

  return (
    <>
      {groups.map((group) => (
        <section key={group} className="panel">
          <h2>{group}</h2>
          <ul className="skills">
            {skills
              .filter((skill) => (skill.category ?? "Other") === group)
              .map((skill) => (
                <li key={skill.id}>
                  <span>{skill.name}</span>
                  {editable ? (
                    <select
                      value={skill.level}
                      onChange={(e) => set(skill.id, e.target.value)}
                      aria-label={skill.name}
                    >
                      {LEVELS.map((level) => (
                        <option key={level} value={level}>
                          {humanize(level)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Status value={skill.level} />
                  )}
                </li>
              ))}
          </ul>
        </section>
      ))}
    </>
  );
}

function Notes({
  studentId,
  notes,
  canWrite,
  onChange,
}: {
  studentId: string;
  notes: Row[];
  canWrite: boolean;
  onChange: () => void;
}) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    try {
      await api.post("/api/admin/r/student_notes", { student_id: studentId, body });
      setBody("");
      onChange();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <>
      {canWrite && (
        <form className="panel" onSubmit={add}>
          <label className="field">
            <span>Add a note</span>
            <textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} required />
          </label>
          <button className="button button--primary">Save note</button>
          {error && <Message type="error">{error}</Message>}
        </form>
      )}
      <List rows={notes} empty="No notes yet.">
        {(note) => (
          <span>
            <span className="note">{note.body}</span>
            <span className="muted">
              {note.author_name} · {formatDateTime(note.created_at)}
            </span>
          </span>
        )}
      </List>
    </>
  );
}

const PORTAL_FIELDS = [
  { name: "email", label: "Login email", type: "email" as const, required: true },
  { name: "password", label: "New password (at least 10 characters)", type: "password" as const },
  { name: "active", label: "Can sign in to the student portal", type: "boolean" as const },
];

function PortalAccess(props: {
  studentId: string;
  account: Profile["portal_account"];
  defaultEmail: string | null;
  onChange: () => void;
}) {
  const [values, setValues] = useState<Record<string, unknown>>({
    email: props.account?.email ?? props.defaultEmail ?? "",
    password: "",
    active: props.account?.active ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});
    try {
      await api.put(`/api/admin/students/${props.studentId}/portal-access`, {
        ...values,
        password: values.password || undefined,
      });
      setMessage("Portal login saved. Share the email and password with the student.");
      setValues({ ...values, password: "" });
      props.onChange();
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields);
      setMessage((err as Error).message);
    }
  }

  return (
    <form className="panel" onSubmit={save}>
      <h2>Student portal login</h2>
      <p className="muted">
        {props.account
          ? `Login ${props.account.active ? "enabled" : "disabled"} for ${props.account.email}.`
          : "No login yet."}{" "}
        Students can book lessons, take practice tests, and upload documents and payment proofs.
      </p>
      {message && <Message>{message}</Message>}
      <FieldsForm fields={PORTAL_FIELDS} values={values} onChange={setValues} errors={errors} />
      <button className="button button--primary">Save login</button>
    </form>
  );
}
