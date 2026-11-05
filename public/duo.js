/* ---------------- Duolingo Mode ---------------- */
const duoState = { score: 0, streak: 0, kind: null, questions: [], qi: 0, current: null };

function duoShowMenu() {
  duoState.kind = null;
  const area = $('#duoArea'); area.innerHTML = '';
  const menu = $('#duoMenu');
  menu.innerHTML = `
    <div class="duocards">
      <button class="duocard" data-kind="choosing"><h3>Choosing</h3><p>Find the correct suffix / root / prefix</p><span class="tag">+10 pts</span></button>
      <button class="duocard" data-kind="finding"><h3>Finding</h3><p>Find the correct word/meaning</p><span class="tag">+10 pts</span></button>
      <button class="duocard" data-kind="guessing"><h3>Guessing</h3><p>Guess the number of syllables</p><span class="tag">+10 pts</span></button>
      <button class="duocard" data-kind="spelling"><h3>Spelling</h3><p>Listen and fill the answer</p><span class="tag">+10 pts</span></button>
      <button class="duocard" data-kind="matching"><h3>Matching</h3><p>Match the meaning of a thematic group</p><span class="tag">+10 pts</span></button>
      <button class="duocard" data-kind="mixed"><h3>Mixed</h3><p>All types combined</p><span class="tag">+10 pts</span></button>
    </div>`;
  menu.querySelectorAll('.duocard').forEach(b => b.addEventListener('click', () => startDuo(b.dataset.kind)));
  updateDuoStats();
}

function updateDuoStats() {
  const sc = $('#duoScore'); if (sc) sc.textContent = `Score: ${duoState.score}`;
  const st = $('#duoStreak'); if (st) st.textContent = `Streak: ${duoState.streak}`;
}

function buildDuoQuestions(kind, n=8) {
  const terms = state.terms.filter(t => t.word && (t.meaning_uk || t.meaning_us));
  const qs = [];
  const kinds = kind === 'mixed' ? ['choosing','finding','guessing','spelling'] : [kind];
  let guard = 0;
  while (qs.length < n && guard++ < n*80) {
    const k = kinds[Math.floor(Math.random()*kinds.length)];
    if (k === 'spelling') {
      const t = terms[Math.floor(Math.random()*terms.length)];
      if (!t.sound_uk) continue;
      qs.push({ kind:'spelling', term: t });
    } else if (k === 'finding') {
      const t = terms[Math.floor(Math.random()*terms.length)];
      const opts = pick(terms,4); if (!opts.includes(t)) opts[0] = t;
      const reverse = Math.random() < 0.5;
      qs.push({ kind:'finding', term: t, options: shuffle(opts), reverse });
    } else if (k === 'guessing') {
      const t = terms[Math.floor(Math.random()*terms.length)];
      const target = Number(t.syllableNo);
      if (!Number.isFinite(target)) continue;
      const offset = Math.floor(Math.random() * 3); // 0,1,2 -> start target-2,-1,0
      let start = Math.max(1, target - 2 + offset);
      const opts = [];
      for (let i = 0; i < 4; i++) opts.push(String(start + i));
      // ensure the correct answer is included
      if (!opts.includes(String(target))) opts[Math.floor(Math.random()*opts.length)] = String(target);
      qs.push({ kind: 'guessing', term: t, answer: String(target), options: shuffle(opts) });
    } else if (k === 'choosing') {
      const t = terms[Math.floor(Math.random()*terms.length)];
      const types = ['prefix','root','suffix'].filter(x => t[x]);
      if (!types.length) continue;
      const partKind = types[Math.floor(Math.random()*types.length)];
      const otherVals = [...new Set(terms.map(x=>x[partKind]).filter(Boolean).filter(v=>v!==t[partKind]))];
      const distr = pick(otherVals,3);
      qs.push({ kind:'choosing', term:t, partKind, options: shuffle([t[partKind], ...distr]) });
    }
  }
  return qs;
}

