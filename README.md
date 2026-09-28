# Chimwemwe Driving School2

Website, admin and student portal for Chimwemwe Driving School2 (Mzuzu and Karonga, Malawi).

Everything the owner needs to run the site and the school is managed from **`/admin`**: pages,
menus, courses and prices, instructors, vehicles, lesson bookings, students, theory tests, test
dates, payments, news and business settings. Students sign in at **`/portal`** to book lessons,
take practice tests, and upload documents and proof of payment. Changes appear on the site as
soon as they are saved; there is no redeploy.

## Stack

| Part         | Technology                                                                  |
| ------------ | --------------------------------------------------------------------------- |
| Server       | Node.js 22.9+, TypeScript, Fastify                                          |
| Database     | PostgreSQL 14+ (content, bookings, uploads, sessions and the activity log)  |
| Public site  | Rendered on the server from the database (`src/server/site`), plain CSS/JS  |
| Admin/portal | React single-page apps built with Vite (`src/admin`)                        |
| Validation   | One field list per record type (`src/shared`), used by the server and forms |

## Running locally

```bash
cp .env.example .env          # then set DATABASE_URL, SESSION_SECRET, OWNER_EMAIL, OWNER_PASSWORD
createdb driving_school
npm install
npm run build
npm start                     # http://localhost:3000, admin at /admin
```

On first start the server creates the tables, fills an empty database with the default content
from `src/server/content/defaults.ts`, and creates the owner account from `OWNER_EMAIL` and
`OWNER_PASSWORD`. Sign in and change that password under **My account**.

While developing, `npm run dev` runs the server with reloading and the admin through Vite at
http://localhost:5173/admin (API calls are forwarded to the server on port 3000).

| Command             | What it does                                                         |
| ------------------- | -------------------------------------------------------------------- |
| `npm run dev`       | Server and admin with live reload                                    |
| `npm run build`     | Compiles the server and builds the admin and portal                  |
| `npm start`         | Runs the built app; applies pending database migrations on start     |
| `npm test`          | Runs the tests; needs `TEST_DATABASE_URL` (a database they may wipe) |
| `npm run typecheck` | Type-checks server, admin and tests                                  |
| `npm run format`    | Formats all files with Prettier                                      |

## Deploying

All configuration is in environment variables, listed with explanations in `.env.example`. The
only required ones are `DATABASE_URL`, `SESSION_SECRET`, and `OWNER_EMAIL` / `OWNER_PASSWORD`
for the first start. Set `PUBLIC_URL` to the site's address and `TRUST_PROXY=true` behind a
hosting proxy.

`render.yaml` describes a Render web service with a Postgres database: in Render choose
**New → Blueprint**, pick this repository, and fill in `PUBLIC_URL`, `OWNER_EMAIL` and
`OWNER_PASSWORD` when asked. Any host that runs Node 22.9+ and offers Postgres works the same way:
build with `npm ci --include=dev && npm run build`, start with `npm start`.

Uploaded photos, videos and documents are stored in the database, so the web server keeps no
files of its own and a database backup covers everything.

## How the admin works

### Who can do what

Staff accounts are created by the owner under **Admin → Staff & access**. Each account has a role:

| Role       | Can by default                                                              |
| ---------- | --------------------------------------------------------------------------- |
| Owner      | Everything, including staff, access rights, settings and permanent deletion |
| Office     | Everything except business settings and staff access                        |
| Instructor | Their own lessons and students: calendar, lesson notes, skills checklist    |
| Accountant | Invoices, payments, balances and student contact details                    |

Opening a staff member shows every right as a switch, so the owner can grant or remove
individual rights for that person. Only the owner can change roles or rights, and there is always
at least one active owner. Instructors see only the students assigned to them or booked with
them; this is enforced by the server, not just hidden in the menus.

Students get a portal login from their student page (**Details → Student portal login**).

### Editing the website

