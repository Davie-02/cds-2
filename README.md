# Chimwemwe Driving School — Website

A responsive, multi-page website for a driving school, built as a **learning project**
with plain HTML, CSS and JavaScript. No frameworks, no build tools, no npm install —
open the files and they just work.

---

## 1. Why this tech stack

| Layer | Choice | Why |
|---|---|---|
| Structure | HTML5 | The foundation of every website. No way around learning it. |
| Styling | CSS3 (custom properties, Flexbox, Grid) | Modern CSS can do almost everything a framework like Bootstrap used to be needed for. Learning raw CSS first makes frameworks easier later, not harder. |
| Interactivity | Vanilla JavaScript (ES6+) | No React/Vue needed for a site like this. Plain JS teaches you the fundamentals every framework is built on. |
| Forms | [Formspree](https://formspree.io) (free tier) | Lets a static site "send" real emails without you writing or hosting a backend server. |
| Hosting | GitHub Pages / Netlify / Vercel (all free) | Static files deploy in minutes, with free HTTPS and a custom domain option later. |

This is intentionally **not** React, Next.js, Tailwind, or a CMS. Those are great tools,
but they add build steps and abstractions that get in the way when you're still learning
how HTML, CSS and JS fit together. Once you're comfortable with this project, moving to
a framework will feel like a natural next step rather than a mystery box.

---

## 2. Project structure

```
chimwemwe-driving-school/
├── index.html            Home page
├── about.html             About Us page
├── services.html          Courses & pricing + FAQ
├── instructors.html       Meet the instructors
├── gallery.html           Photo gallery
├── testimonials.html      Full testimonials page
├── contact.html           Contact form + map
├── css/
│   └── style.css          ALL styling for every page (one shared file)
├── js/
│   └── script.js          ALL interactivity + CMS content rendering (one shared file)
├── data/                  Editable content, as JSON — this is what the CMS edits
│   ├── testimonials.json
│   ├── instructors.json
│   ├── gallery.json
│   ├── courses.json
│   └── announcements.json
├── admin/                 The /admin content manager (Decap CMS)
│   ├── index.html
│   └── config.yml
├── images/
│   └── uploads/           Photos uploaded through the CMS land here automatically
└── README.md              This file
```

**Why one shared CSS file and one shared JS file, instead of per-page files?**
For a site this size, one file is easier to search, easier to keep consistent (change
a colour once, it updates everywhere), and easier to reason about as a beginner. Every
component in `style.css` is commented and grouped by section — use your editor's search
(`Ctrl+F` / `Cmd+F`) to jump to what you need.

**Why is the header/nav/footer HTML repeated on every page instead of one shared file?**
Plain HTML has no built-in way to "include" one file inside another (that's what
frameworks like React or template engines like PHP solve). Repeating the markup keeps
this project buildable with zero tools. Once this stops being fun to maintain by hand,
that's your natural signal to learn a static site generator (like Eleventy or Astro) or
a framework — see "Where to go next" below.

---

## 3. How the site works, section by section

### `css/style.css`
Opens with a **tokens** section — CSS custom properties (variables) like
`--color-line` and `--font-display`. Every colour, font and spacing value used
anywhere on the site comes from these variables. Change a value once at the top of the
file, and it updates across all seven pages. This is the single most useful habit to
learn from this project.

### `js/script.js`
Six independent features, each in its own function, each only running if its element
exists on the current page:
1. **Mobile nav toggle** — the hamburger menu on small screens.
2. **Active page highlight** — the current page's nav link gets a yellow underline.
3. **Scroll reveal** — cards fade/slide in as you scroll, using `IntersectionObserver`.
4. **Testimonial slider** — the rotating quote carousel on the home page.
5. **FAQ accordion** — the expanding questions on the Courses page.
6. **Form validation** — checks required fields and email/phone format before letting
   the booking form on `contact.html` submit.

### The contact form
The site has no backend/database, so the booking form on `contact.html` submits to
[Formspree](https://formspree.io) — a free service that turns form submissions into
emails sent to your inbox, with no server code required.

**To make the form actually send you emails:**
1. Create a free account at **https://formspree.io**
2. Create a new form; Formspree gives you an endpoint URL like
   `https://formspree.io/f/abcd1234`
3. Open `contact.html`, find this line near the top of the `<form>` tag:
   ```html
   <form action="https://formspree.io/f/YOUR_FORM_ID" method="POST" data-validate novalidate>
   ```
4. Replace `YOUR_FORM_ID` with your real Formspree ID.

Until you do this, the form still validates input correctly, but shows a friendly
"demo mode" message instead of sending anywhere — so nothing looks broken while
you're still setting things up.

### Replacing the placeholder images
Every image currently points to a free stock photo on Unsplash (via URL, so there's
nothing to download). To use your own photos:
1. Save your photos into the empty `images/` folder (e.g. `images/instructor-1.jpg`)
2. In the relevant `.html` file, replace the `src="https://images.unsplash.com/..."`
   with `src="images/instructor-1.jpg"`

---

## 4. Running the site locally

Because this is plain HTML/CSS/JS, you don't strictly need a local server — you can
just double-click `index.html` to open it in a browser. However, running a tiny local
server gives you a more realistic preview (and is required for some browser features).

**Easiest option — VS Code:**
1. Install the free **Live Server** extension
2. Right-click `index.html` → "Open with Live Server"

**Or, with Python (already on most computers):**
```bash
cd chimwemwe-driving-school
python3 -m http.server 8000
# then open http://localhost:8000 in your browser
```

---

## 5. Free hosting — step-by-step (GitHub Pages)

GitHub Pages is completely free, requires no credit card, gives you free HTTPS, and is
the most common way beginners host static sites like this one.

1. **Create a GitHub account** at https://github.com if you don't have one.
2. **Create a new repository** (top-right `+` → "New repository"). Name it anything,
   e.g. `chimwemwe-driving-school`. Keep it Public.
3. **Upload your files**: on the new repo's page, click "uploading an existing file"
   and drag in everything from the `chimwemwe-driving-school` folder (keeping the
   `css/` and `js/` folders intact), then commit.
4. **Turn on Pages**: go to the repo's **Settings** tab → **Pages** (left sidebar) →
   under "Build and deployment", set **Source** to "Deploy from a branch", branch
   `main`, folder `/ (root)` → **Save**.
5. Wait about a minute, then refresh the Pages settings screen — it will show your
   live URL, something like:
   `https://yourusername.github.io/chimwemwe-driving-school/`

That's it — no payment details required at any step.

**Alternative free options** (also no cost, no card required):
- **Netlify** (https://netlify.com) — drag-and-drop the folder in their dashboard for
  instant deployment; slightly friendlier UI than GitHub Pages.
- **Vercel** (https://vercel.com) — similar drag-and-drop flow, great if you plan to
  learn a JS framework later since Vercel is built for that.
- **Cloudflare Pages** (https://pages.cloudflare.com) — same idea, backed by
  Cloudflare's free CDN.

All four keep your site free indefinitely for a static project like this one — you
only start paying if you add things like a custom backend, database, or heavy traffic
billing, none of which this project needs.

---

## 6. Managing content with the CMS

The site now includes a free, form-based content manager at **`/admin`**, powered by
[Decap CMS](https://decapcms.org) (open source, formerly Netlify CMS). It lets you (or
anyone you invite) edit testimonials, instructors, gallery photos, courses, and
news/announcements from a web form — no code editing, no Git commands.

### How it works
Nothing about the tech stack changed underneath — there's still no database. The CMS
edits small JSON files in the `data/` folder (`data/testimonials.json`,
`data/instructors.json`, `data/gallery.json`, `data/courses.json`,
`data/announcements.json`). Each page's JavaScript (`js/script.js`) fetches the
relevant file and builds the HTML for that section automatically. So "using the CMS"
really means: **you fill in a form → Decap CMS commits the updated JSON file to your
GitHub repo → the live site picks it up automatically.**

```
You edit in /admin  →  Decap CMS commits to GitHub  →  site re-fetches the JSON
```

### One-time setup (about 10 minutes)
Decap CMS needs somewhere to safely handle login and to commit changes to GitHub on
your behalf, without you managing any tokens or passwords in code. The free way to do
this is **Netlify Identity + Git Gateway**, which is exactly what it was built for —
so this step means hosting on Netlify rather than GitHub Pages (still 100% free, no
card required).

1. **Push this project to GitHub** (a repo, same as before — see section 5 if you
   haven't already).
2. **Create a free Netlify account** at https://netlify.com and choose "Add new site
   → Import an existing project" → connect it to your GitHub repo. Leave build
   settings blank (there's no build step) and deploy.
3. In your new Netlify site, go to **Site configuration → Identity → Enable Identity**.
4. Under **Identity → Registration**, set it to **Invite only** (so strangers can't
   sign themselves up as editors).
5. Under **Identity → Services**, click **Enable Git Gateway**. This is what lets
   Decap CMS commit to your GitHub repo using your Netlify Identity login, with no
   personal access token to manage.
6. Go to **Identity → Invite users**, invite your own email address. You'll get an
   email with a link — click it, set a password.
7. Visit `https://your-site-name.netlify.app/admin/`, log in with that email and
   password, and you'll see the content manager.

From then on, editing content is just: open `/admin`, click the collection (e.g.
"Testimonials"), add/edit/delete an entry, and click **Publish**. The change goes
live on your site within a minute or two, the same way a `git push` would.

### What's editable right now
| Collection | Powers |
|---|---|
| News & Announcements | The "Latest News" cards on the homepage |
| Testimonials | The homepage slider and the full Testimonials page |
| Instructors | The Instructors page |
| Gallery | The Gallery page |
| Courses & Pricing | The course cards on the homepage and Courses page |

Photos uploaded through the CMS (e.g. a new instructor photo) are stored in
`images/uploads/` in your repo automatically — you don't need to touch the `images/`
folder by hand anymore for that content.

### If you'd rather not use Netlify
Everything above is optional — the "edit the file, `git push`" workflow from section 5
still works exactly the same, since the CMS just edits the same JSON files you could
edit by hand. If you skip the CMS setup, ignore the `/admin` folder entirely.

---

## 7. Customising the content

Everything is plain text inside the HTML files, so search-and-replace is usually all
you need:
- School name, phone numbers, address, prices → search each `.html` file for the
  current placeholder text and swap it in.
- Colours/fonts → edit the `:root { ... }` section at the top of `css/style.css`.
- Course details → edit the `<ul>` lists inside the `.card--price` blocks in
  `services.html` and `index.html`.

---

## 8. Where to go next (once you've outgrown this project)

This project is deliberately simple. When you're comfortable with it, natural next
steps include:
- **A static site generator** (Eleventy, Astro) to stop repeating the header/footer
  by hand.
- **A JavaScript framework** (React, Vue, Svelte) once you understand why plain JS
  gets repetitive for larger, more interactive apps.
- **A real backend** (Node.js + Express, or a service like Supabase) if you want the
  booking form to store data in a database instead of just emailing you.
- **A custom domain** — most registrars let you point a domain at GitHub Pages,
  Netlify or Vercel for free (the domain itself typically costs a small yearly fee).

Good luck, and enjoy the process — this is exactly how most professional developers'
first "real" project looked.
