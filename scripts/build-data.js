import fs from "fs";
import path from "path";
import XLSX from "xlsx";
import { fileURLToPath } from "url";
import {
  canonicalizeRegionalTextbookSubject,
  createRegionalEnrollmentTotals,
  createRegionalTextbookDeliveryByYearTotals,
  createRegionalTextbookDeliveryTotals,
  getRegionalTextbookDeliveredTotal,
  normalizeRegionalTextbookGrade,
  REGIONAL_TEXTBOOK_DELIVERY_GRADES,
  REGIONAL_TEXTBOOK_DELIVERY_PHASES,
  REGIONAL_TEXTBOOK_DELIVERY_YEARS,
} from "../src/utils/regionalTextbookDelivery.js";

// __dirname fix for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== CONFIG =====
const ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(ROOT, "public", "data");
const REGIONAL_ENROLLMENT_OVERRIDE_PATH = path.join(
  OUTPUT_DIR,
  "regional-textbook-enrollment-overrides.json"
);
const BASELINE_DELIVERY_WORKBOOKS = [
  path.join(ROOT, "..", "..", "GRADES 1 4 7 2024-2026 DELIVERY.xlsx"),
  path.join(ROOT, "..", "..", "GRADES 2 3 5 8 2024-2026 DELIVERY.xlsx"),
  path.join(ROOT, "..", "..", "GRADES 6 9 10 2024-2026 DELIVERY.xlsx"),
];
const DEFAULT_LOCAL_INPUT_DIR = path.join(ROOT, "excel-files");
const DEFAULT_ONEDRIVE_INPUT_DIR =
  "C:\\Users\\Jonathan Buquia\\OneDrive - Department of Education\\SAMPLE CONSOLIDATED FOLDER";
const INPUT_DIR =
  process.env.LR_INPUT_DIR ||
  (fs.existsSync(DEFAULT_ONEDRIVE_INPUT_DIR)
    ? DEFAULT_ONEDRIVE_INPUT_DIR
    : DEFAULT_LOCAL_INPUT_DIR);

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

const normalizeWhitespace = (s) =>
  String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();

const TEXTBOOK_2026_SUFFIX = "S.Y. 2026-2027";
const TEXTBOOK_2026_FOLLOWUP_HEADERS = new Set([
  "Quantity of Textbooks Received",
  "Year of Delivery-TX",
  "Year of Delivery - TX",
  "SOURCE-TX (CO,RO, SDO)",
  "GAP-TX",
  "Gap-TX",
  "Surplus-TX",
  "SURPLUS-TX",
]);

const normalizeHeaderText = (value) =>
  normalizeWhitespace(value).replace(/[–—]/g, "-").toUpperCase();

const isTextbook2026EnrollmentHeader = (value) =>
  normalizeHeaderText(value) === "ENROLMENT S.Y. 2026-2027" ||
  normalizeHeaderText(value) === "ENROLLMENT S.Y. 2026-2027";

const canonicalizeTextbook2026FollowupHeader = (header) => {
  const normalized = normalizeHeaderText(header);

  if (normalized.startsWith("QUANTITY OF TEXTBOOKS RECEIVED")) {
    return "Quantity of Textbooks Received";
  }

  return (
    Array.from(TEXTBOOK_2026_FOLLOWUP_HEADERS).find(
      (candidate) => normalizeHeaderText(candidate) === normalized
    ) || null
  );
};

const withTextbook2026Suffix = (header) => `${header} ${TEXTBOOK_2026_SUFFIX}`;

const toNumber = (value) => {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isNaN(parsed) ? 0 : parsed;
};

const pickFirstPositiveNumber = (...values) => {
  for (const value of values) {
    const numeric = toNumber(value);
    if (numeric > 0) return numeric;
  }

  return 0;
};

const slugify = (s) =>
  String(s)
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const DIVISION_FILTERS = String(process.env.LR_DIVISION_FILTER || "")
  .split(",")
  .map((value) => slugify(value))
  .filter(Boolean);

