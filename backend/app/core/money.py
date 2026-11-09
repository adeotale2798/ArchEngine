from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

ZERO = Decimal("0")


def D(v):
    """Parse to Decimal; None/'' -> None. Never goes through float."""
    if v is None or v == "":
        return None
    if isinstance(v, Decimal):
        return v
    if isinstance(v, float):
        v = repr(v)
    try:
        return Decimal(str(v).strip())
    except InvalidOperation:
        raise ValueError(f"Not a valid number: {v!r}")


def q(v: Decimal, dp: int = 2) -> Decimal:
    return v.quantize(Decimal(1).scaleb(-dp), rounding=ROUND_HALF_UP)


def s(v, dp=None):
    if v is None:
        return None
    if dp is not None:
        v = q(v, dp)
    out = format(v.normalize(), "f") if dp is None else format(v, "f")
    return out
