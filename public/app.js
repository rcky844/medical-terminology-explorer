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

/* ---------------- Practice Test ---------------- */
function pick(arr, n) {
  const copy = arr.slice();
  const out = [];
  while (out.length < n && copy.length) {
    const i = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(i, 1)[0]);
  }
  return out;
}
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function stressIndex(t) {
  const html = t.wordStress_uk || t.wordStress_us;
  if (!html) return null;
  const m = html.match(/<strong>(.*?)<\/strong>/);
  if (!m) return null;
  const chunks = html.replace(/<\/?p>/g, '').split(/<\/?strong>/).filter(Boolean);
  const idx = chunks.findIndex(c => c === m[1]);
  return { idx, chunks: chunks.length };
}
function makeOddQuestion(type) {
  const terms = state.terms;
  let attempts = 0;
  while (attempts++ < 200) {
    if (type === 'syllables') {
      const counts = {};
      terms.forEach(t => { counts[t.syllableNo] = counts[t.syllableNo] || []; counts[t.syllableNo].push(t); });
      const validCounts = Object.keys(counts).filter(k => counts[k].length >= 2);
      if (validCounts.length < 2) return null;
      const c1 = validCounts[Math.floor(Math.random()*validCounts.length)];
      let c2 = validCounts[Math.floor(Math.random()*validCounts.length)];
      while (c2 === c1) c2 = validCounts[Math.floor(Math.random()*validCounts.length)];
      const samePair = pick(counts[c1], 2);
      const odd = pick(counts[c2], 1)[0];
      const options = shuffle([samePair[0], samePair[1], odd]);
      return { prompt: 'Which word has a different number of syllables?', options, answer: odd.word,
        explanation: odd.word + ' has ' + odd.syllableNo + ' syllables; the others have ' + c1 + '.' };
    }
    if (type === 'sound') {
      const groups = {};
      terms.forEach(t => { const k = (t.word[0] || '').toLowerCase(); groups[k] = groups[k] || []; groups[k].push(t); });
      const valid = Object.keys(groups).filter(k => groups[k].length >= 2);
      if (valid.length < 2) return null;
      const g1 = valid[Math.floor(Math.random()*valid.length)];
      let g2 = valid[Math.floor(Math.random()*valid.length)];
      while (g2 === g1) g2 = valid[Math.floor(Math.random()*valid.length)];
      const samePair = pick(groups[g1], 2);
      const odd = pick(groups[g2], 1)[0];
      const options = shuffle([samePair[0], samePair[1], odd]);
      return { prompt: 'Which word begins with a different sound (initial letter)?', options, answer: odd.word,
        explanation: odd.word + ' begins with "' + odd.word[0].toUpperCase() + '"; the others begin with "' + g1.toUpperCase() + '".' };
    }
    if (type === 'stress') {
      const groups = {};
      terms.forEach(t => {
        const si = stressIndex(t);
        if (!si || si.idx < 0) return;
        const key = si.idx + '/' + si.chunks;
        groups[key] = groups[key] || [];
        groups[key].push(t);
      });
      const valid = Object.keys(groups).filter(k => groups[k].length >= 2);
      if (valid.length < 2) return null;
      const g1 = valid[Math.floor(Math.random()*valid.length)];
      let g2 = valid[Math.floor(Math.random()*valid.length)];
      while (g2 === g1) g2 = valid[Math.floor(Math.random()*valid.length)];
      const samePair = pick(groups[g1], 2);
      const odd = pick(groups[g2], 1)[0];
      const options = shuffle([samePair[0], samePair[1], odd]);
      return { prompt: 'Which word has a different stress pattern (stress on a different syllable)?', options, answer: odd.word,
        explanation: 'Stress position differs for ' + odd.word + '.' };
    }
  }
  return null;
}

