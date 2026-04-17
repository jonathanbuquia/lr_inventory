import { useEffect, useMemo, useState } from "react";
import "./DivisionConsolidatedTable.css";
import {
  QUARTERS,
  buildSchoolSheetUrl,
  getAdmSlmValuesForQuarter,
  getEnrolmentValue,
  getGradeValue,
  getSheetRows,
  getSubjectValue,
  gradeSortValue,
  isElementaryGrade,
  isJuniorHighGrade,
  isKinderGrade,
  isSeniorHighGrade,
  normalizeGradeKey,
  normalizeText,
  toNumber,
} from "../../../utils/dashboardData";

const formatNumber = (value) => Number(value || 0).toLocaleString();

const getSchoolsArray = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.schools)) return data.schools;
  if (Array.isArray(data?.items)) return data.items;
  return [];
};

const getSchoolFolderName = (school) =>
  school?.slug ||
  school?.folderName ||
  school?.folder ||
  school?.id ||
  school?.name ||
  "";

const getSchoolDisplayName = (school) =>
  school?.name || school?.label || school?.id || "Unknown School";

const isHighSchool = (schoolName) =>
  normalizeText(schoolName).includes("HIGH SCHOOL");

const isElementarySchool = (schoolName) =>
  normalizeText(schoolName).includes("ELEMENTARY SCHOOL");

const isSeniorHighSchool = (schoolName) =>
  normalizeText(schoolName).includes("SENIOR HIGH SCHOOL");

const isRegularHighSchool = (schoolName) =>
  isHighSchool(schoolName) && !isSeniorHighSchool(schoolName);

const shouldIncludeGradeForSchool = (schoolName, grade) => {
  if (isSeniorHighSchool(schoolName)) return isSeniorHighGrade(grade);
  if (isRegularHighSchool(schoolName)) return isJuniorHighGrade(grade);
  if (isElementarySchool(schoolName)) {
    return isKinderGrade(grade) || isElementaryGrade(grade);
  }
  return true;
};

const formatExpandedGradeLabel = (grade) =>
  normalizeGradeKey(grade) === "KINDER"
    ? "Kinder"
    : `Grade ${normalizeGradeKey(grade)}`;

const hasQuarterData = (rowLike) =>
  toNumber(rowLike?.target) > 0 ||
  toNumber(rowLike?.received) > 0 ||
  toNumber(rowLike?.gap) > 0 ||
  toNumber(rowLike?.surplus) > 0;

const getStatusDotClassName = (status) => {
  if (status === "NO DATA") return "dctStatusDot dctStatusDot--noData";
  if (status === "INCOMPLETE") {
    return "dctStatusDot dctStatusDot--incomplete";
  }
  return "";
};

