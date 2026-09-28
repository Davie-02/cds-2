# Chimwemwe Driving School2 — Website

A fast, modern, no-build website for a driving school. Plain HTML, CSS and
JavaScript — no React, no npm install, no compile step. Open the files and
they just work.

This version was redesigned with a lighter, more modern visual style
(clean typography, soft shadows, generous spacing, smooth hover states)
while keeping the underlying code exactly as simple as a beginner project
should be: **one CSS file, one JS file, plain HTML pages.**

---

## 1. What's in this project

| Layer | Choice | Why |
|---|---|---|
| Structure | HTML5 | The foundation of every website. |
| Styling | CSS3 (custom properties, Flexbox, Grid) | Modern CSS covers everything a framework like Bootstrap used to be needed for. |
| Interactivity | Vanilla JavaScript (ES6+) | No React/Vue needed for a site this size. |
| Content | JSON files in `/data`, edited in the custom admin at `/admin` | Lets a non-technical person update text, prices, and photos without touching code. |
| Forms | [Formspree](https://formspree.io) (free tier) | Lets a static site "send" real emails with zero backend code. |
| Hosting | GitHub Pages / Netlify / Vercel (all free) | Static files deploy in minutes, with free HTTPS. |

---

## 2. Project structure

```
cds-2/
├── index.html            Home page
├── about.html             About Us
├── services.html          Courses & pricing + FAQ
├── instructors.html       Meet the instructors
├── theory-test.html       Free practice theory test
├── gallery.html           Photo gallery (tap a photo to enlarge)
├── testimonials.html      Student reviews
├── contact.html           Booking form + branches + map
├── page.html              Generic template for CMS-created custom pages
├── 404.html               "Page not found" page (Netlify uses it automatically)
├── offline.html           Shown when a visitor has no connection
├── sw.js                  Service worker — offline support + instant repeat visits
├── manifest.webmanifest   Makes the site installable on phones ("Add to Home screen")
├── netlify.toml           Caching + security headers for Netlify
├── robots.txt
├── css/style.css          ALL styling for every page (one shared file)
├── js/script.js           ALL interactivity + content rendering (one shared file)
├── js/vendor/             Markdown library, stored locally (no third-party CDN)
├── fonts/                 Self-hosted Inter + Sora fonts
├── data/                  Editable content, as JSON — this is what the CMS edits
│   ├── settings.json      Branding, colours, phone/WhatsApp, branches, homepage stats
│   ├── courses.json, instructors.json, gallery.json, testimonials.json
│   ├── announcements.json News posts (optional expiry date + site-wide banner)
│   ├── faqs.json          FAQ questions on the Courses page
│   ├── quiz.json          Theory test questions
│   ├── version.json       Updated on every admin publish — open pages watch it
│   └── pages/             One JSON file per custom page (e.g. privacy-policy.json)
├── admin/                 Custom content manager (index.html, admin.js, admin.css)
└── images/                Logo, icons, and CMS uploads (images/uploads/)
```

### Features at a glance
- **Online booking** — course and branch lists fill in automatically from the
  CMS; "Enrol Now" on a course pre-selects it; sent in the background with a
  thank-you screen; spam honeypot; and a **"Send via WhatsApp"** option that
  pre-fills everything the visitor typed (also offered automatically if sending fails).
- **Free practice theory test** — random questions, instant feedback with
  explanations, score + review of mistakes, best score remembered.
  Questions are edited in the CMS ("🚦 Theory Test Questions").
- **Mobile action bar** — Call / WhatsApp / Book always one tap away on phones.
- **Branch cards** with click-to-call, WhatsApp and Google Maps directions.
- **Site-wide announcement banner** and **auto-expiring offers** (News posts).
- **Gallery lightbox**, testimonial slider with average rating, native FAQ accordion.
- **SEO**: descriptive titles/descriptions, social-sharing tags, and
  `DrivingSchool` structured data (from settings.json) for Google local results.
- **Accessibility**: skip link, keyboard-friendly menu/FAQ/lightbox, focus
  styles, reduced-motion support.

### Why it's fast (and handles heavy traffic)
- Plain static files on Netlify's CDN — there is no server that can be overloaded.
- Fonts and the Markdown library are self-hosted; the Netlify Identity script
  only loads for CMS invite/reset links, not for every visitor.
- Each data file is fetched once per page and preloaded in the `<head>`;
  scripts use `defer`, so nothing blocks the first paint.
- Images are lazy-loaded and sized for the visitor's screen (Unsplash photos
  are requested at the exact width, in WebP/AVIF). The logo went from 152 KB to 6 KB.
