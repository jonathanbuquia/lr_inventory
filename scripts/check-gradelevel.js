import fs from "fs";
import path from "path";
import XLSX from "xlsx";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, "..");
const INPUT_DIR = path.join(ROOT, "excel-files");

// Sheet config based on your project rules
const SHEETS = [
  { name: "TextBooks", headerRowIndex: 0 }, // row 1
  { name: "LAS", headerRowIndex: 1 },       // row 2
  { name: "ADM-SLM", headerRowIndex: 1 },   // row 2
];

// Recursively get Excel files
const getAllExcelFiles = (dirPath) => {
  let results = [];

  const list = fs.readdirSync(dirPath);

  list.forEach((file) => {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);

    if (stat && stat.isDirectory()) {
      results = results.concat(getAllExcelFiles(filePath));
    } else if (file.endsWith(".xlsx") || file.endsWith(".xls")) {
      results.push(filePath);
    }
  });

  return results;
};

const isInvalidGrade = (grade) => {
  if (!grade) return false;

  // Skip KINDER
  if (
    typeof grade === "string" &&
    grade.trim().toUpperCase() === "KINDER"
  ) {
    return false;
  }

  // Valid if number
  if (typeof grade === "number") return false;

  // Valid if numeric string
  if (!isNaN(Number(grade))) return false;

  return true;
};

const runCheck = () => {
  console.log("🔎 Checking GradeLevel in ALL sheets...\n");

  const excelFiles = getAllExcelFiles(INPUT_DIR);

  excelFiles.forEach((filePath) => {
    const workbook = XLSX.readFile(filePath);

    SHEETS.forEach(({ name, headerRowIndex }) => {
      if (!workbook.SheetNames.includes(name)) return;

      const worksheet = workbook.Sheets[name];

      const data = XLSX.utils.sheet_to_json(worksheet, {
        range: headerRowIndex,
        defval: "",
      });

      const invalidRows = data.filter((row) =>
        isInvalidGrade(row.GradeLevel)
      );

      if (invalidRows.length > 0) {
        console.log("❌ INVALID GRADE LEVEL FOUND:");
        console.log(`School File: ${filePath}`);
        console.log(`Sheet: ${name}`);

        invalidRows.forEach((row, index) => {
          console.log(
            `   Row ${index + 1} → GradeLevel: "${row.GradeLevel}"`
          );
        });

        console.log("---------------------------------------------------\n");
      }
    });
  });

  console.log("✅ Checking finished.\n");
};

runCheck();