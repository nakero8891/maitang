/* api.js  —  HTTP client wrapper */
'use strict';

const API = (() => {
    const BASE = '';

    async function req(method, url, body) {
        const opts = { method, credentials: 'same-origin' };
        if (body) {
            opts.headers = { 'Content-Type': 'application/json' };
            opts.body = JSON.stringify(body);
        }
        const res = await fetch(BASE + url, opts);
        if (res.status === 401) { window.location.href = '/login'; return {}; }
        return res.json();
    }

    return {
        // Auth
        me: ()              => req('GET',  '/api/me'),

        // Đơn vị
        listDonvi: ()       => req('GET',  '/api/donvi'),
        addDonvi:  (d)      => req('POST', '/api/donvi', d),
        updateDonvi: (id,d) => req('PUT',  `/api/donvi/${id}`, d),
        deleteDonvi: (id)   => req('DELETE',`/api/donvi/${id}`),
        importDonvi: (rows) => req('POST', '/api/donvi/import', { rows }),

        // Hồ sơ
        addHoso:    (d)     => req('POST', '/api/hoso', d),
        updateHoso: (id,d)  => req('PUT',  `/api/hoso/${id}`, d),
        deleteHoso: (id)    => req('DELETE',`/api/hoso/${id}`),
        importHoso: (data)  => req('POST', '/api/hoso/import', data),

        // Báo cáo
        thongBao:   (dot)          => req('GET', `/api/baocao/thongbao?dot=${dot}`),
        chiTiet:    (dot)          => req('GET', `/api/baocao/chitiet?dot=${dot}`),
        chiTietXa:  (dot, xa_id)   => req('GET', `/api/baocao/chitietxa?dot=${dot}&xa_id=${xa_id}`),
        listXaByDot:(dot)          => req('GET', `/api/baocao/xabydot?dot=${dot}`),

        // Cài đặt
        getSettings:  ()    => req('GET',  '/api/settings'),
        saveSettings: (d)   => req('POST', '/api/settings', d),

        // Draft — gọi trực tiếp window.location.href trong main.js (file download)
    };
})();
