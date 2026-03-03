import { useEffect, useMemo, useState } from "react";
import "./ADMSLMSourceYearPieCharts.css";

const safeEncode = (v) => encodeURIComponent(String(v ?? "").trim());
const buildUrl = (divisionSlug, schoolFolder) =>
  `/data/divisions/${safeEncode(divisionSlug)}/schools/${safeEncode(
    schoolFolder
  )}/adm-slm.json`;

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

const nf = new Intl.NumberFormat("en-US");
const formatNumber = (n) => nf.format(Number(n || 0));

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

// Grade order
const gradeSortValue = (raw) => {
  const s = norm(raw);
  if (!s) return 9999;
  if (s === "KINDER" || s === "K" || s.includes("KINDER")) return 0;

  const cleaned = s
    .replace(/^GRADE\s*/i, "")
    .replace(/\s+/g, "")
    .replace(/^G/i, "");

  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 9999;
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

// Quarter key matching (robust)
const quarterRegex = (q) => {
  const n = String(q).replace(/[^0-9]/g, "");
  return new RegExp(`\\bQ\\s*${n}\\b`, "i");
};

// tries with ADM/SLM hint first, then fallback
const findKey = (row, baseMatchers = [], q = "Q1") => {
  const keys = Object.keys(row || {});
  const qre = quarterRegex(q);

  const passAll = (k, matchers) => {
    const kl = k.toLowerCase();
    return matchers.every((m) =>
      typeof m === "string" ? kl.includes(m.toLowerCase()) : m.test(k)
    );
  };

  const withHint = [...baseMatchers, /(adm|slm)/i];

  for (const k of keys) if (passAll(k, withHint) && qre.test(k)) return k;
  for (const k of keys) if (passAll(k, baseMatchers) && qre.test(k)) return k;
  for (const k of keys) if (passAll(k, withHint)) return k;
  for (const k of keys) if (passAll(k, baseMatchers)) return k;

  return null;
};

const getReceived = (row, q) => {
  // weight by received (any received column with quarter)
  const k = findKey(row, [/received/i], q);
  return toNumber(k ? row[k] : 0);
};

const getSource = (row, q) => {
  const k = findKey(row, [/source/i], q);
  return String(k ? row[k] : "").trim();
};

const getYear = (row, q) => {
  const k = findKey(row, [/year of delivery/i], q);
  return String(k ? row[k] : "").trim();
};

const makeAggQuarterAware = (rows, quarter, labelFn) => {
  const map = new Map();
  const quarters = quarter === "ALL" ? ["Q1", "Q2", "Q3", "Q4"] : [quarter];

  rows.forEach((r) => {
    quarters.forEach((q) => {
      const w = getReceived(r, q);
      if (!w || w <= 0) return;

      const labelRaw = labelFn(r, q);
      const label = labelRaw ? labelRaw : "UNKNOWN";

      map.set(label, (map.get(label) || 0) + w);
    });
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
              {slices.length === 1 ? (
                <circle cx={cx} cy={cy} r={r} fill={slices[0].color} />
              ) : (
                slices.map((s) => (
                  <path key={s.label} d={arcPath(cx, cy, r, s.startAngle, s.endAngle)} fill={s.color} />
                ))
              )}

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

const ADMSLMSourceYearPieCharts = ({ selectedDivisionSlug, selectedSchoolFolderName }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Filters (ONLY grade + quarter)
  const [gradeLevel, setGradeLevel] = useState("ALL");
  const [quarter, setQuarter] = useState("ALL");

  useEffect(() => {
    let alive = true;

    const run = async () => {
      setErr("");
      setRows([]);
      setGradeLevel("ALL");
      setQuarter("ALL");

      if (!selectedDivisionSlug || !selectedSchoolFolderName || selectedSchoolFolderName === "ALL") return;

      try {
        setLoading(true);
        const url = buildUrl(selectedDivisionSlug, selectedSchoolFolderName);
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to load ${url} (HTTP ${res.status})`);

        const json = await res.json();
        const nextRows = Array.isArray(json?.rows) ? json.rows : Array.isArray(json) ? json : [];

        const cleaned = nextRows.filter((r) => String(getSubject(r)).trim() !== "");

        if (!alive) return;
        setRows(cleaned);
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

  const gradeOptions = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => {
      const g = formatGradeLabel(getGrade(r));
      if (g) set.add(g);
    });

    const arr = Array.from(set);
    if (!arr.includes("KINDER")) arr.push("KINDER");

    arr.sort((a, b) => gradeSortValue(a) - gradeSortValue(b) || a.localeCompare(b));
    return ["ALL", ...arr];
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const g = formatGradeLabel(getGrade(r));
      return gradeLevel === "ALL" ? true : g === gradeLevel;
    });
  }, [rows, gradeLevel]);

  const sourceAgg = useMemo(
    () => makeAggQuarterAware(filteredRows, quarter, (r, q) => getSource(r, q)),
    [filteredRows, quarter]
  );

  const yearAgg = useMemo(
    () => makeAggQuarterAware(filteredRows, quarter, (r, q) => getYear(r, q)),
    [filteredRows, quarter]
  );

  if (!selectedDivisionSlug) return <div className="pyState">Select a division.</div>;
  if (!selectedSchoolFolderName || selectedSchoolFolderName === "ALL")
    return <div className="pyState">Select a school to view pie charts.</div>;

  return (
    <div className="pyWrap">
      <div className="pyHeader">
        <div>
          <div className="pyHeaderTitle">SOURCE & DELIVERY YEAR (ADM-SLM)</div>
          <div className="pyHeaderHint">Weighted by Quantity Received</div>
        </div>

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
                  {g === "ALL" ? "ALL" : g === "KINDER" ? "KINDER" : `GRADE ${g.replace(/^G/i, "")}`}
                </option>
              ))}
            </select>
          </div>

          <div className="pyFilterGroup">
            <div className="pyFilterLabel">QUARTER</div>
            <select
              className="pySelect"
              value={quarter}
              onChange={(e) => setQuarter(e.target.value)}
              disabled={loading}
            >
              {["ALL", "Q1", "Q2", "Q3", "Q4"].map((q) => (
                <option key={q} value={q}>
                  {q}
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
          <Pie title="SOURCE (ADM-SLM)" data={sourceAgg} />
          <Pie title="YEAR OF DELIVERY (ADM-SLM)" data={yearAgg} />
        </div>
      )}
    </div>
  );
};

export default ADMSLMSourceYearPieCharts;