const normalizeHeader = (value) =>
  String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");

const isGradeHeader = (value) => {
  const normalized = normalizeHeader(value);
  return normalized === "GRADELEVEL" || normalized === "GRADE";
};

const expandSchoolShortcut = (name, shortcut, fullText) =>
  String(name ?? "").replace(
    new RegExp(`(^|[^A-Z0-9])${shortcut}(?=[^A-Z0-9]|$)`, "gi"),
    (_, prefix) => `${prefix}${fullText}`
  );

const normalizeSchoolName = (name) =>
  normalizeWhitespace(
    ["SHS", "ES", "HS"].reduce((result, shortcut) => {
      const expansions = {
        SHS: "SENIOR HIGH SCHOOL",
        ES: "ELEMENTARY SCHOOL",
        HS: "HIGH SCHOOL",
      };
      return expandSchoolShortcut(result, shortcut, expansions[shortcut]);
    }, String(name ?? ""))
  );

const isSeniorHighSchoolName = (name) =>
  /\bSENIOR HIGH SCHOOL\b/i.test(normalizeSchoolName(name));

const findGradeKey = (rows = []) => {
  const sample = rows.find((row) => row && typeof row === "object");
  if (!sample) return null;

  return (
    Object.keys(sample).find((key) => {
      const normalized = normalizeHeader(key);
      return normalized === "GRADELEVEL" || normalized === "GRADE";
    }) || null
  );
};

const isSeniorHighGradeValue = (value) => {
  const tokens = String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return (
    tokens.includes("SHS") ||
    tokens.includes("11") ||
    tokens.includes("12") ||
    tokens.includes("G11") ||
    tokens.includes("G12")
  );
};

const filterSeniorHighRows = (rows = []) => {
  const gradeKey = findGradeKey(rows);
  if (!gradeKey) return rows;

  return rows.filter((row) => isSeniorHighGradeValue(row?.[gradeKey]));
};

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

  const rawHeaders = headerRow.map((h) => normalizeWhitespace(h));
  const textbook2026StartIndex =
    sheetName === "TextBooks"
      ? rawHeaders.findIndex(isTextbook2026EnrollmentHeader)
      : -1;
  const headers = rawHeaders.map((header, index) => {
    const canonical2026Header = canonicalizeTextbook2026FollowupHeader(header);

    if (
      textbook2026StartIndex >= 0 &&
      index > textbook2026StartIndex &&
      canonical2026Header
    ) {
      return withTextbook2026Suffix(canonical2026Header);
    }

    return header;
  });
  const dataRows = matrix.slice(headerRowIndex + 1);

  return dataRows
    .map((r) => {
      const obj = {};
      headers.forEach((h, i) => {
        if (!h) return;
        const nextValue = r?.[i] ?? "";
        const currentValue = obj[h];

        if (currentValue === undefined) {
          obj[h] = nextValue;
          return;
        }

        // Some TextBooks sheets repeat the same headers in later blank columns.
        // Keep the first populated value instead of overwriting it with blanks.
        if (
          String(currentValue).trim() === "" &&
          String(nextValue).trim() !== ""
        ) {
          obj[h] = nextValue;
        }
      });
      return obj;
    })
    .filter((obj) => {
      const entries = Object.entries(obj);

      if (!entries.some(([, value]) => String(value).trim() !== "")) {
        return false;
      }

      // Some workbooks contain stray rows where only the grade cell is filled
      // and every other column is blank. Those should not become real data rows.
      const nonGradeEntries = entries.filter(([key]) => !isGradeHeader(key));
      return nonGradeEntries.some(([, value]) => String(value).trim() !== "");
    });
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

function createRegionalDivisionSummary(divisionSlug, divisionName) {
  return {
    slug: divisionSlug,
    name: divisionName,
    totals: createRegionalTextbookDeliveryTotals(),
    deliveryByYear: createRegionalTextbookDeliveryByYearTotals(),
    enrollmentByGrade: createRegionalEnrollmentTotals(),
    enrollmentTotal: 0,
    deliveredTotal: 0,
    deliveryPercentage: 0,
    schools: [],
  };
}

