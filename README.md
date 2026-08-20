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
| Content | JSON files in `/data`, edited via a free CMS at `/admin` | Lets a non-technical person update text, prices, and photos without touching code. |
| Forms | [Formspree](https://formspree.io) (free tier) | Lets a static site "send" real emails with zero backend code. |
| Hosting | GitHub Pages / Netlify / Vercel (all free) | Static files deploy in minutes, with free HTTPS. |

---

## 2. Project structure

```
cds-2/
├── index.html            Home page
├── about.html             About Us page
├── services.html          Courses & pricing + FAQ
├── instructors.html       Meet the instructors
├── gallery.html            Photo gallery
├── testimonials.html       Full testimonials page
├── contact.html            Contact form + map
├── page.html                Generic template for CMS-created custom pages
├── css/
│   └── style.css            ALL styling for every page (one shared file)
├── js/
│   └── script.js             ALL interactivity + content rendering (one shared file)
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
│   ├── logo.png                The school's logo (transparent background)
│   ├── favicon.png              Browser tab icon
│   └── uploads/                  Photos uploaded through the CMS land here automatically
└── README.md                  This file
```

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
Seven independent features, each in its own function, each only running
if its element exists on the current page:
1. **Mobile nav toggle** — the hamburger menu on small screens.
2. **Active page highlight** — the current page's nav link gets a yellow underline.
3. **Scroll reveal** — cards fade/slide in as you scroll, using `IntersectionObserver`.
4. **Testimonial slider** — the rotating quote carousel on the home page.
5. **FAQ accordion** — the expanding questions on the Courses page.
6. **Form validation** — checks required fields and email/phone format before letting a booking form submit.
7. **Floating WhatsApp button** — reads the phone number from `data/settings.json` and adds one sticky chat button to every page, so there's only one place to update the number.

Below those, a shared set of helper functions load JSON, escape user
text (so CMS input can never break the page), render Markdown, and read
`data/settings.json` to theme the whole site (colours, logo, favicon,
footer contact details) from one file.

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

You can edit these files by hand in any text editor, or through the
**visitor-friendly CMS at `/admin`** (Decap CMS), which turns each field
into a form — no JSON syntax to worry about. See `admin/config.yml` for
how each collection is configured.

### Adding a brand-new custom page
1. In the CMS (or by hand), create `data/pages/your-slug.json`:
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

### Wiring up the contact form
The contact form submits to [Formspree](https://formspree.io) so the
site can "send" real emails without a backend:
1. Create a free account at formspree.io.
2. Create a form, copy the endpoint URL it gives you.
3. Paste it into the `action="..."` attribute of the `<form>` tag in
   `contact.html`.
Until you do this, submitting the form just shows a "demo mode" message
— your code still gets to run and validate, nothing breaks.

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