- The map only loads when a visitor presses "Show map".
- The service worker makes repeat visits near-instant and keeps pages working
  on weak mobile connections.

**When you edit `css/style.css` or `js/script.js`:** bump the `?v=` number in
every page's `<head>` and in `sw.js` (`VERSION` + `CORE_FILES`), so browsers
pick up the new file straight away.

---

## 3. Run it locally — step by step

The site fetches JSON files with `fetch()`, and browsers block that when
you open an HTML file directly (`file://...`). So you need a tiny local
web server. Pick whichever you have installed:

1. **Python (already on most computers):**
   ```
   cd cds-2
   python3 -m http.server 8000
   ```
   Then open `http://localhost:8000` in your browser.

2. **VS Code:** install the "Live Server" extension, right-click
   `index.html`, choose "Open with Live Server."

3. **Node.js:**
   ```
   npx serve .
   ```

That's it — no `npm install`, no build step, no config.

---

## 4. How the design system works

### `css/style.css`
Opens with a **tokens** section — CSS custom properties (variables) like
`--color-line` and `--font-display`. Every colour, font, spacing and
shadow value used anywhere on the site comes from these variables.
Change a value once at the top of the file, and it updates across every
page. This is the single most useful habit to learn from this project.

The file is organised in numbered sections (read the comment header at
the top) — use your editor's search (`Ctrl+F` / `Cmd+F`) to jump to a
section by name, e.g. "HERO" or "FOOTER".

**What changed in this redesign, and why:**
- Headings switched from all-caps condensed type to a normal-case
  display font (Sora) — easier to read, and reads as calmer and more
  current than a "shouty" all-caps site.
- Shadows got softer (`--shadow-card`, `--shadow-lift`) and cards now
  lift slightly on hover — a small detail that makes the whole site feel
  more responsive to the visitor.
- The header is sticky with a subtle blur, so it stays out of the way
  while scrolling instead of taking a hard edge.
- Spacing and radius values were tuned to feel airier without changing
  the layout structure, so nothing else in the codebase had to move.
- A floating WhatsApp button (bottom-right, every page) was added — see
  below.

### `js/script.js`
Organised in numbered sections (see the comment at the top of the file):
shared helpers, navigation, site settings, news/banner, courses/FAQs/
branches/instructors/gallery, testimonials, the booking form, the theory
test, custom pages and offline support. Every feature only runs if its
element exists on the current page, so one file serves every page.

**Why one shared CSS file and one shared JS file, instead of per-page
files?** For a site this size, one file is easier to search, easier to
keep consistent (change a colour once, it updates everywhere), and
easier to reason about as a beginner.

**Why is the header/nav/footer HTML repeated on every page instead of
one shared file?** Plain HTML has no built-in way to "include" one file
inside another. Repeating the markup keeps this project buildable with
zero tools. Once that stops being fun to maintain by hand, that's your
signal to move to a static site generator (like Eleventy or Astro) or a
framework — see "Where to go next" below.

---

## 5. Editing content without touching code

Every page's dynamic content lives in a `/data/*.json` file:

| To change… | Edit… |
|---|---|
| Courses & prices | `data/courses.json` |
| Instructor bios/photos | `data/instructors.json` |
| Gallery photos | `data/gallery.json` |
| Testimonials | `data/testimonials.json` |
| Homepage news/announcements | `data/announcements.json` |
| Site name, colours, phone, branches | `data/settings.json` |
| A one-off custom page (e.g. a promo page) | add a `.json` file in `data/pages/` |

