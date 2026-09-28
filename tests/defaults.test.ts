import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getResource } from "../src/shared/resources.js";
import { SETTINGS_GROUPS, type SettingsGroupName } from "../src/shared/settings.js";
import { validate } from "../src/shared/validation.js";
import * as defaults from "../src/server/content/defaults.js";
import { validateSectionContent } from "../src/server/services/content.js";
import { seedDefaultContent } from "../src/server/services/seed.js";
import { loadSettings } from "../src/server/services/settings.js";
import { OWNER, client, login, setup, teardown, type TestContext } from "./helpers.js";

describe("default content is valid", () => {
  it.each(Object.keys(SETTINGS_GROUPS) as SettingsGroupName[])("settings group %s", (group) => {
    const result = validate(
      SETTINGS_GROUPS[group].fields,
      defaults.DEFAULT_SETTINGS[group],
      "create",
    );
    expect(result).toMatchObject({ ok: true });
  });

  it.each(defaults.DEFAULT_PAGES.map((page) => [page.slug, page] as const))(
    "page %s",
    (_slug, page) => {
      for (const section of page.sections)
        expect(() => validateSectionContent(section.type, section.content)).not.toThrow();
      expect(
        validate(getResource("pages")!.fields, { ...page, sections: undefined }, "create"),
      ).toMatchObject({ ok: true });
    },
  );

  const collections: [string, readonly Record<string, unknown>[]][] = [
    ["courses", defaults.DEFAULT_COURSES],
    ["instructors", defaults.DEFAULT_INSTRUCTORS],
    ["menu_items", defaults.DEFAULT_MENU],
    ["branches", defaults.DEFAULT_BRANCHES],
    ["posts", defaults.DEFAULT_POSTS],
    ["faqs", defaults.DEFAULT_FAQS],
    ["testimonials", defaults.DEFAULT_TESTIMONIALS],
    ["gallery", defaults.DEFAULT_GALLERY],
    ["skills", defaults.DEFAULT_SKILLS],
    ["questions", defaults.DEFAULT_QUESTIONS],
    ["theory_tests", defaults.DEFAULT_THEORY_TESTS],
  ];
  it.each(collections)("%s", (name, rows) => {
    const def = getResource(name)!;
    for (const row of rows) expect(validate(def.fields, row, "create")).toMatchObject({ ok: true });
  });
});

describe("a fresh database", () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await setup();
  });
  afterAll(() => teardown(ctx));

  it("shows every default page", async () => {
    for (const page of defaults.DEFAULT_PAGES.filter((p) => p.published !== false)) {
      const path = page.slug === "home" ? "/" : `/${page.slug}`;
      const response = await ctx.app.inject({ url: path });
      expect(response.statusCode, path).toBe(200);
      expect(response.body).toContain("Chimwemwe Driving School2");
    }
  });

  it("keeps old addresses working", async () => {
    const response = await ctx.app.inject({ url: "/services.html" });
    expect(response.statusCode).toBe(301);
    expect(response.headers.location).toBe("/courses");
  });

  it("seeds only once, so deleted defaults stay deleted", async () => {
    await ctx.db.query("UPDATE courses SET deleted_at = now()");
    expect(await seedDefaultContent(ctx.db)).toBe(false);
    const { rows } = await ctx.db.query("SELECT count(*) FROM courses WHERE deleted_at IS NULL");
    expect(rows[0].count).toBe(0);
    await ctx.db.query("UPDATE courses SET deleted_at = NULL");
  });

  it("lets saved settings override defaults and fills in anything not saved", async () => {
    await ctx.db.query(
      `INSERT INTO settings (group_name, data) VALUES ('general', '{"school_name": "New Name", "tagline": null}')`,
    );
    const settings = await loadSettings(ctx.db);
    expect(settings.general.school_name).toBe("New Name");
    expect(settings.general.tagline).toBeNull();
    expect(settings.general.primary_color).toBe(defaults.DEFAULT_SETTINGS.general.primary_color);
    const page = await ctx.app.inject({ url: "/" });
    expect(page.body).toContain("New Name");
  });

  it("shows admin changes on the site immediately", async () => {
    const owner = client(ctx.app, await login(ctx.app, OWNER.email, OWNER.password));
    const { body } = await owner.get("/api/admin/r/faqs");
    const faq = body.items[0];
    await owner.patch(`/api/admin/r/faqs/${faq.id}`, { question: "Is this updated live?" });
    const page = await ctx.app.inject({ url: "/courses" });
    expect(page.body).toContain("Is this updated live?");
  });
});
