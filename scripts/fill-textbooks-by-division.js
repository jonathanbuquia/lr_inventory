import fs from "fs";
import path from "path";
import XLSX from "xlsx";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const DATA_ROOT = path.join(ROOT, "public", "data", "divisions");
const INPUT_WORKBOOK =
  process.env.LR_TEMPLATE_INPUT ||
  "C:\\Users\\Jonathan Buquia\\Downloads\\SAMPLE DepEd-Regional-Data-Analysis_Data-Set-and-Templates.xlsx";
const OUTPUT_WORKBOOK =
  process.env.LR_TEMPLATE_OUTPUT ||
  "C:\\Users\\Jonathan Buquia\\Downloads\\SAMPLE DepEd-Regional-Data-Analysis_Data-Set-and-Templates_TEXTBOOKS_BY_DIVISION.xlsx";
const TEMPLATE_SHEET = "Textbooks";

const normalizeWhitespace = (value) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

const canonicalHeaderSubject = (value) => {
  const text = normalizeWhitespace(value).toUpperCase();

  if (text === "READING AND LITERACY") return "reading-and-literacy";
  if (text === "LANGUAGE") return "language";
  if (text === "MAKABANSA") return "makabansa";
  if (text.includes("GOOD MORAL")) return "gmrc";
  if (text === "ENGLISH") return "english";
  if (text === "FILIPINO") return "filipino";
  if (text === "MATHEMATICS" || text === "MATH") return "mathematics";
  if (text === "ARALING PANLIPUNAN" || text === "AP") return "araling-panlipunan";
  if (text === "SCIENCE") return "science";
  if (text === "MUSIC AND ARTS" || text === "MUSIC & ARTS") return "music-and-arts";
  if (text === "PHYSICAL EDUCATION AND HEALTH" || text === "PE AND HEALTH") return "pe-and-health";
  if (text.includes("EDUKASYONG PANTAHANAN") || text === "EPP" || text === "E.P.P.") return "epp";
  if (text.includes("TECHNOLOGY AND LIVELIHOOD EDUCATION") || text === "TLE") return "tle";

  return null;
};

const canonicalDataSubject = (value) => {
  const text = normalizeWhitespace(value).toUpperCase();
  if (!text) return null;

  if (text.includes("HIRAYA") || text.includes("READING AND LITERACY")) {
    return "reading-and-literacy";
  }

  if (text === "WIKA" || text.includes("WIKA") || text.startsWith("LANGUAGE")) {
    return "language";
  }

  if (
    text.includes("GOOD MORAL") ||
    text.includes("GMRC") ||
    text === "ESP" ||
    text === "E.S.P" ||
    text.includes("(ESP)") ||
    text === "VE" ||
    text === "VALUES EDUCATION"
  ) {
    return "gmrc";
  }

  if (text.includes("MAKABANSA")) return "makabansa";
  if (text.includes("BRIDGING PRIMER")) return "filipino";
  if (text.includes("NOLI") || text.includes("EL FILI") || text.includes("FILIBUSTERISMO")) {
    return "filipino";
  }
  if (text.includes("FILIPINO")) return "filipino";
  if (text.includes("ENGLISH")) return "english";
  if (text === "AP" || text.includes("ARALING PANLIPUNAN") || text.includes("PRIME-NCR-AP3")) {
    return "araling-panlipunan";
  }
  if (text.includes("SCIENCE")) return "science";
  if (text.includes("MUSIC") || text.includes("ARTS")) return "music-and-arts";
  if (text === "PE" || text.includes("PHYSICAL EDUCATION") || text.includes("HEALTH")) {
    return "pe-and-health";
  }
  if (text.includes("EPP") || text.includes("E.P.P")) return "epp";
  if (text.includes("TLE") || text.includes("TECHNOLOGY AND LIVELIHOOD EDUCATION")) {
    return "tle";
  }
  if (text.includes("MATH") || text.includes("MATHEMATICS")) return "mathematics";

  return null;
};

