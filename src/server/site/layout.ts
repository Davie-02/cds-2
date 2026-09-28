import type { SiteContext } from "./context.js";
import { html, safeHref, safeSrc, text, type SafeHtml } from "./html.js";
import { SOCIAL_ICONS } from "./icons.js";
import { whatsappLink } from "./format.js";

export interface PageMeta {
  title: string;
  description?: string | null;
  image?: string | null;
  canonicalPath: string;
}

type Row = Record<string, any>;

function isCurrent(url: string, path: string): boolean {
  const target = url.split("#")[0]!;
  return target === path || (target === "/" && path === "/home");
}

function menuLink(item: Row, path: string): SafeHtml {
  const newTab = item.new_tab ? html` target="_blank" rel="noopener noreferrer"` : "";
  const current = isCurrent(item.url, path) ? html` aria-current="page"` : "";
  return html`<a
    href="${safeHref(item.url)}"
    ${item.is_button ? html` class="btn btn--dark"` : ""}${current}${newTab}
    >${item.label}</a
  >`;
}

async function header(ctx: SiteContext): Promise<SafeHtml> {
  const general = ctx.settings.general as Row;
  const links = await ctx.menu("header");
  return html`<header class="site-header">
    <div class="container nav">
      <a href="/" class="brand">
        ${general.logo ? html`<img src="${safeSrc(general.logo)}" alt="" class="brand__logo" />` : ""}
        <span class="brand__text"
          >${general.school_name}${general.tagline ? html`<small>${general.tagline}</small>` : ""}</span
        >
      </a>
      <button class="nav__toggle" aria-label="Toggle menu" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
      <nav class="nav__links">${links.map((item) => menuLink(item, ctx.path))}</nav>
    </div>
  </header>`;
}

async function notices(ctx: SiteContext): Promise<SafeHtml | string> {
  const active = await ctx.notices();
  if (!active.length) return "";
  return html`<div class="notices">
    ${active.map(
      (notice) =>
        html`<div class="notice notice--${notice.kind}" role="status">
          <div class="container">
            <strong>${notice.title}</strong> <span>${notice.message}</span>
            ${notice.link ? html` <a href="${safeHref(notice.link)}">${notice.link_label || "More"}</a>` : ""}
          </div>
        </div>`,
    )}
  </div>`;
}

async function footer(ctx: SiteContext): Promise<SafeHtml> {
  const general = ctx.settings.general as Row;
  const contact = ctx.settings.contact as Row;
  const [column1, column2] = await Promise.all([ctx.menu("footer_1"), ctx.menu("footer_2")]);
  const whatsapp = whatsappLink(contact.whatsapp_number, contact.whatsapp_message);
  const social = (contact.social_links ?? []) as Row[];
  const column = (title: unknown, links: Row[]) =>
    links.length
      ? html`<div>
          <h4>${title}</h4>
          <ul>
            ${links.map((item) => html`<li>${menuLink(item, ctx.path)}</li>`)}
          </ul>
        </div>`
      : "";

  return html`<footer class="site-footer">
    <div class="container">
      <div class="footer__grid">
        <div>
          <h4 class="footer__brand">${general.school_name}</h4>
          ${general.tagline ? html`<span class="tagline">${general.tagline}</span>` : ""}
          ${general.footer_text ? html`<p>${general.footer_text}</p>` : ""}
          ${
            social.length
              ? html`<div class="social">
                  ${social.map(
                    (link) =>
                      html`<a
                        href="${safeHref(link.url)}"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="${link.network}"
                        >${SOCIAL_ICONS[link.network] ?? link.network}</a
                      >`,
                  )}
                </div>`
              : ""
          }
        </div>
        ${column(general.footer_column_1, column1)} ${column(general.footer_column_2, column2)}
        <div>
          <h4>Contact</h4>
          <ul>
            ${contact.address ? html`<li>${contact.address}</li>` : ""}
            ${contact.phone ? html`<li><a href="tel:${text(contact.phone).replace(/\s/g, "")}">${contact.phone}</a></li>` : ""}
            ${contact.email ? html`<li><a href="mailto:${contact.email}">${contact.email}</a></li>` : ""}
            ${(contact.opening_hours ?? []).map((row: Row) => html`<li>${row.days}: ${row.hours}</li>`)}
            ${whatsapp ? html`<li><a href="${whatsapp}" target="_blank" rel="noopener noreferrer" class="whatsapp-button">WhatsApp Us</a></li>` : ""}
          </ul>
        </div>
      </div>
      <div class="footer__bottom">
        <span
          >&copy; ${new Date().getFullYear()} ${general.copyright || general.school_name}. All
          rights reserved.</span
        >
      </div>
    </div>
  </footer>`;
}

function themeStyle(ctx: SiteContext): SafeHtml {
  const general = ctx.settings.general as Row;
  const color = (value: unknown, fallback: string) =>
    /^#[0-9a-f]{6}$/i.test(String(value)) ? String(value) : fallback;
  return html`<style>
    :root {
      --color-line: ${color(general.primary_color, "#f5c344")};
      --color-asphalt: ${color(general.dark_color, "#1c2024")};
      --color-stop: ${color(general.accent_color, "#c94f3d")};
    }
  </style>`;
}

export async function layout(
  ctx: SiteContext,
  meta: PageMeta,
  body: SafeHtml | (SafeHtml | string)[],
): Promise<string> {
  const general = ctx.settings.general as Row;
  const description = meta.description || general.default_seo_description || "";
  const [head, notice, foot] = await Promise.all([header(ctx), notices(ctx), footer(ctx)]);
  const image = meta.image ? safeSrc(meta.image) : "";

  return html`<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${meta.title}</title>
        <meta name="description" content="${description}" />
        <meta property="og:title" content="${meta.title}" />
        <meta property="og:description" content="${description}" />
        <meta property="og:type" content="website" />
        ${image ? html`<meta property="og:image" content="${image}" />` : ""}
        <link rel="canonical" href="${meta.canonicalPath}" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        ${general.favicon ? html`<link rel="icon" href="${safeSrc(general.favicon)}" />` : ""}
        <link rel="apple-touch-icon" href="/images/apple-touch-icon.png" />
        <link rel="stylesheet" href="/css/style.css" />
        ${themeStyle(ctx)}
      </head>
      <body>
        ${head} ${notice}
        <main>${body}</main>
        ${foot}
        <script src="/js/site.js" defer></script>
      </body>
    </html>`.value;
}
