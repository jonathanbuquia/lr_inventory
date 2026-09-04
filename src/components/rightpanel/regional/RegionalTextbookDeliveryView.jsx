import { useEffect, useMemo, useState } from "react";
import "./RegionalTextbookDeliveryView.css";
import {
  REGIONAL_TEXTBOOK_DELIVERY_GRADES,
  REGIONAL_TEXTBOOK_DELIVERY_PHASES,
  REGIONAL_TEXTBOOK_DELIVERY_YEARS,
} from "../../../utils/regionalTextbookDelivery";

const formatNumber = (value) => Number(value || 0).toLocaleString();
const formatPercent = (value) => `${Number(value || 0).toFixed(2)}%`;
const formatSignedNumber = (value) => {
  const numeric = Number(value || 0);
  if (numeric > 0) return `+${formatNumber(numeric)}`;
  if (numeric < 0) return `-${formatNumber(Math.abs(numeric))}`;
  return "0";
};

const getSubjectYearValue = (division, grade, subjectKey, year) =>
  Number(division?.deliveryByYear?.[grade]?.[subjectKey]?.[year] || 0);

const getSubjectTotal = (division, grade, subjectKey, years) =>
  years.reduce(
    (sum, year) => sum + getSubjectYearValue(division, grade, subjectKey, year),
    0
  );

const getEnrollment = (division, grade) =>
  Number(division?.enrollmentByGrade?.[grade] || 0);

const getProjectedEnrollment = (enrollment) =>
  Math.round(Number(enrollment || 0) * 1.02);

