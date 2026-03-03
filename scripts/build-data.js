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

        writeJSON(path.join(outSchoolDir, `${rule.key}.json`), {
          division: { slug: divisionSlug, name: divisionName },
          school: { id: schoolId, name: schoolName },
          sheet: rule.name,
          key: rule.key,
          rows,
          generatedAt: new Date().toISOString(),
        });
      }
    }

    writeJSON(path.join(outDivDir, "schools.json"), schoolsList);

    ok(`Built division: ${divisionName}`);
  }

  writeJSON(path.join(OUTPUT_DIR, "index.json"), index);

  ok("DONE. Data generated successfully.");
}

build();