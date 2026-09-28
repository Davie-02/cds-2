/* =========================================================
   CHIMWEMWE DRIVING SCHOOL2 — SITE SCRIPT
   ---------------------------------------------------------
   This file is plain, framework-free JavaScript, loaded with
   `defer` on every page (so it never blocks the page from
   drawing). Every feature below is wrapped in a small function
   and only runs if the matching element actually exists on the
   page — each page only uses the parts it needs, and nothing
   breaks if a page doesn't have, say, a testimonial slider.

   Sections:
   1. Shared helpers (fetch JSON once, escape text, Markdown…)
   2. Navigation, reveal animations, counters
   3. Site settings — theme, logo, footer, WhatsApp, action bar
   4. Announcement banner + news
   5. Courses, FAQs, instructors, gallery (+ lightbox)
   6. Testimonials (slider + grid)
   7. Booking form (validation, sending, WhatsApp fallback)
   8. Theory practice test
   9. Custom pages (page.html?slug=...)
   10. Offline support (service worker)

   Everything reads from the small JSON files in /data — which is
   exactly what the CMS at /admin edits. So an editor filling in
   a form at /admin changes what gets rendered here, with no
   other code changes ever needed.
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {
  initMobileNav();
  highlightCurrentPage();
  initScrollReveal();
  setFooterYear();

  applySiteSettings();        // theme, logo, footer, WhatsApp button, mobile action bar
  renderAnnouncementBar();    // site-wide banner (if one is current)
  renderAnnouncements();      // homepage news cards
  renderStats();
  renderCourses();
  renderFaqs();
  renderBranches();
  renderInstructors();
  renderGallery();
  renderTestimonials();       // homepage slider
  renderTestimonialsGrid();   // full testimonials page
  initBookingForm();
  initTheoryTest();
  renderCustomPage();         // only does anything on page.html

  registerServiceWorker();
});


/* =========================================================
   1. SHARED HELPERS
   ========================================================= */

// Fetches and parses a JSON file — ONCE per page view. Several features
// need data/settings.json, for example; they all share the same request
// instead of each downloading it again. Returns null (instead of
// throwing) if the file is missing, so callers can show a friendly message.
const jsonCache = {};
function loadJSON(path) {
  if (!jsonCache[path]) {
    jsonCache[path] = fetch(path)
      .then(function (response) {
        if (!response.ok) throw new Error("Failed to load " + path);
        return response.json();
      })
      .catch(function (err) {
        console.error(err);
        return null;
      });
  }
  return jsonCache[path];
}

function getSettings() {
  return loadJSON("data/settings.json");
}

