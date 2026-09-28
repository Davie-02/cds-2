import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { Option } from "../../shared/fields";
import { loadOptions } from "../components/FieldInput";
import { Empty, Loading, Message, PageHeader, Status } from "../components/ui";
import { api, queryString } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatTime, humanize, isoDate } from "../lib/format";
import { useLoad } from "../lib/useLoad";

interface Lesson {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  kind: string;
  instructor_id: string;
  student_id: string;
  student_name: string;
  student_phone: string;
  instructor_name: string;
  vehicle_plate: string | null;
  lesson_notes: string | null;
}

const DAY = 86_400_000;

function startOfWeek(date: Date): Date {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (day.getDay() + 6) % 7;
  return new Date(day.getTime() - offset * DAY);
}

export function CalendarScreen() {
  const { can, me } = useAuth();
  const [params, setParams] = useSearchParams();
  const anchor = params.get("week") ? new Date(`${params.get("week")}T00:00:00`) : new Date();
  const weekStart = startOfWeek(anchor);
  const days = Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * DAY));
  const instructorId = params.get("instructor") ?? "";
  const vehicleId = params.get("vehicle") ?? "";
  const [instructors, setInstructors] = useState<Option[]>([]);
  const [vehicles, setVehicles] = useState<Option[]>([]);
  const canManage = can("bookings.manage");

  useEffect(() => {
    if (can("bookings.view", "bookings.manage")) {
      loadOptions("instructors").then(setInstructors);
      loadOptions("vehicles").then(setVehicles);
    }
  }, [can]);

  const lessons = useLoad(
    () =>
      api.get<Lesson[]>(
        `/api/admin/calendar${queryString({
          from: weekStart.toISOString(),
          to: new Date(weekStart.getTime() + 7 * DAY).toISOString(),
          instructor_id: instructorId,
          vehicle_id: vehicleId,
        })}`,
      ),
    [weekStart.getTime(), instructorId, vehicleId],
  );

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };
  const shiftWeek = (weeks: number) =>
    setParam("week", isoDate(new Date(weekStart.getTime() + weeks * 7 * DAY)));
  const today = isoDate(new Date());

  return (
    <>
      <PageHeader
        title="Lesson calendar"
        actions={
          canManage && (
            <Link className="button button--primary" to="/r/bookings/new?back=/calendar">
              Book a lesson
            </Link>
          )
        }
      />
      <div className="toolbar">
        <button
          className="button button--ghost"
          onClick={() => shiftWeek(-1)}
          aria-label="Previous week"
        >
          ←
        </button>
        <strong className="toolbar__label">
          {weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} –{" "}
          {days[6]!.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </strong>
        <button
          className="button button--ghost"
          onClick={() => shiftWeek(1)}
          aria-label="Next week"
        >
          →
        </button>
        <button className="button button--ghost" onClick={() => setParam("week", "")}>
          This week
        </button>
        {instructors.length > 0 && (
          <select
            value={instructorId}
            onChange={(e) => setParam("instructor", e.target.value)}
            aria-label="Instructor"
          >
            <option value="">All instructors</option>
            {instructors.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        )}
        {vehicles.length > 0 && (
          <select
            value={vehicleId}
            onChange={(e) => setParam("vehicle", e.target.value)}
            aria-label="Vehicle"
          >
            <option value="">All vehicles</option>
            {vehicles.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        )}
      </div>
      {lessons.error && <Message type="error">{lessons.error}</Message>}
      {lessons.loading && !lessons.data ? (
        <Loading />
      ) : (
        <div className="week">
          {days.map((day) => {
            const key = isoDate(day);
            const dayLessons = (lessons.data ?? []).filter(
              (lesson) => isoDate(new Date(lesson.starts_at)) === key,
            );
            return (
              <section key={key} className={`week__day${key === today ? " week__day--today" : ""}`}>
                <h2>
                  {day.toLocaleDateString("en-GB", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                </h2>
                {dayLessons.length ? (
                  dayLessons.map((lesson) => (
                    <LessonCard
                      key={lesson.id}
                      lesson={lesson}
                      canManage={canManage}
                      isOwn={lesson.instructor_id === me.instructor_id}
                      onChanged={lessons.reload}
                    />
                  ))
                ) : (
                  <Empty>No lessons</Empty>
                )}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

function LessonCard({
  lesson,
  canManage,
  isOwn,
  onChanged,
}: {
  lesson: Lesson;
  canManage: boolean;
  isOwn: boolean;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(lesson.lesson_notes ?? "");
  const [error, setError] = useState<string | null>(null);

  async function record(status?: string) {
    setError(null);
    try {
      await api.post(`/api/admin/bookings/${lesson.id}/outcome`, { status, lesson_notes: notes });
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <article className={`lesson lesson--${lesson.status}`}>
      <button
        type="button"
        className="lesson__summary"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <strong>
          {formatTime(lesson.starts_at)}–{formatTime(lesson.ends_at)}
        </strong>
        <span>{lesson.student_name}</span>
        <span className="muted">
          {lesson.instructor_name}
          {lesson.vehicle_plate && ` · ${lesson.vehicle_plate}`}
          {lesson.kind !== "practical" && ` · ${humanize(lesson.kind)}`}
        </span>
        <Status value={lesson.status} />
      </button>
      {open && (
        <div className="lesson__details">
          <a href={`tel:${lesson.student_phone}`}>{lesson.student_phone}</a>
          {(isOwn || canManage) && (
            <>
              <label className="field">
                <span>Lesson notes</span>
                <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </label>
              <div className="lesson__actions">
                <button className="button button--primary" onClick={() => record("completed")}>
                  Completed
                </button>
                <button className="button button--ghost" onClick={() => record("no_show")}>
                  No-show
                </button>
                <button className="button button--ghost" onClick={() => record()}>
                  Save notes
                </button>
              </div>
            </>
          )}
          <div className="lesson__actions">
            <Link className="button button--ghost" to={`/students/${lesson.student_id}`}>
              Student
            </Link>
            {canManage && (
              <Link className="button button--ghost" to={`/r/bookings/${lesson.id}?back=/calendar`}>
                Reschedule or cancel
              </Link>
            )}
          </div>
          {error && <Message type="error">{error}</Message>}
        </div>
      )}
    </article>
  );
}
