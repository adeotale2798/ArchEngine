from app.core.db import db, new_id, now


def _diff(before: dict | None, after: dict | None) -> dict:
    before, after = before or {}, after or {}
    keys = set(before) | set(after)
    skip = {"updated_at", "updated_by", "_id"}
    return {k: {"from": before.get(k), "to": after.get(k)} for k in sorted(keys - skip) if before.get(k) != after.get(k)}


async def audit(ctx, action: str, entity_type: str, entity_id: str | None, before=None, after=None, meta=None,
                org_id: str | None = None, actor: dict | None = None):
    """Append-only audit trail. Never updated or deleted by application code."""
    user = actor or (ctx.user if ctx else None) or {}
    await db.audit_events.insert_one({
        "id": new_id(), "organisation_id": org_id or (ctx.org_id if ctx else None),
        "actor_id": user.get("id"), "actor_email": user.get("email", meta.get("actor") if meta else None),
        "action": action, "entity_type": entity_type, "entity_id": entity_id,
        "changes": _diff(before, after) if (before or after) else {}, "meta": meta or {}, "created_at": now(),
    })
