const { google } = require('googleapis');
const crypto = require('crypto');
const SESSION_TTL = 1800; // 30 min absolute; students must re-verify afterwards
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const SN_RE = /^[A-Za-z0-9-]{4,20}$/;
const send = (res, code, body) => { res.status(code).setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); };
const fail = (res, code, error) => send(res, code, { ok: false, error });
async function redis(cmd) {
  const r = await fetch(process.env.UPSTASH_REDIS_REST_URL, { method: 'POST', headers: { Authorization: 'Bearer ' + process.env.UPSTASH_REDIS_REST_TOKEN }, body: JSON.stringify(cmd) });
  const j = await r.json(); if (j.error) throw new Error('store'); return j.result;
}
function google_() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly', 'https://www.googleapis.com/auth/drive.readonly'] });
  return { sheets: google.sheets({ version: 'v4', auth }), drive: google.drive({ version: 'v3', auth }) };
}
const cookie = (req, n) => (req.headers.cookie || '').split(';').map(s => s.trim().split('=')).find(p => p[0] === n)?.[1];
const setCookie = (res, v, age) => res.setHeader('Set-Cookie', `cet_sid=${v}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${age}`);
async function createSession(res, student, level) {
  const id = crypto.randomBytes(32).toString('hex');
  await redis(['SET', 'sess:' + id, JSON.stringify({ s: student, l: level }), 'EX', SESSION_TTL]);
  setCookie(res, id, SESSION_TTL);
}
async function getSession(req) {
  const id = cookie(req, 'cet_sid'); if (!id || !/^[a-f0-9]{64}$/.test(id)) return null;
  const v = await redis(['GET', 'sess:' + id]); return v ? JSON.parse(v) : null;
}
async function destroySession(req, res) {
  const id = cookie(req, 'cet_sid');
  if (id && /^[a-f0-9]{64}$/.test(id)) await redis(['DEL', 'sess:' + id]);
  setCookie(res, '', 0);
}
async function rateLimit(key, max, windowSec) {
  const k = 'rl:' + key, n = await redis(['INCR', k]);
  if (n === 1) await redis(['EXPIRE', k, windowSec]);
  return n <= max;
}
// Reads the five-column worksheet. Duplicated DocIDs are dropped so a bad row can never expose the wrong file.
async function getDocs() {
  const { sheets } = google_();
  const r = await sheets.spreadsheets.values.get({ spreadsheetId: process.env.DOCS_SPREADSHEET_ID, range: "'Transparency Documents'!A2:E" });
  const rows = (r.data.values || []).map(x => ({ docId: (x[0] || '').trim(), title: (x[1] || '').trim(), description: (x[2] || '').trim(), date: (x[3] || '').trim(), status: (x[4] || '').trim().toLowerCase() }))
    .filter(d => ID_RE.test(d.docId));
  const count = {}; rows.forEach(d => count[d.docId] = (count[d.docId] || 0) + 1);
  return rows.filter(d => count[d.docId] === 1 && d.status === 'published' && d.title);
}
const ip = req => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
module.exports = { send, fail, google_, createSession, getSession, destroySession, rateLimit, getDocs, ID_RE, SN_RE, ip };
