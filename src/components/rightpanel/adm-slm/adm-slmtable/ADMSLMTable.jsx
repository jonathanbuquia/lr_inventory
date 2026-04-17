import React from "react";
import {
  getAdmSlmValuesForQuarter,
  getEnrolmentValue,
  getGradeValue,
  getSubjectValue,
  toNumber,
} from "../../../../utils/dashboardData";

const nf = new Intl.NumberFormat("en-US");

const ADMSLMTable = ({ rows = [], quarter = "ALL" }) => {
  return (
    <div className="lasTableScroll">
      <table className="lasTable">
        <thead>
          <tr>
            <th>SUBJECT</th>
            <th className="lasNum">ENROLLEES</th>
            <th className="lasNum">TARGET QTY</th>
            <th className="lasNum">RECEIVED</th>
            <th className="lasNum">GAP</th>
            <th className="lasNum">SURPLUS</th>
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="lasEmpty" colSpan={6}>
                No ADM-SLM rows found for this filter.
              </td>
            </tr>
          ) : (
            rows.map((row, index) => {
              const subject = String(getSubjectValue(row) ?? "").trim();
              const grade = String(getGradeValue(row) ?? "").trim();
              const enrolment = toNumber(getEnrolmentValue(row));
              const values = getAdmSlmValuesForQuarter(row, quarter);

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

export default ADMSLMTable;
