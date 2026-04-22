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
  "grade1-subject-template-20260420",
);

const templateHeaders = [
  "DIVISION",
  "SCHOOL NAME",
  "GRADE 1: READING AND LITERACY",
  "GRADE 1: LANGUAGE",
  "GRADE 1: GMRC",
  "GRADE 1: MAKABANSA",
  "GRADE 1: MATH",
];

const mappings = [
  {
    title: "GRADE 1: READING AND LITERACY",
    variants: [
      "Grade 1 - Reading and Literacy",
      "Grade 1 - Reading and Literacy ( Hiraya)",
      "Grade 1 - Reading and Literacy: HIRAYA",
      "Grade 1 - HIRaya",
    ],
  },
  {
    title: "GRADE 1: LANGUAGE",
    variants: [
      "Grade 1 - Language",
      "Grade 1 - Language IWika)",
      "Grade 1 - Wika",
      "Grade 1 - WIKA",
    ],
  },
  {
    title: "GRADE 1: GMRC",
    variants: [
      "Grade 1 - GMRC",
      "Grade 1 - GMRC: Wastong Ugali, Tamang Gawi",
    ],
  },
  {
    title: "GRADE 1: MAKABANSA",
    variants: ["Grade 1 - Makabansa"],
  },
  {
    title: "GRADE 1: MATH",
    variants: ["Grade 1 - Math"],
  },
];

function buildMappingMatrix() {
  const longest = Math.max(...mappings.map((entry) => entry.variants.length));
  const rows = [];

  rows.push(mappings.map((entry) => entry.title));
  for (let i = 0; i < longest; i += 1) {
    rows.push(mappings.map((entry) => entry.variants[i] ?? null));
  }

  return rows;
}

function styleHeader(range) {
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

  const workbook = Workbook.create();
  const templateSheet = workbook.worksheets.add("Template");
  const mappingSheet = workbook.worksheets.add("Subject Mapping");

  templateSheet.showGridLines = false;
  mappingSheet.showGridLines = false;

  templateSheet.getRange("A1:G1").values = [templateHeaders];
  styleHeader(templateSheet.getRange("A1:G1"));
  templateSheet.getRange("A1:G1").format.rowHeightPx = 34;
  templateSheet.freezePanes.freezeRows(1);
  templateSheet.freezePanes.freezeColumns(2);

  templateSheet.getRange("A1:A30").format.columnWidthPx = 120;
  templateSheet.getRange("B1:B30").format.columnWidthPx = 220;
  templateSheet.getRange("C1:C30").format.columnWidthPx = 230;
  templateSheet.getRange("D1:D30").format.columnWidthPx = 180;
  templateSheet.getRange("E1:E30").format.columnWidthPx = 140;
  templateSheet.getRange("F1:F30").format.columnWidthPx = 150;
  templateSheet.getRange("G1:G30").format.columnWidthPx = 120;
  templateSheet.getRange("A2:G30").format = {
    verticalAlignment: "center",
  };

  const mappingMatrix = buildMappingMatrix();
  const mappingLastRow = mappingMatrix.length;
  const mappingRange = `A1:E${mappingLastRow}`;
  mappingSheet.getRange(mappingRange).values = mappingMatrix;
  styleHeader(mappingSheet.getRange("A1:E1"));
  mappingSheet.getRange("A1:E1").format.rowHeightPx = 36;
  mappingSheet.freezePanes.freezeRows(1);

  mappingSheet.getRange(`A1:E${mappingLastRow}`).format.wrapText = true;
  mappingSheet.getRange(`A1:A${mappingLastRow}`).format.columnWidthPx = 280;
  mappingSheet.getRange(`B1:B${mappingLastRow}`).format.columnWidthPx = 240;
  mappingSheet.getRange(`C1:C${mappingLastRow}`).format.columnWidthPx = 260;
  mappingSheet.getRange(`D1:D${mappingLastRow}`).format.columnWidthPx = 190;
  mappingSheet.getRange(`E1:E${mappingLastRow}`).format.columnWidthPx = 130;
  mappingSheet.getRange(`A1:E${mappingLastRow}`).format.autofitRows();

  const templateCheck = await workbook.inspect({
    kind: "table",
    range: "Template!A1:G6",
    include: "values",
    tableMaxRows: 6,
    tableMaxCols: 7,
  });
  console.log(templateCheck.ndjson);

  const mappingCheck = await workbook.inspect({
    kind: "table",
    range: `Subject Mapping!A1:E${mappingLastRow}`,
    include: "values",
    tableMaxRows: mappingLastRow,
    tableMaxCols: 5,
  });
  console.log(mappingCheck.ndjson);

  const formulaErrors = await workbook.inspect({
    kind: "match",
    searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
    options: { useRegex: true, maxResults: 50 },
    summary: "formula error scan",
  });
  console.log(formulaErrors.ndjson);

  const templatePreview = await workbook.render({
    sheetName: "Template",
    autoCrop: "all",
    scale: 1,
    format: "png",
  });
  await fs.writeFile(
    path.join(outputDir, "template-preview.png"),
    new Uint8Array(await templatePreview.arrayBuffer()),
  );

  const mappingPreview = await workbook.render({
    sheetName: "Subject Mapping",
    autoCrop: "all",
    scale: 1,
    format: "png",
  });
  await fs.writeFile(
    path.join(outputDir, "subject-mapping-preview.png"),
    new Uint8Array(await mappingPreview.arrayBuffer()),
  );

  const xlsx = await SpreadsheetFile.exportXlsx(workbook);
  const outputPath = path.join(outputDir, "grade1_subject_template.xlsx");
  await xlsx.save(outputPath);
  console.log(`Workbook saved to ${outputPath}`);
}

await main();