const RegionalTextbookDeliveryView = () => {
  const [dataset, setDataset] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [activePhase, setActivePhase] = useState("phase-1");
  const [activeGrade, setActiveGrade] = useState("1");

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

  const phases = dataset?.phases?.length
    ? dataset.phases
    : REGIONAL_TEXTBOOK_DELIVERY_PHASES;
  const years = dataset?.years?.length
    ? dataset.years
    : REGIONAL_TEXTBOOK_DELIVERY_YEARS;
  const grades = dataset?.grades?.length
    ? dataset.grades
    : REGIONAL_TEXTBOOK_DELIVERY_GRADES;

  const divisions = useMemo(
    () =>
      Array.isArray(dataset?.divisions)
        ? [...dataset.divisions].sort((a, b) => a.name.localeCompare(b.name))
        : [],
    [dataset]
  );

  const gradesByKey = useMemo(
    () => new Map(grades.map((gradeBlock) => [gradeBlock.grade, gradeBlock])),
    [grades]
  );

  const activePhaseConfig =
    phases.find((phase) => phase.key === activePhase) || phases[0];

  const phaseGrades = useMemo(
    () =>
      (activePhaseConfig?.grades || [])
        .map((grade) => gradesByKey.get(grade))
        .filter(Boolean),
    [activePhaseConfig, gradesByKey]
  );

  useEffect(() => {
    if (!phaseGrades.length) return;
    if (!phaseGrades.some((gradeBlock) => gradeBlock.grade === activeGrade)) {
      setActiveGrade(phaseGrades[0].grade);
    }
  }, [activeGrade, phaseGrades]);

  const selectedGrade = gradesByKey.get(activeGrade) || phaseGrades[0];

  const handlePhaseSelect = (phase) => {
    setActivePhase(phase.key);
    const firstGrade = phase.grades?.[0];
    if (firstGrade) setActiveGrade(firstGrade);
  };

  return (
    <section className="rtdvWrap">
      <div className="rtdvHeader">
        <div className="rtdvHeaderText">
          <div className="rtdvTitle">Regional Overview</div>
          <div className="rtdvSubTitle">
            Textbooks delivery tables by phase, grade level, subject, SDO, and
            delivery year.
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rtdvEmpty">Loading regional textbook delivery data...</div>
      ) : errorText ? (
        <div className="rtdvEmpty">{errorText}</div>
      ) : divisions.length === 0 ? (
        <div className="rtdvEmpty">No regional textbook delivery data found.</div>
      ) : (
        <>
          <div className="rtdvControls">
            <div className="rtdvPhaseTabs" aria-label="Regional overview phases">
              {phases.map((phase) => (
                <button
                  type="button"
                  key={phase.key}
                  className={`rtdvPhaseTab ${
                    activePhase === phase.key ? "is-active" : ""
                  }`}
                  onClick={() => handlePhaseSelect(phase)}
                >
                  <span>{phase.label}</span>
                  <strong>{phase.gradeLabels}</strong>
                </button>
              ))}
            </div>

            <div className="rtdvGradeFilter" aria-label="Grade level filter">
              {phaseGrades.map((gradeBlock) => (
                <button
                  type="button"
                  key={gradeBlock.grade}
                  className={`rtdvGradeBtn ${
                    activeGrade === gradeBlock.grade ? "is-active" : ""
                  }`}
                  onClick={() => setActiveGrade(gradeBlock.grade)}
                >
                  {gradeBlock.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rtdvTables">
            {(selectedGrade?.subjects || []).map((subject) => (
              <section
                className="rtdvSubjectSection"
                key={`${selectedGrade.grade}-${subject.key}`}
              >
                <div className="rtdvSubjectTitle">
                  {selectedGrade.label.toUpperCase()} - {subject.label.toUpperCase()}
                </div>

                <div className="rtdvTableWrap">
                  <table className="rtdvPptTable">
                    <thead>
                      <tr>
                        <th rowSpan="2" className="rtdvStickyCol">SDO</th>
                        <th rowSpan="2">SY 2026-2027 Enrolment</th>
                        <th colSpan="8">{subject.label.toUpperCase()}</th>
                      </tr>
                      <tr>
                        {years.map((year) => (
                          <th key={`${subject.key}-${year}`}>{year} Delivery</th>
                        ))}
                        <th>Total Delivery</th>
                        <th>Percentage of Learners Provided with Textbook</th>
                        <th>Surplus/Shortage (SY 2026-2027)</th>
                        <th>SY 2027-2028 (2% Enrollment Increase)</th>
                        <th>Surplus / Shortage Total Delivery - Projected Enrolment</th>
                      </tr>
                    </thead>

                    <tbody>
                      {divisions.map((division) => {
                        const enrollment = getEnrollment(division, selectedGrade.grade);
                        const totalDelivery = getSubjectTotal(
                          division,
                          selectedGrade.grade,
                          subject.key,
                          years
                        );
                        const projectedEnrollment = getProjectedEnrollment(enrollment);
                        const percentage =
                          enrollment > 0 ? (totalDelivery / enrollment) * 100 : 0;

                        return (
                          <tr key={`${subject.key}-${division.slug}`}>
                            <td className="rtdvDivisionName rtdvStickyCol">
                              {division.name}
                            </td>
                            <td>{formatNumber(enrollment)}</td>
                            {years.map((year) => (
                              <td key={`${division.slug}-${subject.key}-${year}`}>
                                {formatNumber(
                                  getSubjectYearValue(
                                    division,
                                    selectedGrade.grade,
                                    subject.key,
                                    year
                                  )
                                )}
                              </td>
                            ))}
                            <td>{formatNumber(totalDelivery)}</td>
                            <td>{formatPercent(percentage)}</td>
                            <td
                              className={
                                totalDelivery - enrollment < 0
                                  ? "rtdvNegative"
                                  : "rtdvPositive"
                              }
                            >
                              {formatSignedNumber(totalDelivery - enrollment)}
                            </td>
                            <td>{formatNumber(projectedEnrollment)}</td>
                            <td
                              className={
                                totalDelivery - projectedEnrollment < 0
                                  ? "rtdvNegative"
                                  : "rtdvPositive"
                              }
                            >
                              {formatSignedNumber(
                                totalDelivery - projectedEnrollment
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </section>
  );
};

export default RegionalTextbookDeliveryView;
