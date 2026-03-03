import { useEffect, useMemo, useState } from "react";
import "./LASSourceYearPieCharts.css";

const safeEncode = (v) => encodeURIComponent(String(v ?? "").trim());

const buildLASUrl = (divisionSlug, schoolFolder) => {
  return `/data/divisions/${safeEncode(divisionSlug)}/schools/${safeEncode(
    schoolFolder
  )}/las.json`;
};

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

// ---- Grade ordering (KINDER, G1..G12) ----
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

// ---- Quarter key finding (robust) ----
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

const getLASReceived = (row, q) => {
  const k = findKey(
    row,
    [/quantity of learning activity sheets received/i, /las/i],
    q
  );
  return toNumber(k ? row[k] : 0);
};

const getLASSource = (row, q) => {
  const k = findKey(row, [/source/i, /las/i], q);
  return String(k ? row[k] : "").trim();
};

const getLASYr = (row, q) => {
  const k = findKey(row, [/year of delivery/i, /las/i], q);
  return String(k ? row[k] : "").trim();
};

// ---- Aggregators (weighted by received) ----
const makeAggQuarterAware = (rows, quarter, labelFn) => {
  const map = new Map();
  const quarters = quarter === "ALL" ? ["Q1", "Q2", "Q3", "Q4"] : [quarter];

  rows.forEach((r) => {
    quarters.forEach((q) => {
      const w = getLASReceived(r, q); // weight
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

// ---- SVG Pie helpers ----
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
            <svg
              width={size}
              height={size}
              viewBox={`0 0 ${size} ${size}`}
              className="pySvg"
            >
              {/* Fix: if only one slice, draw full circle */}
              {slices.length === 1 ? (
                <circle cx={cx} cy={cy} r={r} fill={slices[0].color} />
              ) : (
                slices.map((s) => (
                  <path
                    key={s.label}
                    d={arcPath(cx, cy, r, s.startAngle, s.endAngle)}
                    fill={s.color}
                  />
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
                    {formatNumber(s.value)}{" "}
                    <span className="pyLegendPct">({s.pct}%)</span>
                  </span>
                </div>
              ))}
              {slices.length > 10 && (
                <div className="pyLegendMore">+ {slices.length - 10} more…</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const LASSourceYearPieCharts = ({ selectedDivisionSlug, selectedSchoolFolderName }) => {
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
        const url = buildLASUrl(selectedDivisionSlug, selectedSchoolFolderName);
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to load ${url} (HTTP ${res.status})`);

        const json = await res.json();
        const nextRows = Array.isArray(json?.rows) ? json.rows : Array.isArray(json) ? json : [];

        // keep subject rows only (pie should represent actual received by subject rows)
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

  // Grade dropdown options (ordered + includes KINDER + ALL)
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

  // Filter rows by grade only (quarter is applied inside aggregation)
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const g = formatGradeLabel(getGrade(r));
      return gradeLevel === "ALL" ? true : g === gradeLevel;
    });
  }, [rows, gradeLevel]);

  const sourceAgg = useMemo(
    () => makeAggQuarterAware(filteredRows, quarter, (r, q) => getLASSource(r, q)),
    [filteredRows, quarter]
  );

  const yearAgg = useMemo(
    () => makeAggQuarterAware(filteredRows, quarter, (r, q) => getLASYr(r, q)),
    [filteredRows, quarter]
  );

  if (!selectedDivisionSlug) return <div className="pyState">Select a division.</div>;
  if (!selectedSchoolFolderName || selectedSchoolFolderName === "ALL")
    return <div className="pyState">Select a school to view pie charts.</div>;

  return (
    <div className="pyWrap">
      <div className="pyHeader">
        <div>
          <div className="pyHeaderTitle">SOURCE & DELIVERY YEAR (LAS)</div>
          <div className="pyHeaderHint">Weighted by Quantity of LAS Received</div>
        </div>

        {/* ✅ Filters (ONLY grade + quarter) */}
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
          <Pie title="SOURCE-LAS" data={sourceAgg} />
          <Pie title="YEAR OF DELIVERY-LAS" data={yearAgg} />
        </div>
      )}
    </div>
  );
};

export default LASSourceYearPieCharts;