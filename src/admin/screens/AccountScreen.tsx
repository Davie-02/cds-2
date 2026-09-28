import { useState } from "react";
import { FieldsForm, type Values } from "../components/FieldInput";
import { Message, PageHeader } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";

const FIELDS = [
  {
    name: "current_password",
    label: "Current password",
    type: "password" as const,
    required: true,
  },
  {
    name: "new_password",
    label: "New password (at least 10 characters)",
    type: "password" as const,
    required: true,
  },
];

export function AccountScreen() {
  const { me } = useAuth();
  const [values, setValues] = useState<Values>({ current_password: "", new_password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});
    try {
      await api.post("/api/auth/password", values);
      setValues({ current_password: "", new_password: "" });
      setMessage({
        type: "success",
        text: "Password changed. Other devices have been signed out.",
      });
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields);
      setMessage({ type: "error", text: (err as Error).message });
    }
  }

  return (
    <form className="editor" onSubmit={save}>
      <PageHeader title="My account" />
      <p>
        {me.name} · {me.email}
      </p>
      {message && <Message type={message.type}>{message.text}</Message>}
      <FieldsForm fields={FIELDS} values={values} onChange={setValues} errors={errors} />
      <button className="button button--primary">Change password</button>
    </form>
  );
}