function getRegionalEnrollmentValue(row) {
  return pickFirstPositiveNumber(
    row?.["Enrolment S.Y. 2026-2027"],
    row?.["Enrollment S.Y. 2026-2027"],
    row?.["Enrolment S.Y. 2025-2026"],
    row?.["Enrollment S.Y. 2025-2026"],
    row?.["Enrolment"],
    row?.["Enrollment"]
  );
}

function parseRegionalDeliveryYearValue(value) {

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = String(value.getFullYear());
    return REGIONAL_TEXTBOOK_DELIVERY_YEARS.includes(year) ? year : null;
  }

  if (typeof value === "number") {
    const year = String(Math.trunc(value));
    return REGIONAL_TEXTBOOK_DELIVERY_YEARS.includes(year) ? year : null;
  }

  const match = String(value).match(/\b20(24|25|26)\b/);
  return match ? match[0] : null;
}

function getRegionalTextbookDeliveryValues(row) {
  const nextQuantity = toNumber(
    row?.["Quantity of Textbooks Received S.Y. 2026-2027"]
  );

  if (nextQuantity > 0) {
    return {
      quantity: nextQuantity,
      deliveryYear: parseRegionalDeliveryYearValue(
        row?.["Year of Delivery-TX S.Y. 2026-2027"] ??
        row?.["Year of Delivery - TX S.Y. 2026-2027"] ??
        ""
      ),
    };
  }

  return {
    quantity: toNumber(
      row?.["Quantity of Textbooks Received"] ??
      row?.["Quantity Received"] ??
      row?.["Received"] ??
      0
    ),
    deliveryYear: parseRegionalDeliveryYearValue(
      row?.["Year of Delivery-TX"] ??
      row?.["Year of Delivery - TX"] ??
      row?.["Delivery Year"] ??
      row?.["Year"] ??
      ""
    ),
  };
}

function addRegionalTextbookRow(target, row) {
  const gradeValue =
    row?.["Grade Level"] ??
    row?.["GradeLevel"] ??
    row?.["GRADE LEVEL"] ??
    "";
  const normalizedGrade = normalizeRegionalTextbookGrade(gradeValue);
  if (!normalizedGrade || !target?.totals?.[normalizedGrade]) return;

  const subjectValue =
    row?.["SUBJECTS"] ??
    row?.["Subjects"] ??
    row?.["Subject"] ??
    "";
  const subjectKey = canonicalizeRegionalTextbookSubject(normalizedGrade, subjectValue);
  if (!subjectKey) return;

  const { quantity, deliveryYear } = getRegionalTextbookDeliveryValues(row);

  target.totals[normalizedGrade][subjectKey] += quantity;
  if (deliveryYear && target.deliveryByYear?.[normalizedGrade]?.[subjectKey]) {
    target.deliveryByYear[normalizedGrade][subjectKey][deliveryYear] += quantity;
  }
  target.enrollmentByGrade[normalizedGrade] = Math.max(
    target.enrollmentByGrade[normalizedGrade] || 0,
    getRegionalEnrollmentValue(row)
  );
}

function mergeRegionalTextbookTotals(target, source) {
  REGIONAL_TEXTBOOK_DELIVERY_GRADES.forEach((gradeBlock) => {
    gradeBlock.subjects.forEach((subject) => {
      target[gradeBlock.grade][subject.key] += source?.[gradeBlock.grade]?.[subject.key] || 0;
    });
  });
}

function mergeRegionalTextbookYearTotals(target, source) {
  REGIONAL_TEXTBOOK_DELIVERY_GRADES.forEach((gradeBlock) => {
    gradeBlock.subjects.forEach((subject) => {
      REGIONAL_TEXTBOOK_DELIVERY_YEARS.forEach((year) => {
        target[gradeBlock.grade][subject.key][year] +=
          source?.[gradeBlock.grade]?.[subject.key]?.[year] || 0;
      });
    });
  });
}

