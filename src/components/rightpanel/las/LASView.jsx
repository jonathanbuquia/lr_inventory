import React, { useEffect, useMemo, useState } from "react";
import LASTable from "./lastable/LASTable";

import LASGapsSurplusChart from "./gaps_surplus/LASGapsSurplusChart";

import LASSourceYearPieCharts from "./piecharts/LASSourceYearPieCharts";
import "./lastable/lastable.css";

const QUARTERS = ["ALL", "Q1", "Q2", "Q3", "Q4"];

const norm = (s) =>
  String(s ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");

const getGrade = (row) =>
  row?.["Grade Level"] ?? row?.["GradeLevel"] ?? row?.["GRADE LEVEL"] ?? "";

const getSubject = (row) =>
  row?.["SUBJECTS"] ?? row?.["Subjects"] ?? row?.["Subject"] ?? "";

const getEnrolment = (row) =>
  row?.["Enrolment S.Y. 2025-2026"] ??
  row?.["Enrolment S.Y. 2025–2026"] ??
  row?.["Enrolment SY 2025-2026"] ??
  row?.["Enrolment"] ??
  row?.["Enrollment"] ??
  row?.["ENROLMENT"] ??
  "";

const toNumber = (v) => {
  if (v === null || v === undefined) return 0;
  const s = String(v).replace(/,/g, "").trim();
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

const nf = new Intl.NumberFormat("en-US");

// ---- Grade helpers (proper ordering + display) ----
const gradeSortValue = (raw) => {
  const s = norm(raw);
  if (!s) return 9999;

  if (s === "KINDER" || s === "K" || s.includes("KINDER")) return 0;

  // Accept: "G1", "G 1", "GRADE 1", "1"
  const cleaned = s
    .replace(/^GRADE\s*/i, "")
    .replace(/\s+/g, "")
    .replace(/^G/i, "");

  const n = Number(cleaned);
  if (Number.isFinite(n)) return n; // 1..12

  return 9999;
};

const formatGradeLabel = (raw) => {
  const s = norm(raw);
  if (!s) return "";

  if (s === "KINDER" || s === "K" || s.includes("KINDER")) return "KINDER";

  const cleaned = s
    .replace(/^GRADE\s*/i, "")
    .replace(/\s+/g, "")
    .replace(/^G/i, "");

  const n = Number(cleaned);
  if (Number.isFinite(n)) return `G${n}`;

  return s;
};

const LASView = ({ selectedDivisionSlug, selectedSchoolFolderName }) => {
  const [rows, setRows] = useState([]);
  const [selectedGrade, setSelectedGrade] = useState("ALL");
  const [quarter, setQuarter] = useState("ALL");
  const [status, setStatus] = useState({ loading: true, error: "" });

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        setStatus({ loading: true, error: "" });
        setRows([]);

        const division = String(selectedDivisionSlug || "").trim();
        const school = String(selectedSchoolFolderName || "").trim();

        const url = `/data/divisions/${division}/schools/${school}/las.json`;

        const res = await fetch(url);
        if (!res.ok) throw new Error(`Cannot load las.json (${res.status})`);

        const data = await res.json();
        const arr = Array.isArray(data)
          ? data
          : Array.isArray(data?.rows)
            ? data.rows
            : [];

        // ✅ keep rows that have subject OR are KINDER (even if blank subject)
        const cleaned = arr.filter((r) => {
          const grade = norm(getGrade(r));
          const hasSubject = String(getSubject(r)).trim() !== "";
          const isKinder = grade === "KINDER" || grade === "K" || grade.includes("KINDER");
          return hasSubject || isKinder;
        });

        if (!alive) return;

        setRows(cleaned);
        setSelectedGrade("ALL");
        setQuarter("ALL");
        setStatus({ loading: false, error: "" });
      } catch (e) {
        console.error("LAS LOAD ERROR:", e);
        if (!alive) return;
        setRows([]);
        setStatus({ loading: false, error: e?.message || "Failed to load LAS." });
      }
    };

    if (selectedDivisionSlug && selectedSchoolFolderName) load();
    else setStatus({ loading: false, error: "" });

    return () => {
      alive = false;
    };
  }, [selectedDivisionSlug, selectedSchoolFolderName]);

  // ✅ Dropdown options in correct order + force KINDER option
  const gradeOptions = useMemo(() => {
    const set = new Set();

    rows.forEach((r) => {
      const g = String(getGrade(r)).trim();
      if (g) set.add(formatGradeLabel(g));
    });

    const arr = Array.from(set);

    // force KINDER to appear as an option
    if (!arr.includes("KINDER")) arr.push("KINDER");

    arr.sort((a, b) => gradeSortValue(a) - gradeSortValue(b) || a.localeCompare(b));

    return ["ALL", ...arr];
  }, [rows]);

  // ✅ filter uses formatted label so it matches dropdown
  const filteredRows = useMemo(() => {
    if (selectedGrade === "ALL") return rows;
    return rows.filter((r) => formatGradeLabel(getGrade(r)) === selectedGrade);
  }, [rows, selectedGrade]);

  // ✅ chips show ALL grades like others (even if enrolment missing)
  const enrolmentSeries = useMemo(() => {
    const map = new Map();

    // one enrolment per grade (first non-zero we find)
    for (const r of rows) {
      const gradeLabel = formatGradeLabel(getGrade(r));
      if (!gradeLabel) continue;

      if (map.has(gradeLabel)) continue;

      const e = toNumber(getEnrolment(r));
      if (e > 0) {
        map.set(gradeLabel, e);
      }
    }

    const list = Array.from(map.entries()).map(([grade, value]) => ({
      grade,
      value,
    }));

    list.sort(
      (a, b) =>
        gradeSortValue(a.grade) - gradeSortValue(b.grade) ||
        a.grade.localeCompare(b.grade)
    );

    return list;
  }, [rows]);

  if (status.loading) return <div className="rp__empty">Loading LAS…</div>;

  if (status.error) {
    return (
      <div className="rp__empty">
        {status.error}
        <div style={{ opacity: 0.7, marginTop: 6, fontSize: 13 }}>
          Check:{" "}
          <b>
            public/data/divisions/{selectedDivisionSlug}/schools/{selectedSchoolFolderName}/las.json
          </b>
        </div>
      </div>
    );
  }

  return (
    <div className="lasWrap">
      <div className="lasControls">
        {/* Left: Grade dropdown + enrolment series */}
        <div className="lasGradeRow">
          <div className="lasGradeBlock">
            <div className="lasLabel">Grade Level</div>
            <select
              className="lasSelect"
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
            >
              {gradeOptions.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <div className="lasEnrolSeries">
            <div className="lasLabel">Enrollees per Grade</div>
            <div className="lasEnrolSeriesList">
              {enrolmentSeries.length === 0 ? (
                <div className="lasEnrolEmpty">No enrolment values found.</div>
              ) : (
                enrolmentSeries.map(({ grade, value }) => (
                  <div key={grade} className="lasEnrolChip">
                    <span className="lasEnrolChipText">
                      <span className="lasEnrolChipGrade">{grade}</span>
                      <span className="lasEnrolChipColon">:</span>
                      <span className="lasEnrolChipValue">{nf.format(value)}</span>
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: Quarter buttons */}
        <div className="lasQuarterBlock">
          <div className="lasLabel">Quarter</div>
          <div className="lasQuarterBtns">
            {QUARTERS.map((q) => (
              <button
                key={q}
                type="button"
                className={`lasQBtn ${quarter === q ? "active" : ""}`}
                onClick={() => setQuarter(q)}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>

      <LASTable rows={filteredRows} quarter={quarter} />
      <LASGapsSurplusChart
        selectedDivisionSlug={selectedDivisionSlug}
        selectedSchoolFolderName={selectedSchoolFolderName}
      />
      <LASSourceYearPieCharts
        selectedDivisionSlug={selectedDivisionSlug}
        selectedSchoolFolderName={selectedSchoolFolderName}
      />

    </div>
  );
};

export default LASView;