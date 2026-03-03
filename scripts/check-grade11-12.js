import fs from "fs";
import path from "path";
import XLSX from "xlsx";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, "..");
const INPUT_DIR = path.join(ROOT, "excel-files");

const SHEETS = [
  { name: "TextBooks", headerRowIndex: 0 },
  { name: "LAS", headerRowIndex: 1 },
  { name: "ADM-SLM", headerRowIndex: 1 },
];

// Get all excel files recursively
const getAllExcelFiles = (dirPath) => {
  let results = [];
  const list = fs.readdirSync(dirPath);

  list.forEach((file) => {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      results = results.concat(getAllExcelFiles(filePath));
    } else if (file.endsWith(".xlsx") || file.endsWith(".xls")) {
      results.push(filePath);
    }
  });

  return results;
};

const normalizeHeader = (h) =>
  String(h ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");

const parseGradeLevel = (val) => {
  if (!val) return null;

  if (typeof val === "number") return val;

  const s = String(val).trim();

  if (s.toUpperCase() === "KINDER") return null;

  if (!isNaN(Number(s))) return Number(s);

  const match = s.match(/\b(\d{1,2})\b/);
  if (match) return Number(match[1]);

  return null;
};

const run = () => {
  console.log("🔎 SUMMARY: Schools with Grade 11 or 12\n");

  const files = getAllExcelFiles(INPUT_DIR);

  const results = [];

  files.forEach((filePath) => {
    const workbook = XLSX.readFile(filePath);

    // Extract division + school from folder structure
    const relativePath = path.relative(INPUT_DIR, filePath);
    const parts = relativePath.split(path.sep);

    const division = parts[0];
    const schoolName = path.basename(filePath, path.extname(filePath));

    SHEETS.forEach(({ name, headerRowIndex }) => {
      if (!workbook.SheetNames.includes(name)) return;

      const ws = workbook.Sheets[name];

      const rows = XLSX.utils.sheet_to_json(ws, {
        range: headerRowIndex,
        header: 1,
        defval: "",
      });

      if (!rows.length) return;

      const headers = rows[0];
      const gradeColIndex = headers.findIndex((h) =>
        normalizeHeader(h).includes("GRADELEVEL")
      );

      if (gradeColIndex === -1) return;

      let foundSHS = false;

      for (let i = 1; i < rows.length; i++) {
        const gradeRaw = rows[i][gradeColIndex];
        const grade = parseGradeLevel(gradeRaw);

        if (grade === 11 || grade === 12) {
          foundSHS = true;
          break;
        }
      }

      if (foundSHS) {
        results.push({
          division,
          schoolName,
          sheet: name,
        });
      }
    });
  });

  if (results.length === 0) {
    console.log("✅ No schools found with Grade 11 or 12.\n");
    return;
  }

  results.forEach((r) => {
    console.log(
      `Division: ${r.division} | School: ${r.schoolName} | Sheet: ${r.sheet}`
    );
  });

  console.log("\n----------------------------------------");
  console.log(`Total Schools/Sheets with SHS: ${results.length}\n`);
};

run();