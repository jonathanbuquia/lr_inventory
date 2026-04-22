import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "..");
const outputDir = path.join(
  workspaceRoot,
  "outputs",
  "grade1-consolidated-20260420",
);
const inputPath = path.join(outputDir, "grade1_textbooks_consolidated.json");
const outputFilename = "grade1_consolidated_all_divisions.xlsx";

const headers = [
  "DIVISION",
  "SCHOOL NAME",
  "GRADE 1: READING AND LITERACY",
  "GRADE 1: LANGUAGE",
  "GRADE 1: GMRC",
  "GRADE 1: MAKABANSA",
  "GRADE 1: MATH",
  "GRADE 2: READING AND LITERACY",
  "GRADE 2: LANGUAGE",
  "GRADE 2: GMRC",
  "GRADE 2: MAKABANSA",
  "GRADE 2: MATH",
];

const subjectMappings = [
  {
    header: "GRADE 1: READING AND LITERACY",
    title: "Grade 1 - Reading and Literacy",
  },
  {
    header: "GRADE 1: READING AND LITERACY",
    title: "Grade 1 - Reading and Literacy ( Hiraya)",
  },
  {
    header: "GRADE 1: READING AND LITERACY",
    title: "Grade 1 - Reading and Literacy: HIRAYA",
  },
  {
    header: "GRADE 1: READING AND LITERACY",
    title: "Grade 1 - HIRaya",
  },
  { header: "GRADE 1: LANGUAGE", title: "Grade 1 - Language" },
  { header: "GRADE 1: LANGUAGE", title: "Grade 1 - Language IWika)" },
  { header: "GRADE 1: LANGUAGE", title: "Grade 1 - Wika" },
  { header: "GRADE 1: LANGUAGE", title: "Grade 1 - WIKA" },
  { header: "GRADE 1: GMRC", title: "Grade 1 - GMRC" },
  {
    header: "GRADE 1: GMRC",
    title: "Grade 1 - GMRC: Wastong Ugali, Tamang Gawi",
  },
  { header: "GRADE 1: MAKABANSA", title: "Grade 1 - Makabansa" },
  { header: "GRADE 1: MATH", title: "Grade 1 - Math" },
  { header: "GRADE 2: READING AND LITERACY", title: "Grade 2 - English" },
  {
    header: "GRADE 2: READING AND LITERACY",
    title: "Grade 2 - Reading and Literacy",
  },
  {
    header: "GRADE 2: LANGUAGE",
    title: "Grade 2 - Bridging Primer - Filipino",
  },
  {
    header: "GRADE 2: LANGUAGE",
    title:
      "Grade 2 - Bridging Primer 2 (Tagalog) Kontekstuwalisadong Kagamitan ng MAG-AARAL",
  },
  { header: "GRADE 2: LANGUAGE", title: "Grade 2 - Bridging Primer Tagalog" },
  { header: "GRADE 2: LANGUAGE", title: "Grade 2 - Filipino" },
  { header: "GRADE 2: LANGUAGE", title: "Grade 2 - Filipino TM" },
  { header: "GRADE 2: LANGUAGE", title: "Grade 2 - Filipino TX" },
  { header: "GRADE 2: LANGUAGE", title: "Grade 2 - Language" },
  { header: "GRADE 2: GMRC", title: "Grade 2 - GMRC" },
  { header: "GRADE 2: MAKABANSA", title: "Grade 2 - Makabansa" },
  { header: "GRADE 2: MATH", title: "Grade 2 - Math" },
];

