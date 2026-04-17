import fs from "fs";
import path from "path";
import XLSX from "xlsx";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const DATA_ROOT = path.join(ROOT, "public", "data", "divisions");
const OUTPUT_WORKBOOK =
  process.env.LR_TEMPLATE_OUTPUT ||
  "C:\\Users\\Jonathan Buquia\\Downloads\\TEXTBOOKS_ALL_SUBJECTS_GRADES_1_TO_10.xlsx";
const TARGET_GRADES = new Set(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);

const normalizeWhitespace = (value) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

const gradeValue = (value) => {
  const text = normalizeWhitespace(value);
  const direct = text.match(/^(\d+)$/);
  if (direct) return direct[1];

  const prefixed = text.match(/^Grade\s+(\d+)$/i);
  return prefixed?.[1] || null;
};

const getQuantity = (row) => {
  const raw = row?.["Quantity of Textbooks Received"];
  if (raw === "" || raw === null || raw === undefined) return 0;
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : 0;
};

const gatherSchoolRows = () => {
  const subjectColumns = new Map();
  const schoolRows = [];

  const divisionDirs = fs
    .readdirSync(DATA_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const divisionDir of divisionDirs) {
    const schoolsRoot = path.join(DATA_ROOT, divisionDir.name, "schools");
    const schoolsListPath = path.join(DATA_ROOT, divisionDir.name, "schools.json");
    if (!fs.existsSync(schoolsRoot) || !fs.existsSync(schoolsListPath)) continue;

    const schoolsList = JSON.parse(fs.readFileSync(schoolsListPath, "utf8"));
    const canonicalSchools = Array.isArray(schoolsList?.schools) ? schoolsList.schools : [];

    for (const school of canonicalSchools) {
      const textbooksPath = path.join(schoolsRoot, school.id, "textbooks.json");
      if (!fs.existsSync(textbooksPath)) continue;

      const payload = JSON.parse(fs.readFileSync(textbooksPath, "utf8"));
      const division = payload?.division?.name || "";
      const schoolName = payload?.school?.name || "";
      const cells = new Map();

      for (const row of payload.rows || []) {
        const grade = gradeValue(row?.["Grade Level"]);
        if (!grade || !TARGET_GRADES.has(grade)) continue;

        const subject = normalizeWhitespace(row?.SUBJECTS);
        if (!subject) continue;

        const columnKey = `${grade}|${subject}`;
        subjectColumns.set(columnKey, { grade, subject });
        cells.set(columnKey, (cells.get(columnKey) || 0) + getQuantity(row));
      }

      schoolRows.push({
        division,
        schoolId: "",
        schoolName,
        cells,
      });
    }
  }

  schoolRows.sort((a, b) =>
    a.division.localeCompare(b.division) || a.schoolName.localeCompare(b.schoolName)
  );

  const orderedColumns = [...subjectColumns.values()].sort((a, b) => {
    const gradeDiff = Number(a.grade) - Number(b.grade);
    if (gradeDiff !== 0) return gradeDiff;
    return a.subject.localeCompare(b.subject);
  });

  return { schoolRows, orderedColumns };
};

const { schoolRows, orderedColumns } = gatherSchoolRows();

const headers = [
  "Division",
  "School ID",
  "School Name",
  ...orderedColumns.map((column) => `Grade ${column.grade} - ${column.subject}`),
];

const aoa = [headers];

for (const school of schoolRows) {
  aoa.push([
    school.division,
    school.schoolId,
    school.schoolName,
    ...orderedColumns.map((column) => school.cells.get(`${column.grade}|${column.subject}`) ?? ""),
  ]);
}

const sheet = XLSX.utils.aoa_to_sheet(aoa);
sheet["!autofilter"] = {
  ref: XLSX.utils.encode_range({
    s: { c: 0, r: 0 },
    e: { c: headers.length - 1, r: schoolRows.length },
  }),
};

const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, sheet, "Textbooks");
XLSX.writeFile(workbook, OUTPUT_WORKBOOK);

console.log(`Created workbook: ${OUTPUT_WORKBOOK}`);
console.log(`Schools written: ${schoolRows.length}`);
console.log(`Subject columns: ${orderedColumns.length}`);
