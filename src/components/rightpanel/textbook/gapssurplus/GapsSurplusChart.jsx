import { useEffect, useMemo, useState } from "react";
import "./GapsSurplusChart.css";

const NAVY = "#0b1f4d";

const safeEncode = (v) => encodeURIComponent(String(v ?? "").trim());

const buildTextbooksUrl = (divisionSlug, schoolFolder) => {
  return `/data/divisions/${safeEncode(divisionSlug)}/schools/${safeEncode(
    schoolFolder
  )}/textbooks.json`;
};

// JSON keys
const getGradeLevel = (r) => r?.["Grade Level"];
const getSubject = (r) => (r?.["SUBJECTS"] ?? "").trim();
const getGap = (r) => Number(r?.["GAP-TX"] ?? 0);
const getSurplus = (r) => Number(r?.["Surplus-TX"] ?? 0);

// nice tick steps
const niceStep = (max) => {
  if (max <= 0) return 1;
  const rough = max / 5;
  const pow10 = Math.pow(10, Math.floor(Math.log10(rough)));
  const n = rough / pow10;

  let base = 1;
  if (n <= 1) base = 1;
  else if (n <= 2) base = 2;
  else if (n <= 5) base = 5;
  else base = 10;

  return base * pow10;
};

const GapsSurplusChart = ({ selectedDivisionSlug, selectedSchoolFolderName }) => {
  const [rows, setRows] = useState([]);
  const [gradeLevel, setGradeLevel] = useState("ALL");
  const [mode, setMode] = useState("gaps"); // "gaps" | "surplus"
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;

    const run = async () => {
      setErr("");
      setRows([]);
      setGradeLevel("ALL");

      if (!selectedDivisionSlug || !selectedSchoolFolderName || selectedSchoolFolderName === "ALL") return;

      try {
        setLoading(true);
        const url = buildTextbooksUrl(selectedDivisionSlug, selectedSchoolFolderName);
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to load ${url} (HTTP ${res.status})`);

        const json = await res.json();
        const nextRows = Array.isArray(json?.rows) ? json.rows : [];

        if (!alive) return;
        setRows(nextRows);
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "Failed to load gaps/surplus data.");
      } finally {
        if (alive) setLoading(false);
      }
    };

    run();
    return () => {
      alive = false;
    };
  }, [selectedDivisionSlug, selectedSchoolFolderName]);

  const gradeOptions = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => {
      const g = getGradeLevel(r);
      if (g !== undefined && g !== null && g !== "") set.add(String(g));
    });
    return ["ALL", ...Array.from(set).sort((a, b) => Number(a) - Number(b))];
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (gradeLevel === "ALL") return rows;
    return rows.filter((r) => String(getGradeLevel(r)) === String(gradeLevel));
  }, [rows, gradeLevel]);

  const metricValue = (r) => (mode === "gaps" ? getGap(r) : getSurplus(r));

  const totalMetric = useMemo(() => {
    return filteredRows.reduce((sum, r) => sum + Number(metricValue(r) || 0), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredRows, mode]);

  // per subject
  const data = useMemo(() => {
    const map = new Map(); // subject -> sum(metric)
    filteredRows.forEach((r) => {
      const subject = getSubject(r);
      if (!subject) return;
      map.set(subject, (map.get(subject) || 0) + Number(metricValue(r) || 0));
    });

    return Array.from(map.entries())
      .map(([subject, value]) => ({ subject, value }))
      .sort((a, b) => b.value - a.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredRows, mode]);

  const maxVal = useMemo(() => data.reduce((m, x) => Math.max(m, x.value), 0), [data]);

  const { axisMax, ticks } = useMemo(() => {
    const step = niceStep(maxVal);
    const axisMax = maxVal === 0 ? step : Math.ceil(maxVal / step) * step;
    const ticks = [];
    for (let t = 0; t <= axisMax; t += step) ticks.push(t);
    return { axisMax, ticks };
  }, [maxVal]);

  if (!selectedDivisionSlug) return <div className="gsState">Select a division.</div>;
  if (!selectedSchoolFolderName || selectedSchoolFolderName === "ALL")
    return <div className="gsState">Select a school to view gaps/surplus.</div>;

  return (
    <div className="gsWrap">
      {/* TOP BAR */}
      <div className="gsTop">
        {/* Left: big buttons */}
        <div className="gsModeBtns">
          <button
            type="button"
            className={`gsModeBtn ${mode === "gaps" ? "active" : ""}`}
            onClick={() => setMode("gaps")}
            disabled={loading}
          >
            GAPS
          </button>
          <button
            type="button"
            className={`gsModeBtn ${mode === "surplus" ? "active" : ""}`}
            onClick={() => setMode("surplus")}
            disabled={loading}
          >
            SURPLUS
          </button>
        </div>

        {/* Center: total card */}
        <div className="gsTotalCard" aria-label="Total gaps or surplus">
          <div className="gsTotalLabel">
            TOTAL {mode === "gaps" ? "GAPS" : "SURPLUS"}
          </div>
          <div className="gsTotalValue">{Number(totalMetric || 0).toLocaleString()}</div>
        </div>

        {/* Right: grade dropdown */}
        <div className="gsGrade">
          <div className="gsGradeLabel">GRADE LEVEL</div>
          <select
            className="gsSelect"
            value={gradeLevel}
            onChange={(e) => setGradeLevel(e.target.value)}
            disabled={loading || gradeOptions.length <= 1}
          >
            {gradeOptions.map((g) => (
              <option key={g} value={g}>
                {g === "ALL" ? "ALL" : `GRADE ${g}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && <div className="gsState">Loading…</div>}
      {err && <div className="gsError">{err}</div>}

      {!loading && !err && (
        <>
          {/* Axis */}
          <div className="gsAxis">
            <div className="gsAxisLine" />
            <div className="gsTicks">
              {ticks.map((t) => (
                <div
                  key={t}
                  className="gsTick"
                  style={{ left: `${axisMax === 0 ? 0 : (t / axisMax) * 100}%` }}
                >
                  <div className="gsTickLine" />
                  <div className="gsTickLabel">{t}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Bars */}
          <div className="gsChartScroll">
            {data.length === 0 ? (
              <div className="gsEmpty">No data for this grade.</div>
            ) : (
              data.map((x) => {
                const pct = axisMax === 0 ? 0 : (x.value / axisMax) * 100;
                const showInside = pct >= 18;

                return (
                  <div key={x.subject} className="gsRow">
                    <div className="gsSubject" title={x.subject}>
                      {x.subject}
                    </div>

                    <div className="gsBarArea">
                      <div className="gsBarBg">
                        <div className="gsBar" style={{ width: `${pct}%`, background: NAVY }}>
                          {showInside && (
                            <span className="gsBarValue">{Number(x.value || 0).toLocaleString()}</span>
                          )}
                        </div>
                      </div>

                      {!showInside && (
                        <div className="gsValueOutside">{Number(x.value || 0).toLocaleString()}</div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default GapsSurplusChart;