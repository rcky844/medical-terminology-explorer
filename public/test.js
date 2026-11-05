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


let testTimerInterval = null;
function updateTimerDisplay(sec) {
  const m = Math.floor(sec/60), s = sec % 60;
  const el = $('#timer');
  if (el) el.textContent = `Time: ${m}:${String(s).padStart(2,'0')}`;
}
function startTestTimer(seconds=600) {
  if (testTimerInterval) clearInterval(testTimerInterval);
  let remaining = seconds;
  updateTimerDisplay(remaining);
  testTimerInterval = setInterval(() => {
    remaining -= 1;
    updateTimerDisplay(remaining);
    if (remaining <= 0) {
      if (testTimerInterval) { clearInterval(testTimerInterval); testTimerInterval = null; }
      gradeTest(true);
    }
  }, 1000);
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
  const intro = $("#testIntro"); if (intro) intro.hidden = true;
  const bodyEl = $("#testBody"); if (bodyEl) bodyEl.hidden = false;
  state.test = { sec1, sec2, oddQs, generatedAt: Date.now(), graded: false };
  renderTest();
  startTestTimer(600);
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

function showCelebration(score,total) {
  const pct = total ? Math.round(score/total*100) : 0;
  let emoji, msg, cls;
  if (pct >= 90) { emoji='🎉'; msg='Outstanding!'; cls='celebrate-green'; launchConfetti(); }
  else if (pct >= 60) { emoji='😊'; msg="You're improving!"; cls='celebrate-yellow'; }
  else { emoji='💪'; msg='Practice makes perfect.'; cls='celebrate-red'; }
  const d = $('#celebrateDialog');
  const body = d.querySelector('.celebrate-body');
  body.innerHTML = `<div class="celebrate-emoji">${emoji}</div><div class="celebrate-msg ${cls}">${msg}</div><div class="celebrate-pct">${pct}% (${score}/${total})</div>`;
  const close = $('#closeCelebrate');
  if (close) close.onclick = () => d.close();
  d.showModal();
}

function gradeTest(auto=false) {
  if (!state.test || state.test.graded) return;
  state.test.graded = true;
  if (testTimerInterval) { clearInterval(testTimerInterval); testTimerInterval=null; }
  const { sec1, sec2, oddQs } = state.test;
  const questions = document.querySelectorAll('#testBody .question');
  let qi = 0, score = 0;
  const items = [];

  sec1.forEach((q, i) => {
    const qEl = questions[qi++];
    const cb = qEl.querySelector('.selfok');
    const selfCorrect = !!(cb && cb.checked);
    if (selfCorrect) score += q.points;
    const parts = wordPartsSummary(q.term);
    const ansEl = document.getElementById('s1ans-' + i);
    ansEl.classList.remove('hidden');
    ansEl.innerHTML = `Expected: ${q.term.meaning_uk}` + (parts ? `<br><em>Word parts: ${escapeHtml(parts)}</em>` : '');
    items.push({
      prompt: `Write a definition of: ${q.term.word}`,
      userAnswer: selfCorrect ? '(self-marked correct)' : '(self-marked incorrect/not marked)',
      correctAnswer: stripHtml(q.term.meaning_uk || ''),
      explanation: parts || '',
      points: q.points,
      awarded: selfCorrect
    });
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
    items.push({
      prompt: q.term.meaning_uk ? stripHtml(q.term.meaning_uk) : 'Definition',
      userAnswer: inp.value || '',
      correctAnswer: q.term.word,
      explanation: parts || '',
      points: q.points,
      awarded: correct
    });
  });
  oddQs.forEach((q, i) => {
    const qEl = questions[qi++];
    const selBtn = qEl.querySelector('.option.selected');
    const ansEl = document.getElementById('s3ans-' + i);
    ansEl.classList.remove('hidden');
    const selectedWord = selBtn ? selBtn.getAttribute('data-word') : null;
    const isCorrect = !!(selectedWord && selectedWord === q.q.answer);
    qEl.querySelectorAll('.option').forEach(b => {
      const w = b.getAttribute('data-word');
      if (w === q.q.answer) b.classList.add('correct');
      else if (b.classList.contains('selected')) b.classList.add('wrong');
    });
    ansEl.textContent = q.q.explanation;
    if (isCorrect) score += q.points;
    items.push({
      prompt: q.q.prompt,
      userAnswer: selectedWord || '',
      correctAnswer: q.q.answer,
      explanation: q.q.explanation,
      points: q.points,
      awarded: isCorrect
    });
  });
  const total = sec1.length*2 + sec2.length*2 + oddQs.length*2;
  const el = $('#score');
  el.textContent = (auto ? 'Time expired. ' : '') + `Score: ${score} / ${total}`;
  el.classList.add('result');
  // save session
  showCelebration(score,total);
  const session = {
    id: Date.now(),
    createdAt: new Date().toISOString(),
    score, total, timeExpired: auto,
    items
  };
  const list = JSON.parse(localStorage.getItem('mtTestSessions') || '[]');
  list.unshift(session);
  localStorage.setItem('mtTestSessions', JSON.stringify(list.slice(0,20)));
}


function showSessions() {
  const dlg = $('#sessionsDialog');
  const panel = $('#sessionsPanel');
  if (!dlg || !panel) return;
  const list = JSON.parse(localStorage.getItem('mtTestSessions') || '[]');
  if (!list.length) {
    panel.innerHTML = 'No saved sessions yet.';
  } else {
    panel.innerHTML = list.map(sess => `
    <div class="session">
      <div class="sessionhead">
        <strong>${new Date(sess.createdAt).toLocaleString()}</strong>
        <span>${sess.score}/${sess.total}${sess.timeExpired ? ' (time expired)' : ''}</span>
        <button class="btn secondary sessdetail" data-id="${sess.id}">Details</button>
        <button class="btn secondary sessdelete" data-id="${sess.id}">Delete</button>
      </div>
      <div class="sessitems hidden" id="sess-${sess.id}"></div>
    </div>
  `).join('');
  }
  panel.querySelectorAll('.sessdetail').forEach(b => {
    b.addEventListener('click', () => {
      const id = +b.dataset.id;
      const sess = list.find(x => x.id === id);
      const container = document.getElementById('sess-' + id);
      container.classList.toggle('hidden');
      if (container.classList.contains('hidden')) return;
      container.innerHTML = sess.items.map(it => `
        <div class="qreview">
          <div><strong>Q:</strong> ${escapeHtml(it.prompt)}</div>
          <div>Your answer: ${escapeHtml(it.userAnswer || '(none)')}</div>
          <div>Correct: ${escapeHtml(it.correctAnswer)}</div>
          ${it.explanation ? `<div class="muted">${escapeHtml(it.explanation)}</div>` : ''}
          <div class="${it.awarded ? 'result' : 'wrong'}">${it.awarded ? '✔' : '✘'} ${it.points} pts</div>
        </div>
      `).join('');
    });
  });
  panel.querySelectorAll('.sessdelete').forEach(b => {
    b.addEventListener('click', () => {
      const id = +b.dataset.id;
      if (!confirm('Delete this saved session?')) return;
      const newList = list.filter(x => x.id !== id);
      localStorage.setItem('mtTestSessions', JSON.stringify(newList));
      showSessions();
    });
  });
  const closeBtn = $('#closeSessions');
  if (closeBtn) closeBtn.addEventListener('click', () => { if (dlg) dlg.close(); });
  try { dlg.showModal(); } catch (e) { dlg.setAttribute('open',''); }
}




$('#modeTest').addEventListener('click', () => {
  document.querySelectorAll('.navbtn').forEach(b=>b.classList.remove('active'));
  $('#modeTest').classList.add('active');
  $('#browserView').hidden = true;
  $('#testView').hidden = false;
  $('#duoView').hidden = true;
  $('#spacedView').hidden = true;
  const intro2 = $('#testIntro'); if (intro2) intro2.hidden = false;
  const body2 = $('#testBody'); if (body2) body2.hidden = true;
});
$('#genTest').addEventListener('click', () => { if (!confirm('Generate a new test and start the 10-minute timer?')) return; const intro = $('#testIntro'); if (intro) intro.hidden = true; const bodyEl = $('#testBody'); if (bodyEl) bodyEl.hidden = false; generateTest(); });
const startTestBtn = $('#startTest');
if (startTestBtn) startTestBtn.addEventListener('click', () => { if (!confirm('Start the 10-minute practice test now?')) return; const intro = $('#testIntro'); if (intro) intro.hidden = true; const bodyEl = $('#testBody'); if (bodyEl) bodyEl.hidden = false; generateTest(); });
$('#checkTest').addEventListener('click', () => gradeTest(false));
$('#reviewSessionsBtn').addEventListener('click', showSessions);
