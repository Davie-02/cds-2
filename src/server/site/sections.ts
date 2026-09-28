import { documentLabel } from "../../shared/resources.js";
import type { SectionTypeName } from "../../shared/sections.js";
import type { SiteContext } from "./context.js";
import { html, safeHref, safeSrc, text, type SafeHtml } from "./html.js";
import { CARD_ICONS } from "./icons.js";
import { markdown } from "./markdown.js";
import { formatDate, formatMoney, whatsappLink } from "./format.js";

type Content = Record<string, any>;
type Renderer = (content: Content, ctx: SiteContext, flash?: Flash) => SafeHtml | Promise<SafeHtml>;

export interface Flash {
  type: "success" | "error";
  message: string;
}

const headClass = (content: Content) => (content.dark ? "section section--dark" : "section");

function sectionHead(content: Content, centered = false): SafeHtml | string {
  if (!content.eyebrow && !content.heading && !content.intro) return "";
  return html`<div class="section-head${centered ? " text-center" : ""}">
    ${content.eyebrow ? html`<span class="eyebrow">${content.eyebrow}</span>` : ""}
    ${content.heading ? html`<h2>${content.heading}</h2>` : ""}
    ${content.intro ? html`<p>${content.intro}</p>` : ""}
  </div>`;
}

function button(label: unknown, link: unknown, style: string): SafeHtml | string {
  if (!label || !link) return "";
  return html`<a href="${safeHref(link)}" class="btn ${style}">${label}</a>`;
}

const empty = (message: string) => html`<p class="form-note">${message}</p>`;

const video = (url: string, className: string) => {
  const youtube = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/);
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (youtube || vimeo) {
    const src = youtube
      ? `https://www.youtube-nocookie.com/embed/${youtube[1]}`
      : `https://player.vimeo.com/video/${vimeo![1]}`;
    return html`<div class="video-embed ${className}">
      <iframe src="${src}" title="Video" loading="lazy" allowfullscreen></iframe>
    </div>`;
  }
  return html`<video
    class="${className}"
    src="${safeSrc(url)}"
    controls
    playsinline
    preload="metadata"
  ></video>`;
};

const ROUTE_ILLUSTRATION = html`<svg
  class="route-path"
  viewBox="0 0 420 320"
  xmlns="http://www.w3.org/2000/svg"
  aria-hidden="true"
>
  <path class="route-line" d="M20 280 C 100 280, 60 180, 150 170 S 260 60, 340 60" />
  <circle cx="20" cy="280" r="8" fill="var(--color-line)" />
  <circle cx="340" cy="60" r="10" fill="var(--color-go)" />
  <text x="10" y="304" fill="#c7cad0" font-family="Inter, sans-serif" font-size="13">Lesson 1</text>
  <text x="292" y="46" fill="#c7cad0" font-family="Inter, sans-serif" font-size="13">Licensed</text>
</svg>`;

function heroMedia(content: Content): SafeHtml | string {
  if (content.video) {
    return html`<video
      class="hero__media"
      src="${safeSrc(content.video)}"
      autoplay
      muted
      loop
      playsinline
      ${content.image ? html`poster="${safeSrc(content.image)}"` : ""}
    ></video>`;
  }
  if (content.image)
    return html`<img class="hero__media" src="${safeSrc(content.image)}" alt="" />`;
  return "";
}

function courseCard(course: Content, currency: string): SafeHtml {
  const featured = course.featured;
  const facts = [
    course.licence_class && `Class ${course.licence_class}`,
    course.lessons && `${course.lessons} lessons`,
    course.duration,
  ].filter(Boolean);
  return html`<div class="card card--price reveal${featured ? " card--featured" : ""}">
    ${course.photo ? html`<img class="card__photo" src="${safeSrc(course.photo)}" alt="" loading="lazy" />` : ""}
    <h3>${course.name}</h3>
    <p class="price">${formatMoney(course.price, currency)}</p>
    ${facts.length ? html`<p class="card__facts">${facts.join(" · ")}</p>` : ""}
    <div class="course-description">${markdown(course.summary)}</div>
    ${
      course.included?.length
        ? html`<ul>
            ${course.included.map((item: string) => html`<li>${item}</li>`)}
          </ul>`
        : ""
    }
    ${requirements(course)}
    <a
      href="/contact?course=${encodeURIComponent(text(course.name))}"
      class="btn ${featured ? "btn--primary" : "btn--ghost"} btn--block"
      >Enrol Now</a
    >
  </div>`;
}

