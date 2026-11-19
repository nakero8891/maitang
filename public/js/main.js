/* ═══════════════════════════════════════════════════════════
   main.js  —  Quản lý Mai Táng Phí  (v2 — bổ sung NCC + Dự thảo)
═══════════════════════════════════════════════════════════ */

const LOAI_MAP = {
    '150': '150/2006/NĐ-CP',
    '49':  '49/2015/QĐ-TTg',
    '62':  '62/2011/QĐ-TTg',
    '290': '290/2005/QĐ-TTg',
    'NCC': 'Người có công',
};
const BADGE_CLASS = {
    '150/2006/NĐ-CP':'badge-150', '49/2015/QĐ-TTg':'badge-49',
    '62/2011/QĐ-TTg':'badge-62',  '290/2005/QĐ-TTg':'badge-290',
    'Người có công':  'badge-NCC',
};

const FMT = n => Number(n).toLocaleString('vi-VN');

let allDonvi  = [];
let b1Table   = null;
let importRows = [];


/* ── Tab switching ── */
function switchTab(id) {
    document.querySelectorAll('.mtp-pane').forEach(el => {
        el.style.display = 'none'; el.classList.remove('mtp-active');
    });
    document.querySelectorAll('#mtpTabs .nav-link').forEach(el => el.classList.remove('active'));
    const pane = document.getElementById(id);
    if (pane) { pane.style.display = 'block'; pane.classList.add('mtp-active'); }
    const link = document.querySelector(`#mtpTabs a[onclick*="${id}"]`);
    if (link) link.classList.add('active');

    // Thanh điều khiển chung
    const toolbar = document.getElementById('report-toolbar');
    const isReport = ['tab-b3','tab-b4','tab-b5'].includes(id);
    toolbar.style.display = isReport ? 'block' : 'none';
    ['b3','b4','b5'].forEach(b => {
        document.getElementById(`rpt-btn-${b}`).style.display = id === `tab-${b}` ? 'block' : 'none';
    });
    document.getElementById('b5-xa-wrap').style.display = id === 'tab-b5' ? 'block' : 'none';

    if (id === 'tab-b5') onRptDotChange();
}

/* ════════════════════════════════════════════════════════
   KHỞI TẠO
════════════════════════════════════════════════════════ */
$(function() {
    loadDonvi();
    loadSettings();

    // Datepicker dùng chung
    $('#rpt-ngaytb').datepicker({ format: 'dd/mm/yyyy', autoclose: true, todayHighlight: true });
    // Datepicker cho form hồ sơ
    $('.date-pick').datepicker({ format: 'dd/mm/yyyy', autoclose: true, todayHighlight: true });

    /* DataTable Bảng 1 */
    b1Table = $('#tbl-b1').DataTable({
        processing: true,
        serverSide: true,
        ajax: {
            url: '/api/hoso',
            type: 'GET',
            data: d => {
                d.dot   = $('#b1-filter-dot').val();
                d.loai  = $('#b1-filter-loai').val();
                d.xa_id = $('#b1-filter-xa').val();
                d.search= d.search?.value || '';
                d.start = d.start;
                d.length= d.length;
                d.draw  = d.draw;
            },
            dataSrc: json => json.data,
        },
        columnDefs: [
            { targets: [0,9], orderable: false },
            { targets: [3],   className: 'text-right' },
            { targets: [7,8], className: 'text-muted small' },
            { targets: [9],   width: '110px' },
        ],
        columns: [
            { data: 0 }, // STT
            { data: 1 }, // Số QĐ
            { data: 2, render: d => `<span class="badge badge-loai ${BADGE_CLASS[d]||''}">${d}</span>` },
            { data: 3 }, // Mức
            { data: 4 }, // Xã
            { data: 5 }, // Đợt
            { data: 6 }, // Ghi chú
            { data: 7 }, // Đối tượng
            { data: 8 }, // Người nhận
            { data: 9, className: 'no-print text-center', render: d => {
                return `<button class="btn btn-xs mtp-draft" data-id="${d.id}" title="In dự thảo" style="background:#6f42c1;color:#fff;border:none;border-radius:3px;padding:1px 5px;font-size:11px;cursor:pointer">📄 DT</button>
                <button class="btn btn-warning btn-xs mtp-edit"
                    data-id="${d.id}" data-soqd="${escHtml(d.soqd)}" data-loai="${d.loai}"
                    data-muc="${d.muc}" data-xa="${d.xa_id}" data-dot="${d.dot}"
                    data-ghichu="${escHtml(d.ghichu)}"
                    data-doituong="${escHtml(d.doituong)}" data-namsinh="${d.namsinh}"
                    data-ngaytutran="${d.ngaytutran}" data-chitietloai="${escHtml(d.chitietloai)}"
                    data-ban_doituong="${escHtml(d.ban_doituong)}"
                    data-nguoinhan="${escHtml(d.nguoinhan)}" data-quanhe="${escHtml(d.quanhe)}"
                    data-ngaysinh_nhan="${d.ngaysinh_nhan}" data-gioitinh="${d.gioitinh}"
                    data-quequan_nhan="${escHtml(d.quequan_nhan)}"
                    data-thuongtru_nhan="${escHtml(d.thuongtru_nhan)}"
                    data-so_ngay_trinh="${escHtml(d.so_ngay_trinh)}"
                    title="Sửa">✎</button>
                <button class="btn btn-danger btn-xs mtp-delete" data-id="${d.id}" title="Xóa">✕</button>`;
            }},
        ],
        lengthMenu: [[10,25,50,-1],['10 hàng','25 hàng','50 hàng','Tất cả']],
        language: { search:'Tìm kiếm:', lengthMenu:'Hiện _MENU_', info:'_START_–_END_ / _TOTAL_ hồ sơ', paginate:{previous:'‹',next:'›'} },
        dom: 'Blfrtip',
        buttons: [
            { extend:'excel', text:'<i class="fa fa-file-excel-o"></i> Excel', exportOptions:{columns:[0,1,2,3,4,5,6,7,8]} },
            { extend:'print', text:'<i class="fa fa-print"></i> In', exportOptions:{columns:':not(.no-print)'} },
            'pageLength'
        ],
    });

    /* Xã selector B5 */
    $('#b5-xa').on('change', function() { if ($(this).val()) loadB5(); });

    $('#tbl-b1').on('click', '.mtp-edit', function() {
        const d = $(this).data();
        $('#b1-edit-id').val(d.id);
        $('#b1-soqd').val(d.soqd);
        $('#b1-loai').val(d.loai);
        $('#b1-muc').val(d.muc);
        $('#b1-xa').val(d.xa).trigger('change');
        $('#b1-dot').val(d.dot);
        $('#b1-ghichu').val(d.ghichu);
        // NCC
        $('#b1-doituong').val(d.doituong);
        $('#b1-namsinh').val(isoToDisplay(d.namsinh));
        $('#b1-ngaytutran').val(isoToDisplay(d.ngaytutran));
        $('#b1-chitietloai').val(d.chitietloai);
        $('#b1-ban_doituong').val(d.ban_doituong);
        $('#b1-nguoinhan').val(d.nguoinhan);
        $('#b1-quanhe').val(d.quanhe);
        $('#b1-ngaysinh_nhan').val(isoToDisplay(d.ngaysinh_nhan));
        $('#b1-gioitinh').val(d.gioitinh || 'Nam');
        $('#b1-quequan_nhan').val(d.quequan_nhan);
        $('#b1-thuongtru_nhan').val(d.thuongtru_nhan);
        $('#b1-so_ngay_trinh').val(d.so_ngay_trinh);

        $('#btn-save-hoso').html('<i class="fa fa-save"></i> Cập nhật').removeClass('btn-primary').addClass('btn-warning');
        $('html,body').animate({scrollTop:0},400);
    });

    /* Xóa hồ sơ */
    $('#tbl-b1').on('click', '.mtp-delete', async function() {
        const id = $(this).data('id');
        if (!confirm('Xóa hồ sơ này?')) return;
        const res = await API.deleteHoso(id);
        if (res.status === 'ok') b1Table.ajax.reload(null, false);
        else alert(res.msg);
    });

    /* Dự thảo */
    $('#tbl-b1').on('click', '.mtp-draft', function() {
        const id = $(this).data('id');
        downloadDraft(id);
    });
}); // end $(function)

