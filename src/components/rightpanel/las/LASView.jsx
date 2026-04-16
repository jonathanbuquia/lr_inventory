import React, { useEffect, useMemo, useState } from "react";
import LASTable from "./lastable/LASTable";
import LASGapsSurplusChart from "./gaps_surplus/LASGapsSurplusChart";
import LASSourceYearPieCharts from "./piecharts/LASSourceYearPieCharts";
import "./lastable/lastable.css";
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
  toNumber,
} from "../../../utils/dashboardData";

const nf = new Intl.NumberFormat("en-US");

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
        const cleaned = getSheetRows(data).filter((row) => {
          const hasSubject = String(getSubjectValue(row)).trim() !== "";
          return hasSubject || isKinderGrade(normalizeText(getGradeValue(row)));
        });

        if (!alive) return;

        setRows(cleaned);
        setSelectedGrade("ALL");
        setQuarter("ALL");
        setStatus({ loading: false, error: "" });
      } catch (error) {
        console.error("LAS LOAD ERROR:", error);
        if (!alive) return;

        setRows([]);
        setStatus({
          loading: false,
          error: error?.message || "Failed to load LAS.",
        });
      }
    };

    if (selectedDivisionSlug && selectedSchoolFolderName) {
      load();
    } else {
      setStatus({ loading: false, error: "" });
    }

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

  if (status.loading) return <div className="rp__empty">Loading LAS...</div>;

  if (status.error) {
    return (
      <div className="rp__empty">
        {status.error}
        <div style={{ opacity: 0.7, marginTop: 6, fontSize: 13 }}>
          Check:{" "}
          <b>
            public/data/divisions/{selectedDivisionSlug}/schools/
            {selectedSchoolFolderName}/las.json
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