// Escapes text pulled from JSON before inserting it as HTML, so a stray
// "<" or "&" typed into the CMS can't break the page layout.
function escapeHTML(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function contentErrorMessage() {
  return (
    '<p class="form-note">Content failed to load. Please refresh the page. ' +
    "(Viewing the files directly? Run a local server — see the README.)</p>"
  );
}

// PUBLISH / UNPUBLISH / EXPIRY SUPPORT
// Every item edited through the CMS has a "published" switch. Items can
// also have an optional "expires" date (e.g. a special offer) — after
// that date they disappear from the site automatically.
function onlyPublished(data) {
  if (!data || !Array.isArray(data.items)) return [];
  const today = todayISO();
  return data.items.filter(function (item) {
    if (item.published === false) return false;
    if (item.expires && String(item.expires).slice(0, 10) < today) return false;
    return true;
  });
}

function todayISO() {
  const d = new Date();
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}
function pad(n) { return (n < 10 ? "0" : "") + n; }

function formatDate(isoDate) {
  const d = new Date(isoDate);
  if (isNaN(d)) return escapeHTML(isoDate);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function digitsOnly(phone) {
  return String(phone || "").replace(/[^0-9]/g, "");
}

function whatsappLink(phone, message) {
  const number = digitsOnly(phone);
  if (!number) return "";
  return "https://wa.me/" + number + (message ? "?text=" + encodeURIComponent(message) : "");
}

function telLink(phone) {
  return "tel:+" + digitsOnly(phone);
}

// RESPONSIVE IMAGES
// Photos hosted on Unsplash can be resized on the fly, so we ask for
// exactly the width the visitor's screen needs (and let Unsplash pick
// WebP/AVIF automatically). Local uploads are used as-is.
function imageAttrs(url, displayWidth, alt) {
  const safeAlt = ' alt="' + escapeHTML(alt) + '"';
  const base = ' loading="lazy" decoding="async"';
  if (/^https:\/\/images\.unsplash\.com\//.test(url)) {
    const clean = url.split("?")[0];
    const sized = function (w) { return clean + "?auto=format&fit=crop&q=70&w=" + w; };
    return (
      ' src="' + sized(displayWidth) + '"' +
      ' srcset="' + sized(Math.round(displayWidth / 2)) + " " + Math.round(displayWidth / 2) + "w, " +
      sized(displayWidth) + " " + displayWidth + "w, " +
      sized(displayWidth * 2) + " " + displayWidth * 2 + 'w"' +
      ' sizes="(max-width: 680px) 100vw, ' + displayWidth + 'px"' + safeAlt + base
    );
  }
  return ' src="' + escapeHTML(url) + '"' + safeAlt + base;
}

// MARKDOWN RENDERING
// Some CMS fields (course descriptions, announcements, FAQ answers,
// custom pages) are written in Markdown. The "marked" library that
// converts it is stored on our own server (js/vendor/) and only loaded
// the first time a page actually needs it — "lazy loading".
let markdownLibraryPromise = null;
function loadMarkdownLibrary() {
  if (markdownLibraryPromise) return markdownLibraryPromise;
  markdownLibraryPromise = new Promise(function (resolve, reject) {
    if (window.marked) return resolve(window.marked);
    const script = document.createElement("script");
    script.src = "js/vendor/marked-15.0.12.min.js";
    script.onload = function () { resolve(window.marked); };
    script.onerror = function () { reject(new Error("Could not load the Markdown library")); };
    document.head.appendChild(script);
  });
  return markdownLibraryPromise;
}

async function renderMarkdown(markdownText) {
  if (!markdownText) return "";
  try {
    const marked = await loadMarkdownLibrary();
    // Only trusted site editors (logged in to the CMS) can write this
    // content, so allowing HTML inside Markdown is a safe trade-off.
    return marked.parse(markdownText);
  } catch (err) {
    console.error(err);
    return "<p>" + escapeHTML(markdownText) + "</p>";
  }
}

const ICONS = {
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6l-10 7L2 6"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
  whatsapp: '<svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true"><path d="M16.02 3C9.4 3 4 8.4 4 15.02c0 2.36.66 4.56 1.8 6.44L4 29l7.72-1.76a12 12 0 0 0 4.3.8h.01c6.62 0 12.02-5.4 12.02-12.02C28.05 8.4 22.65 3 16.02 3zm7.02 17.02c-.3.84-1.5 1.55-2.44 1.75-.65.13-1.5.24-4.36-.94-3.66-1.5-6.02-5.2-6.2-5.44-.18-.24-1.48-1.97-1.48-3.76s.94-2.66 1.28-3.03c.3-.32.65-.4.87-.4.22 0 .43.01.62.02.2.01.46-.08.72.55.3.72.99 2.46 1.08 2.64.09.18.15.4.03.64-.12.24-.18.4-.36.6-.18.2-.38.46-.54.62-.18.18-.36.37-.16.72.2.36.9 1.48 1.94 2.4 1.34 1.19 2.46 1.56 2.82 1.74.36.18.57.15.78-.09.2-.24.9-1.04 1.14-1.4.24-.36.48-.3.8-.18.32.12 2.06.97 2.42 1.15.36.18.6.27.68.42.09.16.09.9-.2 1.75z"/></svg>',
  facebook: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 8h3V4h-3a4 4 0 0 0-4 4v2H8v4h2v8h4v-8h3l1-4h-4V8z"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 8.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4zM17.3 5.5a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4zM12 2c-2.7 0-3 0-4.1.1C4.2 2.3 2.3 4.2 2.1 7.9 2 9 2 9.3 2 12s0 3 .1 4.1c.2 3.7 2.1 5.6 5.8 5.8 1.1.1 1.4.1 4.1.1s3 0 4.1-.1c3.7-.2 5.6-2.1 5.8-5.8.1-1.1.1-1.4.1-4.1s0-3-.1-4.1c-.2-3.7-2.1-5.6-5.8-5.8C15 2 14.7 2 12 2z"/></svg>',
  tiktok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16.6 2h-3.4v13.3a2.9 2.9 0 1 1-2-2.8V9a6.3 6.3 0 1 0 5.4 6.3V8.6a8 8 0 0 0 4.4 1.3V6.5a4.4 4.4 0 0 1-4.4-4.5z"/></svg>'
};


/* =========================================================
   2. NAVIGATION, REVEAL ANIMATIONS, COUNTERS
   ========================================================= */

function initMobileNav() {
  const toggle = document.querySelector(".nav__toggle");
  const links = document.querySelector(".nav__links");
  const header = document.querySelector(".site-header");
  if (!toggle || !links) return;

  function setOpen(isOpen) {
    if (isOpen && header) {
      // Start the menu right under the header, wherever it currently is
      // (it can be lower when the announcement banner is showing).
      links.style.setProperty("--menu-top", header.getBoundingClientRect().bottom + "px");
    }
    links.classList.toggle("is-open", isOpen);
    document.body.classList.toggle("nav-open", isOpen);
    toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    toggle.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
  }

  toggle.addEventListener("click", function () {
    setOpen(!links.classList.contains("is-open"));
  });
  links.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () { setOpen(false); });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && links.classList.contains("is-open")) {
      setOpen(false);
      toggle.focus();
    }
  });
}

function highlightCurrentPage() {
  const currentFile = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav__links a").forEach(function (link) {
    const linkFile = link.getAttribute("href");
    // Netlify serves "about.html" at "/about" too, so compare without ".html"
    if (linkFile.replace(".html", "") === currentFile.replace(".html", "")) {
      link.setAttribute("aria-current", "page");
    }
  });
}

let revealObserver = null;
function initScrollReveal() {
  const items = document.querySelectorAll(".reveal:not([data-observed])");
  if (!items.length) return;

  if (!("IntersectionObserver" in window)) {
    items.forEach(function (el) { el.classList.add("is-visible"); });
    return;
  }

  if (!revealObserver) {
    revealObserver = new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            obs.unobserve(entry.target); // only animate once
            if (entry.target.hasAttribute("data-count")) animateCount(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );
  }

  // Mark each element as "already being watched" so calling this function
  // again later (after CMS content loads in) doesn't double-observe items.
  items.forEach(function (el) {
    el.setAttribute("data-observed", "true");
    revealObserver.observe(el);
  });
}