const parseHeader = (value) => {
  const header = normalizeWhitespace(value);
  if (header === "Division") return { kind: "division" };
  if (header === "School ID") return { kind: "school-id" };
  if (header === "School Name") return { kind: "school-name" };

  const match = header.match(/^Grade\s+(\d+)\s*-\s*(.+)$/i);
  if (!match) return null;

  return {
    kind: "subject",
    grade: String(Number(match[1])),
    subject: canonicalHeaderSubject(match[2]),
  };
};

const getQuantity = (row) => {
  const raw = row?.["Quantity of Textbooks Received"];
  if (raw === "" || raw === null || raw === undefined) return 0;
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : 0;
};

const gatherDivisionRows = () => {
  const divisionMap = new Map();

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
    const sheetName = String(schoolsList?.division?.name || divisionDir.name).slice(0, 31);
    const rows = [];

    for (const school of canonicalSchools) {
      const textbooksPath = path.join(schoolsRoot, school.id, "textbooks.json");
      if (!fs.existsSync(textbooksPath)) continue;

      const payload = JSON.parse(fs.readFileSync(textbooksPath, "utf8"));
      const division = payload?.division?.name || "";
      const schoolName = payload?.school?.name || "";
      const cells = new Map();

      for (const row of payload.rows || []) {
        const grade = String(row?.["Grade Level"] ?? "").trim().match(/^(\d+)$/)?.[1];
        const subject = canonicalDataSubject(row?.SUBJECTS);
        if (!grade || !subject) continue;

        const key = `${grade}|${subject}`;
        cells.set(key, (cells.get(key) || 0) + getQuantity(row));
      }

      rows.push({
        division,
        schoolId: "",
        schoolName,
        cells,
      });
    }

    rows.sort((a, b) => a.schoolName.localeCompare(b.schoolName));
    divisionMap.set(sheetName, rows);
  }

  return divisionMap;
};

const workbook = XLSX.readFile(INPUT_WORKBOOK, { cellDates: true });
const templateSheet = workbook.Sheets[TEMPLATE_SHEET];

if (!templateSheet) {
  throw new Error(`Sheet not found: ${TEMPLATE_SHEET}`);
}

const templateRows = XLSX.utils.sheet_to_json(templateSheet, { header: 1, defval: "" });
const headers = (templateRows[0] || []).map((value) => normalizeWhitespace(value));
const headerSpecs = headers.map(parseHeader);
const divisionRows = gatherDivisionRows();

for (const sheetName of workbook.SheetNames.filter((name) => name !== TEMPLATE_SHEET)) {
  delete workbook.Sheets[sheetName];
}
workbook.SheetNames = [TEMPLATE_SHEET];

for (const [divisionName, rows] of divisionRows.entries()) {
  const aoa = [headers];

  for (const school of rows) {
    aoa.push(
      headers.map((_, index) => {
        const spec = headerSpecs[index];
        if (!spec) return "";
        if (spec.kind === "division") return school.division;
        if (spec.kind === "school-id") return school.schoolId;
        if (spec.kind === "school-name") return school.schoolName;
        if (!spec.subject) return "";

        const value = school.cells.get(`${spec.grade}|${spec.subject}`);
        return value ?? "";
      })
    );
  }

  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  if (templateSheet["!cols"]) sheet["!cols"] = templateSheet["!cols"];
  if (templateSheet["!autofilter"]) sheet["!autofilter"] = templateSheet["!autofilter"];

  workbook.Sheets[divisionName] = sheet;
  if (!workbook.SheetNames.includes(divisionName)) {
    workbook.SheetNames.push(divisionName);
  }
}

delete workbook.Sheets[TEMPLATE_SHEET];
workbook.SheetNames = workbook.SheetNames.filter((name) => name !== TEMPLATE_SHEET);

XLSX.writeFile(workbook, OUTPUT_WORKBOOK);

console.log(`Filled workbook created: ${OUTPUT_WORKBOOK}`);
for (const [divisionName, rows] of divisionRows.entries()) {
  console.log(`${divisionName}: ${rows.length} schools`);
}
