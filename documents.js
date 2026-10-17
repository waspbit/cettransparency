const L = require('./_lib');
module.exports = async (req, res) => {
  try {
    if (!(await L.getSession(req))) return L.fail(res, 401, 'Session expired.');
    const docs = (await L.getDocs()).map(({ docId, title, description, date }) => ({ docId, title, description, date }));
    L.send(res, 200, { ok: true, documents: docs });
  } catch (e) { L.fail(res, 500, 'Could not load documents. Please try again.'); }
};
