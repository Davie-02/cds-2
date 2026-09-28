import { useEffect, useId, useState } from "react";
import { blankValues, type Field, type Option } from "../../shared/fields";
import { api, uploadFile } from "../lib/api";

export type Values = Record<string, unknown>;

const optionCache = new Map<string, Promise<Option[]>>();

export function loadOptions(resource: string): Promise<Option[]> {
  let pending = optionCache.get(resource);
  if (!pending) {
    pending = api.get<Option[]>(`/api/admin/options/${resource}`).catch(() => []);
    optionCache.set(resource, pending);
  }
  return pending;
}

export function forgetOptions(resource: string) {
  optionCache.delete(resource);
}

function useOptions(field: Field): Option[] {
  const [loaded, setLoaded] = useState<Option[]>([]);
  useEffect(() => {
    if (field.resource) loadOptions(field.resource).then(setLoaded);
  }, [field.resource]);
  return field.options ? [...field.options] : loaded;
}

/** datetime-local inputs work in the browser's local time; the API speaks ISO instants. */
function toLocalInput(value: unknown): string {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

interface InputProps {
  field: Field;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  errors?: Record<string, string>;
  errorPrefix?: string;
  privateUploads?: boolean;
}

export function FieldInput(props: InputProps) {
  const { field, error } = props;
  const id = useId();
  const isToggle = field.type === "boolean";
  return (
    <div className={`field${error ? " field--error" : ""}${isToggle ? " field--toggle" : ""}`}>
      {!isToggle && (
        <label htmlFor={id}>
          {field.label}
          {field.required && <span className="required"> *</span>}
        </label>
      )}
      <Control {...props} id={id} />
      {field.help && <small className="help">{field.help}</small>}
      {field.type === "markdown" && (
        <small className="help">
          Formatting: **bold**, *italic*, ## Heading, - list item, [link text](/page)
        </small>
      )}
      {error && <small className="error">{error}</small>}
    </div>
  );
}

function Control({
  field,
  value,
  onChange,
  id,
  errors,
  errorPrefix,
  privateUploads,
}: InputProps & { id: string }) {
  const options = useOptions(field);
  const text = value == null ? "" : String(value);
  const common = { id, name: field.name };

  switch (field.type) {
    case "textarea":
      return (
        <textarea
          {...common}
          rows={4}
          maxLength={field.max}
          value={text}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "markdown":
      return (
        <textarea
          {...common}
          rows={10}
          className="markdown"
          value={text}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "number":
    case "money":
      return (
        <input
          {...common}
          type="number"
          inputMode="numeric"
          min={field.min}
          max={field.type === "number" ? field.max : undefined}
          value={text}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        />
      );
    case "boolean":
      return (
        <label className="toggle" htmlFor={id}>
          <input
            {...common}
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span>{field.label}</span>
        </label>
      );
    case "date":
      return (
        <input
          {...common}
          type="date"
          value={text.slice(0, 10)}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "datetime":
      return (
        <input
          {...common}
          type="datetime-local"
          value={toLocalInput(value)}
          onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : "")}
        />
      );
    case "time":
      return (
        <input {...common} type="time" value={text} onChange={(e) => onChange(e.target.value)} />
      );
    case "select":
    case "icon":
    case "reference":
      return (
        <select {...common} value={text} onChange={(e) => onChange(e.target.value)}>
          <option value="">{field.required ? "Choose…" : "None"}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    case "multiselect": {
      const selected = new Set((value as string[] | undefined) ?? []);
      return (
        <div className="chips" id={id}>
          {options.map((option) => (
            <label
              key={option.value}
              className={`chip${selected.has(option.value) ? " chip--on" : ""}`}
            >
              <input
                type="checkbox"
                checked={selected.has(option.value)}
                onChange={(e) => {
                  const next = new Set(selected);
                  if (e.target.checked) next.add(option.value);
                  else next.delete(option.value);
                  onChange(options.map((o) => o.value).filter((v) => next.has(v)));
                }}
              />
              {option.label}
            </label>
          ))}
        </div>
      );
    }
    case "tags":
      return (
        <textarea
          {...common}
          rows={Math.max(3, ((value as string[]) ?? []).length + 1)}
          placeholder="One per line"
          value={((value as string[]) ?? []).join("\n")}
          onChange={(e) => onChange(e.target.value.split("\n"))}
          onBlur={(e) =>
            onChange(
              e.target.value
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean),
            )
          }
        />
      );
    case "image":
    case "media":
    case "file":
      return (
        <UploadControl
          id={id}
          field={field}
          value={text}
          onChange={onChange}
          isPrivate={privateUploads}
        />
      );
    case "list":
      return (
        <ListControl
          field={field}
          value={(value as Values[]) ?? []}
          onChange={onChange}
          errors={errors}
          errorPrefix={`${errorPrefix ?? ""}${field.name}`}
        />
      );
    case "color":
      return (
        <div className="color-input">
          <input
            type="color"
            value={text || "#000000"}
            onChange={(e) => onChange(e.target.value)}
            aria-label={field.label}
          />
          <input
            {...common}
            type="text"
            value={text}
            maxLength={7}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
    case "password":
      return (
        <input
          {...common}
          type="password"
          autoComplete="new-password"
          value={text}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    default: {
      const type = field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text";
      return (
        <input
          {...common}
          type={type}
          maxLength={field.max}
          placeholder={field.type === "url" ? "/page or https://…" : undefined}
          value={text}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    }
  }
}

function UploadControl(props: {
  id: string;
  field: Field;
  value: string;
  onChange: (value: unknown) => void;
  isPrivate?: boolean;
}) {
  const { id, field, value, onChange, isPrivate } = props;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accept =
    field.type === "image"
      ? "image/*"
      : field.type === "media"
        ? "video/mp4,video/webm,image/*"
        : "image/*,application/pdf";
  const isVideo = /\.(mp4|webm)$/i.test(value);

  async function choose(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const upload = await uploadFile(file, isPrivate);
      onChange(upload.url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="upload">
      {value && field.type === "image" && <img className="upload__preview" src={value} alt="" />}
      {value && isVideo && <video className="upload__preview" src={value} muted />}
      <div className="upload__row">
        <label className="button button--ghost">
          {busy ? "Uploading…" : value ? "Replace" : "Upload"}
          <input
            type="file"
            accept={accept}
            hidden
            disabled={busy}
            onChange={(e) => choose(e.target.files?.[0])}
          />
        </label>
        {value && (
          <a className="button button--ghost" href={value} target="_blank" rel="noreferrer">
            Open
          </a>
        )}
        {value && (
          <button type="button" className="button button--ghost" onClick={() => onChange("")}>
            Remove
          </button>
        )}
      </div>
      <input
        id={id}
        type="text"
        placeholder="…or paste an https:// link"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && <small className="error">{error}</small>}
    </div>
  );
}

function ListControl(props: {
  field: Field;
  value: Values[];
  onChange: (value: unknown) => void;
  errors?: Record<string, string>;
  errorPrefix: string;
}) {
  const { field, value, onChange, errors, errorPrefix } = props;
  const subFields = field.fields ?? [];
  const update = (index: number, item: Values) =>
    onChange(value.map((v, i) => (i === index ? item : v)));
  const move = (index: number, delta: number) => {
    const next = [...value];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item!);
    onChange(next);
  };

  return (
    <div className="list-field">
      {value.map((item, index) => (
        <fieldset key={index} className="list-field__item">
          <legend>
            {index + 1}
            <span className="list-field__actions">
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === value.length - 1}
                aria-label="Move down"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => onChange(value.filter((_, i) => i !== index))}
                aria-label="Remove"
              >
                ✕
              </button>
            </span>
          </legend>
          <FieldsForm
            fields={subFields}
            values={item}
            onChange={(next) => update(index, next)}
            errors={errors}
            errorPrefix={`${errorPrefix}.${index}.`}
          />
        </fieldset>
      ))}
      {(field.max === undefined || value.length < field.max) && (
        <button
          type="button"
          className="button button--ghost"
          onClick={() => onChange([...value, blankValues(subFields)])}
        >
          Add
        </button>
      )}
    </div>
  );
}

export function FieldsForm(props: {
  fields: readonly Field[];
  values: Values;
  onChange: (values: Values) => void;
  errors?: Record<string, string>;
  errorPrefix?: string;
  privateUploads?: boolean;
}) {
  const { fields, values, onChange, errors = {}, errorPrefix = "", privateUploads } = props;
  return (
    <>
      {fields
        .filter((field) => !field.readOnly)
        .map((field) => (
          <FieldInput
            key={field.name}
            field={field}
            value={values[field.name]}
            onChange={(value) => onChange({ ...values, [field.name]: value })}
            error={errors[`${errorPrefix}${field.name}`]}
            errors={errors}
            errorPrefix={errorPrefix}
            privateUploads={privateUploads}
          />
        ))}
    </>
  );
}
