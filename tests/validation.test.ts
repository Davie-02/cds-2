import { describe, expect, it } from "vitest";
import type { Field } from "../src/shared/fields.js";
import { getResource } from "../src/shared/resources.js";
import { SETTINGS_GROUPS } from "../src/shared/settings.js";
import { isSafeAssetUrl, isSafeLink, validate } from "../src/shared/validation.js";
import { validateSectionContent } from "../src/server/services/content.js";
import { detectFileKind } from "../src/server/services/uploads.js";
import { markdown } from "../src/server/site/markdown.js";

describe("links", () => {
  it.each([
    "/about",
    "#faq",
    "/courses#faq",
    "https://example.com/x",
    "http://example.com",
    "mailto:a@b.co",
    "tel:+265999",
  ])("accepts %s", (link) => expect(isSafeLink(link)).toBe(true));

  it.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "data:text/html,<script>",
    "//evil.example",
    "vbscript:x",
    "/a b",
    'x" onmouseover="',
  ])("rejects %s", (link) => expect(isSafeLink(link)).toBe(false));

  it("allows only uploads, bundled images or https for media", () => {
    expect(isSafeAssetUrl("/uploads/0b7e2b0e-7a5e-4b7c-9c1e-2d1f1f1f1f1f/photo.jpg")).toBe(true);
    expect(isSafeAssetUrl("/images/logo.png")).toBe(true);
    expect(isSafeAssetUrl("https://images.unsplash.com/photo")).toBe(true);
    expect(isSafeAssetUrl("http://insecure.example/a.jpg")).toBe(false);
    expect(isSafeAssetUrl("/images/../../etc/passwd")).toBe(false);
    expect(isSafeAssetUrl("javascript:alert(1)")).toBe(false);
  });
});

describe("field validation", () => {
  const fields: Field[] = [
    { name: "title", label: "Title", type: "text", max: 10, required: true },
    { name: "price", label: "Price", type: "money", required: true },
    { name: "kind", label: "Kind", type: "select", options: [{ value: "a", label: "A" }] },
    { name: "link", label: "Link", type: "url" },
    { name: "when", label: "When", type: "date" },
    { name: "tags", label: "Tags", type: "tags", max: 2 },
    { name: "on", label: "On", type: "boolean" },
  ];

  it("reports every problem with a message per field", () => {
    const result = validate(
      fields,
      { title: "", price: -5, kind: "zzz", link: "javascript:x", when: "2026-02-30" },
      "create",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.title).toBe("Title is required");
    expect(result.errors.price).toMatch(/negative/);
    expect(result.errors.kind).toMatch(/invalid choice/);
    expect(result.errors.link).toMatch(/web address/);
    expect(result.errors.when).toMatch(/valid date/);
  });

  it("enforces lengths and list sizes", () => {
    const result = validate(
      fields,
      { title: "far too long a title", price: 1, tags: ["a", "b", "c"] },
      "create",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(["tags", "title"]);
  });

  it("drops keys the field list does not declare", () => {
    const result = validate(
      fields,
      { title: "Ok", price: 5, id: "x", role: "owner", deleted_at: null },
      "create",
    );
    expect(result.ok && result.data).toEqual({ title: "Ok", price: 5, tags: [], on: false });
  });

  it("treats updates as partial but still checks what is sent", () => {
    expect(validate(fields, { price: 10 }, "update")).toEqual({ ok: true, data: { price: 10 } });
    expect(validate(fields, { title: "" }, "update").ok).toBe(false);
  });

  it("turns blank optional values into null so they can be cleared", () => {
    const result = validate(fields, { title: "Ok", price: 1, link: "  " }, "create");
    expect(result.ok && result.data.link).toBeNull();
  });

  it("validates nested list items", () => {
    const invoices = getResource("invoices")!;
    const result = validate(
      invoices.fields,
      {
        student_id: crypto.randomUUID(),
        issued_on: "2026-01-01",
        lines: [{ description: "", quantity: 0, unit_price: 5 }],
      },
      "create",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors["lines.0.description"]).toBeDefined();
      expect(result.errors["lines.0.quantity"]).toBeDefined();
    }
  });
});

describe("section content", () => {
  it("checks content against the section type's own fields", () => {
    expect(() => validateSectionContent("hero", { heading: "" })).toThrow();
    expect(
      validateSectionContent("hero", { heading: "Hi", primary_link: "/contact" }).heading,
    ).toBe("Hi");
    expect(() =>
      validateSectionContent("cta", { heading: "Go", button_link: "javascript:alert(1)" }),
    ).toThrow();
    expect(() => validateSectionContent("no-such-type", {})).toThrow();
  });
});

describe("settings", () => {
  it("rejects invalid colours and emails", () => {
    const result = validate(
      SETTINGS_GROUPS.general.fields,
      { school_name: "S", primary_color: "red", dark_color: "#000000", accent_color: "#ffffff" },
      "create",
    );
    expect(result.ok).toBe(false);
    const contact = validate(SETTINGS_GROUPS.contact.fields, { email: "not-an-email" }, "create");
    expect(contact.ok).toBe(false);
  });
});

describe("uploads", () => {
  it("identifies files by content, not name", () => {
    expect(detectFileKind(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))?.mime).toBe("image/jpeg");
    expect(detectFileKind(Buffer.from("%PDF-1.7"))?.mime).toBe("application/pdf");
    expect(detectFileKind(Buffer.from('<svg onload="alert(1)"></svg>'))).toBeNull();
    expect(detectFileKind(Buffer.from("<html><script>alert(1)</script>"))).toBeNull();
  });
});

describe("markdown", () => {
  it("strips scripts and unsafe links from staff-written text", () => {
    const output = markdown(
      'Hi <script>alert(1)</script> [x](javascript:alert(1)) <img src="x" onerror="alert(1)">',
    ).value;
    expect(output).not.toMatch(/<script|javascript:|onerror/);
    expect(markdown("**bold**").value).toContain("<strong>bold</strong>");
  });
});