- **Website → Pages**: every page is a list of sections (hero banner, text with photo, feature
  cards, steps, courses, news, testimonials, instructors, gallery, FAQ, downloads, video, contact
  form, call-to-action band). Open a section to edit its text, buttons, photos or video; use the
  arrows to reorder, **Hide** to take it off the page without deleting it, and **Add a section**
  to add one. Each page also has its own search engine title, description and sharing image.
  New pages are live at `/their-web-address`; add them to a menu to link them.
- **Website → Menus**: links in the top menu and the two footer columns, with order and visibility.
- **News & blog, Notices, FAQ, Testimonials, Gallery, Downloads, Branches**: lists with a
  **Show on website** switch on each item. Notices appear as a banner across the site between
  their start and end dates, which suits intakes and holiday closures.
- **Admin → Settings**: school name, logo, colours, footer text, contact details, WhatsApp
  number, social links (shown with their icons), opening hours, map position, booking rules,
  theory pass mark, test-readiness rules, bank and mobile money details, and reminder email.

### Running the school

- **Dashboard**: today's lessons, lesson requests from students to confirm or decline,
  reminders for insurance, certificates of fitness, services and learner's permits, overdue
  instalments, outstanding fees and test pass rates.
- **Lesson calendar**: the week's lessons, filterable by instructor or vehicle. The database
  refuses double-booking of an instructor, a vehicle or a student, even when two people book at
  the same moment. Instructors mark lessons completed or no-show and write lesson notes.
- **Students**: each student's lessons, skills checklist (parking, hill start, roundabouts and so
  on, editable under **School → Skills checklist**), documents, instructor notes, official tests,
  practice-test results, invoices and payments, and a test-readiness checklist.
- **Theory**: the question bank (with pictures of road signs), practice tests and mock exams.
  Every attempt draws a fresh random set of questions with the answers shuffled.
- **Finance**: invoices with optional instalment plans, payments (students' uploaded proofs
  arrive as _pending_ until checked), printable invoices and receipts, and balances per student.

### Undo and the recycle bin

Every change is recorded in **Admin → Activity log** with who made it and when. Changes to
records and settings can be undone from there; an undo is refused if the item has been changed
again since, so a later edit is never silently lost. Deleted items go to the **Recycle bin** and
can be restored; only the owner can delete permanently.

## Common tasks

**Add a new course or package.** Go to **School → Courses & packages → Add course**. Fill in
the name, type (licence course, refresher, theory class or add-on), licence class, price, number
of lessons, what's included and the requirements (minimum age, documents, learner's permit). It
appears on the site straight away wherever a _Courses_ section shows that type, and in the
contact form's course list. Untick **Show on website** to prepare it privately first.

**Add a new instructor.** Go to **School → Instructors → Add instructor**. Add the photo, bio,
licence classes they teach, languages and weekly availability (students can only self-book
inside those hours). To let them sign in, first create a staff account with the _Instructor_ role
under **Staff & access**, then choose it in the instructor's **Login account** field.

**Add a new vehicle.** Go to **School → Vehicles → Add vehicle**. Enter the plate, make, model,
gearbox, licence classes it is used for, and the insurance, certificate of fitness and service
dates. The dashboard warns before those dates (30 days by default, set under **Settings →
Reminders**), and a vehicle with expired insurance or fitness cannot be booked.

## Project layout

```
src/shared/            Field lists for every record type, sections, settings and permissions
src/server/            Fastify app: routes, services, database migrations
src/server/content/    defaults.ts, the default content for a fresh database
src/server/site/       Server-side templates for the public site
src/admin/             Admin (admin.html) and student portal (portal.html) React apps
public/                Stylesheets, site script and bundled images
tests/                 Validation, access, booking, defaults, theory and finance tests
```

To add a new kind of record, add its field list to `src/shared/resources.ts` and its table to a
new entry at the end of `src/server/db/migrations.ts`; the admin list, form, validation, activity
log and recycle bin all follow from the field list.
