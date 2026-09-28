import type { FieldErrors } from "../../shared/validation";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly fields: FieldErrors = {},
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const isForm = body instanceof FormData;
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: {
      "X-Requested-With": "fetch",
      ...(body !== undefined && !isForm ? { "Content-Type": "application/json" } : {}),
    },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(response.status, data.error ?? "Something went wrong", data.fields ?? {});
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {}),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  delete: (path: string) => request<void>("DELETE", path),
};

export function queryString(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

export interface Upload {
  id: string;
  url: string;
  filename: string;
  mime_type: string;
}

export function uploadFile(file: File, isPrivate = false): Promise<Upload> {
  const form = new FormData();
  form.append("file", file);
  return api.post<Upload>(`/api/admin/uploads${isPrivate ? "?private=1" : ""}`, form);
}
