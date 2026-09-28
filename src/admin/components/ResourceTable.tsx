import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Field, Option } from "../../shared/fields";
import type { ResourceDef } from "../../shared/resources";
import { formatDate, formatDateTime, formatMoney, humanize } from "../lib/format";
import { loadOptions, type Values } from "./FieldInput";
import { Status } from "./ui";

const STATUS_FIELDS = new Set(["status", "result"]);

function useReferenceLabels(fields: Field[]): Record<string, Map<string, string>> {
  const [labels, setLabels] = useState<Record<string, Map<string, string>>>({});
  const resources = fields
    .filter((f) => f.type === "reference" && f.resource)
    .map((f) => f.resource!);
  const key = resources.join(",");
  useEffect(() => {
    Promise.all(
      resources.map((resource) =>
        loadOptions(resource).then((options: Option[]) => [resource, options] as const),
      ),
    ).then((entries) =>
      setLabels(
        Object.fromEntries(
          entries.map(([resource, options]) => [
            resource,
            new Map(options.map((o) => [o.value, o.label])),
          ]),
        ),
      ),
    );
    // Only refetch when the set of referenced resources changes.
  }, [key]);
  return labels;
}

export function CellValue({
  field,
  value,
  labels,
}: {
  field: Field;
  value: unknown;
  labels?: Map<string, string>;
}) {
  if (value === null || value === undefined || value === "")
    return <span className="muted">—</span>;
  switch (field.type) {
    case "boolean":
      return (
        <span className={`status status--${value ? "good" : "muted"}`}>{value ? "Yes" : "No"}</span>
      );
    case "select":
      if (STATUS_FIELDS.has(field.name)) return <Status value={value} />;
      return <>{field.options?.find((o) => o.value === value)?.label ?? humanize(value)}</>;
    case "reference":
      return <>{labels?.get(String(value)) ?? "…"}</>;
    case "date":
      return <>{formatDate(value)}</>;
    case "datetime":
      return <>{formatDateTime(value)}</>;
    case "money":
      return <>{formatMoney(value)}</>;
    case "image":
      return <img className="thumb" src={String(value)} alt="" loading="lazy" />;
    case "multiselect":
    case "tags":
      return <>{(value as string[]).join(", ")}</>;
    default: {
      const text = String(value);
      return <>{text.length > 80 ? `${text.slice(0, 77)}…` : text}</>;
    }
  }
}

interface TableProps {
  def: ResourceDef;
  rows: Values[];
  linkTo: (row: Values) => string;
  canReorder?: boolean;
  onMove?: (index: number, delta: number) => void;
}

/** Cards on phones, a table on wider screens, both driven by the fields marked `inList`. */
export function ResourceTable({ def, rows, linkTo, canReorder, onMove }: TableProps) {
  const columns = def.fields.filter((field) => field.inList);
  const labels = useReferenceLabels(columns);
  const [first, ...rest] = columns;

  return (
    <div className="records">
      {rows.map((row, index) => (
        <div className="record" key={String(row.id)}>
          <Link className="record__main" to={linkTo(row)}>
            {first && (
              <span className="record__title">
                <CellValue
                  field={first}
                  value={row[first.name]}
                  labels={labels[first.resource ?? ""]}
                />
              </span>
            )}
            <span className="record__meta">
              {rest.map((field) => (
                <span key={field.name} className="record__cell" data-label={field.label}>
                  <CellValue
                    field={field}
                    value={row[field.name]}
                    labels={labels[field.resource ?? ""]}
                  />
                </span>
              ))}
            </span>
          </Link>
          {canReorder && onMove && (
            <span className="record__order">
              <button
                type="button"
                aria-label="Move up"
                disabled={index === 0}
                onClick={() => onMove(index, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                aria-label="Move down"
                disabled={index === rows.length - 1}
                onClick={() => onMove(index, 1)}
              >
                ↓
              </button>
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
