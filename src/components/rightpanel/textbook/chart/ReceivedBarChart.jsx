import { useEffect, useMemo, useState } from "react";
import "./ReceivedBarChart.css";

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
const getReceived = (r) => Number(r?.["Quantity of Textbooks Received"] ?? 0);

// Nice tick steps (10, 20, 50, 100...)
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

const ReceivedBarChart = ({ selectedDivisionSlug, selectedSchoolFolderName }) => {
  const [rows, setRows] = useState([]);
  const [gradeLevel, setGradeLevel] = useState("ALL");
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
        setErr(e?.message || "Failed to load chart data.");
      } finally {
        if (alive) setLoading(false);
      }
    };

    run();
    return () => {
      alive = false;
    };
  }, [selectedDivisionSlug, selectedSchoolFolderName]);

  // Available grades -> buttons
  const gradeOptions = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => {
      const g = getGradeLevel(r);
      if (g !== undefined && g !== null && g !== "") set.add(String(g));
    });
    return ["ALL", ...Array.from(set).sort((a, b) => Number(a) - Number(b))];
  }, [rows]);

  // Keep selected grade valid if the school changes
  useEffect(() => {
    if (!gradeOptions.includes(gradeLevel)) setGradeLevel("ALL");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradeOptions.join("|")]);

  const gradeFiltered = useMemo(() => {
    if (gradeLevel === "ALL") return rows;
    return rows.filter((r) => String(getGradeLevel(r)) === String(gradeLevel));
  }, [rows, gradeLevel]);

  // received per subject
  const data = useMemo(() => {
    const map = new Map();
    gradeFiltered.forEach((r) => {
      const subject = getSubject(r);
      if (!subject) return;
      map.set(subject, (map.get(subject) || 0) + getReceived(r));
    });

    return Array.from(map.entries())
      .map(([subject, received]) => ({ subject, received }))
      .sort((a, b) => b.received - a.received);
  }, [gradeFiltered]);

  const maxVal = useMemo(() => data.reduce((m, x) => Math.max(m, x.received), 0), [data]);

  const { axisMax, ticks } = useMemo(() => {
    const step = niceStep(maxVal);
    const axisMax = maxVal === 0 ? step : Math.ceil(maxVal / step) * step;
    const ticks = [];
    for (let t = 0; t <= axisMax; t += step) ticks.push(t);
    return { axisMax, ticks };
  }, [maxVal]);

  if (!selectedDivisionSlug) return <div className="rcState">Select a division.</div>;
  if (!selectedSchoolFolderName || selectedSchoolFolderName === "ALL")
    return <div className="rcState">Select a school to view the chart.</div>;

  return (
    <div className="rcWrap">
      <div className="rcHeader">
        <div className="rcTitle">RECEIVED PER SUBJECT</div>
      </div>

      {/* ✅ Grade buttons (instead of dropdown) */}
      <div className="rcGradeBar" aria-label="Grade level filter buttons">
        {gradeOptions.map((g) => {
          const active = String(g) === String(gradeLevel);
          const label = g === "ALL" ? "ALL" : `G${g}`;

          return (
            <button
              key={g}
              type="button"
              className={`rcGradeBtn ${active ? "active" : ""}`}
              onClick={() => setGradeLevel(String(g))}
              disabled={loading}
              title={g === "ALL" ? "All grades" : `Grade ${g}`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {loading && <div className="rcState">Loading chart…</div>}
      {err && <div className="rcError">{err}</div>}

      {!loading && !err && (
        <>
          <div className="rcAxis">
            <div className="rcAxisLine" />
            <div className="rcTicks">
              {ticks.map((t) => (
                <div
                  key={t}
                  className="rcTick"
                  style={{ left: `${axisMax === 0 ? 0 : (t / axisMax) * 100}%` }}
                >
                  <div className="rcTickLine" />
                  <div className="rcTickLabel">{t}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rcChartScroll">
            {data.length === 0 ? (
              <div className="rcEmpty">No received data for this grade.</div>
            ) : (
              data.map((x) => {
                const pct = axisMax === 0 ? 0 : (x.received / axisMax) * 100;
                const showInside = pct >= 18;

                return (
                  <div key={x.subject} className="rcRow">
                    <div className="rcSubject" title={x.subject}>
                      {x.subject}
                    </div>

                    <div className="rcBarArea">
                      <div className="rcBarBg">
                        <div className="rcBar" style={{ width: `${pct}%`, background: NAVY }}>
                          {showInside && (
                            <span className="rcBarValue">{x.received.toLocaleString()}</span>
                          )}
                        </div>
                      </div>

                      {!showInside && (
                        <div className="rcValueOutside">{x.received.toLocaleString()}</div>
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

export default ReceivedBarChart;