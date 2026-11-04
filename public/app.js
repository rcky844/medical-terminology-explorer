const state = { terms: [], filtered: [], vocab: null, categories: {}, test: null, wodTerms: null };
let wodViewDate = new Date();
function isToday(d){ const t=new Date(); return d.toDateString()===t.toDateString(); }
function dayOfYearOf(d) { const s=new Date(d.getFullYear(),0,0); return Math.floor((d-s)/86400000); }

const $ = (sel) => document.querySelector(sel);
const grid = $('#grid');
const status = $('#status');
const count = $('#count');
const detail = $('#detail');
const detailBody = $('#detailBody');

function stripHtml(s){ return (s || '').replace(/<[^>]*>/g, ''); }

function decodeBase64(b64) {
  const bin = atob(b64.trim());
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}

const SOURCE_MAP = {
  '/api/mtlist': 'https://medterms.hku.hk/storage/mtlist.json',
  '/api/vocab': 'https://medterms.hku.hk/storage/vocab.json',
  '/api/wordofday': 'https://medterms.hku.hk/storage/wordofday.json',
  '/api/category': 'https://medterms.hku.hk/storage/category.json'
};

async function fetchBase64(url) {
  const src = SOURCE_MAP[url] || url;
  let rawText = '';

  const isNative = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());

  if (isNative) {
    const res = await fetch(src, {
      headers: {
        'Accept': 'application/json, text/plain, */*'
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} from native fetch`);
    rawText = await res.text();
  }
  else {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    rawText = await res.text();
  }

  const trimmed = rawText.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('<!DOCTYPE')) {
    return trimmed;
  }

  try {
    return decodeBase64(trimmed);
  } catch (err) {
    return rawText;
  }
}

async function load() {
  try {
    status.textContent = 'Loading terminology list and word parts…';
    const [termText, vocabText, wodText, catText] = await Promise.all([
      fetchBase64('/api/mtlist'),
      fetchBase64('/api/vocab'),
      fetchBase64('/api/wordofday'),
      fetchBase64('/api/category')
    ]);

    const parseOrThrow = (text, label) => {
      const trimmed = (text || '').trim();
      try {
        return JSON.parse(trimmed);
      } catch (err) {
        throw new Error(`[${label}] Expected JSON, but received: "${trimmed}"`);
      }
    };

    const data = parseOrThrow(termText, 'mtlist.json');
    state.terms = Array.isArray(data) ? data : [];
    state.vocab = parseOrThrow(vocabText, 'vocab.json');
    state.wodTerms = parseOrThrow(wodText, 'wordofday.json');
    const cats = parseOrThrow(catText, 'category.json');
    state.categories = {};
    if (Array.isArray(cats)) cats.forEach(c => { state.categories[c.catId] = c.category; });

    status.hidden = true;
    grid.hidden = false;
    populateFilters();
    applyFilters();
    renderWod();
  } catch (err) {
    const msg = err && (err.message || (typeof err.toString === 'function' ? err.toString() : String(err)));
    status.textContent = 'Failed to load data: ' + msg;
    console.error('Full load error:', err);
  }
}

/* ---------- vocab helpers ---------- */
function canon(s) { return (s || '').toLowerCase().replace(/[^a-z]/g, ''); }
function baseToken(t) { return (t || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z]/g, '').replace(/o$/, ''); }

function vocabMatches(kind, partString) {
  if (!partString || !state.vocab) return [];
  const list = state.vocab[kind] || [];
  const segments = String(partString).split(/[^A-Za-z]+/).filter(Boolean)
    .map(canon).filter(Boolean);
  const found = [];
  for (const v of list) {
    const vtoks = (v.term.match(/[A-Za-z]+/g) || []).map(baseToken);
    let ok = false;
    for (const segRaw of segments) {
      const seg = segRaw.endsWith('o') ? segRaw.slice(0, -1) : segRaw;
      for (const tk of vtoks) {
        if (!tk) continue;
        if (seg.length <= 3 || tk.length <= 3) {
          if (seg === tk) { ok = true; break; }
        } else if (seg === tk || (seg.startsWith(tk) && seg.length - tk.length <= 2) || (tk.startsWith(seg) && tk.length - seg.length <= 2)) {
          ok = true; break;
        }
      }
      if (ok) break;
    }
    if (ok) found.push(v);
  }
  return found;
}

function wordPartsBlock(t) {
  const rows = [];
  const defs = (label, kind, value) => {
    if (!value) return;
    const ms = vocabMatches(kind, value);
    const meaning = ms.length ? ms.map(m => `${escapeHtml(m.term)}: ${escapeHtml(m.meaning_uk)}`).join('<br>') : '<span class="muted">no matching entry</span>';
    rows.push(`<dt>${escapeHtml(label)}: ${escapeHtml(value)}</dt><dd>${meaning}</dd>`);
  };
  defs('Prefix', 'prefix', t.prefix);
  defs('Root', 'root', t.root);
  defs('Suffix', 'suffix', t.suffix);
  if (!rows.length) return '';
  return `<div class="wordparts"><h3>Word parts</h3><dl class="info-grid">${rows.join('')}</dl></div>`;
}

function wordPartsSummary(t) {
  const bits = [];
  for (const [label, kind, value] of [['prefix','prefix',t.prefix],['root','root',t.root],['suffix','suffix',t.suffix]]) {
    if (!value) continue;
    const ms = vocabMatches(kind, value);
    if (ms.length) bits.push(`${label} ${value} = ${ms.map(m=>m.meaning_uk).join('; ')}`);
  }
  return bits.length ? bits.join(' | ') : null;
}


function dayOfYear() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now - start) / 86400000);
}
function getWod() {
  const arr = state.wodTerms || [];
  if (!arr.length) return null;
  const n = Math.max(1, dayOfYearOf(wodViewDate));
  const t = arr.length;
  const idx = t >= 365 ? (t % n) : (n % t);
  return arr[Number.isFinite(idx) ? idx : 0] || arr[0];
}
function renderWod() {
  const t = getWod();
  if (!t) return;
  const sec = $('#wodSection');
  const today = new Date().toDateString();
  if (localStorage.getItem('wodDismissedDate') === today) {
    sec.hidden = true;
    const rb = $('#showWodBtn');
    if (rb) rb.hidden = false;
    return;
  }
  sec.hidden = false;
  const rb = $('#showWodBtn');
  if (rb) rb.hidden = true;

  const audioUrl = t.sound_uk ? `https://medterms.hku.hk/storage/audio/mtlist/${encodeURIComponent(t.sound_uk)}` : null;
  const wodAudioUrl = t.wodSound ? `https://medterms.hku.hk/storage/audio/wordofday/${encodeURIComponent(t.wodSound)}` : null;
  const wodDate = new Date(wodViewDate);
  const imgUrl = t.image ? `https://medterms.hku.hk/storage/image/${encodeURIComponent(t.image)}` : null;
  sec.innerHTML = `
    <div class="wodcard">
      <div class="wodhead">
        <h2>Word of the Day</h2>
        <div class="wodactions">
          <input type="date" id="wodDatePicker" class="wodbtn" value="${wodDate.toISOString().slice(0,10)}" />
          <button class="wodbtn" id="wodPrev">◀ Prev</button>
          <button class="wodbtn" id="wodNext"${isToday(wodViewDate)?' disabled':''}>Next ▶</button>
          <button class="wodbtn" id="wodToday">Today</button>
          <button class="wodbtn" id="wodToggle">Collapse</button>
          <button class="wodbtn" id="wodDismiss">Dismiss today</button>
        </div>
      </div>
      <div class="muted" style="margin-bottom:.5rem">${wodDate.toDateString()}</div>
      <div id="wodContent">
        <div class="wodtitle">${escapeHtml(t.word)}</div>
        <span class="muted">${today}</span>
        ${t.wordStress_uk ? `<div class="stress">${t.wordStress_uk}</div>` : ''}
        ${wordPartsBlock(t)}
        <div class="meaning-full">${t.meaning_uk || ''}</div>
        <div class="breakdown" style="margin-top:.5rem">
          ${t.prefix ? `<span class="chip chip-prefix">${escapeHtml(t.prefix)} <small>(prefix)</small></span>` : ''}
          ${t.root ? `<span class="chip chip-root">${escapeHtml(t.root)} <small>(root)</small></span>` : ''}
          ${t.suffix ? `<span class="chip chip-suffix">${escapeHtml(t.suffix)} <small>(suffix)</small></span>` : ''}
        </div>
        ${t.formation ? `<div><strong>Formation:</strong> ${escapeHtml(t.formation)}</div>` : ''}
        ${t.itemNoOnRevisedList ? `<div><strong>Item number on revised list:</strong> ${escapeHtml(t.itemNoOnRevisedList)}</div>` : ''}
        ${t.sentence ? `<div style="margin-top:.5rem"><strong>Sentence example:</strong><div>${t.sentence}</div></div>` : ''}
        <div class="media">
          ${audioUrl ? `<div><div class="muted" style="margin-bottom:.25rem">Pronunciation</div>${audioPlayer(audioUrl)}</div>` : ''}
          ${wodAudioUrl ? `<div><div class="muted" style="margin-bottom:.25rem">Explanation (definition + example)</div>${audioPlayer(wodAudioUrl)}</div>` : ''}
          ${imgUrl ? `<img src="${imgUrl}" alt="${escapeHtml(t.word)}" loading="lazy" />` : ''}
        </div>
      </div>
    </div>`;

  const toggle = $('#wodToggle');
  const content = $('#wodContent');
  if (toggle && content) {
    toggle.addEventListener('click', () => {
      const hidden = content.hidden;
      content.hidden = !hidden;
      toggle.textContent = hidden ? 'Collapse' : 'Expand';
    });
  }
  const prev = $('#wodPrev');
  if (prev) prev.addEventListener('click', () => { const d=new Date(wodViewDate); d.setDate(d.getDate()-1); wodViewDate=d; renderWod(); });
  const next = $('#wodNext');
  if (next) next.addEventListener('click', () => { if (!isToday(wodViewDate)) { const d=new Date(wodViewDate); d.setDate(d.getDate()+1); wodViewDate=d; renderWod(); } });
  const dp = $('#wodDatePicker');
  if (dp) dp.addEventListener('change', (e) => { if (e.target.value) { wodViewDate = new Date(e.target.value+'T00:00:00'); renderWod(); } });

  const todayBtn = $('#wodToday');
  if (todayBtn) todayBtn.addEventListener('click', () => { wodViewDate = new Date(); renderWod(); });

  const dismiss = $('#wodDismiss');
  if (dismiss) {
    dismiss.addEventListener('click', () => {
      if (!confirm('Dismiss Word of the Day for today?')) return;
      localStorage.setItem('wodDismissedDate', today);
      sec.hidden = true;
      const rb2 = $('#showWodBtn');
      if (rb2) rb2.hidden = false;
    });
  }
}

/* ---------- browse ---------- */
function populateFilters() {
  const levels = [...new Set(state.terms.map(t => t.level).filter(Boolean))].sort();
  const cats = [...new Set(state.terms.map(t => t.catId).filter(Boolean))].sort((a,b)=>+a-+b);
  const levelSel = $('#levelFilter');
  const catSel = $('#catFilter');
  levels.forEach(l => { const o = document.createElement('option'); o.value = l; o.textContent = 'Level ' + l; levelSel.appendChild(o); });
  cats.forEach(c => {
    const o = document.createElement('option');
    o.value = c;
    const name = state.categories[c] || ('Category ' + c);
    const cnt = state.terms.filter(t => t.catId === c).length;
    o.textContent = `${name} (${cnt})`;
    catSel.appendChild(o);
  });
}

function applyFilters() {
  const q = $('#search').value.trim().toLowerCase();
  const level = $('#levelFilter').value;
  const cat = $('#catFilter').value;
  state.filtered = state.terms.filter(t => {
    if (level && t.level !== level) return false;
    if (cat && t.catId !== cat) return false;
    if (!q) return true;
    const hay = [t.word, t.meaning_uk, t.meaning_us, t.prefix, t.root, t.suffix, t.wordtype, t.catId]
      .filter(Boolean).join(' ').toLowerCase();
    return hay.includes(q);
  });
  renderGrid();
}

function renderGrid() {
  grid.innerHTML = '';
  count.textContent = `${state.filtered.length} of ${state.terms.length} terms`;
  if (!state.filtered.length) {
    grid.innerHTML = '<p class="status">No matching terms.</p>';
    return;
  }
  const frag = document.createDocumentFragment();
  state.filtered.forEach(t => {
    const card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = `
      <h3>${escapeHtml(t.word)}</h3>
      <div class="meaning">${escapeHtml(stripHtml(t.meaning_uk || t.meaning_us || ''))}</div>
      <div class="meta">
        ${t.level ? `<span class="tag">Level ${escapeHtml(t.level)}</span>` : ''}
        ${t.catId ? `<span class="tag">${escapeHtml(state.categories[t.catId] || ('Cat ' + t.catId))}</span>` : ''}
        ${t.syllableNo ? `<span class="tag">${escapeHtml(t.syllableNo)} syll.</span>` : ''}
      </div>`;
    card.addEventListener('click', () => openDetail(t));
    frag.appendChild(card);
  });
  grid.appendChild(frag);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function openDetail(t) {
  const wordStress = t.wordStress_uk || t.wordStress_us || '';
  const meaning = t.meaning_uk || t.meaning_us || '';
  const audioName = t.sound_uk || t.sound_us;
  const audioUrl = audioName ? `https://medterms.hku.hk/storage/audio/mtlist/${encodeURIComponent(audioName)}` : null;
  const wodDate = new Date(wodViewDate);
  const imgUrl = t.image ? `https://medterms.hku.hk/storage/image/${encodeURIComponent(t.image)}` : null;

  let html = `<h2 class="detail-title">${escapeHtml(t.word)}</h2>`;
  if (wordStress) html += `<div class="stress">${wordStress}</div>`;
  html += `<div class="meaning-full">${meaning}</div>`;
  html += `<dl class="info-grid">
    ${t.wordtype ? `<dt>Type</dt><dd>${escapeHtml(t.wordtype)}</dd>` : ''}
    ${t.syllableNo ? `<dt>Syllables</dt><dd>${escapeHtml(t.syllableNo)}</dd>` : ''}
    ${t.level ? `<dt>Level</dt><dd><span class="tag">Level ${escapeHtml(t.level)}</span></dd>` : ''}
    ${t.catId ? `<dt>Category</dt><dd><span class="tag">${escapeHtml(state.categories[t.catId] || t.catId)}</span></dd>` : ''}
  </dl>`;
  html += `<div class="breakdown">
    ${t.prefix ? `<span class="chip chip-prefix">${escapeHtml(t.prefix)} <small>(prefix)</small></span>` : ''}
    ${t.root ? `<span class="chip chip-root">${escapeHtml(t.root)} <small>(root)</small></span>` : ''}
    ${t.suffix ? `<span class="chip chip-suffix">${escapeHtml(t.suffix)} <small>(suffix)</small></span>` : ''}
  </div>`;
  html += wordPartsBlock(t);
  html += '<div class="media">';
  if (audioUrl) html += audioPlayer(audioUrl);
  if (imgUrl) html += `<img src="${imgUrl}" alt="${escapeHtml(t.word)}" loading="lazy" />`;
  html += '</div>';
  detailBody.innerHTML = html;
  detail.showModal();
}

/* ---------- wiring ---------- */
$('#closeDetail').addEventListener('click', () => detail.close());
detail.addEventListener('click', (e) => { if (e.target === detail) detail.close(); });

$('#search').addEventListener('input', applyFilters);
$('#levelFilter').addEventListener('change', applyFilters);
$('#catFilter').addEventListener('change', applyFilters);

$('#modeBrowser').addEventListener('click', () => {
  document.querySelectorAll('.navbtn').forEach(b=>b.classList.remove('active'));
  $('#modeBrowser').classList.add('active');
  $('#browserView').hidden = false;
  $('#testView').hidden = true;
  $('#duoView').hidden = true;
  $('#spacedView').hidden = true;
});

const showWodBtn = $('#showWodBtn');
if (showWodBtn) {
  showWodBtn.addEventListener('click', () => {
    localStorage.removeItem('wodDismissedDate');
    showWodBtn.hidden = true;
    if (state.wodTerms) renderWod();
  });
}

function launchConfetti() {
  const container = document.createElement('div');
  container.className = 'confetti-container';
  document.body.appendChild(container);
  const colors = ['#f43f5e','#f59e0b','#22c55e','#3b82f6','#a855f7','#14b8a6','#ec4899'];
  for (let i = 0; i < 120; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti';
    piece.style.left = (Math.random()*100) + 'vw';
    piece.style.background = colors[Math.floor(Math.random()*colors.length)];
    piece.style.animationDelay = (Math.random()*0.25) + 's';
    container.appendChild(piece);
  }
  setTimeout(() => container.remove(), 3200);
}

/* Settings */
const settingsBtn = $('#settingsBtn');
if (settingsBtn) settingsBtn.addEventListener('click', () => {
  const d = $('#settingsDialog');
  if (d) d.showModal();
});
const closeSettings = $('#closeSettings');
if (closeSettings) closeSettings.addEventListener('click', () => {
  const d = $('#settingsDialog'); if (d) d.close();
});
const exportDataBtn = $('#exportDataBtn');
if (exportDataBtn) exportDataBtn.addEventListener('click', () => {
  const data = {};
  for (let i=0;i<localStorage.length;i++){
    const k = localStorage.key(i);
    try { data[k]=JSON.parse(localStorage.getItem(k)); }
    catch(e){ data[k]=localStorage.getItem(k); }
  }
  const blob = new Blob([JSON.stringify(data,null,2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'mt-explorer-user-data.json';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  const st = $('#settingsStatus'); if (st) st.textContent = 'Exported successfully.';
});
const importDataBtn = $('#importDataBtn');
const importFile = $('#importFile');
if (importDataBtn && importFile) {
  importDataBtn.addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!confirm('Importing will overwrite existing local progress. Continue?')) return;
        Object.keys(data).forEach(k => {
          const v = data[k];
          localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
        });
        const st2 = $('#settingsStatus'); if (st2) st2.textContent = 'Imported. Refresh the page to see changes.';
      } catch (err) {
        const st2 = $('#settingsStatus'); if (st2) st2.textContent = 'Import failed: ' + err.message;
      }
    };
    reader.readAsText(file);
    importFile.value = '';
  });
}

const generatePdfBtn = $('#generatePdfBtn');
if (generatePdfBtn) generatePdfBtn.addEventListener('click', () => {
  const checked = [...document.querySelectorAll('#settingsDialog input[type="checkbox"]:checked')].map(cb => cb.value);
  let body = `<h1>Medical Terminology Explorer Report</h1><p>Generated ${new Date().toLocaleString()}</p>`;
  if (checked.includes('test')) {
    const sessions = JSON.parse(localStorage.getItem('mtTestSessions') || '[]');
    body += '<h2>Practice Test</h2>';
    if (!sessions.length) body += '<p>No saved sessions.</p>';
    else sessions.forEach((sess, i) => {
      body += `<h3>Session ${i+1} — ${new Date(sess.createdAt).toLocaleString()} — ${sess.score}/${sess.total}${sess.timeExpired ? ' (time expired)' : ''}</h3><ul>`;
      (sess.items || []).forEach(it => {
        body += `<li>${escapeHtml(it.prompt)} — your answer: ${escapeHtml(it.userAnswer || '(none)')} — correct: ${escapeHtml(it.correctAnswer)} ${it.awarded ? '✔' : '✘'}</li>`;
      });
      body += '</ul>';
    });
  }
  if (checked.includes('spaced')) {
    const sr = JSON.parse(localStorage.getItem('srData') || '{}');
    const hist = JSON.parse(localStorage.getItem('srHistory') || '[]');
    body += `<h2>Spaced Repetition</h2><p>Cards tracked: ${Object.keys(sr).length}</p><ul>`;
    Object.entries(sr).forEach(([w,d]) => { body += `<li>${escapeHtml(w)} — box ${d.box}, next review ${new Date(d.next).toLocaleString()}</li>`; });
    body += '</ul><h3>Review history (latest 50)</h3><ul>';
    hist.slice(0,50).forEach(h => { body += `<li>${new Date(h.time).toLocaleString()} — ${escapeHtml(h.word)} — ${escapeHtml(h.rating)}</li>`; });
    body += '</ul>';
  }
  if (checked.includes('wod')) {
    const w = (typeof getWod === 'function') ? getWod() : null;
    if (w) {
      body += `<h2>Word of the Day</h2><p><strong>${escapeHtml(w.word)}</strong></p><div>${w.meaning_uk || ''}</div><p>Formation: ${escapeHtml(w.formation || '')}</p>`;
    } else {
      body += '<h2>Word of the Day</h2><p>Not available.</p>';
    }
  }
  if (checked.includes('duo')) {
    body += '<h2>Duolingo</h2>';
    if (typeof duoState !== 'undefined') {
      body += `<p>Score: ${duoState.score} • Streak: ${duoState.streak}</p>`;
    } else {
      body += '<p>No session data available.</p>';
    }
  }
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>MT Explorer Report</title><style>body{font-family:Arial,sans-serif;padding:20px;line-height:1.5} h1{color:#2563eb} h2{margin-top:1.5rem;border-bottom:1px solid #ccc;padding-bottom:.25rem} @media print{button{display:none}}</style></head><body>${body}<button onclick="window.print()">Print / Save as PDF</button></body></html>`;
  const w = window.open('', '_blank');
  if (!w) { alert('Popup blocked. Please allow popups for this site.'); return; }
  w.document.open(); w.document.write(html); w.document.close();
  setTimeout(() => w.print(), 600);
});


function audioPlayer(url, label) {
  return `<div class="audioplayer">
    <button type="button" class="playbtn" data-audio="${escapeHtml(url)}">▶ Play</button>
    ${label ? `<span class="muted">${escapeHtml(label)}</span>` : ''}
    <audio hidden preload="none" src="${escapeHtml(url)}"></audio>
  </div>`;
}
document.addEventListener('click', (e) => {
  const btn = e.target.closest && e.target.closest('.playbtn');
  if (!btn) return;
  const container = btn.closest('.audioplayer');
  const audio = container && container.querySelector('audio');
  if (!audio) return;
  if (audio.paused) { audio.play().catch(()=>{}); btn.textContent = '⏸ Pause'; }
  else { audio.pause(); btn.textContent = '▶ Play'; }
  audio.onended = () => { btn.textContent = '▶ Play'; };
});
const helpBtn = $('#helpBtn');
if (helpBtn) helpBtn.addEventListener('click', () => { const d = $('#helpDialog'); if (d) d.showModal(); });
const closeHelp = $('#closeHelp');
if (closeHelp) closeHelp.addEventListener('click', () => { const d = $('#helpDialog'); if (d) d.close(); });

load();
