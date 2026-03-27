// functions/index.js — Firebase Cloud Function v2 (proxy Gemini AI)
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const https = require('https');

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');
const MAX_BODY_SIZE = 50 * 1024; // 50KB
const ALLOWED_ORIGIN = 'https://longevitygame.it';

exports.generateEvent = onRequest(
  {
    secrets: [GEMINI_API_KEY],
    invoker: 'public',
    region: 'us-central1'
  },
  (req, res) => {
    const origin = req.headers['origin'] || '';
    const originAllowed = origin === ALLOWED_ORIGIN;

    if (originAllowed) {
      res.set('Access-Control-Allow-Origin', origin);
      res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
    }

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'POST') {
      return res.status(405).end('Method Not Allowed');
    }

    if (!originAllowed) {
      return res.status(403).json({ error: 'Origine non autorizzata' });
    }

    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) ||
        !Array.isArray(req.body.contents) || req.body.contents.length === 0) {
      return res.status(400).json({ error: 'Payload non valido' });
    }

    const body = JSON.stringify(req.body);
    if (Buffer.byteLength(body, 'utf8') > MAX_BODY_SIZE) {
      return res.status(413).json({ error: 'Payload troppo grande' });
    }

    const apiKey = GEMINI_API_KEY.value();
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY non configurata' });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

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
);
