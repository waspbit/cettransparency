const $ = s => document.querySelector(s);
const views = ['login', 'dash', 'view'];
const show = v => { views.forEach(n => $('#v-' + n).hidden = n !== v); $('#logout').hidden = v === 'login'; window.scrollTo(0, 0); };
const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let docs = [];
async function api(path, opts) {
  const r = await fetch(path, { credentials: 'same-origin', ...opts });
  let d = {}; try { d = await r.json(); } catch {}
  if (r.status === 401) { toLogin('Your session has expired. Please enter your student number again.'); throw new Error('auth'); }
  if (!r.ok) throw new Error(d.error || 'Something went wrong.');
  return d;
}
function toLogin(msg) { show('login'); const e = $('#login-err'); e.hidden = !msg; e.textContent = msg || ''; }
const th = localStorage.getItem('cet-theme'); if (th) document.documentElement.dataset.theme = th;
$('#theme').onclick = () => { const d = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = d; localStorage.setItem('cet-theme', d); };
$('#login-form').onsubmit = async e => {
  e.preventDefault(); const b = $('#login-btn'), err = $('#login-err'); err.hidden = true;
  const sn = $('#sn').value.trim(); if (!sn) { err.textContent = 'Please enter your student number.'; err.hidden = false; return; }
  b.classList.add('loading'); b.disabled = true;
  try {
    const r = await fetch('/api/verify', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studentNumber: sn }) });
    const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'Verification failed.');
    $('#sn').value = ''; await loadDash();
  } catch (x) { err.textContent = x.message; err.hidden = false; }
  b.classList.remove('loading'); b.disabled = false;
};
$('#logout').onclick = async () => { try { await fetch('/api/session', { method: 'POST', credentials: 'same-origin' }); } catch {} closePdf(); toLogin(); };
const fmt = s => { const d = new Date(s); return s && !isNaN(d) ? d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Date not available'; };
const ts = s => { const t = new Date(s).getTime(); return isNaN(t) ? 0 : t; };
const card = d => `<article class="card"><h3>${esc(d.title)}</h3><p class="desc">${esc(d.description || '')}</p><p class="date">${fmt(d.date)}</p><button class="btn btn-sm" data-id="${esc(d.docId)}">View PDF</button></article>`;
function render() {
  const q = $('#q').value.trim().toLowerCase();
  const list = docs.filter(d => !q || (d.title + ' ' + d.description).toLowerCase().includes(q));
  const empty = '<p class="note" style="grid-column:1/-1">No published documents found.</p>';
  $('#count').textContent = list.length;
  $('#all').innerHTML = list.length ? list.map(card).join('') : empty;
  const rec = [...docs].sort((a, b) => ts(b.date) - ts(a.date)).slice(0, 3);
  $('#recent').innerHTML = rec.length ? rec.map(card).join('') : empty;
}
async function loadDash() {
  show('dash'); $('#all').innerHTML = $('#recent').innerHTML = '<div class="skel"></div><div class="skel"></div>';
  try { docs = (await api('/api/documents')).documents; render(); }
  catch (e) { if (e.message !== 'auth') $('#all').innerHTML = `<div class="alert" style="grid-column:1/-1">${esc(e.message)}</div>`; }
}
$('#q').oninput = render;
document.addEventListener('click', e => { const b = e.target.closest('[data-id]'); if (b) openPdf(b.dataset.id); });
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
let pdf = null, page = 1, scale = 1, fit = 'w', busy = false;
async function openPdf(id) {
  const d = docs.find(x => x.docId === id); if (!d) return;
  show('view'); $('#vtitle').textContent = d.title; $('#v-err').hidden = true; $('#vload').hidden = false; $('#cv').hidden = true;
  try {
    const r = await fetch('/api/pdf?id=' + encodeURIComponent(id), { credentials: 'same-origin' });
    if (r.status === 401) { toLogin('Your session has expired. Please enter your student number again.'); return; }
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Could not load the document.');
    pdf = await pdfjsLib.getDocument({ data: await r.arrayBuffer() }).promise; page = 1; fit = 'w';
    $('#vload').hidden = true; $('#cv').hidden = false; draw();
  } catch (e) { $('#vload').hidden = true; $('#v-err').textContent = e.message; $('#v-err').hidden = false; }
}
async function draw() {
  if (!pdf || busy) return; busy = true;
  try {
    const p = await pdf.getPage(page), v1 = p.getViewport({ scale: 1 }), w = $('#stage').clientWidth - 24;
    if (fit === 'w') scale = w / v1.width; else if (fit === 'p') scale = Math.min(w / v1.width, (innerHeight - 190) / v1.height);
    const dpr = devicePixelRatio || 1, v = p.getViewport({ scale: scale * dpr }), c = $('#cv');
    c.width = v.width; c.height = v.height; c.style.width = v.width / dpr + 'px'; c.style.height = v.height / dpr + 'px';
    await p.render({ canvasContext: c.getContext('2d'), viewport: v }).promise;
    $('#pg').textContent = page + ' / ' + pdf.numPages;
  } catch (e) {}
  busy = false;
}
function closePdf() { if (pdf) { pdf.destroy(); pdf = null; } $('#cv').width = 0; }
const go = n => { if (pdf && n >= 1 && n <= pdf.numPages) { page = n; draw(); } };
$('#prev').onclick = () => go(page - 1); $('#next').onclick = () => go(page + 1);
$('#zin').onclick = () => { fit = ''; scale *= 1.2; draw(); }; $('#zout').onclick = () => { fit = ''; scale /= 1.2; draw(); };
$('#fitw').onclick = () => { fit = 'w'; draw(); }; $('#fitp').onclick = () => { fit = 'p'; draw(); };
$('#back').onclick = () => { closePdf(); show('dash'); };
addEventListener('resize', () => { if (pdf && fit) draw(); });
// Deterrents only: they do not make capture impossible.
$('#stage').addEventListener('contextmenu', e => e.preventDefault());
addEventListener('keydown', e => { if (!$('#v-view').hidden && (e.ctrlKey || e.metaKey) && ['p', 's'].includes(e.key.toLowerCase())) e.preventDefault(); });
fetch('/api/session', { credentials: 'same-origin' }).then(r => r.ok ? loadDash() : show('login')).catch(() => show('login'));
