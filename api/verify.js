const L = require('./_lib');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return L.fail(res, 405, 'Method not allowed.');
  try {
    if (!(await L.rateLimit('v:' + L.ip(req), 10, 600))) return L.fail(res, 429, 'Too many attempts. Please wait 10 minutes and try again.');
    const sn = String((req.body && req.body.studentNumber) || '').trim();
    if (!sn) return L.fail(res, 400, 'Please enter your student number.');
    if (!L.SN_RE.test(sn)) return L.fail(res, 400, 'Student number format is invalid.');
    if (!(await L.rateLimit('s:' + sn.toLowerCase(), 8, 600))) return L.fail(res, 429, 'Too many attempts for this student number. Please try again later.');
    const { sheets } = L.google_();
    const r = await sheets.spreadsheets.values.get({ spreadsheetId: process.env.REGISTRY_SPREADSHEET_ID, range: "'Student Registry'!A2:C" });
    const row = (r.data.values || []).find(x => (x[0] || '').trim().toLowerCase() === sn.toLowerCase());
    if (!row || (row[1] || '').trim().toLowerCase() !== 'active')
      return L.fail(res, 403, 'This student number is not registered or not active. Please contact your CET administrator.');
    const level = (row[2] || '').trim().toLowerCase() === 'admin' ? 'Admin' : 'Student';
    await L.createSession(res, sn, level);
    L.send(res, 200, { ok: true });
  } catch (e) { L.fail(res, 500, 'Service temporarily unavailable. Please try again.'); }
};
