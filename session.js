const L = require('./_lib');
module.exports = async (req, res) => {
  try {
    if (req.method === 'POST') { await L.destroySession(req, res); return L.send(res, 200, { ok: true }); } // logout
    const s = await L.getSession(req);
    return s ? L.send(res, 200, { ok: true }) : L.fail(res, 401, 'Session expired.');
  } catch (e) { L.fail(res, 500, 'Service temporarily unavailable.'); }
};
