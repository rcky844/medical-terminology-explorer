const spacedState = { deck: [], index: 0, revealed: false, data: {}, history: [], deckKind: 'terms', timed: localStorage.getItem('srTimed')==='1', timerInterval: null };

function srLoad() { try { return JSON.parse(localStorage.getItem('srData') || '{}'); } catch (e) { return {}; } }
function srSave() { localStorage.setItem('srData', JSON.stringify(spacedState.data)); }

function wordPartCards() {
  const out = [];
  const kinds = ['prefix','root','suffix'];
  kinds.forEach(kind => {
    (state.vocab?.[kind] || []).forEach(v => {
      out.push({
        key: `part:${kind}:${v.term}`,
        word: v.term,
        meaning_uk: `<p>${v.meaning_uk}</p>`,
        audio: null,
        image: null,
        kind
      });
    });
  });
  return out;
}

function spacedCandidates(kind) {
  if (kind === 'parts') return wordPartCards();
  return state.terms.filter(t => t.word && t.meaning_uk);
}

function srDueTerms(kind) {
  const now = Date.now();
  const due = [], fresh = [];
  spacedCandidates(kind).forEach(t => {
    const d = spacedState.data[t.key || t.word];
    if (d) {
      if (d.next <= now) due.push(t);
    } else {
      fresh.push(t);
    }
  });
  return { due, fresh };
}

function buildSpacedDeck(kind) {
  kind = kind || spacedState.deckKind;
  spacedState.deckKind = kind;
  const { due, fresh } = srDueTerms(kind);
  const deck = due.slice().sort(() => Math.random() - 0.5);
  const need = Math.max(0, 20 - deck.length);
  deck.push(...pick(fresh, need));
  spacedState.deck = pick(deck, deck.length);
  spacedState.index = 0;
  spacedState.revealed = false;
}

function renderSpaced() {
  const area = $('#spacedArea');
  const stats = $('#spacedStats');
  const { due } = srDueTerms(spacedState.deckKind);
  const learned = Object.keys(spacedState.data).filter(k => spacedState.data[k].box >= 3).length;
  const tracked = Object.keys(spacedState.data).length;
  if (stats) stats.textContent = `Cards: ${tracked} • Learned: ${learned} • Due: ${due.length} • Session: ${spacedState.deck.length}`;

  if (spacedState.timerInterval) { clearInterval(spacedState.timerInterval); spacedState.timerInterval = null; }
  if (!spacedState.deck.length) {
    area.innerHTML = '<div class="question"><p>No cards available.</p><button class="btn" id="srReload">Reload</button></div>';
    const b = $('#srReload'); if (b) b.addEventListener('click', () => { buildSpacedDeck(); renderSpaced(); });
    return;
  }
  if (spacedState.index >= spacedState.deck.length) {
    area.innerHTML = `<div class="question"><h3>Session complete!</h3><p>Reviewed ${spacedState.deck.length} cards.</p><button class="btn" id="srReload">New session</button></div>`;
    const b = $('#srReload'); if (b) b.addEventListener('click', () => { buildSpacedDeck(); renderSpaced(); });
    return;
  }
  const t = spacedState.deck[spacedState.index];
  const key = t.key || t.word;
  const reverse = spacedState.deckKind === 'meaning';
  const frontText = reverse ? stripHtml(t.meaning_uk || t.meaning_us || '') : t.word;
  const backContent = reverse ? escapeHtml(t.word) : (t.meaning_uk || t.meaning_us || '');
  const audioUrl = t.sound_uk ? `https://medterms.hku.hk/storage/audio/mtlist/${encodeURIComponent(t.sound_uk)}` : (t.audio ? t.audio : null);
  area.innerHTML = `
    <div class="flashcard">
      <div class="flashfront">${escapeHtml(frontText)}</div>
      ${spacedState.timed ? '<div class="muted" id="srTimer" style="text-align:center;margin:.25rem 0">Time: 30s</div>' : ''}
      <div class="srRevealWrap" style="display:flex;justify-content:center;margin:.75rem 0"><button class="btn secondary" id="srReveal">${spacedState.revealed ? 'Hide' : 'Reveal'}</button></div>
      <div id="srBack" ${spacedState.revealed ? '' : 'hidden'}>
        <div class="flashback">${backContent}</div>
        ${wordPartsBlock ? (typeof wordPartsBlock === 'function' ? wordPartsBlock(t) : '') : ''}
        ${audioUrl ? `<div class="media">${audioPlayer(audioUrl)}</div>` : ''}
        <div class="sr-buttons">
          <button class="srbtn again" data-rating="again">Again</button>
          <button class="srbtn hard" data-rating="hard">Hard</button>
          <button class="srbtn good" data-rating="good">Good</button>
          <button class="srbtn easy" data-rating="easy">Easy</button>
        </div>
      </div>
      <div class="muted" style="margin-top:.5rem;text-align:center">Card ${spacedState.index+1} of ${spacedState.deck.length}</div>
    </div>`;

  const revealBtn = $('#srReveal');
  if (revealBtn) revealBtn.addEventListener('click', () => { spacedState.revealed = !spacedState.revealed; renderSpaced(); });

  const INTERVALS = [0, 10*60*1000, 86400000, 3*86400000, 7*86400000, 14*86400000, 30*86400000];
  area.querySelectorAll('.srbtn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (spacedState.timerInterval) { clearInterval(spacedState.timerInterval); spacedState.timerInterval = null; }
      const rating = btn.dataset.rating;
      const d = spacedState.data[key] || { box: 0 };
      if (rating === 'again') d.box = 1;
      else if (rating === 'hard') d.box = Math.max(1, d.box || 0);
      else if (rating === 'good') d.box = Math.min(6, (d.box || 0) + 1);
      else if (rating === 'easy') d.box = Math.min(6, (d.box || 0) + 2);
      const interval = INTERVALS[d.box] || INTERVALS[1];
      d.next = Date.now() + interval;
      spacedState.data[key] = d;
      srSave();
      spacedState.history.unshift({ time: Date.now(), word: t.word, rating, timed: spacedState.timed });
      try { localStorage.setItem('srHistory', JSON.stringify(spacedState.history.slice(0, 200))); } catch (e) {}
      spacedState.index += 1;
      spacedState.revealed = false;
      renderSpaced();
    });
  });
  if (spacedState.timed && spacedState.index < spacedState.deck.length) {
    let secs = 30;
    const timerEl = $('#srTimer');
    if (timerEl) timerEl.textContent = 'Time: ' + secs + 's';
    spacedState.timerInterval = setInterval(() => {
      secs -= 1;
      const te = $('#srTimer');
      if (te) te.textContent = 'Time: ' + secs + 's';
      if (secs <= 0) {
        if (spacedState.timerInterval) { clearInterval(spacedState.timerInterval); spacedState.timerInterval = null; }
        const againBtn = area.querySelector('.srbtn.again');
        if (againBtn) againBtn.click();
      }
    }, 1000);
  }
}


