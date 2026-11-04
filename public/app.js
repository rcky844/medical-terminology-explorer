const state = { terms: [], filtered: [] };

const $ = (sel) => document.querySelector(sel);
const grid = $('#grid');
const status = $('#status');
const count = $('#count');
const detail = $('#detail');
const detailBody = $('#detailBody');

function stripHtml(s){ return (s || '').replace(/<[^>]*>/g, ''); }

function decodeBase64(b64) {
  // atob gives a binary string; decode as UTF-8.
  const bin = atob(b64.trim());
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}

async function load() {
  try {
    const res = await fetch('/api/mtlist');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const b64 = await res.text();
    const jsonText = decodeBase64(b64);
    const data = JSON.parse(jsonText);
    state.terms = Array.isArray(data) ? data : [];
    status.hidden = true;
    grid.hidden = false;
    populateFilters();
    applyFilters();
  } catch (err) {
    status.textContent = 'Failed to load terminology list: ' + err.message;
  }
}

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
    ${t.prefix ? `<dt>Prefix</dt><dd>${escapeHtml(t.prefix)}</dd>` : ''}
    ${t.root ? `<dt>Root</dt><dd>${escapeHtml(t.root)}</dd>` : ''}
    ${t.suffix ? `<dt>Suffix</dt><dd>${escapeHtml(t.suffix)}</dd>` : ''}
    ${t.syllableNo ? `<dt>Syllables</dt><dd>${escapeHtml(t.syllableNo)}</dd>` : ''}
    ${t.level ? `<dt>Level</dt><dd>${escapeHtml(t.level)}</dd>` : ''}
    ${t.catId ? `<dt>Category</dt><dd>${escapeHtml(t.catId)}</dd>` : ''}
  </dl>`;
  html += '<div class="media">';
  if (audioUrl) html += `<audio controls src="${audioUrl}"></audio>`;
  if (imgUrl) html += `<img src="${imgUrl}" alt="${escapeHtml(t.word)}" loading="lazy" />`;
  html += '</div>';
  detailBody.innerHTML = html;
  detail.showModal();
}

$('#closeDetail').addEventListener('click', () => detail.close());
detail.addEventListener('click', (e) => { if (e.target === detail) detail.close(); });

$('#search').addEventListener('input', applyFilters);
$('#levelFilter').addEventListener('change', applyFilters);
$('#catFilter').addEventListener('change', applyFilters);

load();