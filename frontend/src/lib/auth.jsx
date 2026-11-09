import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!localStorage.getItem("ae_token")) { setMe(null); setLoading(false); return; }
    try {
      const { data } = await api.get("/auth/me");
      setMe(data);
      if (data.organisation_id) localStorage.setItem("ae_org_ctx", data.organisation_id);
    } catch { setMe(null); }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("ae_token", data.token);
    await refresh();
  };
  const logout = () => { localStorage.removeItem("ae_token"); localStorage.removeItem("ae_org"); setMe(null); location.href = "/login"; };
  const can = (cap) => !!me?.capabilities?.includes(cap);

  return <AuthCtx.Provider value={{ me, loading, login, logout, can, refresh }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
