import React from "react";

const nf = new Intl.NumberFormat("en-US");

const toNumber = (v) => {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v).replace(/,/g, "").trim();
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

const getSubject = (row) =>
  row?.["SUBJECTS"] ?? row?.["Subjects"] ?? row?.["Subject"] ?? "";

const getGrade = (row) =>
  row?.["Grade Level"] ?? row?.["GradeLevel"] ?? row?.["GRADE LEVEL"] ?? "";

const getEnrolment = (row) =>
  row?.["Enrolment S.Y. 2025-2026"] ??
  row?.["Enrolment S.Y. 2025–2026"] ??
  row?.["Enrolment SY 2025-2026"] ??
  row?.["Enrolment"] ??
  row?.["Enrollment"] ??
  row?.["ENROLMENT"] ??
  0;

// quarter matching: Q1, Q 1, -Q1, - Q1, etc.
const quarterRegex = (q) => {
  const n = String(q).replace(/[^0-9]/g, "");
  return new RegExp(`\\bQ\\s*${n}\\b`, "i");
};

const findKey = (row, baseMatchers = [], q = "Q1") => {
  const keys = Object.keys(row || {});
  const qre = quarterRegex(q);

  for (const k of keys) {
    const kl = k.toLowerCase();
    const baseOk = baseMatchers.every((m) =>
      typeof m === "string" ? kl.includes(m.toLowerCase()) : m.test(k)
    );
    if (baseOk && qre.test(k)) return k;
  }

  for (const k of keys) {
    const kl = k.toLowerCase();
    const baseOk = baseMatchers.every((m) =>
      typeof m === "string" ? kl.includes(m.toLowerCase()) : m.test(k)
    );
    if (baseOk) return k;
  }

  return null;
};

const pickQuarter = (row, quarter) => {
  const targetKey = findKey(row, ["quantity based on target", "las"], quarter);

  const receivedKey = findKey(
    row,
    [/quantity of learning activity sheets received/i, /las/i],
    quarter
  );

  const gapKey = findKey(row, [/gap/i, /las/i], quarter);
  const surplusKey = findKey(row, [/surplus/i, /las/i], quarter);

  return {
    target: toNumber(targetKey ? row[targetKey] : 0),
    received: toNumber(receivedKey ? row[receivedKey] : 0),
    gap: toNumber(gapKey ? row[gapKey] : 0),
    surplus: toNumber(surplusKey ? row[surplusKey] : 0),
  };
};

const pickAll = (row) => {
  const q1 = pickQuarter(row, "Q1");
  const q2 = pickQuarter(row, "Q2");
  const q3 = pickQuarter(row, "Q3");
  const q4 = pickQuarter(row, "Q4");
  return {
    target: q1.target + q2.target + q3.target + q4.target,
    received: q1.received + q2.received + q3.received + q4.received,
    gap: q1.gap + q2.gap + q3.gap + q4.gap,
    surplus: q1.surplus + q2.surplus + q3.surplus + q4.surplus,
  };
};

const LASTable = ({ rows = [], quarter = "ALL" }) => {
  return (
    <div className="lasTableScroll">
      <table className="lasTable">
        <thead>
          <tr>
            <th>SUBJECT</th>
            <th className="lasNum">ENROLLEES</th>
            <th className="lasNum">TARGET QTY</th>
            <th className="lasNum">LAS RECEIVED</th>
            <th className="lasNum">GAP</th>
            <th className="lasNum">SURPLUS</th>
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="lasEmpty" colSpan={6}>
                No LAS rows found for this filter.
              </td>
            </tr>
          ) : (
            rows.map((r, idx) => {
              const subject = String(getSubject(r) ?? "").trim();
              const grade = String(getGrade(r) ?? "").trim();
              const enrol = toNumber(getEnrolment(r));
              const f = quarter === "ALL" ? pickAll(r) : pickQuarter(r, quarter);

              return (
                <tr key={idx}>
                  <td>
                    <div>
                      <div className="lasSubjectMain">{subject || "-"}</div>
                      <div className="lasSubjectSub">{grade ? `Grade ${grade}` : ""}</div>
                    </div>
                  </td>

                  <td className="lasNum">{enrol ? nf.format(enrol) : "—"}</td>
                  <td className="lasNum">{nf.format(f.target)}</td>
                  <td className="lasNum">{nf.format(f.received)}</td>
                  <td className="lasNum">{nf.format(f.gap)}</td>
                  <td className="lasNum">{nf.format(f.surplus)}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};

export default LASTable;