function escHtml(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
}

/* ISO date (2026-01-15) → dd/mm/yyyy */
function isoToDisplay(v) {
    if (!v) return '';
    const s = String(v).slice(0,10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
    const [y,m,d] = s.split('-');
    return `${d}/${m}/${y}`;
}

/* dd/mm/yyyy → ISO yyyy-mm-dd */
function displayToIso(v) {
    if (!v) return '';
    const parts = String(v).split('/');
    if (parts.length !== 3) return '';
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

/* ════════════════════════════════════════════════════════
   ĐƠN VỊ
════════════════════════════════════════════════════════ */
function loadDonvi() {
    API.listDonvi().then(data => {
        if (!Array.isArray(data)) return;
        allDonvi = data;
        renderB2();
        rebuildXaSelects();
        onRptDotChange(); // tải danh sách xã cho B5 theo đợt hiện tại
    });
}

function renderB2() {
    const tbody = $('#tbody-b2');
    if (!allDonvi.length) {
        tbody.html('<tr><td colspan="9" class="text-center text-muted">Chưa có đơn vị nào</td></tr>');
        return;
    }
    tbody.html(allDonvi.map((u,i)=>`<tr>
        <td>${i+1}</td><td>${u.xa||''}</td><td>${u.donvi||''}</td>
        <td>${u.sotk||'—'}</td><td>${u.khobac||'—'}</td>
        <td>${u.mst||'—'}</td><td>${u.canbo||'—'}</td><td>${u.sdt||'—'}</td>
        <td class="no-print text-center" style="white-space:nowrap">
            <button class="btn btn-warning btn-xs mr-1" onclick="editDonvi(${u.id})">✎ Sửa</button>
            <button class="btn btn-danger btn-xs" onclick="deleteDonvi(${u.id},'${u.xa.replace(/'/g,"\\'")}')">✕ Xóa</button>
        </td></tr>`).join(''));
}

function rebuildXaSelects() {
    const opts = '<option value="">-- Chọn xã --</option>' +
        allDonvi.map(u=>`<option value="${u.id}">${u.xa}</option>`).join('');
    $('#b1-xa').html(opts);
    if ($('#b1-xa').data('select2')) $('#b1-xa').select2('destroy');
    $('#b1-xa').select2({ placeholder:'-- Tìm hoặc chọn xã --', allowClear:true, language:{noResults:()=>'Không tìm thấy xã'} });
    $('#b1-filter-xa').html('<option value="">Tất cả xã</option>' +
        allDonvi.map(u=>`<option value="${u.id}">${u.xa}</option>`).join(''));
}

function editDonvi(id) {
    const u = allDonvi.find(x => x.id == id);
    if (!u) return;
    $('#b2-edit-id').val(u.id);
    $('#b2-xa').val(u.xa); $('#b2-donvi').val(u.donvi);
    $('#b2-sotk').val(u.sotk||''); $('#b2-khobac').val(u.khobac||'');
    $('#b2-mst').val(u.mst||'');   $('#b2-canbo').val(u.canbo||''); $('#b2-sdt').val(u.sdt||'');
    $('#b2-card-header').css({'background':'#856404','color':'#fff'});
    $('#b2-header-icon').attr('class','fa fa-edit');
    $('#b2-header-text').text('Sửa đơn vị — ' + u.xa);
    $('#btn-save-donvi').html('<i class="fa fa-save"></i> Lưu').removeClass('btn-success').addClass('btn-warning');
    $('#btn-cancel-donvi').show();
    $('html,body').animate({scrollTop:0},300);
}

function cancelEditDonvi() {
    $('#b2-edit-id').val('');
    $('#b2-xa,#b2-donvi,#b2-sotk,#b2-khobac,#b2-mst,#b2-canbo,#b2-sdt').val('');
    $('#b2-card-header').css({'background':'#28a745','color':'#fff'});
    $('#b2-header-icon').attr('class','fa fa-plus');
    $('#b2-header-text').text('Thêm đơn vị xã');
    $('#btn-save-donvi').html('<i class="fa fa-plus"></i> Thêm').removeClass('btn-warning').addClass('btn-success');
    $('#btn-cancel-donvi').hide();
}

async function saveDonvi() {
    const id   = $('#b2-edit-id').val();
    const data = {
        xa: $('#b2-xa').val().trim(), donvi: $('#b2-donvi').val().trim(),
        sotk: $('#b2-sotk').val().trim(), khobac: $('#b2-khobac').val().trim(),
        mst:  $('#b2-mst').val().trim(),  canbo:  $('#b2-canbo').val().trim(),
        sdt:  $('#b2-sdt').val().trim(),
    };
    if (!data.xa || !data.donvi) { alert('Vui lòng nhập tên xã và tên đơn vị'); return; }
    const res = id ? await API.updateDonvi(id, data) : await API.addDonvi(data);
    if (res.status === 'ok') { cancelEditDonvi(); loadDonvi(); }
    else alert(res.msg);
}

async function deleteDonvi(id, xa) {
    if (!confirm(`Xóa đơn vị "${xa}"?`)) return;
    const res = await API.deleteDonvi(id);
    if (res.status === 'ok') loadDonvi();
    else alert(res.msg);
}

/* Import đơn vị từ Excel */
async function importDonvi() {
    const file = document.getElementById('import-donvi-file').files[0];
    if (!file) { alert('Chưa chọn file'); return; }
    const data = await file.arrayBuffer();
    const wb   = XLSX.read(data, { type:'array' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header:1, defval:'' });
    const items = rows.slice(1).filter(r => r[0] || r[1]).map(r => ({
        xa: String(r[0]||'').trim(), donvi: String(r[1]||'').trim(),
        sotk: String(r[2]||'').trim(), khobac: String(r[3]||'').trim(),
        mst:  String(r[4]||'').trim(), canbo:  String(r[5]||'').trim(),
        sdt:  String(r[6]||'').trim(),
    })).filter(r => r.xa && r.donvi);
    if (!items.length) { alert('Không đọc được dữ liệu từ file'); return; }
    if (!confirm(`Nhập ${items.length} đơn vị?`)) return;
    const res = await API.importDonvi(items);
    if (res.status === 'ok') {
        alert(`Đã nhập ${res.inserted} đơn vị.${res.errors?.length ? '\nLỗi: ' + res.errors.join('\n') : ''}`);
        loadDonvi();
    } else alert(res.msg);
}

/* Xuất Excel đơn vị */
function exportDonviExcel() {
    const rows = allDonvi.map((u,i) => ({
        'STT':i+1,'Tên xã':u.xa,'Tên đơn vị':u.donvi,
        'Số TK kho bạc':u.sotk||'','Kho bạc':u.khobac||'',
        'Mã số thuế':u.mst||'','Cán bộ phụ trách':u.canbo||'','Số ĐT':u.sdt||'',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Đơn vị');
    XLSX.writeFile(wb, 'DanhSachDonVi.xlsx');
}

/* ════════════════════════════════════════════════════════
   HỒ SƠ
════════════════════════════════════════════════════════ */
async function saveHoso() {
    const id   = $('#b1-edit-id').val();
    const loai = $('#b1-loai').val();
    const data = {
        soqd:           $('#b1-soqd').val().trim(),
        loai,
        muc:            $('#b1-muc').val(),
        xa_id:          $('#b1-xa').val(),
        dot:            $('#b1-dot').val(),
        ghichu:         $('#b1-ghichu').val().trim(),
        doituong:       $('#b1-doituong').val().trim(),
        namsinh:        displayToIso($('#b1-namsinh').val()),
        ngaytutran:     displayToIso($('#b1-ngaytutran').val()),
        chitietloai:    $('#b1-chitietloai').val().trim(),
        ban_doituong:   $('#b1-ban_doituong').val().trim(),
        nguoinhan:      $('#b1-nguoinhan').val().trim(),
        quanhe:         $('#b1-quanhe').val().trim(),
        ngaysinh_nhan:  displayToIso($('#b1-ngaysinh_nhan').val()),
        gioitinh:       $('#b1-gioitinh').val(),
        quequan_nhan:   $('#b1-quequan_nhan').val().trim(),
        thuongtru_nhan: $('#b1-thuongtru_nhan').val().trim(),
        so_ngay_trinh:  $('#b1-so_ngay_trinh').val().trim(),
    };
    if (!loai || !data.muc || !data.xa_id) {
        alert('Vui lòng chọn loại đối tượng, mức hỗ trợ và xã'); return;
    }
    if (!data.doituong)    { alert('Vui lòng nhập họ tên đối tượng'); return; }
    if (!data.ngaytutran)  { alert('Vui lòng nhập ngày từ trần'); return; }
    if (!data.nguoinhan)   { alert('Vui lòng nhập người thực hiện mai táng'); return; }
    if (!data.so_ngay_trinh) { alert('Vui lòng nhập số/ngày công văn trình'); return; }

    const res = id ? await API.updateHoso(id, data) : await API.addHoso(data);
    if (res.status === 'ok') { cancelEditHoso(); b1Table.ajax.reload(null, false); }
    else alert(res.msg);
}

function cancelEditHoso() {
    $('#b1-edit-id').val('');
    $('#b1-soqd, #b1-ghichu, #b1-chitietloai, #b1-ban_doituong').val('');
    $('#b1-doituong, #b1-namsinh, #b1-ngaytutran').val('');
    $('#b1-nguoinhan, #b1-quanhe, #b1-ngaysinh_nhan').val('');
    $('#b1-quequan_nhan, #b1-thuongtru_nhan, #b1-so_ngay_trinh').val('');
    $('#b1-loai, #b1-muc').val('');
    $('#b1-xa').val('').trigger('change');
    $('#b1-dot').val(1);
    $('#b1-gioitinh').val('Nam');
    $('#btn-save-hoso').html('<i class="fa fa-save"></i> Lưu').removeClass('btn-warning').addClass('btn-primary');
}

/* ── Dự thảo ── */
function downloadDraft(id) {
    window.location.href = `/api/draft/${id}`;
}

/* ════════════════════════════════════════════════════════
   IMPORT HỒ SƠ TỪ EXCEL — 1 mẫu thống nhất cho tất cả loại
════════════════════════════════════════════════════════ */
// Thứ tự cột trong file Excel mẫu
// Thứ tự cột file Excel import (16 cột, không có namsinh và ban_doituong)
const IMPORT_COLS = [
    'soqd',           // A — Số QĐ (để trống nếu chưa có)
    'loai',           // B — Loại: 150 / 49 / 62 / 290 / NCC
    'dot',            // C — Đợt
    'xa',             // D — Tên xã (khớp với Bảng 2)
    'so_ngay_trinh',  // E — Số/ngày công văn trình
    'nguoinhan',      // F — Người thực hiện mai táng
    'ngaysinh_nhan',  // G — Ngày sinh người nhận (dd/mm/yyyy)
    'gioitinh',       // H — Giới tính người nhận
    'quequan_nhan',   // I — Quê quán người nhận
    'thuongtru_nhan', // J — Nơi thường trú người nhận
    'quanhe',         // K — Quan hệ với đối tượng
    'doituong',       // L — Họ tên đối tượng từ trần
    'ngaytutran',     // M — Ngày từ trần (dd/mm/yyyy)
    'muc',            // N — Mức hỗ trợ (số, VD: 23400000)
    'chitietloai',    // O — Huân huy chương / Chi tiết loại (NCC)
    'ghichu',         // P — Ghi chú
];
const IMPORT_LABELS = [
    'Số QĐ','Loại','Đợt','Tên xã','Số/ngày CV trình',
    'Người mai táng','Ngày sinh NR','Giới tính',
    'Quê quán NR','Thường trú NR','Quan hệ',
    'Đối tượng','Ngày từ trần','Mức hỗ trợ',
    'Huân huy chương/Chi tiết','Ghi chú',
];
// Cột số (raw): dot=C(idx2), muc=N(idx13)
const IMPORT_NUM_IDX  = { dot: 2, muc: 13 };
// Cột ngày (cellDates): ngaysinh_nhan=G(idx6), ngaytutran=M(idx12)
const IMPORT_DATE_KEYS = ['ngaysinh_nhan', 'ngaytutran'];

async function readImportFile() {
    const file = document.getElementById('import-file').files[0];
    if (!file) { alert('Chưa chọn file'); return; }
    const data = await file.arrayBuffer();

    // Đọc 2 lần từ cùng 1 buffer:
    // wb1: cellDates=true  → ngày tháng ra Date object
    // wb2: cellDates=false → mọi thứ là số/chuỗi thô (không bị parse thành Date)
    const wb1  = XLSX.read(data, { type: 'array', cellDates: true  });
    const wb2  = XLSX.read(data, { type: 'array', cellDates: false });
    const rows1 = XLSX.utils.sheet_to_json(wb1.Sheets[wb1.SheetNames[0]], { header: 1, defval: '' });
    const rows2 = XLSX.utils.sheet_to_json(wb2.Sheets[wb2.SheetNames[0]], { header: 1, defval: '', raw: true });
    if (!rows1.length) { alert('File trống'); return; }

    const data1 = rows1.slice(1).filter(r => r.some(c => c !== ''));
    const data2 = rows2.slice(1).filter(r => r.some(c => c !== ''));

    importRows = data1.map((r1, ri) => {
        const r2 = data2[ri] || [];
        const o  = {};
        IMPORT_COLS.forEach((k, i) => {
            if (IMPORT_DATE_KEYS.includes(k)) {
                // Lấy từ wb1 (cellDates=true) → Date object
                const v = r1[i];
                if (v instanceof Date) {
                    const dd = String(v.getDate()).padStart(2, '0');
                    const mm = String(v.getMonth() + 1).padStart(2, '0');
                    o[k] = `${dd}/${mm}/${v.getFullYear()}`;
                } else {
                    o[k] = String(v || '').trim();
                }
            } else if (i === IMPORT_NUM_IDX.dot || i === IMPORT_NUM_IDX.muc) {
                // Lấy từ wb2 (raw) → số nguyên thực, tránh bị parse thành Date
                const v = r2[i];
                const cleaned = String(v ?? '').trim().replace(/[^0-9]/g, '');
                o[k] = cleaned || '';
            } else {
                o[k] = String(r1[i] ?? '').trim();
            }
        });
        return o;
    });

    renderImportPreview();
}

function renderImportPreview() {
    document.getElementById('import-preview-head').innerHTML =
        '<th>#</th>' + IMPORT_LABELS.map(c => `<th>${c}</th>`).join('') + '<th>Trạng thái</th>';

    const tbody = document.getElementById('import-preview-body');
    tbody.innerHTML = importRows.map((r, i) => {
        const ok    = !!r.xa && !!r.loai && !!r.muc;
        const cells = IMPORT_COLS.map(k => `<td>${escHtml(r[k] || '')}</td>`).join('');
        const badge = ok
            ? '<span class="badge badge-success">OK</span>'
            : '<span class="badge badge-danger">Thiếu dữ liệu</span>';
        return `<tr class="${ok ? '' : 'table-danger'}"><td>${i + 1}</td>${cells}<td>${badge}</td></tr>`;
    }).join('');

    const okCount = importRows.filter(r => !!r.xa && !!r.loai && !!r.muc).length;
    document.getElementById('import-summary').textContent =
        `${importRows.length} dòng đọc được — ${okCount} hợp lệ`;
    document.getElementById('import-preview-wrap').style.display = 'block';
}

async function confirmImport() {
    const defaultDot = $('#import-dot-default').val() || '1';
    // Áp fallback dot cho dòng nào bị trống
    const rows = importRows.map(r => ({
        ...r,
        dot: r.dot && r.dot !== '' ? r.dot : defaultDot,
    }));
    const res = await API.importHoso({ rows });
    if (res.status === 'ok') {
        alert(`Đã nhập ${res.inserted} hồ sơ.` + (res.errors?.length ? `\n\nLỗi:\n${res.errors.join('\n')}` : ''));
        b1Table.ajax.reload(null, false);
        document.getElementById('import-preview-wrap').style.display = 'none';
        importRows = [];
    } else alert(res.msg);
}

function downloadTemplate() {
    if (typeof XLSX === 'undefined') { alert('Thư viện XLSX chưa tải xong, thử lại sau.'); return; }
    const ws = XLSX.utils.aoa_to_sheet([
        IMPORT_LABELS,
        [
            '',                                             // A — Số QĐ (để trống nếu chưa có)
            'NCC',                                          // B — Loại
            '1',                                            // C — Đợt
            'Chiềng An',                                    // D — Tên xã/phường
            'CV số 335/UBND-VHXH ngày 15/4/2026',          // E — Số/ngày CV trình
            'Vì Văn Khánh',                                 // F — Người mai táng
            '15/09/1971',                                   // G — Ngày sinh NR
            'Nam',                                          // H — Giới tính
            'Xã Chiềng An, tỉnh Sơn La',                   // I — Quê quán NR
            'Bản X, xã Chiềng An, tỉnh Sơn La',            // J — Thường trú NR
            'Là con trai',                                  // K — Quan hệ
            'Vì Thị Sót',                                   // L — Họ tên đối tượng
            '12/11/2025',                                   // M — Ngày từ trần
            '23400000',                                     // N — Mức hỗ trợ
            'Huân chương KC hạng Ba',                       // O — Huân huy chương/Chi tiết (NCC)
            '',                                             // P — Ghi chú
        ],
    ]);
    ws['!cols'] = IMPORT_LABELS.map((_, i) => ({ wch: i < 4 ? 14 : 28 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mẫu nhập hồ sơ');
    XLSX.writeFile(wb, 'mau_import_hoso.xlsx');
}

/* ════════════════════════════════════════════════════════
   BẢNG 3
════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════
   HELPERS CHUNG CHO B3/B4/B5
════════════════════════════════════════════════════════ */
function getRptDot()   { return $('#rpt-dot').val() || '1'; }
function getRptSotb()  { return $('#rpt-sotb').val().trim() || '______'; }
function getRptNgay()  { return $('#rpt-ngaytb').val().trim(); }
function getRptParts() { return getRptNgay().split('/'); }   // [dd, mm, yyyy]

function kttLine(dot) {
    const sotb = getRptSotb();
    const p    = getRptParts();
    return `(Kèm theo Thông báo số: ${sotb}/TB-SNV ngày ${p[0]||'___'} tháng ${p[1]||'___'} năm 2026 của Sở Nội vụ)`;
}

// Thay đổi đợt → tải lại danh sách xã cho B5
function onRptDotChange() {
    const dot = getRptDot();
    API.listXaByDot(dot).then(xaList => {
        if (!Array.isArray(xaList)) return;
        $('#b5-xa').html('<option value="">-- Chọn xã --</option>' +
            xaList.map(x => `<option value="${x.id}">${x.xa}</option>`).join(''));
    });
}

// ── Lấy thông tin ký tên từ settings đã load ──
let _settings = { nguoilap: '', ke_toan: '', thu_truong: '' };

async function loadSettings() {
    const res = await API.getSettings();
    if (res.status === 'ok') {
        _settings = res.data;
        $('#cfg-nguoilap').val(_settings.nguoilap || '');
        $('#cfg-ke_toan').val(_settings.ke_toan   || '');
        $('#cfg-thu_truong').val(_settings.thu_truong || '');
    }
}

async function saveSettings() {
    const data = {
        nguoilap:   $('#cfg-nguoilap').val().trim(),
        ke_toan:    $('#cfg-ke_toan').val().trim(),
        thu_truong: $('#cfg-thu_truong').val().trim(),
    };
    const res = await API.saveSettings(data);
    if (res.status === 'ok') {
        _settings = data;
        $('#modal-settings').modal('hide');
        alert('Đã lưu cài đặt');
    } else alert(res.msg);
}

function signBlock() {
    const nl = _settings.nguoilap   || '...........................';
    const kt = _settings.ke_toan    || '...........................';
    const tt = _settings.thu_truong || '...........................';
    return { nl, kt, tt };
}

/* ════════════════════════════════════════════════════════
   BẢNG 3
════════════════════════════════════════════════════════ */
async function loadB3() {
    const dot = getRptDot();               // lấy đợt từ thanh công cụ
    const res = await API.thongBao(dot);   // { data, total }
    if (res.status === 'error') { alert(res.msg); return; }
    const { data, total } = res;
    $('#b3-print-title').text(`Đợt ${dot} — Năm 2026`);
    $('#b3-ktt').text(kttLine(dot));

    if (!data || !data.length) {
        $('#tbody-b3').html('<tr><td colspan="5" class="text-center text-muted">Không có dữ liệu</td></tr>');
        $('#tfoot-b3').html('');
        return;
    }

    let grandTotal = 0;
    let allQD = [];

    const tbodyHtml = data.map((r, i) => {
        grandTotal += r.total || 0;
        const soqds = r.soqds || '';
        const qdList = soqds.split('; ').filter(q => q.trim());
        allQD.push(...qdList);
        return `
            <tr>
                <td class="text-center">${i+1}</td>
                <td>${r.donvi || ''}</td>
                <td class="text-right">${FMT(r.total)}</td>
                <td class="soqd-wrap">${qdList.join(';<br>')}</td>
                <td>${r.sotk || ''}</td>
            </tr>
        `;
    }).join('');

    $('#tbody-b3').html(tbodyHtml);

    const uniqueQD = new Set(allQD).size;
    const finalTotal = (total !== undefined && total !== null) ? total : grandTotal;

    $('#tfoot-b3').html(`
        <tr class="tr-total">
            <td colspan="2" class="text-right font-weight-bold bg-total">TỔNG CỘNG</td>
            <td class="text-right font-weight-bold bg-total">${FMT(finalTotal)}</td>
            <td class="text-center font-weight-bold bg-total">${uniqueQD} Quyết định</td>
            <td class="bg-total"></td>
        </tr>
    `);
}

/* ════════════════════════════════════════════════════════
   BẢNG 4
════════════════════════════════════════════════════════ */
async function loadB4() {
    const dot = getRptDot();
    const res = await API.chiTiet(dot);
    if (res.status === 'error') { alert(res.msg); return; }
    const { data } = res;
    $('#b4-print-title').text(`Đợt ${dot} — Năm 2026`);
    $('#b4-ktt').text(kttLine(dot));
    if (!data.length) {
        $('#tbody-b4').html('<tr><td colspan="6" class="text-center text-muted">Không có dữ liệu</td></tr>'); return;
    }
    const thead = $('#b4-thead'), tbody = $('#tbody-b4'), tfoot = $('#tfoot-b4');
    const loais = [...new Set(data.flatMap(r => Object.keys(r.cells)))];
    // Gom tất cả mucs thực tế có trong data (tránh phụ thuộc MUC_LIST server)
    const mucsFromData = [...new Set(
        data.flatMap(r => loais.flatMap(l => Object.keys(r.cells[l] || {})))
    )].map(Number).sort((a, b) => a - b);
    // Merge với mucs từ server, ưu tiên thứ tự từ server nếu có
    const serverMucs = (res.mucs || []).map(Number);
    const mucs = serverMucs.length
        ? [...new Set([...serverMucs, ...mucsFromData])].sort((a, b) => a - b)
        : mucsFromData;
    const activeLoais = [], activeMucs = {};
    loais.forEach(l => {
        let has = false; mucs.forEach(m => { if (data.some(r => r.cells[l]?.[m] > 0)) has = true; });
        if (has) { activeLoais.push(l); activeMucs[l] = mucs.filter(m => data.some(r => r.cells[l]?.[m] > 0)); }
    });
    let h1 = `<tr><th rowspan="2" style="width:35px;text-align:center">STT</th><th rowspan="2" style="min-width:180px">Tên đơn vị</th>`;
    activeLoais.forEach(l => h1 += `<th colspan="${activeMucs[l].length + 1}" class="th-group">${l}</th>`);
    h1 += `<th rowspan="2" class="total-col">Tổng cộng</th><th rowspan="2" style="min-width:200px">Số QĐ</th></tr><tr>`;
    activeLoais.forEach(l => { activeMucs[l].forEach(m => h1 += `<th class="th-sub muc-col">${(m/1000000).toFixed(m%1000000===0?0:1)}tr</th>`); h1 += `<th class="th-sub total-col">Cộng</th>`; });
    thead.html(h1 + '</tr>');
    const totals = {}; activeLoais.forEach(l => { totals[l] = {}; activeMucs[l].forEach(m => totals[l][m] = 0); });
    let grandTotal = 0;
    tbody.html(data.map((row, i) => {
        let cells = '', rowTotal = 0;
        activeLoais.forEach(l => {
            let cong = 0;
            activeMucs[l].forEach(m => { const sl = row.cells[l]?.[m] || 0; cong += sl * m; totals[l][m] = (totals[l][m] || 0) + sl; cells += `<td class="muc-col">${sl || ''}</td>`; });
            rowTotal += cong; grandTotal += cong;
            cells += `<td class="total-col font-weight-bold">${cong ? FMT(cong) : ''}</td>`;
        });
        return `<tr><td class="td-num">${i+1}</td><td style="white-space:normal">${row.donvi||''}</td>${cells}<td class="total-col font-weight-bold">${FMT(rowTotal)}</td><td class="soqd-wrap">${row.soqds.split('; ').join(';<br>')}</td></tr>`;
    }).join(''));
    let footCells = '';
    activeLoais.forEach(l => { let cong = 0; activeMucs[l].forEach(m => { const sl = totals[l][m] || 0; cong += sl * m; footCells += `<td class="muc-col font-weight-bold">${sl || ''}</td>`; }); footCells += `<td class="total-col font-weight-bold">${FMT(cong)}</td>`; });
    tfoot.html(`<tr class="tr-total"><td colspan="2" class="text-right font-weight-bold">TỔNG CỘNG</td>${footCells}<td class="total-col font-weight-bold">${FMT(grandTotal)}</td><td></td></tr>`);
}

/* ════════════════════════════════════════════════════════
   BẢNG 5
════════════════════════════════════════════════════════ */
async function loadB5() {
    const dot   = getRptDot();
    const xa_id = $('#b5-xa').val();
    if (!xa_id) { alert('Vui lòng chọn xã'); return; }
    const res = await API.chiTietXa(dot, xa_id);
    if (res.status === 'error') { alert(res.msg); return; }
    const { loais, cells, total, soqds, xa, donvi, dot: dotVal } = res;
    const mucs = (res.mucs || []).map(Number);
    const b5XaLoai = getXaLoai(xa).toUpperCase();
    $('#b5-title').text(`DANH SÁCH CHI TRẢ MAI TÁNG PHÍ NĂM 2026 ĐỢT ${dotVal} – ${b5XaLoai} ${xa.toUpperCase()}`);
    $('#b5-kemtheo').text(kttLine(dot));
    const activeLoais = [], activeMucs = {};
    loais.forEach(l => { let has = false; mucs.forEach(m => { if (cells[l]?.[m] > 0) has = true; }); if (has) { activeLoais.push(l); activeMucs[l] = mucs.filter(m => cells[l]?.[m] > 0); } });
    let h1 = `<tr><th rowspan="2" style="width:35px;text-align:center">STT</th><th rowspan="2" style="min-width:170px">Tên đơn vị</th>`;
    activeLoais.forEach(l => h1 += `<th colspan="${activeMucs[l].length + 1}" class="th-group">${l}</th>`);
    h1 += `<th rowspan="2" style="min-width:90px;text-align:right">Tổng cộng</th><th rowspan="2" style="min-width:170px">Số QĐ</th></tr><tr>`;
    activeLoais.forEach(l => { activeMucs[l].forEach(m => h1 += `<th class="th-sub muc-col">${(m/1000000).toFixed(m%1000000===0?0:1)}tr</th>`); h1 += `<th class="th-sub total-col">Cộng</th>`; });
    $('#b5-thead').html(h1 + '</tr>');
    let rowTotal = 0, cellsHtml = '';
    activeLoais.forEach(l => { let cong = 0; activeMucs[l].forEach(m => { const sl = cells[l]?.[m] || 0; cong += sl * m; cellsHtml += `<td class="muc-col" style="text-align:center">${sl || ''}</td>`; }); rowTotal += cong; cellsHtml += `<td class="total-col font-weight-bold">${cong ? FMT(cong) : ''}</td>`; });
    $('#tbody-b5').html(`<tr><td style="text-align:center">1</td><td style="white-space:normal">${donvi}</td>${cellsHtml}<td style="text-align:right;font-weight:bold">${FMT(rowTotal)}</td><td style="white-space:normal;line-height:1.5">${soqds.split('; ').join(';<br>')}</td></tr>`);
    $('#tfoot-b5').html('');
    $('#b5-words').html(`Số tiền bằng chữ: <u>${numberToWords(rowTotal)}</u>`);
    const p = getRptParts();
    $('#b5-ngay-display').text(p[0] || '___');
    $('#b5-thang-display').text(p[1] || '___');
    $('#b5-nam-display').text('2026');
    const s = signBlock();
    $('#b5-nguoilap-sign').text(s.nl);
    $('#b5-ke_toan-sign').text(s.kt);
    $('#b5-thu_truong-sign').text(s.tt);
}

/* ── CSS chung dùng trong cửa sổ in ── */
const PRINT_CSS = `
body{font-family:'Times New Roman',serif;font-size:13px;margin:0;padding:16px}
table{width:100%;border-collapse:collapse;font-size:12px}
th,td{border:1px solid #000;padding:4px 7px}
thead th{
  font-weight:bold;text-align:center;
  background:#e0e0e0;color:#000;
  -webkit-print-color-adjust:exact;print-color-adjust:exact
}
tfoot td{font-weight:700}
.th-group{
  font-weight:bold;text-align:center;
  background:#cfe2f3;
  -webkit-print-color-adjust:exact;print-color-adjust:exact
}
.th-sub{
  text-align:center;font-size:11px;
  background:#efefef;
  -webkit-print-color-adjust:exact;print-color-adjust:exact
}
.muc-col{text-align:center;white-space:nowrap}
.total-col{text-align:right;white-space:nowrap}
.tr-total td{font-weight:700;border-top:2px solid #000}
.soqd-wrap{white-space:normal;word-break:break-word;max-width:200px}
.text-right{text-align:right}.text-center{text-align:center}
.font-weight-bold{font-weight:bold}
.page-break{page-break-after:always}
.sign-row td{border:none !important;text-align:center;width:33%}
.no-print{display:none !important}
@media print{@page{size:A4;margin:20mm}body{padding:0}}`;

// iframe dùng chung — srcdoc không tạo URL → không hiện URL/ngày khi in
let _printIframe = null;
function getPrintIframe() {
    if (!_printIframe) {
        _printIframe = document.createElement('iframe');
        _printIframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1400px;height:900px;border:none;visibility:hidden';
        document.body.appendChild(_printIframe);
    }
    return _printIframe;
}

function openPrint(html, landscape) {
    const page = landscape
        ? '@media print{@page{size:A4 landscape;margin:20mm}}'
        : '@media print{@page{size:A4;margin:10mm}}';
    const full = '<!DOCTYPE html><html><head><meta charset="utf-8">'
        + '<style>' + PRINT_CSS + page + '.table-responsive{overflow:visible!important}</style>'
        + '</head><body>' + html + '</body></html>';
    const iframe = getPrintIframe();
    // Chỉ gọi print tại một nơi duy nhất để tránh mở hai hộp thoại.
    iframe.onload = function() {
        setTimeout(function() {
            try {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
            } catch(e) {
                console.error('Không thể mở hộp thoại in:', e);
            }
        }, 500);
    };
    iframe.srcdoc = full;
}

function printB3() { openPrint(document.getElementById('b3-print-zone').innerHTML, false); }
function printB4() {
    const zone = document.getElementById('b4-print-zone');
    const page = '@media print{@page{size:A4 landscape;margin:20mm}}';
    const full = '<!DOCTYPE html><html><head><meta charset="utf-8">'
        + '<style>' + PRINT_CSS + page + '.table-responsive{overflow:visible!important}</style>'
        + '</head><body><div id="bz">' + zone.innerHTML + '</div></body></html>';
    const iframe = getPrintIframe();
    // Co bảng trước khi in, sau đó chỉ gọi print một lần.
    iframe.onload = function() {
        try {
            const doc = iframe.contentDocument;
            const pw = 1100;
            const tbl = doc && doc.querySelector('#bz table');
            if (tbl && tbl.offsetWidth > pw) {
                const s = pw / tbl.offsetWidth;
                doc.getElementById('bz').style.cssText =
                    'transform:scale(' + s + ');transform-origin:top left;width:' + (100 / s) + '%;';
            }
        } catch(e) {
            console.error('Không thể căn chỉnh bảng trước khi in:', e);
        }
        setTimeout(function() {
            try {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
            } catch(e) {
                console.error('Không thể mở hộp thoại in:', e);
            }
        }, 500);
    };
    iframe.srcdoc = full;
}

function printB5() { openPrint(document.getElementById('b5-print-zone').innerHTML, true); }

// Danh sách phường (không có tiền tố "phường" trong tên)
const PHUONG_LIST = [
    'tô hiệu','chiềng an','chiềng cơi','chiềng sinh',
    'mộc sơn','mộc châu','thảo nguyên','vân sơn',
];
function getXaLoai(name) {
    if (!name) return 'xã';
    const n = name.trim().toLowerCase();
    if (n.startsWith('phường ')) return 'phường';
    if (n.startsWith('xã '))     return 'xã';
    // DB lưu tên thuần, không có tiền tố
    return PHUONG_LIST.includes(n) ? 'phường' : 'xã';
}
function xaTieuDe(xaName) {
    const loai = getXaLoai(xaName).toUpperCase();
    return `${loai} ${xaName.toUpperCase()}`;
}

async function printAllB5() {
    const dot   = getRptDot();
    const xaList = await API.listXaByDot(dot);
    if (!xaList.length) { alert('Đợt này không có dữ liệu xã nào.'); return; }
    const { nl, kt, tt } = signBlock();
    const p = getRptParts();
    let allHtml = '';
    for (let xaIdx = 0; xaIdx < xaList.length; xaIdx++) {
        const xa = xaList[xaIdx];
        const res = await API.chiTietXa(dot, xa.id);
        if (res.status === 'error') { allHtml += `<p>Lỗi xã ${xa.xa}: ${res.msg}</p>`; continue; }
        const { loais, cells, soqds, donvi, xa: xaName } = res;
        const serverMucs = (res.mucs || []).map(Number);
    const mucsFromData = [...new Set(
        Object.keys(cells).flatMap(l => Object.keys(cells[l] || {}).map(Number))
    )].sort((a,b)=>a-b);
    const mucs = serverMucs.length
        ? [...new Set([...serverMucs,...mucsFromData])].sort((a,b)=>a-b)
        : mucsFromData;
        const activeLoais = [], activeMucs = {};
        loais.forEach(l => { let has = false; mucs.forEach(m => { if (cells[l]?.[m] > 0) has = true; }); if (has) { activeLoais.push(l); activeMucs[l] = mucs.filter(m => cells[l]?.[m] > 0); } });
        let h1 = `<table style="margin-top:20px"><thead><tr><th rowspan="2" style="width:35px;text-align:center">STT</th><th rowspan="2" style="min-width:170px">Tên đơn vị</th>`;
        activeLoais.forEach(l => h1 += `<th colspan="${activeMucs[l].length+1}" class="th-group">${l}</th>`);
        h1 += `<th rowspan="2" style="min-width:90px;text-align:right">Tổng cộng</th><th rowspan="2" style="min-width:170px">Số QĐ</th></tr><tr>`;
        activeLoais.forEach(l => { activeMucs[l].forEach(m => h1 += `<th class="th-sub muc-col">${(m/1000000).toFixed(m%1000000===0?0:1)}tr</th>`); h1 += `<th class="th-sub total-col">Cộng</th>`; });
        h1 += '</tr></thead><tbody>';
        let rowTotal = 0, cellsHtml = '';
        activeLoais.forEach(l => { let cong = 0; activeMucs[l].forEach(m => { const sl = cells[l]?.[m] || 0; cong += sl * m; cellsHtml += `<td class="muc-col" style="text-align:center">${sl || ''}</td>`; }); rowTotal += cong; cellsHtml += `<td class="total-col" style="font-weight:bold">${cong ? FMT(cong) : ''}</td>`; });
        h1 += `<tr><td style="text-align:center">1</td><td>${donvi}</td>${cellsHtml}<td style="text-align:right;font-weight:bold">${FMT(rowTotal)}</td><td style="white-space:normal;line-height:1.5">${soqds.split('; ').join(';<br>')}</td></tr></tbody></table>`;
        allHtml += `
            <div style="display:flex;justify-content:space-between;align-items:flex-start">
              <div style="font-weight:bold">SỞ NỘI VỤ</div>
              <div style="font-size:12px">STT: ${xaIdx + 1}</div>
            </div>
            <div style="text-align:center"><strong>DANH SÁCH CHI TRẢ MAI TÁNG PHÍ NĂM 2026 ĐỢT ${dot} – ${xaTieuDe(xaName)}</strong></div>
            <p style="text-align:center;font-style:italic;font-size:12px">${kttLine(dot)}</p>
            <div style="text-align:right;font-style:italic;font-size:12px">ĐVT: Đồng</div>
            ${h1}
            <div style="margin-top:12px;font-weight:bold">Số tiền bằng chữ: <u>${numberToWords(rowTotal)}</u></div>
            <div style="margin-top:12px;text-align:right;font-style:italic">Sơn La, ngày ${p[0]||'___'} tháng ${p[1]||'___'} năm 2026</div>
            <table style="width:100%;border:none;margin-top:8px">
              <tr>
                <td style="width:33%;text-align:center;border:none"><strong>Người lập</strong></td>
                <td style="width:33%;text-align:center;border:none"><strong>Kế toán</strong></td>
                <td style="width:33%;text-align:center;border:none"><strong>Thủ trưởng đơn vị</strong></td>
              </tr>
              <tr style="height:75px"><td colspan="3" style="border:none"></td></tr>
              <tr>
                <td style="width:33%;text-align:center;border:none"><strong>${nl}</strong></td>
                <td style="width:33%;text-align:center;border:none"><strong>${kt}</strong></td>
                <td style="width:33%;text-align:center;border:none"><strong>${tt}</strong></td>
              </tr>
            </table>
            <div class="page-break"></div>`;
    }
    openPrint(allHtml, true);
}

/* Export Excel */
function exportB3Excel() {
    const rows = []; let tot = 0;
    $('#tbody-b3 tr').each(function() {
        const c = $(this).find('td'); if (!c.length) return;
        const t = parseInt(c.eq(2).text().replace(/\./g,'').replace(/,/g,'')) || 0; tot += t;
        rows.push([c.eq(0).text(), c.eq(1).text(), t, c.eq(3).text().replace(/<br>/gi,'; '), c.eq(4).text()]);
    });
    rows.push(['', 'TỔNG CỘNG', tot, '', '']);
    const ws = XLSX.utils.aoa_to_sheet([['STT','Tên đơn vị','Tổng tiền','Số QĐ','Số TK'], ...rows]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'B3');
    XLSX.writeFile(wb, 'ThongBao_MTP.xlsx');
}
function exportB4Excel() {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.table_to_sheet(document.getElementById('tbl-b4')), 'B4');
    XLSX.writeFile(wb, 'ChiTiet_MTP.xlsx');
}
function exportB5Excel() {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.table_to_sheet(document.getElementById('tbl-b5')), 'B5');
    XLSX.writeFile(wb, 'ChiTietXa_MTP.xlsx');
}

/* ════════════════════════════════════════════════════════
   Đọc số tiền bằng chữ
════════════════════════════════════════════════════════ */
function numberToWords(amount) {
    if (!amount) return 'Không đồng';
    const units = ['','một','hai','ba','bốn','năm','sáu','bảy','tám','chín'];
    const place  = ['','nghìn','triệu','tỷ'];
    function readBlock(n) {
        const h = Math.floor(n/100), t = Math.floor((n%100)/10), u = n%10;
        let s = '';
        if (h) s += units[h] + ' trăm ';
        if (t === 1) s += 'mười ';
        else if (t > 1) s += units[t] + ' mươi ';
        if (u === 1 && t > 1) s += 'mốt';
        else if (u === 5 && t > 0) s += 'lăm';
        else if (u) s += units[u];
        return s.trim();
    }
    let words = '', idx = 0, amt = amount;
    while (amt > 0) {
        const block = amt % 1000;
        if (block) { let bw = readBlock(block); if (idx > 0) bw += ' ' + place[idx]; words = bw + ' ' + words; }
        amt = Math.floor(amt / 1000); idx++;
    }
    words = words.trim() + ' đồng';
    return words.charAt(0).toUpperCase() + words.slice(1);
}