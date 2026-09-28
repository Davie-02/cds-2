/* =========================================================
   CHIMWEMWE DRIVING SCHOOL2 — CUSTOM ADMIN
   ---------------------------------------------------------
   A small, framework-free content manager for the JSON files
   in /data. No build step: this one file is the whole app.

   How it works:
   1. LOGIN — Netlify Identity (netlifyIdentity widget).
   2. READ  — files are read from GitHub through Netlify's Git
      Gateway (/.netlify/git/github/...), using the logged-in
      user's token. Only invited Identity users can get in.
   3. SAVE  — "Publish" bundles every edited file, every newly
      uploaded image, and data/version.json into ONE commit on
      the main branch. Netlify redeploys in seconds.
   4. LIVE  — the admin watches the public site until the new
      version.json appears (then shows "Live ✓"). Open pages on
      the public site watch the same file and refresh their
      content automatically (see js/script.js, "Live updates").

   Sections:
   1. Settings + helpers
   2. Content schema (what can be edited, and how)
   3. Backends (Git Gateway, and a local preview mode)
   4. State, loading and saving
   5. App shell (login, sidebar, top bar)
   6. Views (dashboard, forms, list editors)
   7. Field widgets
   8. Images (compress + upload)
   9. Toasts, dialogs, keyboard shortcuts
   10. Start-up

   Opening admin on localhost runs a LOCAL PREVIEW mode: no
   login, changes are kept in this browser tab only — handy
   for trying things out without touching the live site.
   ========================================================= */
