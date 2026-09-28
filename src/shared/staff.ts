import { options, type Field } from "./fields.js";
import { STAFF_ROLES } from "./permissions.js";

export const STAFF_FIELDS: Field[] = [
  { name: "name", label: "Name", type: "text", max: 80, required: true, inList: true },
  { name: "email", label: "Email (used to sign in)", type: "email", required: true, inList: true },
  { name: "phone", label: "Phone", type: "phone" },
  {
    name: "role",
    label: "Role",
    type: "select",
    options: options(...STAFF_ROLES),
    required: true,
    inList: true,
  },
  { name: "password", label: "Password (leave blank to keep the current one)", type: "password" },
  { name: "active", label: "Can sign in", type: "boolean", default: true, inList: true },
];
