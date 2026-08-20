/* =========================================================
   CHIMWEMWE DRIVING SCHOOL2 — SITE SCRIPT
   ---------------------------------------------------------
   This file is plain, framework-free JavaScript. Every feature
   below is wrapped in a small function and only runs if the
   matching element actually exists on the page (see the "if"
   guards). That means this ONE file is shared by every page —
   each page only uses the parts it needs, and nothing breaks
   if a page doesn't have, say, a testimonial slider.

   Sections:
   1. Mobile navigation toggle
   2. Highlight the current page in the nav
   3. Scroll-reveal animation (adds .is-visible to .reveal items)
   4. Testimonial slider + testimonials grid
   5. FAQ accordion
   6. Contact / booking form validation + submission
   7. Shared CMS helpers (fetch JSON, escape text, Markdown, etc.)
   8. Site settings — theme colours, logo/favicon, contact info
   9. Instructors / Gallery / Courses / Announcements (CMS content)
   10. Custom pages (renders anything created in the CMS "Pages"
       collection, via page.html?slug=...)

   Everything in sections 7–10 reads from the small JSON files in
   /data — which is exactly what the CMS at /admin edits. So an
   editor filling in a form at /admin changes what gets rendered
   here, with no other code changes ever needed.
   ========================================================= */

// This runs once the HTML has finished loading. Every function it
// calls checks first whether the element it needs exists on THIS
// page, so it's safe to call all of them from every page.
document.addEventListener("DOMContentLoaded", function () {
  initMobileNav();
  highlightCurrentPage();
  initScrollReveal();
  initFaqAccordion();
  initFormValidation();

  applySiteSettings();        // theme colours, logo, favicon, footer contact info
  renderFloatingWhatsApp();   // sticky WhatsApp bubble, bottom-right, every page
  renderTestimonials();       // homepage slider (published items only)
  renderTestimonialsGrid();   // full testimonials page (published items only)
  renderInstructors();
  renderGallery();
  renderCourses();
  renderAnnouncements();
  renderCustomPage();         // only does anything on page.html
});

/* ---------- 1. Mobile navigation toggle ---------- */
function initMobileNav() {
  const toggle = document.querySelector(".nav__toggle");
  const links = document.querySelector(".nav__links");
  if (!toggle || !links) return;

  toggle.addEventListener("click", function () {
    const isOpen = links.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });

  // Close the menu automatically once a link is tapped (nicer on mobile)
  links.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () {
      links.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });
}

/* ---------- 2. Highlight current page in nav ---------- */
function highlightCurrentPage() {
  const currentFile = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav__links a").forEach(function (link) {
    const linkFile = link.getAttribute("href");
    if (linkFile === currentFile) {
      link.setAttribute("aria-current", "page");
    }
  });
}

/* ---------- 3. Scroll-reveal animation ---------- */
function initScrollReveal() {
  const items = document.querySelectorAll(".reveal:not([data-observed])");
  if (!items.length) return;

  // If the browser doesn't support IntersectionObserver, just show everything.
  if (!("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          obs.unobserve(entry.target); // only animate once
        }
      });
    },
    { threshold: 0.15 }
  );

  // Mark each element as "already being watched" so calling this function
  // again later (after CMS content loads in) doesn't double-observe items.
  items.forEach((el) => {
    el.setAttribute("data-observed", "true");
    observer.observe(el);
  });
}

/* ---------- 4. Testimonial slider (homepage) ---------- */
// Builds its slides from data/testimonials.json, then wires up the
// dot-navigation/autoplay behaviour once the slides exist.
async function renderTestimonials() {
  const slider = document.querySelector(".testimonial-slider");
  if (!slider) return;

  const track = slider.querySelector(".testimonial-slider__track");
  const nav = slider.querySelector(".testimonial-slider__nav");
  const data = await loadJSON("data/testimonials.json");
  const items = onlyPublished(data);

  if (!items.length) {
    track.innerHTML = contentErrorMessage();
    return;
  }

  track.innerHTML = items.map((t) => testimonialCardHTML(t)).join("");
  nav.innerHTML = "";
  wireTestimonialSlider(track, nav);
}

