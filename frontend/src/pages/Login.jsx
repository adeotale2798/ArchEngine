import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { errMsg } from "@/lib/api";
import { Button, Field, Input, Notice } from "@/components/ui";

const HERO = "https://images.unsplash.com/photo-1479839672679-a46483c0e7c8?w=1600&q=70";

export default function Login() {
  const { login, me } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  if (me) return <Navigate to="/" replace />;
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try { await login(email, password); nav("/"); } catch (e2) { setErr(errMsg(e2)); }
    setBusy(false);
  };
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden lg:block">
        <img src={HERO} alt="Modern concrete building facade" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-secondary via-secondary/60 to-secondary/10" />
        <div className="absolute bottom-0 p-14 text-white">
          <div className="font-mono text-xs uppercase tracking-[.3em] text-primary">Estimate engine · V4</div>
          <h1 className="mt-3 max-w-lg text-5xl font-extrabold leading-[1.05]">From floors and bathrooms to a costed BOQ.</h1>
          <p className="mt-4 max-w-md text-white/75">Architect-configured packages, rules and rates. Clients answer a short brief — no measurements, no drawings.</p>
        </div>
      </div>
      <div className="flex items-center justify-center p-6 md:p-12">
        <form onSubmit={submit} className="w-full max-w-sm animate-rise space-y-6" data-testid="login-form">
          <div>
            <div className="font-display text-3xl font-extrabold">Arch<span className="text-primary">Engine</span></div>
            <p className="mt-2 text-sm text-muted-foreground">Sign in to your organisation workspace or client estimate.</p>
          </div>
          {err && <Notice tone="danger"><span data-testid="login-error">{err}</span></Notice>}
          <Field label="Email"><Input data-testid="login-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Password"><Input data-testid="login-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          <Button type="submit" size="lg" className="w-full" disabled={busy} data-testid="login-submit">{busy ? "Signing in…" : <>Sign in <ArrowRight size={16} /></>}</Button>
          <p className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck size={14} /> Received a share link? Open it directly — no account needed.</p>
        </form>
      </div>
    </div>
  );
}
