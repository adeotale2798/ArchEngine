import axios from "axios";
import { toast } from "sonner";

const backendUrl = (import.meta.env.VITE_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:8001").replace(/\/$/, "");

export const BASE = backendUrl;
export const api = axios.create({ baseURL: `${BASE}/api` });

api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem("ae_token");
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  const org = localStorage.getItem("ae_org");
  if (org) cfg.headers["X-Org-Id"] = org;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && !err.config.url.includes("/auth/login") && !err.config.url.startsWith("/portal/s")) {
      localStorage.removeItem("ae_token");
      if (!location.pathname.startsWith("/login") && !location.pathname.startsWith("/share")) location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export function errMsg(e) {
  const d = e?.response?.data?.detail;
  if (!d) return e?.message || "Something went wrong";
  if (typeof d === "string") return d;
  return d.message || JSON.stringify(d);
}

const shouldSilenceError = (e, message) => {
  const status = e?.response?.status;
  if (status !== 403) return false;
  return /(permission for this action|not enabled|not allowed|access denied|disabled)/i.test(message);
};

export const notifyError = (e) => {
  const message = errMsg(e);
  if (shouldSilenceError(e, message)) return;
  toast.error(message);
};

export async function download(path, filename) {
  try {
    const r = await api.get(path, { responseType: "blob" });
    const cd = r.headers["content-disposition"] || "";
    const name = (cd.match(/filename="(.+)"/) || [])[1] || filename;
    const url = URL.createObjectURL(r.data);
    const a = Object.assign(document.createElement("a"), { href: url, download: name });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${name}`);
  } catch (e) {
    notifyError(e);
  }
}

export function reportClientError(message, stack) {
  fetch(`${BASE}/api/error-logs/client`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, stack, url: location.href, org_id: localStorage.getItem("ae_org_ctx") }),
  }).catch(() => {});
}
