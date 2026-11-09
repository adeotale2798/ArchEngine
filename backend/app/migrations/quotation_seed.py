"""Transcription of 'Quotation Of Aniket Deotale ji sir (1).pdf' (terrain design studio, 6 May 2025).
Values are copied exactly as printed. Discrepancies are FLAGGED, never corrected (D-012)."""
from decimal import Decimal

from app.core.db import db, new_id, now
from app.migrations.seed import doc

SRC = "Quotation Of Aniket Deotale ji sir (1).pdf"
PACKAGES = [("TYPE_A", "Type A", "Turnkey package — Type A specifications (page 2–6)."),
            ("TYPE_B", "Type B", "Turnkey package — Type B specifications (page 2–6)."),
            ("TYPE_C", "Type C", "Turnkey package — Type C specifications (page 2–6)."),
            ("ONLY_CIVIL", "Only Civil Work", "Only civil work — rates from the estimate sheet. No specification column was printed for this package.")]

# (code, name, description, areas column, [A, B, C, Only Civil rates], [printed amounts A, B, C, Civil], mode, note)
FIN = [
    ("FIN-01", "Plinth Level", "Work from excavation till casting of plinth slab (slab area incl. verandah and entrance steps).", "720",
     ["750", "800", "850", "900"], ["540000", "576000", "612000", "774000"], "FLOOR_BAND_LOOKUP", "Estimate sheet row 1"),
    ("FIN-02", "Ground Floor Roof", "Items above plinth level slab and below ground floor roof slab.", "1290",
     ["1900", "2100", "2300", "900"], ["2451000", "2709000", "2967000", "981000"], "FIXED_QUANTITY", "Estimate sheet row 2"),
    ("FIN-03", "Upper Floor Roofs (per floor)", "Typical floor roof — items above slab and below next roof slab. Source rows 3–5 (First, Second, Third Floor Roof) at 1290 sft each.",
     "1290", ["1900", "2100", "2300", "1050"], ["2451000", "2709000", "2967000", "1144500"], "PER_FLOOR", "Estimate sheet rows 3–5 (printed amount is per floor)"),
    ("FIN-04", "Terrace Level Slab", "Terrace level slab.", "645", ["1900", "2100", "2300", "1050"], ["1225500", "1354500", "1483500", "1144500"],
     "FIXED_QUANTITY", "Estimate sheet row 6"),
    ("FIN-05", "Site development", "Parking area, landscape area, marginal spaces between plinth slab and compound wall incl. ramp (filling, anti-termite, slab, tiling).",
     "550", ["475", "500", "550", "250"], ["261250", "275000", "302500", "137500"], "FIXED_QUANTITY", "Estimate sheet row 7"),
    ("FIN-06", "Water tank (UG + OHT)", "Includes RCC work and waterproofing work.", "10000", ["21", "23", "25", "20"],
     ["21000", "230000", "250000", "200000"], "FIXED_QUANTITY", "Estimate sheet row 8"),
    ("FIN-07", "Compound wall", "Designer wall as per elevation. Excludes cladding material like HPL on gates.", "300", ["350"] * 4,
     ["105000"] * 4, "FIXED_QUANTITY", "Estimate sheet row 9"),
    ("FIN-08", "Parapet Wall", "Wall as per design incl. MS pipe work as per design (horizontal pipe).", "150", ["250"] * 4, ["37500"] * 4,
     "FIXED_QUANTITY", "Estimate sheet row 10"),
    ("FIN-09", "Terrace Waterproofing", "Brick bat coba on terrace level.", "900", ["120", "120", "120", "100"], ["108000", "108000", "108000", "90000"],
     "FIXED_QUANTITY", "Estimate sheet row 11"),
]
PRINTED_TOTALS = ["12102250", "13522000", "14766500", "7270500"]

