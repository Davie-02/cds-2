import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Empty, Loading, Message, Status } from "../components/ui";
import { api } from "../lib/api";
import { formatDateTime, humanize } from "../lib/format";
import { useLoad } from "../lib/useLoad";

interface Test {
  id: string;
  name: string;
  kind: string;
  question_count: number;
  time_limit_minutes: number | null;
}

interface Question {
  id: string;
  prompt: string;
  image: string | null;
  choices: string[];
  chosen?: number | null;
  correct?: number;
  explanation?: string | null;
}

interface Attempt {
  id: string;
  test_name: string;
  submitted: boolean;
  deadline_at?: string | null;
  score?: number;
  total?: number;
  passed?: boolean;
  pass_mark_percent?: number;
  questions: Question[];
}

export function TheoryScreen() {
  const navigate = useNavigate();
  const tests = useLoad(() => api.get<Test[]>("/api/portal/theory/tests"), []);
  const history = useLoad(
    () =>
      api.get<
        {
          id: string;
          test_name: string;
          score: number | null;
          total: number;
          passed: boolean | null;
          started_at: string;
          submitted_at: string | null;
        }[]
      >("/api/portal/theory/history"),
    [],
  );
  const [error, setError] = useState<string | null>(null);

  async function start(test: Test) {
    setError(null);
    try {
      const attempt = await api.post<Attempt>("/api/portal/theory/attempts", { test_id: test.id });
      navigate(`/theory/${attempt.id}`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <>
      <h1>Theory practice</h1>
      <p className="muted">Every attempt picks a fresh random set of questions.</p>
      {error && <Message type="error">{error}</Message>}
      {tests.loading ? (
        <Loading />
      ) : tests.data?.length ? (
        <div className="cards">
          {tests.data.map((test) => (
            <article key={test.id} className="panel">
              <h2>{test.name}</h2>
              <p className="muted">
                {humanize(test.kind)} · {test.question_count} questions
                {test.time_limit_minutes && ` · ${test.time_limit_minutes} minutes`}
              </p>
              <button className="button button--primary" onClick={() => start(test)}>
                Start
              </button>
            </article>
          ))}
        </div>
      ) : (
        <Empty>No tests available yet.</Empty>
      )}
      <h2>My results</h2>
      {history.data?.length ? (
        <ul className="agenda">
          {history.data.map((attempt) => (
            <li key={attempt.id}>
              <Link to={`/theory/${attempt.id}`}>
                <strong>{attempt.test_name}</strong>{" "}
                {attempt.submitted_at ? `${attempt.score}/${attempt.total}` : "Not finished"}
                <span className="muted"> · {formatDateTime(attempt.started_at)}</span>
              </Link>
              {attempt.submitted_at && <Status value={attempt.passed ? "passed" : "failed"} />}
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No results yet.</Empty>
      )}
    </>
  );
}

function useCountdown(deadline: string | null | undefined): number | null {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!deadline) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [deadline]);
  return deadline ? Math.max(0, Math.floor((new Date(deadline).getTime() - now) / 1000)) : null;
}

export function TestScreen() {
  const { attemptId } = useParams();
  const attempt = useLoad(
    () => api.get<Attempt>(`/api/portal/theory/attempts/${attemptId}`),
    [attemptId],
  );
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<Attempt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const secondsLeft = useCountdown(attempt.data?.submitted ? null : attempt.data?.deadline_at);

  async function submit() {
    setError(null);
    try {
      setResult(
        await api.post<Attempt>(`/api/portal/theory/attempts/${attemptId}/submit`, { answers }),
      );
      window.scrollTo(0, 0);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    if (secondsLeft === 0 && !result) submit();
    // Submit once when the timer runs out.
  }, [secondsLeft === 0]);

  if (attempt.loading && !attempt.data) return <Loading />;
  if (attempt.error || !attempt.data) return <Message type="error">{attempt.error}</Message>;
  const shown = result ?? attempt.data;

  if (shown.submitted) {
    return (
      <>
        <h1>{shown.test_name}</h1>
        <section className="panel">
          <h2>
            {shown.score} / {shown.total} — {shown.passed ? "Passed" : "Not passed yet"}
          </h2>
          <p className="muted">Pass mark: {shown.pass_mark_percent}%</p>
          <Link className="button button--primary" to="/theory">
            Back to theory
          </Link>
        </section>
        {shown.questions.map((question, index) => (
          <article key={question.id} className="question">
            <h3>
              {index + 1}. {question.prompt}
            </h3>
            {question.image && <img src={question.image} alt="" />}
            <ul>
              {question.choices.map((choice, i) => (
                <li
                  key={i}
                  className={
                    i === question.correct
                      ? "question__correct"
                      : i === question.chosen
                        ? "question__wrong"
                        : ""
                  }
                >
                  {choice}
                </li>
              ))}
            </ul>
            {question.explanation && <p className="muted">{question.explanation}</p>}
          </article>
        ))}
      </>
    );
  }

  const answered = Object.keys(answers).length;
  return (
    <>
      <h1>{shown.test_name}</h1>
      {secondsLeft !== null && (
        <p className="timer">
          Time left: {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
        </p>
      )}
      {error && <Message type="error">{error}</Message>}
      {shown.questions.map((question, index) => (
        <fieldset key={question.id} className="question">
          <legend>
            {index + 1}. {question.prompt}
          </legend>
          {question.image && <img src={question.image} alt="" />}
          {question.choices.map((choice, i) => (
            <label key={i} className={`choice${answers[question.id] === i ? " choice--on" : ""}`}>
              <input
                type="radio"
                name={question.id}
                checked={answers[question.id] === i}
                onChange={() => setAnswers({ ...answers, [question.id]: i })}
              />
              {choice}
            </label>
          ))}
        </fieldset>
      ))}
      <div className="submit-bar">
        <span>
          {answered} of {shown.questions.length} answered
        </span>
        <button className="button button--primary" onClick={submit}>
          Submit answers
        </button>
      </div>
    </>
  );
}
