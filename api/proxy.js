// Vercel API Proxy - Bypass CORS untuk Google Apps Script
// Letakkan file ini di folder: /api/proxy.js

const GAS_URL = "https://script.google.com/macros/s/AKfycbzFDsa85R56Nlgn3QwZ_hl3SNVybUtBY0GjgP1LAF-jN_YfTSyA9Dz2XEK6YB7qDNFqlw/exec";

export default async function handler(req, res) {
    // Allow CORS dari Vercel app
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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

        const data = await gasResponse.json();
        return res.status(200).json(data);

    } catch (error) {
        console.error('Proxy error:', error);
        return res.status(500).json({ success: false, message: 'Proxy error: ' + error.message });
    }
}
