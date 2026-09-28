import { useState } from "react";
import { blankValues } from "../../shared/fields";
import {
  effectivePermissions,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  type Permission,
  type PermissionOverrides,
  type StaffRole,
} from "../../shared/permissions";
import { FieldsForm, type Values } from "../components/FieldInput";
import { ConfirmButton, Empty, Loading, Message, PageHeader } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatDateTime, humanize } from "../lib/format";
import { useLoad } from "../lib/useLoad";
import { STAFF_FIELDS } from "../../shared/staff";

interface StaffMember {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: StaffRole;
  active: boolean;
  permission_overrides: PermissionOverrides;
  last_login_at: string | null;
}

export function StaffScreen() {
  const { me } = useAuth();
  const staff = useLoad(() => api.get<StaffMember[]>("/api/admin/staff"), []);
  const [editing, setEditing] = useState<StaffMember | "new" | null>(null);

  if (me.role !== "owner")
    return <Message type="error">Only the owner can manage staff and access rights.</Message>;
  if (staff.loading && !staff.data) return <Loading />;

  if (editing) {
    return (
      <StaffEditor
        member={editing === "new" ? null : editing}
        isSelf={editing !== "new" && editing.id === me.id}
        onDone={() => {
          setEditing(null);
          staff.reload();
        }}
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Staff & access"
        actions={
          <button className="button button--primary" onClick={() => setEditing("new")}>
            Add staff member
          </button>
        }
      />
      <p className="muted">
        Each role comes with sensible access. Open a person to switch individual rights on or off
        for them.
      </p>
      {staff.error && <Message type="error">{staff.error}</Message>}
      {staff.data?.length ? (
        <div className="records">
          {staff.data.map((member) => (
            <button
              key={member.id}
              className="record record--button"
              onClick={() => setEditing(member)}
            >
              <span className="record__main">
                <span className="record__title">{member.name}</span>
                <span className="record__meta">
                  <span>{humanize(member.role)}</span>
                  <span>{member.email}</span>
                  <span className="muted">
                    {member.last_login_at
                      ? `Last signed in ${formatDateTime(member.last_login_at)}`
                      : "Never signed in"}
                  </span>
                  {!member.active && <span className="status status--muted">Disabled</span>}
                  {Object.keys(member.permission_overrides).length > 0 && (
                    <span className="status status--info">Custom access</span>
                  )}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <Empty>No staff yet.</Empty>
      )}
    </>
  );
}

function StaffEditor({
  member,
  isSelf,
  onDone,
}: {
  member: StaffMember | null;
  isSelf: boolean;
  onDone: () => void;
}) {
  const [values, setValues] = useState<Values>(
    member ? { ...member, password: "" } : blankValues(STAFF_FIELDS),
  );
  const [overrides, setOverrides] = useState<PermissionOverrides>(
    member?.permission_overrides ?? {},
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const role = (values.role as StaffRole) || "office";
  const defaults = new Set(ROLE_PERMISSIONS[role]);
  const effective = effectivePermissions(role, overrides);

  function toggle(permission: Permission, on: boolean) {
    const next = { ...overrides };
    if (on === defaults.has(permission)) delete next[permission];
    else next[permission] = on;
    setOverrides(next);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});
    const body = {
      ...values,
      password: values.password || undefined,
      permission_overrides: overrides,
    };
    try {
      if (member) await api.patch(`/api/admin/staff/${member.id}`, body);
      else await api.post("/api/admin/staff", body);
      onDone();
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields);
      setError((err as Error).message);
    }
  }

  return (
    <form className="editor" onSubmit={save}>
      <PageHeader title={member ? member.name : "New staff member"} />
      <button type="button" className="button button--ghost" onClick={onDone}>
        ← Back
      </button>
      {error && <Message type="error">{error}</Message>}
      <FieldsForm fields={STAFF_FIELDS} values={values} onChange={setValues} errors={errors} />
      {role === "owner" ? (
        <p className="muted">Owners always have full access.</p>
      ) : (
        <fieldset className="panel">
          <legend>Access</legend>
          <p className="muted">
            Ticked rights come from the {humanize(role)} role unless marked “changed”.
          </p>
          <ul className="permissions">
            {(Object.keys(PERMISSIONS) as Permission[]).map((permission) => (
              <li key={permission}>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={effective.has(permission)}
                    onChange={(e) => toggle(permission, e.target.checked)}
                  />
                  <span>
                    {PERMISSIONS[permission]}
                    {permission in overrides && (
                      <span className="status status--info">changed</span>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {Object.keys(overrides).length > 0 && (
            <button type="button" className="button button--ghost" onClick={() => setOverrides({})}>
              Reset to role defaults
            </button>
          )}
        </fieldset>
      )}
      <div className="editor__actions">
        <button className="button button--primary">Save</button>
        {member && !isSelf && (
          <ConfirmButton
            label="Remove account"
            onConfirm={async () => {
              try {
                await api.delete(`/api/admin/staff/${member.id}`);
                onDone();
              } catch (err) {
                setError((err as Error).message);
              }
            }}
          />
        )}
      </div>
    </form>
  );
}
