// hoso_docx.js — Tạo DOCX quyết định mai táng phí bằng XML thuần (không cần npm docx)
const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { execSync } = require('child_process');

function xmlEsc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function boldRun(text, size) {
  const sz = size ? `<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>` : '';
  return `<w:r><w:rPr><w:b/>${sz}</w:rPr><w:t xml:space="preserve">${xmlEsc(text)}</w:t></w:r>`;
}
function italicRun(text) {
  return `<w:r><w:rPr><w:i/></w:rPr><w:t xml:space="preserve">${xmlEsc(text)}</w:t></w:r>`;
}
function normalRun(text) {
  return `<w:r><w:t xml:space="preserve">${xmlEsc(text)}</w:t></w:r>`;
}
function boldUnderlineRun(text) {
  return `<w:r><w:rPr><w:b/><w:u w:val="single"/></w:rPr><w:t xml:space="preserve">${xmlEsc(text)}</w:t></w:r>`;
}

function para(content, align, spacing) {
  const jc = align ? `<w:jc w:val="${align}"/>` : '';
  const sp = spacing || '';
  return `<w:p><w:pPr>${jc}${sp}<w:spacing w:after="60"/></w:pPr>${content}</w:p>`;
}
function paraItalic(text) {
  return `<w:p><w:pPr><w:spacing w:after="60"/></w:pPr>${italicRun(text)}</w:p>`;
}
function spacePara() {
  return `<w:p><w:pPr><w:spacing w:after="100"/></w:pPr></w:p>`;
}

function twoColTable(leftParas, rightParas) {
  const leftXml  = leftParas.join('');
  const rightXml = rightParas.join('');
  const NB = `<w:tcBorders><w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/></w:tcBorders>`;
  return `
<w:tbl>
  <w:tblPr>
    <w:tblW w:w="9355" w:type="dxa"/>
    <w:tblBorders><w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/><w:insideH w:val="none"/><w:insideV w:val="none"/></w:tblBorders>
  </w:tblPr>
  <w:tblGrid><w:gridCol w:w="4500"/><w:gridCol w:w="4855"/></w:tblGrid>
  <w:tr>
    <w:tc><w:tcPr><w:tcW w:w="4500" w:type="dxa"/>${NB}</w:tcPr>${leftXml}</w:tc>
    <w:tc><w:tcPr><w:tcW w:w="4855" w:type="dxa"/>${NB}</w:tcPr>${rightXml}</w:tc>
  </w:tr>
</w:tbl>`;
}

function soTienBangChu(so) {
  if (!so) return 'Không đồng';
  const cs = ['không','một','hai','ba','bốn','năm','sáu','bảy','tám','chín'];
  const dv = ['','nghìn','triệu','tỷ'];
  function doc3(n) {
    const tr=Math.floor(n/100), ch=Math.floor((n%100)/10), dv2=n%10;
    let s='';
    if(tr) s+=cs[tr]+' trăm ';
    if(ch===0&&dv2&&tr) s+='lẻ ';
    else if(ch===1) s+='mười ';
    else if(ch>1) s+=cs[ch]+' mươi ';
    if(dv2===1&&ch>1) s+='mốt';
    else if(dv2===5&&ch>0) s+='lăm';
    else if(dv2) s+=cs[dv2];
    return s.trim();
  }
  const parts=[]; let tmp=so, idx=0;
  while(tmp>0){ parts.unshift({val:tmp%1000,dv:dv[idx++]}); tmp=Math.floor(tmp/1000); }
  const words=parts.map(p=>p.val?doc3(p.val)+(p.dv?' '+p.dv:''):'').filter(Boolean);
  const result=words.join(', ');
  return result.charAt(0).toUpperCase()+result.slice(1)+' đồng chẵn';
}

