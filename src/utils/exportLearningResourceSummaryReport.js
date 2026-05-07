const XML_HEADER = '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>';

const escapeXml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const sanitizeSheetName = (value) =>
  String(value ?? "Summary")
    .replace(/[\\/*?:[\]]/g, "")
    .trim()
    .slice(0, 31) || "Summary";

const ensureUniqueSheetName = (rawName, usedNames) => {
  const baseName = sanitizeSheetName(rawName);
  let candidate = baseName;
  let counter = 2;

  while (usedNames.has(candidate)) {
    const suffix = ` (${counter})`;
    const trimmedBase = baseName.slice(0, Math.max(1, 31 - suffix.length));
    candidate = `${trimmedBase}${suffix}`;
    counter += 1;
  }

  usedNames.add(candidate);
  return candidate;
};

const formatFilenamePart = (value) =>
  String(value ?? "")
    .trim()
    .replace(/[<>:"/\\|?*]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const buildCell = (value, type = "String", styleId = "Data") => {
  if (type === "Number") {
    return `<Cell ss:StyleID="${styleId}"><Data ss:Type="Number">${Number(
      value || 0
    )}</Data></Cell>`;
  }

  return `<Cell ss:StyleID="${styleId}"><Data ss:Type="${type}">${escapeXml(
    value ?? ""
  )}</Data></Cell>`;
};

const buildRow = (cells, styleId = null) => {
  const attributes = styleId ? ` ss:StyleID="${styleId}"` : "";
  return `<Row${attributes}>${cells.join("")}</Row>`;
};

const buildWorksheetXml = ({ sheetName, rows }) => {
  const headerRow = buildRow([
    buildCell("GRADE LEVEL", "String", "Header"),
    buildCell("SUBJECT", "String", "Header"),
    buildCell("TOTAL ENROLLEES", "String", "Header"),
    buildCell("TOTAL RECEIVED", "String", "Header"),
    buildCell("GAP", "String", "Header"),
    buildCell("SURPLUS", "String", "Header"),
  ]);

  const bodyRows =
    rows.length === 0
      ? [
          buildRow([
            buildCell("No data found for this division.", "String", "Empty"),
            buildCell("", "String", "Empty"),
            buildCell("", "String", "Empty"),
            buildCell("", "String", "Empty"),
            buildCell("", "String", "Empty"),
            buildCell("", "String", "Empty"),
          ]),
        ]
      : rows.map((row) =>
          buildRow([
            buildCell(row.gradeLabel, "String"),
            buildCell(row.subject || "-", "String"),
            buildCell(row.enrolled, "Number"),
            buildCell(row.received, "Number"),
            buildCell(row.gap, "Number"),
            buildCell(row.surplus, "Number"),
          ])
        );

  const totalRow = rows.reduce(
    (totals, row) => ({
      enrolled: totals.enrolled + Number(row.enrolled || 0),
      received: totals.received + Number(row.received || 0),
      gap: totals.gap + Number(row.gap || 0),
      surplus: totals.surplus + Number(row.surplus || 0),
    }),
    { enrolled: 0, received: 0, gap: 0, surplus: 0 }
  );

  return `
    <Worksheet ss:Name="${escapeXml(sanitizeSheetName(sheetName))}">
      <Table>
        <Column ss:Width="110"/>
        <Column ss:Width="260"/>
        <Column ss:Width="120"/>
        <Column ss:Width="120"/>
        <Column ss:Width="100"/>
        <Column ss:Width="100"/>
        ${headerRow}
        ${bodyRows.join("")}
        ${buildRow(
          [
            buildCell("TOTAL", "String", "Total"),
            buildCell("", "String", "Total"),
            buildCell(totalRow.enrolled, "Number", "Total"),
            buildCell(totalRow.received, "Number", "Total"),
            buildCell(totalRow.gap, "Number", "Total"),
            buildCell(totalRow.surplus, "Number", "Total"),
          ],
          "Total"
        )}
      </Table>
      <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
        <FreezePanes/>
        <FrozenNoSplit/>
        <SplitHorizontal>1</SplitHorizontal>
        <TopRowBottomPane>1</TopRowBottomPane>
        <ActivePane>2</ActivePane>
      </WorksheetOptions>
    </Worksheet>
  `;
};

const buildQuarterSectionXml = ({ quarter, rows }) => {
  const sectionRow = buildRow(
    [
      buildCell(quarter, "String", "Section"),
      buildCell("", "String", "Section"),
      buildCell("", "String", "Section"),
      buildCell("", "String", "Section"),
      buildCell("", "String", "Section"),
      buildCell("", "String", "Section"),
    ],
    "Section"
  );

  const headerRow = buildRow([
    buildCell("SUBJECT", "String", "Header"),
    buildCell("TOTAL ENROLLEES", "String", "Header"),
    buildCell("TOTAL RECEIVED", "String", "Header"),
    buildCell("GAP", "String", "Header"),
    buildCell("SURPLUS", "String", "Header"),
    buildCell("", "String", "Header"),
  ]);

  const bodyRows =
    rows.length === 0
      ? [
          buildRow([
            buildCell("No data found for this quarter.", "String", "Empty"),
            buildCell("", "String", "Empty"),
            buildCell("", "String", "Empty"),
            buildCell("", "String", "Empty"),
            buildCell("", "String", "Empty"),
            buildCell("", "String", "Empty"),
          ]),
        ]
      : rows.map((row) =>
          buildRow([
            buildCell(row.subject || "-", "String"),
            buildCell(row.enrolled, "Number"),
            buildCell(row.received, "Number"),
            buildCell(row.gap, "Number"),
            buildCell(row.surplus, "Number"),
            buildCell("", "String"),
          ])
        );

  const totalRow = rows.reduce(
    (totals, row) => ({
      enrolled: totals.enrolled + Number(row.enrolled || 0),
      received: totals.received + Number(row.received || 0),
      gap: totals.gap + Number(row.gap || 0),
      surplus: totals.surplus + Number(row.surplus || 0),
    }),
    { enrolled: 0, received: 0, gap: 0, surplus: 0 }
  );

  return [
    sectionRow,
    headerRow,
    ...bodyRows,
    buildRow(
      [
        buildCell("TOTAL", "String", "Total"),
        buildCell(totalRow.enrolled, "Number", "Total"),
        buildCell(totalRow.received, "Number", "Total"),
        buildCell(totalRow.gap, "Number", "Total"),
        buildCell(totalRow.surplus, "Number", "Total"),
        buildCell("", "String", "Total"),
      ],
      "Total"
    ),
    buildRow([
      buildCell("", "String", "Empty"),
      buildCell("", "String", "Empty"),
      buildCell("", "String", "Empty"),
      buildCell("", "String", "Empty"),
      buildCell("", "String", "Empty"),
      buildCell("", "String", "Empty"),
    ]),
  ].join("");
};

const buildGradeWorksheetXml = ({ sheetName, gradeLabel, quarterSections }) => {
  const sections = quarterSections.map(buildQuarterSectionXml).join("");

  return `
    <Worksheet ss:Name="${escapeXml(sanitizeSheetName(sheetName))}">
      <Table>
        <Column ss:Width="260"/>
        <Column ss:Width="120"/>
        <Column ss:Width="120"/>
        <Column ss:Width="100"/>
        <Column ss:Width="100"/>
        <Column ss:Width="60"/>
        ${buildRow(
          [
            buildCell(gradeLabel, "String", "Title"),
            buildCell("", "String", "Title"),
            buildCell("", "String", "Title"),
            buildCell("", "String", "Title"),
            buildCell("", "String", "Title"),
            buildCell("", "String", "Title"),
          ],
          "Title"
        )}
        ${sections}
      </Table>
      <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
        <FreezePanes/>
        <FrozenNoSplit/>
        <SplitHorizontal>2</SplitHorizontal>
        <TopRowBottomPane>2</TopRowBottomPane>
        <ActivePane>2</ActivePane>
      </WorksheetOptions>
    </Worksheet>
  `;
};

const buildSchoolQuarterSectionXml = ({ quarter, rows }) => {
  const sectionRow = buildRow(
    [
      buildCell(quarter, "String", "Section"),
      buildCell("", "String", "Section"),
      buildCell("", "String", "Section"),
      buildCell("", "String", "Section"),
      buildCell("", "String", "Section"),
      buildCell("", "String", "Section"),
    ],
    "Section"
  );

  const headerRow = buildRow([
    buildCell("GRADE LEVEL", "String", "Header"),
    buildCell("SUBJECT", "String", "Header"),
    buildCell("TOTAL ENROLLEES", "String", "Header"),
    buildCell("TOTAL RECEIVED", "String", "Header"),
    buildCell("GAP", "String", "Header"),
    buildCell("SURPLUS", "String", "Header"),
  ]);

  const bodyRows =
    rows.length === 0
      ? [
          buildRow([
            buildCell("No data found for this quarter.", "String", "Empty"),
            buildCell("", "String", "Empty"),
            buildCell("", "String", "Empty"),
            buildCell("", "String", "Empty"),
            buildCell("", "String", "Empty"),
            buildCell("", "String", "Empty"),
          ]),
        ]
      : rows.map((row) =>
          buildRow([
            buildCell(row.gradeLabel, "String"),
            buildCell(row.subject || "-", "String"),
            buildCell(row.enrolled, "Number"),
            buildCell(row.received, "Number"),
            buildCell(row.gap, "Number"),
            buildCell(row.surplus, "Number"),
          ])
        );

  const totalRow = rows.reduce(
    (totals, row) => ({
      enrolled: totals.enrolled + Number(row.enrolled || 0),
      received: totals.received + Number(row.received || 0),
      gap: totals.gap + Number(row.gap || 0),
      surplus: totals.surplus + Number(row.surplus || 0),
    }),
    { enrolled: 0, received: 0, gap: 0, surplus: 0 }
  );

  return [
    sectionRow,
    headerRow,
    ...bodyRows,
    buildRow(
      [
        buildCell("TOTAL", "String", "Total"),
        buildCell("", "String", "Total"),
        buildCell(totalRow.enrolled, "Number", "Total"),
        buildCell(totalRow.received, "Number", "Total"),
        buildCell(totalRow.gap, "Number", "Total"),
        buildCell(totalRow.surplus, "Number", "Total"),
      ],
      "Total"
    ),
    buildRow([
      buildCell("", "String", "Empty"),
      buildCell("", "String", "Empty"),
      buildCell("", "String", "Empty"),
      buildCell("", "String", "Empty"),
      buildCell("", "String", "Empty"),
      buildCell("", "String", "Empty"),
    ]),
  ].join("");
};

const buildSchoolWorksheetXml = ({
  sheetName,
  schoolName,
  quarterSections,
}) => {
  const sections = quarterSections.map(buildSchoolQuarterSectionXml).join("");

  return `
    <Worksheet ss:Name="${escapeXml(sanitizeSheetName(sheetName))}">
      <Table>
        <Column ss:Width="110"/>
        <Column ss:Width="260"/>
        <Column ss:Width="120"/>
        <Column ss:Width="120"/>
        <Column ss:Width="100"/>
        <Column ss:Width="100"/>
        ${buildRow(
          [
            buildCell(schoolName, "String", "Title"),
            buildCell("", "String", "Title"),
            buildCell("", "String", "Title"),
            buildCell("", "String", "Title"),
            buildCell("", "String", "Title"),
            buildCell("", "String", "Title"),
          ],
          "Title"
        )}
        ${sections}
      </Table>
      <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
        <FreezePanes/>
        <FrozenNoSplit/>
        <SplitHorizontal>2</SplitHorizontal>
        <TopRowBottomPane>2</TopRowBottomPane>
        <ActivePane>2</ActivePane>
      </WorksheetOptions>
    </Worksheet>
  `;
};

export const downloadLearningResourceSummaryReport = ({
  divisionName,
  reportName,
  rows = [],
  gradeSheets = [],
  schoolSheets = [],
}) => {
  const safeReportName = String(reportName || "LR").trim();
  const usedSheetNames = new Set();
  const worksheets =
    schoolSheets.length > 0
      ? schoolSheets.map((sheet) =>
          buildSchoolWorksheetXml({
            ...sheet,
            sheetName: ensureUniqueSheetName(sheet.sheetName, usedSheetNames),
          })
        )
      : gradeSheets.length > 0
      ? gradeSheets.map((sheet) =>
          buildGradeWorksheetXml({
            ...sheet,
            sheetName: ensureUniqueSheetName(sheet.sheetName, usedSheetNames),
          })
        )
      : [
          buildWorksheetXml({
            sheetName: ensureUniqueSheetName(
              `${safeReportName} Summary`,
              usedSheetNames
            ),
            rows,
          }),
        ];

  const workbookXml = `
    ${XML_HEADER}
    <Workbook
      xmlns="urn:schemas-microsoft-com:office:spreadsheet"
      xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
      xmlns:html="http://www.w3.org/TR/REC-html40"
    >
      <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
        <Title>${escapeXml(`${safeReportName} SUMMARY REPORT - ${divisionName}`)}</Title>
      </DocumentProperties>
      <ExcelWorkbook xmlns="urn:schemas-microsoft-com:office:excel">
        <ProtectStructure>False</ProtectStructure>
        <ProtectWindows>False</ProtectWindows>
      </ExcelWorkbook>
      <Styles>
        <Style ss:ID="Header">
          <Font ss:Bold="1" ss:Color="#172033"/>
          <Interior ss:Color="#DDE7F4" ss:Pattern="Solid"/>
          <Borders>
            <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
            <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
            <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
            <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
          </Borders>
        </Style>
        <Style ss:ID="Data">
          <Borders>
            <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
            <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
            <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
            <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
          </Borders>
        </Style>
        <Style ss:ID="Total">
          <Font ss:Bold="1" ss:Color="#172033"/>
          <Interior ss:Color="#D9EAF7" ss:Pattern="Solid"/>
          <Borders>
            <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
            <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
            <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
            <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
          </Borders>
        </Style>
        <Style ss:ID="Empty">
          <Font ss:Italic="1" ss:Color="#667085"/>
        </Style>
        <Style ss:ID="Title">
          <Font ss:Bold="1" ss:Color="#FFFFFF"/>
          <Interior ss:Color="#17365D" ss:Pattern="Solid"/>
        </Style>
        <Style ss:ID="Section">
          <Font ss:Bold="1" ss:Color="#1F4E79"/>
          <Interior ss:Color="#EAF2F8" ss:Pattern="Solid"/>
        </Style>
      </Styles>
      ${worksheets.join("")}
    </Workbook>
  `;

  const filenameDivision = formatFilenamePart(divisionName) || "DIVISION";
  const filenameReport = formatFilenamePart(safeReportName) || "LR";
  const blob = new Blob([workbookXml], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filenameReport.toUpperCase()} SUMMARY REPORT - ${filenameDivision.toUpperCase()}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