function mergeRegionalEnrollmentTotals(target, source) {
  REGIONAL_TEXTBOOK_DELIVERY_GRADES.forEach((gradeBlock) => {
    target[gradeBlock.grade] += source?.[gradeBlock.grade] || 0;
  });
}

function finalizeRegionalEntry(entry) {
  entry.deliveredTotal = getRegionalTextbookDeliveredTotal(entry.totals);
  entry.enrollmentTotal = Object.values(entry.enrollmentByGrade || {}).reduce(
    (sum, value) => sum + toNumber(value),
    0
  );
  entry.deliveryPercentage =
    entry.enrollmentTotal > 0
      ? Number(((entry.deliveredTotal / entry.enrollmentTotal) * 100).toFixed(2))
      : 0;
}

function applyRegionalEnrollmentOverrides(entry, overrides) {
  const divisionOverrides = overrides?.overrides?.[entry.slug]?.grades;
  if (!divisionOverrides) return;

  Object.entries(divisionOverrides).forEach(([grade, value]) => {
    if (entry.enrollmentByGrade?.[grade] === undefined) return;
    if (toNumber(entry.enrollmentByGrade[grade]) > 0) return;
    entry.enrollmentByGrade[grade] = toNumber(value);
  });
}

function createEmptyRegionalDeliveryBaseline() {
  return {
    sourceWorkbooks: BASELINE_DELIVERY_WORKBOOKS.filter((workbookPath) =>
      fs.existsSync(workbookPath)
    ),
    missingWorkbooks: BASELINE_DELIVERY_WORKBOOKS.filter(
      (workbookPath) => !fs.existsSync(workbookPath)
    ),
    values: new Map(),
  };
}

function getRegionalDeliveryBaselineValue(baseline, divisionSlug, grade, subjectKey, year) {
  return (
    baseline.values.get(`${divisionSlug}|${grade}|${subjectKey}|${year}`) || 0
  );
}

function addRegionalDeliveryBaselineValue(
  baseline,
  divisionSlug,
  grade,
  subjectKey,
  year,
  quantity
) {
  const key = `${divisionSlug}|${grade}|${subjectKey}|${year}`;
  baseline.values.set(key, (baseline.values.get(key) || 0) + quantity);
}

function loadRegionalDeliveryBaseline() {
  const baseline = createEmptyRegionalDeliveryBaseline();

  baseline.missingWorkbooks.forEach((workbookPath) => {
    warn(`Regional delivery baseline workbook not found: ${workbookPath}`);
  });

  baseline.sourceWorkbooks.forEach((workbookPath) => {
    let workbook;
    try {
      workbook = XLSX.readFile(workbookPath, { cellDates: true });
    } catch (e) {
      warn(`Failed to read regional delivery baseline: ${workbookPath} (${e.message})`);
      return;
    }

    workbook.SheetNames.forEach((sheetName) => {
      const grade = normalizeRegionalTextbookGrade(sheetName);
      if (!grade) return;

      const worksheet = workbook.Sheets[sheetName];
      const matrix = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: "",
      });
      const subjectRow = matrix[1] || [];
      const deliveryHeaderRow = matrix[2] || [];
      let currentSubject = "";

      for (let columnIndex = 2; columnIndex < deliveryHeaderRow.length; columnIndex++) {
        const subjectCell = normalizeWhitespace(subjectRow[columnIndex]);
        if (subjectCell) {
          currentSubject = subjectCell;
        }

        const subjectKey = canonicalizeRegionalTextbookSubject(grade, currentSubject);
        if (!subjectKey) continue;

        const yearMatch = String(deliveryHeaderRow[columnIndex] ?? "").match(
          /\b20(24|25|26)\b/
        );
        if (!yearMatch) continue;

        for (let rowIndex = 3; rowIndex < matrix.length; rowIndex++) {
          const divisionName = normalizeWhitespace(matrix[rowIndex]?.[0]);
          if (!divisionName) continue;

          addRegionalDeliveryBaselineValue(
            baseline,
            slugify(divisionName),
            grade,
            subjectKey,
            yearMatch[0],
            toNumber(matrix[rowIndex]?.[columnIndex])
          );
        }
      }
    });
  });

  return baseline;
}