function startDuo(kind) {
  duoState.kind = kind;
  duoState.score = 0;
  duoState.streak = 0;
  if (kind === 'matching') {
    duoState.questions = [{ kind: 'matching' }];
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
    if (q.reverse) {
      const opts = q.options.map(t => `<button class="option duo-opt" data-word="${escapeHtml(t.word)}">${escapeHtml(t.word)}</button>`).join('');
      area.innerHTML = `<div class="question">
        <h3>Finding: correct word</h3>
        <div class="prompt">Meaning: <strong>${escapeHtml(stripHtml(q.term.meaning_uk||q.term.meaning_us||''))}</strong></div>
        <div class="options">${opts}</div>
        <div class="answer hidden" id="duoAns"></div>
      </div>`;
    } else {
      const opts = q.options.map(t => `<button class="option duo-opt" data-word="${escapeHtml(t.word)}">${escapeHtml(stripHtml(t.meaning_uk||t.meaning_us||''))}</button>`).join('');
      area.innerHTML = `<div class="question">
        <h3>Finding: correct meaning</h3>
        <div class="prompt">Term: <strong>${escapeHtml(q.term.word)}</strong></div>
        <div class="options">${opts}</div>
        <div class="answer hidden" id="duoAns"></div>
      </div>`;
    }
    area.querySelectorAll('.duo-opt').forEach(b => b.addEventListener('click', () => answerFinding(b, q.term.word)));
  } else if (q.kind === 'guessing') {
    const opts = q.options.map(v => `<button class="option duo-opt" data-val="${escapeHtml(v)}">${escapeHtml(v)}</button>`).join('');
    area.innerHTML = `<div class="question">
      <h3>Guessing: number of syllables</h3>
      <div class="prompt">Term: <strong>${escapeHtml(q.term.word)}</strong></div>
      <div class="options">${opts}</div>
      <div class="answer hidden" id="duoAns"></div>
    </div>`;
    area.querySelectorAll('.duo-opt').forEach(b => b.addEventListener('click', () => answerGuessing(b, q.answer)));
  } else if (q.kind === 'choosing') {
    const label = q.partKind;
    const opts = q.options.map(v => `<button class="option duo-opt" data-val="${escapeHtml(v)}">${escapeHtml(v)}</button>`).join('');
    area.innerHTML = `<div class="question">
      <h3>Choosing: correct ${label}</h3>
      <div class="prompt">For: <strong>${escapeHtml(q.term.word)}</strong></div>
      <div class="options">${opts}</div>
      <div class="answer hidden" id="duoAns"></div>
    </div>`;
    area.querySelectorAll('.duo-opt').forEach(b => b.addEventListener('click', () => answerChoosing(b, q)));
  } else if (q.kind === 'matching') {
    renderMatching();
  } else if (q.kind === 'spelling') {
    const url = q.term.sound_uk ? `https://medterms.hku.hk/storage/audio/mtlist/${encodeURIComponent(q.term.sound_uk)}` : null;
    area.innerHTML = `<div class="question">
      <h3>Spelling: listen and type</h3>
      ${url ? audioPlayer(url,'Listen') : ''}
      <input id="duoSpell" type="text" placeholder="Type the term…" />
      <div style="margin-top:.5rem"><button class="btn" id="duoSpellBtn">Check</button></div>
      <div class="answer hidden" id="duoAns"></div>
    </div>`;
    const btn = $('#duoSpellBtn');
    if (btn) btn.addEventListener('click', () => checkDuoSpelling(q));
  }
}

