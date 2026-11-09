"""Safe formula DSL: a JSON expression tree with a fixed whitelist of operations.
Nothing here is ever passed to eval/exec; unknown nodes are rejected."""
from decimal import ROUND_CEILING, ROUND_FLOOR, ROUND_HALF_UP, Decimal

from app.core.money import D

N_ARY = {"add": "+", "sub": "−", "mul": "×", "div": "÷"}
FUNCS = {"min", "max"}
ROUNDS = {"round", "ceil", "floor"}
CMP = {"gt": ">", "gte": "≥", "lt": "<", "lte": "≤", "eq": "=", "neq": "≠"}
MAX_NODES, MAX_DEPTH = 200, 20


class DSLError(Exception):
    pass


def _walk(node, depth=0, counter=None):
    counter = counter if counter is not None else [0]
    counter[0] += 1
    if counter[0] > MAX_NODES or depth > MAX_DEPTH:
        raise DSLError("Formula is too large or too deeply nested")
    if not isinstance(node, dict):
        raise DSLError("Each formula part must be an object")
    yield node
    for child in _children(node):
        yield from _walk(child, depth + 1, counter)


def _children(node):
    if "op" in node:
        op = node["op"]
        if op == "if":
            return [node.get("cond"), node.get("then"), node.get("else")]
        if op == "lookup":
            return [node.get("input")]
        return list(node.get("args") or [])
    return []


def refs(node) -> set:
    return {n["ref"] for n in _walk(node) if "ref" in n}


def validate(node, input_keys: set, item_codes: set) -> list[str]:
    errors = []
    try:
        for n in _walk(node):
            if "const" in n:
                try:
                    D(n["const"])
                except ValueError as e:
                    errors.append(str(e))
            elif "ref" in n:
                r = str(n["ref"])
                kind, _, key = r.partition(".")
                if kind == "input" and key not in input_keys:
                    errors.append(f"Unknown building input '{key}'")
                elif kind == "item" and key not in item_codes:
                    errors.append(f"Unknown line item code '{key}'")
                elif kind not in ("input", "item"):
                    errors.append(f"Reference '{r}' must start with input. or item.")
            elif "op" in n:
                op = n["op"]
                if op in N_ARY or op in FUNCS:
                    if len(n.get("args") or []) < 2:
                        errors.append(f"'{op}' needs at least two values")
                elif op in ROUNDS or op in CMP:
                    if len(n.get("args") or []) not in ((1, 2) if op in ROUNDS else (2,)):
                        errors.append(f"'{op}' has the wrong number of values")
                elif op == "if":
                    if not all(n.get(k) for k in ("cond", "then", "else")):
                        errors.append("'if' needs a condition, a then value and an else value")
                elif op == "lookup":
                    bands = n.get("bands") or []
                    if not n.get("input") or not bands:
                        errors.append("'lookup' needs an input and at least one band")
                    for b in bands:
                        try:
                            D(b.get("min")); D(b.get("max")); D(b["value"])
                        except (ValueError, KeyError):
                            errors.append("Each lookup band needs numeric min/max/value")
                else:
                    errors.append(f"Operation '{op}' is not allowed")
            else:
                errors.append("Unrecognised formula part")
    except DSLError as e:
        errors.append(str(e))
    return errors


def evaluate(node, env: dict) -> Decimal:
    if "const" in node:
        return D(node["const"])
    if "ref" in node:
        if node["ref"] not in env or env[node["ref"]] is None:
            raise DSLError(f"Value for '{node['ref']}' is not available")
        return D(env[node["ref"]])
    op = node["op"]
    if op == "if":
        return evaluate(node["then"] if evaluate(node["cond"], env) != 0 else node["else"], env)
    if op == "lookup":
        x = evaluate(node["input"], env)
        for b in node["bands"]:
            lo, hi = D(b.get("min")), D(b.get("max"))
            if (lo is None or x >= lo) and (hi is None or x <= hi):
                return D(b["value"])
        raise DSLError(f"No lookup band matches value {x}")
    vals = [evaluate(a, env) for a in node["args"]]
    if op == "add":
        return sum(vals, Decimal(0))
    if op == "sub":
        out = vals[0]
        for v in vals[1:]:
            out -= v
        return out
    if op == "mul":
        out = Decimal(1)
        for v in vals:
            out *= v
        return out
    if op == "div":
        out = vals[0]
        for v in vals[1:]:
            if v == 0:
                raise DSLError("Division by zero")
            out /= v
        return out
    if op == "min":
        return min(vals)
    if op == "max":
        return max(vals)
    if op in ROUNDS:
        dp = int(vals[1]) if len(vals) > 1 else 0
        mode = {"round": ROUND_HALF_UP, "ceil": ROUND_CEILING, "floor": ROUND_FLOOR}[op]
        return vals[0].quantize(Decimal(1).scaleb(-dp), rounding=mode)
    if op in CMP:
        a, b = vals
        res = {"gt": a > b, "gte": a >= b, "lt": a < b, "lte": a <= b, "eq": a == b, "neq": a != b}[op]
        return Decimal(1 if res else 0)
    raise DSLError(f"Operation '{op}' is not allowed")


def explain(node, labels: dict | None = None) -> str:
    labels = labels or {}
    if "const" in node:
        return str(node["const"])
    if "ref" in node:
        return labels.get(node["ref"], node["ref"].split(".", 1)[-1].replace("_", " "))
    op = node.get("op")
    args = [explain(a, labels) for a in node.get("args") or []]
    if op in N_ARY:
        return "(" + f" {N_ARY[op]} ".join(args) + ")"
    if op in FUNCS or op in ROUNDS:
        return f"{op}({', '.join(args)})"
    if op in CMP:
        return f"{args[0]} {CMP[op]} {args[1]}"
    if op == "if":
        return f"if {explain(node['cond'], labels)} then {explain(node['then'], labels)} else {explain(node['else'], labels)}"
    if op == "lookup":
        bands = "; ".join(f"{b.get('min') or '−∞'}–{b.get('max') or '∞'} → {b['value']}" for b in node.get("bands", []))
        return f"lookup {explain(node['input'], labels)} in [{bands}]"
    return "?"
