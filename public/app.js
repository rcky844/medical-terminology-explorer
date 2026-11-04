const state = { terms: [], filtered: [], vocab: null, test: null, wodTerms: null };

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

async function fetchBase64(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return decodeBase64(await res.text());
}

async function load() {
  try {
    status.textContent = 'Loading terminology list and word parts…';
    const [termText, vocabText, wodText] = await Promise.all([
      fetchBase64('/api/mtlist'),
      fetchBase64('/api/vocab'),
      fetchBase64('/api/wordofday')
    ]);
    const data = JSON.parse(termText);
    state.terms = Array.isArray(data) ? data : [];
    state.vocab = JSON.parse(vocabText);
    state.wodTerms = JSON.parse(wodText);
    status.hidden = true;
    grid.hidden = false;
    populateFilters();
    applyFilters();
    renderWod();
  } catch (err) {
    status.textContent = 'Failed to load data: ' + err.message;
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
  const n = dayOfYear();
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
  const imgUrl = t.image ? `https://medterms.hku.hk/storage/image/${encodeURIComponent(t.image)}` : null;
  sec.innerHTML = `
    <div class="wodcard">
      <div class="wodhead">
        <h2>Word of the Day</h2>
        <div class="wodactions">
          <button class="wodbtn" id="wodToggle">Collapse</button>
          <button class="wodbtn" id="wodDismiss">Dismiss for today</button>
        </div>
      </div>
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
          ${audioUrl ? `<div><div class="muted" style="margin-bottom:.25rem">Pronunciation</div><audio controls src="${audioUrl}"></audio></div>` : ''}
          ${wodAudioUrl ? `<div><div class="muted" style="margin-bottom:.25rem">Explanation (definition + example)</div><audio controls src="${wodAudioUrl}"></audio></div>` : ''}
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
  cats.forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = 'Category ' + c; catSel.appendChild(o); });
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
        ${t.catId ? `<span class="tag">Cat ${escapeHtml(t.catId)}</span>` : ''}
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
  const imgUrl = t.image ? `https://medterms.hku.hk/storage/image/${encodeURIComponent(t.image)}` : null;

  let html = `<h2 class="detail-title">${escapeHtml(t.word)}</h2>`;
  if (wordStress) html += `<div class="stress">${wordStress}</div>`;
  html += `<div class="meaning-full">${meaning}</div>`;
  html += `<dl class="info-grid">
    ${t.wordtype ? `<dt>Type</dt><dd>${escapeHtml(t.wordtype)}</dd>` : ''}
    ${t.syllableNo ? `<dt>Syllables</dt><dd>${escapeHtml(t.syllableNo)}</dd>` : ''}
    ${t.level ? `<dt>Level</dt><dd><span class="tag">Level ${escapeHtml(t.level)}</span></dd>` : ''}
    ${t.catId ? `<dt>Category</dt><dd><span class="tag">Cat ${escapeHtml(t.catId)}</span></dd>` : ''}
  </dl>`;
  html += `<div class="breakdown">
    ${t.prefix ? `<span class="chip chip-prefix">${escapeHtml(t.prefix)} <small>(prefix)</small></span>` : ''}
    ${t.root ? `<span class="chip chip-root">${escapeHtml(t.root)} <small>(root)</small></span>` : ''}
    ${t.suffix ? `<span class="chip chip-suffix">${escapeHtml(t.suffix)} <small>(suffix)</small></span>` : ''}
  </div>`;
  html += wordPartsBlock(t);
  html += '<div class="media">';
  if (audioUrl) html += `<audio controls src="${audioUrl}"></audio>`;
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
});

const showWodBtn = $('#showWodBtn');
if (showWodBtn) {
  showWodBtn.addEventListener('click', () => {
    localStorage.removeItem('wodDismissedDate');
    showWodBtn.hidden = true;
    if (state.wodTerms) renderWod();
  });
}

load();