function wireTestimonialSlider(track, nav) {
  const slides = Array.from(track.children);
  let current = 0;
  let timer = null;

  slides.forEach(function (_, index) {
    const dot = document.createElement("button");
    dot.className = "testimonial-slider__dot";
    dot.type = "button";
    dot.setAttribute("aria-label", "Show testimonial " + (index + 1));
    dot.addEventListener("click", function () {
      goTo(index);
      resetTimer();
    });
    nav.appendChild(dot);
  });
  const dots = Array.from(nav.children);

  function goTo(index) {
    slides[current].style.display = "none";
    current = (index + slides.length) % slides.length;
    slides[current].style.display = "block";
    dots.forEach((d, i) => d.setAttribute("aria-current", i === current ? "true" : "false"));
  }

  function resetTimer() {
    clearInterval(timer);
    timer = setInterval(() => goTo(current + 1), 6000);
  }

  slides.forEach((s, i) => (s.style.display = i === 0 ? "block" : "none"));
  goTo(0);
  resetTimer();
}

/* ---------- 4b. Testimonials grid (full testimonials page) ---------- */
async function renderTestimonialsGrid() {
  const grid = document.getElementById("testimonials-grid");
  if (!grid) return;

  const data = await loadJSON("data/testimonials.json");
  const items = onlyPublished(data);
  if (!items.length) {
    grid.innerHTML = contentErrorMessage();
    return;
  }
  grid.innerHTML = items.map((t) => testimonialCardHTML(t, "reveal")).join("");
  initScrollReveal(); // re-run so the freshly-added cards get observed
}

function testimonialCardHTML(t, extraClass) {
  const stars = "★".repeat(clampStars(t.stars)) + "☆".repeat(5 - clampStars(t.stars));
  return (
    '<div class="testimonial' + (extraClass ? " " + extraClass : "") + '">' +
    '<span class="stars">' + stars + "</span>" +
    '<p class="quote">"' + escapeHTML(t.quote) + '"</p>' +
    '<p class="who">' + escapeHTML(t.name) + "</p>" +
    "</div>"
  );
}

function clampStars(n) {
  const num = Number(n) || 5;
  return Math.min(5, Math.max(1, num));
}

/* ---------- 5. FAQ accordion ---------- */
function initFaqAccordion() {
  const items = document.querySelectorAll(".faq-item");
  if (!items.length) return;

  items.forEach(function (item) {
    const question = item.querySelector(".faq-item__q");
    const answer = item.querySelector(".faq-item__a");

    question.addEventListener("click", function () {
      const isOpen = item.getAttribute("data-open") === "true";

      // Close every other item first (classic accordion behaviour)
      items.forEach(function (other) {
        other.setAttribute("data-open", "false");
        other.querySelector(".faq-item__a").style.maxHeight = null;
      });

      if (!isOpen) {
        item.setAttribute("data-open", "true");
        answer.style.maxHeight = answer.scrollHeight + "px";
      }
    });
  });
}

/* ---------- 6. Contact / booking form validation ---------- */
/*
  This site is a static site (no server/database), so the form
  below submits to Formspree (https://formspree.io) — a free
  service that emails you every submission. That is the easiest
  way for a beginner project to have a "working" contact form
  without needing to write or host any backend code.

  To make it work for your own copy of the site:
  1. Create a free account at https://formspree.io
  2. Create a new form and copy the endpoint URL it gives you
  3. Paste that URL into the `action="..."` attribute of the
     <form> tag in contact.html (see the README for details)
*/
function initFormValidation() {
  const form = document.querySelector("[data-validate]");
  if (!form) return;

  form.addEventListener("submit", function (event) {
    let isValid = true;

    form.querySelectorAll("[required]").forEach(function (field) {
      const wrapper = field.closest(".field");
      const value = field.value.trim();
      let fieldValid = value.length > 0;

      if (field.type === "email" && value) {
        fieldValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      }
      if (field.type === "tel" && value) {
        fieldValid = /^[0-9+()\-\s]{7,}$/.test(value);
      }

      wrapper.classList.toggle("has-error", !fieldValid);
      if (!fieldValid) isValid = false;
    });

    if (!isValid) {
      event.preventDefault();
      const firstError = form.querySelector(".has-error");
      if (firstError) firstError.querySelector("input, textarea, select").focus();
      showFormMessage(form, "error", "Please fix the highlighted fields before submitting.");
      return;
    }

    // If the form action still contains the placeholder, don't actually
    // submit anywhere — just show a friendly demo message instead.
    if (form.action.includes("YOUR_FORM_ID")) {
      event.preventDefault();
      showFormMessage(
        form,
        "success",
        "Demo mode: connect this form to Formspree (see README) to receive real messages. Your input passed validation!"
      );
      form.reset();
    }
    // Otherwise, let the form submit normally to Formspree.
  });
}

function showFormMessage(form, type, text) {
  let box = form.querySelector(".alert");
  if (!box) {
    box = document.createElement("div");
    form.prepend(box);
  }
  box.className = "alert alert--" + type;
  box.textContent = text;
  box.setAttribute("role", "status");
}

