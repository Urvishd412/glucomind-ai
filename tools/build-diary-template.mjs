import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputPath = "templates/diabetes-diary-template.xlsx";
const previewPath = "outputs/diabetes-diary-template-preview.png";

const workbook = Workbook.create();
const entry = workbook.worksheets.add("Data Entry");
const codebook = workbook.worksheets.add("Codebook");
const notes = workbook.worksheets.add("Instructions");

entry.showGridLines = false;
codebook.showGridLines = false;
notes.showGridLines = false;

entry.getRange("A1:J1").values = [[
  "date",
  "time",
  "glucose",
  "glucose_unit",
  "carbs_g",
  "insulin_units",
  "insulin_type",
  "meal",
  "activity",
  "notes",
]];

entry.getRange("A2:J2").values = [[
  new Date("2026-06-25T00:00:00"),
  "08:00",
  110,
  "mg/dL",
  45,
  4.5,
  "rapid",
  "breakfast",
  "light",
  "Example row. Delete before importing.",
]];

entry.getRange("A3:J200").values = Array.from({ length: 198 }, () =>
  Array.from({ length: 10 }, () => null),
);

entry.getRange("A1:J1").format.fill = { color: "#19736A" };
entry.getRange("A1:J1").format.font = { color: "#FFFFFF", bold: true };
entry.getRange("A1:J200").format.borders = { preset: "outside", style: "thin", color: "#B7C6C0" };
entry.getRange("A2:J200").format.fill = { color: "#FFF9E8" };
entry.getRange("A2:A200").setNumberFormat("yyyy-mm-dd");
entry.getRange("C2:C200").setNumberFormat("0.0");
entry.getRange("E2:F200").setNumberFormat("0.0");
entry.getRange("J2:J200").format.wrapText = true;
entry.getRange("A:J").format.autofitColumns();
entry.freezePanes.freezeRows(1);

entry.getRange("D2:D200").dataValidation = { rule: { type: "list", values: ["mg/dL", "mmol/L"] } };
entry.getRange("G2:G200").dataValidation = { rule: { type: "list", values: ["rapid", "basal", "other"] } };
entry.getRange("H2:H200").dataValidation = {
  rule: { type: "list", values: ["none", "breakfast", "lunch", "dinner", "snack"] },
};
entry.getRange("I2:I200").dataValidation = {
  rule: { type: "list", values: ["none", "light", "moderate", "hard"] },
};

codebook.getRange("A1:C1").values = [["Field", "Allowed values", "Notes"]];
codebook.getRange("A2:C11").values = [
  ["date", "yyyy-mm-dd", "Required. The date of the diary entry."],
  ["time", "HH:MM", "Required unless datetime is used in future imports."],
  ["glucose", "number", "Required. Match the selected glucose_unit."],
  ["glucose_unit", "mg/dL, mmol/L", "Use one unit consistently when possible."],
  ["carbs_g", "number", "Carbohydrates in grams."],
  ["insulin_units", "number", "Dose units. Use insulin_type to identify rapid or basal."],
  ["insulin_type", "rapid, basal, other", "Required when insulin_units is entered."],
  ["meal", "none, breakfast, lunch, dinner, snack", "Meal context."],
  ["activity", "none, light, moderate, hard", "Activity context."],
  ["notes", "text", "Symptoms, site changes, illness, stress, or unusual food."],
];
codebook.getRange("A1:C1").format.fill = { color: "#17201D" };
codebook.getRange("A1:C1").format.font = { color: "#FFFFFF", bold: true };
codebook.getRange("A1:C11").format.borders = { preset: "outside", style: "thin", color: "#B7C6C0" };
codebook.getRange("A:C").format.autofitColumns();
codebook.freezePanes.freezeRows(1);

notes.getRange("A1:D1").values = [["Diabetes Diary Template", null, null, null]];
notes.getRange("A1:D1").merge();
notes.getRange("A1:D1").format.fill = { color: "#19736A" };
notes.getRange("A1:D1").format.font = { color: "#FFFFFF", bold: true, size: 16 };
notes.getRange("A3:D8").values = [
  ["How to use", "Fill rows on the Data Entry sheet, then save a copy as CSV for the web app import.", null, null],
  ["Safety", "This workbook records data only. It does not recommend insulin doses.", null, null],
  ["Privacy", "Avoid adding unnecessary identifiers before sharing a file.", null, null],
  ["Import", "Use the app's Import CSV control after saving the Data Entry sheet as CSV.", null, null],
  ["Units", "Keep glucose_unit aligned with the app settings, or verify conversions after import.", null, null],
  ["Clinical review", "Confirm ratios, correction factors, and dose decisions with your diabetes care team.", null, null],
];
notes.getRange("A3:A8").format.font = { bold: true };
notes.getRange("A3:D8").format.fill = { color: "#EEF4F1" };
notes.getRange("A3:D8").format.borders = { preset: "outside", style: "thin", color: "#B7C6C0" };
notes.getRange("A:D").format.autofitColumns();

await fs.mkdir("outputs", { recursive: true });
await fs.mkdir("templates", { recursive: true });

const preview = await workbook.render({ sheetName: "Data Entry", range: "A1:J14", scale: 2 });
await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));

const exported = await SpreadsheetFile.exportXlsx(workbook);
await exported.save(outputPath);

const inspect = await workbook.inspect({
  kind: "table",
  sheetId: "Data Entry",
  range: "A1:J4",
  include: "values,formulas",
  tableMaxRows: 4,
  tableMaxCols: 10,
});

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 50 },
  summary: "formula error scan",
});

console.log(inspect.ndjson);
console.log(errors.ndjson);
console.log(`Saved ${outputPath}`);