function requirements(course: Content): SafeHtml | string {
  const items = [
    course.min_age && `Minimum age ${course.min_age}`,
    course.requires_permit && "Learner's permit before practical lessons",
    ...(course.documents_required ?? []).map(documentLabel),
    ...(course.other_requirements ?? []),
  ].filter(Boolean);
  if (!items.length) return "";
  return html`<details class="card__requirements">
    <summary>Requirements</summary>
    <ul>
      ${items.map((item: string) => html`<li>${item.charAt(0).toUpperCase() + item.slice(1)}</li>`)}
    </ul>
  </details>`;
}

function testimonialCard(item: Content, extraClass = ""): SafeHtml {
  const stars = Math.min(5, Math.max(1, Number(item.stars) || 5));
  return html`<div class="testimonial ${extraClass}">
    <span class="stars" aria-label="${stars} out of 5"
      >${"★".repeat(stars)}${"☆".repeat(5 - stars)}</span
    >
    <p class="quote">“${item.quote}”</p>
    <p class="who">${item.name}</p>
  </div>`;
}

const RENDERERS: Record<SectionTypeName, Renderer> = {
  hero: (c) =>
    html`<section class="hero${c.image || c.video ? " hero--media" : ""}">
      ${heroMedia(c)}
      <div class="container hero__grid">
        <div>
          ${c.badge ? html`<span class="badge">${c.badge}</span>` : ""}
          <h1>${c.heading}</h1>
          ${c.text ? html`<p class="lead">${c.text}</p>` : ""}
          <div class="hero__ctas">
            ${button(c.primary_label, c.primary_link, "btn--primary")}
            ${button(c.secondary_label, c.secondary_link, "btn--ghost")}
          </div>
          ${
            c.stats?.length
              ? html`<div class="hero__stats">
                  ${c.stats.map(
                    (s: Content) =>
                      html`<div class="hero__stat">
                        <strong>${s.value}</strong><span>${s.label}</span>
                      </div>`,
                  )}
                </div>`
              : ""
          }
        </div>
        <div>${c.show_route ? ROUTE_ILLUSTRATION : ""}</div>
      </div>
    </section>`,

  page_header: (c) =>
    html`<section
      class="page-hero${c.image ? " page-hero--image" : ""}"
      ${c.image ? html`style="--hero-image: url('${safeSrc(c.image)}')"` : ""}
    >
      <div class="container">
        ${c.eyebrow ? html`<span class="eyebrow eyebrow--dark">${c.eyebrow}</span>` : ""}
        <h1>${c.heading}</h1>
        ${c.text ? html`<p>${c.text}</p>` : ""}
      </div>
    </section>`,

  text_image: (c) =>
    html`<section class="${headClass(c)}">
      <div class="container grid grid--2 split${c.image_side === "left" ? " split--reverse" : ""}">
        <div>
          ${c.eyebrow ? html`<span class="eyebrow">${c.eyebrow}</span>` : ""}
          ${c.heading ? html`<h2>${c.heading}</h2>` : ""}
          <div class="page-content">${markdown(c.body)}</div>
        </div>
        ${c.image ? html`<div><img class="split__image" src="${safeSrc(c.image)}" alt="${c.image_alt ?? ""}" loading="lazy" /></div>` : ""}
      </div>
    </section>`,

  rich_text: (c) =>
    html`<section class="section">
      <div class="container narrow${c.centered ? " text-center" : ""}">
        ${c.heading ? html`<h2>${c.heading}</h2>` : ""}
        <div class="page-content">${markdown(c.body)}</div>
        ${button(c.button_label, c.button_link, "btn--primary")}
      </div>
    </section>`,

  cards: (c) =>
    html`<section class="${headClass(c)}">
      <div class="container">
        ${sectionHead(c)}
        <div class="grid grid--${c.columns ?? "3"}">
          ${(c.cards ?? []).map(
            (card: Content) =>
              html`<div class="card reveal">
                ${card.icon && CARD_ICONS[card.icon] ? html`<div class="card__icon">${CARD_ICONS[card.icon]}</div>` : ""}
                <h3>${card.title}</h3>
                ${card.text ? html`<p>${card.text}</p>` : ""}
              </div>`,
          )}
        </div>
      </div>
    </section>`,

  steps: (c) =>
    html`<section class="section">
      <div class="container">
        ${sectionHead(c)}
        <div class="steps">
          ${(c.steps ?? []).map(
            (step: Content) =>
              html`<div class="step reveal">
                <h3>${step.title}</h3>
                <p>${step.text}</p>
              </div>`,
          )}
        </div>
      </div>
    </section>`,

  cta: (c) =>
    html`<div class="cta-band">
      <div class="container">
        <div>
          <h3>${c.heading}</h3>
          ${c.text ? html`<p>${c.text}</p>` : ""}
        </div>
        ${button(c.button_label, c.button_link, "btn--dark")}
      </div>
    </div>`,

  courses: async (c, ctx) => {
    const currency = String(ctx.settings.payments.currency ?? "");
    const courses = (await ctx.courses()).filter(
      (course) => !c.category || c.category === "all" || course.category === c.category,
    );
    return html`<section class="${headClass(c)}">
      <div class="container">
        ${sectionHead(c)}
        ${
          courses.length
            ? html`<div class="grid grid--3">
                ${courses.map((course) => courseCard(course, currency))}
              </div>`
            : empty("Courses will be announced soon.")
        }
      </div>
    </section>`;
  },

  news: async (c, ctx) => {
    const posts = (await ctx.posts()).slice(0, Number(c.limit) || 3);
    return html`<section class="section section--tight">
      <div class="container">
        ${sectionHead(c)}
        ${
          posts.length
            ? html`<div class="grid grid--3">
                ${posts.map(
                  (post) =>
                    html`<a
                      class="card card--link reveal"
                      href="/news/${encodeURIComponent(post.slug)}"
                    >
                      ${post.image ? html`<img class="card__photo" src="${safeSrc(post.image)}" alt="" loading="lazy" />` : ""}
                      <span class="person__role">${formatDate(post.published_on)}</span>
                      <h3>${post.title}</h3>
                      <div class="announcement-body">
                        ${post.summary ? html`<p>${post.summary}</p>` : markdown(post.body)}
                      </div>
                    </a>`,
                )}
              </div>`
            : empty("No news yet.")
        }
      </div>
    </section>`;
  },

  testimonials: async (c, ctx) => {
    const items = await ctx.testimonials();
    if (!items.length) return html``;
    const body =
      c.style === "grid"
        ? html`<div class="grid grid--3">
            ${items.map((item) => testimonialCard(item, "reveal"))}
          </div>`
        : html`<div class="testimonial-slider" data-slider>
            <div class="testimonial-slider__track">
              ${items.map((item) => testimonialCard(item))}
            </div>
            <div class="testimonial-slider__nav"></div>
          </div>`;
    return html`<section class="section section--tight">
      <div class="container">${sectionHead(c, true)}${body}</div>
    </section>`;
  },

  instructors: async (c, ctx) => {
    const people = await ctx.instructors();
    return html`<section class="section">
      <div class="container">
        ${sectionHead(c)}
        <div class="grid grid--4">
          ${people.map(
            (person) =>
              html`<div class="person reveal">
                ${person.photo ? html`<img src="${safeSrc(person.photo)}" alt="Portrait of ${person.name}" loading="lazy" />` : ""}
                <div class="person__body">
                  <span class="person__role">${person.role_title}</span>
                  <h3>${person.name}</h3>
                  <p>${person.bio}</p>
                  ${person.licence_classes?.length ? html`<p class="person__meta">Teaches: ${person.licence_classes.join(", ")}</p>` : ""}
                  ${person.languages?.length ? html`<p class="person__meta">Languages: ${person.languages.join(", ")}</p>` : ""}
                </div>
              </div>`,
          )}
        </div>
      </div>
    </section>`;
  },

  gallery: async (c, ctx) => {
    const photos = await ctx.gallery();
    return html`<section class="section">
      <div class="container">
        ${sectionHead(c)}
        <div class="gallery">
          ${photos.map(
            (photo) =>
              html`<figure>
                <img src="${safeSrc(photo.image)}" alt="${photo.caption}" loading="lazy" />
              </figure>`,
          )}
        </div>
      </div>
    </section>`;
  },

  faq: async (c, ctx) => {
    const faqs = (await ctx.faqs()).filter((faq) => !c.category || faq.category === c.category);
    if (!faqs.length) return html``;
    return html`<section class="section" id="faq">
      <div class="container narrow">
        ${sectionHead(c)}
        <div class="faq-list">
          ${faqs.map(
            (faq) =>
              html`<details class="faq-item">
                <summary class="faq-item__q">
                  ${faq.question} <span class="plus" aria-hidden="true">+</span>
                </summary>
                <div class="faq-item__a">${markdown(faq.answer)}</div>
              </details>`,
          )}
        </div>
      </div>
    </section>`;
  },

  downloads: async (c, ctx) => {
    const files = await ctx.downloads();
    return html`<section class="section">
      <div class="container narrow">
        ${sectionHead(c)}
        ${
          files.length
            ? html`<ul class="download-list">
                ${files.map(
                  (file) =>
                    html`<li>
                      <a href="${safeSrc(file.file)}" download>${file.title}</a>
                      ${file.description ? html`<p>${file.description}</p>` : ""}
                    </li>`,
                )}
              </ul>`
            : empty("No downloads yet.")
        }
      </div>
    </section>`;
  },

  video: (c) =>
    html`<section class="section">
      <div class="container narrow">
        ${c.heading ? html`<h2>${c.heading}</h2>` : ""} ${video(text(c.video), "video-block")}
        ${c.caption ? html`<p class="form-note">${c.caption}</p>` : ""}
      </div>
    </section>`,

  contact: async (c, ctx, flash) => contactSection(c, ctx, flash),
};

