import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Empty, Loading, Message, Status } from "../components/ui";
import { api } from "../lib/api";
import { formatDateTime, humanize, isoDate } from "../lib/format";
import { useLoad } from "../lib/useLoad";
import type { Lesson, Overview } from "./types";

interface Slot {
  starts_at: string;
  time: string;
}

export function BookScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const rescheduling = params.get("reschedule");
  const overview = useLoad(() => api.get<Overview>("/api/portal/overview"), []);
  const instructors = useLoad(
    () => api.get<{ id: string; name: string }[]>("/api/portal/instructors"),
    [],
  );
  const [instructorId, setInstructorId] = useState("");
  const [date, setDate] = useState(isoDate(new Date(Date.now() + 86_400_000)));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!instructorId && instructors.data?.[0]) setInstructorId(instructors.data[0].id);
  }, [instructors.data, instructorId]);

  const slots = useLoad(
    () =>
      instructorId
        ? api.get<Slot[]>(`/api/portal/slots?instructor_id=${instructorId}&date=${date}`)
        : Promise.resolve([]),
    [instructorId, date],
  );

  if (overview.loading && !overview.data) return <Loading />;
  const rules = overview.data?.rules;
  if (rules && !rules.self_booking_enabled) {
    return (
      <Message>
        Online booking is currently switched off. Please call the office on{" "}
        {overview.data?.contact.phone}.
      </Message>
    );
  }

  async function book(slot: Slot) {
    setError(null);
    try {
      if (rescheduling)
        await api.post(`/api/portal/lessons/${rescheduling}/reschedule`, {
          starts_at: slot.starts_at,
        });
      else
        await api.post("/api/portal/lessons", {
          instructor_id: instructorId,
          starts_at: slot.starts_at,
        });
      navigate("/lessons");
    } catch (err) {
      setError((err as Error).message);
      slots.reload();
    }
  }

  const maxDate = isoDate(new Date(Date.now() + (rules?.booking_horizon_days ?? 30) * 86_400_000));

  return (
    <>
      <h1>{rescheduling ? "Choose a new time" : "Book a lesson"}</h1>
      {rules && (
        <p className="muted">
          Up to {rules.max_lessons_per_day} lesson(s) a day. You can cancel or move a lesson up to{" "}
          {rules.cancellation_hours} hours before it starts.
        </p>
      )}
      {error && <Message type="error">{error}</Message>}
      <div className="field">
        <label htmlFor="instructor">Instructor</label>
        <select
          id="instructor"
          value={instructorId}
          onChange={(e) => setInstructorId(e.target.value)}
          disabled={Boolean(rescheduling)}
        >
          {instructors.data?.map((instructor) => (
            <option key={instructor.id} value={instructor.id}>
              {instructor.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="date">Day</label>
        <input
          id="date"
          type="date"
          value={date}
          min={isoDate(new Date())}
          max={maxDate}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>
      {slots.loading ? (
        <Loading />
      ) : slots.data?.length ? (
        <div className="slots">
          {slots.data.map((slot) => (
            <button
              key={slot.starts_at}
              className="button button--ghost"
              onClick={() => book(slot)}
            >
              {slot.time}
            </button>
          ))}
        </div>
      ) : (
        <Empty>No free times on this day. Try another day or instructor.</Empty>
      )}
    </>
  );
}

export function LessonsScreen() {
  const navigate = useNavigate();
  const lessons = useLoad(() => api.get<Lesson[]>("/api/portal/lessons"), []);
  const [error, setError] = useState<string | null>(null);
  const now = new Date();

  async function cancel(lesson: Lesson) {
    setError(null);
    try {
      await api.post(`/api/portal/lessons/${lesson.id}/cancel`);
      lessons.reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (lessons.loading && !lessons.data) return <Loading />;
  const all = lessons.data ?? [];
  const upcoming = all
    .filter((l) => new Date(l.starts_at) > now && ["requested", "confirmed"].includes(l.status))
    .reverse();
  const past = all.filter((l) => !upcoming.includes(l));

  return (
    <>
      <h1>My lessons</h1>
      {error && <Message type="error">{error}</Message>}
      <h2>Upcoming</h2>
      {upcoming.length ? (
        <ul className="agenda">
          {upcoming.map((lesson) => (
            <li key={lesson.id}>
              <span>
                <strong>{formatDateTime(lesson.starts_at)}</strong> with {lesson.instructor_name}
                {lesson.vehicle_plate && (
                  <span className="muted">
                    {" "}
                    ·{" "}
                    {[lesson.vehicle_make, lesson.vehicle_model, lesson.vehicle_plate]
                      .filter(Boolean)
                      .join(" ")}
                  </span>
                )}
                <Status value={lesson.status} />
              </span>
              <span className="agenda__actions">
                <button
                  className="button button--ghost"
                  onClick={() => navigate(`/book?reschedule=${lesson.id}`)}
                >
                  Move
                </button>
                <button className="button button--ghost" onClick={() => cancel(lesson)}>
                  Cancel
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No upcoming lessons.</Empty>
      )}
      <h2>History</h2>
      {past.length ? (
        <ul className="agenda">
          {past.map((lesson) => (
            <li key={lesson.id}>
              <span>
                <strong>{formatDateTime(lesson.starts_at)}</strong> {humanize(lesson.kind)} with{" "}
                {lesson.instructor_name}
                {lesson.lesson_notes && <span className="note">{lesson.lesson_notes}</span>}
              </span>
              <Status value={lesson.status} />
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No past lessons.</Empty>
      )}
    </>
  );
}
