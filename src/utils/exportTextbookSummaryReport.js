const XML_HEADER = '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>';

const escapeXml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const sanitizeSheetName = (value) =>
  String(value ?? "Sheet")
    .replace(/[\\/*?:[\]]/g, "")
    .trim()
    .slice(0, 31) || "Sheet";

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
  const normalizedValue = value ?? "";

  if (type === "Number") {
    return `<Cell ss:StyleID="${styleId}"><Data ss:Type="Number">${Number(
      normalizedValue || 0
    )}</Data></Cell>`;
  }

  return `<Cell ss:StyleID="${styleId}"><Data ss:Type="${type}">${escapeXml(
    normalizedValue
  )}</Data></Cell>`;
};

const buildRow = (cells, styleId = null) => {
  const attributes = styleId ? ` ss:StyleID="${styleId}"` : "";
  return `<Row${attributes}>${cells.join("")}</Row>`;
};

const buildWorksheetXml = (school) => {
  const headerRow = buildRow([
    buildCell("GRADE LEVEL", "String", "Header"),
    buildCell("SUBJECT", "String", "Header"),
    buildCell("TOTAL ENROLLEES", "String", "Header"),
    buildCell("TOTAL RECEIVED", "String", "Header"),
    buildCell("GAPS", "String", "Header"),
    buildCell("SURPLUS", "String", "Header"),
  ]);

  const bodyRows =
    school.rows.length === 0
      ? [
          buildRow([
            buildCell(
              school.schoolStatus === "NO DATA"
                ? "No textbook data found for this school."
                : "No textbook rows found for this school.",
              "String",
              "Empty"
            ),
            buildCell("", "String", "Empty"),
            buildCell("", "String", "Empty"),
            buildCell("", "String", "Empty"),
            buildCell("", "String", "Empty"),
            buildCell("", "String", "Empty"),
          ]),
        ]
      : school.rows.map((row) => {
          let styleId = "Data";
          if (row.status === "NO DATA") {
            styleId = "NoData";
          } else if (row.status === "INCOMPLETE") {
            styleId = "Incomplete";
          }

          return buildRow([
            buildCell(row.gradeLabel, "String", styleId),
            buildCell(row.subject || "-", "String", styleId),
            buildCell(row.enrolled, "Number", styleId),
            buildCell(row.received, "Number", styleId),
            buildCell(row.gaps, "Number", styleId),
            buildCell(row.surplus, "Number", styleId),
          ]);
        });

  return `
    <Worksheet ss:Name="${escapeXml(school.sheetName)}">
      <Table>
        <Column ss:Width="110"/>
        <Column ss:Width="260"/>
        <Column ss:Width="110"/>
        <Column ss:Width="110"/>
        <Column ss:Width="90"/>
        <Column ss:Width="90"/>
        ${headerRow}
        ${bodyRows.join("")}
      </Table>
      <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
        <FreezePanes/>
        <FrozenNoSplit/>
        <SplitHorizontal>1</SplitHorizontal>
        <TopRowBottomPane>1</TopRowBottomPane>
        <ActivePane>2</ActivePane>
        <Panes>
          <Pane>
            <Number>3</Number>
          </Pane>
          <Pane>
            <Number>2</Number>
          </Pane>
        </Panes>
      </WorksheetOptions>
    </Worksheet>
  `;
};

export const downloadTextbookSummaryReport = ({
  divisionName,
  schools = [],
}) => {
  const usedNames = new Set();
  const worksheets = schools.map((school) => ({
    ...school,
    sheetName: ensureUniqueSheetName(school.schoolName, usedNames),
  }));

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
        <Title>${escapeXml(`SUMMARY REPORT of textbooks - ${divisionName}`)}</Title>
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
        <Style ss:ID="Incomplete">
          <Font ss:Bold="1"/>
          <Interior ss:Color="#FDE68A" ss:Pattern="Solid"/>
          <Borders>
            <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
            <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
            <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
            <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
          </Borders>
        </Style>
        <Style ss:ID="NoData">
          <Font ss:Bold="1" ss:Color="#991B1B"/>
          <Interior ss:Color="#FECACA" ss:Pattern="Solid"/>
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
      </Styles>
      ${worksheets.map(buildWorksheetXml).join("")}
    </Workbook>
  `;

  const filenameDivision = formatFilenamePart(divisionName) || "DIVISION";
  const blob = new Blob([workbookXml], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `SUMMARY REPORT OF TEXTBOOKS - ${filenameDivision.toUpperCase()}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
