import { ICONS, options, type Field } from "./fields.js";

const heading: Field[] = [
  { name: "eyebrow", label: "Small label above heading", type: "text", max: 60 },
  { name: "heading", label: "Heading", type: "text", max: 160 },
  { name: "intro", label: "Intro text", type: "textarea", max: 600 },
];

const button = (prefix: string, label: string): Field[] => [
  { name: `${prefix}_label`, label: `${label} text`, type: "text", max: 60 },
  { name: `${prefix}_link`, label: `${label} link`, type: "url" },
];

const dark: Field = { name: "dark", label: "Dark background", type: "boolean" };

export interface SectionType {
  label: string;
  description: string;
  fields: Field[];
}

/**
 * Every block a page can be built from. The public renderer has one template per type,
 * and the admin builds each block's form from these field lists.
 */
export const SECTION_TYPES = {
  hero: {
    label: "Hero banner",
    description: "Large opening banner with heading, buttons, stats and optional photo or video.",
    fields: [
      { name: "badge", label: "Badge", type: "text", max: 80 },
      { name: "heading", label: "Heading", type: "text", max: 160, required: true },
      { name: "text", label: "Text", type: "textarea", max: 600 },
      ...button("primary", "Main button"),
      ...button("secondary", "Second button"),
      {
        name: "stats",
        label: "Stats",
        type: "list",
        max: 4,
        fields: [
          { name: "value", label: "Number", type: "text", max: 20, required: true },
          { name: "label", label: "Label", type: "text", max: 60, required: true },
        ],
      },
      { name: "image", label: "Banner photo", type: "image" },
      { name: "video", label: "Banner video (mp4 upload or https link)", type: "media" },
      { name: "show_route", label: "Show the road illustration", type: "boolean", default: true },
    ],
  },
  page_header: {
    label: "Page header",
    description: "Dark title band at the top of an inner page.",
    fields: [
      { name: "eyebrow", label: "Small label", type: "text", max: 60 },
      { name: "heading", label: "Heading", type: "text", max: 160, required: true },
      { name: "text", label: "Text", type: "textarea", max: 600 },
      { name: "image", label: "Background photo", type: "image" },
    ],
  },
  text_image: {
    label: "Text with photo",
    description: "A heading and formatted text beside a photo.",
    fields: [
      { name: "eyebrow", label: "Small label", type: "text", max: 60 },
      { name: "heading", label: "Heading", type: "text", max: 160 },
      { name: "body", label: "Text", type: "markdown", max: 10000 },
      { name: "image", label: "Photo", type: "image" },
      { name: "image_alt", label: "Photo description", type: "text", max: 160 },
      {
        name: "image_side",
        label: "Photo side",
        type: "select",
        options: options("right", "left"),
        default: "right",
      },
      dark,
    ],
  },
  rich_text: {
    label: "Text",
    description: "Formatted text such as a policy or article.",
    fields: [
      { name: "heading", label: "Heading", type: "text", max: 160 },
      { name: "body", label: "Text", type: "markdown", required: true },
      { name: "centered", label: "Centre the text", type: "boolean" },
      ...button("button", "Button"),
    ],
  },
  cards: {
    label: "Feature cards",
    description: "A grid of cards with icons, e.g. reasons to choose the school.",
    fields: [
      ...heading,
      {
        name: "columns",
        label: "Cards per row",
        type: "select",
        options: options("2", "3", "4"),
        default: "3",
      },
      dark,
      {
        name: "cards",
        label: "Cards",
        type: "list",
        max: 12,
        fields: [
          { name: "icon", label: "Icon", type: "icon", options: ICONS },
          { name: "title", label: "Title", type: "text", max: 80, required: true },
          { name: "text", label: "Text", type: "textarea", max: 400 },
        ],
      },
    ],
  },
  steps: {
    label: "Numbered steps",
    description: "A numbered process, e.g. from enquiry to licence.",
    fields: [
      ...heading,
      {
        name: "steps",
        label: "Steps",
        type: "list",
        max: 8,
        fields: [
          { name: "title", label: "Title", type: "text", max: 80, required: true },
          { name: "text", label: "Text", type: "textarea", max: 400 },
        ],
      },
    ],
  },
  cta: {
    label: "Call to action band",
    description: "Highlighted strip with a short message and a button.",
    fields: [
      { name: "heading", label: "Heading", type: "text", max: 120, required: true },
      { name: "text", label: "Text", type: "text", max: 200 },
      ...button("button", "Button"),
    ],
  },
  courses: {
    label: "Courses",
    description: "Course cards with prices, pulled from Courses.",
    fields: [
      ...heading,
      {
        name: "category",
        label: "Show",
        type: "select",
        options: [
          { value: "all", label: "All courses" },
          { value: "course", label: "Licence courses" },
          { value: "refresher", label: "Refresher courses" },
          { value: "theory", label: "Theory classes" },
          { value: "addon", label: "Add-ons" },
        ],
        default: "all",
      },
      dark,
    ],
  },
  news: {
    label: "Latest news",
    description: "Newest posts from News & blog.",
    fields: [
      ...heading,
      { name: "limit", label: "How many posts", type: "number", min: 1, max: 24, default: 3 },
    ],
  },
  testimonials: {
    label: "Testimonials",
    description: "Student reviews as a slider or grid.",
    fields: [
      ...heading,
      {
        name: "style",
        label: "Style",
        type: "select",
        options: options("slider", "grid"),
        default: "slider",
      },
    ],
  },
  instructors: {
    label: "Instructors",
    description: "Instructor profiles marked to show on the website.",
    fields: heading,
  },
  gallery: { label: "Gallery", description: "Published gallery photos.", fields: heading },
  faq: {
    label: "FAQ",
    description: "Questions and answers from the FAQ list.",
    fields: [
      ...heading,
      { name: "category", label: "Only this category (blank for all)", type: "text", max: 60 },
    ],
  },
  downloads: { label: "Downloads", description: "Files visitors can download.", fields: heading },
  video: {
    label: "Video",
    description: "An uploaded video or a YouTube/Vimeo link.",
    fields: [
      { name: "heading", label: "Heading", type: "text", max: 160 },
      {
        name: "video",
        label: "Video (mp4 upload or YouTube/Vimeo link)",
        type: "media",
        required: true,
      },
      { name: "caption", label: "Caption", type: "text", max: 200 },
    ],
  },
  contact: {
    label: "Contact form and branches",
    description: "Enquiry form, branch cards and map.",
    fields: [
      {
        name: "form_heading",
        label: "Form heading",
        type: "text",
        max: 80,
        default: "Book a lesson",
      },
      { name: "form_note", label: "Note under the form", type: "text", max: 200 },
      {
        name: "submit_label",
        label: "Button text",
        type: "text",
        max: 60,
        default: "Send booking request",
      },
      {
        name: "branches_heading",
        label: "Branches heading",
        type: "text",
        max: 80,
        default: "Visit or call us",
      },
      { name: "show_map", label: "Show map", type: "boolean", default: true },
    ],
  },
} satisfies Record<string, SectionType>;

export type SectionTypeName = keyof typeof SECTION_TYPES;

export const SECTION_TYPE_OPTIONS = Object.entries(SECTION_TYPES).map(([value, type]) => ({
  value,
  label: type.label,
}));

export function sectionFields(type: string): Field[] | undefined {
  return (SECTION_TYPES as Record<string, SectionType>)[type]?.fields;
}
