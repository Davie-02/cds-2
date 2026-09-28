import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { blankValues } from "../../shared/fields";
import { getResource, type ResourceDef } from "../../shared/resources";
import { FieldsForm, forgetOptions, type Values } from "../components/FieldInput";
import { ResourceTable } from "../components/ResourceTable";
import { ConfirmButton, Empty, Loading, Message, PageHeader } from "../components/ui";
import { api, ApiError, queryString } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useLoad } from "../lib/useLoad";

const PRIVATE_UPLOADS = new Set(["student_documents", "payments"]);
const PAGE_SIZE = 50;

/** Where an item opens: resources with their own screen link there instead of the generic form. */
export function recordPath(def: ResourceDef, id: string): string {
  if (def.name === "students") return `/students/${id}`;
  if (def.name === "pages") return `/pages/${id}`;
  return `/r/${def.name}/${id}`;
}

function useResourceParam(): ResourceDef | undefined {
  const { resource } = useParams();
  return getResource(resource ?? "");
}

export function ResourceListScreen({ name }: { name?: string }) {
  const fromUrl = useResourceParam();
  const def = name ? getResource(name) : fromUrl;
  if (!def) return <Message type="error">Unknown section.</Message>;
  return <ResourceList key={def.name} def={def} />;
}

function ResourceList({ def }: { def: ResourceDef }) {
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const search = params.get("q") ?? "";
  const page = Number(params.get("page") ?? 1);
  const filterField = def.fields.find((f) => f.inList && f.type === "select");
  const filter = filterField ? (params.get(`filter.${filterField.name}`) ?? "") : "";
  const [draft, setDraft] = useState(search);

  const list = useLoad(
    () =>
      api.get<{ items: Values[]; total: number }>(
        `/api/admin/r/${def.name}${queryString({
          q: search,
          page,
          limit: def.sortable ? 500 : PAGE_SIZE,
          ...(filterField ? { [`filter.${filterField.name}`]: filter } : {}),
        })}`,
      ),
    [def.name, search, page, filter],
  );

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    setParams(next);
  };

  async function move(index: number, delta: number) {
    const ids = (list.data?.items ?? []).map((row) => String(row.id));
    const [id] = ids.splice(index, 1);
    ids.splice(index + delta, 0, id!);
    await api.post(`/api/admin/r/${def.name}/reorder`, { ids });
    list.reload();
  }

  const pages = Math.ceil((list.data?.total ?? 0) / PAGE_SIZE);

  return (
    <>
      <PageHeader
        title={def.label}
        actions={
          can(def.edit) && (
            <Link className="button button--primary" to={recordPath(def, "new")}>
              Add {def.singular.toLowerCase()}
            </Link>
          )
        }
      />
      <div className="toolbar">
        {def.search?.length ? (
          <form
            className="toolbar__search"
            onSubmit={(e) => {
              e.preventDefault();
              setParam("q", draft);
            }}
          >
            <input
              type="search"
              placeholder="Search…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          </form>
        ) : null}
        {filterField && (
          <select
            value={filter}
            onChange={(e) => setParam(`filter.${filterField.name}`, e.target.value)}
            aria-label={`Filter by ${filterField.label}`}
          >
            <option value="">All</option>
            {filterField.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}
      </div>
      {list.error && <Message type="error">{list.error}</Message>}
      {list.loading && !list.data ? (
        <Loading />
      ) : list.data?.items.length ? (
        <ResourceTable
          def={def}
          rows={list.data.items}
          linkTo={(row) => recordPath(def, String(row.id))}
          canReorder={def.sortable && can(def.edit) && !search && !filter}
          onMove={move}
        />
      ) : (
        <Empty>Nothing here yet.</Empty>
      )}
      {pages > 1 && !def.sortable && (
        <div className="pager">
          <button
            className="button button--ghost"
            disabled={page <= 1}
            onClick={() => setParam("page", String(page - 1))}
          >
            Previous
          </button>
          <span>
            Page {page} of {pages}
          </span>
          <button
            className="button button--ghost"
            disabled={page >= pages}
            onClick={() => setParam("page", String(page + 1))}
          >
            Next
          </button>
        </div>
      )}
    </>
  );
}

export function ResourceEditScreen() {
  const def = useResourceParam();
  const { id } = useParams();
  if (!def || !id) return <Message type="error">Unknown section.</Message>;
  return <ResourceEditor key={`${def.name}:${id}`} def={def} id={id === "new" ? null : id} />;
}

export function ResourceEditor({
  def,
  id,
  preset = {},
  backTo,
  onSaved,
}: {
  def: ResourceDef;
  id: string | null;
  preset?: Values;
  backTo?: string;
  onSaved?: (row: Values) => void;
}) {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const back = backTo ?? params.get("back") ?? `/r/${def.name}`;
  const initial = useMemo(() => {
    const values = blankValues(def.fields);
    // Opening "Add" from a parent record (e.g. a student's documents) fills in the link to it.
    if (def.parent && params.get(def.parent)) values[def.parent] = params.get(def.parent);
    return { ...values, ...preset };
  }, [def, params, preset]);

  const [values, setValues] = useState<Values>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const record = useLoad(
    () => (id ? api.get<Values>(`/api/admin/r/${def.name}/${id}`) : Promise.resolve(null)),
    [def.name, id],
  );
  useEffect(() => {
    if (record.data) setValues(record.data);
  }, [record.data]);

  const editable = can(def.edit);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    setMessage(null);
    try {
      const saved = id
        ? await api.patch<Values>(`/api/admin/r/${def.name}/${id}`, values)
        : await api.post<Values>(`/api/admin/r/${def.name}`, values);
      forgetOptions(def.name);
      if (onSaved) onSaved(saved);
      else if (!id)
        navigate(`${recordPath(def, String(saved.id))}?back=${encodeURIComponent(back)}`, {
          replace: true,
        });
      setValues(saved);
      setMessage({ type: "success", text: "Saved. The change is live." });
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields);
      setMessage({ type: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    try {
      await api.delete(`/api/admin/r/${def.name}/${id}`);
      forgetOptions(def.name);
      navigate(back);
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message });
    }
  }

  if (record.loading && id) return <Loading />;
  if (record.error) return <Message type="error">{record.error}</Message>;

  return (
    <form className="editor" onSubmit={save}>
      <PageHeader
        title={id ? `Edit ${def.singular.toLowerCase()}` : `New ${def.singular.toLowerCase()}`}
        back={back}
      />
      {message && <Message type={message.type}>{message.text}</Message>}
      <fieldset disabled={!editable} className="editor__fields">
        <FieldsForm
          fields={def.fields}
          values={values}
          onChange={setValues}
          errors={errors}
          privateUploads={PRIVATE_UPLOADS.has(def.name)}
        />
      </fieldset>
      {def.fields
        .filter((field) => field.readOnly && values[field.name] != null)
        .map((field) => (
          <p key={field.name} className="muted">
            {field.label}: {String(values[field.name])}
          </p>
        ))}
      {editable && (
        <div className="editor__actions">
          <button className="button button--primary" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
          {id && (
            <ConfirmButton label="Delete" confirmLabel="Tap again to delete" onConfirm={remove} />
          )}
          {id && (
            <Link
              className="button button--ghost"
              to={`/activity?resource=${def.name}&record=${id}`}
            >
              History
            </Link>
          )}
        </div>
      )}
      {id && def.name === "invoices" && (
        <a
          className="button button--ghost"
          href={`/api/admin/print/invoice/${id}`}
          target="_blank"
          rel="noreferrer"
        >
          Print invoice
        </a>
      )}
      {id && def.name === "payments" && values.status === "confirmed" && (
        <a
          className="button button--ghost"
          href={`/api/admin/print/receipt/${id}`}
          target="_blank"
          rel="noreferrer"
        >
          Print receipt
        </a>
      )}
    </form>
  );
}