/* =========================================================
   7. SHARED CMS HELPERS
   ---------------------------------------------------------
   Small utility functions used by every CMS-driven section
   below. Keeping them here (instead of copy-pasting inside
   each render function) means a bug fix or improvement here
   automatically applies everywhere.
   ========================================================= */

// Fetches and parses a JSON file. Returns null (instead of throwing) if
// the file is missing or the site isn't running on a server, so callers
// can show a friendly message instead of crashing the page.
async function loadJSON(path) {
  try {
    const response = await fetch(path);
    if (!response.ok) throw new Error("Failed to load " + path);
    return await response.json();
  } catch (err) {
    console.error(err);
    return null;
  }
}

// Escapes text pulled from JSON before inserting it as HTML, so a stray
// "<" or "&" typed into the CMS can't break the page layout.
function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = String(str == null ? "" : str);
  return div.innerHTML;
}

function contentErrorMessage() {
  return (
    '<p class="form-note">Content failed to load. If you\'re viewing this file directly ' +
    "(file://), run a local server instead — see the README's " +
    '"Running the site locally" section.</p>'
  );
}

// PUBLISH / UNPUBLISH SUPPORT
// Every item edited through the CMS has a "published" true/false switch
// (see admin/config.yml). Rather than deleting an entry to hide it, an
// editor can flip this switch off — the item stays saved in the CMS but
// this function filters it out of what actually renders on the live
// site. This is what gives the CMS a genuine "unpublish" action.
function onlyPublished(data) {
  if (!data || !Array.isArray(data.items)) return [];
  return data.items.filter((item) => item.published !== false);
}

