/* ---------------- Duolingo Mode ---------------- */
const duoState = { score: 0, streak: 0, kind: null, questions: [], qi: 0, current: null };

function duoShowMenu() {
  duoState.kind = null;
  const area = $('#duoArea'); area.innerHTML = '';
  const menu = $('#duoMenu');
  menu.innerHTML = `
    <div class="duocards">
      <button class="duocard" data-kind="choosing"><h6>Choosing</h6><p>Find the correct suffix / root / prefix</p><span class="chip">+10 pts</span></button>
      <button class="duocard" data-kind="finding"><h6>Finding</h6><p>Find the correct word/meaning</p><span class="chip">+10 pts</span></button>
      <button class="duocard" data-kind="guessing"><h6>Guessing</h6><p>Guess the stressed part or number of syllables</p><span class="chip">+10 pts</span></button>
      <button class="duocard" data-kind="forming"><h6>Forming</h6><p>Form the word from its roots</p><span class="chip">+10 pts</span></button>
      <button class="duocard" data-kind="wordle"><h6>Wordle</h6><p>Guess the hidden word</p><span class="chip">+10 pts</span></button>
      <button class="duocard" data-kind="spelling"><h6>Spelling</h6><p>Listen and fill the answer</p><span class="chip">+10 pts</span></button>
      <button class="duocard" data-kind="matching"><h6>Matching</h6><p>Match the meaning of a thematic group</p><span class="chip">+10 pts</span></button>
      <button class="duocard" data-kind="mixed"><h6>Mixed</h6><p>All types combined</p><span class="chip">+10 pts</span></button>
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
  const kinds = kind === 'mixed' ? ['choosing','finding','guessing','forming','wordle','spelling'] : [kind];
  let guard = 0;
  while (qs.length < n && guard++ < n*80) {
    const k = kinds[Math.floor(Math.random()*kinds.length)];
    if (k === 'spelling') {
      const t = terms[Math.floor(Math.random()*terms.length)];
      if (!t.sound_uk) continue;
      qs.push({ kind:'spelling', term: t });
    } else if (k === 'wordle') {
      const candidates = terms.filter(t => /^[a-zA-Z]{4,7}$/.test(t.word || ''));
      if (!candidates.length) continue;
      const t = candidates[Math.floor(Math.random()*candidates.length)];
      qs.push({ kind: 'wordle', term: t, answer: String(t.word).toLowerCase(), guesses: [] });
    } else if (k === 'finding') {
      const t = terms[Math.floor(Math.random()*terms.length)];
      const opts = pick(terms,4); if (!opts.includes(t)) opts[0] = t;
      const reverse = Math.random() < 0.5;
      qs.push({ kind:'finding', term: t, options: shuffle(opts), reverse });
    } else if (k === 'guessing') {
      const t = terms[Math.floor(Math.random()*terms.length)];
      const doStress = Math.random() < 0.5;
      if (doStress) {
        const si = (typeof stressIndex === 'function') ? stressIndex(t) : null;
        if (!si) continue;
        const target = si.idx + 1;
        if (target < 1) continue;
        const total = si.chunks;
        const offset = Math.floor(Math.random() * 3);
        let st = Math.max(1, target - 2 + offset);
        const opts = [];
        for (let i = 0; i < 4; i++) opts.push(String(st + i));
        if (!opts.includes(String(target))) opts[0] = String(target);
        qs.push({ kind: 'guessing', sub: 'stress', term: t, answer: String(target), options: shuffle(opts), range: total });
      } else {
        const target = Number(t.syllableNo);
        if (!Number.isFinite(target) || target < 1) continue;
        const offset = Math.floor(Math.random() * 3);
        let start = Math.max(1, target - 2 + offset);
        const opts = [];
        for (let i = 0; i < 4; i++) opts.push(String(start + i));
        if (!opts.includes(String(target))) opts[0] = String(target);
        qs.push({ kind: 'guessing', sub: 'syll', term: t, answer: String(target), options: shuffle(opts) });
      }
    } else if (k === 'forming') {
      const t = terms[Math.floor(Math.random()*terms.length)];
      const parts = [t.prefix, t.root, t.suffix].filter(Boolean);
      if (!parts.length) continue;
      const poolSize = (window.innerWidth <= 600) ? 10 : 20;
      const otherParts = [];
      terms.forEach(x => { [x.prefix, x.root, x.suffix].forEach(v => { if (v && !parts.includes(v)) otherParts.push(v); }); });
      const extras = pick([...new Set(otherParts)], Math.max(0, poolSize - parts.length));
      const pool = shuffle([...parts, ...extras]).map(txt => ({ text: txt, used: false }));
      qs.push({ kind: 'forming', term: t, target: parts.slice(), pool, user: [] });
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
    area.innerHTML = `<article class="question"><h6>Round complete!</h6><p class="result">Final score: ${duoState.score}</p><button class="border" id="duoBack"><i>arrow_back</i><span>Back to menu</span></button></article>`;
    const b = $('#duoBack'); if (b) b.addEventListener('click', duoShowMenu);
    return;
  }
  const q = duoState.questions[duoState.qi];
  duoState.current = q;
  if (q.kind === 'finding') {
    if (q.reverse) {
      const opts = q.options.map(t => `<button class="option duo-opt border" data-word="${escapeHtml(t.word)}">${escapeHtml(t.word)}</button>`).join('');
      area.innerHTML = `<article class="question">
        <h6>Finding: correct word</h6>
        <p class="prompt">Meaning: <strong>${escapeHtml(stripHtml(q.term.meaning_uk||q.term.meaning_us||''))}</strong></p>
        <div class="options">${opts}</div>
        <div class="answer hidden" id="duoAns"></div>
      </article>`;
    } else {
      const opts = q.options.map(t => `<button class="option duo-opt border" data-word="${escapeHtml(t.word)}">${escapeHtml(stripHtml(t.meaning_uk||t.meaning_us||''))}</button>`).join('');
      area.innerHTML = `<article class="question">
        <h6>Finding: correct meaning</h6>
        <p class="prompt">Term: <strong>${escapeHtml(q.term.word)}</strong></p>
        <div class="options">${opts}</div>
        <div class="answer hidden" id="duoAns"></div>
      </article>`;
    }
    area.querySelectorAll('.duo-opt').forEach(b => b.addEventListener('click', () => answerFinding(b, q.term.word)));
  } else if (q.kind === 'guessing') {
    const opts = q.options.map(v => `<button class="option duo-opt border" data-val="${escapeHtml(v)}">${escapeHtml(v)}</button>`).join('');
    const title = q.sub === 'stress' ? 'Guessing: stressed syllable' : 'Guessing: number of syllables';
    area.innerHTML = `<article class="question">
      <h6>${title}</h6>
      <p class="prompt">Term: <strong>${escapeHtml(q.term.word)}</strong></p>
      <div class="options">${opts}</div>
      <div class="answer hidden" id="duoAns"></div>
    </article>`;
    area.querySelectorAll('.duo-opt').forEach(b => b.addEventListener('click', () => answerGuessing(b, q.answer)));
  } else if (q.kind === 'forming') {
    renderForming();
    return;
  } else if (q.kind === 'choosing') {
    const label = q.partKind;
    const opts = q.options.map(v => `<button class="option duo-opt border" data-val="${escapeHtml(v)}">${escapeHtml(v)}</button>`).join('');
    area.innerHTML = `<article class="question">
      <h6>Choosing: correct ${label}</h6>
      <p class="prompt">For: <strong>${escapeHtml(q.term.word)}</strong></p>
      <div class="options">${opts}</div>
      <div class="answer hidden" id="duoAns"></div>
    </article>`;
    area.querySelectorAll('.duo-opt').forEach(b => b.addEventListener('click', () => answerChoosing(b, q)));
  } else if (q.kind === 'matching') {
    renderMatching();
  } else if (q.kind === 'wordle') {
    renderWordle();
    return;
  } else if (q.kind === 'spelling') {
    const url = mtlistAudioUrl(q.term.sound_uk);
    area.innerHTML = `<article class="question">
      <h6>Spelling: listen and type</h6>
      ${url ? audioPlayer(url,'Listen') : ''}
      <div class="inline-form mt">
        <div class="field label border">
          <input id="duoSpell" type="text" placeholder=" " />
          <label>Type the term…</label>
        </div>
        <button id="duoSpellBtn"><i>check</i><span>Check</span></button>
      </div>
      <div class="answer hidden" id="duoAns"></div>
    </article>`;
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
    return `<article class="question"><h6>Matching: thematic group</h6><p class="muted">Match each term to its meaning.</p><div class="matchgrid"><div class="matchcol">${left}</div><div class="matchcol">${right}</div></div><div id="duoAns" class="answer hidden"></div></article>`;
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

function renderForming() {
  const q = duoState.current;
  const area = $('#duoArea');
  const builtHtml = q.user.length ? q.user.map(p => `<span class="chip">${escapeHtml(p)}</span>`).join(' ') : '<span class="muted">(tap parts below)</span>';
  const poolHtml = q.pool.map((tile, i) => `<button class="option duo-tile border${tile.used ? ' used' : ''}" data-i="${i}" ${tile.used ? 'disabled' : ''}>${escapeHtml(tile.text)}</button>`).join('');
  area.innerHTML = `<article class="question">
    <h6>Forming: form the word from its roots</h6>
    <p class="prompt">Meaning: <strong>${escapeHtml(stripHtml(q.term.meaning_uk || q.term.meaning_us || ''))}</strong></p>
    <div class="built mt" style="min-height:2rem">${builtHtml}</div>
    <div class="options">${poolHtml}</div>
    <div class="row center-align mt">
      <button class="border" id="duoFormClear"><i>backspace</i><span>Clear</span></button>
      <button id="duoFormCheck"><i>check</i><span>Check</span></button>
    </div>
    <div class="answer hidden" id="duoAns"></div>
  </article>`;
  area.querySelectorAll('.duo-tile').forEach(b => {
    b.addEventListener('click', () => {
      const i = +b.dataset.i;
      if (q.pool[i].used) return;
      q.pool[i].used = true;
      q.user.push(q.pool[i].text);
      renderForming();
    });
  });
  const clear = $('#duoFormClear');
  if (clear) clear.addEventListener('click', () => { q.user = []; q.pool.forEach(t => t.used = false); renderForming(); });
  const check = $('#duoFormCheck');
  if (check) check.addEventListener('click', checkForming);
}
function checkForming() {
  const q = duoState.current;
  const correct = q.user.length === q.target.length && q.user.every((v, i) => v === q.target[i]);
  const area = $('#duoArea');
  area.querySelectorAll('button').forEach(b => b.style.pointerEvents = 'none');
  const ans = $('#duoAns');
  if (correct) {
    duoState.score += 10; duoState.streak += 1;
    if (duoState.streak % 5 === 0) launchConfetti();
    if (ans) { ans.classList.remove('hidden'); ans.innerHTML = 'Correct! +10'; }
  } else {
    duoState.streak = 0;
    if (ans) { ans.classList.remove('hidden'); ans.innerHTML = 'Answer: ' + escapeHtml(q.target.join(' + ')); }
  }
  updateDuoStats();
  setTimeout(() => { duoState.qi += 1; renderDuoQuestion(); }, 1200);
}

function wordleColors(guess, answer) {
  const res = Array(guess.length).fill('absent');
  const counts = {};
  for (let i=0;i<answer.length;i++) counts[answer[i]] = (counts[answer[i]] || 0) + 1;
  for (let i=0;i<guess.length;i++) {
    if (guess[i] === answer[i]) { res[i] = 'correct'; counts[guess[i]]--; }
  }
  for (let i=0;i<guess.length;i++) {
    if (res[i] === 'correct') continue;
    if (counts[guess[i]] > 0) { res[i] = 'present'; counts[guess[i]]--; }
  }
  return res;
}
function renderWordle() {
  const q = duoState.current;
  const area = $('#duoArea');
  const total = 6;
  const rows = [];
  for (let r=0;r<total;r++) {
    const guess = q.guesses[r];
    if (guess) {
      const colors = wordleColors(guess, q.answer);
      rows.push('<div class="wlrow">' + guess.split('').map((ch,i) => `<span class="wltile ${colors[i]}">${escapeHtml(ch.toUpperCase())}</span>`).join('') + '</div>');
    } else if (r === q.guesses.length) {
      rows.push('<div class="wlrow">' + Array(q.answer.length).fill('<span class="wltile empty"> </span>').join('') + '</div>');
    } else {
      rows.push('<div class="wlrow">' + Array(q.answer.length).fill('<span class="wltile"> </span>').join('') + '</div>');
    }
  }
  const done = q.guesses.length >= total || q.guesses.includes(q.answer);
  area.innerHTML = `<article class="question">
    <h6>Wordle: guess the word</h6>
    <p class="muted">Length: ${q.answer.length} • Attempts: ${q.guesses.length}/${total}</p>
    <div class="wlgrid">${rows.join('')}</div>
    ${done ? '' : `<div class="inline-form mt">
      <div class="field label border">
        <input id="duoWordleInput" class="upper" type="text" maxlength="${q.answer.length}" placeholder=" " />
        <label>Type guess (${q.answer.length} letters)</label>
      </div>
      <button id="duoWordleBtn"><i>send</i><span>Guess</span></button>
    </div>`}
    <div class="answer hidden" id="duoAns"></div>
  </article>`;
  if (!done) {
    const btn = $('#duoWordleBtn');
    const inp = $('#duoWordleInput');
    const submit = async () => {
      const val = (inp?.value || '').trim().toLowerCase();
      if (val.length !== q.answer.length || !/^[a-z]+$/.test(val)) {
        if (inp) { inp.value = ''; inp.focus(); }
        const a0 = $('#duoAns');
        if (a0) {
          a0.classList.remove('hidden');
          a0.innerHTML = (val.length > 0 && val.length < q.answer.length) ? 'Word not long enough.' : 'Not a valid word.';
        }
        return;
      }
      try {
        const res = await fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(val));
        if (!res.ok) {
          if (inp) { inp.value = ''; inp.focus(); }
          const a0 = $('#duoAns');
          if (a0) { a0.classList.remove('hidden'); a0.innerHTML = 'Not a valid word.'; }
          return;
        }
      } catch (e) {}
      q.guesses.push(val);
      if (val === q.answer || q.guesses.length >= total) {
        const correct = q.guesses.includes(q.answer);
        if (correct) { duoState.score += 10; duoState.streak += 1; if (duoState.streak % 5 === 0) launchConfetti(); }
        else { duoState.streak = 0; }
        renderWordle();
        const a2 = $('#duoAns');
        if (a2) { a2.classList.remove('hidden'); a2.innerHTML = correct ? 'Correct! +10' : `Answer: ${escapeHtml(q.answer.toUpperCase())}`; }
        updateDuoStats();
        setTimeout(() => { duoState.qi += 1; renderDuoQuestion(); }, 1400);
      } else {
        renderWordle();
      }
    };
    if (btn) btn.addEventListener('click', submit);
    if (inp) inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  }
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
