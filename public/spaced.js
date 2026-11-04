const spacedState = { deck: [], index: 0, revealed: false, data: {} };

function srLoad() {
  try { return JSON.parse(localStorage.getItem('srData') || '{}'); } catch (e) { return {}; }
}
function srSave() {
  localStorage.setItem('srData', JSON.stringify(spacedState.data));
}

function srDueTerms() {
  const now = Date.now();
  const due = [];
  const fresh = [];
  state.terms.forEach(t => {
    if (!t.word || !t.meaning_uk) return;
    const d = spacedState.data[t.word];
    if (d) {
      if (d.next <= now) due.push(t);
    } else {
      fresh.push(t);
    }
  });
  return { due, fresh };
}

function buildSpacedDeck() {
  const { due, fresh } = srDueTerms();
  const deck = due.slice().sort(() => Math.random() - 0.5);
  const need = Math.max(0, 12 - deck.length);
  const newCards = pick(fresh, need);
  deck.push(...newCards);
  spacedState.deck = pick(deck, deck.length);
  spacedState.index = 0;
  spacedState.revealed = false;
}

function renderSpaced() {
  const area = $('#spacedArea');
  const stats = $('#spacedStats');
  const total = Object.keys(spacedState.data).length;
  const dueCount = srDueTerms().due.length;
  if (stats) stats.textContent = `Cards: ${total} • Due: ${dueCount} • Deck: ${spacedState.deck.length}`;

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
  const audioUrl = t.sound_uk ? `https://medterms.hku.hk/storage/audio/mtlist/${encodeURIComponent(t.sound_uk)}` : null;
  area.innerHTML = `
    <div class="flashcard">
      <div class="flashfront">${escapeHtml(t.word)}</div>
      <div style="margin:.75rem 0"><button class="btn secondary" id="srReveal">${spacedState.revealed ? 'Hide' : 'Reveal'}</button></div>
      <div id="srBack" ${spacedState.revealed ? '' : 'hidden'}>
        <div class="meaning-full">${t.meaning_uk || ''}</div>
        ${wordPartsBlock ? wordPartsBlock(t) : ''}
        ${audioUrl ? `<div class="media"><audio controls src="${audioUrl}"></audio></div>` : ''}
        <div class="sr-buttons">
          <button class="srbtn again" data-rating="again">Again</button>
          <button class="srbtn hard" data-rating="hard">Hard</button>
          <button class="srbtn good" data-rating="good">Good</button>
          <button class="srbtn easy" data-rating="easy">Easy</button>
        </div>
      </div>
      <div class="muted" style="margin-top:.5rem">Card ${spacedState.index+1} of ${spacedState.deck.length}</div>
    </div>`;

  const revealBtn = $('#srReveal');
  if (revealBtn) revealBtn.addEventListener('click', () => { spacedState.revealed = !spacedState.revealed; renderSpaced(); });

  const INTERVALS = [0, 10*60*1000, 86400000, 3*86400000, 7*86400000, 14*86400000, 30*86400000];
  area.querySelectorAll('.srbtn').forEach(btn => {
    btn.addEventListener('click', () => {
      const rating = btn.dataset.rating;
      const d = spacedState.data[t.word] || { box: 0 };
      if (rating === 'again') { d.box = 1; }
      else if (rating === 'hard') { d.box = Math.max(1, d.box); }
      else if (rating === 'good') { d.box = Math.min(6, (d.box || 0) + 1); }
      else if (rating === 'easy') { d.box = Math.min(6, (d.box || 0) + 2); }
      const interval = INTERVALS[d.box] || INTERVALS[1];
      d.next = Date.now() + interval;
      spacedState.data[t.word] = d;
      srSave();
      spacedState.index += 1;
      spacedState.revealed = false;
      renderSpaced();
    });
  });
}

function startSpaced() {
  spacedState.data = srLoad();
  buildSpacedDeck();
  renderSpaced();
}

$('#modeSpaced').addEventListener('click', () => {
  document.querySelectorAll('.navbtn').forEach(b=>b.classList.remove('active'));
  $('#modeSpaced').classList.add('active');
  $('#browserView').hidden = true;
  $('#testView').hidden = true;
  $('#duoView').hidden = true;
  $('#spacedView').hidden = false;
  startSpaced();
});

spacedState.data = srLoad();
EOF