const DivisionConsolidatedADMSLM = ({ selectedDivision }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [openSchools, setOpenSchools] = useState({});
  const [openGrades, setOpenGrades] = useState({});
  const [schoolQuarters, setSchoolQuarters] = useState({});

  const toggleSchool = (schoolId) => {
    setOpenSchools((prev) => ({
      ...prev,
      [schoolId]: !prev[schoolId],
    }));
  };

  const toggleGrade = (schoolId, grade) => {
    const key = `${schoolId}__${grade}`;
    setOpenGrades((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const updateSchoolQuarter = (schoolId, quarter) => {
    setSchoolQuarters((prev) => ({
      ...prev,
      [schoolId]: quarter,
    }));
  };

  useEffect(() => {
    const loadDivisionData = async () => {
      if (!selectedDivision) {
        setRows([]);
        setErrorText("");
        setOpenSchools({});
        setOpenGrades({});
        setSchoolQuarters({});
        return;
      }

      setLoading(true);
      setRows([]);
      setErrorText("");
      setOpenSchools({});
      setOpenGrades({});
      setSchoolQuarters({});

      try {
        const schoolsRes = await fetch(
          `/data/divisions/${selectedDivision}/schools.json`
        );

        if (!schoolsRes.ok) {
          throw new Error(
            `Cannot load schools.json for division: ${selectedDivision}`
          );
        }

        const schoolsData = await schoolsRes.json();
        const schoolList = getSchoolsArray(schoolsData);

        if (!schoolList.length) {
          setErrorText("No schools found inside schools.json.");
          setRows([]);
          setLoading(false);
          return;
        }

        const schoolFiles = await Promise.all(
          schoolList.map(async (school) => {
            const folderName = getSchoolFolderName(school);
            const schoolName = getSchoolDisplayName(school);
            if (!folderName) return null;

            const filePath = buildSchoolSheetUrl(
              selectedDivision,
              folderName,
              "adm-slm.json"
            );

            try {
              const res = await fetch(filePath);
              if (!res.ok) return null;

              const data = await res.json();
              const fileRows = getSheetRows(data).filter((row) => {
                const hasSubject = String(getSubjectValue(row)).trim() !== "";
                return hasSubject || isKinderGrade(getGradeValue(row));
              });

              return {
                schoolId: folderName,
                schoolName,
                fileRows,
              };
            } catch (error) {
              console.error("Error loading file:", filePath, error);
              return null;
            }
          })
        );

        const validFiles = schoolFiles.filter(Boolean);

        if (!validFiles.length) {
          setErrorText(
            "schools.json was found, but no adm-slm.json files could be loaded."
          );
          setRows([]);
          setLoading(false);
          return;
        }

        const merged = [];

        validFiles.forEach((entry) => {
          entry.fileRows.forEach((row) => {
            merged.push({
              ...row,
              __schoolId: entry.schoolId,
              __schoolName: entry.schoolName,
            });
          });
        });

        setRows(merged);
      } catch (error) {
        console.error("Error loading consolidated ADM-SLM data:", error);
        setErrorText(error.message || "Failed to load division ADM-SLM data.");
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    loadDivisionData();
  }, [selectedDivision]);

  const accordionSchools = useMemo(() => {
    const grouped = {};

    rows.forEach((row) => {
      const schoolId = row.__schoolId || "";
      const schoolName = row.__schoolName || "Unknown School";
      const grade = normalizeGradeKey(getGradeValue(row));

      if (!schoolId || !grade) return;
      if (!shouldIncludeGradeForSchool(schoolName, grade)) return;

      const subject = String(getSubjectValue(row) ?? "").trim();
      const safeSubject = subject || "(No Subject)";
      const quarter = schoolQuarters[schoolId] || "ALL";
      const values = getAdmSlmValuesForQuarter(row, quarter);
      const key = `${schoolId}__${grade}__${safeSubject}`;

      if (!grouped[key]) {
        grouped[key] = {
          schoolId,
          schoolName,
          grade,
          subject: safeSubject,
          enrolled: 0,
          target: 0,
          received: 0,
          gap: 0,
          surplus: 0,
        };
      }

      grouped[key].enrolled += toNumber(getEnrolmentValue(row));
      grouped[key].target += values.target;
      grouped[key].received += values.received;
      grouped[key].gap += values.gap;
      grouped[key].surplus += values.surplus;
    });

    const schoolMap = {};

    Object.values(grouped)
      .sort((a, b) => {
        const schoolDiff = a.schoolName.localeCompare(b.schoolName);
        if (schoolDiff !== 0) return schoolDiff;

        const gradeDiff = gradeSortValue(a.grade) - gradeSortValue(b.grade);
        if (gradeDiff !== 0) return gradeDiff;

        return a.subject.localeCompare(b.subject);
      })
      .forEach((item) => {
        if (!schoolMap[item.schoolId]) {
          schoolMap[item.schoolId] = {
            schoolId: item.schoolId,
            schoolName: item.schoolName,
            quarter: schoolQuarters[item.schoolId] || "ALL",
            totals: {
              enrolled: 0,
              target: 0,
              received: 0,
              gap: 0,
              surplus: 0,
            },
            gradeMap: {},
          };
        }

        schoolMap[item.schoolId].totals.enrolled += item.enrolled;
        schoolMap[item.schoolId].totals.target += item.target;
        schoolMap[item.schoolId].totals.received += item.received;
        schoolMap[item.schoolId].totals.gap += item.gap;
        schoolMap[item.schoolId].totals.surplus += item.surplus;

        if (!schoolMap[item.schoolId].gradeMap[item.grade]) {
          schoolMap[item.schoolId].gradeMap[item.grade] = {
            grade: item.grade,
            totals: {
              enrolled: 0,
              target: 0,
              received: 0,
              gap: 0,
              surplus: 0,
            },
            rows: [],
            status: "",
          };
        }

        schoolMap[item.schoolId].gradeMap[item.grade].totals.enrolled +=
          item.enrolled;
        schoolMap[item.schoolId].gradeMap[item.grade].totals.target += item.target;
        schoolMap[item.schoolId].gradeMap[item.grade].totals.received +=
          item.received;
        schoolMap[item.schoolId].gradeMap[item.grade].totals.gap += item.gap;
        schoolMap[item.schoolId].gradeMap[item.grade].totals.surplus +=
          item.surplus;
        schoolMap[item.schoolId].gradeMap[item.grade].rows.push(item);
      });

    return Object.values(schoolMap)
      .map((school) => {
        const schoolIsSeniorHighSchool = isSeniorHighSchool(school.schoolName);
        const schoolIsElementary = isElementarySchool(school.schoolName);
        const grades = Object.values(school.gradeMap)
          .map((gradeBlock) => {
            const hasGradeData = hasQuarterData(gradeBlock.totals);
            const rowsWithData = gradeBlock.rows.filter(hasQuarterData).length;
            const rowsWithoutData = gradeBlock.rows.length - rowsWithData;

            let gradeStatus = "";
            if (!hasGradeData) {
              gradeStatus = "NO DATA";
            } else if (rowsWithData > 0 && rowsWithoutData > 0) {
              gradeStatus = "INCOMPLETE";
            }

            return {
              ...gradeBlock,
              status: gradeStatus,
            };
          })
          .sort((a, b) => gradeSortValue(a.grade) - gradeSortValue(b.grade));

        const relevantGrades = grades.filter((gradeBlock) => {
          if (schoolIsElementary && normalizeGradeKey(gradeBlock.grade) === "KINDER") {
            return false;
          }
          return true;
        });

        const gradesWithData = relevantGrades.filter((gradeBlock) =>
          hasQuarterData(gradeBlock.totals)
        );

        const hasIncompleteGrade = relevantGrades.some(
          (gradeBlock) => gradeBlock.status === "INCOMPLETE"
        );

        const hasSchoolData = hasQuarterData(school.totals);

        let schoolStatus = "";
        if (!hasSchoolData) {
          schoolStatus = "NO DATA";
        } else if (schoolIsSeniorHighSchool) {
          schoolStatus = "";
        } else if (
          relevantGrades.length > 0 &&
          (hasIncompleteGrade || gradesWithData.length < relevantGrades.length)
        ) {
          schoolStatus = "INCOMPLETE";
        }

        return {
          ...school,
          grades,
          status: schoolStatus,
        };
      })
      .filter((school) => school.grades.length > 0)
      .sort((a, b) => a.schoolName.localeCompare(b.schoolName));
  }, [rows, schoolQuarters]);

  return (
    <section className="dctWrap">
      <div className="dctHeader">
        <div className="dctHeaderLeft">
          <div className="dctTitle">DIVISION CONSOLIDATED ADM-SLM DATA</div>
          <div className="dctSubTitle">
            {selectedDivision
              ? `Selected Division: ${selectedDivision}`
              : "No division selected"}
          </div>
        </div>
      </div>

      <div className="dctAccordionWrap">
        {loading ? (
          <div className="dctEmpty">Loading consolidated ADM-SLM data...</div>
        ) : errorText ? (
          <div className="dctEmpty">{errorText}</div>
        ) : accordionSchools.length === 0 ? (
          <div className="dctEmpty">No ADM-SLM data found for this division.</div>
        ) : (
          accordionSchools.map((school) => {
            const isSchoolOpen = !!openSchools[school.schoolId];

            return (
              <div key={school.schoolId} className="dctAccordionItem">
                <div className="dctAccordionHeaderShell">
                  <button
                    type="button"
                    className="dctAccordionHeader dctAccordionHeader--split"
                    onClick={() => toggleSchool(school.schoolId)}
                  >
                    <div className="dctAccordionHeaderLeft">
                      <span className="dctAccordionIcon">
                        {isSchoolOpen ? "-" : "+"}
                      </span>

                      <div className="dctAccordionSchoolInfo">
                        <span className="dctAccordionSchoolName">
                          {school.schoolName}
                          {school.status && (
                            <span
                              className={getStatusDotClassName(school.status)}
                              aria-label={school.status}
                              title={school.status}
                            />
                          )}
                        </span>

                        <span className="dctAccordionCount">
                          {school.grades.length} grade
                          {school.grades.length > 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  </button>

                  <div className="dctAccordionMeta">
                    <div className="dctSchoolQuarterBlock">
                      <span className="dctQuarterLabel">Quarter</span>
                      <div className="dctQuarterBtns">
                        {QUARTERS.map((value) => (
                          <button
                            key={`${school.schoolId}-${value}`}
                            type="button"
                            className={`dctQuarterBtn ${
                              school.quarter === value ? "active" : ""
                            }`}
                            onClick={() => updateSchoolQuarter(school.schoolId, value)}
                          >
                            {value}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="dctAccordionHeaderRight">
                      <span className="dctAccordionStat">
                        <span className="dctAccordionStatLabel">Enrollees</span>
                        <span className="dctAccordionStatValue">
                          {formatNumber(school.totals.enrolled)}
                        </span>
                      </span>

                      <span className="dctAccordionStat">
                        <span className="dctAccordionStatLabel">Target Qty</span>
                        <span className="dctAccordionStatValue">
                          {formatNumber(school.totals.target)}
                        </span>
                      </span>

                      <span className="dctAccordionStat">
                        <span className="dctAccordionStatLabel">ADM-SLM Received</span>
                        <span className="dctAccordionStatValue">
                          {formatNumber(school.totals.received)}
                        </span>
                      </span>

                      <span className="dctAccordionStat">
                        <span className="dctAccordionStatLabel">Gap</span>
                        <span className="dctAccordionStatValue">
                          {formatNumber(school.totals.gap)}
                        </span>
                      </span>

                      <span className="dctAccordionStat">
                        <span className="dctAccordionStatLabel">Surplus</span>
                        <span className="dctAccordionStatValue">
                          {formatNumber(school.totals.surplus)}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                {isSchoolOpen && (
                  <div className="dctAccordionBody">
                    <div className="dctGradeAccordionWrap">
                      {school.grades.map((gradeBlock) => {
                        const gradeKey = `${school.schoolId}__${gradeBlock.grade}`;
                        const isGradeOpen = !!openGrades[gradeKey];
                        const hasGradeData = hasQuarterData(gradeBlock.totals);

                        return (
                          <div key={gradeKey} className="dctGradeAccordionItem">
                            <button
                              type="button"
                              className="dctGradeAccordionHeader"
                              onClick={() =>
                                toggleGrade(school.schoolId, gradeBlock.grade)
                              }
                            >
                              <div className="dctGradeAccordionHeaderLeft">
                                <span className="dctGradeAccordionIcon">
                                  {isGradeOpen ? "-" : "+"}
                                </span>

                                <div className="dctGradeAccordionInfo">
                                  <span className="dctGradeAccordionTitle">
                                    {formatExpandedGradeLabel(gradeBlock.grade)}
                                    {gradeBlock.status && (
                                      <span
                                        className={getStatusDotClassName(
                                          gradeBlock.status
                                        )}
                                        aria-label={gradeBlock.status}
                                        title={gradeBlock.status}
                                      />
                                    )}
                                  </span>

                                  <span className="dctGradeAccordionCount">
                                    {hasGradeData
                                      ? `${gradeBlock.rows.length} subject${
                                          gradeBlock.rows.length > 1 ? "s" : ""
                                        }`
                                      : "No data"}
                                  </span>
                                </div>
                              </div>

                              <div className="dctGradeAccordionHeaderRight">
                                {hasGradeData ? (
                                  <>
                                    <span className="dctAccordionStat dctAccordionStat--small">
                                      <span className="dctAccordionStatLabel">
                                        Enrollees
                                      </span>
                                      <span className="dctAccordionStatValue">
                                        {formatNumber(gradeBlock.totals.enrolled)}
                                      </span>
                                    </span>

                                    <span className="dctAccordionStat dctAccordionStat--small">
                                      <span className="dctAccordionStatLabel">
                                        Target Qty
                                      </span>
                                      <span className="dctAccordionStatValue">
                                        {formatNumber(gradeBlock.totals.target)}
                                      </span>
                                    </span>

                                    <span className="dctAccordionStat dctAccordionStat--small">
                                      <span className="dctAccordionStatLabel">
                                        ADM-SLM Received
                                      </span>
                                      <span className="dctAccordionStatValue">
                                        {formatNumber(gradeBlock.totals.received)}
                                      </span>
                                    </span>

                                    <span className="dctAccordionStat dctAccordionStat--small">
                                      <span className="dctAccordionStatLabel">
                                        Gap
                                      </span>
                                      <span className="dctAccordionStatValue">
                                        {formatNumber(gradeBlock.totals.gap)}
                                      </span>
                                    </span>

                                    <span className="dctAccordionStat dctAccordionStat--small">
                                      <span className="dctAccordionStatLabel">
                                        Surplus
                                      </span>
                                      <span className="dctAccordionStatValue">
                                        {formatNumber(gradeBlock.totals.surplus)}
                                      </span>
                                    </span>
                                  </>
                                ) : null}
                              </div>
                            </button>

                            {isGradeOpen && hasGradeData && (
                              <div className="dctGradeAccordionBody">
                                <div className="dctSchoolTableWrap">
                                  <table className="dctSchoolTable">
                                    <thead>
                                      <tr>
                                        <th>GRADE LEVEL</th>
                                        <th>SUBJECT</th>
                                        <th>ENROLLEES</th>
                                        <th>TARGET QTY</th>
                                        <th>ADM-SLM RECEIVED</th>
                                        <th>GAP</th>
                                        <th>SURPLUS</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {gradeBlock.rows.map((item, index) => {
                                        const isIncompleteReason =
                                          gradeBlock.status === "INCOMPLETE" &&
                                          !hasQuarterData(item);

                                        return (
                                          <tr
                                            key={`${school.schoolId}-${gradeBlock.grade}-${item.subject}-${index}`}
                                            className={
                                              isIncompleteReason
                                                ? "dctSchoolRow dctSchoolRow--incompleteReason"
                                                : "dctSchoolRow"
                                            }
                                          >
                                            <td>
                                              {formatExpandedGradeLabel(item.grade)}
                                            </td>
                                            <td>
                                              {item.subject === "(No Subject)"
                                                ? "-"
                                                : item.subject}
                                            </td>
                                            <td className="dctNumberCell">
                                              {formatNumber(item.enrolled)}
                                            </td>
                                            <td className="dctNumberCell">
                                              {formatNumber(item.target)}
                                            </td>
                                            <td className="dctNumberCell">
                                              {formatNumber(item.received)}
                                            </td>
                                            <td className="dctNumberCell">
                                              {formatNumber(item.gap)}
                                            </td>
                                            <td className="dctNumberCell">
                                              {formatNumber(item.surplus)}
                                            </td>
                                          </tr>
                                        );
                                      })}
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
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};

export default DivisionConsolidatedADMSLM;
