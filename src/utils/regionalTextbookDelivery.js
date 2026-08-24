export const REGIONAL_TEXTBOOK_DELIVERY_GRADES = [
  {
    grade: "1",
    label: "Grade 1",
    subjects: [
      {
        key: "reading-and-literacy",
        label: "Reading and Literacy",
        aliases: [
          "READING AND LITERACY",
          "HIRAYA",
          "READING AND LITERACY HIRAYA",
        ],
      },
      {
        key: "language",
        label: "Language",
        aliases: ["LANGUAGE", "LANGUAGE IWIKA", "WIKA"],
      },
      {
        key: "gmrc",
        label: "GMRC",
        aliases: ["GMRC", "GMRC WASTONG UGALI TAMANG GAWI"],
      },
      {
        key: "makabansa",
        label: "Makabansa",
        aliases: ["MAKABANSA"],
      },
      {
        key: "mathematics",
        label: "Math",
        aliases: ["MATH", "MATHEMATICS"],
      },
    ],
  },
  {
    grade: "4",
    label: "Grade 4",
    subjects: [
      {
        key: "english",
        label: "English",
        aliases: ["ENGLISH"],
      },
      {
        key: "filipino",
        label: "Filipino",
        aliases: ["FILIPINO", "FILIPINO TX"],
      },
      {
        key: "mathematics",
        label: "Math",
        aliases: ["MATH", "MATHEMATICS"],
      },
      {
        key: "gmrc",
        label: "GMRC",
        aliases: ["GMRC", "ESP", "E S P"],
      },
      {
        key: "araling-panlipunan",
        label: "Araling Panlipunan",
        aliases: ["ARALING PANLIPUNAN", "AP"],
      },
      {
        key: "science",
        label: "Science",
        aliases: ["SCIENCE"],
      },
      {
        key: "pe-and-health",
        label: "PE and Health",
        aliases: ["PE AND HEALTH", "PHYSICAL EDUCATION AND HEALTH"],
      },
      {
        key: "epp",
        label: "EPP",
        aliases: ["EPP", "E P P"],
      },
      {
        key: "music-and-arts",
        label: "Music and Arts",
        aliases: ["MUSIC AND ARTS", "MUSIC ARTS"],
      },
    ],
  },
  {
    grade: "7",
    label: "Grade 7",
    subjects: [
      {
        key: "english",
        label: "English",
        aliases: ["ENGLISH"],
      },
      {
        key: "filipino",
        label: "Filipino",
        aliases: ["FILIPINO"],
      },
      {
        key: "mathematics",
        label: "Math",
        aliases: ["MATH", "MATHEMATICS"],
      },
      {
        key: "ve",
        label: "VE",
        aliases: ["VE", "VALUES EDUCATION"],
      },
      {
        key: "araling-panlipunan",
        label: "Araling Panlipunan",
        aliases: ["ARALING PANLIPUNAN", "AP"],
      },
      {
        key: "science",
        label: "Science",
        aliases: ["SCIENCE"],
      },
      {
        key: "pe-and-health",
        label: "PE and Health",
        aliases: ["PE AND HEALTH", "PHYSICAL EDUCATION AND HEALTH"],
      },
      {
        key: "tle",
        label: "TLE",
        aliases: ["TLE", "TECHNOLOGY AND LIVELIHOOD EDUCATION"],
      },
      {
        key: "music-and-arts",
        label: "Music and Arts",
        aliases: ["MUSIC AND ARTS", "MUSIC ARTS"],
      },
    ],
  },
];

export const REGIONAL_TEXTBOOK_DELIVERY_COLUMNS =
  REGIONAL_TEXTBOOK_DELIVERY_GRADES.flatMap((gradeBlock) =>
    gradeBlock.subjects.map((subject) => ({
      grade: gradeBlock.grade,
      gradeLabel: gradeBlock.label,
      subjectKey: subject.key,
      subjectLabel: subject.label,
    }))
  );

const normalizeGradeValue = (value) =>
  String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/^GRADE\s*/i, "")
    .replace(/^G/i, "")
    .replace(/\s+/g, "");

const normalizeAlias = (value) =>
  String(value ?? "")
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const GRADE_LOOKUP = new Map(
  REGIONAL_TEXTBOOK_DELIVERY_GRADES.map((gradeBlock) => [gradeBlock.grade, gradeBlock])
);

export const REGIONAL_TEXTBOOK_DELIVERY_GRADE_KEYS =
  REGIONAL_TEXTBOOK_DELIVERY_GRADES.map((gradeBlock) => gradeBlock.grade);

export const createRegionalTextbookDeliveryTotals = () =>
  Object.fromEntries(
    REGIONAL_TEXTBOOK_DELIVERY_GRADES.map((gradeBlock) => [
      gradeBlock.grade,
      Object.fromEntries(
        gradeBlock.subjects.map((subject) => [subject.key, 0])
      ),
    ])
  );

export const createRegionalEnrollmentTotals = () =>
  Object.fromEntries(
    REGIONAL_TEXTBOOK_DELIVERY_GRADE_KEYS.map((grade) => [grade, 0])
  );

export const getRegionalTextbookDeliveredTotal = (totals) =>
  REGIONAL_TEXTBOOK_DELIVERY_GRADES.reduce(
    (gradeSum, gradeBlock) =>
      gradeSum +
      gradeBlock.subjects.reduce(
        (subjectSum, subject) =>
          subjectSum + Number(totals?.[gradeBlock.grade]?.[subject.key] || 0),
        0
      ),
    0
  );

export const normalizeRegionalTextbookGrade = (value) => {
  const normalized = normalizeGradeValue(value);
  return GRADE_LOOKUP.has(normalized) ? normalized : null;
};

export const canonicalizeRegionalTextbookSubject = (grade, value) => {
  const gradeKey = normalizeRegionalTextbookGrade(grade);
  if (!gradeKey) return null;

  const gradeBlock = GRADE_LOOKUP.get(gradeKey);
  const subjectText = normalizeAlias(value);
  if (!subjectText) return null;

  for (const subject of gradeBlock.subjects) {
    const matches = subject.aliases.some(
      (alias) => normalizeAlias(alias) === subjectText
    );

    if (matches) {
      return subject.key;
    }
  }

  return null;
};