function applyRegionalDeliveryBaselineRule(entry, baseline) {
  if (!baseline?.sourceWorkbooks?.length) return;

  REGIONAL_TEXTBOOK_DELIVERY_GRADES.forEach((gradeBlock) => {
    gradeBlock.subjects.forEach((subject) => {
      const latest2025 =
        entry.deliveryByYear?.[gradeBlock.grade]?.[subject.key]?.["2025"] || 0;
      const latest2026 =
        entry.deliveryByYear?.[gradeBlock.grade]?.[subject.key]?.["2026"] || 0;
      const baseline2024 = getRegionalDeliveryBaselineValue(
        baseline,
        entry.slug,
        gradeBlock.grade,
        subject.key,
        "2024"
      );
      const baseline2025 = getRegionalDeliveryBaselineValue(
        baseline,
        entry.slug,
        gradeBlock.grade,
        subject.key,
        "2025"
      );
      const addedFrom2025 = Math.max(latest2025 - baseline2025, 0);

      entry.deliveryByYear[gradeBlock.grade][subject.key]["2024"] = baseline2024;
      entry.deliveryByYear[gradeBlock.grade][subject.key]["2025"] = baseline2025;
      entry.deliveryByYear[gradeBlock.grade][subject.key]["2026"] =
        latest2026 + addedFrom2025;
      entry.totals[gradeBlock.grade][subject.key] =
        baseline2024 + baseline2025 + latest2026 + addedFrom2025;
    });
  });
}

