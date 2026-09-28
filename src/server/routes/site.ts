import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type { Services } from "../app.js";
import { getResource } from "../../shared/resources.js";
import { SiteContext } from "../site/context.js";
import { html, safeSrc } from "../site/html.js";
import { layout } from "../site/layout.js";
import { markdown } from "../site/markdown.js";
import { formatDate } from "../site/format.js";
import { renderSection, type Flash } from "../site/sections.js";
import { HttpError } from "../errors.js";

/** Addresses from the old static site, kept working for bookmarks and search engines. */
const LEGACY_PATHS: Record<string, string> = {
  "/index.html": "/",
  "/about.html": "/about",
  "/services.html": "/courses",
  "/instructors.html": "/instructors",
  "/gallery.html": "/gallery",
  "/testimonials.html": "/testimonials",
  "/contact.html": "/contact",
  "/august-2026-offer.html": "/august-2026-offer",
};

const FLASHES: Record<string, Flash> = {
  sent: {
    type: "success",
    message: "Thank you! We'll contact you within one business day to confirm your lesson.",
  },
  invalid: {
    type: "error",
    message: "Please enter your name, a valid phone number and choose a course.",
  },
};

export function siteRoutes({ db, repository, config }: Services): FastifyPluginAsync {
  const canonical = (path: string) => new URL(path, config.PUBLIC_URL).toString();

  async function renderPage(reply: FastifyReply, slug: string, path: string, flash?: Flash) {
    const ctx = await SiteContext.create(db, path);
    const page = await ctx.page(slug);
    if (!page) return renderNotFound(reply, path);
    const sections = await ctx.sections(page.id);
    const body = await Promise.all(
      sections.map((section) =>
        renderSection({ type: section.type, content: section.content }, ctx, flash),
      ),
    );
    const general = ctx.settings.general;
    const title =
      page.seo_title ||
      (slug === "home" ? String(general.school_name) : `${page.title} — ${general.school_name}`);
    return reply.type("text/html").send(
      await layout(
        ctx,
        {
          title,
          description: page.seo_description,
          image: page.share_image,
          canonicalPath: canonical(path),
        },
        body,
      ),
    );
  }

  async function renderNotFound(reply: FastifyReply, path: string) {
    const ctx = await SiteContext.create(db, path);
    const body = html`<section class="page-hero">
        <div class="container">
          <h1>Page not found</h1>
          <p>The page you were looking for has moved or no longer exists.</p>
        </div>
      </section>
      <section class="section">
        <div class="container"><a class="btn btn--primary" href="/">Go to the home page</a></div>
      </section>`;
    return reply
      .code(404)
      .type("text/html")
      .send(
        await layout(
          ctx,
          {
            title: `Page not found — ${ctx.settings.general.school_name}`,
            canonicalPath: canonical(path),
          },
          body,
        ),
      );
  }

  return async (app) => {
    app.get("/", async (_request, reply) => renderPage(reply, "home", "/"));

    for (const [legacy, target] of Object.entries(LEGACY_PATHS)) {
      app.get(legacy, async (_request, reply) => reply.redirect(target, 301));
    }
    app.get("/page.html", async (request, reply) => {
      const slug = String((request.query as Record<string, unknown>).slug ?? "");
      return reply.redirect(/^[a-z0-9-]+$/.test(slug) ? `/${slug}` : "/", 301);
    });

    app.get("/news/:slug", async (request, reply) => {
      const { slug } = request.params as { slug: string };
      const ctx = await SiteContext.create(db, "/news");
      const post = await ctx.post(slug);
      if (!post) return renderNotFound(reply, request.url);
      const general = ctx.settings.general;
      const body = html`<section class="page-hero">
          <div class="container">
            <span class="eyebrow eyebrow--dark">${formatDate(post.published_on)}</span>
            <h1>${post.title}</h1>
          </div>
        </section>
        <section class="section">
          <div class="container narrow">
            ${post.image ? html`<img class="post__image" src="${safeSrc(post.image)}" alt="" />` : ""}
            <div class="page-content">${markdown(post.body)}</div>
            <p><a href="/news">← All news</a></p>
          </div>
        </section>`;
      return reply.type("text/html").send(
        await layout(
          ctx,
          {
            title: `${post.title} — ${general.school_name}`,
            description: post.seo_description || post.summary,
            image: post.image,
            canonicalPath: canonical(`/news/${slug}`),
          },
          body,
        ),
      );
    });

    app.post(
      "/enquiries",
      { config: { rateLimit: { max: 5, timeWindow: "10 minutes" } } },
      async (request, reply) => {
        const body = (request.body ?? {}) as Record<string, unknown>;
        // Bots fill every field, including the hidden one people never see.
        if (body.website) return reply.redirect("/contact?status=sent", 303);
        try {
          await repository.create(getResource("enquiries")!, { ...body, status: "new" }, null);
        } catch (error) {
          if (error instanceof HttpError && error.status === 400)
            return reply.redirect("/contact?status=invalid#name", 303);
          throw error;
        }
        return reply.redirect("/contact?status=sent", 303);
      },
    );

    app.get("/robots.txt", async (_request, reply) =>
      reply
        .type("text/plain")
        .send(
          `User-agent: *\nDisallow: /admin\nDisallow: /portal\nDisallow: /api/\nSitemap: ${canonical("/sitemap.xml")}\n`,
        ),
    );

    app.get("/sitemap.xml", async (_request, reply) => {
      const { rows: pages } = await db.query(
        "SELECT slug, updated_at FROM pages WHERE published AND deleted_at IS NULL",
      );
      const { rows: posts } = await db.query(
        "SELECT slug, updated_at FROM posts WHERE published AND deleted_at IS NULL AND published_on <= current_date",
      );
      const urls = [
        ...pages.map((page) => ({
          path: page.slug === "home" ? "/" : `/${page.slug}`,
          updated: page.updated_at,
        })),
        ...posts.map((post) => ({ path: `/news/${post.slug}`, updated: post.updated_at })),
      ];
      const xml = html`<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
          >${urls.map(
            (url) =>
              html`<url
                ><loc>${canonical(url.path)}</loc
                ><lastmod>${new Date(url.updated).toISOString().slice(0, 10)}</lastmod></url
              >`,
          )}</urlset
        >`;
      return reply.type("application/xml").send(xml.value);
    });

    app.get("/:slug", async (request, reply) => {
      const { slug } = request.params as { slug: string };
      if (slug === "home") return reply.redirect("/", 301);
      if (!/^[a-z0-9-]+$/.test(slug)) return renderNotFound(reply, request.url);
      const flash =
        slug === "contact"
          ? FLASHES[String((request.query as Record<string, unknown>).status ?? "")]
          : undefined;
      return renderPage(reply, slug, `/${slug}`, flash);
    });

    app.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith("/api/")) return reply.code(404).send({ error: "Not found" });
      return renderNotFound(reply, request.url);
    });
  };
}
