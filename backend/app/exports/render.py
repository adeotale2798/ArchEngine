"""Client-safe document rendering (PDF / XLSX / CSV) from an immutable revision result.
Input is ALWAYS calculator.client_view(...) output — internal fields never reach this module."""
import csv
import io
from datetime import datetime

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

STATUS_LABEL = {"INCLUDED": "Included", "OPTIONAL": "Optional (not selected)", "EXCLUDED": "Excluded",
                "INCLUDED_IN_RATE": "Included in package rate", "NOT_APPLICABLE": "Not applicable",
                "UNPRICED": "Unpriced", "REQUIRES_REVIEW": "Requires review"}
INJECTION = ("=", "+", "-", "@", "\t", "\r")


def safe_cell(v):
    """Neutralise spreadsheet formula injection."""
    if v is None:
        return ""
    v = str(v)
    return "'" + v if v.startswith(INJECTION) else v


def inr(v, sym="₹"):
    if v in (None, ""):
        return ""
    neg = str(v).startswith("-")
    whole, _, frac = str(v).lstrip("-").partition(".")
    if len(whole) > 3:
        head, tail = whole[:-3], whole[-3:]
        parts = []
        while len(head) > 2:
            parts.insert(0, head[-2:])
            head = head[:-2]
        if head:
            parts.insert(0, head)
        whole = ",".join(parts + [tail])
    return f"{'-' if neg else ''}{sym}{whole}.{(frac or '00')[:2].ljust(2, '0')}"


def rows_for(doc):
    res = doc["result"]
    subs = {s["id"]: s["name"] for sec in res["sections"] for s in sec["subsections"]}
    secs = {s["id"]: s["name"] for s in res["sections"]}
    for l in res["lines"]:
        yield {"section": secs.get(l["section_id"], ""), "subsection": subs.get(l.get("subsection_id"), ""), **l,
               "status_label": STATUS_LABEL.get(l["status"], l["status"])}


def render_csv(doc) -> bytes:
    buf = io.StringIO()
    w = csv.writer(buf)
    show_rate = any(l.get("rate") for l in doc["result"]["lines"])
    head = ["estimate_number", "revision", "section", "subsection", "item_code", "item_name", "specification", "quantity", "unit"]
    head += (["unit_rate"] if show_rate else []) + ["amount", "inclusion_status", "package", "notes"]
    w.writerow(head)
    for r in rows_for(doc):
        row = [doc["number"], doc["revision_number"], r["section"], r["subsection"], r["code"], r["name"], r["specification"],
               r["quantity"], r["unit"]] + ([r.get("rate")] if show_rate else []) + [r.get("amount"), r["status_label"],
                                                                                         doc["result"]["package"]["name"], r.get("client_notes")]
        w.writerow([safe_cell(c) for c in row])
    return ("\ufeff" + buf.getvalue()).encode("utf-8")


def render_xlsx(doc) -> bytes:
    res, wb = doc["result"], Workbook()
    bold, head_fill = Font(bold=True), PatternFill("solid", fgColor="2F3B4D")
    hfont = Font(bold=True, color="FFFFFF")

    def header(ws, cols):
        ws.append(cols)
        for c in ws[ws.max_row]:
            c.font, c.fill = hfont, head_fill

    ws = wb.active
    ws.title = "Summary"
    for k, v in [("Organisation", doc["org"]["name"]), ("Estimate", doc["number"]), ("Revision", doc["revision_number"]),
                 ("Status", doc["status"]), ("Date", doc["date"]), ("Valid until", doc.get("valid_until") or "—"),
                 ("Package", res["package"]["name"]), ("Snapshot note", "Server-calculated snapshot. Values are authoritative as issued.")]:
        ws.append([k, safe_cell(v)])
    ws.append([])
    header(ws, ["Building brief", "Value"])
    for i in res["inputs"]:
        ws.append([safe_cell(i["label"]), safe_cell(f"{i['value']} {i.get('unit') or ''}".strip())])
    ws.append([])
    header(ws, ["Section", "Subtotal (INR)"])
    for s in res["sections"]:
        ws.append([safe_cell(s["name"]), float(s["subtotal"])])
    t = res["totals"]
    ws.append(["Subtotal", float(t["subtotal"])])
    if t["contingency_enabled"]:
        ws.append([f"Contingency ({t['contingency_rate']}%)", float(t["contingency"])])
    if t["tax_enabled"]:
        ws.append([f"{t['tax_label']} ({t['tax_rate']}%)", float(t["tax"])])
    ws.append(["Grand total (indicative)", float(t["grand_total"])])
    ws.cell(ws.max_row, 1).font = bold
    ws.column_dimensions["A"].width, ws.column_dimensions["B"].width = 34, 60

    ws2 = wb.create_sheet("Detailed BOQ")
    header(ws2, ["Section", "Subsection", "Code", "Item", "Specification", "Quantity", "Unit", "Rate", "Amount", "Status"])
    for r in rows_for(doc):
        ws2.append([safe_cell(x) for x in [r["section"], r["subsection"], r["code"], r["name"], r["specification"]]] +
                   [float(r["quantity"]) if r.get("quantity") else None, safe_cell(r["unit"]),
                    float(r["rate"]) if r.get("rate") else None, float(r["amount"]) if r.get("amount") else None, r["status_label"]])
    for col, w in zip("ABCDEFGHIJ", [24, 18, 12, 30, 44, 12, 8, 12, 14, 22]):
        ws2.column_dimensions[col].width = w

    ws3 = wb.create_sheet("Specifications")
    header(ws3, ["Section", "Item", "Specification", "Details", "Notes"])
    for r in rows_for(doc):
        ws3.append([safe_cell(x) for x in [r["section"], r["name"], r["specification"], r.get("specification_details"), r.get("client_notes")]])
        ws3.cell(ws3.max_row, 4).alignment = Alignment(wrap_text=True)

    ws4 = wb.create_sheet("Assumptions & Exclusions")
    header(ws4, ["Type", "Text"])
    for a in res["assumptions"]:
        ws4.append(["Assumption", safe_cell(a)])
    for e in res["exclusions"]:
        ws4.append(["Exclusion", safe_cell(e)])
    for r in rows_for(doc):
        if r.get("is_assumption"):
            ws4.append(["Indicative quantity", safe_cell(f"{r['name']}: {r.get('client_trace')}")])
    ws4.append(["Disclaimer", safe_cell(res.get("disclaimer"))])
    ws4.column_dimensions["A"].width, ws4.column_dimensions["B"].width = 20, 110
    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()


