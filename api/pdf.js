const L = require('./_lib');
// DocID -> Drive mapping: the PDF in the private folder must be named "<DocID>.pdf". No extra sheet columns needed.
module.exports = async (req, res) => {
  try {
    if (!(await L.getSession(req))) return L.fail(res, 401, 'Session expired.');
    const id = String(req.query.id || '');
    if (!L.ID_RE.test(id)) return L.fail(res, 400, 'Invalid document.');
    const doc = (await L.getDocs()).find(d => d.docId === id); // re-checks Published on every request
    if (!doc) return L.fail(res, 404, 'This document is not available.');
    const { drive } = L.google_();
    const q = `name='${id}.pdf' and '${process.env.DRIVE_FOLDER_ID}' in parents and trashed=false`;
    const list = await drive.files.list({ q, fields: 'files(id,mimeType)', pageSize: 3 });
    const files = list.data.files || [];
    if (files.length !== 1 || files[0].mimeType !== 'application/pdf') return L.fail(res, 404, 'This document is not available.');
    const f = await drive.files.get({ fileId: files[0].id, alt: 'media' }, { responseType: 'arraybuffer' });
    const buf = Buffer.from(f.data);
    if (buf.subarray(0, 5).toString() !== '%PDF-') return L.fail(res, 404, 'This document is not available.');
    res.status(200);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'no-store, private');
    res.end(buf);
  } catch (e) { L.fail(res, 500, 'Could not load the document. Please try again.'); }
};
