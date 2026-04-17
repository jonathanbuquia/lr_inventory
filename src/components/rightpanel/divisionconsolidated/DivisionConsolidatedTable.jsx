import { useEffect, useMemo, useState } from "react";
import "./DivisionConsolidatedTable.css";
import { downloadTextbookSummaryReport } from "../../../utils/exportTextbookSummaryReport";

const DivisionConsolidatedTable = ({ selectedDivision }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [openSchools, setOpenSchools] = useState({});
  const [openGrades, setOpenGrades] = useState({});
  const [divisionName, setDivisionName] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  const normalizeNumber = (value) => {
    if (value === null || value === undefined || value === "") return 0;
    const cleaned = String(value).replace(/,/g, "").trim();
    const parsed = Number(cleaned);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const normalizeGrade = (value) => {
    if (value === null || value === undefined || value === "") return "";

    const raw = String(value).trim().toUpperCase();

    if (raw === "KINDER" || raw === "K") return "KINDER";
    if (raw === "GRADE 1" || raw === "G1") return "1";
    if (raw === "GRADE 2" || raw === "G2") return "2";
    if (raw === "GRADE 3" || raw === "G3") return "3";
    if (raw === "GRADE 4" || raw === "G4") return "4";
    if (raw === "GRADE 5" || raw === "G5") return "5";
    if (raw === "GRADE 6" || raw === "G6") return "6";
    if (raw === "GRADE 7" || raw === "G7") return "7";
    if (raw === "GRADE 8" || raw === "G8") return "8";
    if (raw === "GRADE 9" || raw === "G9") return "9";
    if (raw === "GRADE 10" || raw === "G10") return "10";
    if (raw === "GRADE 11" || raw === "G11") return "11";
    if (raw === "GRADE 12" || raw === "G12") return "12";

    const num = Number(raw);
    if (!Number.isNaN(num)) return String(num);

    return raw;
  };

  const gradeSortValue = (grade) => {
    if (grade === "KINDER") return 0;
    const parsed = Number(grade);
    if (!Number.isNaN(parsed)) return parsed;
    return 999;
  };

  const formatNumber = (value) => Number(value || 0).toLocaleString();

  const formatGradeLabel = (grade) => {
    return grade === "KINDER" ? "Kinder" : `Grade ${grade}`;
  };

  const getStatusDotClassName = (status) => {
    if (status === "COMPLETE") return "dctStatusDot dctStatusDot--complete";
    if (status === "NO DATA") return "dctStatusDot dctStatusDot--noData";
    if (status === "INCOMPLETE") {
      return "dctStatusDot dctStatusDot--incomplete";
    }
    return "";
  };

  const isSeniorHighGrade = (grade) => {
    const normalized = String(grade ?? "").trim().toUpperCase();
    return normalized === "11" || normalized === "12" || normalized.includes("SHS");
  };

  const isElementaryGrade = (grade) => {
    const normalized = String(grade ?? "").trim().toUpperCase();
    return ["1", "2", "3", "4", "5", "6"].includes(normalized);
  };

  const isHighSchool = (schoolName) => {
    const normalized = String(schoolName ?? "").trim().toUpperCase();
    return normalized.includes("HIGH SCHOOL");
  };

  const isElementarySchool = (schoolName) => {
    const normalized = String(schoolName ?? "").trim().toUpperCase();
    return normalized.includes("ELEMENTARY SCHOOL");
  };

  const isSeniorHighSchool = (schoolName) => {
    const normalized = String(schoolName ?? "").trim().toUpperCase();
    return normalized.includes("SENIOR HIGH SCHOOL");
  };

  const isRegularHighSchool = (schoolName) => {
    const normalized = String(schoolName ?? "").trim().toUpperCase();
    return normalized.includes("HIGH SCHOOL") && !normalized.includes("SENIOR HIGH SCHOOL");
  };

  const isUnclassifiedSchool = (schoolName) => {
    return !(
      isElementarySchool(schoolName) ||
      isRegularHighSchool(schoolName) ||
      isSeniorHighSchool(schoolName)
    );
  };

  const getSchoolsArray = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.schools)) return data.schools;
    if (Array.isArray(data?.items)) return data.items;
    return [];
  };

  const getSchoolFolderName = (school) => {
    return (
      school?.slug ||
      school?.folderName ||
      school?.folder ||
      school?.id ||
      school?.name ||
      ""
    );
  };

  const getSchoolDisplayName = (school) => {
    return school?.name || school?.label || school?.id || "Unknown School";
  };

  const getSubjectValue = (row) => {
    return String(
      row?.["SUBJECTS"] ??
      row?.["Subjects"] ??
      row?.["Subject"] ??
      ""
    ).trim();
  };

  const getEnrollmentValue = (row) => {
    return normalizeNumber(
      row?.["Enrolment S.Y. 2025-2026"] ??
      row?.["Enrollment S.Y. 2025-2026"] ??
      row?.["Enrolment"] ??
      row?.["Enrollment"] ??
      0
    );
  };

  const getReceivedValue = (row) => {
    return normalizeNumber(
      row?.["Quantity of Textbooks Received"] ??
      row?.["Quantity Received"] ??
      row?.["Received"] ??
      0
    );
  };

  const getGapValue = (row) => {
    return normalizeNumber(
      row?.["GAP-TX"] ??
      row?.["Gap-TX"] ??
      row?.["Gaps"] ??
      row?.["Gap"] ??
      0
    );
  };

  const getSurplusValue = (row) => {
    return normalizeNumber(
      row?.["Surplus-TX"] ??
      row?.["SURPLUS-TX"] ??
      row?.["Surplus"] ??
      0
    );
  };

  const rowHasData = (rowLike) => {
    return (
      normalizeNumber(rowLike?.enrolled) > 0 ||
      normalizeNumber(rowLike?.received) > 0 ||
      normalizeNumber(rowLike?.gaps) > 0 ||
      normalizeNumber(rowLike?.surplus) > 0
    );
  };

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

  useEffect(() => {
    const loadDivisionData = async () => {
      if (!selectedDivision) {
        setRows([]);
        setErrorText("");
        setOpenSchools({});
        setOpenGrades({});
        setDivisionName("");
        return;
      }

      setLoading(true);
      setRows([]);
      setErrorText("");
      setOpenSchools({});
      setOpenGrades({});
      setDivisionName("");

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
        setDivisionName(
          String(schoolsData?.division?.name || selectedDivision).trim()
        );

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

            const filePath = `/data/divisions/${selectedDivision}/schools/${folderName}/textbooks.json`;

            try {
              const res = await fetch(filePath);
              if (!res.ok) return null;

              const data = await res.json();

              return {
                schoolId: folderName,
                schoolName,
                fileData: data,
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
            "schools.json was found, but no textbooks.json files could be loaded."
          );
          setRows([]);
          setLoading(false);
          return;
        }

        const merged = [];

        validFiles.forEach((entry) => {
          const fileRows = Array.isArray(entry?.fileData?.rows)
            ? entry.fileData.rows
            : Array.isArray(entry?.fileData)
              ? entry.fileData
              : [];

          fileRows.forEach((row) => {
            merged.push({
              ...row,
              __schoolId: entry.schoolId,
              __schoolName: entry.schoolName,
            });
          });
        });

        setRows(merged);
      } catch (error) {
        console.error("Error loading consolidated division data:", error);
        setErrorText(
          error.message || "Failed to load division consolidated data."
        );
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    loadDivisionData();
  }, [selectedDivision]);

  const allAggregatedRows = useMemo(() => {
    const grouped = {};

    rows.forEach((row) => {
      const schoolId = row.__schoolId || "";
      const schoolName = row.__schoolName || "Unknown School";
      const grade = normalizeGrade(row?.["Grade Level"]);
      const subject = getSubjectValue(row);
      const enrolled = getEnrollmentValue(row);
      const received = getReceivedValue(row);
      const gaps = getGapValue(row);
      const surplus = getSurplusValue(row);

      if (!schoolId || !grade) return;

      if (isHighSchool(schoolName) && isElementaryGrade(grade)) {
        return;
      }

      if (isElementarySchool(schoolName) && !isElementaryGrade(grade)) {
        return;
      }

      if (isSeniorHighSchool(schoolName) && !isSeniorHighGrade(grade)) {
        return;
      }

      const safeSubject = subject || "(No Subject)";
      const key = `${schoolId}__${grade}__${safeSubject}`;

      if (!grouped[key]) {
        grouped[key] = {
          schoolId,
          schoolName,
          grade,
          subject: safeSubject,
          enrolled: 0,
          received: 0,
          gaps: 0,
          surplus: 0,
        };
      }

      grouped[key].enrolled += enrolled;
      grouped[key].received += received;
      grouped[key].gaps += gaps;
      grouped[key].surplus += surplus;
    });

    return Object.values(grouped).sort((a, b) => {
      const schoolDiff = a.schoolName.localeCompare(b.schoolName);
      if (schoolDiff !== 0) return schoolDiff;

      const gradeDiff = gradeSortValue(a.grade) - gradeSortValue(b.grade);
      if (gradeDiff !== 0) return gradeDiff;

      return a.subject.localeCompare(b.subject);
    });
  }, [rows]);

  const accordionSchools = useMemo(() => {
    const schoolMap = {};

    allAggregatedRows.forEach((item) => {
      if (!schoolMap[item.schoolId]) {
        schoolMap[item.schoolId] = {
          schoolId: item.schoolId,
          schoolName: item.schoolName,
          totals: {
            enrolled: 0,
            received: 0,
            gaps: 0,
            surplus: 0,
          },
          gradeMap: {},
        };
      }

      schoolMap[item.schoolId].totals.enrolled += item.enrolled;
      schoolMap[item.schoolId].totals.received += item.received;
      schoolMap[item.schoolId].totals.gaps += item.gaps;
      schoolMap[item.schoolId].totals.surplus += item.surplus;

      if (!schoolMap[item.schoolId].gradeMap[item.grade]) {
        schoolMap[item.schoolId].gradeMap[item.grade] = {
          grade: item.grade,
          totals: {
            enrolled: 0,
            received: 0,
            gaps: 0,
            surplus: 0,
          },
          rows: [],
          status: "",
        };
      }

      schoolMap[item.schoolId].gradeMap[item.grade].totals.enrolled += item.enrolled;
      schoolMap[item.schoolId].gradeMap[item.grade].totals.received += item.received;
      schoolMap[item.schoolId].gradeMap[item.grade].totals.gaps += item.gaps;
      schoolMap[item.schoolId].gradeMap[item.grade].totals.surplus += item.surplus;
      schoolMap[item.schoolId].gradeMap[item.grade].rows.push(item);
    });

    return Object.values(schoolMap)
      .map((school) => {
        const schoolIsRegularHighSchool = isRegularHighSchool(school.schoolName);
        const schoolIsSeniorHighSchool = isSeniorHighSchool(school.schoolName);
        const schoolIsUnclassified = isUnclassifiedSchool(school.schoolName);
        const grades = Object.values(school.gradeMap)
          .map((gradeBlock) => {
            const hasGradeData =
              gradeBlock.totals.enrolled > 0 ||
              gradeBlock.totals.received > 0 ||
              gradeBlock.totals.gaps > 0 ||
              gradeBlock.totals.surplus > 0;

            const rowsWithData = gradeBlock.rows.filter(rowHasData).length;
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
          return !(
            schoolIsRegularHighSchool &&
            isSeniorHighGrade(gradeBlock.grade)
          );
        });

        const gradesWithData = relevantGrades.filter((gradeBlock) => {
          return (
            gradeBlock.totals.enrolled > 0 ||
            gradeBlock.totals.received > 0 ||
            gradeBlock.totals.gaps > 0 ||
            gradeBlock.totals.surplus > 0
          );
        });

        const hasIncompleteGrade = relevantGrades.some(
          (gradeBlock) => gradeBlock.status === "INCOMPLETE"
        );

        const hasSchoolData =
          school.totals.enrolled > 0 ||
          school.totals.received > 0 ||
          school.totals.gaps > 0 ||
          school.totals.surplus > 0;

        let schoolStatus = "";
        if (!hasSchoolData) {
          schoolStatus = "NO DATA";
        } else if (schoolIsUnclassified) {
          schoolStatus = "COMPLETE";
        } else if (schoolIsSeniorHighSchool) {
          schoolStatus = "";
        } else if (
          hasIncompleteGrade ||
          gradesWithData.length < relevantGrades.length
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
  }, [allAggregatedRows]);

  const exportSchools = useMemo(() => {
    return accordionSchools.map((school) => ({
      schoolName: school.schoolName,
      schoolStatus: school.status,
      rows: school.grades.flatMap((gradeBlock) => {
        if (gradeBlock.status === "NO DATA") {
          return [
            {
              gradeLabel: formatGradeLabel(gradeBlock.grade),
              subject: "NO DATA",
              enrolled: 0,
              received: 0,
              gaps: 0,
              surplus: 0,
              status: "NO DATA",
            },
          ];
        }

        return gradeBlock.rows.map((item) => ({
          gradeLabel: formatGradeLabel(item.grade),
          subject: item.subject === "(No Subject)" ? "-" : item.subject,
          enrolled: item.enrolled,
          received: item.received,
          gaps: item.gaps,
          surplus: item.surplus,
          status:
            gradeBlock.status === "INCOMPLETE" && !rowHasData(item)
              ? "INCOMPLETE"
              : "",
        }));
      }),
    }));
  }, [accordionSchools]);

  const handleDownloadSummaryReport = () => {
    if (loading || accordionSchools.length === 0) return;

    setIsExporting(true);
    try {
      downloadTextbookSummaryReport({
        divisionName: divisionName || selectedDivision || "DIVISION",
        schools: exportSchools,
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <section className="dctWrap">
      <div className="dctHeader">
        <div className="dctHeaderLeft">
          <div className="dctTitle">DIVISION CONSOLIDATED TEXTBOOKS DATA</div>
          <div className="dctSubTitle">
            {selectedDivision
              ? `Selected Division: ${selectedDivision}`
              : "No division selected"}
          </div>
        </div>

        <div className="dctHeaderActions">
          <button
            type="button"
            className="dctExportBtn"
            onClick={handleDownloadSummaryReport}
            disabled={loading || accordionSchools.length === 0 || isExporting}
          >
            {isExporting ? "Preparing..." : "Download Summary Report"}
          </button>
        </div>
      </div>

      <div className="dctAccordionWrap">
        {loading ? (
          <div className="dctEmpty">Loading consolidated division data...</div>
        ) : errorText ? (
          <div className="dctEmpty">{errorText}</div>
        ) : accordionSchools.length === 0 ? (
          <div className="dctEmpty">No data found for this division.</div>
        ) : (
          accordionSchools.map((school) => {
            const isSchoolOpen = !!openSchools[school.schoolId];

            return (
              <div key={school.schoolId} className="dctAccordionItem">
                <button
                  type="button"
                  className="dctAccordionHeader"
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

                  <div className="dctAccordionHeaderRight">
                    <span className="dctAccordionStat">
                      <span className="dctAccordionStatLabel">Enrollees</span>
                      <span className="dctAccordionStatValue">
                        {formatNumber(school.totals.enrolled)}
                      </span>
                    </span>

                    <span className="dctAccordionStat">
                      <span className="dctAccordionStatLabel">Received</span>
                      <span className="dctAccordionStatValue">
                        {formatNumber(school.totals.received)}
                      </span>
                    </span>

                    <span className="dctAccordionStat">
                      <span className="dctAccordionStatLabel">Gaps</span>
                      <span className="dctAccordionStatValue">
                        {formatNumber(school.totals.gaps)}
                      </span>
                    </span>

                    <span className="dctAccordionStat">
                      <span className="dctAccordionStatLabel">Surplus</span>
                      <span className="dctAccordionStatValue">
                        {formatNumber(school.totals.surplus)}
                      </span>
                    </span>
                  </div>
                </button>

                {isSchoolOpen && (
                  <div className="dctAccordionBody">
                    <div className="dctGradeAccordionWrap">
                      {school.grades.map((gradeBlock) => {
                        const gradeKey = `${school.schoolId}__${gradeBlock.grade}`;
                        const isGradeOpen = !!openGrades[gradeKey];

                        const hasGradeData =
                          gradeBlock.totals.enrolled > 0 ||
                          gradeBlock.totals.received > 0 ||
                          gradeBlock.totals.gaps > 0 ||
                          gradeBlock.totals.surplus > 0;

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
                                    {formatGradeLabel(gradeBlock.grade)}
                                    {gradeBlock.status && (
                                      <span
                                        className={getStatusDotClassName(gradeBlock.status)}
                                        aria-label={gradeBlock.status}
                                        title={gradeBlock.status}
                                      />
                                    )}
                                  </span>

                                  <span className="dctGradeAccordionCount">
                                    {hasGradeData
                                      ? `${gradeBlock.rows.length} subject${gradeBlock.rows.length > 1 ? "s" : ""}`
                                      : "No data"}
                                  </span>

                                </div>
                              </div>

                              <div className="dctGradeAccordionHeaderRight">
                                {hasGradeData ? (
                                  <>
                                    <span className="dctAccordionStat dctAccordionStat--small">
                                      <span className="dctAccordionStatLabel">Enrollees</span>
                                      <span className="dctAccordionStatValue">
                                        {formatNumber(gradeBlock.totals.enrolled)}
                                      </span>
                                    </span>

                                    <span className="dctAccordionStat dctAccordionStat--small">
                                      <span className="dctAccordionStatLabel">Received</span>
                                      <span className="dctAccordionStatValue">
                                        {formatNumber(gradeBlock.totals.received)}
                                      </span>
                                    </span>

                                    <span className="dctAccordionStat dctAccordionStat--small">
                                      <span className="dctAccordionStatLabel">Gaps</span>
                                      <span className="dctAccordionStatValue">
                                        {formatNumber(gradeBlock.totals.gaps)}
                                      </span>
                                    </span>

                                    <span className="dctAccordionStat dctAccordionStat--small">
                                      <span className="dctAccordionStatLabel">Surplus</span>
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
                                        <th>TOTAL ENROLLEES</th>
                                        <th>TOTAL RECEIVED</th>
                                        <th>GAPS</th>
                                        <th>SURPLUS</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {gradeBlock.rows.map((item, index) => {
                                        const isIncompleteReason =
                                          gradeBlock.status === "INCOMPLETE" &&
                                          !rowHasData(item);

                                        return (
                                        <tr
                                          key={`${school.schoolId}-${gradeBlock.grade}-${item.subject}-${index}`}
                                          className={isIncompleteReason ? "dctSchoolRow dctSchoolRow--incompleteReason" : "dctSchoolRow"}
                                        >
                                          <td>{formatGradeLabel(item.grade)}</td>
                                          <td>
                                            {item.subject === "(No Subject)"
                                              ? "-"
                                              : item.subject}
                                          </td>
                                          <td className="dctNumberCell">
                                            {formatNumber(item.enrolled)}
                                          </td>
                                          <td className="dctNumberCell">
                                            {formatNumber(item.received)}
                                          </td>
                                          <td className="dctNumberCell">
                                            {formatNumber(item.gaps)}
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

export default DivisionConsolidatedTable;