// ===== MAIN =====
function build() {
  if (!fs.existsSync(INPUT_DIR)) {
    console.error(`❌ Folder not found: ${INPUT_DIR}`);
    process.exit(1);
  }

  ensureDir(OUTPUT_DIR);
  const regionalEnrollmentOverrides = readJSONIfExists(
    REGIONAL_ENROLLMENT_OVERRIDE_PATH
  );
  const regionalDeliveryBaseline = loadRegionalDeliveryBaseline();

  const divisionDirs = fs
    .readdirSync(INPUT_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory());

  const index = { divisions: [] };
  const regionalDivisions = [];

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

    if (DIVISION_FILTERS.length > 0 && !DIVISION_FILTERS.includes(divisionSlug)) {
      info(`Skipping division due to filter: ${divisionName}`);
      continue;
    }

    const regionalDivision = createRegionalDivisionSummary(divisionSlug, divisionName);
    regionalDivisions.push(regionalDivision);

    for (const file of files) {
      const rawSchoolName = file.replace(/\.(xlsx|xlsm|xls)$/i, "");
      const rawSchoolId = slugify(rawSchoolName);
      const schoolName = normalizeSchoolName(rawSchoolName);
      const schoolId = slugify(schoolName);
      const isSeniorHighSchool = isSeniorHighSchoolName(schoolName);

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

      const legacyOutSchoolDir = path.join(outSchoolsDir, rawSchoolId);
      if (rawSchoolId !== schoolId && fs.existsSync(legacyOutSchoolDir)) {
        fs.rmSync(legacyOutSchoolDir, { recursive: true, force: true });
      }

      const outSchoolDir = path.join(outSchoolsDir, schoolId);
      ensureDir(outSchoolDir);
      const regionalSchool = {
        id: schoolId,
        name: schoolName,
        totals: createRegionalTextbookDeliveryTotals(),
        deliveryByYear: createRegionalTextbookDeliveryByYearTotals(),
        enrollmentByGrade: createRegionalEnrollmentTotals(),
        enrollmentTotal: 0,
        deliveredTotal: 0,
        deliveryPercentage: 0,
      };
      regionalDivision.schools.push(regionalSchool);

      for (const rule of SHEETS) {
        let rows = parseSheet(workbook, rule.name, rule.headerRowIndex, ctx);
        if (isSeniorHighSchool) {
          rows = filterSeniorHighRows(rows);
        }

        if (rule.key === "textbooks") {
          rows.forEach((row) => addRegionalTextbookRow(regionalSchool, row));
        }

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

        if (comparison.status !== "UNCHANGED") {
          writeJSON(outFilePath, newPayload);
        }

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

    const schoolsListPath = path.join(outDivDir, "schools.json");
    const existingSchoolsList = readJSONIfExists(schoolsListPath);
    if (JSON.stringify(existingSchoolsList) !== JSON.stringify(schoolsList)) {
      writeJSON(schoolsListPath, schoolsList);
    }

    regionalDivision.schools.sort((a, b) => a.name.localeCompare(b.name));
    regionalDivision.schools.forEach((school) => {
      finalizeRegionalEntry(school);
      mergeRegionalTextbookTotals(regionalDivision.totals, school.totals);
      mergeRegionalTextbookYearTotals(
        regionalDivision.deliveryByYear,
        school.deliveryByYear
      );
      mergeRegionalEnrollmentTotals(
        regionalDivision.enrollmentByGrade,
        school.enrollmentByGrade
      );
    });
    applyRegionalEnrollmentOverrides(
      regionalDivision,
      regionalEnrollmentOverrides
    );
    applyRegionalDeliveryBaselineRule(
      regionalDivision,
      regionalDeliveryBaseline
    );
    finalizeRegionalEntry(regionalDivision);

    ok(`Built division: ${divisionName}`);
  }

  const indexPath = path.join(OUTPUT_DIR, "index.json");
  if (DIVISION_FILTERS.length === 0) {
    const existingIndex = readJSONIfExists(indexPath);
    if (JSON.stringify(existingIndex) !== JSON.stringify(index)) {
      writeJSON(indexPath, index);
    }
  }

  const regionalPayload = {
    title: "Status of Textbook Delivery",
    generatedAt: new Date().toISOString(),
    years: REGIONAL_TEXTBOOK_DELIVERY_YEARS,
    phases: REGIONAL_TEXTBOOK_DELIVERY_PHASES,
    enrollmentReference: regionalEnrollmentOverrides
      ? {
          sourceDeck: regionalEnrollmentOverrides.sourceDeck,
          note: regionalEnrollmentOverrides.note,
        }
      : null,
    deliveryReference: {
      rule:
        "2024 and 2025 delivery columns use the old standard workbooks. The 2026 column uses latest inventory rows marked 2026 plus only positive increases where latest 2025 is higher than old standard 2025; same-year decreases are skipped.",
      sourceWorkbooks: regionalDeliveryBaseline.sourceWorkbooks,
      missingWorkbooks: regionalDeliveryBaseline.missingWorkbooks,
    },
    grades: REGIONAL_TEXTBOOK_DELIVERY_GRADES.map((gradeBlock) => ({
      grade: gradeBlock.grade,
      label: gradeBlock.label,
      phase: gradeBlock.phase,
      subjects: gradeBlock.subjects.map((subject) => ({
        key: subject.key,
        label: subject.label,
      })),
    })),
    divisions: regionalDivisions.sort((a, b) => a.name.localeCompare(b.name)),
  };

  const regionalPath = path.join(OUTPUT_DIR, "regional-textbook-delivery.json");
  const existingRegional = readJSONIfExists(regionalPath);
  if (
    JSON.stringify(stripGeneratedAt(existingRegional)) !==
    JSON.stringify(stripGeneratedAt(regionalPayload))
  ) {
    writeJSON(regionalPath, regionalPayload);
  }

  console.log("\n================ BUILD SUMMARY ================");
  console.log(`🆕 New files     : ${report.newFiles}`);
  console.log(`📝 Updated files : ${report.updatedFiles}`);
  console.log("==============================================\n");

  ok("DONE. Data generated successfully.");
}

build();
