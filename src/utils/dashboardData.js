export const QUARTERS = ["ALL", "Q1", "Q2", "Q3", "Q4"];

export const safeEncode = (value) =>
  encodeURIComponent(String(value ?? "").trim());

export const buildSchoolSheetUrl = (divisionSlug, schoolFolder, sheetFile) =>
  `/data/divisions/${safeEncode(divisionSlug)}/schools/${safeEncode(
    schoolFolder
  )}/${sheetFile}`;

export const getSheetRows = (data) =>
  Array.isArray(data) ? data : Array.isArray(data?.rows) ? data.rows : [];

export const normalizeText = (value) =>
  String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");

export const toNumber = (value) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const cleaned = String(value).replace(/,/g, "").trim();
  if (!cleaned) return 0;

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const getGradeValue = (row) =>
  row?.["Grade Level"] ?? row?.["GradeLevel"] ?? row?.["GRADE LEVEL"] ?? "";

export const getSubjectValue = (row) =>
  row?.["SUBJECTS"] ?? row?.["Subjects"] ?? row?.["Subject"] ?? "";

export const getEnrolmentValue = (row) =>
  row?.["Enrolment S.Y. 2025-2026"] ??
  row?.["Enrolment S.Y. 2025â€“2026"] ??
  row?.["Enrolment SY 2025-2026"] ??
  row?.["Enrolment"] ??
  row?.["Enrollment"] ??
  row?.["ENROLMENT"] ??
  "";

export const isKinderGrade = (raw) => {
  const normalized = normalizeText(raw);
  return (
    normalized === "KINDER" ||
    normalized === "K" ||
    normalized.includes("KINDER")
  );
};

export const normalizeGradeKey = (raw) => {
  const normalized = normalizeText(raw);
  if (!normalized) return "";
  if (isKinderGrade(normalized)) return "KINDER";

  const cleaned = normalized
    .replace(/^GRADE\s*/i, "")
    .replace(/\s+/g, "")
    .replace(/^G/i, "");

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? String(parsed) : normalized;
};

export const isElementaryGrade = (raw) =>
  ["1", "2", "3", "4", "5", "6"].includes(normalizeGradeKey(raw));

export const isJuniorHighGrade = (raw) =>
  ["7", "8", "9", "10"].includes(normalizeGradeKey(raw));

export const isSeniorHighGrade = (raw) => {
  const key = normalizeGradeKey(raw);
  const normalized = normalizeText(raw);
  return key === "11" || key === "12" || normalized.includes("SHS");
};

export const gradeSortValue = (raw) => {
  const normalized = normalizeText(raw);
  if (!normalized) return 9999;
  if (isKinderGrade(normalized)) return 0;

  const cleaned = normalized
    .replace(/^GRADE\s*/i, "")
    .replace(/\s+/g, "")
    .replace(/^G/i, "");

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 9999;
};

export const formatGradeLabel = (raw) => {
  const normalized = normalizeText(raw);
  if (!normalized) return "";
  if (isKinderGrade(normalized)) return "KINDER";

  const cleaned = normalized
    .replace(/^GRADE\s*/i, "")
    .replace(/\s+/g, "")
    .replace(/^G/i, "");

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? `G${parsed}` : normalized;
};

const quarterRegex = (quarter) => {
  const numeric = String(quarter).replace(/[^0-9]/g, "");
  return new RegExp(`\\bQ\\s*${numeric}\\b`, "i");
};

const matchesAll = (key, matchers = []) => {
  const lowerKey = key.toLowerCase();
  return matchers.every((matcher) =>
    typeof matcher === "string"
      ? lowerKey.includes(matcher.toLowerCase())
      : matcher.test(key)
  );
};

export const findQuarterKey = ({
  row,
  baseMatchers = [],
  quarter = "Q1",
  hintMatchers = [],
}) => {
  const keys = Object.keys(row || {});
  const quarterMatch = quarterRegex(quarter);
  const hintedMatchers = [...baseMatchers, ...hintMatchers];

  for (const key of keys) {
    if (
      hintedMatchers.length > baseMatchers.length &&
      matchesAll(key, hintedMatchers) &&
      quarterMatch.test(key)
    ) {
      return key;
    }
  }

  for (const key of keys) {
    if (matchesAll(key, baseMatchers) && quarterMatch.test(key)) {
      return key;
    }
  }

  for (const key of keys) {
    if (
      hintedMatchers.length > baseMatchers.length &&
      matchesAll(key, hintedMatchers)
    ) {
      return key;
    }
  }

  for (const key of keys) {
    if (matchesAll(key, baseMatchers)) {
      return key;
    }
  }

  return null;
};

export const getLasQuarterValues = (row, quarter = "Q1") => {
  const targetKey = findQuarterKey({
    row,
    baseMatchers: ["quantity based on target", "las"],
    quarter,
  });

  const receivedKey = findQuarterKey({
    row,
    baseMatchers: [/quantity of learning activity sheets received/i, /las/i],
    quarter,
  });

  const gapKey = findQuarterKey({
    row,
    baseMatchers: [/gap/i, /las/i],
    quarter,
  });

  const surplusKey = findQuarterKey({
    row,
    baseMatchers: [/surplus/i, /las/i],
    quarter,
  });

  return {
    target: toNumber(targetKey ? row[targetKey] : 0),
    received: toNumber(receivedKey ? row[receivedKey] : 0),
    gap: toNumber(gapKey ? row[gapKey] : 0),
    surplus: toNumber(surplusKey ? row[surplusKey] : 0),
  };
};

export const getLasValuesForQuarter = (row, quarter = "ALL") => {
  if (quarter !== "ALL") return getLasQuarterValues(row, quarter);

  return QUARTERS.slice(1).reduce(
    (totals, value) => {
      const current = getLasQuarterValues(row, value);
      return {
        target: totals.target + current.target,
        received: totals.received + current.received,
        gap: totals.gap + current.gap,
        surplus: totals.surplus + current.surplus,
      };
    },
    { target: 0, received: 0, gap: 0, surplus: 0 }
  );
};

export const getAdmSlmQuarterValues = (row, quarter = "Q1") => {
  const targetKey = findQuarterKey({
    row,
    baseMatchers: ["quantity based on target"],
    quarter,
  });

  const receivedKey = findQuarterKey({
    row,
    baseMatchers: [/quantity.*received/i],
    quarter,
  });

  const gapKey = findQuarterKey({
    row,
    baseMatchers: [/gap/i],
    quarter,
  });

  const surplusKey = findQuarterKey({
    row,
    baseMatchers: [/surplus/i],
    quarter,
  });

  return {
    target: toNumber(targetKey ? row[targetKey] : 0),
    received: toNumber(receivedKey ? row[receivedKey] : 0),
    gap: toNumber(gapKey ? row[gapKey] : 0),
    surplus: toNumber(surplusKey ? row[surplusKey] : 0),
  };
};

export const getAdmSlmValuesForQuarter = (row, quarter = "ALL") => {
  if (quarter !== "ALL") return getAdmSlmQuarterValues(row, quarter);

  return QUARTERS.slice(1).reduce(
    (totals, value) => {
      const current = getAdmSlmQuarterValues(row, value);
      return {
        target: totals.target + current.target,
        received: totals.received + current.received,
        gap: totals.gap + current.gap,
        surplus: totals.surplus + current.surplus,
      };
    },
    { target: 0, received: 0, gap: 0, surplus: 0 }
  );
};
