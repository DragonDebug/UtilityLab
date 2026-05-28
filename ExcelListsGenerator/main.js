(function () {
  "use strict";

  const XLSX = window.XLSX;
  const config = window.ExcelListsGeneratorConfig;
  const LISTS_SHEET_NAME = "Lists";
  const SAMPLE_ROW_NUMBER = 1;
  const TABLE_HEADER_ROW_NUMBER = 3;
  const FIRST_DATA_ROW_NUMBER = 4;
  const TABLE_COLUMN_SPAN = 2;
  const PROGRESS_TABLE_NAME = "tblProgressSteps";

  const appState = {
    button: document.getElementById("generateButton"),
    status: document.getElementById("statusMessage"),
  };

  function createWorkbook() {
    if (!XLSX?.utils) {
      throw new Error(
        "SheetJS failed to load. Refresh the page and try again.",
      );
    }

    if (
      !Array.isArray(config?.LIST_TABLE_DEFINITIONS) ||
      config.LIST_TABLE_DEFINITIONS.length === 0
    ) {
      throw new Error("Workbook list definitions are unavailable.");
    }

    const listsSheet = buildListsSheet();
    const model = {
      createdAt: new Date(),
      sheets: [listsSheet],
      namedRanges: [],
    };

    createExcelTableObjects(model);
    applyDataValidations(model);
    applyFormattingRules(model);

    const workbookBuffer = buildWorkbookPackage(model);
    const fileName = `validation-lists-template-${formatStamp(model.createdAt)}.xlsx`;

    downloadFile(workbookBuffer, fileName);
    return workbookBuffer;
  }

  function buildListsSheet() {
    const { LIST_TABLE_DEFINITIONS } = config;
    const columnCount = LIST_TABLE_DEFINITIONS.length * TABLE_COLUMN_SPAN - 1;
    const rowCount = Math.max(
      ...LIST_TABLE_DEFINITIONS.map(
        (definition) => definition.values.length + TABLE_HEADER_ROW_NUMBER,
      ),
    );
    const rows = Array.from({ length: rowCount }, () =>
      Array(columnCount).fill(null),
    );
    const tables = [];
    const colWidths = [];
    const progressDefinitionIndex = LIST_TABLE_DEFINITIONS.findIndex(
      (definition) => definition.tableName === PROGRESS_TABLE_NAME,
    );
    const progressColumnIndex =
      progressDefinitionIndex === -1
        ? null
        : progressDefinitionIndex * TABLE_COLUMN_SPAN;

    LIST_TABLE_DEFINITIONS.forEach((definition, index) => {
      const tableColumnIndex = index * TABLE_COLUMN_SPAN;
      const excelColumn = XLSX.utils.encode_col(tableColumnIndex);
      const endRow = definition.values.length + TABLE_HEADER_ROW_NUMBER;
      const width = Math.max(
        definition.header.length + 4,
        ...definition.values.map((value) => String(value).length + 4),
        18,
      );

      rows[TABLE_HEADER_ROW_NUMBER - 1][tableColumnIndex] = definition.header;
      definition.values.forEach((item, valueIndex) => {
        rows[valueIndex + FIRST_DATA_ROW_NUMBER - 1][tableColumnIndex] = item;
      });

      tables.push({
        name: definition.tableName,
        displayName: definition.tableName,
        styleName: "TableStyleLight11",
        headers: [definition.header],
        ref: `${excelColumn}${TABLE_HEADER_ROW_NUMBER}:${excelColumn}${endRow}`,
        definedName: definition.definedName,
        definedFormula: `${definition.tableName}[${definition.header}]`,
      });

      colWidths[tableColumnIndex] = width;
      if (tableColumnIndex + 1 < columnCount) {
        colWidths[tableColumnIndex + 1] = 4;
      }
    });

    const ws = XLSX.utils.aoa_to_sheet(rows, { sheetStubs: true });
    ws["!cols"] = colWidths.map((wch) => ({ wch }));

    return {
      name: LISTS_SHEET_NAME,
      rows,
      ws,
      columnCount,
      colWidths,
      progressColumnIndex,
      tables,
      validations: [],
    };
  }

  function createExcelTableObjects(model) {
    let tableId = 1;

    model.sheets.forEach((sheet) => {
      sheet.tables.forEach((table, index) => {
        table.id = tableId;
        table.relId = `rId${index + 1}`;
        table.path = `xl/tables/table${tableId}.xml`;
        tableId += 1;

        if (table.definedName && table.definedFormula) {
          model.namedRanges.push({
            name: table.definedName,
            formula: table.definedFormula,
          });
        }
      });
    });
  }

  function applyDataValidations(model) {
    const listsSheet = model.sheets.find(
      (sheet) => sheet.name === LISTS_SHEET_NAME,
    );
    if (!listsSheet) {
      return;
    }

    listsSheet.validations = config.LIST_TABLE_DEFINITIONS.map(
      (definition, index) => {
        const excelColumn = XLSX.utils.encode_col(index * TABLE_COLUMN_SPAN);
        return createListValidation(
          `${excelColumn}${SAMPLE_ROW_NUMBER}`,
          definition.definedName,
          `${definition.header} Sample`,
        );
      },
    );
  }

  function applyFormattingRules(model) {
    model.sheets.forEach((sheet) => {
      if (!sheet.ws["!cols"] && Array.isArray(sheet.colWidths)) {
        sheet.ws["!cols"] = sheet.colWidths.map((wch) => ({ wch }));
      }
    });
  }

  function downloadFile(arrayBuffer, fileName) {
    const blob = new Blob([arrayBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function createListValidation(sqref, formula1, label) {
    return {
      sqref,
      type: "list",
      allowBlank: true,
      formula1,
      errorTitle: `Invalid ${label}`,
      error: `Use one of the allowed ${label.toLowerCase()} values from the dropdown.`,
    };
  }

  function buildWorkbookPackage(model) {
    const files = [];

    files.push({
      path: "[Content_Types].xml",
      content: buildContentTypesXml(model),
    });
    files.push({ path: "_rels/.rels", content: buildRootRelationshipsXml() });
    files.push({
      path: "docProps/app.xml",
      content: buildAppPropertiesXml(model),
    });
    files.push({
      path: "docProps/core.xml",
      content: buildCorePropertiesXml(model),
    });
    files.push({ path: "xl/workbook.xml", content: buildWorkbookXml(model) });
    files.push({
      path: "xl/_rels/workbook.xml.rels",
      content: buildWorkbookRelationshipsXml(model),
    });
    files.push({ path: "xl/styles.xml", content: buildStylesXml() });
    files.push({ path: "xl/theme/theme1.xml", content: buildThemeXml() });

    model.sheets.forEach((sheet, index) => {
      files.push({
        path: `xl/worksheets/sheet${index + 1}.xml`,
        content: buildWorksheetXml(sheet),
      });

      if (sheet.tables.length > 0) {
        files.push({
          path: `xl/worksheets/_rels/sheet${index + 1}.xml.rels`,
          content: buildWorksheetRelationshipsXml(sheet),
        });
      }

      sheet.tables.forEach((table) => {
        files.push({ path: table.path, content: buildTableXml(table) });
      });
    });

    return createZipArchive(files);
  }

  function buildContentTypesXml(model) {
    const worksheetOverrides = model.sheets
      .map(
        (sheet, index) =>
          `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
      )
      .join("");

    const tableOverrides = model.sheets
      .flatMap((sheet) => sheet.tables)
      .map(
        (table) =>
          `<Override PartName="/${table.path}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/>`,
      )
      .join("");

    return xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
	<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
	<Default Extension="xml" ContentType="application/xml"/>
	<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
	<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
	<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
	${worksheetOverrides}
	<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
	<Override PartName="/xl/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
	${tableOverrides}
</Types>`);
  }

  function buildRootRelationshipsXml() {
    return xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
	<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
	<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
	<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`);
  }

  function buildAppPropertiesXml(model) {
    const titles = model.sheets
      .map((sheet) => `<vt:lpstr>${escapeXml(sheet.name)}</vt:lpstr>`)
      .join("");
    return xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
	<Application>Microsoft Excel</Application>
	<DocSecurity>0</DocSecurity>
	<ScaleCrop>false</ScaleCrop>
	<HeadingPairs>
		<vt:vector size="2" baseType="variant">
			<vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant>
			<vt:variant><vt:i4>${model.sheets.length}</vt:i4></vt:variant>
		</vt:vector>
	</HeadingPairs>
	<TitlesOfParts>
		<vt:vector size="${model.sheets.length}" baseType="lpstr">${titles}</vt:vector>
	</TitlesOfParts>
	<Company></Company>
	<LinksUpToDate>false</LinksUpToDate>
	<SharedDoc>false</SharedDoc>
	<HyperlinksChanged>false</HyperlinksChanged>
	<AppVersion>16.0300</AppVersion>
</Properties>`);
  }

  function buildCorePropertiesXml(model) {
    const timestamp = model.createdAt.toISOString();
    return xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
	<dc:title>Operational Tracking Workbook Template</dc:title>
	<dc:creator>Excel Template Generator</dc:creator>
	<cp:lastModifiedBy>Excel Template Generator</cp:lastModifiedBy>
	<dcterms:created xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:created>
	<dcterms:modified xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:modified>
</cp:coreProperties>`);
  }

  function buildWorkbookXml(model) {
    const sheetsXml = model.sheets
      .map(
        (sheet, index) =>
          `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
      )
      .join("");

    const definedNamesXml =
      model.namedRanges.length > 0
        ? `<definedNames>${model.namedRanges.map((range) => `<definedName name="${escapeXml(range.name)}">${escapeXml(range.formula)}</definedName>`).join("")}</definedNames>`
        : "";

    return xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
	<bookViews>
		<workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="12840"/>
	</bookViews>
	<sheets>${sheetsXml}</sheets>
	${definedNamesXml}
	<calcPr calcId="191029"/>
</workbook>`);
  }

  function buildWorkbookRelationshipsXml(model) {
    const sheetRelationships = model.sheets
      .map(
        (sheet, index) =>
          `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
      )
      .join("");
    const nextId = model.sheets.length + 1;

    return xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
	${sheetRelationships}
	<Relationship Id="rId${nextId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
	<Relationship Id="rId${nextId + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>
</Relationships>`);
  }

  function buildWorksheetXml(sheet) {
    const range = XLSX.utils.decode_range(sheet.ws["!ref"] || "A1");
    const lastRow = Math.max(range.e.r + 1, sheet.rows.length);
    const lastColumn = Math.max(range.e.c + 1, sheet.columnCount);
    const rowXml = [];

    for (let rowIndex = 0; rowIndex < lastRow; rowIndex += 1) {
      const values = sheet.rows[rowIndex] || [];
      const cells = [];

      for (let columnIndex = 0; columnIndex < lastColumn; columnIndex += 1) {
        const ref = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
        const value = values[columnIndex] ?? null;
        const styleIndex = getStyleIndex(sheet, rowIndex, columnIndex);
        const cellXml = buildCellXml(ref, value, styleIndex);
        if (cellXml) {
          cells.push(cellXml);
        }
      }

      if (cells.length > 0) {
        rowXml.push(`<row r="${rowIndex + 1}">${cells.join("")}</row>`);
      }
    }

    const colsXml = buildColumnsXml(sheet.colWidths);
    const validationsXml = buildValidationsXml(sheet.validations);
    const tablePartsXml =
      sheet.tables.length > 0
        ? `<tableParts count="${sheet.tables.length}">${sheet.tables.map((table) => `<tablePart r:id="${table.relId}"/>`).join("")}</tableParts>`
        : "";

    return xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
	<dimension ref="A1:${XLSX.utils.encode_cell({ r: lastRow - 1, c: lastColumn - 1 })}"/>
	<sheetViews><sheetView workbookViewId="0"/></sheetViews>
	<sheetFormatPr defaultRowHeight="18"/>
	${colsXml}
	<sheetData>${rowXml.join("")}</sheetData>
	${validationsXml}
	<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>
	${tablePartsXml}
</worksheet>`);
  }

  function buildWorksheetRelationshipsXml(sheet) {
    const relationships = sheet.tables
      .map(
        (table) =>
          `<Relationship Id="${table.relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="../tables/table${table.id}.xml"/>`,
      )
      .join("");

    return xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
	${relationships}
</Relationships>`);
  }

  function buildTableXml(table) {
    const columnsXml = table.headers
      .map(
        (header, index) =>
          `<tableColumn id="${index + 1}" name="${escapeXml(header)}"/>`,
      )
      .join("");

    return xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="${table.id}" name="${escapeXml(table.name)}" displayName="${escapeXml(table.displayName)}" ref="${table.ref}" totalsRowShown="0">
	<autoFilter ref="${table.ref}"/>
	<tableColumns count="${table.headers.length}">${columnsXml}</tableColumns>
	<tableStyleInfo name="${table.styleName}" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"/>
</table>`);
  }

  function buildStylesXml() {
    return xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
	<numFmts count="2">
		<numFmt numFmtId="164" formatCode="mm/dd/yyyy"/>
		<numFmt numFmtId="165" formatCode="0%"/>
	</numFmts>
	<fonts count="3">
		<font><sz val="11"/><color theme="1"/><name val="Aptos"/><family val="2"/></font>
		<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Aptos Display"/><family val="2"/></font>
		<font><b/><sz val="11"/><color rgb="FF17324D"/><name val="Aptos"/><family val="2"/></font>
	</fonts>
	<fills count="5">
		<fill><patternFill patternType="none"/></fill>
		<fill><patternFill patternType="gray125"/></fill>
		<fill><patternFill patternType="solid"><fgColor rgb="FF0F5EA6"/><bgColor indexed="64"/></patternFill></fill>
		<fill><patternFill patternType="solid"><fgColor rgb="FFE7EFF8"/><bgColor indexed="64"/></patternFill></fill>
		<fill><patternFill patternType="solid"><fgColor rgb="FFFDF1C7"/><bgColor indexed="64"/></patternFill></fill>
	</fills>
	<borders count="2">
		<border><left/><right/><top/><bottom/><diagonal/></border>
		<border>
			<left style="thin"><color rgb="FFD0D9E5"/></left>
			<right style="thin"><color rgb="FFD0D9E5"/></right>
			<top style="thin"><color rgb="FFD0D9E5"/></top>
			<bottom style="thin"><color rgb="FFD0D9E5"/></bottom>
			<diagonal/>
		</border>
	</borders>
	<cellStyleXfs count="1">
		<xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
	</cellStyleXfs>
	<cellXfs count="8">
		<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
		<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
		<xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
		<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
		<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
		<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="top" wrapText="1"/></xf>
		<xf numFmtId="0" fontId="2" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
		<xf numFmtId="165" fontId="2" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
	</cellXfs>
	<cellStyles count="1">
		<cellStyle name="Normal" xfId="0" builtinId="0"/>
	</cellStyles>
	<dxfs count="0"></dxfs>
	<tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>
</styleSheet>`);
  }

  function buildThemeXml() {
    return xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office Theme">
	<a:themeElements>
		<a:clrScheme name="Office">
			<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>
			<a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>
			<a:dk2><a:srgbClr val="1F1F1F"/></a:dk2>
			<a:lt2><a:srgbClr val="EEECE1"/></a:lt2>
			<a:accent1><a:srgbClr val="4F81BD"/></a:accent1>
			<a:accent2><a:srgbClr val="C0504D"/></a:accent2>
			<a:accent3><a:srgbClr val="9BBB59"/></a:accent3>
			<a:accent4><a:srgbClr val="8064A2"/></a:accent4>
			<a:accent5><a:srgbClr val="4BACC6"/></a:accent5>
			<a:accent6><a:srgbClr val="F79646"/></a:accent6>
			<a:hlink><a:srgbClr val="0000FF"/></a:hlink>
			<a:folHlink><a:srgbClr val="800080"/></a:folHlink>
		</a:clrScheme>
		<a:fontScheme name="Office">
			<a:majorFont>
				<a:latin typeface="Aptos Display"/>
				<a:ea typeface=""/>
				<a:cs typeface=""/>
			</a:majorFont>
			<a:minorFont>
				<a:latin typeface="Aptos"/>
				<a:ea typeface=""/>
				<a:cs typeface=""/>
			</a:minorFont>
		</a:fontScheme>
		<a:fmtScheme name="Office">
			<a:fillStyleLst>
				<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
				<a:gradFill rotWithShape="1">
					<a:gsLst>
						<a:gs pos="0"><a:schemeClr val="phClr"><a:tint val="50000"/><a:satMod val="300000"/></a:schemeClr></a:gs>
						<a:gs pos="35000"><a:schemeClr val="phClr"><a:tint val="37000"/><a:satMod val="300000"/></a:schemeClr></a:gs>
						<a:gs pos="100000"><a:schemeClr val="phClr"><a:tint val="15000"/><a:satMod val="350000"/></a:schemeClr></a:gs>
					</a:gsLst>
					<a:lin ang="16200000" scaled="1"/>
				</a:gradFill>
				<a:gradFill rotWithShape="1">
					<a:gsLst>
						<a:gs pos="0"><a:schemeClr val="phClr"><a:tint val="100000"/><a:shade val="100000"/><a:satMod val="130000"/></a:schemeClr></a:gs>
						<a:gs pos="100000"><a:schemeClr val="phClr"><a:tint val="50000"/><a:shade val="100000"/><a:satMod val="350000"/></a:schemeClr></a:gs>
					</a:gsLst>
					<a:lin ang="16200000" scaled="0"/>
				</a:gradFill>
			</a:fillStyleLst>
			<a:lnStyleLst>
				<a:ln w="9525" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>
				<a:ln w="25400" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>
				<a:ln w="38100" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>
			</a:lnStyleLst>
			<a:effectStyleLst>
				<a:effectStyle><a:effectLst/></a:effectStyle>
				<a:effectStyle><a:effectLst/></a:effectStyle>
				<a:effectStyle><a:effectLst><a:outerShdw blurRad="57150" dist="19050" dir="5400000" algn="ctr" rotWithShape="0"><a:srgbClr val="000000"><a:alpha val="63000"/></a:srgbClr></a:outerShdw></a:effectLst></a:effectStyle>
			</a:effectStyleLst>
			<a:bgFillStyleLst>
				<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
				<a:gradFill rotWithShape="1">
					<a:gsLst>
						<a:gs pos="0"><a:schemeClr val="phClr"><a:tint val="40000"/><a:satMod val="350000"/></a:schemeClr></a:gs>
						<a:gs pos="40000"><a:schemeClr val="phClr"><a:tint val="45000"/><a:shade val="99000"/><a:satMod val="350000"/></a:schemeClr></a:gs>
						<a:gs pos="100000"><a:schemeClr val="phClr"><a:shade val="20000"/><a:satMod val="255000"/></a:schemeClr></a:gs>
					</a:gsLst>
					<a:path path="circle"><a:fillToRect l="50000" t="-80000" r="50000" b="180000"/></a:path>
				</a:gradFill>
				<a:gradFill rotWithShape="1">
					<a:gsLst>
						<a:gs pos="0"><a:schemeClr val="phClr"><a:tint val="80000"/><a:satMod val="300000"/></a:schemeClr></a:gs>
						<a:gs pos="100000"><a:schemeClr val="phClr"><a:shade val="30000"/><a:satMod val="200000"/></a:schemeClr></a:gs>
					</a:gsLst>
					<a:path path="circle"><a:fillToRect l="50000" t="50000" r="50000" b="50000"/></a:path>
				</a:gradFill>
			</a:bgFillStyleLst>
		</a:fmtScheme>
	</a:themeElements>
	<a:objectDefaults/>
	<a:extraClrSchemeLst/>
</a:theme>`);
  }

  function buildColumnsXml(widths) {
    if (!Array.isArray(widths) || widths.length === 0) {
      return "";
    }

    const columns = widths
      .map(
        (width, index) =>
          `<col min="${index + 1}" max="${index + 1}" width="${Number(width).toFixed(2)}" customWidth="1"/>`,
      )
      .join("");

    return `<cols>${columns}</cols>`;
  }

  function buildValidationsXml(validations) {
    if (!Array.isArray(validations) || validations.length === 0) {
      return "";
    }

    return `<dataValidations count="${validations.length}">${validations
      .map(
        (validation) => `
				<dataValidation type="${validation.type}" allowBlank="${validation.allowBlank ? 1 : 0}" showInputMessage="0" showErrorMessage="1" errorStyle="stop" errorTitle="${escapeXml(validation.errorTitle)}" error="${escapeXml(validation.error)}" sqref="${validation.sqref}">
					<formula1>${escapeXml(validation.formula1)}</formula1>
				</dataValidation>`,
      )
      .join("")}
			</dataValidations>`;
  }

  function buildCellXml(ref, value, styleIndex) {
    const styleAttribute =
      Number.isInteger(styleIndex) && styleIndex > 0
        ? ` s="${styleIndex}"`
        : "";

    if (value === null || value === undefined || value === "") {
      return `<c r="${ref}"${styleAttribute}/>`;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return `<c r="${ref}"${styleAttribute}><v>${value}</v></c>`;
    }

    return `<c r="${ref}" t="inlineStr"${styleAttribute}><is><t>${escapeXml(String(value))}</t></is></c>`;
  }

  function getStyleIndex(sheet, rowIndex, columnIndex) {
    const excelRow = rowIndex + 1;

    if (sheet.name === LISTS_SHEET_NAME) {
      if (
        excelRow === SAMPLE_ROW_NUMBER &&
        columnIndex % TABLE_COLUMN_SPAN === 0
      ) {
        return columnIndex === sheet.progressColumnIndex ? 7 : 6;
      }

      if (excelRow === TABLE_HEADER_ROW_NUMBER) {
        return 2;
      }

      if (
        columnIndex === sheet.progressColumnIndex &&
        excelRow >= FIRST_DATA_ROW_NUMBER
      ) {
        return 4;
      }

      return 0;
    }

    return 0;
  }

  function createZipArchive(files) {
    const textEncoder = new TextEncoder();
    const crcTable = getCrcTable();
    const now = new Date();
    const dosTime =
      ((now.getHours() & 0x1f) << 11) |
      ((now.getMinutes() & 0x3f) << 5) |
      (Math.floor(now.getSeconds() / 2) & 0x1f);
    const dosDate =
      (((now.getFullYear() - 1980) & 0x7f) << 9) |
      (((now.getMonth() + 1) & 0x0f) << 5) |
      (now.getDate() & 0x1f);

    let offset = 0;
    const localParts = [];
    const centralParts = [];

    files.forEach((file) => {
      const nameBytes = textEncoder.encode(file.path);
      const contentBytes =
        typeof file.content === "string"
          ? textEncoder.encode(file.content)
          : file.content;
      const crc = crc32(contentBytes, crcTable);
      const localHeader = new Uint8Array(30 + nameBytes.length);
      const localView = new DataView(localHeader.buffer);

      localView.setUint32(0, 0x04034b50, true);
      localView.setUint16(4, 20, true);
      localView.setUint16(6, 0, true);
      localView.setUint16(8, 0, true);
      localView.setUint16(10, dosTime, true);
      localView.setUint16(12, dosDate, true);
      localView.setUint32(14, crc, true);
      localView.setUint32(18, contentBytes.length, true);
      localView.setUint32(22, contentBytes.length, true);
      localView.setUint16(26, nameBytes.length, true);
      localView.setUint16(28, 0, true);
      localHeader.set(nameBytes, 30);

      localParts.push(localHeader, contentBytes);

      const centralHeader = new Uint8Array(46 + nameBytes.length);
      const centralView = new DataView(centralHeader.buffer);

      centralView.setUint32(0, 0x02014b50, true);
      centralView.setUint16(4, 20, true);
      centralView.setUint16(6, 20, true);
      centralView.setUint16(8, 0, true);
      centralView.setUint16(10, 0, true);
      centralView.setUint16(12, dosTime, true);
      centralView.setUint16(14, dosDate, true);
      centralView.setUint32(16, crc, true);
      centralView.setUint32(20, contentBytes.length, true);
      centralView.setUint32(24, contentBytes.length, true);
      centralView.setUint16(28, nameBytes.length, true);
      centralView.setUint16(30, 0, true);
      centralView.setUint16(32, 0, true);
      centralView.setUint16(34, 0, true);
      centralView.setUint16(36, 0, true);
      centralView.setUint32(38, 0, true);
      centralView.setUint32(42, offset, true);
      centralHeader.set(nameBytes, 46);

      centralParts.push(centralHeader);
      offset += localHeader.length + contentBytes.length;
    });

    const centralSize = centralParts.reduce(
      (sum, part) => sum + part.length,
      0,
    );
    const endRecord = new Uint8Array(22);
    const endView = new DataView(endRecord.buffer);
    endView.setUint32(0, 0x06054b50, true);
    endView.setUint16(4, 0, true);
    endView.setUint16(6, 0, true);
    endView.setUint16(8, files.length, true);
    endView.setUint16(10, files.length, true);
    endView.setUint32(12, centralSize, true);
    endView.setUint32(16, offset, true);
    endView.setUint16(20, 0, true);

    const totalLength = offset + centralSize + endRecord.length;
    const archive = new Uint8Array(totalLength);
    let pointer = 0;

    [...localParts, ...centralParts, endRecord].forEach((part) => {
      archive.set(part, pointer);
      pointer += part.length;
    });

    return archive.buffer;
  }

  function getCrcTable() {
    if (getCrcTable.cache) {
      return getCrcTable.cache;
    }

    const table = new Uint32Array(256);

    for (let index = 0; index < 256; index += 1) {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1) {
        value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
      }
      table[index] = value >>> 0;
    }

    getCrcTable.cache = table;
    return table;
  }

  function crc32(bytes, table) {
    let crc = 0xffffffff;
    for (let index = 0; index < bytes.length; index += 1) {
      crc = (crc >>> 8) ^ table[(crc ^ bytes[index]) & 0xff];
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function escapeXml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  function xml(content) {
    return content.replace(/^\s+|\s+$/g, "");
  }

  function formatStamp(date) {
    const parts = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
      String(date.getHours()).padStart(2, "0"),
      String(date.getMinutes()).padStart(2, "0"),
    ];
    return `${parts[0]}${parts[1]}${parts[2]}-${parts[3]}${parts[4]}`;
  }

  function setStatus(message, isError) {
    if (!appState.status) {
      return;
    }

    appState.status.classList.toggle("error", Boolean(isError));
    appState.status.textContent = message;
  }

  async function handleGenerateClick() {
    if (!appState.button) {
      return;
    }

    appState.button.disabled = true;
    setStatus("Building workbook template...", false);

    try {
      createWorkbook();
      setStatus("Workbook generated and downloaded.", false);
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Workbook generation failed.",
        true,
      );
    } finally {
      appState.button.disabled = false;
    }
  }

  function initApp() {
    if (!appState.button) {
      return;
    }

    appState.button.addEventListener("click", handleGenerateClick);
  }

  initApp();
})();