function applyHeaderStyle(range) {
  range.format = {
    fill: "#1F4E78",
    font: { bold: true, color: "#FFFFFF" },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    wrapText: true,
  };
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  const payload = JSON.parse(await fs.readFile(inputPath, "utf8"));

  const workbook = Workbook.create();
  const sheet = workbook.worksheets.add("Consolidated");
  const mappingSheet = workbook.worksheets.add("Subject Mapping");
  const summarySheet = workbook.worksheets.add("Summary");

  sheet.showGridLines = false;
  mappingSheet.showGridLines = false;
  summarySheet.showGridLines = false;

  const lastRow = payload.rows.length + 1;

  sheet.getRange("A1:L1").values = [headers];
  sheet.getRange(`A2:A${lastRow}`).values = payload.rows.map((row) => [
    row.DIVISION ?? "",
  ]);
  sheet.getRange(`B2:B${lastRow}`).values = payload.rows.map((row) => [
    row["SCHOOL NAME"] ?? "",
  ]);
  sheet.getRange(`C2:C${lastRow}`).values = payload.rows.map((row) => [
    row["GRADE 1: READING AND LITERACY"] ?? "",
  ]);
  sheet.getRange(`D2:D${lastRow}`).values = payload.rows.map((row) => [
    row["GRADE 1: LANGUAGE"] ?? "",
  ]);
  sheet.getRange(`E2:E${lastRow}`).values = payload.rows.map((row) => [
    row["GRADE 1: GMRC"] ?? "",
  ]);
  sheet.getRange(`F2:F${lastRow}`).values = payload.rows.map((row) => [
    row["GRADE 1: MAKABANSA"] ?? "",
  ]);
  sheet.getRange(`G2:G${lastRow}`).values = payload.rows.map((row) => [
    row["GRADE 1: MATH"] ?? "",
  ]);
  sheet.getRange(`H2:H${lastRow}`).values = payload.rows.map((row) => [
    row["GRADE 2: READING AND LITERACY"] ?? "",
  ]);
  sheet.getRange(`I2:I${lastRow}`).values = payload.rows.map((row) => [
    row["GRADE 2: LANGUAGE"] ?? "",
  ]);
  sheet.getRange(`J2:J${lastRow}`).values = payload.rows.map((row) => [
    row["GRADE 2: GMRC"] ?? "",
  ]);
  sheet.getRange(`K2:K${lastRow}`).values = payload.rows.map((row) => [
    row["GRADE 2: MAKABANSA"] ?? "",
  ]);
  sheet.getRange(`L2:L${lastRow}`).values = payload.rows.map((row) => [
    row["GRADE 2: MATH"] ?? "",
  ]);
  applyHeaderStyle(sheet.getRange("A1:L1"));
  sheet.getRange("A1:L1").format.rowHeightPx = 40;
  sheet.freezePanes.freezeRows(1);
  sheet.freezePanes.freezeColumns(2);
  sheet.getRange(`A2:L${lastRow}`).format = {
    verticalAlignment: "center",
    wrapText: true,
  };
  sheet.getRange(`A1:A${lastRow}`).format.columnWidthPx = 120;
  sheet.getRange(`B1:B${lastRow}`).format.columnWidthPx = 280;
  sheet.getRange(`C1:L${lastRow}`).format.columnWidthPx = 170;
  sheet.getRange(`C2:L${lastRow}`).format.numberFormat = "0";
  sheet.getRange(`A2:L${lastRow}`).format.autofitRows();

  const mappingRows = [
    ["STANDARD HEADER", "SOURCE TITLE"],
    ...subjectMappings.map(({ header, title }) => [header, title]),
  ];
  const mappingLastRow = mappingRows.length;
  mappingSheet.getRange(`A1:B${mappingLastRow}`).values = mappingRows;
  applyHeaderStyle(mappingSheet.getRange("A1:B1"));
  mappingSheet.getRange(`A1:B${mappingLastRow}`).format.wrapText = true;
  mappingSheet.getRange(`A1:A${mappingLastRow}`).format.columnWidthPx = 280;
  mappingSheet.getRange(`B1:B${mappingLastRow}`).format.columnWidthPx = 520;
  mappingSheet.getRange(`A1:B${mappingLastRow}`).format.autofitRows();
  mappingSheet.freezePanes.freezeRows(1);

  summarySheet.getRange("A1:B9").values = [
    ["Metric", "Value"],
    ["Source root", payload.source_root],
    ["School files consolidated", payload.record_count],
    ["Files skipped", payload.skipped_count],
    [
      "Assumption",
      "Each subject cell stores the total Quantity of Textbooks Received for the mapped grade and subject.",
    ],
    ["Included grades", "Grade 1 and Grade 2"],
    ["Grade 1 columns", "5"],
    ["Grade 2 columns", "5"],
    ["Generated date", "2026-04-20"],
  ];
  applyHeaderStyle(summarySheet.getRange("A1:B1"));
  summarySheet.getRange("A1:B9").format.wrapText = true;
  summarySheet.getRange("A1:A9").format.columnWidthPx = 180;
  summarySheet.getRange("B1:B9").format.columnWidthPx = 560;
  summarySheet.getRange("A1:B9").format.autofitRows();

  const sampleInspect = await workbook.inspect({
    kind: "table",
    range: "Consolidated!A1:L8",
    include: "values",
    tableMaxRows: 8,
    tableMaxCols: 12,
  });
  console.log(sampleInspect.ndjson);

  const formulaErrors = await workbook.inspect({
    kind: "match",
    searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
    options: { useRegex: true, maxResults: 50 },
    summary: "formula error scan",
  });
  console.log(formulaErrors.ndjson);

  const consolidatedPreview = await workbook.render({
    sheetName: "Consolidated",
    range: "A1:L12",
    scale: 1,
    format: "png",
  });
  await fs.writeFile(
    path.join(outputDir, "consolidated-preview.png"),
    new Uint8Array(await consolidatedPreview.arrayBuffer()),
  );

  const summaryPreview = await workbook.render({
    sheetName: "Summary",
    autoCrop: "all",
    scale: 1,
    format: "png",
  });
  await fs.writeFile(
    path.join(outputDir, "summary-preview.png"),
    new Uint8Array(await summaryPreview.arrayBuffer()),
  );

  const xlsx = await SpreadsheetFile.exportXlsx(workbook);
  const outputPath = path.join(outputDir, outputFilename);
  await xlsx.save(outputPath);
  console.log(`Workbook saved to ${outputPath}`);
}

await main();
