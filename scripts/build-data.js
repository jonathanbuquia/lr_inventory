import fs from "fs";
import path from "path";
import XLSX from "xlsx";
import { fileURLToPath } from "url";

// __dirname fix for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== CONFIG =====
const ROOT = path.resolve(__dirname, "..");
const INPUT_DIR = path.join(ROOT, "excel-files");
const OUTPUT_DIR = path.join(ROOT, "public", "data");

const SHEETS = [
  { key: "textbooks", name: "TextBooks", headerRowIndex: 0 }, // row 1
  { key: "las", name: "LAS", headerRowIndex: 1 },             // row 2
  { key: "adm-slm", name: "ADM-SLM", headerRowIndex: 1 },     // row 2
];

// ===== UTILS =====
const ensureDir = (p) => fs.mkdirSync(p, { recursive: true });
const warn = (msg) => console.warn(`⚠️  ${msg}`);
const ok = (msg) => console.log(`✅ ${msg}`);
const info = (msg) => console.log(`ℹ️  ${msg}`);

const isExcel = (name) => /\.(xlsx|xlsm|xls)$/i.test(name);

const slugify = (s) =>
  String(s)
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

function parseSheet(workbook, sheetName, headerRowIndex, ctx) {
  const ws = workbook.Sheets[sheetName];
  if (!ws) {
    warn(`[${ctx}] Missing sheet: ${sheetName}`);
    return [];
  }

  const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  const headerRow = matrix[headerRowIndex];

  if (!headerRow || headerRow.every((x) => String(x).trim() === "")) {
    warn(`[${ctx}] Header row not found at index ${headerRowIndex} for sheet ${sheetName}`);
    return [];
  }

  const headers = headerRow.map((h) => String(h || "").trim());
  const dataRows = matrix.slice(headerRowIndex + 1);

  return dataRows
    .map((r) => {
      const obj = {};
      headers.forEach((h, i) => {
        if (!h) return;
        obj[h] = r?.[i] ?? "";
      });
      return obj;
    })
    .filter((obj) =>
      Object.values(obj).some((v) => String(v).trim() !== "")
    );
}

function writeJSON(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function readJSONIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (e) {
    warn(`Failed to read existing JSON: ${filePath} (${e.message})`);
    return null;
  }
}

