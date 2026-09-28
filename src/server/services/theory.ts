import { randomInt } from "node:crypto";
import type { Db, Queryable } from "../db/pool.js";
import { badRequest, conflict, notFound } from "../errors.js";
import type { ResourceHooks } from "./repository.js";
import { loadSettings } from "./settings.js";

export const questionHooks: ResourceHooks = {
  async prepare(data, { existing }) {
    const merged = { ...existing, ...data };
    const choices = (merged.choices ?? []) as string[];
    if (choices.length < 2)
      throw badRequest("Add at least two answer choices", { choices: "Add at least two" });
    if (Number(merged.correct_choice) > choices.length) {
      throw badRequest("The correct answer must be one of the choices", {
        correct_choice: `Choose a number from 1 to ${choices.length}`,
      });
    }
    return data;
  },
};

export function shuffled<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

interface QuestionRow {
  id: string;
  prompt: string;
  image: string | null;
  choices: string[];
  correct_choice: number;
  explanation: string | null;
}

interface AttemptRow {
  id: string;
  test_id: string;
  student_id: string;
  question_ids: string[];
  choice_orders: number[][];
  answers: Record<string, number>;
  score: number | null;
  total: number;
  pass_mark_percent: number;
  passed: boolean | null;
  started_at: Date;
  deadline_at: Date | null;
  submitted_at: Date | null;
}

/** Grace period for network delay when a timed test is submitted right at the deadline. */
const SUBMIT_GRACE_MS = 30_000;

export class TheoryService {
  constructor(private readonly db: Db) {}

  async availableTests(studentId: string) {
    const licenceClass = await this.studentClass(studentId);
    const { rows } = await this.db.query(
      `SELECT id, name, kind, question_count, time_limit_minutes, pass_mark_percent FROM theory_tests
       WHERE deleted_at IS NULL AND active AND (licence_class IS NULL OR licence_class = $1)
       ORDER BY position`,
      [licenceClass],
    );
    return rows;
  }

  /** Draws a fresh random set of questions, with answer choices shuffled, for every attempt. */
  async start(studentId: string, testId: string) {
    const { rows: tests } = await this.db.query(
      "SELECT * FROM theory_tests WHERE id = $1 AND active AND deleted_at IS NULL",
      [testId],
    );
    const test = tests[0];
    if (!test) throw notFound("Test");

    const licenceClass = await this.studentClass(studentId);
    const { rows: pool } = await this.db.query<QuestionRow>(
      `SELECT id, choices FROM questions
       WHERE deleted_at IS NULL AND active AND cardinality(choices) >= 2
         AND (cardinality(licence_classes) = 0 OR $1::text = ANY(licence_classes))
         AND (cardinality($2::text[]) = 0 OR category = ANY($2::text[]))`,
      [licenceClass, test.categories],
    );
    if (!pool.length) throw badRequest("There are no questions for this test yet");

    const picked = shuffled(pool).slice(0, test.question_count);
    const choiceOrders = picked.map((question) =>
      shuffled(question.choices.map((_, index) => index)),
    );
    const passMark =
      test.pass_mark_percent ?? Number((await loadSettings(this.db)).theory.pass_mark_percent);

    const { rows } = await this.db.query<AttemptRow>(
      `INSERT INTO theory_attempts (test_id, student_id, question_ids, choice_orders, total, pass_mark_percent, deadline_at)
       VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $7::int IS NULL THEN NULL ELSE now() + make_interval(mins => $7::int) END)
       RETURNING *`,
      [
        testId,
        studentId,
        picked.map((q) => q.id),
        JSON.stringify(choiceOrders),
        picked.length,
        passMark,
        test.time_limit_minutes,
      ],
    );
    return this.presentAttempt(rows[0]!, test.name);
  }

  async get(studentId: string, attemptId: string) {
    const attempt = await this.attempt(studentId, attemptId);
    const { rows } = await this.db.query("SELECT name FROM theory_tests WHERE id = $1", [
      attempt.test_id,
    ]);
    return attempt.submitted_at
      ? this.results(attempt)
      : this.presentAttempt(attempt, rows[0]?.name ?? "Test");
  }

