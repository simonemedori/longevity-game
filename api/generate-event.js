// api/generate-event.js — Vercel Serverless Function
import https from 'https';

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

const MAX_BODY_SIZE = 50 * 1024; // 50KB

export default async function handler(req, res) {
  const origin = req.headers['origin'] || '';

  const setCors = () => {
    const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] || '';
    res.setHeader('Access-Control-Allow-Origin', allowed);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  };

  setCors();

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).end('Method Not Allowed');
  }

  if (ALLOWED_ORIGINS.length > 0 && !ALLOWED_ORIGINS.includes(origin)) {
    return res.status(403).json({ error: 'Origine non autorizzata' });
  }

  const body = JSON.stringify(req.body);
  if (Buffer.byteLength(body, 'utf8') > MAX_BODY_SIZE) {
    return res.status(413).json({ error: 'Payload troppo grande' });
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY non configurata nelle Environment Variables di Vercel' });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

  return new Promise((resolve) => {
    const reqGoogle = https.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (googleRes) => {
      let data = '';
      googleRes.on('data', chunk => data += chunk);
      googleRes.on('end', () => {
        res.setHeader('Content-Type', 'application/json');
        res.status(googleRes.statusCode).end(data);
        resolve();
      });
    });

    reqGoogle.on('error', (e) => {
      res.status(500).json({ error: 'Errore chiamata Google', details: e.message });
      resolve();
    });

    reqGoogle.write(body);
    reqGoogle.end();
  });
}