// MARKDOWN RENDERING
// Some CMS fields (course descriptions, announcement bodies, custom page
// content) are written as Markdown — e.g. **bold**, ## headings, lists —
// because it's a friendlier writing format than typing raw HTML. We use
// a small, well-known library called "marked" to turn that Markdown text
// into real HTML in the visitor's browser.
//
// Rather than adding a <script> tag to every single HTML page (which
// would load it even on pages that never use Markdown), we load it once,
// on demand, the first time any function actually needs it. This pattern
// is called "lazy loading" — it keeps pages that don't need it fast.
let markdownLibraryPromise = null;
function loadMarkdownLibrary() {
  if (markdownLibraryPromise) return markdownLibraryPromise; // already loading/loaded

  markdownLibraryPromise = new Promise(function (resolve, reject) {
    if (window.marked) {
      resolve(window.marked);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/marked/marked.min.js";
    script.onload = () => resolve(window.marked);
    script.onerror = () => reject(new Error("Could not load the Markdown library"));
    document.head.appendChild(script);
  });

  return markdownLibraryPromise;
}

// Converts a Markdown string to an HTML string, ready to insert into the
// page. Falls back to plain escaped text (still safe, just unformatted)
// if the Markdown library can't be loaded — e.g. no internet connection.
async function renderMarkdown(markdownText) {
  if (!markdownText) return "";
  try {
    const marked = await loadMarkdownLibrary();
    // marked.parse() trusts its input to contain real HTML tags (that's
    // how Markdown supports things like embedded links/images). Because
    // only trusted site editors can write this content through the CMS
    // (protected by Identity login), that trade-off is safe here.
    return marked.parse(markdownText);
  } catch (err) {
    console.error(err);
    return "<p>" + escapeHTML(markdownText) + "</p>";
  }
}

/* =========================================================
   8. SITE SETTINGS — theme colours, logo/favicon, contact info
   ---------------------------------------------------------
   Reads data/settings.json (edited via the CMS "Site Settings"
   collection) and applies it to the current page:
     - Swaps the favicon and every logo image on the page
     - Re-colours the site's theme by overwriting the CSS
       variables defined in css/style.css (:root { ... })
     - Fills in the footer's contact details
   This is what lets a non-technical editor change "the school's
   colours" or "the site icon" from a form, without opening any
   CSS or HTML file.
   ========================================================= */
async function applySiteSettings() {
  const settings = await loadJSON("data/settings.json");
  if (!settings) return; // fall back silently to what's already in the HTML/CSS

  applyFavicon(settings.favicon);
  applyLogo(settings.logo);
  applyTheme(settings.theme);
  renderFooterContact(settings);
}

function applyFavicon(faviconPath) {
  if (!faviconPath) return;
  const iconLink = document.querySelector('link[rel="icon"]');
  if (iconLink) iconLink.setAttribute("href", faviconPath);
}

function applyLogo(logoPath) {
  if (!logoPath) return;
  // There can be more than one logo <img> on a page (currently just the
  // one in the header), so we update all of them at once.
  document.querySelectorAll(".brand__logo").forEach((img) => {
    img.setAttribute("src", logoPath);
  });
}

// Overwrites the CSS custom properties (variables) declared in the
// :root {} section at the top of css/style.css. Because every component
// in the stylesheet already uses var(--color-line) etc. instead of a
// hard-coded colour, changing these three values re-colours the entire
// site instantly — no separate "dark mode" or "theme B" CSS file needed.
function applyTheme(theme) {
  if (!theme) return;
  const root = document.documentElement.style;
  if (theme.primary_color) root.setProperty("--color-line", theme.primary_color);
  if (theme.asphalt_color) root.setProperty("--color-asphalt", theme.asphalt_color);
  if (theme.accent_color) root.setProperty("--color-stop", theme.accent_color);
}

function renderFooterContact(settings) {
  const list = document.getElementById("footer-contact");
  if (!list || !settings.branches || !settings.branches.length) return;

  const primaryBranch = settings.branches[0];
  const phone = (settings.contact && settings.contact.phone_primary) || primaryBranch.phone;
  const email = (settings.contact && settings.contact.email) || "";

  list.innerHTML =
    "<li>" + escapeHTML(primaryBranch.address) + "</li>" +
    "<li>" + escapeHTML(phone) + "</li>" +
    "<li>" + escapeHTML(email) + "</li>";
}

/* ---------- 8b. Floating WhatsApp button ---------- */
// A small, modern touch borrowed from lots of business sites: a sticky
// round button, bottom-right, that opens a WhatsApp chat directly. It
// reads the phone number straight from settings.json, so there is only
// ONE place to update the number — nothing to edit across 8 HTML files.
async function renderFloatingWhatsApp() {
  if (document.querySelector(".float-whatsapp")) return; // don't add it twice
  const settings = await loadJSON("data/settings.json");
  const rawPhone = settings && settings.contact && settings.contact.phone_primary;
  if (!rawPhone) return;

  const digitsOnly = String(rawPhone).replace(/[^0-9]/g, "");
  const link = document.createElement("a");
  link.className = "float-whatsapp";
  link.href = "https://wa.me/" + digitsOnly;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.setAttribute("aria-label", "Chat with us on WhatsApp");
  link.innerHTML =
    '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16.02 3C9.4 3 4 8.4 4 15.02c0 2.36.66 4.56 1.8 6.44L4 29l7.72-1.76a12 12 0 0 0 4.3.8h.01c6.62 0 12.02-5.4 12.02-12.02C28.05 8.4 22.65 3 16.02 3zm7.02 17.02c-.3.84-1.5 1.55-2.44 1.75-.65.13-1.5.24-4.36-.94-3.66-1.5-6.02-5.2-6.2-5.44-.18-.24-1.48-1.97-1.48-3.76s.94-2.66 1.28-3.03c.3-.32.65-.4.87-.4.22 0 .43.01.62.02.2.01.46-.08.72.55.3.72.99 2.46 1.08 2.64.09.18.15.4.03.64-.12.24-.18.4-.36.6-.18.2-.38.46-.54.62-.18.18-.36.37-.16.72.2.36.9 1.48 1.94 2.4 1.34 1.19 2.46 1.56 2.82 1.74.36.18.57.15.78-.09.2-.24.9-1.04 1.14-1.4.24-.36.48-.3.8-.18.32.12 2.06.97 2.42 1.15.36.18.6.27.68.42.09.16.09.9-.2 1.75z"/></svg>';
  document.body.appendChild(link);
}

/* =========================================================
   9. CMS CONTENT — Instructors / Gallery / Courses / Announcements
   ========================================================= */

/* ---------- 9a. Instructors ---------- */
async function renderInstructors() {
  const grid = document.getElementById("instructors-grid");
  if (!grid) return;

  const data = await loadJSON("data/instructors.json");
  const items = onlyPublished(data);
  if (!items.length) {
    grid.innerHTML = contentErrorMessage();
    return;
  }

  grid.innerHTML = items
    .map(
      (p) =>
        '<div class="person reveal">' +
        '<img src="' + escapeHTML(p.photo) + '" alt="Portrait of instructor ' + escapeHTML(p.name) + '" />' +
        '<div class="person__body">' +
        '<span class="person__role">' + escapeHTML(p.role) + "</span>" +
        "<h3>" + escapeHTML(p.name) + "</h3>" +
        "<p>" + escapeHTML(p.bio) + "</p>" +
        "</div></div>"
    )
    .join("");
  initScrollReveal();
}

/* ---------- 9b. Gallery ---------- */
async function renderGallery() {
  const grid = document.getElementById("gallery-grid");
  if (!grid) return;

  const data = await loadJSON("data/gallery.json");
  const items = onlyPublished(data);
  if (!items.length) {
    grid.innerHTML = contentErrorMessage();
    return;
  }

  grid.innerHTML = items
    .map((g) => '<img src="' + escapeHTML(g.image) + '" alt="' + escapeHTML(g.alt) + '" />')
    .join("");
}

/* ---------- 9c. Courses ---------- */
// Course descriptions are written in Markdown via the CMS, so this
// function is async all the way through: it waits for each description
// to be converted to HTML before building the final card markup.
async function renderCourses() {
  const containers = document.querySelectorAll("[data-courses]");
  if (!containers.length) return;

  const data = await loadJSON("data/courses.json");
  const items = onlyPublished(data);
  if (!items.length) {
    containers.forEach((c) => (c.innerHTML = contentErrorMessage()));
    return;
  }

  const cardsHTML = await Promise.all(items.map(courseCardHTML));
  const html = cardsHTML.join("");
  containers.forEach((c) => (c.innerHTML = html));
  initScrollReveal();
}

async function courseCardHTML(course) {
  const featuredClass = course.featured ? " card--featured" : "";
  const buttonClass = course.featured ? "btn--primary" : "btn--ghost";
  const features = (course.features || [])
    .map((f) => "<li>" + escapeHTML(f) + "</li>")
    .join("");
  const descriptionHTML = await renderMarkdown(course.description);
  return (
    '<div class="card card--price reveal' + featuredClass + '">' +
    "<h3>" + escapeHTML(course.name) + "</h3>" +
    '<p class="price">' + escapeHTML(course.price) + "</p>" +
    '<div class="course-description">' + descriptionHTML + "</div>" +
    "<ul>" + features + "</ul>" +
    '<a href="contact.html" class="btn ' + buttonClass + ' btn--block">Enrol Now</a>' +
    "</div>"
  );
}

/* ---------- 9d. Announcements / news ---------- */
// Announcement bodies are also Markdown, so this is async for the same
// reason as courses above.
async function renderAnnouncements() {
  const list = document.getElementById("announcements-list");
  if (!list) return;

  const data = await loadJSON("data/announcements.json");
  const items = onlyPublished(data)
    .slice() // copy the array before sorting, so we don't mutate the original
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 3); // newest 3 only, on the homepage

  if (!items.length) {
    list.innerHTML = contentErrorMessage();
    return;
  }

  const cardsHTML = await Promise.all(
    items.map(async (a) => {
      const bodyHTML = await renderMarkdown(a.body);
      return (
        '<div class="card reveal">' +
        '<span class="person__role">' + formatDate(a.date) + "</span>" +
        "<h3>" + escapeHTML(a.title) + "</h3>" +
        '<div class="announcement-body">' + bodyHTML + "</div>" +
        "</div>"
      );
    })
  );

  list.innerHTML = cardsHTML.join("");
  initScrollReveal();
}