  /** Answers arrive as the displayed position of each choice; they are mapped back before marking. */
  async submit(
    studentId: string,
    attemptId: string,
    answers: Record<string, unknown>,
    now = new Date(),
  ) {
    const attempt = await this.attempt(studentId, attemptId);
    if (attempt.submitted_at) throw conflict("This test has already been submitted");
    const late =
      attempt.deadline_at && now.getTime() > attempt.deadline_at.getTime() + SUBMIT_GRACE_MS;

    const questions = await this.questions(this.db, attempt.question_ids);
    const recorded: Record<string, number> = {};
    let score = 0;
    attempt.question_ids.forEach((questionId, index) => {
      const shown = Number(answers[questionId]);
      const order = attempt.choice_orders[index] ?? [];
      if (late || !Number.isInteger(shown) || shown < 0 || shown >= order.length) return;
      const original = order[shown]!;
      recorded[questionId] = original;
      if (original + 1 === questions.get(questionId)?.correct_choice) score++;
    });

    const passed = attempt.total > 0 && (score / attempt.total) * 100 >= attempt.pass_mark_percent;
    const { rows } = await this.db.query<AttemptRow>(
      `UPDATE theory_attempts SET answers = $2, score = $3, passed = $4, submitted_at = now()
       WHERE id = $1 AND submitted_at IS NULL RETURNING *`,
      [attemptId, JSON.stringify(recorded), score, passed],
    );
    if (!rows[0]) throw conflict("This test has already been submitted");
    return this.results(rows[0]);
  }

  async history(studentId: string) {
    const { rows } = await this.db.query(
      `SELECT a.id, a.score, a.total, a.passed, a.pass_mark_percent, a.started_at, a.submitted_at,
              t.name AS test_name, t.kind
       FROM theory_attempts a JOIN theory_tests t ON t.id = a.test_id
       WHERE a.student_id = $1 ORDER BY a.started_at DESC LIMIT 100`,
      [studentId],
    );
    return rows;
  }

  async allResults(limit = 200) {
    const { rows } = await this.db.query(
      `SELECT a.id, a.score, a.total, a.passed, a.started_at, a.submitted_at, t.name AS test_name, t.kind,
              s.id AS student_id, s.full_name
       FROM theory_attempts a
       JOIN theory_tests t ON t.id = a.test_id
       JOIN students s ON s.id = a.student_id
       WHERE a.submitted_at IS NOT NULL
       ORDER BY a.submitted_at DESC LIMIT $1`,
      [limit],
    );
    return rows;
  }

  private async presentAttempt(attempt: AttemptRow, testName: string) {
    const questions = await this.questions(this.db, attempt.question_ids);
    return {
      id: attempt.id,
      test_name: testName,
      deadline_at: attempt.deadline_at,
      submitted: false,
      questions: attempt.question_ids.map((id, index) => {
        const question = questions.get(id)!;
        const order = attempt.choice_orders[index] ?? [];
        return {
          id,
          prompt: question.prompt,
          image: question.image,
          choices: order.map((original) => question.choices[original] ?? ""),
        };
      }),
    };
  }

  private async results(attempt: AttemptRow) {
    const { rows: tests } = await this.db.query(
      "SELECT name, show_answers FROM theory_tests WHERE id = $1",
      [attempt.test_id],
    );
    const showAnswers = Boolean(tests[0]?.show_answers);
    const questions = await this.questions(this.db, attempt.question_ids);
    return {
      id: attempt.id,
      test_name: tests[0]?.name ?? "Test",
      submitted: true,
      score: attempt.score,
      total: attempt.total,
      passed: attempt.passed,
      pass_mark_percent: attempt.pass_mark_percent,
      questions: showAnswers
        ? attempt.question_ids.map((id) => {
            const question = questions.get(id)!;
            const chosen = attempt.answers[id];
            return {
              id,
              prompt: question.prompt,
              image: question.image,
              choices: question.choices,
              chosen: chosen ?? null,
              correct: question.correct_choice - 1,
              explanation: question.explanation,
            };
          })
        : [],
    };
  }

  private async attempt(studentId: string, attemptId: string): Promise<AttemptRow> {
    const { rows } = await this.db.query<AttemptRow>(
      "SELECT * FROM theory_attempts WHERE id = $1 AND student_id = $2",
      [attemptId, studentId],
    );
    if (!rows[0]) throw notFound("Test attempt");
    return rows[0];
  }

  private async questions(db: Queryable, ids: string[]): Promise<Map<string, QuestionRow>> {
    const { rows } = await db.query<QuestionRow>(
      "SELECT id, prompt, image, choices, correct_choice, explanation FROM questions WHERE id = ANY($1::uuid[])",
      [ids],
    );
    return new Map(rows.map((row) => [row.id, row]));
  }

  private async studentClass(studentId: string): Promise<string | null> {
    const { rows } = await this.db.query(
      "SELECT c.licence_class FROM students s LEFT JOIN courses c ON c.id = s.course_id WHERE s.id = $1",
      [studentId],
    );
    return rows[0]?.licence_class ?? null;
  }
}
