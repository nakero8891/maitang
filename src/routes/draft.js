// src/routes/draft.js
'use strict';
const express = require('express');
const path    = require('path');
const fs      = require('fs');
const pool    = require('../db/pool');
const { requireLogin } = require('../middleware/auth');
// Danh sách phường (DB lưu tên thuần, không có tiền tố)
const PHUONG_LIST_DRAFT = [
    'Tô Hiệu','Chiềng An','Chiềng Cơi','Chiềng Sinh',
    'Mộc Sơn','Mộc Châu','Thảo Nguyên','Vân Sơn',
];
function getXaLoai(name) {
    if (!name) return 'xã';
    const n = name.trim();
    if (/^phường\s/i.test(n)) return 'phường';
    if (/^xã\s/i.test(n))     return 'xã';
    if (PHUONG_LIST_DRAFT.some(p => p.toLowerCase() === n.toLowerCase())) return 'phường';
    return 'xã';
}

// KHÔNG require pizzip/docxtemplater ở đây
// → require bên trong handler để tránh crash app nếu chưa cài

const router   = express.Router();
const TMPL_DIR = path.join(__dirname, '..', '..', 'templates');

const TEMPLATE_MAP = {
    'NCC': 'NCC.docx',
    '150': '150.docx',
    '49':  '49.docx',
    '62':  '62.docx',
    '290': '290.docx',
};

function fmtDate(d) {
    if (!d) return '';
    const dt = new Date(d);
    if (isNaN(dt)) return '';
    return [String(dt.getDate()).padStart(2,'0'), String(dt.getMonth()+1).padStart(2,'0'), dt.getFullYear()].join('/');
}

function fmtMoney(n) { return Number(n).toLocaleString('vi-VN'); }

function numberToWords(amount) {
    if (!amount) return 'Không đồng';
    const units = ['','một','hai','ba','bốn','năm','sáu','bảy','tám','chín'];
    const place  = ['','nghìn','triệu','tỷ'];
    function readBlock(n) {
        const h=Math.floor(n/100), t=Math.floor((n%100)/10), u=n%10;
        let s='';
        if(h) s+=units[h]+' trăm ';
        if(t===1) s+='mười ';
        else if(t>1) s+=units[t]+' mươi ';
        if(u===1&&t>1) s+='mốt';
        else if(u===5&&t>0) s+='lăm';
        else if(u) s+=units[u];
        return s.trim();
    }
    let words='', idx=0, amt=amount;
    while(amt>0){ const b=amt%1000; if(b){let w=readBlock(b);if(idx>0)w+=' '+place[idx];words=w+' '+words;} amt=Math.floor(amt/1000);idx++; }
    words=words.trim()+' đồng';
    return words.charAt(0).toUpperCase()+words.slice(1);
}

function buildVars(row) {
    const xaName    = row.xa    || '';
    const xa_loai   = getXaLoai(xaName);
    const danh_xung = (row.gioitinh||'').toLowerCase()==='nữ' ? 'bà' : 'ông';
    return {
        soqd:           row.soqd            || '',
        ngay_ky: '', thang_ky: '',
        nam_ky:         String(new Date().getFullYear()),
        dot:            String(row.dot      || ''),
        xa:             xaName,
        xa_loai,
        donvi:          row.donvi           || '',
        sotk:           row.sotk            || '',
        doituong:       row.doituong        || '',
        namsinh:        fmtDate(row.namsinh),
        ngaytutran:     fmtDate(row.ngaytutran),
        ban_doituong:   row.ban_doituong    || '',
        chitietloai:    row.chitietloai     || '',
        nguoinhan:      row.nguoinhan       || '',
        quanhe:         row.quanhe          || '',
        danh_xung,
        ngaysinh_nhan:  fmtDate(row.ngaysinh_nhan),
        gioitinh:       row.gioitinh        || '',
        quequan_nhan:   row.quequan_nhan    || '',
        thuongtru_nhan: row.thuongtru_nhan  || '',
        so_ngay_trinh:  row.so_ngay_trinh   || '',
        muc:            fmtMoney(row.muc),
        muc_chu:        numberToWords(Number(row.muc)),
        ghichu:         row.ghichu          || '',
    };
}

router.get('/:id', requireLogin, async (req, res) => {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ status:'error', msg:'ID không hợp lệ' });

    try {
        // Require lazily — chỉ khi thực sự cần
        let PizZip, Docxtemplater;
        try {
            PizZip        = require('pizzip');
            Docxtemplater = require('docxtemplater');
        } catch(e) {
            return res.status(503).json({
                status: 'error',
                msg: 'Chưa cài package tạo Word. Chạy: npm install pizzip docxtemplater rồi restart app.'
            });
        }

        const [[row]] = await pool.query(
            'SELECT h.*, d.xa, d.donvi, d.sotk FROM mtp_hoso h LEFT JOIN mtp_donvi d ON h.xa_id=d.id WHERE h.id=?',
            [id]
        );
        if (!row) return res.status(404).json({ status:'error', msg:'Không tìm thấy hồ sơ' });

        const tmplFile = TEMPLATE_MAP[row.loai];
        if (!tmplFile)
            return res.status(400).json({ status:'error', msg:`Chưa có mẫu dự thảo cho loại "${row.loai}"` });

        const tmplPath = path.join(TMPL_DIR, tmplFile);
        if (!fs.existsSync(tmplPath))
            return res.status(404).json({ status:'error', msg:`Không tìm thấy file template: templates/${tmplFile}` });

        const vars    = buildVars(row);
        const zip     = new PizZip(fs.readFileSync(tmplPath, 'binary'));
        const tpl     = new Docxtemplater(zip, { paragraphLoop:true, linebreaks:true });
        tpl.render(vars);

        const buf      = tpl.getZip().generate({ type:'nodebuffer', compression:'DEFLATE' });
        const filename = `DuThao_${row.loai}_${(row.doituong||`hoso-${id}`).replace(/\s+/g,'_')}.docx`;

        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.send(buf);

    } catch(err) {
        console.error('Draft error:', err);
        res.status(500).json({ status:'error', msg:'Lỗi tạo dự thảo: '+err.message });
    }
});

module.exports = router;
