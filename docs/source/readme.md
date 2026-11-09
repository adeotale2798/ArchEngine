# Construction Cost Engine — Emergent Build Pack

Files:
- `01_Master_Architecture_V4.md` — full product and technical architecture.
- `02_Emergent_Master_Build_Prompt.md` — paste into Emergent after uploading the architecture file.
- `03_Data_Model_and_Calculation_Reference.md` — implementation reference for entities and safe formulas.

Recommended use:
1. Upload all three files into the Emergent project knowledge/context.
2. Paste the Emergent Master Build Prompt.
3. Ask Emergent to implement Phase 1 only, then test and continue phase by phase.
4. Keep all source files in Git and require database migrations and automated tests.
5. Provide the original quotation PDF to Emergent separately if it is not already attached to the project. Instruct it to transcribe values exactly and flag discrepancies; never fabricate missing data.

Important design decision:
The client enters total floors and total bathrooms, not room dimensions. The architect/admin configures how these inputs affect foundation, slab and bathroom-related costs. Floor-count-based foundation rules are estimate mappings only and do not certify structural adequacy. Slab area cannot be measured accurately without a footprint/area input; if no such input is collected, use an architect-configured standard quantity or lump-sum basis and label it as an assumption.
