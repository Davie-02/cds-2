import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { blankValues } from "../../shared/fields";
import { getResource } from "../../shared/resources";
import { SECTION_TYPES, SECTION_TYPE_OPTIONS, sectionFields } from "../../shared/sections";
import { FieldsForm, type Values } from "../components/FieldInput";
import { ConfirmButton, Empty, Message } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { useLoad } from "../lib/useLoad";
import { ResourceEditor } from "./ResourceScreens";

interface Section {
  id: string | null;
  type: string;
  visible: boolean;
  content: Values;
}

const pagesDef = getResource("pages")!;

export function PageScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === "new";
  const page = useLoad(
    () => (isNew ? Promise.resolve(null) : api.get<Values>(`/api/admin/r/pages/${id}`)),
    [id],
  );

  return (
    <>
      <ResourceEditor
        def={pagesDef}
        id={isNew ? null : id!}
        backTo="/pages"
        onSaved={(row) => {
          if (isNew) navigate(`/pages/${row.id}`, { replace: true });
          else page.reload();
        }}
      />
      {page.data && (
        <>
          <p>
            <a
              className="button button--ghost"
              href={page.data.slug === "home" ? "/" : `/${page.data.slug}`}
              target="_blank"
              rel="noreferrer"
            >
              View page
            </a>
          </p>
          <SectionsEditor pageId={id!} />
        </>
      )}
    </>
  );
}

function SectionsEditor({ pageId }: { pageId: string }) {
  const sections = useLoad(
    () =>
      api
        .get<{ items: Section[] }>(`/api/admin/r/sections?filter.page_id=${pageId}&limit=500`)
        .then((r) => r.items),
    [pageId],
  );
  const [draft, setDraft] = useState<Section | null>(null);
  const [newType, setNewType] = useState("");
  const items = sections.data ?? [];

  async function move(index: number, delta: number) {
    const ids = items.map((section) => section.id!);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + delta, 0, moved!);
    await api.post("/api/admin/r/sections/reorder", { ids });
    sections.reload();
  }

  function startDraft() {
    if (!newType) return;
    setDraft({
      id: null,
      type: newType,
      visible: true,
      content: blankValues(sectionFields(newType) ?? []),
    });
    setNewType("");
  }

  return (
    <section className="panel">
      <h2>Page sections</h2>
      <p className="muted">
        Sections appear on the page in this order. Hidden sections stay saved but are not shown.
      </p>
      {sections.error && <Message type="error">{sections.error}</Message>}
      {!items.length && !draft && <Empty>This page has no sections yet.</Empty>}
      {items.map((section, index) => (
        <SectionCard
          key={section.id}
          pageId={pageId}
          section={section}
          onChanged={sections.reload}
          onMoveUp={index > 0 ? () => move(index, -1) : undefined}
          onMoveDown={index < items.length - 1 ? () => move(index, 1) : undefined}
        />
      ))}
      {draft && (
        <SectionCard
          pageId={pageId}
          section={draft}
          startOpen
          onChanged={() => {
            setDraft(null);
            sections.reload();
          }}
          onCancel={() => setDraft(null)}
        />
      )}
      <div className="toolbar">
        <select
          value={newType}
          onChange={(e) => setNewType(e.target.value)}
          aria-label="Section type"
        >
          <option value="">Add a section…</option>
          {SECTION_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          className="button button--primary"
          disabled={!newType || Boolean(draft)}
          onClick={startDraft}
        >
          Add
        </button>
      </div>
    </section>
  );
}

function SectionCard(props: {
  pageId: string;
  section: Section;
  startOpen?: boolean;
  onChanged: () => void;
  onCancel?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const { pageId, section, onChanged } = props;
  const [open, setOpen] = useState(Boolean(props.startOpen));
  const [content, setContent] = useState<Values>(section.content);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const type = SECTION_TYPES[section.type as keyof typeof SECTION_TYPES];
  const preview = String(section.content.heading ?? section.content.form_heading ?? "");

  async function save(patch: Partial<Section>) {
    setBusy(true);
    setErrors({});
    setError(null);
    try {
      if (section.id) await api.patch(`/api/admin/r/sections/${section.id}`, patch);
      else
        await api.post("/api/admin/r/sections", {
          page_id: pageId,
          type: section.type,
          visible: true,
          ...patch,
        });
      onChanged();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(
          Object.fromEntries(
            Object.entries(err.fields).map(([key, message]) => [
              key.replace(/^content\./, ""),
              message,
            ]),
          ),
        );
      }
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={`section-card${section.visible ? "" : " section-card--hidden"}`}>
      <header className="section-card__head">
        <button
          type="button"
          className="section-card__title"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
        >
          <strong>{type?.label ?? section.type}</strong>
          {preview && <span className="muted"> {preview}</span>}
          {!section.visible && <span className="status status--muted">Hidden</span>}
        </button>
        {section.id && (
          <span className="section-card__tools">
            <button
              type="button"
              aria-label="Move up"
              disabled={!props.onMoveUp}
              onClick={props.onMoveUp}
            >
              ↑
            </button>
            <button
              type="button"
              aria-label="Move down"
              disabled={!props.onMoveDown}
              onClick={props.onMoveDown}
            >
              ↓
            </button>
          </span>
        )}
      </header>
      {open && (
        <form
          className="section-card__body"
          onSubmit={(e) => {
            e.preventDefault();
            save({ content });
          }}
        >
          {type && <p className="muted">{type.description}</p>}
          {error && <Message type="error">{error}</Message>}
          <FieldsForm
            fields={sectionFields(section.type) ?? []}
            values={content}
            onChange={setContent}
            errors={errors}
          />
          <div className="editor__actions">
            <button className="button button--primary" disabled={busy}>
              {section.id ? "Save section" : "Add section"}
            </button>
            {section.id && (
              <button
                type="button"
                className="button button--ghost"
                onClick={() => save({ visible: !section.visible })}
              >
                {section.visible ? "Hide" : "Show"}
              </button>
            )}
            {section.id ? (
              <ConfirmButton
                label="Delete"
                onConfirm={async () => {
                  await api.delete(`/api/admin/r/sections/${section.id}`);
                  onChanged();
                }}
              />
            ) : (
              <button type="button" className="button button--ghost" onClick={props.onCancel}>
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
    </article>
  );
}
