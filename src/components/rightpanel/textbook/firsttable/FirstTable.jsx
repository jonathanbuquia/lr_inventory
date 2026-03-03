import { useEffect, useMemo, useState } from "react";
import "./FirstTable.css";

const safeEncode = (v) => encodeURIComponent(String(v ?? "").trim());

const buildTextbooksUrl = (divisionSlug, schoolIdOrName) => {
  return `/data/divisions/${safeEncode(divisionSlug)}/schools/${safeEncode(
    schoolIdOrName
  )}/textbooks.json`;
};

// Exact keys from your JSON rows
const getGradeLevel = (r) => r?.["Grade Level"];
const getSubject = (r) => r?.["SUBJECTS"] ?? "";
const getEnrolled = (r) => Number(r?.["Enrolment S.Y. 2025-2026"] ?? 0);
const getReceived = (r) => Number(r?.["Quantity of Textbooks Received"] ?? 0);
const getGaps = (r) => Number(r?.["GAP-TX"] ?? 0);
const getSurplus = (r) => Number(r?.["Surplus-TX"] ?? 0);

const FirstTable = ({ selectedDivisionSlug, selectedSchoolFolderName }) => {
  const [rawRows, setRawRows] = useState([]);
  const [gradeLevel, setGradeLevel] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;

    const run = async () => {
      setErr("");
      setRawRows([]);
      setGradeLevel("ALL");

      if (!selectedDivisionSlug || !selectedSchoolFolderName) return;

      try {
        setLoading(true);
        const url = buildTextbooksUrl(selectedDivisionSlug, selectedSchoolFolderName);
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to load ${url} (HTTP ${res.status})`);

        const json = await res.json();
        const rows = Array.isArray(json?.rows) ? json.rows : [];

        if (!alive) return;
        setRawRows(rows);
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "Failed to load textbooks data.");
      } finally {
        if (alive) setLoading(false);
      }
    };

    run();
    return () => {
      alive = false;
    };
  }, [selectedDivisionSlug, selectedSchoolFolderName]);

  // Grade dropdown options
  const gradeOptions = useMemo(() => {
    const set = new Set();
    rawRows.forEach((r) => {
      const g = getGradeLevel(r);
      if (g !== undefined && g !== null && g !== "") set.add(String(g));
    });
    return ["ALL", ...Array.from(set).sort((a, b) => Number(a) - Number(b))];
  }, [rawRows]);

  // ✅ Enrolled summary per grade:
  // "If you see a data you need on grade 1 then that's it move on to next grade level"
  const enrolledByGrade = useMemo(() => {
    const map = new Map(); // grade -> enrolled
    rawRows.forEach((r) => {
      const g = getGradeLevel(r);
      if (g === undefined || g === null || g === "") return;
      const key = String(g);

      // only take the FIRST row we encounter for that grade
      if (!map.has(key)) map.set(key, getEnrolled(r));
    });

    // return as sorted array
    return Array.from(map.entries())
      .map(([grade, enrolled]) => ({ grade, enrolled }))
      .sort((a, b) => Number(a.grade) - Number(b.grade));
  }, [rawRows]);

  // Filter table rows by selected grade
  const filteredRows = useMemo(() => {
    if (gradeLevel === "ALL") return rawRows;
    return rawRows.filter((r) => String(getGradeLevel(r)) === String(gradeLevel));
  }, [rawRows, gradeLevel]);

  if (!selectedDivisionSlug) return <div className="ftState">Select a division.</div>;
  if (!selectedSchoolFolderName) return <div className="ftState">Select a school.</div>;

  return (
    <div className="ftWrap">
      <div className="ftTop">
        <div className="ftTopLeft">
          <div className="ftLabel">GRADE LEVEL</div>
          <select
            className="ftSelect"
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

        {/* ✅ Summary beside dropdown */}
        <div className="ftGradeSummary" aria-label="Enrolled summary per grade level">
          {enrolledByGrade.length === 0 ? (
            <span className="ftGradeChip muted">No enrolled summary</span>
          ) : (
            enrolledByGrade.map((x) => (
              <span key={x.grade} className="ftGradeChip">
                <b>G{x.grade}:</b>&nbsp;{Number(x.enrolled || 0).toLocaleString()}
              </span>
            ))
          )}
        </div>
      </div>

      {loading && <div className="ftState">Loading textbooks…</div>}
      {err && <div className="ftError">{err}</div>}

      {!loading && !err && (
        <div className="ftTableScroll">
          <table className="ftTable">
            <thead>
              <tr>
                <th>SUBJECT</th>
                <th className="num">ENROLLED</th>
                <th className="num">RECEIVED</th>
                <th className="num">GAPS</th>
                <th className="num">SURPLUS</th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td className="ftEmpty" colSpan={5}>
                    No rows found.
                  </td>
                </tr>
              ) : (
                filteredRows.map((r, i) => (
                  <tr key={`${getGradeLevel(r)}-${getSubject(r)}-${i}`}>
                    <td className="subj">
                      <div className="subjMain">{getSubject(r)}</div>
                      <div className="subjSub">Grade {String(getGradeLevel(r))}</div>
                    </td>

                    <td className="num">{getEnrolled(r).toLocaleString()}</td>
                    <td className="num">{getReceived(r).toLocaleString()}</td>
                    <td className="num">{getGaps(r).toLocaleString()}</td>
                    <td className="num">{getSurplus(r).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default FirstTable;