// Counts a number up from 0 (e.g. "600+" in the hero stats) the first
// time it scrolls into view. Keeps any prefix/suffix like "+" or "%".
function animateCount(el) {
  const text = el.getAttribute("data-count");
  const match = text.match(/^(\D*)([\d,]+)(.*)$/);
  if (!match || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const target = parseInt(match[2].replace(/,/g, ""), 10);
  const start = performance.now();
  const duration = 1200;
  function tick(now) {
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = match[1] + Math.round(target * eased).toLocaleString("en-GB") + match[3];
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function setFooterYear() {
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });
}


/* =========================================================
   3. SITE SETTINGS — theme colours, logo, contact details
   ---------------------------------------------------------
   Reads data/settings.json (the CMS "Site Settings" screen) so a
   non-technical editor can change the school's colours, logo,
   phone numbers or branches from a form, without opening any
   CSS or HTML file.
   ========================================================= */
async function applySiteSettings() {
  const settings = await getSettings();
  if (!settings) return; // fall back silently to what's already in the HTML/CSS

  applyFavicon(settings.favicon);
  applyLogo(settings.logo);
  applyTheme(settings.theme);
  renderFooterContact(settings);
  renderContactShortcuts(settings);
  injectStructuredData(settings);
}

function applyFavicon(faviconPath) {
  if (!faviconPath) return;
  const iconLink = document.querySelector('link[rel="icon"]');
  if (iconLink && iconLink.getAttribute("href") !== faviconPath) iconLink.setAttribute("href", faviconPath);
}

function applyLogo(logoPath) {
  if (!logoPath) return;
  document.querySelectorAll(".brand__logo").forEach(function (img) {
    // Only swap if the editor actually changed the logo, so the browser
    // doesn't re-request the same image.
    if (img.getAttribute("src") !== logoPath) img.setAttribute("src", logoPath);
  });
}

// Overwrites the CSS custom properties declared in :root {} at the top of
// css/style.css — every component uses var(--color-line) etc., so this
// re-colours the whole site instantly.
function applyTheme(theme) {
  if (!theme) return;
  const root = document.documentElement.style;
  if (theme.primary_color) root.setProperty("--color-line", theme.primary_color);
  if (theme.asphalt_color) root.setProperty("--color-asphalt", theme.asphalt_color);
  if (theme.accent_color) root.setProperty("--color-stop", theme.accent_color);
}

function primaryPhone(settings) {
  const c = settings.contact || {};
  return c.phone_primary || (settings.branches && settings.branches[0] && settings.branches[0].phone) || "";
}

function whatsappNumber(settings) {
  const c = settings.contact || {};
  return c.whatsapp || c.phone_primary || "";
}

function renderFooterContact(settings) {
  const list = document.getElementById("footer-contact");
  if (!list) return;

  const phone = primaryPhone(settings);
  const phone2 = settings.contact && settings.contact.phone_secondary;
  const email = settings.contact && settings.contact.email;
  const wa = whatsappLink(whatsappNumber(settings), "Hello, I would like more information.");
  const branches = (settings.branches || []).map(function (b) { return escapeHTML(b.name); }).join(" · ");

  let html = "";
  if (branches) html += "<li>" + branches + "</li>";
  if (phone) html += '<li><a href="' + telLink(phone) + '">' + escapeHTML(phone) + "</a></li>";
  if (phone2) html += '<li><a href="' + telLink(phone2) + '">' + escapeHTML(phone2) + "</a></li>";
  if (wa) html += '<li><a href="' + wa + '" target="_blank" rel="noopener">WhatsApp us</a></li>';
  if (email) html += '<li><a href="mailto:' + escapeHTML(email) + '">' + escapeHTML(email) + "</a></li>";
  list.innerHTML = html;

  const social = document.getElementById("footer-social");
  if (social && settings.social) {
    social.innerHTML = ["facebook", "instagram", "tiktok"]
      .filter(function (key) { return /^https?:\/\//.test(settings.social[key] || ""); })
      .map(function (key) {
        return '<a href="' + escapeHTML(settings.social[key]) + '" target="_blank" rel="noopener" aria-label="' + key + '">' + ICONS[key] + "</a>";
      })
      .join("");
  }
}

// Floating WhatsApp button (desktop) + sticky Call / WhatsApp / Book bar
// (phones). Both read the numbers from settings.json, so there is only
// ONE place to update them.
function renderContactShortcuts(settings) {
  if (document.querySelector(".float-whatsapp") || document.body.hasAttribute("data-no-shortcuts")) return;
  const wa = whatsappLink(whatsappNumber(settings), "Hello, I would like more information about driving lessons.");
  const phone = primaryPhone(settings);

  if (wa) {
    const link = document.createElement("a");
    link.className = "float-whatsapp";
    link.href = wa;
    link.target = "_blank";
    link.rel = "noopener";
    link.setAttribute("aria-label", "Chat with us on WhatsApp");
    link.innerHTML = ICONS.whatsapp;
    document.body.appendChild(link);
  }

  const bar = document.createElement("nav");
  bar.className = "action-bar";
  bar.setAttribute("aria-label", "Quick contact");
  bar.innerHTML =
    (phone ? '<a href="' + telLink(phone) + '">' + ICONS.phone + "Call</a>" : "") +
    (wa ? '<a href="' + wa + '" target="_blank" rel="noopener">' + ICONS.whatsapp + "WhatsApp</a>" : "") +
    '<a href="contact.html#book" class="action-bar__book">' + ICONS.calendar + "Book</a>";
  bar.style.gridTemplateColumns = "repeat(" + bar.children.length + ", 1fr)";
  document.body.appendChild(bar);
  document.body.classList.add("has-action-bar");
}

// Tells search engines (Google Maps / local search) exactly what this
// business is, where its branches are and how to contact it. Generated
// from settings.json so it can never go out of date with the site.
function injectStructuredData(settings) {
  if (!document.body.hasAttribute("data-home")) return;
  const origin = window.location.origin + "/";
  const data = {
    "@context": "https://schema.org",
    "@type": "DrivingSchool",
    name: settings.site_name,
    slogan: settings.tagline,
    url: origin,
    logo: new URL(settings.logo || "images/logo.png", origin).href,
    image: new URL("images/icon-512.png", origin).href,
    telephone: primaryPhone(settings),
    email: settings.contact && settings.contact.email,
    areaServed: "Malawi",
    sameAs: Object.values(settings.social || {}).filter(function (u) { return /^https?:\/\//.test(u); }),
    department: (settings.branches || []).map(function (b) {
      return {
        "@type": "DrivingSchool",
        name: settings.site_name + " — " + b.name,
        telephone: b.phone,
        address: { "@type": "PostalAddress", streetAddress: b.address, addressCountry: "MW" }
      };
    })
  };
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
}

// Hero statistics ("600+ licensed graduates" etc.) — editable in the CMS.
async function renderStats() {
  const wrap = document.querySelector("[data-stats]");
  if (!wrap) return;
  const settings = await getSettings();
  if (settings && Array.isArray(settings.stats) && settings.stats.length) {
    wrap.innerHTML = settings.stats
      .map(function (s) {
        return '<div class="hero__stat"><strong data-count="' + escapeHTML(s.value) + '">' +
          escapeHTML(s.value) + "</strong><span>" + escapeHTML(s.label) + "</span></div>";
      })
      .join("");
  }
  wrap.querySelectorAll("[data-count]").forEach(animateCount);
}


/* =========================================================
   4. ANNOUNCEMENT BANNER + NEWS
   ========================================================= */

// A thin yellow bar above the header, on every page, for the newest
// announcement marked "Show as site-wide banner" in the CMS. Visitors can
// dismiss it; it stays dismissed until a different announcement is shown.
async function renderAnnouncementBar() {
  const bar = document.getElementById("announcement-bar");
  if (!bar) return;
  const data = await loadJSON("data/announcements.json");
  const banner = onlyPublished(data)
    .filter(function (a) { return a.banner; })
    .sort(function (a, b) { return new Date(b.date) - new Date(a.date); })[0];
  if (!banner) return;

  const key = "dismissed-banner:" + banner.title;
  try { if (localStorage.getItem(key)) return; } catch (e) { /* storage blocked — just show it */ }

  bar.innerHTML =
    '<div class="container"><span>' + escapeHTML(banner.title) +
    (banner.link ? ' — <a href="' + escapeHTML(banner.link) + '">Find out more</a>' : "") +
    '</span><button type="button" class="announcement-bar__close" aria-label="Dismiss announcement">&times;</button></div>';
  bar.hidden = false;
  bar.querySelector("button").addEventListener("click", function () {
    bar.hidden = true;
    try { localStorage.setItem(key, "1"); } catch (e) { /* ignore */ }
  });
}

async function renderAnnouncements() {
  const list = document.getElementById("announcements-list");
  if (!list) return;

  const data = await loadJSON("data/announcements.json");
  const items = onlyPublished(data)
    .slice()
    .sort(function (a, b) { return new Date(b.date) - new Date(a.date); })
    .slice(0, 3); // newest 3 only, on the homepage

  if (!items.length) {
    // No current news — hide the whole section rather than show an empty box
    const section = list.closest("section");
    if (section) section.hidden = true;
    return;
  }

  const cardsHTML = await Promise.all(
    items.map(async function (a) {
      const bodyHTML = await renderMarkdown(a.body);
      return (
        '<article class="card reveal">' +
        '<time class="person__role" datetime="' + escapeHTML(a.date) + '">' + formatDate(a.date) + "</time>" +
        "<h3>" + escapeHTML(a.title) + "</h3>" +
        '<div class="announcement-body">' + bodyHTML + "</div>" +
        (a.link ? '<a class="link-arrow" href="' + escapeHTML(a.link) + '">Read more</a>' : "") +
        "</article>"
      );
    })
  );

  list.innerHTML = cardsHTML.join("");
  initScrollReveal();
}


/* =========================================================
   5. COURSES, FAQS, BRANCHES, INSTRUCTORS, GALLERY
   ========================================================= */

async function renderCourses() {
  const containers = document.querySelectorAll("[data-courses]");
  if (!containers.length) return;

  const [data, settings] = await Promise.all([loadJSON("data/courses.json"), getSettings()]);
  const items = onlyPublished(data);
  if (!items.length) {
    containers.forEach(function (c) { c.innerHTML = contentErrorMessage(); });
    return;
  }

  const wa = settings ? whatsappNumber(settings) : "";
  const cardsHTML = await Promise.all(items.map(function (course) { return courseCardHTML(course, wa); }));
  const html = cardsHTML.join("");
  containers.forEach(function (c) { c.innerHTML = html; });
  initScrollReveal();
}

async function courseCardHTML(course, waNumber) {
  const name = String(course.name || "").trim();
  const featuredClass = course.featured ? " card--featured" : "";
  const buttonClass = course.featured ? "btn--primary" : "btn--dark";
  const features = (course.features || [])
    .map(function (f) { return "<li>" + escapeHTML(f) + "</li>"; })
    .join("");
  const descriptionHTML = await renderMarkdown(course.description);
  const bookHref = "contact.html?course=" + encodeURIComponent(name) + "#book";
  const askHref = whatsappLink(waNumber, "Hello, I'd like to know more about the " + name + " (" + course.price + ").");
  return (
    '<article class="card card--price reveal' + featuredClass + '">' +
    "<h3>" + escapeHTML(name) + "</h3>" +
    '<p class="price">' + escapeHTML(course.price) + "</p>" +
    '<div class="course-description">' + descriptionHTML + "</div>" +
    "<ul>" + features + "</ul>" +
    '<div class="card__actions">' +
    '<a href="' + bookHref + '" class="btn ' + buttonClass + ' btn--block">Enrol Now</a>' +
    (askHref ? '<a href="' + askHref + '" class="btn--link" target="_blank" rel="noopener">Ask about this course on WhatsApp</a>' : "") +
    "</div></article>"
  );
}

// FAQ list (Courses page) — native <details> elements, so they open and
// close without any JavaScript; this only fills them in from data/faqs.json.
async function renderFaqs() {
  const list = document.querySelector("[data-faqs]");
  if (!list) return;
  const items = onlyPublished(await loadJSON("data/faqs.json"));
  if (!items.length) return; // keep the fallback questions already in the HTML

  const html = await Promise.all(
    items.map(async function (f) {
      return '<details class="faq-item"><summary>' + escapeHTML(f.question) + '</summary>' +
        '<div class="faq-item__a">' + (await renderMarkdown(f.answer)) + "</div></details>";
    })
  );
  list.innerHTML = html.join("");
}

// Branch cards (home + contact pages) with click-to-call, WhatsApp and
// directions — all from the Branches list in Site Settings.
async function renderBranches() {
  const containers = document.querySelectorAll("[data-branches]");
  if (!containers.length) return;
  const settings = await getSettings();
  if (!settings || !Array.isArray(settings.branches) || !settings.branches.length) return;

  const wa = whatsappNumber(settings);
  const html = settings.branches
    .map(function (b) {
      const directions = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(b.address);
      const waHref = whatsappLink(b.whatsapp || wa, "Hello " + b.name + ", I would like more information.");
      return (
        '<article class="card card--static branch-card">' +
        "<h3>" + escapeHTML(b.name) + "</h3>" +
        '<p class="branch-card__row">' + ICONS.pin + "<span>" + escapeHTML(b.address) + "</span></p>" +
        (b.phone ? '<p class="branch-card__row">' + ICONS.phone + '<a href="' + telLink(b.phone) + '">' + escapeHTML(b.phone) + "</a></p>" : "") +
        (b.hours ? '<p class="branch-card__row">' + ICONS.clock + "<span>" + escapeHTML(b.hours) + "</span></p>" : "") +
        '<div class="branch-card__actions">' +
        (b.phone ? '<a class="btn btn--outline btn--sm" href="' + telLink(b.phone) + '">Call</a>' : "") +
        (waHref ? '<a class="btn btn--whatsapp btn--sm" href="' + waHref + '" target="_blank" rel="noopener">WhatsApp</a>' : "") +
        '<a class="btn btn--outline btn--sm" href="' + directions + '" target="_blank" rel="noopener">Directions</a>' +
        "</div></article>"
      );
    })
    .join("");
  containers.forEach(function (c) { c.innerHTML = html; });

  // Fill the "Preferred branch" dropdown on the booking form, too
  const select = document.getElementById("branch");
  if (select) {
    select.innerHTML = '<option value="">Select a branch</option>' +
      settings.branches.map(function (b) {
        return '<option value="' + escapeHTML(b.name) + '">' + escapeHTML(b.name) + " — " + escapeHTML(b.address) + "</option>";
      }).join("");
  }
}

// Click-to-load map: loads the OpenStreetMap iframe only when a visitor
// presses "Show map". Saves bandwidth for everyone who doesn't need it.
document.addEventListener("click", function (e) {
  const btn = e.target.closest("[data-load-map]");
  if (!btn) return;
  const facade = btn.closest(".map-facade");
  const iframe = document.createElement("iframe");
  iframe.title = btn.getAttribute("data-title") || "Map";
  iframe.src = btn.getAttribute("data-load-map");
  iframe.loading = "lazy";
  facade.innerHTML = "";
  facade.appendChild(iframe);
});

async function renderInstructors() {
  const grid = document.getElementById("instructors-grid");
  if (!grid) return;

  const items = onlyPublished(await loadJSON("data/instructors.json"));
  if (!items.length) {
    grid.innerHTML = contentErrorMessage();
    return;
  }

  grid.innerHTML = items
    .map(function (p) {
      return (
        '<article class="person reveal">' +
        "<img" + imageAttrs(p.photo, 400, "Portrait of instructor " + p.name) + ' width="400" height="500" />' +
        '<div class="person__body">' +
        '<span class="person__role">' + escapeHTML(p.role) + "</span>" +
        "<h3>" + escapeHTML(p.name) + "</h3>" +
        "<p>" + escapeHTML(p.bio) + "</p>" +
        "</div></article>"
      );
    })
    .join("");
  initScrollReveal();
}

async function renderGallery() {
  const grid = document.getElementById("gallery-grid");
  if (!grid) return;

  const items = onlyPublished(await loadJSON("data/gallery.json"));
  if (!items.length) {
    grid.innerHTML = contentErrorMessage();
    return;
  }

  grid.innerHTML = items
    .map(function (g, i) {
      return '<button type="button" class="masonry__item" data-index="' + i + '" aria-label="View larger: ' + escapeHTML(g.alt) + '">' +
        "<img" + imageAttrs(g.image, 600, g.alt) + " /></button>";
    })
    .join("");
  initLightbox(grid, items);
}

// Full-screen photo viewer with previous/next and keyboard arrows, built
// on the browser's native <dialog> element (handles focus + Esc for us).
function initLightbox(grid, items) {
  if (typeof HTMLDialogElement !== "function") return;
  const dialog = document.createElement("dialog");
  dialog.className = "lightbox";
  dialog.setAttribute("aria-label", "Photo viewer");
  dialog.innerHTML =
    '<figure><img alt="" /><figcaption></figcaption></figure>' +
    '<button type="button" class="lightbox__btn lightbox__close" aria-label="Close">&times;</button>' +
    '<button type="button" class="lightbox__btn lightbox__prev" aria-label="Previous photo">&#8249;</button>' +
    '<button type="button" class="lightbox__btn lightbox__next" aria-label="Next photo">&#8250;</button>';
  document.body.appendChild(dialog);

  const img = dialog.querySelector("img");
  const caption = dialog.querySelector("figcaption");
  let current = 0;

  function show(index) {
    current = (index + items.length) % items.length;
    const item = items[current];
    const url = /^https:\/\/images\.unsplash\.com\//.test(item.image)
      ? item.image.split("?")[0] + "?auto=format&q=75&w=1400"
      : item.image;
    img.src = url;
    img.alt = item.alt || "";
    caption.textContent = item.alt || "";
  }

  grid.addEventListener("click", function (e) {
    const btn = e.target.closest(".masonry__item");
    if (!btn) return;
    show(Number(btn.getAttribute("data-index")));
    dialog.showModal();
  });
  dialog.querySelector(".lightbox__close").addEventListener("click", function () { dialog.close(); });
  dialog.querySelector(".lightbox__prev").addEventListener("click", function () { show(current - 1); });
  dialog.querySelector(".lightbox__next").addEventListener("click", function () { show(current + 1); });
  dialog.addEventListener("keydown", function (e) {
    if (e.key === "ArrowLeft") show(current - 1);
    if (e.key === "ArrowRight") show(current + 1);
  });
  // Clicking the dark backdrop (outside the photo) closes the viewer
  dialog.addEventListener("click", function (e) {
    if (e.target === dialog) dialog.close();
  });
}


/* =========================================================
   6. TESTIMONIALS
   ========================================================= */

async function renderTestimonials() {
  const slider = document.querySelector(".testimonial-slider");
  if (!slider) return;

  const track = slider.querySelector(".testimonial-slider__track");
  const items = onlyPublished(await loadJSON("data/testimonials.json"));
  renderRatingSummary(items);

  if (!items.length) {
    track.innerHTML = contentErrorMessage();
    return;
  }

  track.innerHTML = items.map(function (t) { return testimonialCardHTML(t); }).join("");
  wireTestimonialSlider(slider, track);
}

function wireTestimonialSlider(slider, track) {
  const slides = Array.from(track.children);
  const nav = slider.querySelector(".testimonial-slider__nav");
  const prev = slider.querySelector("[data-slide-prev]");
  const next = slider.querySelector("[data-slide-next]");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let current = 0;
  let timer = null;

  nav.innerHTML = "";
  slides.forEach(function (_, index) {
    const dot = document.createElement("button");
    dot.className = "testimonial-slider__dot";
    dot.type = "button";
    dot.setAttribute("aria-label", "Show testimonial " + (index + 1));
    dot.addEventListener("click", function () { goTo(index); restart(); });
    nav.appendChild(dot);
  });
  const dots = Array.from(nav.children);

  function goTo(index) {
    current = (index + slides.length) % slides.length;
    slides.forEach(function (s, i) { s.hidden = i !== current; });
    dots.forEach(function (d, i) { d.setAttribute("aria-current", i === current ? "true" : "false"); });
  }
  function stop() { clearInterval(timer); timer = null; }
  function restart() {
    stop();
    if (!reduceMotion) timer = setInterval(function () { goTo(current + 1); }, 7000);
  }

  if (prev) prev.addEventListener("click", function () { goTo(current - 1); restart(); });
  if (next) next.addEventListener("click", function () { goTo(current + 1); restart(); });

  // Pause while the visitor is reading or interacting with it
  slider.addEventListener("mouseenter", stop);
  slider.addEventListener("mouseleave", restart);
  slider.addEventListener("focusin", stop);
  slider.addEventListener("focusout", restart);

  goTo(0);
  restart();
}

async function renderTestimonialsGrid() {
  const grid = document.getElementById("testimonials-grid");
  if (!grid) return;

  const items = onlyPublished(await loadJSON("data/testimonials.json"));
  renderRatingSummary(items);
  if (!items.length) {
    grid.innerHTML = contentErrorMessage();
    return;
  }
  grid.innerHTML = items.map(function (t) { return testimonialCardHTML(t, "reveal"); }).join("");
  initScrollReveal();
}

function renderRatingSummary(items) {
  const el = document.querySelector("[data-rating-summary]");
  if (!el || !items.length) return;
  const avg = items.reduce(function (sum, t) { return sum + clampStars(t.stars); }, 0) / items.length;
  el.innerHTML =
    "<strong>" + avg.toFixed(1) + '</strong><span class="stars" aria-hidden="true">' + starString(Math.round(avg)) + "</span>" +
    "<span>average from " + items.length + " student review" + (items.length === 1 ? "" : "s") + "</span>";
  el.hidden = false;
}

function testimonialCardHTML(t, extraClass) {
  const n = clampStars(t.stars);
  return (
    '<figure class="testimonial' + (extraClass ? " " + extraClass : "") + '">' +
    '<span class="stars" role="img" aria-label="' + n + ' out of 5 stars">' + starString(n) + "</span>" +
    '<blockquote><p class="quote">"' + escapeHTML(t.quote) + '"</p></blockquote>' +
    '<figcaption class="who">' + escapeHTML(t.name) + "</figcaption>" +
    "</figure>"
  );
}

function starString(n) { return "★".repeat(n) + "☆".repeat(5 - n); }

function clampStars(n) {
  const num = Number(n) || 5;
  return Math.min(5, Math.max(1, Math.round(num)));
}


/* =========================================================
   7. BOOKING FORM
   ---------------------------------------------------------
   Submissions go to Formspree (https://formspree.io), which
   emails them to the school — no server of our own needed.
   The form is sent in the background, so the visitor stays on
   the page and sees a clear confirmation. If sending ever fails
   (no signal, Formspree monthly limit reached…), the visitor is
   offered a one-tap "Send via WhatsApp" with everything they
   typed already filled in — so no booking is ever lost.
   ========================================================= */
async function initBookingForm() {
  const form = document.querySelector("[data-booking-form]");
  if (!form) return;

  // Earliest start date = today
  const dateInput = form.querySelector('input[type="date"]');
  if (dateInput) dateInput.min = todayISO();

  const [coursesData, settings] = await Promise.all([loadJSON("data/courses.json"), getSettings()]);
  const waNumber = settings ? whatsappNumber(settings) : "";

  // Fill "Course" options from courses.json and pre-select the course the
  // visitor clicked "Enrol Now" on (passed as ?course=... in the link).
  const courseSelect = form.querySelector("#course");
  const courses = onlyPublished(coursesData);
  if (courseSelect && courses.length) {
    courseSelect.innerHTML = '<option value="">Select a course</option>' +
      courses.map(function (c) {
        const name = String(c.name).trim();
        return '<option value="' + escapeHTML(name) + '">' + escapeHTML(name) + " — " + escapeHTML(c.price) + "</option>";
      }).join("") +
      '<option value="Not sure yet">Not sure yet — please advise me</option>';
  }
  const wanted = new URLSearchParams(window.location.search).get("course");
  if (courseSelect && wanted) {
    const match = Array.from(courseSelect.options).find(function (o) { return o.value === wanted; });
    if (match) courseSelect.value = wanted;
  }

  // Clear a field's error as soon as the visitor fixes it
  form.addEventListener("input", function (e) {
    const wrapper = e.target.closest(".field");
    if (wrapper && wrapper.classList.contains("has-error") && isFieldValid(e.target)) {
      wrapper.classList.remove("has-error");
    }
  });

  form.querySelectorAll("[data-whatsapp-booking]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (!validateForm(form)) return;
      window.open(whatsappLink(waNumber, bookingSummary(form)), "_blank", "noopener");
    });
  });

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!validateForm(form)) return;

    const button = form.querySelector('button[type="submit"]');
    const label = button.textContent;
    button.disabled = true;
    button.textContent = "Sending…";

    try {
      const response = await fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" }
      });
      if (!response.ok) throw new Error("Form service responded " + response.status);
      showBookingSuccess(form);
    } catch (err) {
      console.error(err);
      showFormMessage(
        form,
        "error",
        "Sorry — your request couldn't be sent just now. Please tap “Send via WhatsApp” below, or call us."
      );
      button.disabled = false;
      button.textContent = label;
    }
  });
}

