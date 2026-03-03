import { useEffect, useMemo, useState } from "react";
import "./SourceYearPieCharts.css";

const safeEncode = (v) => encodeURIComponent(String(v ?? "").trim());

const buildTextbooksUrl = (divisionSlug, schoolFolder) => {
  return `/data/divisions/${safeEncode(divisionSlug)}/schools/${safeEncode(
    schoolFolder
  )}/textbooks.json`;
};

// JSON keys
const getGradeLevel = (r) => r?.["Grade Level"];
const getSubject = (r) => String(r?.["SUBJECTS"] ?? "").trim();
const getSource = (r) => String(r?.["SOURCE-TX (CO,RO, SDO)"] ?? "").trim();
const getYear = (r) => String(r?.["Year of Delivery-TX"] ?? "").trim();
const getReceived = (r) => Number(r?.["Quantity of Textbooks Received"] ?? 0);

const COLORS = [
  "#0b1f4d",
  "#1f4c99",
  "#2f6fb3",
  "#3a8bc2",
  "#5aa0d6",
  "#7cb7e6",
  "#98c8f0",
  "#b8dbf8",
  "#d4ecff",
];

const formatNumber = (n) => Number(n || 0).toLocaleString();

const makeAgg = (rows, keyFn) => {
  const map = new Map();

  rows.forEach((r) => {
    const keyRaw = keyFn(r);
    const key = keyRaw ? keyRaw : "UNKNOWN";
    const w = getReceived(r);

    // Weighted by received
    if (!w || w <= 0) return;

    map.set(key, (map.get(key) || 0) + w);
  });

  const items = Array.from(map.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  const total = items.reduce((s, x) => s + x.value, 0);
  return { items, total };
};

// SVG helpers
const polarToCartesian = (cx, cy, r, angleDeg) => {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180.0;
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
};

const arcPath = (cx, cy, r, startAngle, endAngle) => {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y} L ${cx} ${cy} Z`;
};

const Pie = ({ title, data }) => {
  const size = 220;
  const r = 95;
  const cx = size / 2;
  const cy = size / 2;

  const slices = useMemo(() => {
    const total = data.total || 0;
    if (total <= 0) return [];

    let angle = 0;
    return data.items.map((item, idx) => {
      const portion = item.value / total;
      const sweep = portion * 360;
      const startAngle = angle;
      const endAngle = angle + sweep;
      angle += sweep;

      return {
        ...item,
        startAngle,
        endAngle,
        color: COLORS[idx % COLORS.length],
        pct: Math.round(portion * 100),
      };
    });
  }, [data]);

  return (
    <div className="pyCard">
      <div className="pyCardTitle">{title}</div>

      <div className="pyBody">
        <div className="pySvgWrap">
          {data.total <= 0 ? (
            <div className="pyEmpty">No received data</div>
          ) : (
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="pySvg">
              {/* Fix: if only one slice, draw a full circle */}
              {slices.length === 1 ? (
                <circle cx={cx} cy={cy} r={r} fill={slices[0].color} />
              ) : (
                slices.map((s) => (
                  <path key={s.label} d={arcPath(cx, cy, r, s.startAngle, s.endAngle)} fill={s.color} />
                ))
              )}

              {/* donut hole */}
              <circle cx={cx} cy={cy} r={55} fill="#fff" />
              <text x={cx} y={cy - 2} textAnchor="middle" className="pyTotalLabel">
                TOTAL
              </text>
              <text x={cx} y={cy + 18} textAnchor="middle" className="pyTotalValue">
                {formatNumber(data.total)}
              </text>
            </svg>
          )}
        </div>

        <div className="pyLegend">
          {data.total <= 0 ? null : (
            <>
              {slices.slice(0, 10).map((s) => (
                <div key={s.label} className="pyLegendRow">
                  <span className="pyDot" style={{ background: s.color }} />
                  <span className="pyLegendLabel" title={s.label}>
                    {s.label}
                  </span>
                  <span className="pyLegendValue">
                    {formatNumber(s.value)} <span className="pyLegendPct">({s.pct}%)</span>
                  </span>
                </div>
              ))}
              {slices.length > 10 && <div className="pyLegendMore">+ {slices.length - 10} more…</div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const SourceYearPieCharts = ({ selectedDivisionSlug, selectedSchoolFolderName }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Filters
  const [gradeLevel, setGradeLevel] = useState("ALL");
  const [subject, setSubject] = useState("ALL");

  useEffect(() => {
    let alive = true;

    const run = async () => {
      setErr("");
      setRows([]);
      setGradeLevel("ALL");
      setSubject("ALL");

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
        setErr(e?.message || "Failed to load pie chart data.");
      } finally {
        if (alive) setLoading(false);
      }
    };

    run();
    return () => {
      alive = false;
    };
  }, [selectedDivisionSlug, selectedSchoolFolderName]);

  // Grade dropdown options (from all rows)
  const gradeOptions = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => {
      const g = getGradeLevel(r);
      if (g !== undefined && g !== null && g !== "") set.add(String(g));
    });
    return ["ALL", ...Array.from(set).sort((a, b) => Number(a) - Number(b))];
  }, [rows]);

  // ✅ Subjects depend on selected grade
  const subjectOptions = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => {
      const passGrade = gradeLevel === "ALL" ? true : String(getGradeLevel(r)) === String(gradeLevel);
      if (!passGrade) return;

      const s = getSubject(r);
      if (s) set.add(s);
    });
    return ["ALL", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [rows, gradeLevel]);

  // ✅ If current subject is not available after grade change, reset to ALL
  useEffect(() => {
    if (!subjectOptions.includes(subject)) setSubject("ALL");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectOptions.join("|")]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const passGrade = gradeLevel === "ALL" ? true : String(getGradeLevel(r)) === String(gradeLevel);
      const passSubject = subject === "ALL" ? true : getSubject(r) === subject;
      return passGrade && passSubject;
    });
  }, [rows, gradeLevel, subject]);

  const sourceAgg = useMemo(() => makeAgg(filteredRows, getSource), [filteredRows]);
  const yearAgg = useMemo(() => makeAgg(filteredRows, getYear), [filteredRows]);

  if (!selectedDivisionSlug) return <div className="pyState">Select a division.</div>;
  if (!selectedSchoolFolderName || selectedSchoolFolderName === "ALL")
    return <div className="pyState">Select a school to view pie charts.</div>;

  return (
    <div className="pyWrap">
      <div className="pyHeader">
        <div>
          <div className="pyHeaderTitle">SOURCE & DELIVERY YEAR</div>
          <div className="pyHeaderHint">Weighted by Quantity of Textbooks Received</div>
        </div>

        {/* ✅ Filters (both dropdowns) */}
        <div className="pyFilters">
          <div className="pyFilterGroup">
            <div className="pyFilterLabel">GRADE LEVEL</div>
            <select
              className="pySelect"
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

          <div className="pyFilterGroup">
            <div className="pyFilterLabel">SUBJECT</div>
            <select
              className="pySelect"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={loading || subjectOptions.length <= 1}
              title="Subject filter"
            >
              {subjectOptions.map((s) => (
                <option key={s} value={s}>
                  {s === "ALL" ? "ALL SUBJECTS" : s}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading && <div className="pyState">Loading pie charts…</div>}
      {err && <div className="pyError">{err}</div>}

      {!loading && !err && (
        <div className="pyGrid">
          <Pie title="SOURCE-TX (CO, RO, SDO)" data={sourceAgg} />
          <Pie title="YEAR OF DELIVERY-TX" data={yearAgg} />
        </div>
      )}
    </div>
  );
};

export default SourceYearPieCharts;