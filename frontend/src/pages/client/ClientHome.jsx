import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowRight, LogOut } from "lucide-react";
import { api, notifyError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { STATUS, date } from "@/lib/format";
import { Badge, Button, Card, Empty } from "@/components/ui";

export default function ClientHome() {
  const { me, loading, logout } = useAuth();
  const [rows, setRows] = useState(null);
  useEffect(() => { if (me) api.get("/client/estimates").then((r) => setRows(r.data)).catch(notifyError); }, [me]);
  if (loading) return null;
  if (!me) return <Navigate to="/login" replace />;
  return (
    <div className="grain min-h-screen">
      <div className="mx-auto max-w-3xl px-6 py-14">
        <div className="flex items-center justify-between"><h1 className="text-4xl font-extrabold">Your estimates</h1>
          <Button variant="ghost" data-testid="client-logout-btn" onClick={logout}><LogOut size={15} /> Sign out</Button></div>
        <p className="mt-2 text-muted-foreground">Signed in as {me.user.email}</p>
        <div className="mt-8 space-y-4">
          {rows?.length === 0 && <Empty title="No estimates shared with you yet">Your architect will share an estimate with this account.</Empty>}
          {rows?.map((e) => (
            <Link key={e.id} to={`/my/${e.id}`} data-testid={`client-estimate-${e.number}`}>
              <Card className="flex items-center gap-4 p-6 transition-transform hover:-translate-y-0.5">
                <div className="flex-1"><div className="num text-xs text-muted-foreground">{e.number}</div><div className="font-display text-xl font-semibold">{e.title}</div>
                  <div className="text-xs text-muted-foreground">{e.project_name} · updated {date(e.updated_at)}</div></div>
                <Badge tone={STATUS[e.status]?.tone}>{STATUS[e.status]?.label}</Badge><ArrowRight size={18} />
              </Card>
            </Link>))}
        </div>
      </div>
    </div>
  );
}
