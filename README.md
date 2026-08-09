# Chimwemwe Driving School2 — Website

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
├── index.html             Home page
├── about.html              About Us page
├── services.html           Courses & pricing + FAQ
├── instructors.html        Meet the instructors
├── gallery.html             Photo gallery
├── testimonials.html        Full testimonials page
├── contact.html             Contact form + map
├── page.html                 Generic template for CMS-created custom pages
├── css/
│   └── style.css            ALL styling for every page (one shared file)
├── js/
│   └── script.js             ALL interactivity + CMS content rendering (one shared file)
├── data/                     Editable content, as JSON — this is what the CMS edits
│   ├── settings.json          Site branding, theme colours, contact info
│   ├── testimonials.json
│   ├── instructors.json
│   ├── gallery.json
│   ├── courses.json
│   ├── announcements.json
│   └── pages/                 One JSON file per custom page (e.g. privacy-policy.json)
├── admin/                    The /admin content manager (Decap CMS)
│   ├── index.html
│   └── config.yml
├── images/
│   ├── logo.png               The school's real logo (transparent background)
│   ├── favicon.png            Browser tab icon
│   └── uploads/                Photos uploaded through the CMS land here automatically
└── README.md                 This file
```

**A note on the logo artwork:** every page, the footer, and all data files now say
"Chimwemwe Driving School2" as requested. The logo image itself (`images/logo.png`)
is your original uploaded artwork, which reads "Chimwemwe Driving School" (no "2") —
image text can't be safely auto-edited without redesigning the graphic, so if you want
the "2" reflected in the artwork itself, that needs a small update from whoever
designed the logo (or re-uploading a new version through the CMS's Site Settings →
Logo field once you have one).

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

The site includes a free, form-based content manager at **`/admin`**, powered by
[Decap CMS](https://decapcms.org) (open source, formerly Netlify CMS). It's grown into
a genuinely capable editor: Markdown-formatted text, draft/review/publish workflow,
per-item publish/unpublish switches, whole new pages, and full control over the site's
theme colours, logo and favicon — all from a web form, no code editing required.

### How it works
Nothing about the tech stack changed underneath — there's still no database. The CMS
edits small JSON files in the `data/` folder. Each page's JavaScript (`js/script.js`)
fetches the relevant file and builds the HTML for that section automatically. So
"using the CMS" really means:

```
You edit in /admin  →  Decap CMS commits to GitHub  →  the live site re-fetches the JSON
```

### 6.1 One-time setup (about 10 minutes)
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
   password, and you'll see the content manager — with the school's own logo on the
   login screen (set via `logo_url` in `admin/config.yml`).

### 6.2 Draft, review, publish — and unpublish
`admin/config.yml` sets `publish_mode: editorial_workflow`, which changes how saving
works: instead of every change going live the instant you save, entries move through
**Draft → In Review → Ready**, and only go live when you click **Publish**. This gives
you a safe space to prepare content (e.g. next month's promotion) without it appearing
on the site early, and a "Ready" queue if more than one person is editing.

For content that's *already* live and you want to temporarily hide, every
Testimonial / Instructor / Gallery photo / Course / Announcement has its own
**Published** on/off switch. Turning it off removes it from the live site immediately
on your next publish, without deleting the entry — flip it back on any time. (Pages
have the same switch, described below.)

### 6.3 Writing with Markdown
Longer text fields — course descriptions, announcement bodies, and page content — use
a **Markdown** editor in the CMS, which gives you a proper toolbar (bold, italic,
lists, links) instead of a plain text box. Behind the scenes it's still just text
saved in the JSON file; `js/script.js` converts it to formatted HTML in the visitor's
browser using a small library called [marked](https://marked.js.org), loaded only on
pages that actually need it.

### 6.4 Creating brand-new pages
The **Pages** collection lets you create entirely new pages — a Privacy Policy, a
Terms of Service, a one-off promotion page — without writing any HTML. Fill in a
Title, a Slug (the web-address-friendly name, e.g. `about-financing`), and the page
content in Markdown, then Publish.

Your new page is live at:
```
your-site.com/page.html?slug=your-slug
```
**One manual step:** because this is a plain static site (no server to ask "what
pages exist?"), publishing a page does *not* automatically add a link to it anywhere.
Add one link by hand, wherever makes sense — e.g. in a page's footer:
```html
<a href="page.html?slug=your-slug">Your Page Title</a>
```
The included `privacy-policy` page (linked from every footer) is a working example of
exactly this pattern.

### 6.5 Changing the site's icon and theme colours
The **Site Settings** collection is a control panel for the whole site's branding:
- **Logo** and **Favicon** — upload new images here and every page updates
  automatically (including the browser tab icon), with no HTML editing.
- **Theme colours** — Primary, Dark, and Highlight colours. These map directly onto
  the CSS variables every component in `css/style.css` is built from
  (`--color-line`, `--color-asphalt`, `--color-stop`), so changing them here
  re-colours buttons, badges, the header/footer, and more, sitewide, instantly.
- **Contact details & branches** — phone numbers, email, and branch addresses shown
  in the footer.

### 6.6 Backups and version history
There's no separate "backup" button to remember, because you already have two layers
of history built in, for free:
- **Every Netlify deploy is kept.** Under your Netlify site's **Deploys** tab, you can
  see every published version of the site and roll back to any of them with one click.
- **Every CMS publish is a Git commit.** Your GitHub repo's commit history is a
  complete, permanent record of every content change — who changed what, and when —
  and any file can be reverted from there too.

### 6.7 What's editable right now
| Collection | Powers |
|---|---|
| ⚙️ Site Settings | Logo, favicon, theme colours, contact details, branches |
| 📄 Pages | Any new custom page (Privacy Policy included as an example) |
| 📰 News & Announcements | The "Latest News" cards on the homepage (Markdown) |
| ⭐ Testimonials | The homepage slider and the full Testimonials page |
| 🧑‍🏫 Instructors | The Instructors page |
| 🖼️ Gallery | The Gallery page |
| 🎓 Courses & Pricing | The course cards on the homepage and Courses page (Markdown) |

Photos uploaded through the CMS are stored in `images/uploads/` in your repo
automatically — you don't need to touch the `images/` folder by hand for that content.

### 6.8 If you'd rather not use Netlify
Everything above is optional — the "edit the file, `git push`" workflow from section 5
still works exactly the same, since the CMS just edits the same JSON files you could
edit by hand. If you skip the CMS setup, ignore the `/admin` folder entirely.

---

## 7. Customising the content

Most day-to-day content (testimonials, instructors, gallery, courses, announcements,
pages, theme colours, logo/favicon, contact details) is best changed through the CMS
described in section 6. For anything not covered there:
- Wording on the About page, or section headings → search the relevant `.html` file
  for the current text and swap it in.
- Fonts, spacing, or anything structural → edit `css/style.css` (see the "TOKENS"
  section at the top for colours/fonts) or the page's HTML directly.

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