# (section, subsection, sr_no, item, specification, [Type A, Type B, Type C])
SPEC = [
    ("Substructure & Structure", None, 1, "Excavation", "Excavation will be done till a depth 10’ from natural ground level or till hard soil is achieved or as per bearing capacity required by the structural designer.", ["as per site condition"] * 3),
    ("Substructure & Structure", None, 2, "Reinforcement", "FE 500 rolled steel of TMT/ make or equivalent of ISI approved make to be used in proportion as specified by structural designer.", ["Raipur/Buland/Primegold", "Lodha/Sangam", "Kamdhenu/jsw/Sail"]),
    ("Substructure & Structure", None, 3, "Cement", "53 Grade PPC Cement to be used as per availability", ["Janghrodhak/ Dalmia/JK Laxmi", "Birla Chetak/MP Birla/Birla Shakti", "Ultratech/ACC/ Ambuja"]),
    ("Substructure & Structure", None, 4, "RCC in Foundation", "M20 or M25 mix design to be used as specified by structural designer. Open foundation to be proposed. Foundation to be designed proposed structure + one floor for future provisions.", ["as per Drawing"] * 3),
    ("Substructure & Structure", None, 5, "Back Filling", "Backfilling till average ground level will be done with excavated material available at site. To increase the plinth level fly ash will be used as approved by structural designer.", ["Fly ash"] * 3),
    ("Substructure & Structure", None, 6, "Anti-Termite", "Anti-termite treatment chemical shall be used before plinth slab casting", ["Certified chemical"] * 3),
    ("Substructure & Structure", None, 7, "RCC in columns", "M20 or M25 mix design to be used as specified by structural designer. Open foundation to be proposed. Foundation to be designed proposed structure + one floor for future provisions.", ["as per Drawing"] * 3),
    ("Substructure & Structure", None, 8, "Plinth Level", "Average Ground Level will be 1’6” from Road Level in front of road.And plinth level 2'6\" from Road Level", ["avg. GL-1'from RL avg.PL-2' from RL", "avg. GL-1'6\" from RL avg.PL-2'6\" from RL", "avg. GL-1'6\" from RL avg.PL-3' from RL"]),
    ("Substructure & Structure", None, 9, "RCC in beams", "M20 or M25 mix design to be used as specified by structural designer", ["as per Drawing"] * 3),
    ("Substructure & Structure", None, 10, "RCC in slabs", "M20 or M25 mix design to be used as specified by structural designer", ["as per Drawing"] * 3),
    ("Masonry & Plaster", None, 11, "Brickwork", "brickwork will be done with AAC blocks/Fly ash/Red Bricks with cement mortar Or Bricks wall as recommended by structural engineer (Outer wall 9” and Inner wall 4.5”)", ["Fly ash Bricks", "Red Bricks", "AAC Block/Red Bricks"]),
    ("Masonry & Plaster", None, 12, "Lintel level", "Lintel level of doors and windows", ["7' height", "8' height", "8' height"]),
    ("Masonry & Plaster", None, 13, "Slab Height", "Floor to floor height", ["10' height", "10' 6\" height", "11' height"]),
    ("Masonry & Plaster", None, 14, "External plaster", "Single coat plaster of thickness approx. 15mm to be done in cement and sand in the ratio of 1:4.", ["Single coat", "Single coat", "Double Coat /Punch plaster"]),
    ("Masonry & Plaster", None, 15, "Internal plaster", "12mm thick cement plaster to be done on all walls", ["Single coat"] * 3),
    ("Waterproofing & Terrace", None, 16, "Waterproofing", "Waterproofing by using brickbat coba, grouting and chemical compound method to be done for all toilets and terraces and lift Pit. Chemical compound coating to be done and IPS Work for balconies.", ["Only Toilet/Balcony/ Utility area"] * 3),
    ("Waterproofing & Terrace", None, 17, "Terrace level", "Parapet wall as per design, to be provided", ["Brickwork /MS Railing"] * 3),
    ("Staircase, Railings & Fabrication", None, 18, "Main Staircase", "Staircase to be provided till the terrace level with SS railing", ["SS Railing"] * 3),
    ("Staircase, Railings & Fabrication", None, 19, "Railing in Elevation", "Provision for Toughened Glass and SS and MS railing to be provided for balconies.", ["MS Railing", "SS Railing", "Glass Railing"]),
    ("Staircase, Railings & Fabrication", None, 20, "Fabrication work", "Fabrication work required as per elevation for covering drainage pipes", ["No", "No", "yes"]),
    ("External Works & Tanks", None, 21, "Compound wall", "9” thick, 6’ hight compound wall with two gates to be provided", ["as per Drawing"] * 3),
    ("External Works & Tanks", None, 22, "UG Tank", "Under ground water tank in R.C.C. to be provided as required Quantity.", ["as per required Quantity"] * 3),
    ("External Works & Tanks", None, 23, "Overhead water tank", "RCC water tank/Syntex (Plasto) be provided as required", ["as per required Quantity"] * 3),
    ("Plumbing Work", None, 24, "Plumbing pipes & Fittings", "All internal plumbing will be done in CPVC Pipe fittings of Supreme Company, vertical sewer lines in SWR, and underground piping in Double layered PVC pipes.", ["Supreme", "Supreme", "Ashirwad/Astral"]),
    ("Plumbing Work", None, 25, "Plumbing chambers", "PVC/Brickwork underground chambers to be used wherever required.", ["as per site condition"] * 3),
    ("Plumbing Work", None, 26, "Sanitary Fittings", "Jaquar or equivalent make fiitings to be used. Metropol, Double Function divertor, Single function wall mount shower.", ["Jaguar-Essco", "Jaguar", "Jaguar"]),
    ("Plumbing Work", None, 27, "Sanitary ware", "Jaquar/Simpolo or equivalent.", ["Simpolo/Escco", "Jaguar", "Jaguar"]),
    ("Plumbing Work", None, 28, "Water tank sensor", "Provision for water tank sensor to be done to avoid manually filling the tank every day.", ["No", "Yes", "Yes"]),
    ("Electrical Work", None, 29, "Internal electrification", "KEI/RR/Finolex/Polycab wires, Legrand/Gold medal switches, L&T/Hagger MCBs to be used. Wall lights points to give 100 lux level, provisions for TV, AC,Inverter in all rooms to be provided.", ["Drawing room -03,Bedroom-04,toilet -02,Parking-02,Kitchen -03,Utility area -01,Balcony-01", "Drawing room -04,Bedroom-04,toilet -02,Parking-03,Kitchen -03,Utility area -02,Balcony-01", "Drawing room -05,Bedroom-04,toilet -02,Parking-02,Kitchen -04,Utility area -02,Balcony-01"]),
    ("Electrical Work", None, 30, "External electrification", "Compound wall light points, gate column light points and basic electrification for ceiling lights for parking area", ["wall compund -02,parking area -02", "wall compund -04,parking area - 04", "wall compund -06,parking area -06"]),
    ("Flooring and Dado", None, 31, "Entrance Ramps", "Granite Entrance Ramps and steps to be provided in front of gates", ["Granite"] * 3),
    ("Flooring and Dado", None, 32, "Parking area", "Parking tile to be provided for flooring of parking area", ["400X400 Size", "400X400 Size", "600X600 Size"]),
    ("Flooring and Dado", None, 33, "Flooring Tiles", "Digital vitrified flooring tiles of following size to be laid.", ["600x600 Size", "600x1200 Size", "800x1600 Size"]),
    ("Flooring and Dado", None, 34, "Master Bedroom Flooring", "Wooden Tile and flooring for master bedroom", ["Wooden Tile", "Wooden Tile", "Wooden Floor"]),
    ("Flooring and Dado", None, 35, "Toilet Wall Tiles", "Vitrified/ceramic tiles of size (2’x4’) to be laid.", ["300x600 Size", "600x1200 Size", "600x1200 Size"]),
    ("Flooring and Dado", None, 36, "Kitchen Otta", "Otaa to be used and Wall Tile above kitchen otta", ["Otta-Granite , wall tile - 300x600", "Otta-full body tile wall tile -600x1200", "Otta-Quatz stone wall tile -600x1200"]),
    ("Flooring and Dado", None, 37, "Wash area", "Service otta and Wall tiles in following to be laid.", ["Otta-Granite, Wall Tile- 300X600"] * 3),
    ("Flooring and Dado", None, 38, "Balconies", "Wooden pattern tiles to be laid in balconies.", ["150x800 Size"] * 3),
    ("Flooring and Dado", None, 39, "Lift Dado", "Vitrified/ceramic tiles/natural stone of size (2’x4’) to be laid.OR Granite", ["Tile-600x1200 and frame in granite"] * 3),
    ("Flooring and Dado", None, 40, "Typ. Flr Entrance Lobby", "Granite flooring as in staircase", ["Granite"] * 3),
    ("Flooring and Dado", None, 41, "Staircase", "Granite to be used.", ["Granite"] * 3),
    ("Door Frames, Doors & Windows", None, 42, "Entrance Door", "Door Frames and doors to be provided", ["Door frame - Wooden Door Frame, Door - Laminated Flush Door, Hardware - Aldrope, tower bolt, Main Door handle and Godrej lock", "Door frame - Teakwood Door Frame, Door - Laminated Flush Door, Hardware - Aldrope, tower bolt, Main Door handle and Godrej lock", "Door frame - Teakwood Door Frame, Door - Veneered Flush Door, Hardware - Aldrope, tower bolt, Main Door handle and Godrej lock"]),
    ("Door Frames, Doors & Windows", None, 43, "Bed Room Door", "Door Frames and doors to be provided", ["Door frame - Plywood frame with laminate finish, Door - Laminated Flush Door, Hardware - Aldrope, Bedroom Handle", "Door frame - Plywood frame with laminate finish, Door - Laminated Flush Door, Hardware - Cylendrical lock", "Door frame - Plywood frame with laminate finish, Door - Laminated Flush Door, Hardware - Cylendrical lock"]),
    ("Door Frames, Doors & Windows", None, 44, "Toilet, wash Area, utility Door", "Door Frames and doors to be provided", ["Door frame - Granite, Door - Laminated Flush Door, Hardware - Aldrope, Bedroom Handle", "Door frame - Granite, Door - Laminated Flush Door, Hardware - Cylendrical lock", "Door frame - Granite, Door - Laminated Flush Door, Hardware - Cylendrical lock"]),
    ("Door Frames, Doors & Windows", None, 47, "Terrace Door", "Door frame in MS and MS Sheet door for terrace with standard hardware.", ["Door frame -MS, Door - MS Sheet, Hardware - Aldrope two side, 6\" MS handle"] * 3),
    ("Door Frames, Doors & Windows", None, 48, "Window Jambs and sills", "Window jambs in Granite to be provided", ["one side", "one side", "four side"]),
    ("Door Frames, Doors & Windows", None, 49, "Windows", "Windows in openings to be provided", ["Alunimium powder coated", "Jindal, 1.2mm aluminium powder coated", "UPVC Windows"]),
    ("Door Frames, Doors & Windows", None, 50, "Window grills", "Designer window grills to be fixed in all windows.", ["as per Drawing"] * 3),
    ("Painting Work", None, 51, "Internal Paint", "Putty, Primier & painting work to be done", ["Asian All protek shine", "Asian Royal Luxury", "Asian Royal Glitz"]),
    ("Painting Work", None, 52, "External paint", "Whiting, Primier & Painting to be done", ["Asian Apex or equivalent", "Asian Ultima or equivalent", "Asian Ultima protect or equivalent"]),
    ("Ceiling Work", None, 53, "Parking Area", "POP in parking area to be provided", ["NO", "Drawing Area", "YES"]),
    ("Ceiling Work", None, 54, "Lobby Areas", "POP in Lobby areas to be provided", ["NO", "NO", "YES"]),
    ("Ceiling Work", None, 55, "Balconies", "PVC ceiling to be provided.", ["NO", "NO", "YES"]),
    ("Staircase, Railings & Fabrication", "Glass Railings", 56, "Balconies", "1050mm Height railing to be provided", ["MS Railing", "SS Railing", "Glass Railing"]),
    ("Staircase, Railings & Fabrication", "Glass Railings", 57, "Standing Balconies", "1050mm Height railing to be provided", ["MS Railing", "SS Railing", "Glass Railing"]),
]
ASSUMPTIONS = ["Any changes in areas and specification will be charged extra.",
               "If the natural ground level is more than 18” down from road level, filling charges will be extra.",
               "Rates includes RCC, brickwork, plaster, internal & external paint, flooring, electrical wiring and building plumbing",
               "Any duct having an area below 15 sqm will not be deducted from area calculations for costing.",
               "Areas considered for calculation might change as per site",
               "Per-floor slab areas are template quantities from the source quotation, not measured areas for your building."]
