/* ═══════════════════════════════════════════════════════════
   excel-export.js  —  Xuất Excel có style dùng ExcelJS
   Tương ứng với giao diện in của B3, B4, B5
═══════════════════════════════════════════════════════════ */

const FMT_VN = n => Number(n).toLocaleString('vi-VN');

/* ── Style helpers ── */
const FONT_BASE   = { name: 'Times New Roman', size: 12 };
const FONT_BOLD   = { name: 'Times New Roman', size: 12, bold: true };
const FONT_TITLE  = { name: 'Times New Roman', size: 13, bold: true };
const FONT_HEADER = { name: 'Times New Roman', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };

const FILL_HEADER  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF343A40' } }; // đen
const FILL_GRPHEAD = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD8EAF8' } }; // xanh nhạt
const FILL_SUBHEAD = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } }; // xám nhạt
const FILL_TOTAL   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } }; // vàng

const BORDER_THIN = {
    top:    { style: 'thin', color: { argb: 'FF333333' } },
    left:   { style: 'thin', color: { argb: 'FF333333' } },
    bottom: { style: 'thin', color: { argb: 'FF333333' } },
    right:  { style: 'thin', color: { argb: 'FF333333' } },
};

function applyBorder(cell) { cell.border = BORDER_THIN; }

function cellStyle(cell, { font, fill, align, numFmt, bold } = {}) {
    cell.font      = font  || (bold ? FONT_BOLD : FONT_BASE);
    if (fill)   cell.fill      = fill;
    if (numFmt) cell.numFmt   = numFmt;
    cell.alignment = align || { vertical: 'middle', wrapText: true };
    applyBorder(cell);
}

function setMerge(ws, fromR, fromC, toR, toC) {
    ws.mergeCells(fromR, fromC, toR, toC);
}

/* ── Tiêu đề chung ── */
function writeTitle(ws, title, subtitle, colspan, startRow) {
    // Dòng cơ quan
    const r0 = ws.getRow(startRow);
    r0.getCell(1).value = 'SỞ NỘI VỤ';
    r0.getCell(1).font  = FONT_BOLD;
    r0.height = 18;

    // Tiêu đề chính
    const r1 = ws.getRow(startRow + 1);
    const c1 = r1.getCell(1);
    c1.value     = title;
    c1.font      = FONT_TITLE;
    c1.alignment = { horizontal: 'center', vertical: 'middle' };
    setMerge(ws, startRow + 1, 1, startRow + 1, colspan);
    r1.height = 22;

    // Phụ đề
    if (subtitle) {
        const r2 = ws.getRow(startRow + 2);
        const c2 = r2.getCell(1);
        c2.value     = subtitle;
        c2.font      = { name: 'Times New Roman', size: 12, italic: true };
        c2.alignment = { horizontal: 'center', vertical: 'middle' };
        setMerge(ws, startRow + 2, 1, startRow + 2, colspan);
        r2.height = 16;
    }

    // ĐVT
    const dvtRow = startRow + (subtitle ? 3 : 2);
    const r3 = ws.getRow(dvtRow);
    const c3 = r3.getCell(colspan);
    c3.value     = 'ĐVT: Đồng';
    c3.font      = { name: 'Times New Roman', size: 11, italic: true };
    c3.alignment = { horizontal: 'right', vertical: 'middle' };
    r3.height = 16;

    return dvtRow + 1; // hàng bắt đầu bảng
}

/* ── Chữ ký cuối trang ── */
function writeSignature(ws, startRow, colspan, { ngay, thang, nam, nguoilap, ketoan, thuTruong } = {}) {
    const ngayStr = `Sơn La, ngày ${ngay || '___'} tháng ${thang || '___'} năm ${nam || '2026'}`;
    const r1 = ws.getRow(startRow + 1);
    r1.getCell(colspan).value     = ngayStr;
    r1.getCell(colspan).font      = { name: 'Times New Roman', size: 12, italic: true };
    r1.getCell(colspan).alignment = { horizontal: 'right' };

    const colW  = Math.floor(colspan / 3);
    const cols  = [1, colW + 1, colW * 2 + 1];
    const names = ['Người lập', 'Kế toán trưởng', 'Thủ trưởng đơn vị'];
    const signs = [nguoilap || '', ketoan || '', thuTruong || ''];

    const r2 = ws.getRow(startRow + 2);
    cols.forEach((c, i) => {
        r2.getCell(c).value     = names[i];
        r2.getCell(c).font      = FONT_BOLD;
        r2.getCell(c).alignment = { horizontal: 'center' };
    });

    // Khoảng trống ký tên
    ws.getRow(startRow + 3).height = 18;
    ws.getRow(startRow + 4).height = 18;
    ws.getRow(startRow + 5).height = 18;

    const r6 = ws.getRow(startRow + 6);
    cols.forEach((c, i) => {
        r6.getCell(c).value     = signs[i];
        r6.getCell(c).font      = FONT_BOLD;
        r6.getCell(c).alignment = { horizontal: 'center' };
    });
}

