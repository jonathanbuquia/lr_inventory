import React, { useEffect, useMemo, useState } from "react";
import "./LASGapsSurplusChart.css";
import {
  QUARTERS,
  findQuarterKey,
  formatGradeLabel,
  getGradeValue,
  getSheetRows,
  getSubjectValue,
  gradeSortValue,
  toNumber,
} from "../../../../utils/dashboardData";

const nf = new Intl.NumberFormat("en-US");

const pickQuarterGapSurplus = (row, quarter) => {
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
    gap: toNumber(gapKey ? row[gapKey] : 0),
    surplus: toNumber(surplusKey ? row[surplusKey] : 0),
  };
};

const pickAllGapSurplus = (row) => {
  const q1 = pickQuarterGapSurplus(row, "Q1");
  const q2 = pickQuarterGapSurplus(row, "Q2");
  const q3 = pickQuarterGapSurplus(row, "Q3");
  const q4 = pickQuarterGapSurplus(row, "Q4");

  return {
    gap: q1.gap + q2.gap + q3.gap + q4.gap,
    surplus: q1.surplus + q2.surplus + q3.surplus + q4.surplus,
  };
};

const niceCeil = (max) => {
  if (max <= 0) return 1;

  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  const frac = max / pow;

  let niceFrac = 1;
  if (frac <= 1) niceFrac = 1;
  else if (frac <= 2) niceFrac = 2;
  else if (frac <= 5) niceFrac = 5;
  else niceFrac = 10;

  return niceFrac * pow;
};

const makeTicks = (niceMax, count = 5) => {
  const step = niceMax / count;
  const ticks = [];
  for (let i = 0; i <= count; i++) ticks.push(Math.round(i * step));
  return ticks;
};

const LASGapsSurplusChart = ({ selectedDivisionSlug, selectedSchoolFolderName }) => {
  const [rows, setRows] = useState([]);
  const [mode, setMode] = useState("GAPS");
  const [selectedGrade, setSelectedGrade] = useState("ALL");
  const [selectedQuarter, setSelectedQuarter] = useState("ALL");
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
        const cleaned = getSheetRows(data).filter(
          (row) => String(getSubjectValue(row)).trim() !== ""
        );

        if (!alive) return;

        setRows(cleaned);
        setMode("GAPS");
        setSelectedGrade("ALL");
        setSelectedQuarter("ALL");
        setStatus({ loading: false, error: "" });
      } catch (error) {
        console.error("LAS GAPS/SURPLUS ERROR:", error);
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

  const bySubject = useMemo(() => {
    const totalsBySubject = new Map();

    for (const row of filteredRows) {
      const subject = String(getSubjectValue(row)).trim();
      if (!subject) continue;

      const values =
        selectedQuarter === "ALL"
          ? pickAllGapSurplus(row)
          : pickQuarterGapSurplus(row, selectedQuarter);

      const current = totalsBySubject.get(subject) || {
        subject,
        gap: 0,
        surplus: 0,
      };

      current.gap += values.gap;
      current.surplus += values.surplus;
      totalsBySubject.set(subject, current);
    }

    return Array.from(totalsBySubject.values()).sort((a, b) => {
      const left = mode === "GAPS" ? a.gap : a.surplus;
      const right = mode === "GAPS" ? b.gap : b.surplus;
      return right - left;
    });
  }, [filteredRows, selectedQuarter, mode]);

  const totalValue = useMemo(
    () =>
      bySubject.reduce((sum, item) => {
        const value = mode === "GAPS" ? item.gap : item.surplus;
        return sum + (Number.isFinite(value) ? value : 0);
      }, 0),
    [bySubject, mode]
  );

  const rawMax = useMemo(() => {
    let max = 0;
    for (const item of bySubject) {
      const value = mode === "GAPS" ? item.gap : item.surplus;
      if (value > max) max = value;
    }
    return max;
  }, [bySubject, mode]);

  const niceMax = useMemo(() => niceCeil(rawMax), [rawMax]);
  const ticks = useMemo(() => makeTicks(niceMax, 5), [niceMax]);

  if (status.loading) return <div className="gsState">Loading LAS gaps/surplus...</div>;
  if (status.error) return <div className="gsError">{status.error}</div>;

  return (
    <div className="gsWrap">
      <div className="gsTop">
        <div className="gsModeBtns">
          <button
            type="button"
            className={`gsModeBtn ${mode === "GAPS" ? "active" : ""}`}
            onClick={() => setMode("GAPS")}
          >
            GAPS
          </button>
          <button
            type="button"
            className={`gsModeBtn ${mode === "SURPLUS" ? "active" : ""}`}
            onClick={() => setMode("SURPLUS")}
          >
            SURPLUS
          </button>
        </div>

        <div className="gsTotalCard">
          <div className="gsTotalLabel">TOTAL {mode}</div>
          <div className="gsTotalValue">{nf.format(totalValue)}</div>
        </div>

        <div className="gsGrade">
          <div className="gsGradeLabel">Grade</div>
          <select
            className="gsSelect"
            value={selectedGrade}
            onChange={(e) => setSelectedGrade(e.target.value)}
          >
            {gradeOptions.map((grade) => (
              <option key={grade} value={grade}>
                {grade}
              </option>
            ))}
          </select>

          <div className="gsGradeLabel">Quarter</div>
          <select
            className="gsSelect"
            value={selectedQuarter}
            onChange={(e) => setSelectedQuarter(e.target.value)}
          >
            {QUARTERS.map((quarter) => (
              <option key={quarter} value={quarter}>
                {quarter}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="gsAxis">
        <div className="gsAxisLine" />
        <div className="gsTicks">
          {ticks.map((tick) => {
            const pct = (tick / niceMax) * 100;
            return (
              <div key={tick} className="gsTick" style={{ left: `${pct}%` }}>
                <div className="gsTickLine" />
                <div className="gsTickLabel">{nf.format(tick)}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="gsChartScroll">
        {bySubject.length === 0 ? (
          <div className="gsEmpty">No data found for this filter.</div>
        ) : (
          bySubject.map((item) => {
            const value = mode === "GAPS" ? item.gap : item.surplus;
            const pct = Math.max(0, Math.min(100, (value / niceMax) * 100));
            const showInside = pct >= 18;

            return (
              <div key={item.subject} className="gsRow">
                <div className="gsSubject" title={item.subject}>
                  {item.subject}
                </div>

                <div className="gsBarArea">
                  <div className="gsBarBg">
                    <div
                      className={`gsBar ${mode === "GAPS" ? "gap" : "surplus"}`}
                      style={{ width: `${pct}%` }}
                    >
                      {showInside && (
                        <span className="gsBarValue">{nf.format(value)}</span>
                      )}
                    </div>
                  </div>

                  {!showInside && (
                    <div className="gsValueOutside">{nf.format(value)}</div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default LASGapsSurplusChart;
