import { useEffect, useState } from "react";
import { SETTINGS_GROUPS, type SettingsGroupName } from "../../shared/settings";
import { FieldsForm, type Values } from "../components/FieldInput";
import { Loading, Message, PageHeader } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { useLoad } from "../lib/useLoad";

const GROUPS = Object.keys(SETTINGS_GROUPS) as SettingsGroupName[];

export function SettingsScreen() {
  const settings = useLoad(
    () => api.get<Record<SettingsGroupName, Values>>("/api/admin/settings"),
    [],
  );
  const [group, setGroup] = useState<SettingsGroupName>("general");

  if (settings.loading && !settings.data) return <Loading />;
  if (settings.error || !settings.data) return <Message type="error">{settings.error}</Message>;

  return (
    <>
      <PageHeader title="Settings" />
      <div className="tabs" role="tablist">
        {GROUPS.map((name) => (
          <button
            key={name}
            role="tab"
            aria-selected={group === name}
            className={group === name ? "tab tab--active" : "tab"}
            onClick={() => setGroup(name)}
          >
            {SETTINGS_GROUPS[name].label}
          </button>
        ))}
      </div>
      <SettingsForm
        key={group}
        group={group}
        initial={settings.data[group]}
        onSaved={settings.reload}
      />
    </>
  );
}

function SettingsForm({
  group,
  initial,
  onSaved,
}: {
  group: SettingsGroupName;
  initial: Values;
  onSaved: () => void;
}) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  useEffect(() => setValues(initial), [initial]);
  const definition = SETTINGS_GROUPS[group];

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});
    try {
      await api.put(`/api/admin/settings/${group}`, values);
      setMessage({ type: "success", text: "Saved. The change is live." });
      onSaved();
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields);
      setMessage({ type: "error", text: (err as Error).message });
    }
  }

  return (
    <form className="editor" onSubmit={save}>
      <p className="muted">{definition.description}</p>
      {message && <Message type={message.type}>{message.text}</Message>}
      <FieldsForm fields={definition.fields} values={values} onChange={setValues} errors={errors} />
      <div className="editor__actions">
        <button className="button button--primary">Save</button>
      </div>
    </form>
  );
}