function renderMatching() {
  const terms = state.terms.filter(t => t.word && (t.meaning_uk || t.meaning_us));
  // thematic group: same category with >=4 terms
  const groups = {};
  terms.forEach(t => { (groups[t.catId] = groups[t.catId] || []).push(t); });
  const valid = Object.keys(groups).filter(k => groups[k].length >= 4);
  let group = valid.length ? groups[valid[Math.floor(Math.random()*valid.length)]] : terms;
  const sample = pick(group, 4);
  const defs = shuffle(sample.slice());

  const area = $('#duoArea');
  let selectedTerm = null;
  let matched = 0;
  const total = sample.length;

  function html() {
    const left = sample.map(t => `<button class="match-item" data-side="term" data-id="${escapeHtml(t.word)}">${escapeHtml(t.word)}</button>`).join('');
    const right = defs.map(t => `<button class="match-item" data-side="def" data-id="${escapeHtml(t.word)}">${escapeHtml(stripHtml(t.meaning_uk || t.meaning_us))}</button>`).join('');
    return `<div class="question"><h3>Matching: thematic group</h3><p class="muted">Match each term to its meaning.</p><div class="matchgrid"><div class="matchcol">${left}</div><div class="matchcol">${right}</div></div><div id="duoAns" class="answer hidden"></div></div>`;
  }
  area.innerHTML = html();

  const handler = (btn) => {
    if (btn.classList.contains('matched')) return;
    if (btn.dataset.side === 'term') {
      area.querySelectorAll('[data-side="term"]').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedTerm = btn.dataset.id;
    } else {
      if (!selectedTerm) return;
      const defId = btn.dataset.id;
      if (defId === selectedTerm) {
        area.querySelectorAll(`[data-id="${CSS.escape(selectedTerm)}"]`).forEach(b => { b.classList.remove('selected'); b.classList.add('matched'); b.disabled = true; });
        matched += 1;
        duoState.score += 10;
        duoState.streak += 1;
        updateDuoStats();
        if (matched === total) {
          const ans = $('#duoAns'); if (ans) { ans.classList.remove('hidden'); ans.innerHTML = 'All matched! +10 each'; }
          setTimeout(() => { duoState.qi += 1; renderDuoQuestion(); }, 1200);
        }
      } else {
        btn.classList.add('wrong');
        duoState.streak = 0;
        updateDuoStats();
        setTimeout(() => btn.classList.remove('wrong'), 600);
      }
      selectedTerm = null;
      area.querySelectorAll('[data-side="term"]').forEach(b => b.classList.remove('selected'));
    }
  };
  area.querySelectorAll('.match-item').forEach(b => b.addEventListener('click', () => handler(b)));
}

function finishDuoAnswer(correct, answerText) {
  const area = $('#duoArea');
  area.querySelectorAll('.option').forEach(b => b.style.pointerEvents = 'none');
  if (correct) { duoState.score += 10; duoState.streak += 1; if (duoState.streak % 5 === 0) launchConfetti(); }
  else { duoState.streak = 0; }
  const ans = $('#duoAns');
  if (ans) { ans.classList.remove('hidden'); ans.innerHTML = correct ? 'Correct! +10' : `Answer: ${escapeHtml(answerText)}`; }
  updateDuoStats();
  setTimeout(() => { duoState.qi += 1; renderDuoQuestion(); }, 900);
}

function answerFinding(btn, correctWord) {
  const isCorrect = btn.dataset.word === correctWord;
  btn.classList.add(isCorrect ? 'correct' : 'wrong');
  if (!isCorrect) {
    areaMarkCorrect('word', correctWord);
  }
  finishDuoAnswer(isCorrect, correctWord);
}
function answerGuessing(btn, correct) {
  const isCorrect = btn.dataset.val === correct;
  btn.classList.add(isCorrect ? 'correct' : 'wrong');
  if (!isCorrect) areaMarkCorrect('val', correct);
  finishDuoAnswer(isCorrect, correct);
}
function answerChoosing(btn, q) {
  const correctVal = q.term[q.partKind];
  const isCorrect = btn.dataset.val === correctVal;
  btn.classList.add(isCorrect ? 'correct' : 'wrong');
  if (!isCorrect) areaMarkCorrect('val', correctVal);
  finishDuoAnswer(isCorrect, correctVal);
}
function areaMarkCorrect(attr, val) {
  const area = $('#duoArea');
  area.querySelectorAll('.option').forEach(b => {
    if (b.getAttribute('data-' + attr) === val) b.classList.add('correct');
  });
}
function checkDuoSpelling(q) {
  const val = ($('#duoSpell')?.value || '').trim().toLowerCase();
  const correct = val === q.term.word.toLowerCase();
  const ans = $('#duoAns');
  if (ans) { ans.classList.remove('hidden'); ans.innerHTML = correct ? 'Correct! +10' : `Correct: <strong>${escapeHtml(q.term.word)}</strong>`; }
  if (correct) { duoState.score += 10; duoState.streak += 1; if (duoState.streak % 5 === 0) launchConfetti(); }
  else { duoState.streak = 0; }
  updateDuoStats();
  setTimeout(() => { duoState.qi += 1; renderDuoQuestion(); }, 1100);
}



$('#modeDuo').addEventListener('click', () => {
  document.querySelectorAll('.navbtn').forEach(b=>b.classList.remove('active'));
  $('#modeDuo').classList.add('active');
  $('#browserView').hidden = true;
  $('#testView').hidden = true;
  $('#duoView').hidden = false;
  $('#spacedView').hidden = true;
  duoShowMenu();
});