You can edit these files by hand, but the easy way is the **admin at
`/admin`**.

### The admin (`/admin`)
A custom, lightweight content manager built for this site — one small
HTML/CSS/JS app, no framework, no build step. It covers everything:
site settings (name, logo, colours, phones, branches, homepage figures,
social links), courses & prices, news & offers (with site-wide banner and
auto-expiry), reviews, instructors, gallery (bulk photo upload), FAQs,
theory-test questions, and extra pages.

- **Login:** Netlify Identity — invitation only.
- **Publishing:** "Publish changes" (or Ctrl/Cmd + S) saves every edited
  file plus any new images in **one commit** to `main` through Netlify's
  Git Gateway. Netlify redeploys in seconds, and the admin shows
  "Going live… → Live ✓" once the change is actually on the site.
- **Live site:** every publish also updates `data/version.json`. Open pages
  check it every 30 seconds (and when the visitor returns to the tab) and
  redraw their content in place — no reload, and nothing the visitor has
  typed is lost.
- **Images** are resized and converted to WebP in the browser before
  upload, so a 5 MB phone photo ends up around 200 KB.
- **Safety:** required-field checks, "Discard changes", a warning before
  leaving with unpublished work, and a warning if someone else changed the
  same content since you opened it.
- **Try it safely:** open `http://localhost:8000/admin/` while running the
  site locally — it runs in *local preview mode* (no login, nothing is
  saved to GitHub).

To add a new editable field, add it to the `COLLECTIONS` list near the top
of `admin/admin.js` — the forms build themselves from that list.

**One-time Netlify setup:**
1. Netlify → Site configuration → **Identity** → Enable Identity.
2. Set **Registration** to *Invite only*, then invite each editor by email.
3. Identity → **Services** → Enable **Git Gateway**.

### Adding a brand-new custom page
1. In the admin (Pages → New), or by hand, create `data/pages/your-slug.json`:
   ```json
   {
     "title": "Your Page Title",
     "slug": "your-slug",
     "meta_description": "One sentence for search engines.",
     "published": true,
     "body": "## A heading\n\nYour content, written in **Markdown**."
   }
   ```
2. It's now live at `page.html?slug=your-slug` — `page.html` is a single
   generic template that fetches the matching JSON file and renders it.
3. Link to it from wherever makes sense (a nav link, the footer, or an
   announcement) — plain HTML can't discover new pages automatically, so
   this one link is the only manual step.

### The booking form
The booking form submits to [Formspree](https://formspree.io) so the
site can "send" real emails without a backend. The endpoint is the
`action="..."` attribute of the `<form>` in `contact.html`.
**Note:** Formspree's free plan accepts a limited number of submissions
per month. If bookings get busy, upgrade the plan — and visitors can always
use the "Send via WhatsApp" button on the form in the meantime.

---

## 6. Deploying the site

Any static host works. The simplest options:

1. **Netlify** — drag the `cds-2` folder onto [app.netlify.com/drop](https://app.netlify.com/drop). Done in about 30 seconds.
2. **GitHub Pages** — push this folder to a GitHub repo, then enable
   Pages in the repo's Settings → Pages, pointing at the `main` branch.
3. **Vercel** — `npx vercel` from inside the folder.

All three give you free HTTPS and a custom-domain option.

---

## 7. Where to go next

Once you're comfortable with this project:
- **Static site generators** (Eleventy, Astro) solve the "repeated
  header/footer" problem while staying close to plain HTML.
- **A framework** (React, Vue) makes sense once the site needs real
  interactivity beyond forms and content rendering — e.g. a logged-in
  dashboard.
- **A real backend** (Node/Express, or a hosted database like Supabase)
  is worth it once you need things a static site can't do: user
  accounts, payments, or a database instead of JSON files.

None of those are needed for a site like this one — that's the whole
point of starting here.
