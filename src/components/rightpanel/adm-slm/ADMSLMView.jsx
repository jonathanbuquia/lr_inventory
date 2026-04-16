import React, { useEffect, useMemo, useState } from "react";
import ADMSLMTable from "./adm-slmtable/ADMSLMTable";
import ADMSLMGapsSurplusChart from "./gaps_surplus/ADMSLMGapsSurplusChart";
import ADMSLMSourceYearPieCharts from "./piecharts/ADMSLMSourceYearPieCharts";
import "./adm-slmtable/admSlmTable.css";
import {
  QUARTERS,
  formatGradeLabel,
  getEnrolmentValue,
  getGradeValue,
  getSheetRows,
  getSubjectValue,
  gradeSortValue,
  isKinderGrade,
  normalizeText,
  safeEncode,
  toNumber,
} from "../../../utils/dashboardData";

const buildUrl = (divisionSlug, schoolFolder) =>
  `/data/divisions/${safeEncode(divisionSlug)}/schools/${safeEncode(
    schoolFolder
  )}/adm-slm.json`;

const nf = new Intl.NumberFormat("en-US");

const ADMSLMView = ({ selectedDivisionSlug, selectedSchoolFolderName }) => {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState({ loading: true, error: "" });
  const [selectedGrade, setSelectedGrade] = useState("ALL");
  const [quarter, setQuarter] = useState("ALL");

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        setStatus({ loading: true, error: "" });
        setRows([]);

        if (!selectedDivisionSlug || !selectedSchoolFolderName) {
          setStatus({ loading: false, error: "" });
          return;
        }

        const url = buildUrl(selectedDivisionSlug, selectedSchoolFolderName);
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`Cannot load adm-slm.json (${res.status})`);

        const json = await res.json();
        const cleaned = getSheetRows(json).filter((row) => {
          const hasSubject = String(getSubjectValue(row)).trim() !== "";
          return hasSubject || isKinderGrade(normalizeText(getGradeValue(row)));
        });

        if (!alive) return;

        setRows(cleaned);
        setSelectedGrade("ALL");
        setQuarter("ALL");
        setStatus({ loading: false, error: "" });
      } catch (error) {
        console.error("ADM-SLM LOAD ERROR:", error);
        if (!alive) return;

        setRows([]);
        setStatus({
          loading: false,
          error: error?.message || "Failed to load ADM-SLM.",
        });
      }
    };

    load();
    return () => {
      alive = false;
    };
  }, [selectedDivisionSlug, selectedSchoolFolderName]);

  const gradeOptions = useMemo(() => {
    const grades = new Set();

    rows.forEach((row) => {
      const grade = String(getGradeValue(row)).trim();
      if (grade) grades.add(formatGradeLabel(grade));
    });

    const values = Array.from(grades);
    if (!values.includes("KINDER")) values.push("KINDER");
    values.sort(
      (a, b) => gradeSortValue(a) - gradeSortValue(b) || a.localeCompare(b)
    );

    return ["ALL", ...values];
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (selectedGrade === "ALL") return rows;
    return rows.filter(
      (row) => formatGradeLabel(getGradeValue(row)) === selectedGrade
    );
  }, [rows, selectedGrade]);

  const enrolmentSeries = useMemo(() => {
    const firstByGrade = new Map();

    for (const row of rows) {
      const gradeLabel = formatGradeLabel(getGradeValue(row));
      if (!gradeLabel || firstByGrade.has(gradeLabel)) continue;

      const enrolment = toNumber(getEnrolmentValue(row));
      if (enrolment > 0) {
        firstByGrade.set(gradeLabel, enrolment);
      }
    }

    return Array.from(firstByGrade.entries())
      .map(([grade, value]) => ({ grade, value }))
      .sort(
        (a, b) =>
          gradeSortValue(a.grade) - gradeSortValue(b.grade) ||
          a.grade.localeCompare(b.grade)
      );
  }, [rows]);

  if (status.loading) return <div className="rp__empty">Loading ADM-SLM...</div>;

  if (status.error) {
    return (
      <div className="rp__empty">
        {status.error}
        <div style={{ opacity: 0.7, marginTop: 6, fontSize: 13 }}>
          Check:{" "}
          <b>
            public/data/divisions/{selectedDivisionSlug}/schools/
            {selectedSchoolFolderName}/adm-slm.json
          </b>
        </div>
      </div>
    );
  }

  return (
    <div className="lasWrap">
      <div className="lasControls">
        <div className="lasGradeRow">
          <div className="lasGradeBlock">
            <div className="lasLabel">Grade Level</div>
            <select
              className="lasSelect"
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
            >
              {gradeOptions.map((grade) => (
                <option key={grade} value={grade}>
                  {grade}
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

        <div className="lasQuarterBlock">
          <div className="lasLabel">Quarter</div>
          <div className="lasQuarterBtns">
            {QUARTERS.map((value) => (
              <button
                key={value}
                type="button"
                className={`lasQBtn ${quarter === value ? "active" : ""}`}
                onClick={() => setQuarter(value)}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ADMSLMTable rows={filteredRows} quarter={quarter} />
      <ADMSLMGapsSurplusChart
        selectedDivisionSlug={selectedDivisionSlug}
        selectedSchoolFolderName={selectedSchoolFolderName}
      />
      <ADMSLMSourceYearPieCharts
        selectedDivisionSlug={selectedDivisionSlug}
        selectedSchoolFolderName={selectedSchoolFolderName}
      />
    </div>
  );
};

export default ADMSLMView;
