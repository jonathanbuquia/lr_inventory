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
  "full-consolidation-20260420",
);
const inputPath = path.join(outputDir, "consolidation_dataset.json");
const outputPath = path.join(outputDir, "CONSOLIDATION.xlsx");

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
  const headers = payload.headers;
  const lastRow = payload.rows.length + 1;
  const lastCol = headers.length;

  const workbook = Workbook.create();
  const sheet = workbook.worksheets.add("Consolidation");
  const summarySheet = workbook.worksheets.add("Summary");

  sheet.showGridLines = false;
  summarySheet.showGridLines = false;

  const endColumnLetter = sheet.getRangeByIndexes(0, lastCol - 1, 1, 1).address
    .split(":")
    .pop()
    .replace(/\d+/g, "");

  sheet.getRangeByIndexes(0, 0, 1, lastCol).values = [headers];
  applyHeaderStyle(sheet.getRangeByIndexes(0, 0, 1, lastCol));
  sheet.getRange(`A1:${endColumnLetter}1`).format.rowHeightPx = 42;
  sheet.freezePanes.freezeRows(1);
  sheet.freezePanes.freezeColumns(2);

  headers.forEach((header, index) => {
    const columnValues = payload.rows.map((row) => [row[header] ?? ""]);
    sheet.getRangeByIndexes(1, index, payload.rows.length, 1).values = columnValues;
  });

  sheet.getRange(`A2:${endColumnLetter}${lastRow}`).format = {
    verticalAlignment: "center",
    wrapText: true,
  };
  sheet.getRange(`A1:A${lastRow}`).format.columnWidthPx = 120;
  sheet.getRange(`B1:B${lastRow}`).format.columnWidthPx = 300;
  if (lastCol > 2) {
    sheet.getRangeByIndexes(0, 2, lastRow, lastCol - 2).format.columnWidthPx = 125;
    sheet.getRangeByIndexes(1, 2, payload.rows.length, lastCol - 2).format.numberFormat =
      "0";
  }
  sheet.getRange(`A2:B${lastRow}`).format.autofitRows();

  summarySheet.getRange("A1:B8").values = [
    ["Metric", "Value"],
    ["Source root", payload.source_root],
    ["School files consolidated", payload.record_count],
    ["Files skipped", payload.skipped_count],
    ["Generated columns", headers.length],
    ["First data column", headers[2] ?? ""],
    ["Last data column", headers.at(-1) ?? ""],
    ["Generated date", "2026-04-20"],
  ];
  applyHeaderStyle(summarySheet.getRange("A1:B1"));
  summarySheet.getRange("A1:B8").format.wrapText = true;
  summarySheet.getRange("A1:A8").format.columnWidthPx = 190;
  summarySheet.getRange("B1:B8").format.columnWidthPx = 560;
  summarySheet.getRange("A1:B8").format.autofitRows();

  const sampleInspect = await workbook.inspect({
    kind: "table",
    range: `Consolidation!A1:${endColumnLetter}8`,
    include: "values",
    tableMaxRows: 8,
    tableMaxCols: Math.min(lastCol, 14),
  });
  console.log(sampleInspect.ndjson);

  const formulaErrors = await workbook.inspect({
    kind: "match",
    searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
    options: { useRegex: true, maxResults: 50 },
    summary: "formula error scan",
  });
  console.log(formulaErrors.ndjson);

  const previewEndCol = sheet
    .getRangeByIndexes(0, Math.min(lastCol, 14) - 1, 1, 1)
    .address.split(":")
    .pop()
    .replace(/\d+/g, "");
  const preview = await workbook.render({
    sheetName: "Consolidation",
    range: `A1:${previewEndCol}10`,
    scale: 1,
    format: "png",
  });
  await fs.writeFile(
    path.join(outputDir, "consolidation-preview.png"),
    new Uint8Array(await preview.arrayBuffer()),
  );

  const xlsx = await SpreadsheetFile.exportXlsx(workbook);
  await xlsx.save(outputPath);
  console.log(`Workbook saved to ${outputPath}`);
}

await main();