def render_pdf(doc) -> bytes:
    res, org = doc["result"], doc["org"]
    brand = colors.HexColor((org.get("branding") or {}).get("primary_color") or "#C2562B")
    navy = colors.HexColor("#2F3B4D")
    ss = getSampleStyleSheet()
    P = lambda t, st="BodyText": Paragraph(str(t or "").replace("&", "&amp;").replace("<", "&lt;").replace("\n", "<br/>"), ss[st])
    small = ParagraphStyle("small", parent=ss["BodyText"], fontSize=7.5, leading=9.5)
    Ps = lambda t: Paragraph(str(t or "").replace("&", "&amp;").replace("<", "&lt;").replace("\n", "<br/>"), small)
    ss["Title"].textColor = navy
    buf = io.BytesIO()
    b = org.get("branding") or {}

    def on_page(canvas, d):
        canvas.saveState()
        canvas.setFillColor(brand)
        canvas.rect(0, A4[1] - 8 * mm, A4[0], 8 * mm, stroke=0, fill=1)
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(colors.grey)
        canvas.drawString(15 * mm, 10 * mm, f"{org['name']} · {doc['number']} rev {doc['revision_number']} · {doc['status']}")
        canvas.drawRightString(A4[0] - 15 * mm, 10 * mm, f"Page {d.page}")
        if doc["status"] != "ISSUED":
            canvas.setFont("Helvetica-Bold", 60)
            canvas.setFillColor(colors.Color(0.8, 0.8, 0.8, alpha=0.25))
            canvas.translate(A4[0] / 2, A4[1] / 2)
            canvas.rotate(40)
            canvas.drawCentredString(0, 0, "DRAFT ESTIMATE")
        canvas.restoreState()

    pdf = SimpleDocTemplate(buf, pagesize=A4, leftMargin=15 * mm, rightMargin=15 * mm, topMargin=16 * mm, bottomMargin=18 * mm,
                            title=f"Estimate {doc['number']}", invariant=1)
    st = [P(org["name"], "Title"), Ps(" · ".join(x for x in [b.get("tagline"), b.get("address"), b.get("phone"), b.get("email")] if x)),
          Spacer(1, 6 * mm), P(doc["title"], "Heading2")]
    meta = [["Estimate no.", doc["number"], "Revision", str(doc["revision_number"])], ["Date", doc["date"], "Valid until", doc.get("valid_until") or "—"],
            ["Client", doc.get("client_name") or "—", "Project", doc.get("project_name") or "—"], ["Package", res["package"]["name"], "Status", doc["status"]]]
    t = Table(meta, colWidths=[28 * mm, 62 * mm, 26 * mm, 64 * mm])
    t.setStyle(TableStyle([("FONT", (0, 0), (-1, -1), "Helvetica", 8.5), ("TEXTCOLOR", (0, 0), (0, -1), colors.grey),
                           ("TEXTCOLOR", (2, 0), (2, -1), colors.grey), ("LINEBELOW", (0, 0), (-1, -1), 0.25, colors.lightgrey)]))
    st += [t, Spacer(1, 4 * mm), P("Building brief", "Heading3")]
    st.append(Table([[i["label"], f"{i['value']} {i.get('unit') or ''}"] for i in res["inputs"]] or [["—", ""]], colWidths=[90 * mm, 90 * mm],
                    style=[("FONT", (0, 0), (-1, -1), "Helvetica", 8.5), ("LINEBELOW", (0, 0), (-1, -1), 0.25, colors.lightgrey)]))
    if res["package"].get("description"):
        st += [Spacer(1, 2 * mm), Ps(f"Package: {res['package']['name']} — {res['package']['description']}")]
    sym = "Rs."
    st += [Spacer(1, 4 * mm), P("Executive cost summary", "Heading3")]
    tt = res["totals"]
    summ = [[s["name"], inr(s["subtotal"], sym)] for s in res["sections"]] + [["Subtotal", inr(tt["subtotal"], sym)]]
    if tt["contingency_enabled"]:
        summ.append([f"Contingency ({tt['contingency_rate']}%)", inr(tt["contingency"], sym)])
    if tt["tax_enabled"]:
        summ.append([f"{tt['tax_label']} ({tt['tax_rate']}%)", inr(tt["tax"], sym)])
    summ.append(["Grand total — indicative budget", inr(tt["grand_total"], sym)])
    ts = Table(summ, colWidths=[130 * mm, 50 * mm])
    ts.setStyle(TableStyle([("FONT", (0, 0), (-1, -1), "Helvetica", 9), ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                            ("LINEBELOW", (0, 0), (-1, -1), 0.25, colors.lightgrey), ("FONT", (0, -1), (-1, -1), "Helvetica-Bold", 10),
                            ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#F4EFE8"))]))
    st += [ts, Spacer(1, 2 * mm), Ps(tt.get("basis")), Spacer(1, 5 * mm), P("Bill of quantities", "Heading3")]
    for sec in res["sections"]:
        lines = [r for r in rows_for(doc) if r["section_id"] == sec["id"]]
        data = [["Item", "Specification", "Qty", "Unit", "Rate", "Amount", "Status"]]
        for r in lines:
            data.append([Ps(f"{r['code']} {r['name']}"), Ps(r["specification"]), r.get("quantity") or "", r.get("unit") or "",
                         inr(r.get("rate"), "") if r.get("rate") else "", inr(r.get("amount"), "") if r.get("amount") not in (None, "0.00") else "",
                         Ps(r["status_label"] + (" · indicative qty" if r.get("is_assumption") else ""))])
        data.append(["", Ps(f"<b>{sec['name']} subtotal</b>"), "", "", "", inr(sec["subtotal"], sym), ""])
        tb = Table(data, colWidths=[38 * mm, 58 * mm, 14 * mm, 10 * mm, 16 * mm, 24 * mm, 20 * mm], repeatRows=1)
        tb.setStyle(TableStyle([("FONT", (0, 0), (-1, -1), "Helvetica", 7.5), ("BACKGROUND", (0, 0), (-1, 0), navy),
                                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white), ("VALIGN", (0, 0), (-1, -1), "TOP"),
                                ("ALIGN", (2, 1), (5, -1), "RIGHT"), ("LINEBELOW", (0, 0), (-1, -1), 0.25, colors.lightgrey)]))
        st += [P(sec["name"], "Heading4"), tb, Spacer(1, 3 * mm)]
    st.append(P("Assumptions & calculation notes", "Heading3"))
    for a in res["assumptions"]:
        st.append(Ps(f"• {a}"))
    for r in rows_for(doc):
        if r.get("is_assumption") or r.get("requires_review"):
            st.append(Ps(f"• {r['name']}: {r.get('client_trace')}"))
    st += [Spacer(1, 3 * mm), P("Exclusions", "Heading3")] + [Ps(f"• {e}") for e in res["exclusions"]]
    if doc.get("terms"):
        st += [Spacer(1, 3 * mm), P("Commercial terms", "Heading3"), Ps(doc["terms"])]
    st += [Spacer(1, 3 * mm), P("Disclaimer", "Heading3"), Ps(res.get("disclaimer"))]
    st += [Spacer(1, 14 * mm), Table([["______________________________", "______________________________"],
                                      ["Architect approval / signature", "Client acceptance"]], colWidths=[90 * mm, 90 * mm],
                                     style=[("FONT", (0, 0), (-1, -1), "Helvetica", 8)])]
    pdf.build(st, onFirstPage=on_page, onLaterPages=on_page)
    return buf.getvalue()


RENDERERS = {"pdf": (render_pdf, "application/pdf"),
             "xlsx": (render_xlsx, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
             "csv": (render_csv, "text/csv; charset=utf-8")}


def today():
    return datetime.now().strftime("%d %b %Y")