/* ════════════════════════════════════════════════════════
   BẢNG 3 — Thông báo kinh phí
═══════════════════════════════════════════════════════ */
async function exportB3Excel() {
    const dot = $('#b3-dot').val();
    const res = await API.thongBaoDot(dot);
    const data = res.data || [];
    if (!data.length) { alert('Không có dữ liệu để xuất'); return; }

    const ExcelJS = window.ExcelJS;
    const wb = new ExcelJS.Workbook();
    wb.creator = 'MTP System';
    const ws = wb.addWorksheet('ThongBao', { pageSetup: { paperSize: 9, orientation: 'portrait' } });

    // Độ rộng cột: STT | Tên đơn vị | Số tiền | Số QĐ | Số TK
    ws.columns = [
        { width: 6  },
        { width: 35 },
        { width: 18 },
        { width: 40 },
        { width: 22 },
    ];

    const dotLabel  = dot ? `Đợt ${dot}` : 'Tất cả các đợt';
    const subtitle  = $('#b3-ktt').text() || '';
    const tableStart = writeTitle(ws,
        `DANH SÁCH CHI TRẢ MAI TÁNG PHÍ NĂM 2026 – ${dotLabel}`,
        subtitle, 5, 1);

    // Header bảng
    const hRow = ws.getRow(tableStart);
    hRow.height = 30;
    ['STT', 'Tên đơn vị / Phòng Tài chính', 'Số tiền (đồng)', 'Số Quyết định', 'Số TK Kho bạc'].forEach((v, i) => {
        const c = hRow.getCell(i + 1);
        c.value     = v;
        c.font      = FONT_HEADER;
        c.fill      = FILL_HEADER;
        c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        applyBorder(c);
    });

    // Dữ liệu
    let grandTotal = 0;
    data.forEach((r, i) => {
        grandTotal += parseFloat(r.tong);
        const row = ws.addRow([i + 1, r.donvi, parseFloat(r.tong), r.soqds, r.sotk || '—']);
        row.height = 20;
        row.eachCell((cell, colNum) => {
            cell.font      = FONT_BASE;
            cell.alignment = {
                horizontal: colNum === 1 ? 'center' : colNum === 3 ? 'right' : 'left',
                vertical: 'middle', wrapText: true
            };
            applyBorder(cell);
            if (colNum === 3) cell.numFmt = '#,##0';
        });
    });

    // Dòng tổng
    const totRow = ws.addRow(['', 'TỔNG CỘNG:', grandTotal, `${data.length} đơn vị`, '']);
    totRow.height = 22;
    totRow.eachCell((cell, colNum) => {
        cell.font      = FONT_BOLD;
        cell.fill      = FILL_TOTAL;
        cell.alignment = { horizontal: colNum === 3 ? 'right' : colNum === 2 ? 'right' : 'center', vertical: 'middle' };
        applyBorder(cell);
        if (colNum === 3) cell.numFmt = '#,##0';
    });

    // Lưu và tải xuống
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `thongbao_mtp_dot${dot || 'all'}.xlsx`; a.click();
    URL.revokeObjectURL(url);
}

