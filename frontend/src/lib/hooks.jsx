import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, notifyError } from "./api";

export function useList(resource, params = {}, deps = []) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const key = JSON.stringify(params);
  const reload = useCallback(async () => {
    if (Object.values(params).some((v) => v === null)) { setRows([]); setLoading(false); return; }
    setLoading(true);
    try { setRows((await api.get(`/r/${resource}`, { params })).data); } catch (e) { notifyError(e); }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource, key, ...deps]);
  useEffect(() => { reload(); }, [reload]);
  return { rows, loading, reload, setRows };
}

export async function save(resource, data, id) {
  const r = id ? await api.patch(`/r/${resource}/${id}`, data) : await api.post(`/r/${resource}`, data);
  return r.data;
}

const TplCtx = createContext(null);

export function TemplateProvider({ children }) {
  const { rows: templates, reload } = useList("templates");
  const [templateId, setTemplateId] = useState(localStorage.getItem("ae_tpl"));
  useEffect(() => {
    if (templates.length && !templates.find((t) => t.id === templateId)) setTemplateId(templates[0].id);
  }, [templates, templateId]);
  useEffect(() => { if (templateId) localStorage.setItem("ae_tpl", templateId); }, [templateId]);
  const template = templates.find((t) => t.id === templateId) || null;
  return <TplCtx.Provider value={{ templates, template, templateId: template?.id || null, setTemplateId, reloadTemplates: reload }}>{children}</TplCtx.Provider>;
}

export const useTemplate = () => useContext(TplCtx);
