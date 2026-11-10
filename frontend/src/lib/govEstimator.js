export const GOV_ESTIMATOR_STORAGE_KEY = "archengine.gov-estimator.v1";

export const GOV_MATERIALS = [
  { key: "cement", label: "Cement", defaultRate: 350, multiplier: 1 },
  { key: "sand", label: "Sand", defaultRate: 45, multiplier: 35.31467 },
  { key: "aggregate", label: "Aggregate", defaultRate: 30, multiplier: 35.31467 },
  { key: "bricks", label: "Bricks", defaultRate: 6, multiplier: 1 },
  { key: "steel", label: "Steel", defaultRate: 60, multiplier: 1000 },
  { key: "kota", label: "Kota", defaultRate: 30, multiplier: 10.76391 },
  { key: "tiles", label: "Tiles", defaultRate: 45, multiplier: 10.76391 },
];

export const GOV_ITEMS = [
  { code: "RCC-M10", name: "PCC M10", group: "RCC", unit: "M3", sourceRow: 12, coefficients: { cement: 4.3, sand: 0.44, aggregate: 0.88 } },
  { code: "RCC-M15", name: "RCC M15", group: "RCC", unit: "M3", sourceRow: 13, coefficients: { cement: 6.4, sand: 0.41, aggregate: 0.83 } },
  { code: "RCC-M20", name: "RCC M20", group: "RCC", unit: "M3", sourceRow: 14, coefficients: { cement: 7.2, sand: 0.4, aggregate: 0.8 } },
  { code: "RCC-M25", name: "RCC M25", group: "RCC", unit: "M3", sourceRow: 15, coefficients: { cement: 7.8, sand: 0.45, aggregate: 0.9 } },
  { code: "BRICK-14", name: "Brick masonry in CM 1:4", group: "Brickwork", unit: "M3", sourceRow: 17, coefficients: { cement: 1.77, sand: 0.24, bricks: 420 } },
  { code: "BRICK-16", name: "Brick masonry in CM 1:6", group: "Brickwork", unit: "M3", sourceRow: 18, coefficients: { cement: 1.25, sand: 0.26, bricks: 420 } },
  { code: "BRICK-115", name: "115 mm brick work CM 1:4", group: "Brickwork", unit: "M2", sourceRow: 19, coefficients: { cement: 0.22, sand: 0.03, bricks: 50 } },
  { code: "PLASTER-12", name: "Plaster 12 mm thick CM 1:4", group: "Plaster", unit: "M2", sourceRow: 21, coefficients: { cement: 0.09, sand: 0.012 } },
  { code: "PLASTER-20", name: "Plaster 20 mm thick CM 1:4", group: "Plaster", unit: "M2", sourceRow: 22, coefficients: { cement: 0.15, sand: 0.022 } },
  { code: "PLASTER-20-2C", name: "Plaster 20 mm thick CM 1:4 · two coats", group: "Plaster", unit: "M2", sourceRow: 23, coefficients: { cement: 0.19, sand: 0.02 } },
  { code: "STEEL", name: "Steel", group: "Steel", unit: "Not specified in Sheet 1", sourceRow: 25, coefficients: { steel: 17.74 } },
  { code: "FLOOR-MM", name: "MM tiles in floor", group: "Flooring", unit: "M2", sourceRow: 27, coefficients: { cement: 0.28, sand: 0.02 } },
  { code: "DADO-MM", name: "MM tiles in dado", group: "Flooring", unit: "M2", sourceRow: 28, coefficients: { cement: 0.24, sand: 0.015 } },
  { code: "SKIRT-MM", name: "MM tiles in skirtings", group: "Flooring", unit: "RM", sourceRow: 29, coefficients: { cement: 0.03, sand: 0.002 } },
  { code: "FLOOR-WG", name: "WG tiles in flooring", group: "Flooring", unit: "M2", sourceRow: 30, coefficients: { cement: 0.28, sand: 0.02 } },
  { code: "DADO-WG", name: "WG tiles in dado", group: "Flooring", unit: "M2", sourceRow: 31, coefficients: { cement: 0.24, sand: 0.015 } },
  { code: "FLOOR-KOTA", name: "Kota stone in flooring", group: "Flooring", unit: "M2", sourceRow: 32, coefficients: { cement: 0.28, sand: 0.02 } },
  { code: "DADO-KOTA", name: "Kota stone in dado", group: "Flooring", unit: "M2", sourceRow: 33, coefficients: { cement: 0.24, sand: 0.015 } },
  { code: "SKIRT-KOTA", name: "Kota stone in skirtings", group: "Flooring", unit: "RM", sourceRow: 34, coefficients: { cement: 0.04, sand: 0.002 } },
];