function normalizeValue(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function stripGeneratedAt(data) {
  if (!data) return null;
  const copy = JSON.parse(JSON.stringify(data));
  delete copy.generatedAt;
  return copy;
}

function compareRows(oldRows = [], newRows = []) {
  const maxLen = Math.max(oldRows.length, newRows.length);

  let addedRows = 0;
  let removedRows = 0;
  let modifiedRows = 0;
  let changedCells = 0;

  const samples = [];

  for (let i = 0; i < maxLen; i++) {
    const oldRow = oldRows[i];
    const newRow = newRows[i];

    if (!oldRow && newRow) {
      addedRows++;
      if (samples.length < 8) {
        samples.push(`Row ${i + 1}: added`);
      }
      continue;
    }

    if (oldRow && !newRow) {
      removedRows++;
      if (samples.length < 8) {
        samples.push(`Row ${i + 1}: removed`);
      }
      continue;
    }

    const allKeys = new Set([
      ...Object.keys(oldRow || {}),
      ...Object.keys(newRow || {}),
    ]);

    let rowChanged = false;

    for (const key of allKeys) {
      const oldVal = normalizeValue(oldRow?.[key]);
      const newVal = normalizeValue(newRow?.[key]);

      if (oldVal !== newVal) {
        changedCells++;
        rowChanged = true;

        if (samples.length < 8) {
          samples.push(
            `Row ${i + 1}, "${key}": "${oldVal}" -> "${newVal}"`
          );
        }
      }
    }

    if (rowChanged) {
      modifiedRows++;
    }
  }

  return {
    addedRows,
    removedRows,
    modifiedRows,
    changedCells,
    samples,
  };
}

function comparePayload(oldData, newData) {
  if (!oldData) {
    return {
      status: "NEW",
      summary: "File did not exist before.",
      details: null,
    };
  }

  const oldStripped = stripGeneratedAt(oldData);
  const newStripped = stripGeneratedAt(newData);

  const oldString = JSON.stringify(oldStripped);
  const newString = JSON.stringify(newStripped);

  if (oldString === newString) {
    return {
      status: "UNCHANGED",
      summary: "No content change.",
      details: null,
    };
  }

  const details = compareRows(oldStripped?.rows || [], newStripped?.rows || []);

  return {
    status: "UPDATED",
    summary:
      `Rows added: ${details.addedRows}, removed: ${details.removedRows}, ` +
      `modified rows: ${details.modifiedRows}, changed cells: ${details.changedCells}`,
    details,
  };
}

// ===== MAIN =====
function build() {
  if (!fs.existsSync(INPUT_DIR)) {
    console.error(`❌ Folder not found: ${INPUT_DIR}`);
    process.exit(1);
  }

  ensureDir(OUTPUT_DIR);

  const divisionDirs = fs
    .readdirSync(INPUT_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory());

  const index = { divisions: [] };

  const report = {
    newFiles: 0,
    updatedFiles: 0,
  };

  for (const div of divisionDirs) {
    const divisionName = div.name;
    const divisionSlug = slugify(divisionName);
    const divisionPath = path.join(INPUT_DIR, divisionName);

    const outDivDir = path.join(OUTPUT_DIR, "divisions", divisionSlug);
    const outSchoolsDir = path.join(outDivDir, "schools");

    ensureDir(outSchoolsDir);

    const files = fs.readdirSync(divisionPath).filter(isExcel);

    index.divisions.push({
      slug: divisionSlug,
      name: divisionName,
      schoolCount: files.length,
    });

    const schoolsList = {
      division: { slug: divisionSlug, name: divisionName },
      schools: [],
    };

    info(`Processing division: ${divisionName}`);

    for (const file of files) {
      const schoolName = file.replace(/\.(xlsx|xlsm|xls)$/i, "");
      const schoolId = slugify(schoolName);

      schoolsList.schools.push({ id: schoolId, name: schoolName });

      const filePath = path.join(divisionPath, file);
      const ctx = `${divisionName} - ${file}`;

      let workbook;
      try {
        workbook = XLSX.readFile(filePath, { cellDates: true });
      } catch (e) {
        warn(`[${ctx}] Failed to read Excel (${e.message})`);
        continue;
      }

      const outSchoolDir = path.join(outSchoolsDir, schoolId);
      ensureDir(outSchoolDir);

      for (const rule of SHEETS) {
        const rows = parseSheet(workbook, rule.name, rule.headerRowIndex, ctx);

        const outFilePath = path.join(outSchoolDir, `${rule.key}.json`);

        const newPayload = {
          division: { slug: divisionSlug, name: divisionName },
          school: { id: schoolId, name: schoolName },
          sheet: rule.name,
          key: rule.key,
          rows,
          generatedAt: new Date().toISOString(),
        };

        const oldPayload = readJSONIfExists(outFilePath);
        const comparison = comparePayload(oldPayload, newPayload);

        writeJSON(outFilePath, newPayload);

        if (comparison.status === "NEW") {
          report.newFiles++;
          console.log(`🆕 NEW: ${divisionName} / ${schoolName} / ${rule.key}.json`);
        } else if (comparison.status === "UPDATED") {
          report.updatedFiles++;
          console.log(`📝 UPDATED: ${divisionName} / ${schoolName} / ${rule.key}.json`);
          console.log(`   ${comparison.summary}`);

          if (comparison.details?.samples?.length) {
            comparison.details.samples.forEach((sample) => {
              console.log(`   - ${sample}`);
            });
          }
        }
      }
    }

    writeJSON(path.join(outDivDir, "schools.json"), schoolsList);

    ok(`Built division: ${divisionName}`);
  }

  writeJSON(path.join(OUTPUT_DIR, "index.json"), index);

  console.log("\n================ BUILD SUMMARY ================");
  console.log(`🆕 New files     : ${report.newFiles}`);
  console.log(`📝 Updated files : ${report.updatedFiles}`);
  console.log("==============================================\n");

  ok("DONE. Data generated successfully.");
}

build();