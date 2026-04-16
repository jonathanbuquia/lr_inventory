import { useEffect, useMemo, useState } from "react";
import "./ADMSLMSourceYearPieCharts.css";
import {
  QUARTERS,
  buildSchoolSheetUrl,
  findQuarterKey,
  formatGradeLabel,
  getGradeValue,
  getSheetRows,
  getSubjectValue,
  gradeSortValue,
  toNumber,
} from "../../../../utils/dashboardData";

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

const getReceived = (row, quarter) => {
  const key = findQuarterKey({
    row,
    baseMatchers: [/received/i],
    hintMatchers: [/(adm|slm)/i],
    quarter,
  });

  return toNumber(key ? row[key] : 0);
};

const getSource = (row, quarter) => {
  const key = findQuarterKey({
    row,
    baseMatchers: [/source/i],
    hintMatchers: [/(adm|slm)/i],
    quarter,
  });

  return String(key ? row[key] : "").trim();
};

const getYear = (row, quarter) => {
  const key = findQuarterKey({
    row,
    baseMatchers: [/year of delivery/i],
    hintMatchers: [/(adm|slm)/i],
    quarter,
  });

  return String(key ? row[key] : "").trim();
};

const makeAggQuarterAware = (rows, quarter, labelFn) => {
  const totals = new Map();
  const activeQuarters = quarter === "ALL" ? QUARTERS.slice(1) : [quarter];

  rows.forEach((row) => {
    activeQuarters.forEach((value) => {
      const weight = getReceived(row, value);
      if (!weight || weight <= 0) return;

      const label = labelFn(row, value) || "UNKNOWN";
      totals.set(label, (totals.get(label) || 0) + weight);
    });
  });

  const items = Array.from(totals.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  return {
    items,
    total: items.reduce((sum, item) => sum + item.value, 0),
  };
};

const polarToCartesian = (cx, cy, r, angleDeg) => {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
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
                slices.map((slice) => (
                  <path
                    key={slice.label}
                    d={arcPath(cx, cy, r, slice.startAngle, slice.endAngle)}
                    fill={slice.color}
                  />
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
          {data.total <= 0
            ? null
            : (
                <>
                  {slices.slice(0, 10).map((slice) => (
                    <div key={slice.label} className="pyLegendRow">
                      <span className="pyDot" style={{ background: slice.color }} />
                      <span className="pyLegendLabel" title={slice.label}>
                        {slice.label}
                      </span>
                      <span className="pyLegendValue">
                        {formatNumber(slice.value)}{" "}
                        <span className="pyLegendPct">({slice.pct}%)</span>
                      </span>
                    </div>
                  ))}
                  {slices.length > 10 && (
                    <div className="pyLegendMore">+ {slices.length - 10} more...</div>
                  )}
                </>
              )}
        </div>
      </div>
    </div>
  );
};

const ADMSLMSourceYearPieCharts = ({
  selectedDivisionSlug,
  selectedSchoolFolderName,
}) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [gradeLevel, setGradeLevel] = useState("ALL");
  const [quarter, setQuarter] = useState("ALL");

  useEffect(() => {
    let alive = true;

    const run = async () => {
      setErr("");
      setRows([]);
      setGradeLevel("ALL");
      setQuarter("ALL");

      if (!selectedDivisionSlug || !selectedSchoolFolderName || selectedSchoolFolderName === "ALL") {
        return;
      }

      try {
        setLoading(true);
        const url = buildSchoolSheetUrl(
          selectedDivisionSlug,
          selectedSchoolFolderName,
          "adm-slm.json"
        );
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to load ${url} (HTTP ${res.status})`);

        const json = await res.json();
        const cleaned = getSheetRows(json).filter(
          (row) => String(getSubjectValue(row)).trim() !== ""
        );

        if (!alive) return;
        setRows(cleaned);
      } catch (error) {
        if (!alive) return;
        setErr(error?.message || "Failed to load pie chart data.");
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
    const grades = new Set();

    rows.forEach((row) => {
      const grade = formatGradeLabel(getGradeValue(row));
      if (grade) grades.add(grade);
    });

    const values = Array.from(grades);
    if (!values.includes("KINDER")) values.push("KINDER");
    values.sort(
      (a, b) => gradeSortValue(a) - gradeSortValue(b) || a.localeCompare(b)
    );

    return ["ALL", ...values];
  }, [rows]);

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        const grade = formatGradeLabel(getGradeValue(row));
        return gradeLevel === "ALL" ? true : grade === gradeLevel;
      }),
    [rows, gradeLevel]
  );

  const sourceAgg = useMemo(
    () => makeAggQuarterAware(filteredRows, quarter, getSource),
    [filteredRows, quarter]
  );

  const yearAgg = useMemo(
    () => makeAggQuarterAware(filteredRows, quarter, getYear),
    [filteredRows, quarter]
  );

  if (!selectedDivisionSlug) return <div className="pyState">Select a division.</div>;
  if (!selectedSchoolFolderName || selectedSchoolFolderName === "ALL") {
    return <div className="pyState">Select a school to view pie charts.</div>;
  }

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
              {gradeOptions.map((grade) => (
                <option key={grade} value={grade}>
                  {grade === "ALL"
                    ? "ALL"
                    : grade === "KINDER"
                      ? "KINDER"
                      : `GRADE ${grade.replace(/^G/i, "")}`}
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
              {QUARTERS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading && <div className="pyState">Loading pie charts...</div>}
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