export function createGovEstimatorDefaults() {
  return {
    tenderName: "",
    tenderPlace: "",
    constructionArea: "4500",
    labourRate: "150",
    materialRates: Object.fromEntries(GOV_MATERIALS.map(({ key, defaultRate }) => [key, String(defaultRate)])),
    calculationSettings: {
      materialRateMultipliers: Object.fromEntries(GOV_MATERIALS.map(({ key, multiplier }) => [key, String(multiplier)])),
    },
    itemQuantities: Object.fromEntries(GOV_ITEMS.map(({ code }) => [code, "1"])),
    itemNames: Object.fromEntries(GOV_ITEMS.map(({ code, name }) => [code, name])),
    itemUnits: Object.fromEntries(GOV_ITEMS.map(({ code, unit }) => [code, unit])),
    itemCoefficients: Object.fromEntries(GOV_ITEMS.map(({ code, coefficients }) => [code,
      Object.fromEntries(GOV_MATERIALS.map(({ key }) => [key, coefficients[key] == null ? "" : String(coefficients[key])]))])),
  };
}

export function readGovEstimatorInputs() {
  const defaults = createGovEstimatorDefaults();
  try {
    const stored = JSON.parse(localStorage.getItem(GOV_ESTIMATOR_STORAGE_KEY) || "null");
    if (!stored || typeof stored !== "object") return defaults;
    return {
      ...defaults,
      ...stored,
      materialRates: { ...defaults.materialRates, ...(stored.materialRates || {}) },
      calculationSettings: {
        ...defaults.calculationSettings,
        ...(stored.calculationSettings || {}),
        materialRateMultipliers: {
          ...defaults.calculationSettings.materialRateMultipliers,
          ...(stored.calculationSettings?.materialRateMultipliers || {}),
        },
      },
      itemQuantities: { ...defaults.itemQuantities, ...(stored.itemQuantities || {}) },
      itemNames: { ...defaults.itemNames, ...(stored.itemNames || {}) },
      itemUnits: { ...defaults.itemUnits, ...(stored.itemUnits || {}) },
      itemCoefficients: Object.fromEntries(GOV_ITEMS.map(({ code }) => [code, {
        ...defaults.itemCoefficients[code], ...(stored.itemCoefficients?.[code] || {}),
      }])),
    };
  } catch {
    return defaults;
  }
}

const numericValue = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function calculateGovEstimate(inputs) {
  const rates = Object.fromEntries(GOV_MATERIALS.map((material) => {
    const localRate = numericValue(inputs.materialRates?.[material.key]);
    const multiplier = numericValue(inputs.calculationSettings?.materialRateMultipliers?.[material.key] ?? material.multiplier);
    return [material.key, { localRate, multiplier, calculationRate: localRate * multiplier }];
  }));
  const materialTotals = Object.fromEntries(GOV_MATERIALS.map(({ key }) => [key, 0]));
  const groups = [];
  for (const groupName of [...new Set(GOV_ITEMS.map((item) => item.group))]) {
    const items = GOV_ITEMS.filter((item) => item.group === groupName).map((item) => {
      const quantity = numericValue(inputs.itemQuantities?.[item.code]);
      const coefficients = Object.fromEntries(GOV_MATERIALS.map(({ key }) => [key,
        inputs.itemCoefficients?.[item.code]?.[key] === "" || inputs.itemCoefficients?.[item.code]?.[key] == null
          ? null : numericValue(inputs.itemCoefficients[item.code][key]),
      ]));
      const materialBreakdown = Object.fromEntries(GOV_MATERIALS.map(({ key }) => {
        const consumptionPerUnit = coefficients[key];
        const consumption = consumptionPerUnit == null ? null : consumptionPerUnit * quantity;
        const unitRate = rates[key].calculationRate;
        const amount = consumption == null ? null : consumption * unitRate;
        if (amount != null) materialTotals[key] += amount;
        return [key, { consumptionPerUnit, consumption, unitRate, amount }];
      }));
      const unitCost = Object.values(materialBreakdown).reduce((sum, component) => sum + (component.consumptionPerUnit == null ? 0 : component.consumptionPerUnit * component.unitRate), 0);
      const amount = unitCost * quantity;
      return {
        ...item,
        name: inputs.itemNames?.[item.code] ?? item.name,
        unit: inputs.itemUnits?.[item.code] ?? item.unit,
        coefficients,
        quantity,
        materialBreakdown,
        unitCost,
        amount,
      };
    });
    groups.push({ name: groupName, items, subtotal: items.reduce((sum, item) => sum + item.amount, 0) });
  }
  const materialsTotal = Object.values(materialTotals).reduce((sum, amount) => sum + amount, 0);
  const labourCost = numericValue(inputs.constructionArea) * numericValue(inputs.labourRate);
  return {
    rates,
    groups,
    materialTotals,
    materialsTotal,
    labourCost,
    grandTotal: materialsTotal + labourCost,
  };
}
