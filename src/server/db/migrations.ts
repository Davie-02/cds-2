/**
 * Ordered schema migrations. Applied migrations are recorded in schema_migrations,
 * so each entry runs once; add new entries at the end rather than editing old ones.
 */

const standardColumns = `
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz`;

const table = (name: string, columns: string) => `
CREATE TABLE ${name} (${standardColumns},
${columns}
);`;

export const MIGRATIONS: { name: string; sql: string }[] = [
  {
    name: "001_initial",
    sql: `
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE meta (key text PRIMARY KEY, value jsonb NOT NULL);

CREATE TABLE settings (
  group_name text PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

${table(
  "users",
  `  name text NOT NULL,
  email text NOT NULL,
  phone text,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('owner', 'office', 'instructor', 'accountant', 'student')),
  permission_overrides jsonb NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  last_login_at timestamptz`,
)}
CREATE UNIQUE INDEX users_email_key ON users (lower(email)) WHERE deleted_at IS NULL;

CREATE TABLE sessions (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

CREATE TABLE uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  mime_type text NOT NULL,
  size integer NOT NULL,
  data bytea NOT NULL,
  is_private boolean NOT NULL DEFAULT false,
  uploaded_by uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

${table(
  "pages",
  `  title text NOT NULL,
  slug text NOT NULL,
  seo_title text,
  seo_description text,
  share_image text,
  published boolean NOT NULL DEFAULT true,
  is_system boolean NOT NULL DEFAULT false`,
)}
CREATE UNIQUE INDEX pages_slug_key ON pages (slug) WHERE deleted_at IS NULL;

${table(
  "sections",
  `  page_id uuid NOT NULL REFERENCES pages (id),
  type text NOT NULL,
  visible boolean NOT NULL DEFAULT true,
  content jsonb NOT NULL DEFAULT '{}',
  position integer NOT NULL DEFAULT 0`,
)}
CREATE INDEX sections_page_idx ON sections (page_id, position);

${table(
  "menu_items",
  `  label text NOT NULL,
  url text NOT NULL,
  location text NOT NULL,
  is_button boolean NOT NULL DEFAULT false,
  new_tab boolean NOT NULL DEFAULT false,
  visible boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0`,
)}

${table(
  "posts",
  `  title text NOT NULL,
  slug text NOT NULL,
  category text NOT NULL DEFAULT 'news',
  published_on date NOT NULL,
  summary text,
  body text NOT NULL,
  image text,
  seo_description text,
  published boolean NOT NULL DEFAULT true`,
)}
CREATE UNIQUE INDEX posts_slug_key ON posts (slug) WHERE deleted_at IS NULL;

${table(
  "notices",
  `  title text NOT NULL,
  message text NOT NULL,
  kind text NOT NULL DEFAULT 'general',
  starts_on date NOT NULL,
  ends_on date,
  link_label text,
  link text,
  published boolean NOT NULL DEFAULT true`,
)}

${table(
  "faqs",
  `  question text NOT NULL,
  answer text NOT NULL,
  category text,
  published boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0`,
)}

${table(
  "testimonials",
  `  name text NOT NULL,
  stars integer NOT NULL DEFAULT 5 CHECK (stars BETWEEN 1 AND 5),
  quote text NOT NULL,
  photo text,
  published boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0`,
)}

${table(
  "gallery_items",
  `  image text NOT NULL,
  caption text NOT NULL,
  published boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0`,
)}

${table(
  "downloads",
  `  title text NOT NULL,
  description text,
  file text NOT NULL,
  published boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0`,
)}

${table(
  "branches",
  `  name text NOT NULL,
  address text NOT NULL,
  phone text,
  whatsapp_number text,
  hours text,
  published boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0`,
)}

${table(
  "courses",
  `  name text NOT NULL,
  category text NOT NULL DEFAULT 'course',
  licence_class text,
  gearbox text NOT NULL DEFAULT 'either',
  price integer NOT NULL CHECK (price >= 0),
  lessons integer,
  lesson_minutes integer,
  theory_sessions integer,
  duration text,
  summary text,
  included text[] NOT NULL DEFAULT '{}',
  min_age integer,
  documents_required text[] NOT NULL DEFAULT '{}',
  requires_permit boolean NOT NULL DEFAULT false,
  other_requirements text[] NOT NULL DEFAULT '{}',
  allow_instalments boolean NOT NULL DEFAULT true,
  deposit integer,
  photo text,
  featured boolean NOT NULL DEFAULT false,
  published boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0`,
)}

${table(
  "instructors",
  `  name text NOT NULL,
  role_title text,
  bio text,
  photo text,
  phone text,
  email text,
  licence_classes text[] NOT NULL DEFAULT '{}',
  languages text[] NOT NULL DEFAULT '{}',
  branch_id uuid REFERENCES branches (id),
  availability jsonb NOT NULL DEFAULT '[]',
  user_id uuid REFERENCES users (id),
  show_on_website boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0`,
)}

${table(
  "vehicles",
  `  plate text NOT NULL,
  make text NOT NULL,
  model text NOT NULL,
  year integer,
  gearbox text NOT NULL,
  licence_classes text[] NOT NULL DEFAULT '{}',
  dual_controls boolean NOT NULL DEFAULT true,
  branch_id uuid REFERENCES branches (id),
  photo text,
  insurance_expires_on date,
  fitness_expires_on date,
  last_service_on date,
  next_service_on date,
  notes text,
  active boolean NOT NULL DEFAULT true`,
)}
CREATE UNIQUE INDEX vehicles_plate_key ON vehicles (upper(plate)) WHERE deleted_at IS NULL;

${table(
  "students",
  `  full_name text NOT NULL,
  phone text NOT NULL,
  email text,
  date_of_birth date,
  national_id text,
  address text,
  course_id uuid REFERENCES courses (id),
  instructor_id uuid REFERENCES instructors (id),
  branch_id uuid REFERENCES branches (id),
  status text NOT NULL DEFAULT 'active',
  permit_number text,
  permit_expires_on date,
  emergency_contact text,
  notes text,
  user_id uuid REFERENCES users (id)`,
)}

${table(
  "student_documents",
  `  student_id uuid NOT NULL REFERENCES students (id),
  kind text NOT NULL,
  file text NOT NULL,
  expires_on date,
  verified boolean NOT NULL DEFAULT false`,
)}

${table(
  "student_notes",
  `  student_id uuid NOT NULL REFERENCES students (id),
  body text NOT NULL,
  author_id uuid REFERENCES users (id),
  author_name text`,
)}

${table(
  "skills",
  `  name text NOT NULL,
  category text,
  licence_classes text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0`,
)}

CREATE TABLE student_skills (
  student_id uuid NOT NULL REFERENCES students (id),
  skill_id uuid NOT NULL REFERENCES skills (id),
  level text NOT NULL CHECK (level IN ('not_started', 'introduced', 'practising', 'competent')),
  updated_by uuid REFERENCES users (id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, skill_id)
);

${table(
  "bookings",
  `  student_id uuid NOT NULL REFERENCES students (id),
  instructor_id uuid NOT NULL REFERENCES instructors (id),
  vehicle_id uuid REFERENCES vehicles (id),
  branch_id uuid REFERENCES branches (id),
  kind text NOT NULL DEFAULT 'practical',
  starts_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'confirmed',
  notes text,
  lesson_notes text,
  booked_by uuid REFERENCES users (id),
  CHECK (ends_at > starts_at)`,
)}
CREATE INDEX bookings_starts_idx ON bookings (starts_at);

-- The database itself refuses overlapping active lessons, so two people booking the same
-- slot at the same moment cannot both succeed.
ALTER TABLE bookings ADD CONSTRAINT bookings_instructor_overlap
  EXCLUDE USING gist (instructor_id WITH =, tstzrange(starts_at, ends_at) WITH &&)
  WHERE (deleted_at IS NULL AND status IN ('requested', 'confirmed'));
ALTER TABLE bookings ADD CONSTRAINT bookings_vehicle_overlap
  EXCLUDE USING gist (vehicle_id WITH =, tstzrange(starts_at, ends_at) WITH &&)
  WHERE (deleted_at IS NULL AND vehicle_id IS NOT NULL AND status IN ('requested', 'confirmed'));
ALTER TABLE bookings ADD CONSTRAINT bookings_student_overlap
  EXCLUDE USING gist (student_id WITH =, tstzrange(starts_at, ends_at) WITH &&)
  WHERE (deleted_at IS NULL AND status IN ('requested', 'confirmed'));

${table(
  "official_tests",
  `  student_id uuid NOT NULL REFERENCES students (id),
  kind text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  location text,
  licence_class text,
  instructor_id uuid REFERENCES instructors (id),
  vehicle_id uuid REFERENCES vehicles (id),
  result text NOT NULL DEFAULT 'booked',
  score text,
  notes text`,
)}

${table(
  "questions",
  `  prompt text NOT NULL,
  image text,
  category text,
  choices text[] NOT NULL DEFAULT '{}',
  correct_choice integer NOT NULL,
  explanation text,
  licence_classes text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true`,
)}

${table(
  "theory_tests",
  `  name text NOT NULL,
  kind text NOT NULL,
  question_count integer NOT NULL,
  time_limit_minutes integer,
  pass_mark_percent integer,
  categories text[] NOT NULL DEFAULT '{}',
  licence_class text,
  show_answers boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0`,
)}

CREATE TABLE theory_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES theory_tests (id),
  student_id uuid NOT NULL REFERENCES students (id),
  question_ids uuid[] NOT NULL,
  choice_orders jsonb NOT NULL DEFAULT '[]',
  answers jsonb NOT NULL DEFAULT '{}',
  score integer,
  total integer NOT NULL,
  pass_mark_percent integer NOT NULL,
  passed boolean,
  started_at timestamptz NOT NULL DEFAULT now(),
  deadline_at timestamptz,
  submitted_at timestamptz
);
CREATE INDEX theory_attempts_student_idx ON theory_attempts (student_id, started_at DESC);

${table(
  "invoices",
  `  number text NOT NULL,
  student_id uuid NOT NULL REFERENCES students (id),
  issued_on date NOT NULL,
  due_on date,
  lines jsonb NOT NULL DEFAULT '[]',
  discount integer,
  instalments jsonb NOT NULL DEFAULT '[]',
  notes text,
  total integer NOT NULL DEFAULT 0`,
)}
CREATE UNIQUE INDEX invoices_number_key ON invoices (number);
CREATE SEQUENCE invoice_number_seq;

${table(
  "payments",
  `  receipt_number text,
  student_id uuid NOT NULL REFERENCES students (id),
  invoice_id uuid REFERENCES invoices (id),
  amount integer NOT NULL CHECK (amount > 0),
  method text NOT NULL,
  reference text,
  paid_on date NOT NULL,
  proof text,
  status text NOT NULL DEFAULT 'confirmed',
  notes text`,
)}
CREATE UNIQUE INDEX payments_receipt_key ON payments (receipt_number);
CREATE SEQUENCE receipt_number_seq;

${table(
  "enquiries",
  `  name text NOT NULL,
  phone text NOT NULL,
  email text,
  course text,
  branch text,
  message text,
  status text NOT NULL DEFAULT 'new'`,
)}

CREATE TABLE activity_log (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES users (id) ON DELETE SET NULL,
  user_name text,
  action text NOT NULL,
  resource text NOT NULL,
  record_id text NOT NULL,
  summary text NOT NULL,
  before jsonb,
  after jsonb,
  undone_at timestamptz,
  undone_by uuid REFERENCES users (id) ON DELETE SET NULL
);
CREATE INDEX activity_log_created_idx ON activity_log (created_at DESC);
CREATE INDEX activity_log_record_idx ON activity_log (resource, record_id);
`,
  },
];
