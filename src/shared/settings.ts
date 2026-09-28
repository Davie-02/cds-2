import { SOCIAL_NETWORKS, WEEKDAYS, type Field } from "./fields.js";

export interface SettingsGroup {
  label: string;
  description: string;
  fields: Field[];
}

/** Business settings, one form per group. Saved values are merged over the defaults file. */
export const SETTINGS_GROUPS = {
  general: {
    label: "Branding",
    description: "School name, logo, colours and footer text.",
    fields: [
      { name: "school_name", label: "School name", type: "text", max: 80, required: true },
      { name: "tagline", label: "Tagline", type: "text", max: 120 },
      { name: "logo", label: "Logo", type: "image" },
      { name: "favicon", label: "Browser tab icon", type: "image" },
      {
        name: "primary_color",
        label: "Main colour (buttons, accents)",
        type: "color",
        required: true,
      },
      {
        name: "dark_color",
        label: "Dark colour (header and footer)",
        type: "color",
        required: true,
      },
      {
        name: "accent_color",
        label: "Highlight colour (badges, warnings)",
        type: "color",
        required: true,
      },
      { name: "footer_text", label: "Footer description", type: "textarea", max: 300 },
      { name: "footer_column_1", label: "Footer column 1 title", type: "text", max: 40 },
      { name: "footer_column_2", label: "Footer column 2 title", type: "text", max: 40 },
      { name: "copyright", label: "Copyright holder", type: "text", max: 120 },
      {
        name: "default_seo_description",
        label: "Default search description",
        type: "textarea",
        max: 300,
      },
    ],
  },
  contact: {
    label: "Contact and map",
    description: "Phone numbers, email, WhatsApp, social links, opening hours and map.",
    fields: [
      { name: "phone", label: "Main phone", type: "phone" },
      { name: "email", label: "Email", type: "email" },
      { name: "address", label: "Main address", type: "text", max: 200 },
      {
        name: "whatsapp_number",
        label: "WhatsApp number",
        type: "phone",
        help: "International format, e.g. +265 999 118 292. Leave empty to hide WhatsApp buttons.",
      },
      { name: "whatsapp_message", label: "WhatsApp greeting", type: "text", max: 200 },
      {
        name: "opening_hours",
        label: "Opening hours",
        type: "list",
        max: 7,
        fields: [
          { name: "days", label: "Days", type: "text", max: 40, required: true },
          { name: "hours", label: "Hours", type: "text", max: 40, required: true },
        ],
      },
      { name: "map_latitude", label: "Map latitude", type: "text", max: 20 },
      { name: "map_longitude", label: "Map longitude", type: "text", max: 20 },
      { name: "map_zoom", label: "Map zoom (10–18)", type: "number", min: 10, max: 18 },
      {
        name: "social_links",
        label: "Social media",
        type: "list",
        max: 10,
        fields: [
          {
            name: "network",
            label: "Network",
            type: "select",
            options: SOCIAL_NETWORKS,
            required: true,
          },
          { name: "url", label: "Link", type: "url", required: true },
        ],
      },
    ],
  },
  booking: {
    label: "Booking rules",
    description: "When lessons can be booked and what students may do themselves.",
    fields: [
      { name: "timezone", label: "School time zone", type: "text", max: 60, required: true },
      {
        name: "self_booking_enabled",
        label: "Students can book their own lessons",
        type: "boolean",
      },
      {
        name: "require_confirmation",
        label: "Staff must confirm self-booked lessons",
        type: "boolean",
      },
      {
        name: "lesson_minutes",
        label: "Default lesson length (minutes)",
        type: "number",
        min: 15,
        max: 480,
      },
      {
        name: "max_lessons_per_day",
        label: "Max lessons per student per day",
        type: "number",
        min: 1,
        max: 10,
      },
      {
        name: "min_notice_hours",
        label: "Book at least this many hours ahead",
        type: "number",
        min: 0,
        max: 336,
      },
      {
        name: "booking_horizon_days",
        label: "Book at most this many days ahead",
        type: "number",
        min: 1,
        max: 180,
      },
      {
        name: "cancellation_hours",
        label: "Students can cancel or reschedule up to (hours before)",
        type: "number",
        min: 0,
        max: 336,
      },
      { name: "opening_time", label: "Lessons start from", type: "time" },
      { name: "closing_time", label: "Last lesson ends by", type: "time" },
      { name: "working_days", label: "Lesson days", type: "multiselect", options: WEEKDAYS },
    ],
  },
  theory: {
    label: "Theory and tests",
    description: "Pass marks and readiness rules.",
    fields: [
      {
        name: "pass_mark_percent",
        label: "Theory pass mark (%)",
        type: "number",
        min: 1,
        max: 100,
      },
      {
        name: "readiness_skill_percent",
        label: "Skills that must be competent before test-ready (%)",
        type: "number",
        min: 0,
        max: 100,
      },
      {
        name: "readiness_mock_passes",
        label: "Mock exams to pass before test-ready",
        type: "number",
        min: 0,
        max: 10,
      },
    ],
  },
  payments: {
    label: "Payments",
    description: "Currency, bank and mobile money details shown on invoices.",
    fields: [
      { name: "currency", label: "Currency label", type: "text", max: 10, required: true },
      { name: "bank_name", label: "Bank", type: "text", max: 80 },
      { name: "bank_account_name", label: "Account name", type: "text", max: 120 },
      { name: "bank_account_number", label: "Account number", type: "text", max: 40 },
      { name: "bank_branch", label: "Bank branch", type: "text", max: 80 },
      { name: "mobile_money", label: "Mobile money details", type: "textarea", max: 300 },
      { name: "invoice_note", label: "Note printed on invoices", type: "textarea", max: 500 },
      {
        name: "payment_due_days",
        label: "Invoices due after (days)",
        type: "number",
        min: 0,
        max: 365,
      },
    ],
  },
  reminders: {
    label: "Reminders",
    description: "Warnings for vehicle papers and service dates.",
    fields: [
      {
        name: "vehicle_warning_days",
        label: "Warn this many days before expiry",
        type: "number",
        min: 1,
        max: 180,
      },
      { name: "reminder_email", label: "Send daily reminder email to", type: "email" },
    ],
  },
} satisfies Record<string, SettingsGroup>;

export type SettingsGroupName = keyof typeof SETTINGS_GROUPS;
export type Settings = Record<SettingsGroupName, Record<string, unknown>>;