(function () {
  "use strict";

  /* =========================================================
     1. SETTINGS + HELPERS
     ========================================================= */
  const BRANCH = "main";
  const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const SITE_ROOT = new URL("../", location.href);
  const VERSION_FILE = "data/version.json";
  const DEPLOY_TIMEOUT_MS = 5 * 60 * 1000;

  const siteUrl = (p) => new URL(String(p || "").replace(/^\//, ""), SITE_ROOT).href;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const serialize = (data) => JSON.stringify(data, null, 2) + "\n";
  let uid = 0;

  // Tiny DOM builder: h("button", { class: "btn", onclick: fn }, "Save")
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    let value;
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "html") el.innerHTML = v;
      else if (k === "value") value = v;
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === "checked" || k === "disabled" || k === "hidden" || k === "multiple") el[k] = !!v;
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    if (value !== undefined) el.value = value;
    return el;
  }

  function formatDate(iso) {
    const d = new Date(iso);
    if (!iso || isNaN(d)) return iso || "";
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  function timeAgo(iso) {
    const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
    if (isNaN(s)) return "";
    if (s < 60) return "just now";
    if (s < 3600) return Math.round(s / 60) + " min ago";
    if (s < 86400) return Math.round(s / 3600) + " h ago";
    return formatDate(iso);
  }

  function slugify(str) {
    return String(str || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  }

  const encodePath = (p) => p.split("/").map(encodeURIComponent).join("/");

  function b64ToText(b64) {
    const bin = atob(String(b64).replace(/\s/g, ""));
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // Git's own ID for a file's contents. Lets us know a file's ID right
  // after committing it, for spotting edits made by someone else.
  async function gitBlobSha(text) {
    const body = new TextEncoder().encode(text);
    const head = new TextEncoder().encode("blob " + body.length + "\0");
    const all = new Uint8Array(head.length + body.length);
    all.set(head);
    all.set(body, head.length);
    const hash = await crypto.subtle.digest("SHA-1", all);
    return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  const ICONS = {
    home: '<path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    course: '<path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/>',
    news: '<path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9h4"/><path d="M18 14h-8M15 18h-5M10 6h8v4h-8z"/>',
    star: '<path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
    quiz: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    page: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    up: '<path d="M18 15l-6-6-6 6"/>',
    down: '<path d="M6 9l6 6 6-6"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    back: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/>',
    check: '<path d="M20 6L9 17l-5-5"/>'
  };
  const icon = (name, cls) =>
    h("span", { class: "icon" + (cls ? " " + cls : ""), "aria-hidden": "true", html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + ICONS[name] + "</svg>" });


  /* =========================================================
     2. CONTENT SCHEMA
     ---------------------------------------------------------
     Each "collection" is one area of the site. `fields` says
     which inputs the editor shows. To make something new
     editable, add a field here — the forms build themselves.
     Field types: string, text, markdown, boolean, number, date,
     color, image, rating, strings (list of text), object,
     list (list of objects), choices (quiz answers).
     ========================================================= */
  const PUBLISHED = { name: "published", label: "Published", type: "boolean", default: true, hint: "Switch off to hide this from the site without deleting it." };

  const COLLECTIONS = [
    {
      id: "settings", label: "Site settings", icon: "settings", type: "single", file: "data/settings.json",
      preview: "index.html",
      description: "School name, logo, colours, phone numbers, branches and homepage figures.",
      sections: [
        { title: "Brand", fields: [
          { name: "site_name", label: "School name", type: "string", required: true },
          { name: "tagline", label: "Tagline", type: "string" },
          { name: "logo", label: "Logo", type: "image", maxSize: 400 },
          { name: "favicon", label: "Browser tab icon", type: "image", maxSize: 128 }
        ] },
        { title: "Theme colours", fields: [
          { name: "theme", type: "object", fields: [
            { name: "primary_color", label: "Primary (buttons, highlights)", type: "color" },
            { name: "asphalt_color", label: "Dark (header, footer)", type: "color" },
            { name: "accent_color", label: "Accent (labels, badges)", type: "color" }
          ] }
        ] },
        { title: "Contact details", fields: [
          { name: "contact", type: "object", fields: [
            { name: "phone_primary", label: "Main phone", type: "string", placeholder: "+265 999 118 292" },
            { name: "phone_secondary", label: "Second phone (optional)", type: "string" },
            { name: "whatsapp", label: "WhatsApp number", type: "string", hint: "Used by every WhatsApp button on the site. Include the country code." },
            { name: "email", label: "Email", type: "string" }
          ] }
        ] },
        { title: "Branches", fields: [
          { name: "branches", type: "list", singular: "branch", summary: "name", fields: [
            { name: "name", label: "Branch name", type: "string", required: true },
            { name: "address", label: "Address", type: "string", hint: "Also used for the Google Maps 'Directions' button." },
            { name: "phone", label: "Phone", type: "string" },
            { name: "hours", label: "Opening hours", type: "string", placeholder: "Mon–Sat, 7:00–17:00", hint: "Written like “Mon–Sat, 7:00–17:00”, the site shows a live Open now / Closed badge." }
          ] }
        ] },
        { title: "Homepage figures", fields: [
          { name: "stats", type: "list", singular: "figure", summary: "value", fields: [
            { name: "value", label: "Figure", type: "string", placeholder: "600+" },
            { name: "label", label: "Label", type: "string", placeholder: "Licensed graduates" }
          ] }
        ] },
        { title: "Social media", fields: [
          { name: "social", type: "object", fields: [
            { name: "facebook", label: "Facebook page URL", type: "string", placeholder: "https://facebook.com/…" },
            { name: "instagram", label: "Instagram URL", type: "string" },
            { name: "tiktok", label: "TikTok URL", type: "string" }
          ] }
        ] }
      ]
    },
    {
      id: "courses", label: "Courses & prices", icon: "course", type: "list", file: "data/courses.json",
      singular: "course", preview: "services.html",
      description: "Course cards on the homepage and Courses page, and the booking form's course list.",
      title: (o) => o.name, sub: (o) => o.price, badges: (o) => (o.featured ? ["Most popular"] : []),
      fields: [
        { name: "name", label: "Course name", type: "string", required: true },
        { name: "price", label: "Price", type: "string", placeholder: "MK 753,000", required: true },
        { name: "description", label: "Description", type: "markdown" },
        { name: "features", label: "What's included", type: "strings", singular: "feature" },
        { name: "featured", label: "Highlight as “Most popular”", type: "boolean" },
        PUBLISHED
      ]
    },
    {
      id: "announcements", label: "News & offers", icon: "news", type: "list", file: "data/announcements.json",
      singular: "post", preview: "index.html", addToTop: true,
      description: "News cards on the homepage, and the yellow banner across the top of every page.",
      title: (o) => o.title, sub: (o) => formatDate(o.date),
      badges: (o) => [o.banner && "Banner", o.expires && o.expires < todayISO() && "Expired"].filter(Boolean),
      fields: [
        { name: "title", label: "Title", type: "string", required: true },
        { name: "date", label: "Date", type: "date", required: true },
        { name: "body", label: "Text", type: "markdown" },
        { name: "link", label: "“Read more” link (optional)", type: "string", placeholder: "services.html or page.html?slug=offer" },
        { name: "banner", label: "Show as site-wide banner", type: "boolean", hint: "Shows the title in a yellow bar at the top of every page." },
        { name: "expires", label: "Hide automatically after (optional)", type: "date", hint: "Perfect for special offers — the post disappears after this date." },
        PUBLISHED
      ]
    },
    {
      id: "testimonials", label: "Reviews", icon: "star", type: "list", file: "data/testimonials.json",
      singular: "review", preview: "testimonials.html",
      description: "Student reviews on the homepage slider and Reviews page.",
      title: (o) => o.name, sub: (o) => "★".repeat(Number(o.stars) || 0),
      fields: [
        { name: "name", label: "Student name", type: "string", required: true },
        { name: "stars", label: "Rating", type: "rating", default: 5 },
        { name: "quote", label: "Review", type: "text", required: true },
        PUBLISHED
      ]
    },
    {
      id: "instructors", label: "Instructors", icon: "user", type: "list", file: "data/instructors.json",
      singular: "instructor", preview: "instructors.html",
      description: "Instructor profiles on the Instructors page.",
      title: (o) => o.name, sub: (o) => o.role, thumb: (o) => o.photo,
      fields: [
        { name: "name", label: "Name", type: "string", required: true },
        { name: "role", label: "Role / title", type: "string" },
        { name: "bio", label: "Short bio", type: "text" },
        { name: "photo", label: "Photo", type: "image", maxSize: 900 },
        PUBLISHED
      ]
    },
    {
      id: "gallery", label: "Gallery", icon: "image", type: "list", file: "data/gallery.json",
      singular: "photo", preview: "gallery.html", bulkUpload: "image",
      description: "Photos on the Gallery page.",
      title: (o) => o.alt || "Untitled photo", thumb: (o) => o.image,
      fields: [
        { name: "image", label: "Photo", type: "image", required: true },
        { name: "alt", label: "Description", type: "string", required: true, hint: "Describe the photo — shown as a caption and read out by screen readers." },
        PUBLISHED
      ]
    },
    {
      id: "faqs", label: "FAQs", icon: "help", type: "list", file: "data/faqs.json",
      singular: "question", preview: "services.html#faq",
      description: "Frequently asked questions on the Courses page.",
      title: (o) => o.question,
      fields: [
        { name: "question", label: "Question", type: "string", required: true },
        { name: "answer", label: "Answer", type: "markdown", required: true },
        PUBLISHED
      ]
    },
    {
      id: "quiz", label: "Theory test", icon: "quiz", type: "list", file: "data/quiz.json",
      singular: "question", preview: "theory-test.html",
      description: "Questions for the free practice theory test.",
      title: (o) => o.question, sub: (o) => (o.options || []).length + " answers",
      headerFields: [
        { name: "settings", type: "object", fields: [
          { name: "questions_per_test", label: "Questions per test", type: "number", min: 1 },
          { name: "pass_mark_percent", label: "Pass mark (%)", type: "number", min: 1, max: 100 }
        ] }
      ],
      fields: [
        { name: "question", label: "Question", type: "text", required: true },
        { name: "options", label: "Answers — tick the correct one", type: "choices" },
        { name: "explanation", label: "Explanation (shown after answering)", type: "text" },
        PUBLISHED
      ]
    },
    {
      id: "pages", label: "Pages", icon: "page", type: "folder", folder: "data/pages",
      singular: "page", description: "Extra pages such as the Privacy Policy or a special offer.",
      title: (o) => o.title, sub: (o) => "page.html?slug=" + (o.slug || ""),
      previewItem: (o) => "page.html?slug=" + encodeURIComponent(o.slug || ""),
      fields: [
        { name: "title", label: "Title", type: "string", required: true },
        { name: "slug", label: "Web address (slug)", type: "string", required: true, pattern: "^[a-z0-9-]+$", hint: "Lowercase letters, numbers and dashes. The page opens at page.html?slug=…" },
        { name: "meta_description", label: "Search engine description", type: "string" },
        { name: "nav_label", label: "Short link text", type: "string" },
        { name: "body", label: "Page content", type: "markdown" },
        PUBLISHED
      ]
    }
  ];
  const byId = (id) => COLLECTIONS.find((c) => c.id === id);

  function defaultsFor(fields) {
    const obj = {};
    for (const f of fields) {
      if (f.type === "boolean") obj[f.name] = f.default != null ? f.default : false;
      else if (f.type === "date") obj[f.name] = f.name === "expires" ? "" : todayISO();
      else if (f.type === "rating") obj[f.name] = f.default || 5;
      else if (f.type === "number") obj[f.name] = f.default != null ? f.default : "";
      else if (f.type === "strings" || f.type === "list") obj[f.name] = [];
      else if (f.type === "object") obj[f.name] = defaultsFor(f.fields);
      else if (f.type === "choices") { obj.options = ["", ""]; obj.correct = 1; }
      else obj[f.name] = "";
    }
    return obj;
  }


  /* =========================================================
     3. BACKENDS
     ========================================================= */
  const gateway = {
    base: "/.netlify/git/github/",

    async req(path, options) {
      const user = window.netlifyIdentity && window.netlifyIdentity.currentUser();
      if (!user) throw Object.assign(new Error("Your session has ended — please log in again."), { status: 401 });
      const token = await user.jwt();
      const res = await fetch(this.base + path, Object.assign({ cache: "no-store" }, options, {
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }
      }));
      if (!res.ok) {
        let msg = res.status + " " + res.statusText;
        try { const j = await res.json(); msg = j.message || j.msg || msg; } catch (e) { /* not JSON */ }
        throw Object.assign(new Error(msg), { status: res.status });
      }
      return res.status === 204 ? null : res.json();
    },

    async readFile(path) {
      const j = await this.req("contents/" + encodePath(path) + "?ref=" + BRANCH);
      let content = j.content;
      if (!content && j.sha) content = (await this.req("git/blobs/" + j.sha)).content; // files over 1 MB
      return { text: b64ToText(content || ""), sha: j.sha };
    },

    async listDir(path) {
      try {
        const j = await this.req("contents/" + encodePath(path) + "?ref=" + BRANCH);
        return j.filter((f) => f.type === "file").map((f) => ({ name: f.name, path: f.path }));
      } catch (e) {
        if (e.status === 404) return [];
        throw e;
      }
    },

    async latestSha(path) {
      try { return (await this.req("contents/" + encodePath(path) + "?ref=" + BRANCH)).sha; }
      catch (e) { if (e.status === 404) return null; throw e; }
    },

    // Writes every change in ONE commit (text files, images, deletions),
    // so the site never deploys a half-finished edit.
    async commit(message, changes, author) {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const ref = await this.req("git/refs/heads/" + BRANCH);
          const head = ref.object.sha;
          const parent = await this.req("git/commits/" + head);
          const tree = [];
          for (const c of changes) {
            if (c.delete) {
              tree.push({ path: c.path, mode: "100644", type: "blob", sha: null });
            } else if (c.base64) {
              const blob = await this.req("git/blobs", { method: "POST", body: JSON.stringify({ content: c.base64, encoding: "base64" }) });
              tree.push({ path: c.path, mode: "100644", type: "blob", sha: blob.sha });
            } else {
              tree.push({ path: c.path, mode: "100644", type: "blob", content: c.text });
            }
          }
          const newTree = await this.req("git/trees", { method: "POST", body: JSON.stringify({ base_tree: parent.tree.sha, tree }) });
          const body = { message, tree: newTree.sha, parents: [head] };
          if (author && author.email) body.author = { name: author.name || author.email, email: author.email, date: new Date().toISOString() };
          const commit = await this.req("git/commits", { method: "POST", body: JSON.stringify(body) });
          await this.req("git/refs/heads/" + BRANCH, { method: "PATCH", body: JSON.stringify({ sha: commit.sha }) });
          return commit.sha;
        } catch (e) {
          // Someone else committed at the same moment — try again on top of theirs
          if ((e.status === 409 || e.status === 422) && attempt < 2) { await sleep(800); continue; }
          throw e;
        }
      }
    },

    async recentCommits() {
      return this.req("commits?sha=" + BRANCH + "&per_page=6");
    }
  };

  // LOCAL PREVIEW: reads the site's files directly and keeps saves in
  // this browser tab (sessionStorage). Nothing reaches GitHub.
  const local = {
    store: (function () {
      try { return JSON.parse(sessionStorage.getItem("cds-admin-local") || "{}"); } catch (e) { return {}; }
    })(),
    persist() {
      try { sessionStorage.setItem("cds-admin-local", JSON.stringify(this.store)); } catch (e) { /* ignore */ }
    },
    async readFile(path) {
      if (path in this.store) {
        if (this.store[path] === null) throw Object.assign(new Error("Not found"), { status: 404 });
        return { text: this.store[path], sha: await gitBlobSha(this.store[path]) };
      }
      const res = await fetch(siteUrl(path), { cache: "no-store" });
      if (!res.ok) throw Object.assign(new Error("Not found"), { status: 404 });
      const text = await res.text();
      return { text, sha: await gitBlobSha(text) };
    },
    async listDir(path) {
      const res = await fetch(siteUrl(path + "/"), { cache: "no-store" });
      const html = res.ok ? await res.text() : "";
      const names = new Set(Array.from(html.matchAll(/href="([^"?/]+\.json)"/g), (m) => decodeURIComponent(m[1])));
      for (const p of Object.keys(this.store)) {
        if (!p.startsWith(path + "/")) continue;
        const name = p.slice(path.length + 1);
        if (this.store[p] === null) names.delete(name); else names.add(name);
      }
      return Array.from(names, (name) => ({ name, path: path + "/" + name }));
    },
    async latestSha(path) {
      try { return (await this.readFile(path)).sha; } catch (e) { return null; }
    },
    async commit(message, changes) {
      await sleep(400);
      for (const c of changes) {
        if (c.delete) this.store[c.path] = null;
        else if (c.text != null) this.store[c.path] = c.text;
      }
      this.persist();
      return "local";
    },
    async recentCommits() { return []; }
  };

  const backend = LOCAL ? local : gateway;


  /* =========================================================
     4. STATE, LOADING AND SAVING
     ========================================================= */
  const state = {
    user: null,
    docs: {},          // collection id -> { path, sha, data, saved }
    pages: [],         // [{ origPath, sha, savedText, data, deleted }]
    pagesSaved: "",
    pagesBackup: "[]",
    uploads: new Map(), // repo path -> { base64, preview }
    view: "dashboard",
    selected: {},      // collection id -> selected index
    mobileEditing: false,
    filter: "",
    saving: false,
    deploy: { status: "idle", stamp: null }
  };

  function normalize(col, data) {
    if (col.type === "list" && !Array.isArray(data.items)) data.items = [];
    if (col.id === "quiz" && (typeof data.settings !== "object" || !data.settings)) data.settings = { questions_per_test: 10, pass_mark_percent: 80 };
    return data;
  }

  async function loadAll() {
    await Promise.all(COLLECTIONS.filter((c) => c.file).map(async (col) => {
      let data, sha = null;
      try {
        const file = await backend.readFile(col.file);
        data = JSON.parse(file.text);
        sha = file.sha;
      } catch (e) {
        if (e.status !== 404) throw e;
        data = {};
      }
      normalize(col, data);
      state.docs[col.id] = { path: col.file, sha, data, saved: serialize(data) };
    }));

    const files = (await backend.listDir("data/pages")).filter((f) => f.name.endsWith(".json"));
    state.pages = await Promise.all(files.map(async (f) => {
      const file = await backend.readFile(f.path);
      let data;
      try { data = JSON.parse(file.text); } catch (e) { data = { title: f.name, slug: f.name.replace(/\.json$/, ""), body: "" }; }
      if (!data.slug) data.slug = f.name.replace(/\.json$/, "");
      return { origPath: f.path, sha: file.sha, savedText: serialize(data), data, deleted: false };
    }));
    state.pages.sort((a, b) => String(a.data.title).localeCompare(String(b.data.title)));
    markPagesSaved();
  }

  const pagesSnapshot = () => JSON.stringify(state.pages.filter((p) => !(p.deleted && !p.origPath)).map((p) => [p.origPath, p.deleted, p.data]));
  function markPagesSaved() {
    state.pagesSaved = pagesSnapshot();
    state.pagesBackup = JSON.stringify(state.pages);
  }

  function isDirty(col) {
    if (col.type === "folder") return pagesSnapshot() !== state.pagesSaved;
    const doc = state.docs[col.id];
    return !!doc && serialize(doc.data) !== doc.saved;
  }
  const dirtyCollections = () => COLLECTIONS.filter(isDirty);
  const hasPendingWork = () => dirtyCollections().length > 0 || state.uploads.size > 0;

  function discardAll() {
    for (const col of dirtyCollections()) {
      if (col.type === "folder") state.pages = JSON.parse(state.pagesBackup);
      else state.docs[col.id].data = normalize(col, JSON.parse(state.docs[col.id].saved));
    }
    state.uploads.clear();
    renderView();
    updateChrome();
    toast("Changes discarded");
  }

  function validate(col) {
    const problems = [];
    const check = (fields, obj, where) => {
      for (const f of fields) {
        const v = obj[f.name];
        if (f.required && (v == null || String(v).trim() === "")) problems.push(where + ": “" + (f.label || f.name) + "” is required");
        if (f.pattern && v && !new RegExp(f.pattern).test(v)) problems.push(where + ": “" + f.label + "” has invalid characters");
        if (f.type === "choices") {
          const opts = (obj.options || []).filter((o) => String(o).trim());
          if (opts.length < 2) problems.push(where + ": needs at least two answers");
          if (!(obj.correct >= 1 && obj.correct <= (obj.options || []).length) || !String((obj.options || [])[obj.correct - 1] || "").trim()) problems.push(where + ": tick the correct answer");
        }
        if (f.type === "object" && v) check(f.fields, v, where);
        if (f.type === "list" && Array.isArray(v)) v.forEach((item, i) => check(f.fields, item, where + " › " + (f.singular || "item") + " " + (i + 1)));
      }
    };
    if (col.type === "single") col.sections.forEach((s) => check(s.fields, state.docs[col.id].data, col.label));
    else if (col.type === "list") state.docs[col.id].data.items.forEach((o, i) => check(col.fields, o, col.label + " › " + (col.title(o) || col.singular + " " + (i + 1))));
    else {
      const live = state.pages.filter((p) => !p.deleted);
      live.forEach((p) => check(col.fields, p.data, "Pages › " + (p.data.title || "Untitled")));
      const slugs = live.map((p) => p.data.slug);
      if (new Set(slugs).size !== slugs.length) problems.push("Pages: two pages have the same web address (slug)");
    }
    return problems;
  }

  async function publish() {
    if (state.saving) return;
    const cols = dirtyCollections();
    if (!cols.length && !state.uploads.size) { toast("Nothing to publish — everything is up to date"); return; }

    const problems = cols.flatMap(validate);
    if (problems.length) {
      toast(problems.slice(0, 3).join("\n") + (problems.length > 3 ? "\n…and " + (problems.length - 3) + " more" : ""), "error", 7000);
      return;
    }

    // 1. Work out every file that changes
    const changes = [];
    for (const col of cols) {
      if (col.type === "folder") {
        for (const p of state.pages) {
          const newPath = "data/pages/" + p.data.slug + ".json";
          if (p.deleted) { if (p.origPath) changes.push({ path: p.origPath, delete: true }); continue; }
          const text = serialize(p.data);
          if (!p.origPath) changes.push({ path: newPath, text });
          else if (newPath !== p.origPath) { changes.push({ path: p.origPath, delete: true }); changes.push({ path: newPath, text }); }
          else if (text !== p.savedText) changes.push({ path: newPath, text, knownSha: p.sha });
        }
      } else {
        const doc = state.docs[col.id];
        changes.push({ path: doc.path, text: serialize(doc.data), knownSha: doc.sha });
      }
    }
    // Only upload images that are still used somewhere
    const allText = JSON.stringify(state.docs) + JSON.stringify(state.pages);
    for (const [path, up] of state.uploads) {
      if (allText.includes(path)) changes.push({ path, base64: up.base64 });
    }
    const stamp = new Date().toISOString();
    changes.push({ path: VERSION_FILE, text: serialize({ updated: stamp, by: userName() }) });

    state.saving = true;
    updateChrome();
    try {
      // 2. Has anyone else changed these files since we opened them?
      const conflicts = [];
      for (const c of changes) {
        if (!c.knownSha) continue;
        const latest = await backend.latestSha(c.path);
        if (latest && latest !== c.knownSha) conflicts.push(c.path);
      }
      if (conflicts.length) {
        const overwrite = await confirmDialog(
          "Someone else changed this content",
          "These files were updated by someone else after you opened the admin:\n" + conflicts.join("\n") +
            "\n\nPublishing now will replace their changes with yours. To keep their changes, cancel, copy your edits somewhere, and reload the admin.",
          "Publish anyway", true
        );
        if (!overwrite) return;
      }

      // 3. One commit with everything
      const names = cols.map((c) => c.label.toLowerCase());
      const message = "Update " + (names.join(", ") || "images") + " (via admin by " + userName() + ")";
      await backend.commit(message, changes, { name: userName(), email: state.user && state.user.email });

      // 4. Remember what is now saved
      for (const col of cols) {
        if (col.type === "folder") {
          state.pages = state.pages.filter((p) => !p.deleted);
          for (const p of state.pages) {
            p.origPath = "data/pages/" + p.data.slug + ".json";
            p.savedText = serialize(p.data);
            p.sha = await gitBlobSha(p.savedText);
          }
          markPagesSaved();
        } else {
          const doc = state.docs[col.id];
          doc.saved = serialize(doc.data);
          doc.sha = await gitBlobSha(doc.saved);
        }
      }
      state.uploads.clear();
      renderView();
      trackDeploy(stamp);
    } catch (e) {
      console.error(e);
      toast("Couldn't publish: " + e.message + (e.status === 401 ? "" : "\nYour edits are still here — try again."), "error", 8000);
    } finally {
      state.saving = false;
      updateChrome();
    }
  }

  // Watches the public site until the new version is being served.
  async function trackDeploy(stamp) {
    state.deploy = { status: "publishing", stamp };
    updateChrome();
    if (LOCAL) {
      await sleep(600);
      state.deploy = { status: "live", stamp };
      updateChrome();
      toast("Saved in local preview mode (this browser tab only)", "success");
      return;
    }
    toast("Published! Going live in a few seconds…", "success");
    const started = Date.now();
    while (state.deploy.stamp === stamp && Date.now() - started < DEPLOY_TIMEOUT_MS) {
      await sleep(4000);
      try {
        const res = await fetch(siteUrl(VERSION_FILE) + "?t=" + Date.now(), { cache: "no-store" });
        if (res.ok && (await res.json()).updated === stamp) {
          state.deploy = { status: "live", stamp };
          updateChrome();
          toast("Your changes are live on the site ✓", "success");
          return;
        }
      } catch (e) { /* keep waiting */ }
    }
    if (state.deploy.stamp === stamp) {
      state.deploy = { status: "slow", stamp };
      updateChrome();
      toast("Saved to GitHub, but the site hasn't updated yet. Check the Deploys tab in Netlify.", "error", 9000);
    }
  }

  const userName = () => {
    const u = state.user || {};
    return (u.user_metadata && u.user_metadata.full_name) || u.email || "admin";
  };


  /* =========================================================
     5. APP SHELL
     ========================================================= */
  const app = document.getElementById("app");
  // Like el.replaceChildren(), but ignores empty values (false/null/undefined)
  const fill = (el, ...kids) => el.replaceChildren(...kids.flat(Infinity).filter((k) => k != null && k !== false));
  let els = {};

  function showLogin(message) {
    fill(app, 
      h("main", { class: "login" },
        h("div", { class: "login__card" },
          h("img", { src: "../images/logo.png", alt: "", width: 110, height: 81 }),
          h("h1", {}, "Content manager"),
          h("p", {}, "Chimwemwe Driving School2 — update courses, prices, news and photos. Changes go live in seconds."),
          message && h("p", { class: "login__error" }, message),
          h("button", { class: "btn btn--primary btn--block", onclick: () => window.netlifyIdentity.open("login") }, "Log in"),
          h("p", { class: "login__small" }, "Accounts are by invitation only. Forgot your password? Use “Forgot password?” in the login window."),
          h("a", { class: "login__small", href: "../" }, "← Back to the website")
        )
      )
    );
  }

  function showFatal(title, detail) {
    fill(app, 
      h("main", { class: "login" },
        h("div", { class: "login__card" },
          h("h1", {}, title),
          h("p", { class: "login__error", style: "white-space:pre-line" }, detail),
          h("button", { class: "btn btn--primary btn--block", onclick: () => location.reload() }, "Try again"),
          !LOCAL && h("button", { class: "btn btn--ghost btn--block", onclick: () => window.netlifyIdentity.logout() }, "Log out")
        )
      )
    );
  }

  let started = false;
  async function start(user) {
    if (started) return;
    started = true;
    state.user = user;
    fill(app, h("div", { class: "boot" }, h("span", { class: "spinner" }), h("p", {}, "Loading your content…")));
    try {
      await loadAll();
    } catch (e) {
      console.error(e);
      started = false;
      const hint = e.status === 401 || e.status === 403 || e.status === 404
        ? "\n\nIn Netlify, check: Site configuration → Identity is enabled, and Identity → Services → Git Gateway is enabled."
        : "";
      showFatal("Couldn't load the content", e.message + hint);
      return;
    }
    renderShell();
    const fromHash = location.hash.slice(1);
    go(byId(fromHash) ? fromHash : "dashboard");
  }

  function renderShell() {
    const nav = h("nav", { class: "sidebar__nav", "aria-label": "Sections" },
      navLink("dashboard", "Dashboard", "home"),
      h("p", { class: "sidebar__group" }, "Content"),
      COLLECTIONS.map((c) => navLink(c.id, c.label, c.icon))
    );

    els.sidebar = h("aside", { class: "sidebar" },
      h("a", { class: "sidebar__brand", href: "#dashboard", onclick: (e) => { e.preventDefault(); go("dashboard"); } },
        h("img", { src: "../images/logo.png", alt: "", width: 44, height: 32 }),
        h("span", {}, "Chimwemwe", h("small", {}, "Content manager"))
      ),
      nav,
      h("div", { class: "sidebar__foot" },
        h("a", { class: "sidebar__link", href: "../", target: "_blank", rel: "noopener" }, icon("external"), "View website"),
        h("div", { class: "sidebar__user" },
          h("span", { class: "avatar" }, (userName()[0] || "A").toUpperCase()),
          h("span", { class: "sidebar__email" }, LOCAL ? "Local preview" : (state.user.email || userName())),
          !LOCAL && h("button", { class: "icon-btn", title: "Log out", "aria-label": "Log out", onclick: logout }, icon("logout"))
        )
      )
    );

    els.title = h("h1", { class: "topbar__title" });
    els.status = h("span", { class: "status" });
    els.discard = h("button", { class: "btn btn--ghost", onclick: async () => {
      if (await confirmDialog("Discard your changes?", "Everything you've edited since you last published will be undone.", "Discard", true)) discardAll();
    } }, "Discard");
    els.publish = h("button", { class: "btn btn--primary", onclick: publish });
    els.content = h("div", { class: "content", id: "content" });

    fill(app, 
      h("div", { class: "shell" + (LOCAL ? " is-local" : "") },
        els.sidebar,
        h("div", { class: "scrim", onclick: () => toggleSidebar(false) }),
        h("div", { class: "main" },
          LOCAL && h("div", { class: "local-banner" }, "Local preview mode — changes are kept in this browser tab only and never reach the live site."),
          h("header", { class: "topbar" },
            h("button", { class: "icon-btn topbar__menu", "aria-label": "Open menu", onclick: () => toggleSidebar(true) }, icon("menu")),
            els.title,
            els.status,
            h("div", { class: "topbar__actions" }, els.discard, els.publish)
          ),
          els.content
        )
      )
    );
  }

  function navLink(id, label, iconName) {
    return h("a", {
      class: "sidebar__link", href: "#" + id, "data-view": id,
      onclick: (e) => { e.preventDefault(); go(id); }
    }, icon(iconName), h("span", {}, label), h("span", { class: "dot", title: "Unpublished changes" }));
  }

  function toggleSidebar(open) {
    document.querySelector(".shell").classList.toggle("sidebar-open", open);
  }

  async function logout() {
    if (hasPendingWork() && !(await confirmDialog("Log out with unpublished changes?", "Your unpublished edits will be lost.", "Log out", true))) return;
    state.docs = {}; state.uploads.clear(); state.pages = []; markPagesSaved();
    window.netlifyIdentity.logout();
  }

  function go(view) {
    state.view = view;
    state.filter = "";
    state.mobileEditing = false;
    if (location.hash.slice(1) !== view) history.replaceState(null, "", "#" + view);
    toggleSidebar(false);
    renderView();
    updateChrome();
    els.content.scrollTop = 0;
    window.scrollTo(0, 0);
  }

  // Updates everything that depends on "is there unsaved work?"
  function updateChrome() {
    if (!els.publish) return;
    const dirty = dirtyCollections();
    const count = dirty.length + (dirty.length ? 0 : state.uploads.size ? 1 : 0);
    els.publish.disabled = state.saving || !count;
    fill(els.publish, state.saving ? h("span", { class: "spinner spinner--sm" }) : icon("upload"), state.saving ? "Publishing…" : count ? "Publish changes" : "Published");
    els.discard.hidden = !count || state.saving;

    const col = byId(state.view);
    els.title.textContent = col ? col.label : "Dashboard";
    document.title = (col ? col.label : "Dashboard") + " — Admin";

    document.querySelectorAll(".sidebar__link[data-view]").forEach((a) => {
      const id = a.getAttribute("data-view");
      a.classList.toggle("is-active", id === state.view);
      a.classList.toggle("is-dirty", !!byId(id) && isDirty(byId(id)));
    });

    const d = state.deploy.status;
    els.status.className = "status status--" + (count ? "dirty" : d);
    fill(els.status, 
      count ? "Unpublished changes"
        : d === "publishing" ? [h("span", { class: "spinner spinner--sm" }), "Going live…"]
        : d === "live" ? [icon("check"), "Live"]
        : d === "slow" ? "Deploy taking longer than usual"
        : "Up to date"
    );
  }

  // Called by every input: mark as changed, refresh the list summaries
  let listRefreshTimer;
  function changed() {
    updateChrome();
    clearTimeout(listRefreshTimer);
    listRefreshTimer = setTimeout(() => { if (els.refreshList) els.refreshList(); }, 150);
  }


  /* =========================================================
     6. VIEWS
     ========================================================= */
  function renderView() {
    els.refreshList = null;
    const col = byId(state.view);
    if (!col) return renderDashboard();
    if (col.type === "single") return renderSingle(col);
    return renderListCollection(col);
  }

  async function renderDashboard() {
    const tiles = COLLECTIONS.map((col) => {
      let count = "", sub = col.description;
      if (col.type === "list") {
        const items = state.docs[col.id].data.items;
        const shown = items.filter((i) => i.published !== false).length;
        count = items.length;
        sub = shown + " published" + (items.length - shown ? " · " + (items.length - shown) + " hidden" : "");
      } else if (col.type === "folder") {
        count = state.pages.filter((p) => !p.deleted).length;
        sub = count === 1 ? "1 page" : count + " pages";
      }
      return h("a", { class: "tile" + (isDirty(col) ? " is-dirty" : ""), href: "#" + col.id, onclick: (e) => { e.preventDefault(); go(col.id); } },
        h("span", { class: "tile__icon" }, icon(col.icon)),
        h("span", { class: "tile__body" }, h("strong", {}, col.label), h("span", {}, sub)),
        count !== "" && h("span", { class: "tile__count" }, count)
      );
    });

    const liveInfo = h("p", { class: "muted" }, "Checking…");
    const activity = h("ul", { class: "activity" });
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    const firstName = String(userName()).split(/[ @]/)[0];

    fill(els.content, 
      h("section", { class: "welcome" },
        h("div", {},
          h("h2", {}, greeting + (LOCAL ? "" : ", " + firstName) + " 👋"),
          h("p", {}, "Everything you publish here goes live on the website within seconds — and visitors who already have a page open see it update automatically.")
        ),
        h("a", { class: "btn btn--ghost", href: "../", target: "_blank", rel: "noopener" }, icon("external"), "Open website")
      ),
      h("section", { class: "quick" },
        quickAction("news", "Post news or an offer", () => { go("announcements"); addItem(byId("announcements")); }),
        quickAction("course", "Update course prices", () => go("courses")),
        quickAction("image", "Add gallery photos", () => go("gallery")),
        quickAction("settings", "Change phone or branches", () => go("settings"))
      ),
      h("div", { class: "dash-grid" },
        h("section", {}, h("h3", { class: "section-title" }, "Your content"), h("div", { class: "tiles" }, tiles)),
        h("section", {},
          h("h3", { class: "section-title" }, "Website status"),
          h("div", { class: "panel" }, h("p", { class: "live-dot" }, "Website online"), liveInfo),
          h("h3", { class: "section-title" }, "Recent changes"),
          h("div", { class: "panel" }, activity)
        )
      )
    );

    try {
      const res = await fetch(siteUrl(VERSION_FILE) + "?t=" + Date.now(), { cache: "no-store" });
      const v = res.ok ? await res.json() : null;
      liveInfo.textContent = v && v.updated ? "Last published " + timeAgo(v.updated) + (v.by ? " by " + v.by : "") : "No changes published from this admin yet.";
    } catch (e) { liveInfo.textContent = "Couldn't reach the website."; }

    try {
      const commits = await backend.recentCommits();
      if (!commits.length) throw new Error("none");
      fill(activity, ...commits.map((c) =>
        h("li", {}, h("strong", {}, c.commit.message.split("\n")[0].replace(/\s*\(via admin by .*\)$/, "")),
          h("span", {}, (c.commit.author && c.commit.author.name ? c.commit.author.name + " · " : "") + timeAgo(c.commit.author && c.commit.author.date)))
      ));
    } catch (e) {
      fill(activity, h("li", { class: "muted" }, LOCAL ? "Not available in local preview." : "History isn't available right now."));
    }
  }

  function quickAction(iconName, label, onclick) {
    return h("button", { class: "quick__btn", onclick }, icon(iconName), h("span", {}, label));
  }

  function viewHeader(col, extra) {
    return h("div", { class: "view-head" },
      h("p", { class: "muted" }, col.description),
      h("div", { class: "view-head__actions" },
        extra,
        col.preview && h("a", { class: "btn btn--ghost btn--sm", href: siteUrl(col.preview), target: "_blank", rel: "noopener" }, icon("external"), "View on site")
      )
    );
  }

  // Forms for single-file content (Site settings)
  function renderSingle(col) {
    const data = state.docs[col.id].data;
    const ctx = { onChange: changed };
    fill(els.content, 
      viewHeader(col),
      h("div", { class: "form-stack" },
        col.sections.map((section) =>
          h("section", { class: "panel" },
            h("h3", { class: "panel__title" }, section.title),
            section.fields.map((f) => fieldEl(f, data, ctx))
          )
        )
      )
    );
  }

  // Master/detail editor for lists (courses, news, photos…)
  function entriesOf(col) {
    if (col.type === "folder") return state.pages.filter((p) => !p.deleted).map((p) => ({ obj: p.data, page: p }));
    return state.docs[col.id].data.items.map((obj, index) => ({ obj, index }));
  }

  function renderListCollection(col) {
    const entries = entriesOf(col);
    if (state.selected[col.id] == null || state.selected[col.id] >= entries.length) state.selected[col.id] = entries.length ? 0 : -1;

    const listPanel = h("div", { class: "list-panel" });
    const editorPanel = h("div", { class: "editor-panel" });

    const toolbar = h("div", { class: "list-panel__tools" },
      h("label", { class: "search" }, icon("search"),
        h("input", { type: "search", placeholder: "Search " + col.label.toLowerCase(), value: state.filter, oninput: (e) => { state.filter = e.target.value; drawList(); } })
      ),
      h("button", { class: "btn btn--primary btn--sm", onclick: () => addItem(col) }, icon("plus"), "New"),
      col.bulkUpload && bulkUploadButton(col)
    );
    const list = h("ul", { class: "item-list", role: "listbox", "aria-label": col.label });

    function drawList() {
      const q = state.filter.trim().toLowerCase();
      const all = entriesOf(col);
      list.replaceChildren(...all.map((entry, i) => {
        const o = entry.obj;
        const title = col.title(o) || "Untitled " + col.singular;
        if (q && !JSON.stringify(o).toLowerCase().includes(q)) return null;
        const badges = (col.badges ? col.badges(o) : []).concat(o.published === false ? ["Hidden"] : []);
        const thumb = col.thumb && col.thumb(o);
        return h("li", {
          class: "item" + (i === state.selected[col.id] ? " is-selected" : "") + (o.published === false ? " is-hidden" : ""),
          role: "option", tabindex: 0, "aria-selected": i === state.selected[col.id] ? "true" : "false",
          onclick: () => select(i), onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(i); } }
        },
          thumb ? h("img", { class: "item__thumb", src: previewUrl(thumb), alt: "", loading: "lazy" }) : null,
          h("span", { class: "item__text" },
            h("strong", {}, title),
            col.sub && h("span", {}, col.sub(o) || "")
          ),
          badges.length ? h("span", { class: "item__badges" }, badges.map((b) => h("span", { class: "badge badge--" + slugify(b) }, b))) : null
        );
      }).filter(Boolean));
      if (!list.children.length) list.append(h("li", { class: "empty" }, all.length ? "Nothing matches your search." : "No " + col.label.toLowerCase() + " yet. Click “New” to add one."));
    }

    function select(i) {
      state.selected[col.id] = i;
      state.mobileEditing = true;
      drawList();
      drawEditor();
    }

    function drawEditor() {
      const all = entriesOf(col);
      const i = state.selected[col.id];
      const entry = all[i];
      document.querySelector(".collection")?.classList.toggle("is-editing", state.mobileEditing && !!entry);
      if (!entry) {
        fill(editorPanel, h("div", { class: "empty-editor" }, icon(col.icon), h("p", {}, "Select a " + col.singular + " to edit it, or create a new one.")));
        return;
      }
      const o = entry.obj;
      const ctx = { onChange: changed };
      const previewHref = col.previewItem ? col.previewItem(o) : col.preview;
      fill(editorPanel, 
        h("div", { class: "editor-head" },
          h("button", { class: "icon-btn editor-head__back", "aria-label": "Back to list", onclick: () => { state.mobileEditing = false; drawEditor(); } }, icon("back")),
          h("h2", {}, col.title(o) || "New " + col.singular),
          h("div", { class: "editor-head__tools" },
            col.type === "list" && h("button", { class: "icon-btn", title: "Move up", "aria-label": "Move up", disabled: i === 0, onclick: () => move(col, i, -1) }, icon("up")),
            col.type === "list" && h("button", { class: "icon-btn", title: "Move down", "aria-label": "Move down", disabled: i === all.length - 1, onclick: () => move(col, i, 1) }, icon("down")),
            h("button", { class: "icon-btn", title: "Duplicate", "aria-label": "Duplicate", onclick: () => duplicate(col, i) }, icon("copy")),
            previewHref && h("a", { class: "icon-btn", title: "View on site", "aria-label": "View on site", href: siteUrl(previewHref), target: "_blank", rel: "noopener" }, icon("external")),
            h("button", { class: "icon-btn icon-btn--danger", title: "Delete", "aria-label": "Delete", onclick: () => removeItem(col, i) }, icon("trash"))
          )
        ),
        h("div", { class: "panel" }, col.fields.map((f) => fieldEl(f, o, ctx))),
        entry.page && !entry.page.origPath && h("p", { class: "muted small" }, "New page — it will be created when you publish.")
      );
    }

    listPanel.append(toolbar, list);
    fill(els.content, 
      viewHeader(col),
      col.headerFields && h("details", { class: "panel panel--collapsible" },
        h("summary", {}, "Test settings"),
        col.headerFields.map((f) => fieldEl(f, state.docs[col.id].data, { onChange: changed }))
      ),
      h("div", { class: "collection" }, listPanel, editorPanel)
    );
    els.refreshList = drawList;
    drawList();
    drawEditor();
  }

  function addItem(col) {
    const obj = defaultsFor(col.fields);
    if (col.type === "folder") {
      obj.slug = "new-page-" + Date.now().toString(36).slice(-4);
      obj.title = "";
      state.pages.unshift({ origPath: null, sha: null, savedText: null, data: obj, deleted: false });
      state.selected[col.id] = 0;
    } else {
      const items = state.docs[col.id].data.items;
      if (col.addToTop) { items.unshift(obj); state.selected[col.id] = 0; }
      else { items.push(obj); state.selected[col.id] = items.length - 1; }
    }
    state.mobileEditing = true;
    renderView();
    updateChrome();
    const first = document.querySelector(".editor-panel input, .editor-panel textarea");
    if (first) first.focus();
  }

  function move(col, i, delta) {
    const items = state.docs[col.id].data.items;
    const j = i + delta;
    if (j < 0 || j >= items.length) return;
    [items[i], items[j]] = [items[j], items[i]];
    state.selected[col.id] = j;
    renderView();
    updateChrome();
  }

  function duplicate(col, i) {
    const entries = entriesOf(col);
    const copy = clone(entries[i].obj);
    if (col.type === "folder") {
      copy.slug = (copy.slug || "page") + "-copy";
      copy.title = (copy.title || "") + " (copy)";
      state.pages.unshift({ origPath: null, sha: null, savedText: null, data: copy, deleted: false });
      state.selected[col.id] = 0;
    } else {
      state.docs[col.id].data.items.splice(i + 1, 0, copy);
      state.selected[col.id] = i + 1;
    }
    renderView();
    updateChrome();
    toast("Duplicated — remember to publish");
  }

  async function removeItem(col, i) {
    const entry = entriesOf(col)[i];
    const name = col.title(entry.obj) || "this " + col.singular;
    const ok = await confirmDialog("Delete “" + name + "”?", "It will be removed from the website when you publish. Tip: to hide it temporarily instead, switch off “Published”.", "Delete", true);
    if (!ok) return;
    if (col.type === "folder") {
      if (entry.page.origPath) entry.page.deleted = true;
      else state.pages.splice(state.pages.indexOf(entry.page), 1);
    } else {
      state.docs[col.id].data.items.splice(i, 1);
    }
    state.selected[col.id] = Math.max(0, i - 1);
    state.mobileEditing = false;
    renderView();
    updateChrome();
  }


  /* =========================================================
     7. FIELD WIDGETS
     ========================================================= */
  function fieldEl(field, obj, ctx) {
    const id = "f" + ++uid;
    const set = (v) => { obj[field.name] = v; ctx.onChange(); };
    const label = field.label && h("label", { class: "field__label", for: id }, field.label, field.required && h("span", { class: "req", title: "Required" }, " *"));
    const hint = field.hint && h("p", { class: "field__hint" }, field.hint);
    const wrap = (...kids) => h("div", { class: "field field--" + field.type }, label, kids, hint);
    const value = obj[field.name];

    switch (field.type) {
      case "string":
        return wrap(h("input", { type: "text", id, value: value == null ? "" : value, placeholder: field.placeholder, required: field.required, pattern: field.pattern,
          oninput: (e) => set(e.target.value) }));

      case "text": {
        const ta = h("textarea", { id, rows: 3, value: value || "", placeholder: field.placeholder, oninput: (e) => { autoGrow(ta); set(e.target.value); } });
        requestAnimationFrame(() => autoGrow(ta));
        return wrap(ta);
      }

      case "number":
        return wrap(h("input", { type: "number", id, value: value == null ? "" : value, min: field.min, max: field.max, inputmode: "numeric",
          oninput: (e) => set(e.target.value === "" ? "" : Number(e.target.value)) }));

      case "date":
        return wrap(h("div", { class: "inline" },
          h("input", { type: "date", id, value: value ? String(value).slice(0, 10) : "", oninput: (e) => set(e.target.value) }),
          !field.required && h("button", { type: "button", class: "btn btn--ghost btn--sm", onclick: (e) => { e.target.closest(".inline").querySelector("input").value = ""; set(""); } }, "Clear")
        ));

      case "boolean":
        return h("div", { class: "field field--boolean" },
          h("label", { class: "switch", for: id },
            h("input", { type: "checkbox", id, role: "switch", checked: !!value, onchange: (e) => set(e.target.checked) }),
            h("span", { class: "switch__track", "aria-hidden": "true" }),
            h("span", {}, field.label)
          ),
          hint
        );

      case "color": {
        const text = h("input", { type: "text", value: value || "", class: "color-text", "aria-label": field.label + " (hex)",
          oninput: (e) => { if (/^#[0-9a-f]{6}$/i.test(e.target.value)) { picker.value = e.target.value; } set(e.target.value); } });
        const picker = h("input", { type: "color", id, value: /^#[0-9a-f]{6}$/i.test(value) ? value : "#000000",
          oninput: (e) => { text.value = e.target.value; set(e.target.value); } });
        return wrap(h("div", { class: "inline" }, picker, text));
      }

      case "rating": {
        const box = h("div", { class: "rating", role: "radiogroup", "aria-label": field.label });
        const draw = () => fill(box, ...[1, 2, 3, 4, 5].map((n) =>
          h("button", { type: "button", class: "rating__star" + (n <= (obj[field.name] || 0) ? " is-on" : ""), role: "radio", "aria-checked": n === obj[field.name] ? "true" : "false", "aria-label": n + " stars",
            onclick: () => { set(n); draw(); } }, "★")));
        draw();
        return wrap(box);
      }

      case "markdown":
        return wrap(markdownEditor(id, value || "", set));

      case "image":
        return wrap(imageField(id, field, value || "", set));

      case "strings": {
        const arr = Array.isArray(value) ? value : (obj[field.name] = []);
        const box = h("div", { class: "repeater repeater--flat" });
        const draw = (focusIndex) => {
          fill(box, 
            ...arr.map((item, i) => h("div", { class: "strings-row" },
              h("input", { type: "text", value: item, "aria-label": (field.singular || "item") + " " + (i + 1),
                oninput: (e) => { arr[i] = e.target.value; ctx.onChange(); },
                onkeydown: (e) => { if (e.key === "Enter") { e.preventDefault(); arr.splice(i + 1, 0, ""); ctx.onChange(); draw(i + 1); } } }),
              h("button", { type: "button", class: "icon-btn", "aria-label": "Move up", disabled: i === 0, onclick: () => { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; ctx.onChange(); draw(); } }, icon("up")),
              h("button", { type: "button", class: "icon-btn icon-btn--danger", "aria-label": "Remove", onclick: () => { arr.splice(i, 1); ctx.onChange(); draw(); } }, icon("trash"))
            )),
            h("button", { type: "button", class: "btn btn--ghost btn--sm", onclick: () => { arr.push(""); ctx.onChange(); draw(arr.length - 1); } }, icon("plus"), "Add " + (field.singular || "item"))
          );
          if (focusIndex != null) { const inputs = box.querySelectorAll("input"); if (inputs[focusIndex]) inputs[focusIndex].focus(); }
        };
        draw();
        return wrap(box);
      }

      case "object": {
        const sub = obj[field.name] && typeof obj[field.name] === "object" ? obj[field.name] : (obj[field.name] = {});
        return h("div", { class: "field-group" }, field.label && h("p", { class: "field__label" }, field.label), field.fields.map((f) => fieldEl(f, sub, ctx)));
      }

      case "list": {
        const arr = Array.isArray(value) ? value : (obj[field.name] = []);
        const box = h("div", { class: "repeater" });
        const draw = () => {
          fill(box, 
            ...arr.map((item, i) => h("div", { class: "repeater__item" },
              h("div", { class: "repeater__head" },
                h("strong", {}, item[field.summary] || (field.singular || "item") + " " + (i + 1)),
                h("span", { class: "repeater__tools" },
                  h("button", { type: "button", class: "icon-btn", "aria-label": "Move up", disabled: i === 0, onclick: () => { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; ctx.onChange(); draw(); } }, icon("up")),
                  h("button", { type: "button", class: "icon-btn", "aria-label": "Move down", disabled: i === arr.length - 1, onclick: () => { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; ctx.onChange(); draw(); } }, icon("down")),
                  h("button", { type: "button", class: "icon-btn icon-btn--danger", "aria-label": "Remove", onclick: async () => {
                    if (await confirmDialog("Remove this " + (field.singular || "item") + "?", "", "Remove", true)) { arr.splice(i, 1); ctx.onChange(); draw(); }
                  } }, icon("trash"))
                )
              ),
              h("div", { class: "repeater__body" }, field.fields.map((f) => fieldEl(f, item, ctx)))
            )),
            h("button", { type: "button", class: "btn btn--ghost btn--sm", onclick: () => { arr.push(defaultsFor(field.fields)); ctx.onChange(); draw(); } }, icon("plus"), "Add " + (field.singular || "item"))
          );
        };
        draw();
        return wrap(box);
      }

      case "choices": {
        if (!Array.isArray(obj.options)) obj.options = ["", ""];
        const letters = "ABCDEFGH";
        const box = h("div", { class: "choices" });
        const name = "c" + id;
        const draw = () => {
          fill(box, 
            ...obj.options.map((opt, i) => h("div", { class: "choice" + (obj.correct === i + 1 ? " is-correct" : "") },
              h("label", { class: "choice__radio", title: "Mark as the correct answer" },
                h("input", { type: "radio", name, checked: obj.correct === i + 1, onchange: () => { obj.correct = i + 1; ctx.onChange(); draw(); } }),
                h("span", {}, letters[i])
              ),
              h("input", { type: "text", value: opt, "aria-label": "Answer " + letters[i], oninput: (e) => { obj.options[i] = e.target.value; ctx.onChange(); } }),
              h("button", { type: "button", class: "icon-btn icon-btn--danger", "aria-label": "Remove answer", disabled: obj.options.length <= 2, onclick: () => {
                obj.options.splice(i, 1);
                if (obj.correct === i + 1) obj.correct = 1; else if (obj.correct > i + 1) obj.correct--;
                ctx.onChange(); draw();
              } }, icon("trash"))
            )),
            obj.options.length < 6 && h("button", { type: "button", class: "btn btn--ghost btn--sm", onclick: () => { obj.options.push(""); ctx.onChange(); draw(); } }, icon("plus"), "Add answer")
          );
        };
        draw();
        return wrap(box);
      }
    }
    return wrap(h("p", { class: "muted" }, "Unsupported field: " + field.type));
  }

  function autoGrow(ta) {
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight + 2, 600) + "px";
  }

  function markdownEditor(id, value, set) {
    const ta = h("textarea", { id, rows: 6, value, class: "md-input", oninput: () => { autoGrow(ta); set(ta.value); } });
    const preview = h("div", { class: "md-preview", hidden: true });
    const wrapSel = (before, after, placeholder) => {
      const s = ta.selectionStart, e = ta.selectionEnd;
      const selected = ta.value.slice(s, e) || placeholder;
      ta.setRangeText(before + selected + after, s, e, "end");
      ta.focus();
      ta.dispatchEvent(new Event("input"));
    };
    const linePrefix = (prefix) => {
      const s = ta.value.lastIndexOf("\n", ta.selectionStart - 1) + 1;
      ta.setRangeText(prefix, s, s, "end");
      ta.focus();
      ta.dispatchEvent(new Event("input"));
    };
    const tabWrite = h("button", { type: "button", class: "md-tab is-active", onclick: () => showTab(false) }, "Write");
    const tabPreview = h("button", { type: "button", class: "md-tab", onclick: () => showTab(true) }, "Preview");
    const tools = h("div", { class: "md-tools" },
      h("button", { type: "button", title: "Bold", onclick: () => wrapSel("**", "**", "bold text") }, h("b", {}, "B")),
      h("button", { type: "button", title: "Italic", onclick: () => wrapSel("_", "_", "italic text") }, h("i", {}, "I")),
      h("button", { type: "button", title: "Heading", onclick: () => linePrefix("## ") }, "H"),
      h("button", { type: "button", title: "Bullet list", onclick: () => linePrefix("- ") }, "•"),
      h("button", { type: "button", title: "Numbered list", onclick: () => linePrefix("1. ") }, "1."),
      h("button", { type: "button", title: "Link", onclick: () => wrapSel("[", "](https://)", "link text") }, "🔗")
    );
    function showTab(isPreview) {
      tabWrite.classList.toggle("is-active", !isPreview);
      tabPreview.classList.toggle("is-active", isPreview);
      ta.hidden = isPreview;
      tools.hidden = isPreview;
      preview.hidden = !isPreview;
      if (isPreview) preview.innerHTML = window.marked ? window.marked.parse(ta.value || "*Nothing to preview yet.*") : "<p>Preview unavailable.</p>";
    }
    requestAnimationFrame(() => autoGrow(ta));
    return h("div", { class: "md" }, h("div", { class: "md-bar" }, tabWrite, tabPreview, tools), ta, preview);
  }


  /* =========================================================
     8. IMAGES — compressed in the browser before upload
     ---------------------------------------------------------
     Phone photos are often 3–8 MB. Before uploading we shrink
     them (max 1600px, WebP) so the website stays fast — a
     typical photo ends up around 150–300 KB.
     ========================================================= */
  function previewUrl(value) {
    if (!value) return "";
    const key = String(value).replace(/^\//, "");
    if (state.uploads.has(key)) return state.uploads.get(key).preview;
    if (/^https?:\/\//.test(value)) {
      return /images\.unsplash\.com/.test(value) ? value.split("?")[0] + "?auto=format&fit=crop&w=240&q=60" : value;
    }
    return siteUrl(value);
  }

  async function compressImage(file, maxSize) {
    if (!/^image\/(jpeg|png|webp|bmp|heic|heif)$/i.test(file.type) || typeof createImageBitmap !== "function") {
      return { blob: file, ext: (file.name.split(".").pop() || "img").toLowerCase() };
    }
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const toBlob = (type, q) => new Promise((r) => canvas.toBlob(r, type, q));
    let blob = await toBlob("image/webp", 0.8);
    let ext = "webp";
    if (!blob || blob.type !== "image/webp") { blob = await toBlob("image/jpeg", 0.82); ext = "jpg"; }
    // Never make a small file bigger
    if (blob.size > file.size && scale === 1) return { blob: file, ext: (file.name.split(".").pop() || "jpg").toLowerCase() };
    return { blob, ext };
  }

  async function stageUpload(file, maxSize) {
    if (!/^image\//.test(file.type)) throw new Error("That file isn't an image.");
    if (file.size > 25 * 1024 * 1024) throw new Error("That image is over 25 MB — please choose a smaller one.");
    const { blob, ext } = await compressImage(file, maxSize || 1600);
    const base = slugify(file.name.replace(/\.[^.]+$/, "")) || "image";
    const path = "images/uploads/" + base + "-" + Date.now().toString(36) + "." + ext;
    state.uploads.set(path, { base64: await blobToBase64(blob), preview: URL.createObjectURL(blob) });
    return { value: "/" + path, size: blob.size };
  }

  const kb = (n) => (n > 1024 * 1024 ? (n / 1024 / 1024).toFixed(1) + " MB" : Math.round(n / 1024) + " KB");

  function imageField(id, field, value, set) {
    const img = h("img", { class: "image-field__preview", alt: "" });
    const input = h("input", { type: "text", id, value, placeholder: "Upload an image, or paste a link", oninput: () => { set(input.value.trim()); refresh(); } });
    const fileInput = h("input", { type: "file", accept: "image/*", hidden: true, onchange: () => handle(fileInput.files[0]) });
    const box = h("div", { class: "image-field" },
      h("div", { class: "image-field__drop", title: "Drop an image here", onclick: () => fileInput.click() }, img, h("span", { class: "image-field__empty" }, icon("upload"), "Drop image or click")),
      h("div", { class: "image-field__side" },
        h("button", { type: "button", class: "btn btn--ghost btn--sm", onclick: () => fileInput.click() }, icon("upload"), "Upload"),
        input,
        h("p", { class: "field__hint" }, "Images are resized automatically for fast loading."),
        fileInput
      )
    );
    const drop = box.querySelector(".image-field__drop");
    drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("is-over"); });
    drop.addEventListener("dragleave", () => drop.classList.remove("is-over"));
    drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("is-over"); handle(e.dataTransfer.files[0]); });

    function refresh() {
      const v = input.value.trim();
      img.hidden = !v;
      box.classList.toggle("has-image", !!v);
      if (v) img.src = previewUrl(v);
    }
    async function handle(file) {
      if (!file) return;
      drop.classList.add("is-busy");
      try {
        const up = await stageUpload(file, field.maxSize);
        input.value = up.value;
        set(up.value);
        refresh();
        toast("Image ready (" + kb(file.size) + " → " + kb(up.size) + "). It uploads when you publish.", "success");
      } catch (e) {
        toast(e.message, "error");
      } finally {
        drop.classList.remove("is-busy");
        fileInput.value = "";
      }
    }
    refresh();
    return box;
  }

  function bulkUploadButton(col) {
    const input = h("input", { type: "file", accept: "image/*", multiple: true, hidden: true, onchange: async () => {
      const files = Array.from(input.files);
      input.value = "";
      if (!files.length) return;
      toast("Preparing " + files.length + " photo" + (files.length > 1 ? "s" : "") + "…");
      const items = state.docs[col.id].data.items;
      let added = 0;
      for (const file of files) {
        try {
          const up = await stageUpload(file, 1600);
          const obj = defaultsFor(col.fields);
          obj[col.bulkUpload] = up.value;
          obj.alt = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
          items.unshift(obj);
          added++;
        } catch (e) { toast(file.name + ": " + e.message, "error"); }
      }
      state.selected[col.id] = 0;
      renderView();
      updateChrome();
      if (added) toast(added + " photo" + (added > 1 ? "s" : "") + " added. Check the descriptions, then publish.", "success");
    } });
    return [h("button", { class: "btn btn--ghost btn--sm", onclick: () => input.click() }, icon("upload"), "Upload photos"), input];
  }


  /* =========================================================
     9. TOASTS, DIALOGS, KEYBOARD SHORTCUTS
     ========================================================= */
  function toast(message, type, ms) {
    const box = document.getElementById("toasts");
    const t = h("div", { class: "toast" + (type ? " toast--" + type : ""), role: type === "error" ? "alert" : "status" }, message);
    box.append(t);
    setTimeout(() => { t.classList.add("is-leaving"); setTimeout(() => t.remove(), 300); }, ms || 3500);
  }

  function confirmDialog(title, message, okLabel, danger) {
    return new Promise((resolve) => {
      const dialog = h("dialog", { class: "dialog" },
        h("h2", {}, title),
        message && h("p", { style: "white-space:pre-line" }, message),
        h("div", { class: "dialog__actions" },
          h("button", { class: "btn btn--ghost", value: "cancel", onclick: () => dialog.close("cancel") }, "Cancel"),
          h("button", { class: "btn " + (danger ? "btn--danger" : "btn--primary"), value: "ok", onclick: () => dialog.close("ok") }, okLabel || "OK")
        )
      );
      dialog.addEventListener("close", () => { resolve(dialog.returnValue === "ok"); dialog.remove(); });
      document.body.append(dialog);
      dialog.showModal();
    });
  }

  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      if (state.user) publish();
    }
  });

  window.addEventListener("beforeunload", (e) => {
    if (state.user && hasPendingWork()) { e.preventDefault(); e.returnValue = ""; }
  });

  window.addEventListener("hashchange", () => {
    const id = location.hash.slice(1);
    if (state.user && id !== state.view && (byId(id) || id === "dashboard")) go(id);
  });


  /* =========================================================
     10. START-UP
     ========================================================= */
  if (LOCAL) {
    start({ email: "", user_metadata: { full_name: "Local preview" } });
    return;
  }

  const identity = window.netlifyIdentity;
  if (!identity) {
    showFatal("Login service unavailable", "The Netlify Identity login script couldn't load. Check your internet connection and try again.");
    return;
  }
  identity.on("init", (user) => (user ? start(user) : showLogin()));
  identity.on("login", (user) => { identity.close(); start(user); });
  identity.on("logout", () => { started = false; state.user = null; showLogin(); });
  identity.on("error", (err) => console.error(err));
  if (identity.currentUser()) start(identity.currentUser());
  else setTimeout(() => { if (!started && !document.querySelector(".login")) showLogin(); }, 2500);
})();