async function contactSection(c: Content, ctx: SiteContext, flash?: Flash): Promise<SafeHtml> {
  const [courses, branches] = await Promise.all([ctx.courses(), ctx.branches()]);
  const contact = ctx.settings.contact as Content;
  const lat = Number(contact.map_latitude);
  const lng = Number(contact.map_longitude);
  const hasMap = c.show_map && Number.isFinite(lat) && Number.isFinite(lng) && contact.map_latitude;
  const zoom = Number(contact.map_zoom) || 14;
  const span = 0.6 / 2 ** (zoom - 10);
  const bbox = [lng - span, lat - span, lng + span, lat + span]
    .map((n) => n.toFixed(4))
    .join("%2C");

  const field = (id: string, label: string, input: SafeHtml, error: string) =>
    html`<div class="field">
      <label for="${id}">${label}</label>${input}<small class="error">${error}</small>
    </div>`;

  return html`<section class="section">
    <div class="container grid grid--2 contact-grid">
      <div class="card">
        <h2>${c.form_heading || "Book a lesson"}</h2>
        ${flash ? html`<div class="alert alert--${flash.type}" role="status">${flash.message}</div>` : ""}
        <form action="/enquiries" method="post" data-validate novalidate>
          <div class="hp-field" aria-hidden="true">
            <label>Leave empty <input name="website" tabindex="-1" autocomplete="off" /></label>
          </div>
          ${field("name", "Full name", html`<input type="text" id="name" name="name" maxlength="120" required autocomplete="name" />`, "Please enter your full name.")}
          ${field("phone", "Phone number", html`<input type="tel" id="phone" name="phone" maxlength="20" required autocomplete="tel" />`, "Please enter a valid phone number.")}
          ${field("email", "Email address (optional)", html`<input type="email" id="email" name="email" maxlength="254" autocomplete="email" />`, "Please enter a valid email address.")}
          ${field(
            "course",
            "Course interested in",
            html`<select id="course" name="course" required>
              <option value="">Select a course</option>
              ${courses.map((course) => html`<option>${course.name}</option>`)}
            </select>`,
            "Please choose a course.",
          )}
          ${
            branches.length
              ? field(
                  "branch",
                  "Preferred branch",
                  html`<select id="branch" name="branch" required>
                    <option value="">Select a branch</option>
                    ${branches.map((branch) => html`<option>${branch.name}</option>`)}
                  </select>`,
                  "Please choose a branch.",
                )
              : ""
          }
          <div class="field">
            <label for="message">Message (optional)</label>
            <textarea
              id="message"
              name="message"
              maxlength="2000"
              placeholder="Tell us about your schedule, experience level, or any questions."
            ></textarea>
          </div>
          <button type="submit" class="btn btn--primary btn--block">
            ${c.submit_label || "Send booking request"}
          </button>
          ${c.form_note ? html`<p class="form-note">${c.form_note}</p>` : ""}
        </form>
      </div>
      <div>
        <h2>${c.branches_heading || "Visit or call us"}</h2>
        ${branches.map((branch) => {
          const whatsapp = whatsappLink(
            branch.whatsapp_number || contact.whatsapp_number,
            contact.whatsapp_message,
          );
          return html`<div class="card branch-card">
            <h3>${branch.name}</h3>
            <p>${branch.address}</p>
            ${branch.phone ? html`<p><a href="tel:${text(branch.phone).replace(/\s/g, "")}">${branch.phone}</a></p>` : ""}
            ${branch.hours ? html`<p>${branch.hours}</p>` : ""}
            ${whatsapp ? html`<a href="${whatsapp}" target="_blank" rel="noopener noreferrer" class="whatsapp-button">WhatsApp Us</a>` : ""}
          </div>`;
        })}
        ${
          hasMap
            ? html`<div class="card">
                <h3>Find us on the map</h3>
                <iframe
                  class="map"
                  title="Map showing our location"
                  loading="lazy"
                  src="https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&amp;layer=mapnik&amp;marker=${lat}%2C${lng}"
                ></iframe>
              </div>`
            : ""
        }
      </div>
    </div>
  </section>`;
}

export async function renderSection(
  section: { type: string; content: Content },
  ctx: SiteContext,
  flash?: Flash,
): Promise<SafeHtml | string> {
  const renderer = RENDERERS[section.type as SectionTypeName];
  return renderer ? renderer(section.content ?? {}, ctx, flash) : "";
}
