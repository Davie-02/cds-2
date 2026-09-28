import type { Queryable } from "../db/pool.js";
import type { Settings } from "../../shared/settings.js";
import { loadSettings } from "../services/settings.js";
import { todayIn } from "../services/time.js";

type Row = Record<string, any>;

/** Per-request view of the site's content. Collections are loaded only when a section needs them. */
export class SiteContext {
  private readonly cache = new Map<string, Promise<Row[]>>();

  private constructor(
    readonly db: Queryable,
    readonly settings: Settings,
    readonly path: string,
  ) {}

  static async create(db: Queryable, path: string): Promise<SiteContext> {
    return new SiteContext(db, await loadSettings(db), path);
  }

  get today(): string {
    return todayIn(String(this.settings.booking.timezone));
  }

  private load(key: string, sql: string, params: unknown[] = []): Promise<Row[]> {
    let pending = this.cache.get(key);
    if (!pending) {
      pending = this.db.query(sql, params).then((result) => result.rows);
      this.cache.set(key, pending);
    }
    return pending;
  }

  menu(location: string) {
    return this.load(
      `menu:${location}`,
      "SELECT * FROM menu_items WHERE location = $1 AND visible AND deleted_at IS NULL ORDER BY position",
      [location],
    );
  }

  notices() {
    return this.load(
      "notices",
      `SELECT * FROM notices WHERE published AND deleted_at IS NULL AND starts_on <= $1
         AND (ends_on IS NULL OR ends_on >= $1) ORDER BY starts_on DESC`,
      [this.today],
    );
  }

  courses() {
    return this.load(
      "courses",
      "SELECT * FROM courses WHERE published AND deleted_at IS NULL ORDER BY position",
    );
  }

  posts() {
    return this.load(
      "posts",
      "SELECT * FROM posts WHERE published AND deleted_at IS NULL AND published_on <= $1 ORDER BY published_on DESC",
      [this.today],
    );
  }

  testimonials() {
    return this.load(
      "testimonials",
      "SELECT * FROM testimonials WHERE published AND deleted_at IS NULL ORDER BY position",
    );
  }

  instructors() {
    return this.load(
      "instructors",
      "SELECT * FROM instructors WHERE show_on_website AND active AND deleted_at IS NULL ORDER BY position",
    );
  }

  gallery() {
    return this.load(
      "gallery",
      "SELECT * FROM gallery_items WHERE published AND deleted_at IS NULL ORDER BY position",
    );
  }

  faqs() {
    return this.load(
      "faqs",
      "SELECT * FROM faqs WHERE published AND deleted_at IS NULL ORDER BY position",
    );
  }

  downloads() {
    return this.load(
      "downloads",
      "SELECT * FROM downloads WHERE published AND deleted_at IS NULL ORDER BY position",
    );
  }

  branches() {
    return this.load(
      "branches",
      "SELECT * FROM branches WHERE published AND deleted_at IS NULL ORDER BY position",
    );
  }

  async page(slug: string): Promise<Row | null> {
    const { rows } = await this.db.query(
      "SELECT * FROM pages WHERE slug = $1 AND published AND deleted_at IS NULL",
      [slug],
    );
    return rows[0] ?? null;
  }

  async sections(pageId: string): Promise<Row[]> {
    const { rows } = await this.db.query(
      "SELECT * FROM sections WHERE page_id = $1 AND visible AND deleted_at IS NULL ORDER BY position",
      [pageId],
    );
    return rows;
  }

  async post(slug: string): Promise<Row | null> {
    const posts = await this.posts();
    return posts.find((post) => post.slug === slug) ?? null;
  }
}