function buildDocx(row) {
  const tmpId  = `${row.id}_${Date.now()}`;
  const tmpDir = path.join(os.tmpdir(), `qd_mtp_${tmpId}`);
  const outDoc = path.join(os.tmpdir(), `qd_mtp_${tmpId}.docx`);

  fs.mkdirSync(tmpDir + '/word', { recursive: true });
  fs.mkdirSync(tmpDir + '/word/_rels', { recursive: true });
  fs.mkdirSync(tmpDir + '/_rels', { recursive: true });

  // ── Tính các chuỗi nội dung ──
  const muc       = Number(row.muc).toLocaleString('vi-VN');
  const soTienChu = soTienBangChu(Number(row.muc));
  const tenDT     = row.ten_dt  || '......';
  const nguoiNhan = row.nguoi_nhan || '......';
  const banDT     = row.ban_dt  ? `Bản ${row.ban_dt}, ` : '';
  const xaDT      = row.xa_dt   || row.xa || '';
  const queQuanDT = row.que_quan_dt || (xaDT ? `${xaDT}, tỉnh Sơn La` : '');
  const banNhan   = row.ban_nhan ? `Bản ${row.ban_nhan}, ` : '';
  const xaNhan    = row.xa_nhan  || row.xa || '';
  const ttNhan    = `${banNhan}${xaNhan}, tỉnh Sơn La`;
  const loaiChiTiet = row.loai_chitiet || '';
  const loaiChiTietPart = loaiChiTiet ? ` - ${loaiChiTiet}` : '';
  const gtNhan   = (row.gioi_tinh_nhan||'').toLowerCase() === 'nữ' ? 'bà' : 'ông';
  const quanHePart = row.quan_he ? `là ${row.quan_he} ${tenDT}` : `là người thực hiện mai táng ${tenDT}`;
  const xaUBND   = row.xa_dt || row.xa || 'xã ...';
  const soQD     = row.so_qd || '...../QĐ-SNV';
  let ngayQD     = 'ngày ... tháng ... năm 20....';
  if (row.ngay_qd) {
    const d = new Date(row.ngay_qd);
    ngayQD = `ngày ${d.getDate()} tháng ${d.getMonth()+1} năm ${d.getFullYear()}`;
  }

  // Căn cứ theo loại
  const isNCC = row.loai === 'NCC' || row.loai === '150';
  const canCuNCC = isNCC ? `
    ${paraItalic('Căn cứ Nghị định số 131/2021/NĐ-CP ngày 30/12/2021 của Chính phủ quy định chi tiết và biện pháp thi hành Pháp lệnh Ưu đãi người có công với cách mạng;')}
    ${paraItalic('Căn cứ Nghị định số 75/2021/NĐ-CP ngày 24/7/2021 của Chính phủ quy định mức hưởng trợ cấp, phụ cấp và các chế độ ưu đãi người có công với cách mạng;')}` : '';

  // ── Xây document.xml ──
  const bodyContent = `
  ${twoColTable(
    [
      para(boldRun('UBND TỈNH SƠN LA', 24), 'center'),
      para(boldUnderlineRun('SỞ NỘI VỤ', 24) , 'center'),
      para(normalRun('Số: '+soQD), 'center'),
    ],
    [
      para(boldRun('CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM', 24), 'center'),
      para(boldUnderlineRun('Độc lập - Tự do - Hạnh phúc', 24), 'center'),
      para(italicRun(`Sơn La, ${ngayQD}`), 'center'),
    ]
  )}
  ${spacePara()}
  ${para(boldRun('QUYẾT ĐỊNH', 28), 'center')}
  ${para(boldRun('Về việc trợ cấp khi người có công từ trần'), 'center')}
  ${spacePara()}
  ${para(boldRun('GIÁM ĐỐC SỞ NỘI VỤ'), 'center')}
  ${spacePara()}
  ${paraItalic('Căn cứ Luật Bảo hiểm xã hội số 41/2024/QH15 ngày 29/6/2024;')}
  ${paraItalic('Căn cứ Nghị định số 73/2024/NĐ-CP ngày 30/6/2024 của Chính phủ quy định mức lương cơ sở và chế độ tiền thưởng đối với cán bộ, công chức, viên chức và lực lượng vũ trang;')}
  ${canCuNCC}
  ${paraItalic('Căn cứ Quyết định số 60/2025/QĐ-UBND ngày 01/7/2025 của UBND tỉnh về việc quy định chức năng, nhiệm vụ, quyền hạn và cơ cấu tổ chức của Sở Nội vụ tỉnh Sơn La;')}
  ${paraItalic(`Theo đề nghị của Uỷ ban nhân dân ${xaUBND} và Trưởng phòng Người có công và lao động, việc làm.`)}
  ${spacePara()}
  ${para(boldRun('QUYẾT ĐỊNH:'), 'center')}
  ${spacePara()}
  <w:p><w:pPr><w:spacing w:after="80"/></w:pPr>${boldRun('Điều 1. ')}${normalRun('Trợ cấp mai táng phí đối với người thực hiện mai táng')}</w:p>
  ${spacePara()}
  <w:p><w:pPr><w:spacing w:after="80"/></w:pPr>${boldRun('1. Cá nhân')}</w:p>
  <w:p><w:pPr><w:spacing w:after="60"/></w:pPr>${boldRun('Họ và tên: ')}${normalRun(nguoiNhan)}</w:p>
  <w:p><w:pPr><w:spacing w:after="60"/></w:pPr>${boldRun('Ngày tháng năm sinh: ')}${normalRun('...')}</w:p>
  <w:p><w:pPr><w:spacing w:after="60"/></w:pPr>${boldRun('Giới tính: ')}${normalRun(row.gioi_tinh_nhan || '...')}</w:p>
  <w:p><w:pPr><w:spacing w:after="60"/></w:pPr>${boldRun('Quê quán: ')}${normalRun(ttNhan)}</w:p>
  <w:p><w:pPr><w:spacing w:after="60"/></w:pPr>${boldRun('Nơi thường trú: ')}${normalRun(ttNhan)}</w:p>
  <w:p><w:pPr><w:spacing w:after="80"/></w:pPr>${boldRun('Quan hệ với người có công với cách mạng từ trần: ')}${normalRun(`${quanHePart}${loaiChiTietPart} (đã từ trần ngày ...)`)}</w:p>
  ${spacePara()}
  <w:p><w:pPr><w:spacing w:after="60"/></w:pPr>${boldRun('2. ')}${boldRun('Mức trợ cấp: ')}${normalRun(muc + ' đồng.')}</w:p>
  <w:p><w:pPr><w:spacing w:after="80"/></w:pPr>${italicRun(`(Số tiền bằng chữ: ${soTienChu}).`)}</w:p>
  ${spacePara()}
  <w:p><w:pPr><w:spacing w:after="100"/></w:pPr>${boldRun('Điều 2. ')}${normalRun(`Chánh Văn phòng; Trưởng phòng Người có công và lao động, việc làm; Trưởng phòng Kế hoạch - Tài chính Sở Nội vụ; Chủ tịch UBND ${xaUBND} và ông (bà) có tên tại Điều 1 chịu trách nhiệm thi hành Quyết định này./. `)}</w:p>
  <w:p><w:pPr><w:spacing w:after="200"/></w:pPr></w:p>
  ${twoColTable(
    [
      `<w:p><w:pPr><w:spacing w:after="60"/></w:pPr>${italicRun('Nơi nhận:')}${boldRun('')}</w:p>`,
      `<w:p><w:pPr><w:spacing w:after="60"/></w:pPr>${italicRun('- Như Điều 2;')}</w:p>`,
      `<w:p><w:pPr><w:spacing w:after="60"/></w:pPr>${italicRun('- Lưu: VT, NCC&LĐVL.')}</w:p>`,
    ],
    [
      para(boldRun('KT. GIÁM ĐỐC'), 'center'),
      para(boldRun('PHÓ GIÁM ĐỐC'), 'center'),
      `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="200"/></w:pPr></w:p>`,
      `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="200"/></w:pPr></w:p>`,
      `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="200"/></w:pPr></w:p>`,
      para(boldRun('Phạm Quang Phương'), 'center'),
    ]
  )}
  <w:sectPr>
    <w:pgSz w:w="11906" w:h="16838"/>
    <w:pgMar w:top="1134" w:right="850" w:bottom="1134" w:left="1701"/>
  </w:sectPr>`;

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>${bodyContent}</w:body>
</w:document>`;

  fs.writeFileSync(tmpDir + '/[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
</Types>`);

  fs.writeFileSync(tmpDir + '/_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

  fs.writeFileSync(tmpDir + '/word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
</Relationships>`);

  fs.writeFileSync(tmpDir + '/word/settings.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat>
</w:settings>`);

  fs.writeFileSync(tmpDir + '/word/document.xml', documentXml, 'utf8');

  // Pack thành .docx (zip)
  execSync(`cd "${tmpDir}" && zip -r "${outDoc}" . -x "*.DS_Store"`, { stdio: 'pipe' });

  // Dọn temp dir
  try { fs.rmSync(tmpDir, { recursive: true }); } catch(e) {}

  return outDoc;
}

module.exports = { buildDocx };