function generateTest() {
  const terms = state.terms.filter(t => t.word && t.meaning_uk);
  const sec1 = pick(terms, 5).map(t => ({ type: 'defOfTerm', term: t, points: 2 }));
  const sec2 = pick(terms, 5).map(t => ({ type: 'termOfDef', term: t, points: 2 }));
  const oddTypes = ['syllables','syllables','syllables','sound','sound','stress','stress','stress','syllables','stress'];
  const oddQs = [];
  let tries = 0;
  while (oddQs.length < 10 && tries++ < 500) {
    const q = makeOddQuestion(oddTypes[oddQs.length] || 'syllables');
    if (q) oddQs.push({ type: 'odd', q, points: 2 });
  }
  state.test = { sec1, sec2, oddQs, generatedAt: Date.now() };
  renderTest();
}

function renderTest() {
  const body = $('#testBody');
  body.innerHTML = '';
  if (!state.test) return;
  const { sec1, sec2, oddQs } = state.test;
  let idx = 0;
  body.insertAdjacentHTML('beforeend', '<div class="sectiontitle">Section 1: Write a definition of the following medical terms (10 points)</div>');
  sec1.forEach((q, i) => {
    idx++;
    const el = document.createElement('div');
    el.className = 'question';
    el.innerHTML = `
      <h3>Q${idx} (2 marks)</h3>
      <div class="prompt"><strong>${escapeHtml(q.term.word)}</strong></div>
      <input type="text" class="s1input" placeholder="Your definition…" />
      <div class="answer hidden" id="s1ans-${i}"></div>
      <div class="selfmark">
        <label><input type="checkbox" class="selfok" /> I got this correct</label>
      </div>`;
    body.appendChild(el);
  });
  body.insertAdjacentHTML('beforeend', '<div class="sectiontitle">Section 2: Give the medical term for the following definitions (10 points)</div>');
  sec2.forEach((q, i) => {
    idx++;
    const el = document.createElement('div');
    el.className = 'question';
    el.innerHTML = `
      <h3>Q${idx} (2 marks)</h3>
      <div class="prompt">${q.term.meaning_uk}</div>
      <input type="text" class="s2input" placeholder="Medical term…" />
      <div class="answer hidden" id="s2ans-${i}"></div>`;
    body.appendChild(el);
  });
  body.insertAdjacentHTML('beforeend', '<div class="sectiontitle">Section 3: Odd one out (10 questions, 2 marks each)</div>');
  oddQs.forEach((q, i) => {
    idx++;
    const optionsHtml = q.q.options.map((t) =>
      `<button class="option" data-word="${escapeHtml(t.word)}">${escapeHtml(t.word)}</button>`).join('');
    const el = document.createElement('div');
    el.className = 'question';
    el.innerHTML = `
      <h3>Q${idx} (2 marks)</h3>
      <div class="prompt">${escapeHtml(q.q.prompt)}</div>
      <div class="options">${optionsHtml}</div>
      <div class="answer hidden" id="s3ans-${i}"></div>`;
    body.appendChild(el);
    el.querySelectorAll('.option').forEach(btn => {
      btn.addEventListener('click', () => {
        el.querySelectorAll('.option').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
    });
  });
  $('#score').textContent = '';
}

function gradeTest() {
  if (!state.test) return;
  const { sec1, sec2, oddQs } = state.test;
  const questions = document.querySelectorAll('#testBody .question');
  let qi = 0, score = 0;
  sec1.forEach((q, i) => {
    const qEl = questions[qi++];
    const cb = qEl.querySelector('.selfok');
    const parts = wordPartsSummary(q.term);
    const ansEl = document.getElementById('s1ans-' + i);
    ansEl.classList.remove('hidden');
    ansEl.innerHTML = `Expected: ${q.term.meaning_uk}` + (parts ? `<br><em>Word parts: ${escapeHtml(parts)}</em>` : '');
    if (cb && cb.checked) score += q.points;
  });
  sec2.forEach((q, i) => {
    const qEl = questions[qi++];
    const inp = qEl.querySelector('.s2input');
    const ansEl = document.getElementById('s2ans-' + i);
    ansEl.classList.remove('hidden');
    const val = (inp.value || '').trim().toLowerCase();
    const correct = val && val === q.term.word.toLowerCase();
    if (correct) score += q.points;
    const parts = wordPartsSummary(q.term);
    ansEl.innerHTML = `Expected: <strong>${escapeHtml(q.term.word)}</strong>` + (correct ? '' : ' — check your answer') +
      (parts ? `<br><em>Word parts: ${escapeHtml(parts)}</em>` : '');
  });
  oddQs.forEach((q, i) => {
    const qEl = questions[qi++];
    const selBtn = qEl.querySelector('.option.selected');
    const ansEl = document.getElementById('s3ans-' + i);
    ansEl.classList.remove('hidden');
    const selectedWord = selBtn ? selBtn.getAttribute('data-word') : null;
    qEl.querySelectorAll('.option').forEach(b => {
      const w = b.getAttribute('data-word');
      if (w === q.q.answer) b.classList.add('correct');
      else if (b.classList.contains('selected')) b.classList.add('wrong');
    });
    ansEl.textContent = q.q.explanation;
    if (selectedWord && selectedWord === q.q.answer) score += q.points;
  });
  const total = sec1.length*2 + sec2.length*2 + oddQs.length*2;
  const el = $('#score');
  el.textContent = `Score: ${score} / ${total}`;
  el.classList.add('result');
}


/* ---------------- Duolingo Mode ---------------- */
const duoState = { score: 0, streak: 0, kind: null, questions: [], qi: 0, current: null };

function duoShowMenu() {
  duoState.kind = null;
  const area = $('#duoArea'); area.innerHTML = '';
  const menu = $('#duoMenu');
  menu.innerHTML = `
    <div class="duocards">
      <button class="duocard" data-kind="choosing"><h3>Choosing</h3><p>Find the correct suffix / root / prefix</p><span class="tag">+10 pts</span></button>
      <button class="duocard" data-kind="finding"><h3>Finding</h3><p>Find the correct meaning</p><span class="tag">+10 pts</span></button>
      <button class="duocard" data-kind="matching"><h3>Matching</h3><p>Match terms to definitions</p><span class="tag">+10 pts</span></button>
      <button class="duocard" data-kind="spelling"><h3>Spelling</h3><p>Listen and fill the answer</p><span class="tag">+10 pts</span></button>
      <button class="duocard" data-kind="mixed"><h3>Mixed</h3><p>All types combined</p><span class="tag">+10 pts</span></button>
    </div>`;
  menu.querySelectorAll('.duocard').forEach(b => b.addEventListener('click', () => startDuo(b.dataset.kind)));
  updateDuoStats();
}

function updateDuoStats() {
  const sc = $('#duoScore'); if (sc) sc.textContent = `Score: ${duoState.score}`;
  const st = $('#duoStreak'); if (st) st.textContent = `Streak: ${duoState.streak} 🔥`;
}

function buildDuoQuestions(kind, n=8) {
  const terms = state.terms.filter(t => t.word && (t.meaning_uk || t.meaning_us));
  const qs = [];
  const kinds = kind === 'mixed' ? ['choosing','finding','spelling'] : [kind];
  let guard = 0;
  while (qs.length < n && guard++ < n*50) {
    const k = kinds[Math.floor(Math.random()*kinds.length)];
    if (k === 'spelling') {
      const t = terms[Math.floor(Math.random()*terms.length)];
      if (!t.sound_uk) continue;
      qs.push({ kind:'spelling', term: t });
    } else if (k === 'finding') {
      const t = terms[Math.floor(Math.random()*terms.length)];
      const opts = pick(terms,4); if (!opts.includes(t)) { opts[0]=t; }
      qs.push({ kind:'finding', term: t, options: shuffle(opts) });
    } else if (k === 'choosing') {
      const t = terms[Math.floor(Math.random()*terms.length)];
      const types = ['prefix','root','suffix'].filter(x => t[x]);
      if (!types.length) continue;
      const partKind = types[Math.floor(Math.random()*types.length)];
      const otherVals = [...new Set(terms.map(x=>x[partKind]).filter(Boolean).filter(v=>v!==t[partKind]))];
      const distr = pick(otherVals,3);
      qs.push({ kind:'choosing', term:t, partKind, options: shuffle([t[partKind], ...distr]) });
    } else if (k === 'matching') {
      const sample = pick(terms,4);
      qs.push({ kind:'matching', terms: sample, defs: shuffle(sample.slice()) });
    }
  }
  return qs;
}

function startDuo(kind) {
  duoState.kind = kind;
  duoState.score = 0;
  duoState.streak = 0;
  if (kind === 'matching') {
    duoState.questions = [{ kind:'matching' }];
  } else {
    duoState.questions = buildDuoQuestions(kind, 8);
  }
  duoState.qi = 0;
  $('#duoMenu').innerHTML = '';
  renderDuoQuestion();
}

function renderDuoQuestion() {
  updateDuoStats();
  const area = $('#duoArea'); area.innerHTML = '';
  if (duoState.qi >= duoState.questions.length) {
    area.innerHTML = `<div class="question"><h3>Round complete!</h3><p class="result">Final score: ${duoState.score}</p><button class="btn" id="duoBack">Back to menu</button></div>`;
    const b = $('#duoBack'); if (b) b.addEventListener('click', duoShowMenu);
    return;
  }
  const q = duoState.questions[duoState.qi];
  duoState.current = q;
  if (q.kind === 'finding') {
    const opts = q.options.map(t => `<button class="option duo-opt" data-word="${escapeHtml(t.word)}">${escapeHtml(stripHtml(t.meaning_uk||t.meaning_us||''))}</button>`).join('');
    area.innerHTML = `<div class="question">
      <h3>Find the meaning</h3>
      <div class="prompt">Term: <strong>${escapeHtml(q.term.word)}</strong></div>
      <div class="options">${opts}</div>
      <div class="answer hidden" id="duoAns"></div>
    </div>`;
    area.querySelectorAll('.duo-opt').forEach(b => b.addEventListener('click', () => answerDuo(b, q.term.word, 'word')));
  } else if (q.kind === 'choosing') {
    const label = q.partKind === 'prefix' ? 'prefix' : q.partKind === 'root' ? 'root' : 'suffix';
    const opts = q.options.map(v => `<button class="option duo-opt" data-val="${escapeHtml(v)}">${escapeHtml(v)}</button>`).join('');
    area.innerHTML = `<div class="question">
      <h3>Choosing: find the correct ${label}</h3>
      <div class="prompt">For term: <strong>${escapeHtml(q.term.word)}</strong></div>
      <div class="options">${opts}</div>
      <div class="answer hidden" id="duoAns"></div>
    </div>`;
    area.querySelectorAll('.duo-opt').forEach(b => b.addEventListener('click', () => answerDuoChoosing(b, q)));
  } else if (q.kind === 'spelling') {
    const url = q.term.sound_uk ? `https://medterms.hku.hk/storage/audio/mtlist/${encodeURIComponent(q.term.sound_uk)}` : null;
    area.innerHTML = `<div class="question">
      <h3>Spelling: listen and type</h3>
      ${url ? `<audio controls src="${url}"></audio>` : ''}
      <input id="duoSpell" type="text" placeholder="Type the term…" />
      <div style="margin-top:.5rem"><button class="btn" id="duoSpellBtn">Check</button></div>
      <div class="answer hidden" id="duoAns"></div>
    </div>`;
    $('#duoSpellBtn').addEventListener('click', () => checkDuoSpelling(q));
  } else if (q.kind === 'matching') {
    const pairs = buildDuoQuestions('finding', 4).map(x=>x.term);
    // fallback: render finding-like
    const t = pairs[0];
    area.innerHTML = `<div class="question"><h3>Matching</h3><p>Matching mini-game not available; try another category.</p><button class="btn" id="duoNext">Next</button></div>`;
    $('#duoNext').addEventListener('click', () => { duoState.qi++; renderDuoQuestion(); });
  }
}

function answerDuo(btn, correctWord, mode) {
  const isCorrect = btn.dataset.word === correctWord;
  markDuoAnswer(btn, isCorrect);
}

function answerDuoChoosing(btn, q) {
  const isCorrect = btn.dataset.val === q.term[q.partKind];
  markDuoAnswer(btn, isCorrect);
}

function markDuoAnswer(btn, isCorrect) {
  const area = $('#duoArea');
  area.querySelectorAll('.option').forEach(b => b.style.pointerEvents='none');
  if (isCorrect) { btn.classList.add('correct'); duoState.score += 10; duoState.streak++; }
  else { btn.classList.add('wrong'); duoState.streak = 0;
    const correctVal = duoState.current.kind==='finding' ? duoState.current.term.word : (duoState.current.kind==='choosing' ? duoState.current.term[duoState.current.partKind] : '');
    area.querySelectorAll('.option').forEach(b => { if ((b.dataset.word||b.dataset.val) === correctVal) b.classList.add('correct'); });
  }
  const ans = $('#duoAns'); if (ans) { ans.classList.remove('hidden'); ans.innerHTML = isCorrect ? 'Correct! +10' : `Answer: ${escapeHtml(duoState.current.kind==='finding'?duoState.current.term.word:duoState.current.term[duoState.current.partKind])}`; }
  updateDuoStats();
  setTimeout(() => { duoState.qi++; renderDuoQuestion(); }, 1200);
}

function checkDuoSpelling(q) {
  const val = ($('#duoSpell').value||'').trim().toLowerCase();
  const correct = val === q.term.word.toLowerCase();
  const ans = $('#duoAns'); ans.classList.remove('hidden');
  if (correct) { duoState.score += 10; duoState.streak++; ans.textContent = 'Correct! +10'; }
  else { duoState.streak = 0; ans.innerHTML = `Correct: <strong>${escapeHtml(q.term.word)}</strong>`; }
  updateDuoStats();
  setTimeout(() => { duoState.qi++; renderDuoQuestion(); }, 1500);
}

/* ---------- wiring ---------- */
$('#closeDetail').addEventListener('click', () => detail.close());
detail.addEventListener('click', (e) => { if (e.target === detail) detail.close(); });
$('#search').addEventListener('input', applyFilters);
$('#levelFilter').addEventListener('change', applyFilters);
$('#catFilter').addEventListener('change', applyFilters);
$('#modeBrowser').addEventListener('click', () => {
  $('#modeBrowser').classList.add('active');
  $('#modeTest').classList.remove('active');
  $('#modeDuo').classList.remove('active');
  $('#browserView').hidden = false;
  $('#testView').hidden = true;
  $('#duoView').hidden = true;
});
$('#modeTest').addEventListener('click', () => {
  $('#modeTest').classList.add('active');
  $('#modeBrowser').classList.remove('active');
  $('#browserView').hidden = true;
  $('#testView').hidden = false;
  $('#duoView').hidden = true;
  if (!state.test) generateTest();
});
$('#modeDuo').addEventListener('click', () => {
  $('#modeDuo').classList.add('active');
  $('#modeBrowser').classList.remove('active');
  $('#modeTest').classList.remove('active');
  $('#browserView').hidden = true;
  $('#testView').hidden = true;
  $('#duoView').hidden = false;
  duoShowMenu();
});
$('#genTest').addEventListener('click', generateTest);
$('#checkTest').addEventListener('click', gradeTest);
const showWodBtn = $('#showWodBtn');
if (showWodBtn) {
  showWodBtn.addEventListener('click', () => {
    localStorage.removeItem('wodDismissedDate');
    showWodBtn.hidden = true;
    if (state.wodTerms) renderWod();
  });
}

load();