EXCLUSIONS = ["The NMC building sanctioning charges or any other statutory charges for clearance of papers, etc. to be paid by owner.",
              "Electronics, electrical fittings, elevation cladding materials, lift, façade materials for covering of drainage pipes & AC outdoors, fabrication work apart from grills and railing as mentioned, electric meter panel, everything not mentioned above, etc.",
              "GST extra as applicable."]
IMG = {"Substructure & Structure": "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=800&q=70",
       "Floor-level Financials": "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=800&q=70",
       "Site & External Works": "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=70"}


async def seed_quotation(org_id, units, actor_id):
    if await db.estimate_templates.find_one({"organisation_id": org_id, "source_file": SRC}):
        return
    tid = new_id()
    await db.estimate_templates.insert_one(doc(org_id, id=tid, name="Residential Turnkey Estimate (Terrain Design Studio)", source_file=SRC,
        description="Imported from the Aniket Deotale quotation (06-05-2025). AWAITING ARCHITECT VERIFICATION before publishing.",
        intro_text="Tell us about your building — just the number of floors and bathrooms. Pick a package, review specifications and download your estimate. No measurements or drawings needed.",
        hero_image_url="https://images.unsplash.com/photo-1603901622056-0a5bee231395?w=1600&q=70", assumptions=ASSUMPTIONS,
        exclusions=EXCLUSIONS, sort_order=10, created_by=actor_id, verification_status="awaiting_verification"))
    T = lambda **kw: doc(org_id, template_id=tid, created_by=actor_id, **kw)
    await db.input_definitions.insert_many([
        T(key="total_floors", label="Total number of floors", input_type="integer", required=True, default_value="4", min_value="1", max_value="10",
          help_text="Count every storey that has a roof slab above it, starting with the ground floor (e.g. G+3 = 4). Do not count the terrace, stilt or basement. Configure this definition to match your firm's convention.",
          client_visible=True, client_editable=True, sort_order=10),
        T(key="total_bathrooms", label="Total number of bathrooms", input_type="integer", required=True, default_value="2", min_value="0", max_value="20",
          help_text="Count every toilet/bathroom in the building, including attached and common toilets.", client_visible=True, client_editable=True, sort_order=20)])
    pkg_ids = []
    for i, (code, name, desc) in enumerate(PACKAGES):
        p = T(code=code, name=name, description=desc, sort_order=(i + 1) * 10, is_recommended=code == "TYPE_B",
              image_url=["https://images.unsplash.com/photo-1625337904562-efe0a0d9793f?w=900&q=70", "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=900&q=70",
                         "https://images.unsplash.com/photo-1756706718604-ef4af3970e33?w=900&q=70", "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=900&q=70"][i])
        await db.packages.insert_one(p)
        pkg_ids.append(p["id"])
    sections, flags, order = {}, [], 0

    async def section(name, sort):
        if name not in sections:
            s = T(name=name, code=f"S{len(sections) + 1:02d}", client_visible=True, sort_order=sort, image_url=IMG.get(name))
            await db.sections.insert_one(s)
            sections[name] = s["id"]
        return sections[name]

    fin_sec = await section("Floor-level Financials", 10)
    ext_sec = await section("Site & External Works", 20)
    computed = [Decimal(0)] * 4
    for code, name, desc, area, rates, printed, mode, ref in FIN:
        order += 10
        sec = ext_sec if code >= "FIN-05" else fin_sec
        line = T(section_id=sec, code=code, name=name, description=desc, unit_id=units["sft"], quantity_mode=mode,
                 fixed_quantity=area if mode == "FIXED_QUANTITY" else None, inclusion_default="INCLUDED", client_visible=True,
                 client_can_change_option=False, client_price_visibility="SHOW_RATE", is_assumption=code in ("FIN-02", "FIN-04"),
                 source_ref=f"{SRC} — {ref}", sort_order=order,
                 internal_notes="Unit 'sft' copied from the printed column header '(sft)'." + (" VERIFY UNIT: value 10000 looks like litres." if code == "FIN-06" else "")
                 + (" VERIFY UNIT: likely running feet." if code in ("FIN-07", "FIN-08") else ""))
        await db.line_items.insert_one(line)
        for pi, pid in enumerate(pkg_ids):
            await db.package_options.insert_one(T(package_id=pid, line_item_id=line["id"], specification_label=desc[:120] if pi < 3 else "Only civil work",
                                                  rate=rates[pi], inclusion_status="INCLUDED", sort_order=order))
            calc = Decimal(area) * Decimal(rates[pi])
            computed[pi] += Decimal(printed[pi])
            if calc != Decimal(printed[pi]):
                flags.append({"severity": "warning", "row": code, "package": PACKAGES[pi][1],
                              "message": f"{name}: printed amount {printed[pi]} ≠ {area} × {rates[pi]} = {calc}. Printed value preserved here; engine computes quantity × rate."})
        if mode == "FLOOR_BAND_LOOKUP":
            await db.foundation_rule_sets.insert_one(T(name="Plinth / foundation by total floors", line_item_id=line["id"], input_key="total_floors",
                approval_note="Source quotation covers a G+3 (4 floor) building only. Architect must add bands for other floor counts.",
                bands=[{"id": new_id(), "label": "Source quotation basis (G+3)", "min_floors": "4", "max_floors": "4", "quantity": area,
                        "unit_id": units["sft"], "specification": "Open foundation as per structural drawing (proposed structure + one floor future provision)",
                        "rates": {}, "client_note": "Plinth level priced on the source quotation area for a 4-floor building.",
                        "approval_reference": "", "requires_review": True, "status": "active"}]))
        if mode == "PER_FLOOR":
            await db.slab_rule_sets.insert_one(T(name="Upper floor roof slabs", line_item_id=line["id"], input_key="total_floors",
                included_floor_types="Roof slabs above ground floor up to the top occupied floor (ground floor roof and terrace slab are separate rows)",
                floor_adjustment="-1", slabs_per_floor="1", quantity_basis="AREA", quantity_per_floor=area, unit_id=units["sft"], is_assumption=True,
                counting_notes="Source rows 3–5 each 1290 sft for First/Second/Third floor roofs.",
                client_explanation="Each floor above ground adds one roof slab priced on the template area of 1290 sft (indicative, not measured)."))
    for pi in range(4):
        if computed[pi] != Decimal(PRINTED_TOTALS[pi]):
            flags.append({"severity": "warning", "row": "TOTAL", "package": PACKAGES[pi][1],
                          "message": f"Printed total {PRINTED_TOTALS[pi]} ≠ sum of printed row amounts {computed[pi]}."})
    sort = 30
    subs = {}
    for sec_name, sub_name, sr, item, spec, vals in SPEC:
        if sec_name not in sections:
            sort += 10
        sid = await section(sec_name, sort)
        sub_id = None
        if sub_name:
            if sub_name not in subs:
                s = T(section_id=sid, name=sub_name, sort_order=100)
                await db.subsections.insert_one(s)
                subs[sub_name] = s["id"]
            sub_id = subs[sub_name]
        line = T(section_id=sid, subsection_id=sub_id, code=f"SPEC-{sr:02d}", name=item, description=spec, quantity_mode="LUMP_SUM",
                 unit_id=units["LS"], inclusion_default="INCLUDED_IN_RATE", client_visible=True, client_can_change_option=False,
                 client_price_visibility="LINE_TOTAL_ONLY", source_ref=f"{SRC} — Specifications Sr.No {sr}", sort_order=sr * 10,
                 client_notes="Specification only — cost included in the floor-level rates.")
        await db.line_items.insert_one(line)
        for pi in range(3):
            await db.package_options.insert_one(T(package_id=pkg_ids[pi], line_item_id=line["id"], specification_label=vals[pi],
                                                  specification_details=spec, inclusion_status="INCLUDED_IN_RATE", sort_order=sr * 10))
    flags.append({"severity": "info", "row": "SPEC", "package": "Only Civil Work", "message": "No specification column printed for 'Only Civil Work'; spec rows have no option for this package."})
    flags.append({"severity": "info", "row": "SPEC 45-46", "package": "-", "message": "Specification Sr.No 45 and 46 are absent in the source (numbering jumps 44 → 47). Not invented."})
    flags.append({"severity": "info", "row": "GST", "package": "-", "message": "Source says 'GST extra as applicable' without a rate. Org GST setting must be verified."})
    flags.append({"severity": "info", "row": "BATHROOMS", "package": "-", "message": "Source has no per-bathroom quantities or rates. Bathroom rules left for architect configuration."})
    await db.import_logs.insert_one({"id": new_id(), "organisation_id": org_id, "template_id": tid, "source_file": SRC, "status": "awaiting_verification",
                                     "rows_imported": len(FIN) + len(SPEC), "flags": flags, "created_at": now()})
