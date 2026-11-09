import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { date } from "@/lib/format";
import { Empty } from "./ui";

export default function HistoryPanel({ resource, id }) {
  const [rows, setRows] = useState(null);
  useEffect(() => { api.get(`/r/${resource}/${id}/history`).then((r) => setRows(r.data)).catch(() => setRows([])); }, [resource, id]);
  if (!rows) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!rows.length) return <Empty title="No history yet" />;
  return (
    <ol className="space-y-3" data-testid="history-list">
      {rows.map((e) => (
        <li key={e.id} className="border-l-2 border-primary/30 pl-4">
          <div className="text-sm"><span className="font-semibold capitalize">{e.action}</span> by {e.actor_email || "system"} · <span className="text-muted-foreground">{date(e.created_at)}</span></div>
          {Object.entries(e.changes || {}).slice(0, 12).map(([k, v]) => (
            <div key={k} className="num truncate text-xs text-muted-foreground">{k}: {JSON.stringify(v.from)?.slice(0, 60)} → {JSON.stringify(v.to)?.slice(0, 80)}</div>
          ))}
        </li>
      ))}
    </ol>
  );
}
