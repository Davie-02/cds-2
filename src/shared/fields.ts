export type FieldType =
  | "text"
  | "textarea"
  | "markdown"
  | "number"
  | "money"
  | "boolean"
  | "date"
  | "datetime"
  | "time"
  | "select"
  | "multiselect"
  | "tags"
  | "reference"
  | "image"
  | "media"
  | "file"
  | "url"
  | "email"
  | "phone"
  | "color"
  | "icon"
  | "list"
  | "password";

export interface Option {
  value: string;
  label: string;
}

export interface Field {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  help?: string;
  /** Max length for text types, max value for numbers, max items for lists. */
  max?: number;
  min?: number;
  options?: readonly Option[];
  /** Resource name a `reference` field points at. */
  resource?: string;
  /** Sub-fields of each item in a `list` field. */
  fields?: readonly Field[];
  default?: unknown;
  /** Shown as a column in admin lists. */
  inList?: boolean;
  /** Hidden from admin forms; set by the server. */
  readOnly?: boolean;
}

export const options = (...values: string[]): Option[] =>
  values.map((value) => ({ value, label: humanize(value) }));

export function humanize(value: string): string {
  const spaced = value.replace(/[_-]+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export const DEFAULT_TEXT_MAX: Partial<Record<FieldType, number>> = {
  text: 200,
  textarea: 2000,
  markdown: 50000,
  url: 500,
  image: 500,
  media: 500,
  file: 500,
  email: 254,
  phone: 20,
  password: 200,
};

export const LICENCE_CLASSES = options("A1", "A", "B", "C1", "C", "CE", "D1", "D");

export const GEARBOXES = options("manual", "automatic");

export const WEEKDAYS: Option[] = [
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
  { value: "0", label: "Sunday" },
];

export const ICONS = options(
  "star",
  "car",
  "clock",
  "check",
  "shield",
  "user",
  "badge",
  "book",
  "phone",
  "map",
  "calendar",
  "truck",
  "motorbike",
);

export const SOCIAL_NETWORKS = options(
  "facebook",
  "instagram",
  "whatsapp",
  "tiktok",
  "youtube",
  "x",
  "linkedin",
);

/** Returns the field list with list-level defaults applied, for building a blank form. */
export function blankValues(fields: readonly Field[]): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.readOnly) continue;
    values[field.name] = field.default ?? emptyValue(field);
  }
  return values;
}

function emptyValue(field: Field): unknown {
  switch (field.type) {
    case "boolean":
      return false;
    case "multiselect":
    case "tags":
    case "list":
      return [];
    case "number":
    case "money":
      return null;
    default:
      return "";
  }
}
