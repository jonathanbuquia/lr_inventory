import { useEffect, useMemo, useState } from "react";
import "./DivisionConsolidatedTable.css";

const DivisionConsolidatedTable = ({ selectedDivision }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [gradeFilter, setGradeFilter] = useState("ALL");
  const [subjectFilter, setSubjectFilter] = useState("ALL");
  const [errorText, setErrorText] = useState("");

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

  const formatNumber = (value) => {
    return Number(value || 0).toLocaleString();
  };

  const getBarColorClass = (percentage) => {
    if (percentage <= 50) return "dctBarFill--red";
    if (percentage <= 80) return "dctBarFill--blue";
    return "dctBarFill--green";
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

  useEffect(() => {
    const loadDivisionData = async () => {
      if (!selectedDivision) {
        setRows([]);
        setErrorText("");
        return;
      }

      setLoading(true);
      setRows([]);
      setErrorText("");
      setGradeFilter("ALL");
      setSubjectFilter("ALL");

      try {
        console.log("DivisionConsolidatedTable selectedDivision:", selectedDivision);

        const schoolsRes = await fetch(`/data/divisions/${selectedDivision}/schools.json`);

        if (!schoolsRes.ok) {
          throw new Error(
            `Cannot load schools.json for division: ${selectedDivision}`
          );
        }

        const schoolsData = await schoolsRes.json();
        console.log("schoolsData:", schoolsData);

        const schoolList = getSchoolsArray(schoolsData);
        console.log("schoolList:", schoolList);

        if (!schoolList.length) {
          setErrorText("No schools found inside schools.json.");
          setRows([]);
          setLoading(false);
          return;
        }

        const schoolFiles = await Promise.all(
          schoolList.map(async (school) => {
            const folderName = getSchoolFolderName(school);

            if (!folderName) {
              console.warn("No folder name found for school item:", school);
              return null;
            }

            const filePath = `/data/divisions/${selectedDivision}/schools/${folderName}/textbooks.json`;
            console.log("Trying file:", filePath);

            try {
              const res = await fetch(filePath);

              if (!res.ok) {
                console.warn("File not found:", filePath);
                return null;
              }

              const data = await res.json();
              console.log("Loaded file:", filePath, data);

              return data;
            } catch (error) {
              console.error("Error loading file:", filePath, error);
              return null;
            }
          })
        );

        const validFiles = schoolFiles.filter(Boolean);

        if (!validFiles.length) {
          setErrorText(
            "schools.json was found, but no textbooks.json files could be loaded. Check school folder names inside schools.json."
          );
          setRows([]);
          setLoading(false);
          return;
        }

        const merged = [];

        validFiles.forEach((file) => {
          const fileRows = Array.isArray(file?.rows)
            ? file.rows
            : Array.isArray(file)
              ? file
              : [];

          merged.push(...fileRows);
        });

        console.log("Merged rows:", merged);

        if (!merged.length) {
          setErrorText("Files were loaded, but no row data was found.");
        }

        setRows(merged);
      } catch (error) {
        console.error("Error loading consolidated division data:", error);
        setErrorText(error.message || "Failed to load division consolidated data.");
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    loadDivisionData();
  }, [selectedDivision]);

  const aggregatedRows = useMemo(() => {
    const grouped = {};

    rows.forEach((row) => {
      const grade = normalizeGrade(row?.["Grade Level"]);
      const subject = getSubjectValue(row);
      const enrolled = getEnrollmentValue(row);
      const received = getReceivedValue(row);
      const gaps = getGapValue(row);
      const surplus = getSurplusValue(row);

      if (!grade || !subject) return;

      const key = `${grade}__${subject}`;

      if (!grouped[key]) {
        grouped[key] = {
          grade,
          subject,
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

    return Object.values(grouped)
      .map((item) => {
        const rawPercentage =
          item.enrolled > 0 ? (item.received / item.enrolled) * 100 : 0;

        return {
          ...item,
          percentage: rawPercentage,
          displayPercentage: rawPercentage > 100 ? 100 : rawPercentage,
        };
      })
      .sort((a, b) => {
        const gradeDiff = gradeSortValue(a.grade) - gradeSortValue(b.grade);
        if (gradeDiff !== 0) return gradeDiff;
        return a.subject.localeCompare(b.subject);
      });
  }, [rows]);

  const gradeOptions = useMemo(() => {
    const uniqueGrades = [...new Set(aggregatedRows.map((item) => item.grade))];
    return uniqueGrades.sort((a, b) => gradeSortValue(a) - gradeSortValue(b));
  }, [aggregatedRows]);

  const subjectOptions = useMemo(() => {
    const baseRows =
      gradeFilter === "ALL"
        ? aggregatedRows
        : aggregatedRows.filter((item) => item.grade === gradeFilter);

    const uniqueSubjects = [...new Set(baseRows.map((item) => item.subject))];
    return uniqueSubjects.sort((a, b) => a.localeCompare(b));
  }, [aggregatedRows, gradeFilter]);

  const filteredRows = useMemo(() => {
    return aggregatedRows.filter((item) => {
      const matchGrade = gradeFilter === "ALL" || item.grade === gradeFilter;
      const matchSubject = subjectFilter === "ALL" || item.subject === subjectFilter;
      return matchGrade && matchSubject;
    });
  }, [aggregatedRows, gradeFilter, subjectFilter]);

  const enrolleesPerGrade = useMemo(() => {
    const grouped = {};

    aggregatedRows.forEach((item) => {
      if (!grouped[item.grade]) grouped[item.grade] = 0;
      grouped[item.grade] += item.enrolled;
    });

    return Object.entries(grouped)
      .map(([grade, enrolled]) => ({ grade, enrolled }))
      .sort((a, b) => gradeSortValue(a.grade) - gradeSortValue(b.grade));
  }, [aggregatedRows]);

  useEffect(() => {
    if (subjectFilter !== "ALL" && !subjectOptions.includes(subjectFilter)) {
      setSubjectFilter("ALL");
    }
  }, [subjectOptions, subjectFilter]);

  return (
    <section className="dctWrap">
      <div className="dctHeader">
        <div className="dctHeaderLeft">
          <div className="dctTitle">DIVISION CONSOLIDATED DATA</div>
          <div className="dctSubTitle">
            {selectedDivision
              ? `Selected Division: ${selectedDivision}`
              : "No division selected"}
          </div>
        </div>
      </div>

      <div className="dctControls">
        <div className="dctFilters">
          <div className="dctFilterItem">
            <label className="dctLabel">GRADE LEVEL</label>
            <select
              className="dctSelect"
              value={gradeFilter}
              onChange={(e) => {
                setGradeFilter(e.target.value);
                setSubjectFilter("ALL");
              }}
            >
              <option value="ALL">ALL</option>
              {gradeOptions.map((grade) => (
                <option key={grade} value={grade}>
                  {grade}
                </option>
              ))}
            </select>
          </div>

          <div className="dctFilterItem">
            <label className="dctLabel">SUBJECT</label>
            <select
              className="dctSelect"
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
            >
              <option value="ALL">ALL</option>
              {subjectOptions.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 👇 MOVED BELOW */}
      <div className="dctGradeSummary">
        <div className="dctGradeSummaryTitle">ENROLLEES PER GRADE</div>

        <div className="dctGradeSummaryGrid">
          {enrolleesPerGrade.map((item) => (
            <div key={item.grade} className="dctGradeCard">
              <span className="dctGradeCardLabel">
                {item.grade === "KINDER" ? "Kinder" : `Grade ${item.grade}`}
              </span>
              <span className="dctGradeCardValue">
                {formatNumber(item.enrolled)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="dctTableWrap">
        {loading ? (
          <div className="dctEmpty">Loading consolidated division data...</div>
        ) : errorText ? (
          <div className="dctEmpty">{errorText}</div>
        ) : filteredRows.length === 0 ? (
          <div className="dctEmpty">No data found for the selected filters.</div>
        ) : (
          <table className="dctTable">
            <thead>
              <tr>
                <th>SUBJECT</th>
                <th>GRAPH</th>
                <th>TOTAL RECEIVED MATERIALS</th>
                <th>GAPS</th>
                <th>SURPLUS</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((item, index) => (
                <tr key={`${item.grade}-${item.subject}-${index}`}>
                  <td>
                    <div className="dctSubjectMain">{item.subject}</div>
                    <div className="dctSubjectSub">Grade {item.grade}</div>
                  </td>

                  <td>
                    <div className="dctBarRow">
                      <div className="dctBarTrack">
                        <div
                          className={`dctBarFill ${getBarColorClass(item.displayPercentage)}`}
                          style={{ width: `${item.displayPercentage}%` }}
                        />
                      </div>
                      <div className="dctBarValue">{Math.round(item.percentage)}%</div>
                    </div>
                  </td>

                  <td className="dctNumberCell">{formatNumber(item.received)}</td>
                  <td className="dctNumberCell">{formatNumber(item.gaps)}</td>
                  <td className="dctNumberCell">{formatNumber(item.surplus)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
};

export default DivisionConsolidatedTable;