function startSpaced() {
  spacedState.data = srLoad();
  try { spacedState.history = JSON.parse(localStorage.getItem('srHistory') || '[]'); } catch (e) { spacedState.history = []; }
  const tb = $('#srTimedBtn');
  if (tb) {
    tb.textContent = 'Timed: ' + (spacedState.timed ? 'On' : 'Off');
    tb.onclick = () => {
      spacedState.timed = !spacedState.timed;
      localStorage.setItem('srTimed', spacedState.timed ? '1' : '0');
      tb.textContent = 'Timed: ' + (spacedState.timed ? 'On' : 'Off');
      if (spacedState.timerInterval) { clearInterval(spacedState.timerInterval); spacedState.timerInterval = null; }
      renderSpaced();
    };
  }
  try { spacedState.history = JSON.parse(localStorage.getItem('srHistory') || '[]'); } catch (e) { spacedState.history = []; }
  const hb = $('#srHistoryBtn');
  if (hb) hb.onclick = showSpacedHistory;
  const closeHist = $('#closeSpacedHistory');
  if (closeHist) closeHist.addEventListener('click', () => { const d = $('#spacedHistoryDialog'); if (d) d.close(); });
  const termsBtn = $('#deckTerms');
  const meaningBtn = $('#deckMeaning');
  const partsBtn = $('#deckParts');
  function markDeck() {
    if (termsBtn) termsBtn.classList.toggle('active', spacedState.deckKind === 'terms');
    if (meaningBtn) meaningBtn.classList.toggle('active', spacedState.deckKind === 'meaning');
    if (partsBtn) partsBtn.classList.toggle('active', spacedState.deckKind === 'parts');
  }
  if (termsBtn) termsBtn.onclick = () => { buildSpacedDeck('terms'); spacedState.deckKind='terms'; markDeck(); renderSpaced(); };
  if (meaningBtn) meaningBtn.onclick = () => { buildSpacedDeck('meaning'); spacedState.deckKind='meaning'; markDeck(); renderSpaced(); };
  if (partsBtn) partsBtn.onclick = () => { buildSpacedDeck('parts'); spacedState.deckKind='parts'; markDeck(); renderSpaced(); };
  markDeck();
  buildSpacedDeck(spacedState.deckKind || 'terms');
  renderSpaced();
}

function showSpacedHistory() {
  const dlg = $('#spacedHistoryDialog');
  const panel = $('#spacedHistory');
  if (!dlg || !panel) return;
  panel.innerHTML = '';
  const list = spacedState.history || [];
  if (!list.length) { panel.innerHTML = 'No review history yet.'; }
  else {
    panel.innerHTML = '<div class="sessions">' + list.map(h =>
      `<div class="session"><strong>${new Date(h.time).toLocaleString()}</strong> — ${escapeHtml(h.word)} — ${escapeHtml(h.rating)}${h.timed ? ' (timed)' : ''}</div>`
    ).join('') + '</div><div style="margin-top:.5rem"><button class="btn secondary" id="srClearHistory">Clear history</button></div>';
  }
  const cb = $('#srClearHistory');
  if (cb) cb.addEventListener('click', () => { if (!confirm('Clear spaced-repetition history?')) return; spacedState.history = []; localStorage.removeItem('srHistory'); showSpacedHistory(); });
  try { dlg.showModal(); } catch (e) { dlg.setAttribute('open',''); }
}

spacedState.data = srLoad();
try { spacedState.history = JSON.parse(localStorage.getItem('srHistory') || '[]'); } catch (e) { spacedState.history = []; }
$('#modeSpaced').addEventListener('click', () => {
  document.querySelectorAll('.navbtn').forEach(b=>b.classList.remove('active'));
  $('#modeSpaced').classList.add('active');
  $('#browserView').hidden = true;
  $('#testView').hidden = true;
  $('#duoView').hidden = true;
  $('#spacedView').hidden = false;
  startSpaced();
});