function formatDate(isoDate) {
  const d = new Date(isoDate);
  if (isNaN(d)) return escapeHTML(isoDate);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/* =========================================================
   10. CUSTOM PAGES (created via the CMS "Pages" collection)
   ---------------------------------------------------------
   Only does anything on page.html. Reads the ?slug=... part of
   the URL, fetches the matching file from data/pages/, and fills
   in the title/heading/body — converting the Markdown body to
   HTML on the way. See page.html for the full explanation of how
   this generic-page system works and its one manual step (adding
   a nav link) when you publish a brand-new page.
   ========================================================= */
async function renderCustomPage() {
  const titleEl = document.getElementById("page-title");
  const bodyEl = document.getElementById("page-body");
  if (!titleEl || !bodyEl) return; // not on page.html

  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug");

  if (!slug) {
    titleEl.textContent = "Page not found";
    bodyEl.innerHTML = "<p>No page was specified. Check the link you followed, or " +
      '<a href="index.html">return to the homepage</a>.</p>';
    return;
  }

  const page = await loadJSON("data/pages/" + slug + ".json");

  if (!page || page.published === false) {
    titleEl.textContent = "Page not found";
    bodyEl.innerHTML = "<p>This page doesn't exist or isn't published yet. " +
      '<a href="index.html">Return to the homepage</a>.</p>';
    return;
  }

  document.title = page.title + " — Chimwemwe Driving School2";
  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription && page.meta_description) {
    metaDescription.setAttribute("content", page.meta_description);
  }

  titleEl.textContent = page.title;
  bodyEl.innerHTML = await renderMarkdown(page.body);
}
