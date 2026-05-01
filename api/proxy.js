// Vercel API Proxy - Bypass CORS untuk Google Apps Script
// Letakkan file ini di folder: /api/proxy.js

const GAS_URL = "https://script.google.com/macros/s/AKfycbzFDsa85R56Nlgn3QwZ_hl3SNVybUtBY0GjgP1LAF-jN_YfTSyA9Dz2XEK6YB7qDNFqlw/exec";

export default async function handler(req, res) {
    // Allow CORS dari Vercel app
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
// Vercel API Proxy - Bypass CORS untuk Google Apps Script
// Letakkan file ini di folder: /api/proxy.js

const GAS_URL = "https://script.google.com/macros/s/AKfycbw4LsV2mB_x517QfNxQtA4AQmdYzyaUNPp0KCcC1F-_o-0wJtUaKYvdlqKmZcWBKq4Cyw/exec";

export default async function handler(req, res) {
    // ZETTBOT FIX: Header CORS Vercel yang lebih lengkap & stabil
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, PATCH, DELETE, POST, PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        let gasResponse;

        if (req.method === 'GET') {
            const params = req.query;
            const queryString = new URLSearchParams(params).toString();
            const url = queryString ? `${GAS_URL}?${queryString}` : GAS_URL;
            gasResponse = await fetch(url, {
                method: 'GET',
                // ZETTBOT FIX: Hapus Content-Type di GET karena tidak diperlukan,
                // dan tambahkan 'redirect: follow' untuk mengikuti URL redirect GAS
                redirect: 'follow'
            });
        } else if (req.method === 'POST') {
            const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            gasResponse = await fetch(GAS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: body,
                redirect: 'follow' // ZETTBOT FIX: Penting untuk bypass redirect 302 GAS
            });
        } else {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        // ZETTBOT FIX: Mencegah Vercel crash jika respon dari GAS bukan format JSON (misal HTML text)
        const textData = await gasResponse.text();
        try {
            const data = JSON.parse(textData);
            return res.status(200).json(data);
        } catch (parseError) {
            console.warn('Proxy warning: GAS response is not valid JSON. Returning raw text.');
            return res.status(200).send(textData);
        }

    } catch (error) {
        console.error('Proxy error:', error);
        return res.status(500).json({ success: false, message: 'Proxy error: ' + error.message });
    }
}
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        let gasResponse;

        if (req.method === 'GET') {
            const params = req.query;
            const queryString = new URLSearchParams(params).toString();
            const url = queryString ? `${GAS_URL}?${queryString}` : GAS_URL;
            gasResponse = await fetch(url, {
                method: 'GET',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' }
            });
        } else if (req.method === 'POST') {
            const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            gasResponse = await fetch(GAS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: body
            });
        } else {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        // ZETTBOT FIX: Mencegah Vercel crash jika respon dari GAS bukan format JSON (misal HTML text)
        const textData = await gasResponse.text();
        try {
            const data = JSON.parse(textData);
            return res.status(200).json(data);
        } catch (parseError) {
            console.warn('Proxy warning: GAS response is not valid JSON. Returning raw text.');
            return res.status(200).send(textData);
        }

    } catch (error) {
        console.error('Proxy error:', error);
        return res.status(500).json({ success: false, message: 'Proxy error: ' + error.message });
    }
}
