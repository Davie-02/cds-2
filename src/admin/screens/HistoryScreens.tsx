import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Empty, Loading, Message, PageHeader } from "../components/ui";
import { api, queryString } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatDateTime } from "../lib/format";
import { useLoad } from "../lib/useLoad";

interface Activity {
  id: number;
  created_at: string;
  user_name: string | null;
  action: string;
  summary: string;
  undone_at: string | null;
  undoable: boolean;
}

export function ActivityScreen() {
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const page = Number(params.get("page") ?? 1);
  const resource = params.get("resource") ?? "";
  const record = params.get("record") ?? "";
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const activity = useLoad(
    () => api.get<Activity[]>(`/api/admin/activity${queryString({ page, resource, record })}`),
    [page, resource, record],
  );

  async function undo(entry: Activity) {
    setMessage(null);
    try {
      await api.post(`/api/admin/activity/${entry.id}/undo`);
      setMessage({ type: "success", text: `Undone: ${entry.summary}` });
      activity.reload();
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message });
    }
  }

  const goTo = (next: number) => {
    const search = new URLSearchParams(params);
    search.set("page", String(next));
    setParams(search);
  };

  return (
    <>
      <PageHeader title="Activity log" />
      {(resource || record) && (
        <button className="button button--ghost" onClick={() => setParams({})}>
          Show all activity
        </button>
      )}
      {message && <Message type={message.type}>{message.text}</Message>}
      {activity.loading && !activity.data ? (
        <Loading />
      ) : activity.data?.length ? (
        <ul className="agenda">
          {activity.data.map((entry) => (
            <li key={entry.id} className={entry.undone_at ? "is-undone" : ""}>
              <span>
                <strong>{entry.summary}</strong>
                <span className="muted">
                  {" "}
                  {entry.user_name ?? "System"} · {formatDateTime(entry.created_at)}
                  {entry.undone_at && " · undone"}
                </span>
              </span>
              {entry.undoable && can("activity.undo") && (
                <button className="button button--ghost" onClick={() => undo(entry)}>
                  Undo
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No activity yet.</Empty>
      )}
      <div className="pager">
        <button
          className="button button--ghost"
          disabled={page <= 1}
          onClick={() => goTo(page - 1)}
        >
          Newer
        </button>
        <button
          className="button button--ghost"
          disabled={(activity.data?.length ?? 0) < 50}
          onClick={() => goTo(page + 1)}
        >
          Older
        </button>
      </div>
    </>
  );
}

interface Deleted {
  resource: string;
  resource_label: string;
  id: string;
  title: string;
  deleted_at: string;
}

export function RecycleBinScreen() {
  const { me } = useAuth();
  const bin = useLoad(() => api.get<Deleted[]>("/api/admin/recycle-bin"), []);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  async function act(item: Deleted, action: "restore" | "purge") {
    setMessage(null);
    try {
      if (action === "restore")
        await api.post(`/api/admin/recycle-bin/${item.resource}/${item.id}/restore`);
      else await api.delete(`/api/admin/recycle-bin/${item.resource}/${item.id}`);
      setMessage({
        type: "success",
        text: `${action === "restore" ? "Restored" : "Permanently deleted"} ${item.resource_label.toLowerCase()} ${item.title}`,
      });
      bin.reload();
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message });
    }
  }

  return (
    <>
      <PageHeader title="Recycle bin" />
      <p className="muted">
        Deleted items stay here until they are restored
        {me.role === "owner" ? " or permanently deleted" : ""}.
      </p>
      {message && <Message type={message.type}>{message.text}</Message>}
      {bin.loading && !bin.data ? (
        <Loading />
      ) : bin.data?.length ? (
        <ul className="agenda">
          {bin.data.map((item) => (
            <li key={`${item.resource}:${item.id}`}>
              <span>
                <strong>{item.resource_label}</strong> {item.title}
                <span className="muted"> · deleted {formatDateTime(item.deleted_at)}</span>
              </span>
              <span className="agenda__actions">
                <button className="button button--primary" onClick={() => act(item, "restore")}>
                  Restore
                </button>
                {me.role === "owner" && (
                  <button className="button button--ghost" onClick={() => act(item, "purge")}>
                    Delete forever
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>The recycle bin is empty.</Empty>
      )}
    </>
  );
}