function isFieldValid(field) {
  const value = field.type === "checkbox" ? (field.checked ? "yes" : "") : field.value.trim();
  if (field.required && !value) return false;
  if (!value) return true;
  if (field.type === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  if (field.type === "tel") return /^[0-9+()\-\s]{7,}$/.test(value);
  return true;
}

function validateForm(form) {
  let firstInvalid = null;
  form.querySelectorAll("input, select, textarea").forEach(function (field) {
    const wrapper = field.closest(".field");
    if (!wrapper || field.name === "_gotcha") return;
    const valid = isFieldValid(field);
    wrapper.classList.toggle("has-error", !valid);
    if (!valid && !firstInvalid) firstInvalid = field;
  });
  if (firstInvalid) {
    firstInvalid.focus();
    showFormMessage(form, "error", "Please fix the highlighted fields before sending.");
    return false;
  }
  const alert = form.querySelector(".alert");
  if (alert) alert.remove();
  return true;
}

function bookingSummary(form) {
  const lines = ["Hello, I would like to book driving lessons."];
  form.querySelectorAll("[data-summary]").forEach(function (field) {
    let value = field.value.trim();
    if (!value) return;
    if (field.type === "date") value = formatDate(value);
    lines.push(field.getAttribute("data-summary") + ": " + value);
  });
  return lines.join("\n");
}

function showBookingSuccess(form) {
  const name = (form.querySelector("#name").value || "").trim().split(" ")[0];
  const panel = document.createElement("div");
  panel.className = "form-success";
  panel.setAttribute("role", "status");
  panel.setAttribute("tabindex", "-1");
  panel.innerHTML =
    '<div class="form-success__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12l5 5L20 7"/></svg></div>' +
    "<h2>Thank you" + (name ? ", " + escapeHTML(name) : "") + "!</h2>" +
    "<p>Your booking request has been sent. We'll call or message you within one business day to confirm your first lesson.</p>" +
    '<a class="btn btn--dark" href="theory-test.html">While you wait: try the practice theory test</a>';
  form.replaceWith(panel);
  panel.focus();
}

function showFormMessage(form, type, text) {
  let box = form.querySelector(".alert");
  if (!box) {
    box = document.createElement("div");
    form.prepend(box);
  }
  box.className = "alert alert--" + type;
  box.textContent = text;
  box.setAttribute("role", type === "error" ? "alert" : "status");
}


/* =========================================================
   8. THEORY PRACTICE TEST
   ---------------------------------------------------------
   Questions live in data/quiz.json (editable in the CMS under
   "Theory Test Questions"). Each test picks a random set, gives
   instant feedback with an explanation, and shows a score and a
   review of any mistakes at the end. Best score is remembered
   on the visitor's own device.
   ========================================================= */
async function initTheoryTest() {
  const root = document.getElementById("quiz");
  if (!root) return;

  const data = await loadJSON("data/quiz.json");
  const pool = onlyPublished(data).filter(function (q) {
    return q.question && Array.isArray(q.options) && q.options.length >= 2 && q.correct >= 1 && q.correct <= q.options.length;
  });
  if (!pool.length) {
    root.innerHTML = contentErrorMessage();
    return;
  }

  const config = (data && data.settings) || {};
  const perTest = Math.min(pool.length, Number(config.questions_per_test) || 10);
  const passMark = Number(config.pass_mark_percent) || 80;
  let questions = [];
  let index = 0;
  let answers = [];

  function bestScore() {
    try { return Number(localStorage.getItem("theory-best")) || 0; } catch (e) { return 0; }
  }
  function saveBest(pct) {
    try { if (pct > bestScore()) localStorage.setItem("theory-best", String(pct)); } catch (e) { /* ignore */ }
  }

  function showIntro() {
    const best = bestScore();
    root.innerHTML =
      '<div class="card card--static quiz__intro">' +
      "<h2>Ready to test your road knowledge?</h2>" +
      "<ul>" +
      "<li><strong>" + perTest + "</strong>questions</li>" +
      "<li><strong>" + passMark + "%</strong>to pass</li>" +
      "<li><strong>" + (best ? best + "%" : "—") + "</strong>your best</li>" +
      "</ul>" +
      '<button type="button" class="btn btn--primary" data-start>Start the test</button>' +
      '<p class="form-note">Questions are drawn at random from ' + pool.length + " — every attempt is a little different.</p>" +
      "</div>";
    root.querySelector("[data-start]").addEventListener("click", start);
  }

  function start() {
    questions = shuffle(pool.slice()).slice(0, perTest);
    index = 0;
    answers = [];
    showQuestion();
  }

  function showQuestion() {
    const q = questions[index];
    const letters = "ABCDEFGH";
    root.innerHTML =
      '<div class="card card--static">' +
      '<div class="quiz__top"><span>Question ' + (index + 1) + " of " + questions.length + "</span>" +
      "<span>Score: " + answers.filter(Boolean).length + "</span></div>" +
      '<div class="quiz__progress" role="progressbar" aria-valuemin="0" aria-valuemax="' + questions.length + '" aria-valuenow="' + index + '"><span style="width:' + (index / questions.length) * 100 + '%"></span></div>' +
      '<h2 class="quiz__question" tabindex="-1">' + escapeHTML(q.question) + "</h2>" +
      '<div class="quiz__options">' +
      q.options.map(function (opt, i) {
        return '<button type="button" class="quiz__option" data-option="' + (i + 1) + '"><span class="quiz__letter">' + letters[i] + "</span><span>" + escapeHTML(opt) + "</span></button>";
      }).join("") +
      "</div>" +
      '<div class="quiz__feedback" aria-live="polite" hidden></div>' +
      "</div>";

    root.querySelector(".quiz__question").focus({ preventScroll: true });
    root.querySelectorAll(".quiz__option").forEach(function (btn) {
      btn.addEventListener("click", function () { answer(Number(btn.getAttribute("data-option"))); });
    });
  }

  function answer(choice) {
    const q = questions[index];
    const correct = choice === Number(q.correct);
    answers.push(correct);
    questions[index].chosen = choice;

    root.querySelectorAll(".quiz__option").forEach(function (btn) {
      const n = Number(btn.getAttribute("data-option"));
      btn.disabled = true;
      if (n === Number(q.correct)) btn.classList.add("is-correct");
      else if (n === choice) btn.classList.add("is-wrong");
    });

    const feedback = root.querySelector(".quiz__feedback");
    const isLast = index === questions.length - 1;
    feedback.className = "quiz__feedback " + (correct ? "is-correct" : "is-wrong");
    feedback.innerHTML =
      "<strong>" + (correct ? "Correct!" : "Not quite.") + "</strong>" +
      (q.explanation ? "<p>" + escapeHTML(q.explanation) + "</p>" : "") +
      '<button type="button" class="btn btn--dark quiz__next">' + (isLast ? "See my result" : "Next question") + "</button>";
    feedback.hidden = false;
    const next = feedback.querySelector(".quiz__next");
    next.addEventListener("click", function () {
      index++;
      if (index < questions.length) showQuestion();
      else showResult();
    });
    next.focus({ preventScroll: true });
  }

  function showResult() {
    const score = answers.filter(Boolean).length;
    const pct = Math.round((score / questions.length) * 100);
    const passed = pct >= passMark;
    saveBest(pct);
    const mistakes = questions.filter(function (_, i) { return !answers[i]; });

    root.innerHTML =
      '<div class="card card--static quiz__result">' +
      '<span class="badge" style="background:' + (passed ? "var(--color-go)" : "var(--color-stop)") + '">' + (passed ? "Pass" : "Keep practising") + "</span>" +
      '<p class="quiz__score">' + pct + "%</p>" +
      '<p class="quiz__verdict">You got ' + score + " out of " + questions.length + " correct. " +
      (passed ? "Great work — you're on the right track!" : "You need " + passMark + "% to pass. Our theory classes can help.") + "</p>" +
      '<div class="quiz__actions">' +
      '<button type="button" class="btn btn--primary" data-restart>Try another test</button>' +
      '<a class="btn btn--dark" href="contact.html#book">Book lessons</a>' +
      "</div>" +
      (mistakes.length
        ? '<div class="quiz__review"><h3>Review your mistakes</h3><ul>' +
          mistakes.map(function (q) {
            return "<li><strong>" + escapeHTML(q.question) + "</strong>" +
              "<p>Your answer: " + escapeHTML(q.options[q.chosen - 1]) + "<br />Correct answer: <strong>" + escapeHTML(q.options[q.correct - 1]) + "</strong></p>" +
              (q.explanation ? "<p>" + escapeHTML(q.explanation) + "</p>" : "") + "</li>";
          }).join("") +
          "</ul></div>"
        : "") +
      "</div>";
    root.querySelector("[data-restart]").addEventListener("click", start);
    root.scrollIntoView({ block: "start" });
  }

  showIntro();
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return arr;
}


/* =========================================================
   9. CUSTOM PAGES (created via the CMS "Pages" collection)
   ---------------------------------------------------------
   Only does anything on page.html. Reads ?slug=... from the
   URL, fetches data/pages/<slug>.json and renders its Markdown.
   ========================================================= */
async function renderCustomPage() {
  const titleEl = document.getElementById("page-title");
  const bodyEl = document.getElementById("page-body");
  if (!titleEl || !bodyEl) return;

  const slug = new URLSearchParams(window.location.search).get("slug");
  const notFound = function (msg) {
    titleEl.textContent = "Page not found";
    document.title = "Page not found — Chimwemwe Driving School2";
    bodyEl.innerHTML = "<p>" + msg + ' <a href="index.html">Return to the homepage</a>.</p>';
  };

  // Only allow simple slugs, so the URL can't be used to fetch other files
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) return notFound("No page was specified. Check the link you followed.");

  const page = await loadJSON("data/pages/" + slug + ".json");
  if (!page || page.published === false) return notFound("This page doesn't exist or isn't published yet.");

  document.title = page.title + " — Chimwemwe Driving School2";
  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription && page.meta_description) metaDescription.setAttribute("content", page.meta_description);

  titleEl.textContent = page.title;
  bodyEl.innerHTML = await renderMarkdown(page.body);
}


/* =========================================================
   10. OFFLINE SUPPORT
   ---------------------------------------------------------
   sw.js (the "service worker") keeps a copy of the site's files
   on the visitor's phone. Repeat visits load almost instantly,
   pages still open on a weak or dropped mobile connection, and
   the site can be "installed" to the home screen like an app.
   ========================================================= */
function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  if (location.protocol !== "https:" && !isLocal) return;
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("sw.js").catch(function (err) { console.warn("Service worker not registered:", err); });
  });
}