/* ════════════════════════════════════════════════════════
   BẢNG 4 — Chi tiết theo đợt (ma trận loại × mức)
═══════════════════════════════════════════════════════ */
async function exportB4Excel() {
    const dot = $('#b4-dot').val();
    const res = await API.chiTietDot(dot);
    const { data, loais, mucs } = res;
    if (!data?.length) { alert('Không có dữ liệu để xuất'); return; }

    // Lọc loại/mức có dữ liệu (giống loadB4)
    const activeLoais = [], activeMucs = {};
    loais.forEach(l => {
        let has = false;
        mucs.forEach(m => { if (data.some(r => r.cells[l][m] > 0)) has = true; });
        if (has) { activeLoais.push(l); activeMucs[l] = mucs.filter(m => data.some(r => r.cells[l][m] > 0)); }
    });

    // Tính tổng số cột: STT + Tên + (mức+cộng)*loại + Tổng + SốQĐ
    let dataCols = 0;
    activeLoais.forEach(l => dataCols += activeMucs[l].length + 1);
    const totalCols = 2 + dataCols + 2;

    const ExcelJS = window.ExcelJS;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('ChiTiet', { pageSetup: { paperSize: 9, orientation: 'landscape' } });

    // Độ rộng cột
    const colWidths = [6, 32];
    activeLoais.forEach(l => { activeMucs[l].forEach(() => colWidths.push(10)); colWidths.push(16); });
    colWidths.push(16, 36);
    ws.columns = colWidths.map(w => ({ width: w }));

    const dotLabel   = dot ? `Đợt ${dot}` : 'Tất cả các đợt';
    const tableStart = writeTitle(ws,
        `BẢNG CHI TIẾT MAI TÁNG PHÍ NĂM 2026 – ${dotLabel}`,
        $('#b4-ktt').text() || '', totalCols, 1);

    // Header hàng 1: STT | Tên đơn vị | [loai colspan] ... | Tổng | Số QĐ
    let colIdx = 1;
    const h1Row = ws.getRow(tableStart);
    h1Row.height = 32;

    // STT (merge 2 hàng)
    setMerge(ws, tableStart, colIdx, tableStart + 1, colIdx);
    const sttCell = h1Row.getCell(colIdx++);
    sttCell.value = 'STT';
    sttCell.font  = FONT_HEADER; sttCell.fill = FILL_HEADER;
    sttCell.alignment = { horizontal: 'center', vertical: 'middle' };
    applyBorder(sttCell);

    // Tên đơn vị (merge 2 hàng)
    setMerge(ws, tableStart, colIdx, tableStart + 1, colIdx);
    const tenCell = h1Row.getCell(colIdx++);
    tenCell.value = 'Tên đơn vị';
    tenCell.font  = FONT_HEADER; tenCell.fill = FILL_HEADER;
    tenCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    applyBorder(tenCell);

    // Nhóm loại
    activeLoais.forEach(l => {
        const span = activeMucs[l].length + 1;
        setMerge(ws, tableStart, colIdx, tableStart, colIdx + span - 1);
        const gc = h1Row.getCell(colIdx);
        gc.value     = l;
        gc.font      = { name: 'Times New Roman', size: 11, bold: true };
        gc.fill      = FILL_GRPHEAD;
        gc.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        applyBorder(gc);
        colIdx += span;
    });

    // Tổng cộng (merge 2 hàng)
    setMerge(ws, tableStart, colIdx, tableStart + 1, colIdx);
    const tcCell = h1Row.getCell(colIdx++);
    tcCell.value     = 'Tổng cộng';
    tcCell.font      = FONT_HEADER; tcCell.fill = FILL_HEADER;
    tcCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    applyBorder(tcCell);

    // Số QĐ (merge 2 hàng)
    setMerge(ws, tableStart, colIdx, tableStart + 1, colIdx);
    const qdCell = h1Row.getCell(colIdx);
    qdCell.value     = 'Số Quyết định';
    qdCell.font      = FONT_HEADER; qdCell.fill = FILL_HEADER;
    qdCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    applyBorder(qdCell);

    // Header hàng 2: mức từng loại + "Cộng"
    const h2Row = ws.getRow(tableStart + 1);
    h2Row.height = 24;
    let h2Col = 3;
    activeLoais.forEach(l => {
        activeMucs[l].forEach(m => {
            const mc = h2Row.getCell(h2Col++);
            mc.value     = `${(m / 1000000).toFixed(m % 1000000 === 0 ? 0 : 1)}tr`;
            mc.font      = { name: 'Times New Roman', size: 11, bold: true };
            mc.fill      = FILL_SUBHEAD;
            mc.alignment = { horizontal: 'center', vertical: 'middle' };
            applyBorder(mc);
        });
        const cc = h2Row.getCell(h2Col++);
        cc.value     = 'Cộng';
        cc.font      = { name: 'Times New Roman', size: 11, bold: true };
        cc.fill      = FILL_SUBHEAD;
        cc.alignment = { horizontal: 'center', vertical: 'middle' };
        applyBorder(cc);
    });

    // Dữ liệu
    const totals = {};
    activeLoais.forEach(l => { totals[l] = {}; activeMucs[l].forEach(m => totals[l][m] = 0); });
    let grandTotal = 0;

    data.forEach((row, i) => {
        const values = [i + 1, row.donvi || ''];
        let rowTotal = 0;
        activeLoais.forEach(l => {
            let cong = 0;
            activeMucs[l].forEach(m => {
                const sl = row.cells[l][m] || 0;
                totals[l][m] = (totals[l][m] || 0) + sl;
                values.push(sl || null);
                cong += sl * m;
            });
            rowTotal += cong;
            values.push(cong || null);
        });
        grandTotal += rowTotal;
        values.push(rowTotal, row.soqds);

        const dataRow = ws.addRow(values);
        dataRow.height = 20;
        dataRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
            cell.font      = FONT_BASE;
            cell.alignment = {
                horizontal: colNum === 1 ? 'center' : colNum === 2 || colNum === totalCols ? 'left' : 'right',
                vertical: 'middle', wrapText: colNum === 2 || colNum === totalCols
            };
            applyBorder(cell);
            if (colNum >= 3 && colNum < totalCols) cell.numFmt = '#,##0';
        });
    });

    // Dòng tổng
    const footVals = ['', 'TỔNG CỘNG'];
    activeLoais.forEach(l => {
        let cong = 0;
        activeMucs[l].forEach(m => { const sl = totals[l][m] || 0; cong += sl * m; footVals.push(sl || null); });
        footVals.push(cong || null);
    });
    footVals.push(grandTotal, '');
    const fRow = ws.addRow(footVals);
    fRow.height = 22;
    fRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
        cell.font      = FONT_BOLD;
        cell.fill      = FILL_TOTAL;
        cell.alignment = { horizontal: colNum <= 2 ? 'right' : 'right', vertical: 'middle' };
        applyBorder(cell);
        if (colNum >= 3) cell.numFmt = '#,##0';
    });

    const buf  = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `chitiet_mtp_dot${dot || 'all'}.xlsx`; a.click();
    URL.revokeObjectURL(url);
}

