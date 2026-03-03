import React, { useEffect, useMemo, useState } from "react";
import "./LASGapsSurplusChart.css";

const nf = new Intl.NumberFormat("en-US");
const QUARTERS = ["ALL", "Q1", "Q2", "Q3", "Q4"];

const norm = (s) =>
  String(s ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");

const toNumber = (v) => {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v).replace(/,/g, "").trim();
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

const getGrade = (row) =>
  row?.["Grade Level"] ?? row?.["GradeLevel"] ?? row?.["GRADE LEVEL"] ?? "";

const getSubject = (row) =>
  row?.["SUBJECTS"] ?? row?.["Subjects"] ?? row?.["Subject"] ?? "";

// ---- Grade helpers (KINDER, G1..G12) ----
const gradeSortValue = (raw) => {
  const s = norm(raw);
  if (!s) return 9999;

  if (s === "KINDER" || s === "K" || s.includes("KINDER")) return 0;

  const cleaned = s
    .replace(/^GRADE\s*/i, "")
    .replace(/\s+/g, "")
    .replace(/^G/i, "");

  const n = Number(cleaned);
  if (Number.isFinite(n)) return n;

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

// ---- Quarter key matching ----
const quarterRegex = (q) => {
  const n = String(q).replace(/[^0-9]/g, "");
  return new RegExp(`\\bQ\\s*${n}\\b`, "i");
};

const findKey = (row, baseMatchers = [], q = "Q1") => {
  const keys = Object.keys(row || {});
  const qre = quarterRegex(q);

  // base + quarter
  for (const k of keys) {
    const kl = k.toLowerCase();
    const baseOk = baseMatchers.every((m) =>
      typeof m === "string" ? kl.includes(m.toLowerCase()) : m.test(k)
    );
    if (baseOk && qre.test(k)) return k;
  }

  // fallback base only
  for (const k of keys) {
    const kl = k.toLowerCase();
    const baseOk = baseMatchers.every((m) =>
      typeof m === "string" ? kl.includes(m.toLowerCase()) : m.test(k)
    );
    if (baseOk) return k;
  }

  return null;
};

const pickQuarterGapSurplus = (row, q) => {
  const gapKey = findKey(row, [/gap/i, /las/i], q);
  const surplusKey = findKey(row, [/surplus/i, /las/i], q);

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

// nice axis tick rounding (0..niceMax)
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
  const [mode, setMode] = useState("GAPS"); // "GAPS" | "SURPLUS"
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
        const arr = Array.isArray(data)
          ? data
          : Array.isArray(data?.rows)
            ? data.rows
            : [];

        // chart needs subjects
        const cleaned = arr.filter((r) => String(getSubject(r)).trim() !== "");

        if (!alive) return;

        setRows(cleaned);
        setMode("GAPS");
        setSelectedGrade("ALL");
        setSelectedQuarter("ALL");
        setStatus({ loading: false, error: "" });
      } catch (e) {
        console.error("LAS GAPS/SURPLUS ERROR:", e);
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

  const gradeOptions = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => {
      const g = String(getGrade(r)).trim();
      if (g) set.add(formatGradeLabel(g));
    });
    const arr = Array.from(set);

    // include KINDER option even if no subject rows exist
    if (!arr.includes("KINDER")) arr.push("KINDER");

    arr.sort((a, b) => gradeSortValue(a) - gradeSortValue(b) || a.localeCompare(b));
    return ["ALL", ...arr];
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (selectedGrade === "ALL") return rows;
    return rows.filter((r) => formatGradeLabel(getGrade(r)) === selectedGrade);
  }, [rows, selectedGrade]);

  const bySubject = useMemo(() => {
    const map = new Map();

    for (const r of filteredRows) {
      const subj = String(getSubject(r)).trim();
      if (!subj) continue;

      const vals =
        selectedQuarter === "ALL"
          ? pickAllGapSurplus(r)
          : pickQuarterGapSurplus(r, selectedQuarter);

      const prev = map.get(subj) || { subject: subj, gap: 0, surplus: 0 };
      prev.gap += vals.gap;
      prev.surplus += vals.surplus;
      map.set(subj, prev);
    }

    const arr = Array.from(map.values());

    arr.sort((a, b) => {
      const av = mode === "GAPS" ? a.gap : a.surplus;
      const bv = mode === "GAPS" ? b.gap : b.surplus;
      return bv - av;
    });

    return arr;
  }, [filteredRows, selectedQuarter, mode]);

  const totalValue = useMemo(() => {
    return bySubject.reduce((sum, s) => {
      const v = mode === "GAPS" ? s.gap : s.surplus;
      return sum + (Number.isFinite(v) ? v : 0);
    }, 0);
  }, [bySubject, mode]);

  const rawMax = useMemo(() => {
    let max = 0;
    for (const s of bySubject) {
      const v = mode === "GAPS" ? s.gap : s.surplus;
      if (v > max) max = v;
    }
    return max;
  }, [bySubject, mode]);

  const niceMax = useMemo(() => niceCeil(rawMax), [rawMax]);
  const ticks = useMemo(() => makeTicks(niceMax, 5), [niceMax]);

  if (status.loading) return <div className="gsState">Loading LAS gaps/surplus…</div>;
  if (status.error) return <div className="gsError">{status.error}</div>;

  return (
    <div className="gsWrap">
      <div className="gsTop">
        {/* Left: buttons */}
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

        {/* Center: total card */}
        <div className="gsTotalCard">
          <div className="gsTotalLabel">TOTAL {mode}</div>
          <div className="gsTotalValue">{nf.format(totalValue)}</div>
        </div>

        {/* Right: Grade + Quarter */}
        <div className="gsGrade">
          <div className="gsGradeLabel">Grade</div>
          <select
            className="gsSelect"
            value={selectedGrade}
            onChange={(e) => setSelectedGrade(e.target.value)}
          >
            {gradeOptions.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>

          <div className="gsGradeLabel">Quarter</div>
          <select
            className="gsSelect"
            value={selectedQuarter}
            onChange={(e) => setSelectedQuarter(e.target.value)}
          >
            {QUARTERS.map((q) => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Axis */}
      <div className="gsAxis">
        <div className="gsAxisLine" />
        <div className="gsTicks">
          {ticks.map((t) => {
            const pct = (t / niceMax) * 100;
            return (
              <div key={t} className="gsTick" style={{ left: `${pct}%` }}>
                <div className="gsTickLine" />
                <div className="gsTickLabel">{nf.format(t)}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bars */}
      <div className="gsChartScroll">
        {bySubject.length === 0 ? (
          <div className="gsEmpty">No data found for this filter.</div>
        ) : (
          bySubject.map((s) => {
            const value = mode === "GAPS" ? s.gap : s.surplus;
            const pct = Math.max(0, Math.min(100, (value / niceMax) * 100));

            // show inside label only when bar is wide enough
            const showInside = pct >= 18;

            return (
              <div key={s.subject} className="gsRow">
                <div className="gsSubject" title={s.subject}>
                  {s.subject}
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