/* =========================================================
   CHIMWEMWE DRIVING SCHOOL — SITE SCRIPT
   ---------------------------------------------------------
   This file is plain, framework-free JavaScript. Every feature
   below is wrapped in a small function and only runs if the
   matching element actually exists on the page (see the "if"
   guards). That means you can copy this one file onto every
   page of the site and each page will only use the parts it
   needs — nothing breaks if a page doesn't have, say, a
   testimonial slider.

   Sections:
   1. Mobile navigation toggle
   2. Highlight the current page in the nav
   3. Scroll-reveal animation (adds .is-visible to .reveal items)
   4. Testimonial slider
   5. FAQ accordion
   6. Contact / booking form validation + submission
   7. CMS-driven content (reads JSON files edited via /admin)
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {
  initMobileNav();
  highlightCurrentPage();
  initScrollReveal();
  initFaqAccordion();
  initFormValidation();

  // These all read their content from the /data/*.json files, which is
  // exactly what the CMS at /admin edits. Each function checks for its
  // own container and does nothing if that container isn't on this page.
  renderTestimonials();       // homepage slider (all items)
  renderTestimonialsGrid();   // full testimonials page (all items)
  renderInstructors();
  renderGallery();
  renderCourses();
  renderAnnouncements();
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
  const items = document.querySelectorAll(".reveal");
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

  items.forEach((el) => observer.observe(el));
}

/* ---------- 4. Testimonial slider (homepage) ---------- */
// Builds its slides from data/testimonials.json, then wires up the
// existing dot-navigation/autoplay behaviour once the slides exist.
async function renderTestimonials() {
  const slider = document.querySelector(".testimonial-slider");
  if (!slider) return;

  const track = slider.querySelector(".testimonial-slider__track");
  const nav = slider.querySelector(".testimonial-slider__nav");
  const data = await loadJSON("data/testimonials.json");

  if (!data || !data.items || !data.items.length) {
    track.innerHTML = contentErrorMessage();
    return;
  }

  track.innerHTML = data.items.map(testimonialCardHTML).join("");
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
  if (!data || !data.items || !data.items.length) {
    grid.innerHTML = contentErrorMessage();
    return;
  }
  grid.innerHTML = data.items
    .map((t) => testimonialCardHTML(t, "reveal"))
    .join("");
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

/* ---------- 7. CMS-driven content ---------- */
/*
  Everything below reads its content from the small JSON files in /data.
  Those are exactly the files the CMS at /admin edits — so updating a
  testimonial, instructor, gallery photo, course, or announcement in the
  CMS changes what these functions render here, with no other code
  changes needed.

  Note for local testing: fetch() cannot read local files when you open
  an .html file directly (file://) in some browsers. Always preview with
  a local server (see README, "Running the site locally") so these
  sections load correctly.
*/

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

/* ---------- 7a. Instructors ---------- */
async function renderInstructors() {
  const grid = document.getElementById("instructors-grid");
  if (!grid) return;

  const data = await loadJSON("data/instructors.json");
  if (!data || !data.items || !data.items.length) {
    grid.innerHTML = contentErrorMessage();
    return;
  }

  grid.innerHTML = data.items
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

/* ---------- 7b. Gallery ---------- */
async function renderGallery() {
  const grid = document.getElementById("gallery-grid");
  if (!grid) return;

  const data = await loadJSON("data/gallery.json");
  if (!data || !data.items || !data.items.length) {
    grid.innerHTML = contentErrorMessage();
    return;
  }

  grid.innerHTML = data.items
    .map((g) => '<img src="' + escapeHTML(g.image) + '" alt="' + escapeHTML(g.alt) + '" />')
    .join("");
}

/* ---------- 7c. Courses ---------- */
async function renderCourses() {
  const containers = document.querySelectorAll("[data-courses]");
  if (!containers.length) return;

  const data = await loadJSON("data/courses.json");
  if (!data || !data.items || !data.items.length) {
    containers.forEach((c) => (c.innerHTML = contentErrorMessage()));
    return;
  }

  const html = data.items.map(courseCardHTML).join("");
  containers.forEach((c) => (c.innerHTML = html));
  initScrollReveal();
}

function courseCardHTML(course) {
  const featuredClass = course.featured ? " card--featured" : "";
  const buttonClass = course.featured ? "btn--primary" : "btn--ghost";
  const features = (course.features || [])
    .map((f) => "<li>" + escapeHTML(f) + "</li>")
    .join("");
  return (
    '<div class="card card--price reveal' + featuredClass + '">' +
    "<h3>" + escapeHTML(course.name) + "</h3>" +
    '<p class="price">' + escapeHTML(course.price) + "</p>" +
    "<p>" + escapeHTML(course.description) + "</p>" +
    "<ul>" + features + "</ul>" +
    '<a href="contact.html" class="btn ' + buttonClass + ' btn--block">Enrol Now</a>' +
    "</div>"
  );
}

/* ---------- 7d. Announcements / news ---------- */
async function renderAnnouncements() {
  const list = document.getElementById("announcements-list");
  if (!list) return;

  const data = await loadJSON("data/announcements.json");
  if (!data || !data.items || !data.items.length) {
    list.innerHTML = contentErrorMessage();
    return;
  }

  // Newest first, show the 3 most recent
  const items = data.items
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 3);

  list.innerHTML = items
    .map(
      (a) =>
        '<div class="card reveal">' +
        '<span class="person__role">' + formatDate(a.date) + "</span>" +
        "<h3>" + escapeHTML(a.title) + "</h3>" +
        "<p>" + escapeHTML(a.body) + "</p>" +
        "</div>"
    )
    .join("");
  initScrollReveal();
}

function formatDate(isoDate) {
  const d = new Date(isoDate);
  if (isNaN(d)) return escapeHTML(isoDate);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