/* ════════════════════════════════════════════════════════
   BẢNG 5 — Chi tiết theo xã
═══════════════════════════════════════════════════════ */
async function exportB5Excel() {
    const dot   = $('#b5-dot').val();
    const xa_id = $('#b5-xa').val();
    if (!xa_id) { alert('Vui lòng chọn xã trước'); return; }

    const res = await API.chiTietXa(dot, xa_id);
    if (res.status === 'error') { alert(res.msg); return; }

    const { loais, mucs, cells, total, soqds, xa, donvi } = res;

    const activeLoais = [], activeMucs = {};
    loais.forEach(l => {
        let has = false; mucs.forEach(m => { if (cells[l][m] > 0) has = true; });
        if (has) { activeLoais.push(l); activeMucs[l] = mucs.filter(m => cells[l][m] > 0); }
    });

    let dataCols = 0;
    activeLoais.forEach(l => dataCols += activeMucs[l].length + 1);
    const totalCols = 2 + dataCols + 2;

    const ExcelJS = window.ExcelJS;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('ChiTietXa', { pageSetup: { paperSize: 9, orientation: 'landscape' } });

    const colWidths = [6, 36];
    activeLoais.forEach(l => { activeMucs[l].forEach(() => colWidths.push(10)); colWidths.push(16); });
    colWidths.push(16, 40);
    ws.columns = colWidths.map(w => ({ width: w }));

    // Thông tin thông báo
    const sotb  = $('#b5-sotb').val().trim() || '______';
    const tbP   = ($('#b5-ngaytb-picker').val() || '').split('/');
    const ngay  = tbP[0] || '___', thang = tbP[1] || '___';
    const subtitle = `(Kèm theo Thông báo số: ${sotb}/TB-SNV ngày ${ngay} tháng ${thang} năm 2026 của Sở Nội vụ)`;

    const tableStart = writeTitle(ws,
        `DANH SÁCH CHI TRẢ MAI TÁNG PHÍ NĂM 2026 ĐỢT ${dot} – XÃ ${xa}`,
        subtitle, totalCols, 1);

    // Header hàng 1
    let colIdx = 1;
    const h1Row = ws.getRow(tableStart);
    h1Row.height = 32;

    setMerge(ws, tableStart, colIdx, tableStart + 1, colIdx);
    const sttC = h1Row.getCell(colIdx++);
    sttC.value = 'STT'; sttC.font = FONT_HEADER; sttC.fill = FILL_HEADER;
    sttC.alignment = { horizontal: 'center', vertical: 'middle' };
    applyBorder(sttC);

    setMerge(ws, tableStart, colIdx, tableStart + 1, colIdx);
    const tenC = h1Row.getCell(colIdx++);
    tenC.value = 'Tên đơn vị'; tenC.font = FONT_HEADER; tenC.fill = FILL_HEADER;
    tenC.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    applyBorder(tenC);

    activeLoais.forEach(l => {
        const span = activeMucs[l].length + 1;
        setMerge(ws, tableStart, colIdx, tableStart, colIdx + span - 1);
        const gc = h1Row.getCell(colIdx);
        gc.value = l; gc.font = { name: 'Times New Roman', size: 11, bold: true };
        gc.fill = FILL_GRPHEAD;
        gc.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        applyBorder(gc);
        colIdx += span;
    });

    setMerge(ws, tableStart, colIdx, tableStart + 1, colIdx);
    const tcC = h1Row.getCell(colIdx++);
    tcC.value = 'Tổng cộng'; tcC.font = FONT_HEADER; tcC.fill = FILL_HEADER;
    tcC.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    applyBorder(tcC);

    setMerge(ws, tableStart, colIdx, tableStart + 1, colIdx);
    const qdC = h1Row.getCell(colIdx);
    qdC.value = 'Số Quyết định'; qdC.font = FONT_HEADER; qdC.fill = FILL_HEADER;
    qdC.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    applyBorder(qdC);

    // Header hàng 2
    const h2Row = ws.getRow(tableStart + 1);
    h2Row.height = 24;
    let h2Col = 3;
    activeLoais.forEach(l => {
        activeMucs[l].forEach(m => {
            const mc = h2Row.getCell(h2Col++);
            mc.value = `${(m / 1000000).toFixed(m % 1000000 === 0 ? 0 : 1)}tr`;
            mc.font = { name: 'Times New Roman', size: 11, bold: true };
            mc.fill = FILL_SUBHEAD;
            mc.alignment = { horizontal: 'center', vertical: 'middle' };
            applyBorder(mc);
        });
        const cc = h2Row.getCell(h2Col++);
        cc.value = 'Cộng'; cc.font = { name: 'Times New Roman', size: 11, bold: true };
        cc.fill = FILL_SUBHEAD;
        cc.alignment = { horizontal: 'center', vertical: 'middle' };
        applyBorder(cc);
    });

    // Dữ liệu — chỉ 1 hàng (1 xã)
    const values = [1, donvi];
    let rowTotal = 0;
    activeLoais.forEach(l => {
        let cong = 0;
        activeMucs[l].forEach(m => { const sl = cells[l][m] || 0; values.push(sl || null); cong += sl * m; });
        rowTotal += cong;
        values.push(cong || null);
    });
    values.push(rowTotal, soqds);

    const dataRow = ws.addRow(values);
    dataRow.height = 22;
    dataRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
        cell.font      = FONT_BASE;
        cell.alignment = {
            horizontal: colNum === 1 ? 'center' : colNum === 2 || colNum === totalCols ? 'left' : 'right',
            vertical: 'middle', wrapText: colNum === 2 || colNum === totalCols
        };
        applyBorder(cell);
        if (colNum >= 3 && colNum < totalCols) cell.numFmt = '#,##0';
    });

    // Số tiền bằng chữ
    ws.addRow([]);
    const wordsRow = ws.addRow([`Số tiền bằng chữ: ${numberToWords(rowTotal)}`]);
    setMerge(ws, wordsRow.number, 1, wordsRow.number, totalCols);
    wordsRow.getCell(1).font      = FONT_BOLD;
    wordsRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };

    // Chữ ký
    writeSignature(ws, wordsRow.number + 1, totalCols, {
        ngay, thang, nam: '2026',
        nguoilap:  $('#b5-nguoilap').val() || '',
        ketoan:    $('#b5-ke_toan').val()  || '',
        thuTruong: $('#b5-thu_truong').val() || '',
    });

    const buf  = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `chitiet_mtp_dot${dot}_${xa.replace(/\s+/g,'_')}.xlsx`; a.click();
    URL.revokeObjectURL(url);
}
