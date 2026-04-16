import React from "react";
import {
  findQuarterKey,
  getEnrolmentValue,
  getGradeValue,
  getSubjectValue,
  toNumber,
} from "../../../../utils/dashboardData";

const nf = new Intl.NumberFormat("en-US");

const pickQuarter = (row, quarter) => {
  const targetKey = findQuarterKey({
    row,
    baseMatchers: ["quantity based on target", "las"],
    quarter,
  });

  const receivedKey = findQuarterKey({
    row,
    baseMatchers: [/quantity of learning activity sheets received/i, /las/i],
    quarter,
  });

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
            rows.map((row, index) => {
              const subject = String(getSubjectValue(row) ?? "").trim();
              const grade = String(getGradeValue(row) ?? "").trim();
              const enrolment = toNumber(getEnrolmentValue(row));
              const values = quarter === "ALL" ? pickAll(row) : pickQuarter(row, quarter);

              return (
                <tr key={index}>
                  <td>
                    <div>
                      <div className="lasSubjectMain">{subject || "-"}</div>
                      <div className="lasSubjectSub">
                        {grade ? `Grade ${grade}` : ""}
                      </div>
                    </div>
                  </td>

                  <td className="lasNum">
                    {enrolment ? nf.format(enrolment) : "-"}
                  </td>
                  <td className="lasNum">{nf.format(values.target)}</td>
                  <td className="lasNum">{nf.format(values.received)}</td>
                  <td className="lasNum">{nf.format(values.gap)}</td>
                  <td className="lasNum">{nf.format(values.surplus)}</td>
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
