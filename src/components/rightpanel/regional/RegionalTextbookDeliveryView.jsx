import { useEffect, useMemo, useState } from "react";
import "./RegionalTextbookDeliveryView.css";
import {
  getRegionalTextbookDeliveredTotal,
  REGIONAL_TEXTBOOK_DELIVERY_GRADES,
} from "../../../utils/regionalTextbookDelivery";

const formatNumber = (value) => Number(value || 0).toLocaleString();
const formatPercent = (value) => `${Number(value || 0).toFixed(2)}%`;
const getGradeClassName = (grade) => `rtdvGrade--${grade}`;

const RegionalTextbookDeliveryView = () => {
  const [dataset, setDataset] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [openDivisions, setOpenDivisions] = useState({});
  const [activePage, setActivePage] = useState("delivery");

  useEffect(() => {
    const loadRegionalData = async () => {
      setLoading(true);
      setErrorText("");

      try {
        const response = await fetch("/data/regional-textbook-delivery.json");
        if (!response.ok) {
          throw new Error("Failed to load regional textbook delivery data.");
        }

        const payload = await response.json();
        setDataset(payload);
      } catch (error) {
        console.error("Error loading regional textbook delivery data:", error);
        setDataset(null);
        setErrorText(
          error.message || "Failed to load regional textbook delivery data."
        );
      } finally {
        setLoading(false);
      }
    };

    loadRegionalData();
  }, []);

  const grades = dataset?.grades?.length
    ? dataset.grades
    : REGIONAL_TEXTBOOK_DELIVERY_GRADES;

  const columns = useMemo(
    () =>
      grades.flatMap((gradeBlock) =>
        gradeBlock.subjects.map((subject) => ({
          grade: gradeBlock.grade,
          gradeLabel: gradeBlock.label,
          subjectKey: subject.key,
          subjectLabel: subject.label,
        }))
      ),
    [grades]
  );

  const gridTemplateColumns = `260px repeat(${columns.length}, minmax(108px, 1fr))`;
  const gridMinWidth = 260 + columns.length * 108;

  const divisions = useMemo(
    () =>
      Array.isArray(dataset?.divisions)
        ? [...dataset.divisions].sort((a, b) => a.name.localeCompare(b.name))
        : [],
    [dataset]
  );

  const toggleDivision = (divisionSlug) => {
    setOpenDivisions((prev) => ({
      ...prev,
      [divisionSlug]: !prev[divisionSlug],
    }));
  };

  const getValue = (totals, grade, subjectKey) =>
    Number(totals?.[grade]?.[subjectKey] || 0);
  const getDeliveredTotal = (entry) =>
    Number(
      entry?.deliveredTotal ??
      getRegionalTextbookDeliveredTotal(entry?.totals)
    );
  const getEnrollmentTotal = (entry) => Number(entry?.enrollmentTotal || 0);
  const getEnrollmentByGrade = (entry, grade) =>
    Number(entry?.enrollmentByGrade?.[grade] || 0);
  const getDeliveryPercentage = (entry) => {
    const enrollmentTotal = getEnrollmentTotal(entry);
    if (enrollmentTotal <= 0) return 0;

    return Number(
      entry?.deliveryPercentage ??
      ((getDeliveredTotal(entry) / enrollmentTotal) * 100)
    );
  };
  const getSubjectCoveragePercentage = (entry, grade, subjectKey) => {
    const enrollment = getEnrollmentByGrade(entry, grade);
    const received = getValue(entry?.totals, grade, subjectKey);
    if (enrollment <= 0 || received <= 0) return 0;
    return (received / enrollment) * 100;
  };

  return (
    <section className="rtdvWrap">
      <div className="rtdvHeader">
        <div className="rtdvHeaderText">
          <div className="rtdvTitle">
            {dataset?.title || "Status of Textbook Delivery"}
          </div>
          <div className="rtdvSubTitle">
            Regional textbook delivery summary grouped by SDO, Grade 1, Grade 4,
            and Grade 7 subject titles.
          </div>
        </div>

        <div className="rtdvHeaderActions">
          <button
            type="button"
            className={`rtdvViewBtn ${activePage === "delivery" ? "is-active" : ""}`}
            onClick={() => setActivePage("delivery")}
          >
            This Page
          </button>

          <button
            type="button"
            className={`rtdvViewBtn ${activePage === "summary" ? "is-active" : ""}`}
            onClick={() => setActivePage("summary")}
          >
            Division Summary
          </button>

          <button
            type="button"
            className={`rtdvViewBtn ${activePage === "coverage" ? "is-active" : ""}`}
            onClick={() => setActivePage("coverage")}
          >
            % With Textbooks
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rtdvEmpty">Loading regional textbook delivery data...</div>
      ) : errorText ? (
        <div className="rtdvEmpty">{errorText}</div>
      ) : divisions.length === 0 ? (
        <div className="rtdvEmpty">No regional textbook delivery data found.</div>
      ) : activePage === "summary" ? (
        <div className="rtdvSummaryWrap">
          <div className="rtdvSummaryTableWrap">
            <table className="rtdvSummaryTable">
              <thead>
                <tr>
                  <th>SDO</th>
                  <th>Enrollment Total</th>
                  <th>Percentage of Delivery</th>
                </tr>
              </thead>

              <tbody>
                {divisions.map((division) => (
                  <tr key={`summary-${division.slug}`}>
                    <td>{division.name}</td>
                    <td className="rtdvSummaryNumber">
                      {formatNumber(getEnrollmentTotal(division))}
                    </td>
                    <td className="rtdvSummaryPercent">
                      {formatPercent(getDeliveryPercentage(division))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : activePage === "coverage" ? (
        <div className="rtdvMatrixWrap">
          <div className="rtdvMatrixShell">
            <div className="rtdvCoverageTableWrap">
              <table className="rtdvCoverageTable">
                <thead>
                  <tr>
                    <th rowSpan="3">SDO</th>

                    {grades.map((gradeBlock) => (
                      <th
                        key={`coverage-${gradeBlock.grade}`}
                        colSpan={gradeBlock.subjects.length * 2}
                        className={getGradeClassName(gradeBlock.grade)}
                      >
                        {gradeBlock.label.toUpperCase()}
                      </th>
                    ))}
                  </tr>

                  <tr>
                    {grades.flatMap((gradeBlock) =>
                      gradeBlock.subjects.map((subject) => (
                        <th
                          key={`coverage-subject-${gradeBlock.grade}-${subject.key}`}
                          colSpan="2"
                          className={getGradeClassName(gradeBlock.grade)}
                        >
                          {subject.label}
                        </th>
                      ))
                    )}
                  </tr>

                  <tr>
                    {grades.flatMap((gradeBlock) =>
                      gradeBlock.subjects.flatMap((subject) => [
                        <th
                          key={`coverage-enrollment-${gradeBlock.grade}-${subject.key}`}
                          className={getGradeClassName(gradeBlock.grade)}
                        >
                          Enrollment
                        </th>,
                        <th
                          key={`coverage-percent-${gradeBlock.grade}-${subject.key}`}
                          className={getGradeClassName(gradeBlock.grade)}
                        >
                          % with Textbooks
                        </th>,
                      ])
                    )}
                  </tr>
                </thead>

                <tbody>
                  {divisions.map((division) => (
                    <tr key={`coverage-row-${division.slug}`}>
                      <td className="rtdvCoverageDivisionCell">{division.name}</td>

                      {grades.flatMap((gradeBlock) =>
                        gradeBlock.subjects.flatMap((subject) => {
                          const coveragePercentage = getSubjectCoveragePercentage(
                            division,
                            gradeBlock.grade,
                            subject.key
                          );

                          return [
                          <td
                            key={`coverage-enrollment-value-${division.slug}-${gradeBlock.grade}-${subject.key}`}
                            className={`rtdvCoverageNumberCell ${getGradeClassName(gradeBlock.grade)}`}
                          >
                            {formatNumber(
                              getEnrollmentByGrade(division, gradeBlock.grade)
                            )}
                          </td>,
                          <td
                            key={`coverage-percent-value-${division.slug}-${gradeBlock.grade}-${subject.key}`}
                            className={`rtdvCoveragePercentCell ${getGradeClassName(gradeBlock.grade)} ${
                              coveragePercentage > 100
                                ? "rtdvCoveragePercentCell--excess"
                                : ""
                            }`}
                          >
                            {formatPercent(coveragePercentage)}
                          </td>,
                        ];
                        })
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="rtdvMatrixWrap">
          <div className="rtdvMatrixShell" style={{ minWidth: `${gridMinWidth}px` }}>
            <div
              className="rtdvMatrixHead"
              style={{ gridTemplateColumns }}
            >
              <div className="rtdvCornerCell">SDO</div>

              {grades.map((gradeBlock) => (
                <div
                  key={gradeBlock.grade}
                  className={`rtdvGradeGroup ${getGradeClassName(gradeBlock.grade)}`}
                  style={{ gridColumn: `span ${gradeBlock.subjects.length}` }}
                >
                  {gradeBlock.label.toUpperCase()}
                </div>
              ))}

              {columns.map((column) => (
                <div
                  key={`${column.grade}-${column.subjectKey}`}
                  className={`rtdvSubjectHead ${getGradeClassName(column.grade)}`}
                >
                  {column.subjectLabel}
                </div>
              ))}
            </div>

            <div className="rtdvAccordionList">
              {divisions.map((division) => {
                const isOpen = !!openDivisions[division.slug];
                const schoolCount = Array.isArray(division.schools)
                  ? division.schools.length
                  : 0;

                return (
                  <div key={division.slug} className="rtdvAccordionItem">
                    <button
                      type="button"
                      className="rtdvAccordionHeader"
                      style={{ gridTemplateColumns }}
                      onClick={() => toggleDivision(division.slug)}
                    >
                      <div className="rtdvDivisionCell">
                        <span className="rtdvAccordionIcon">{isOpen ? "-" : "+"}</span>

                        <div className="rtdvDivisionText">
                          <span className="rtdvDivisionName">{division.name}</span>
                          <span className="rtdvDivisionMeta">
                            {schoolCount} school{schoolCount === 1 ? "" : "s"}
                          </span>
                        </div>
                      </div>

                      {columns.map((column) => (
                        <div
                          key={`${division.slug}-${column.grade}-${column.subjectKey}`}
                          className={`rtdvValueCell ${getGradeClassName(column.grade)}`}
                        >
                          {formatNumber(
                            getValue(
                              division.totals,
                              column.grade,
                              column.subjectKey
                            )
                          )}
                        </div>
                      ))}
                    </button>

                    {isOpen && (
                      <div className="rtdvAccordionBody">
                        <div className="rtdvSchoolTableWrap">
                          <table className="rtdvSchoolTable">
                            <thead>
                              <tr>
                                <th rowSpan="2">School</th>

                                {grades.map((gradeBlock) => (
                                  <th
                                    key={`${division.slug}-${gradeBlock.grade}`}
                                    colSpan={gradeBlock.subjects.length}
                                    className={getGradeClassName(gradeBlock.grade)}
                                  >
                                    {gradeBlock.label.toUpperCase()}
                                  </th>
                                ))}
                              </tr>

                              <tr>
                                {columns.map((column) => (
                                  <th
                                    key={`${division.slug}-head-${column.grade}-${column.subjectKey}`}
                                    className={getGradeClassName(column.grade)}
                                  >
                                    {column.subjectLabel}
                                  </th>
                                ))}
                              </tr>
                            </thead>

                            <tbody>
                              <tr className="rtdvSummaryRow">
                                <td>SDO Total</td>

                                {columns.map((column) => (
                                  <td
                                    key={`${division.slug}-total-${column.grade}-${column.subjectKey}`}
                                    className={`rtdvNumberCell ${getGradeClassName(column.grade)}`}
                                  >
                                    {formatNumber(
                                      getValue(
                                        division.totals,
                                        column.grade,
                                        column.subjectKey
                                      )
                                    )}
                                  </td>
                                ))}
                              </tr>

                              {(division.schools || []).map((school) => (
                                <tr key={`${division.slug}-${school.id}`}>
                                  <td className="rtdvSchoolNameCell">{school.name}</td>

                                  {columns.map((column) => (
                                    <td
                                      key={`${division.slug}-${school.id}-${column.grade}-${column.subjectKey}`}
                                      className={`rtdvNumberCell ${getGradeClassName(column.grade)}`}
                                    >
                                      {formatNumber(
                                        getValue(
                                          school.totals,
                                          column.grade,
                                          column.subjectKey
                                        )
                                      )}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default RegionalTextbookDeliveryView;
