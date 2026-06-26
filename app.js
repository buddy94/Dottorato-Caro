/* iVoc Quiz — app vanilla, offline. Dati: window.QUIZ_DATA, materiali: window.MATERIALS */
'use strict';
(function () {
  const DATA = (window.QUIZ_DATA || []).filter(Boolean);
  const MATERIALS = window.MATERIALS || {};
  const LS_KEY = 'ivoc_quiz_progress_v1';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const byId = {}; DATA.forEach(q => byId[q.id] = q);

  // ---------- progress ----------
  let prog = load();
  function load() {
    try { const p = JSON.parse(localStorage.getItem(LS_KEY)); if (p && p.items) return p; } catch (e) {}
    return { version: 1, items: {} };
  }
  function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(prog)); } catch (e) {} }
  function item(id) { return prog.items[id] || (prog.items[id] = { seen: 0, status: null, box: 1, correct: 0, wrong: 0, ts: 0 }); }
  function markSeen(id) { const it = item(id); it.seen++; it.ts = Date.now(); save(); }
  function setStatus(id, status, fromAuto) {
    const it = item(id);
    it.status = status;
    if (status === 'know') it.box = Math.min(5, (it.box || 1) + 1);
    else if (status === 'review') it.box = 1;
    save(); refreshTabsBadges();
  }
  function recordOutcome(id, correct) {
    const it = item(id);
    if (correct === true) it.correct++; else if (correct === false) it.wrong++;
    save();
  }

  // ---------- helpers ----------
  const TOPIC_LABEL = { tesi: 'Tesi', testi: 'Testi', autori: 'Autori', statistiche: 'Statistiche', concordanze: 'Concordanze', contesto: 'Contesto', metodologia: 'Metodologia' };
  const TYPE_LABEL = { aperta: 'Aperta', vero_falso: 'Vero/Falso', multipla: 'Multipla', riordino: 'Riordino', abbinamento: 'Abbinamento', flashcard: 'Flashcard', cloze: 'Cloze' };
  const ANGLE_LABEL = { ricordo: 'Ricordo', metodologia: 'Metodologia', limiti: 'Limiti', obiezione: 'Obiezione', collegamento_dati: 'Collegam. dati', definizione: 'Definizione', contributo: 'Contributo', contesto: 'Contesto' };
  const norm = s => (s == null ? '' : String(s)).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  const esc = s => (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; };
  const letter = i => String.fromCharCode(65 + i);

  // ---------- filter state ----------
  const F = { topic: new Set(), type: new Set(), angle: new Set(), review: false, unseen: false, random: false, leitner: true, oral: false, search: '' };

  const TIP = {
    topic: { tesi: 'Domande sul contenuto della tesi, capitolo per capitolo.', metodologia: 'Il perché delle scelte: corpus, periodo, digitalizzazione, tagging.', statistiche: 'Lettura corretta dei numeri di iVoc e loro legame con la tesi.', concordanze: 'Dati della concordanza (occorrenze, lemmi) e cosa sostengono.', testi: 'Le 56 raccolte del corpus: tema, stile, struttura.', autori: 'I 41 poeti del corpus: biografia e collocazione critica.', contesto: 'Il 1960-65: movimenti, eventi, clima culturale.' },
    type: { aperta: 'Rispondi a voce o a mente, poi rivela e auto-valutati.', vero_falso: 'Scegli Vero o Falso; la correzione è automatica.', multipla: 'Scegli l’opzione (o le opzioni) corretta.', riordino: 'Metti gli elementi nell’ordine giusto.', abbinamento: 'Associa ogni voce al suo corrispondente.', flashcard: 'Carta da memoria: pensa la risposta, poi rivela.', cloze: 'Completa lo spazio vuoto nella frase.' },
    angle: { ricordo: 'Contenuto di base: cosa dice o cosa contiene.', metodologia: 'Perché questa scelta di metodo.', limiti: 'I punti deboli del metodo.', obiezione: 'Avvocato del diavolo: rispondi a una critica.', collegamento_dati: 'Collega un dato alla tesi che sostiene (e viceversa).', definizione: 'Definisci un termine tecnico in una frase.', contributo: 'Cosa c’è di nuovo e originale.', contesto: 'Il legame col periodo 1960-65.' }
  };
  function buildChips(containerId, dim, labelMap) {
    const counts = {};
    DATA.forEach(q => { const k = (dim === 'angle' ? q.defenseAngle : q[dim]) || (dim === 'angle' ? 'null' : null); if (k) counts[k] = (counts[k] || 0) + 1; });
    const cont = $('#' + containerId); cont.innerHTML = '';
    const tips = TIP[dim] || {};
    Object.keys(labelMap).filter(k => counts[k]).sort((a, b) => counts[b] - counts[a]).forEach(k => {
      const b = document.createElement('button');
      b.className = 'chip' + (tips[k] ? ' tip' : ''); b.dataset.k = k;
      if (tips[k]) { b.setAttribute('data-tip', tips[k]); b.setAttribute('aria-label', labelMap[k] + ': ' + tips[k]); }
      b.innerHTML = esc(labelMap[k]) + ' <span class="n">' + counts[k] + '</span>';
      b.onclick = () => { b.classList.toggle('on'); const s = F[dim]; b.classList.contains('on') ? s.add(k) : s.delete(k); updateCount(); };
      cont.appendChild(b);
    });
  }

  function matches() {
    const s = norm(F.search);
    return DATA.filter(q => {
      if (F.topic.size && !F.topic.has(q.topic)) return false;
      if (F.type.size && !F.type.has(q.type)) return false;
      if (F.angle.size && !F.angle.has(q.defenseAngle)) return false;
      const it = prog.items[q.id];
      if (F.review && !(it && it.status === 'review')) return false;
      if (F.unseen && it && it.seen > 0) return false;
      if (s && norm(q.question + ' ' + q.subtopic + ' ' + (q.tags || []).join(' ') + ' ' + q.explanation + ' ' + q.answer).indexOf(s) < 0) return false;
      return true;
    });
  }
  function updateCount() { $('#match-count').textContent = matches().length + ' domande'; }

  // ---------- session ----------
  let SESSION = { list: [], i: 0, mode: 'studio', sim: false, timer: null, endTs: 0 };

  function orderList(list) {
    if (F.random || SESSION.sim) return shuffle(list);
    if (F.leitner) {
      return list.slice().sort((a, b) => {
        const ia = prog.items[a.id], ib = prog.items[b.id];
        const ba = ia ? ia.box : 0, bb = ib ? ib.box : 0; // unseen (0) first, then low boxes
        if (ba !== bb) return ba - bb;
        const sa = ia ? ia.seen : 0, sb = ib ? ib.seen : 0;
        if (sa !== sb) return sa - sb;
        return (ia ? ia.ts : 0) - (ib ? ib.ts : 0);
      });
    }
    return list;
  }

  function startSession(simulation) {
    let list;
    SESSION.sim = !!simulation;
    if (simulation) {
      list = DATA.filter(q => q.difficulty === 'avanzato' || ['obiezione', 'collegamento_dati', 'limiti'].includes(q.defenseAngle));
      list = shuffle(list).slice(0, Math.min(20, list.length));
    } else {
      list = orderList(matches());
    }
    if (!list.length) { alert('Nessuna domanda con questi filtri.'); return; }
    SESSION.list = list; SESSION.i = 0;
    $('#studio-setup').classList.add('hidden');
    $('#studio-run').classList.remove('hidden');
    $('#run-mode').textContent = simulation ? 'Simulazione difesa' : (F.oral ? 'Modalità orale' : 'Studio');
    if (simulation) startTimer(Math.min(20, list.length) * 60); else stopTimer();
    renderQ();
  }
  function endSession() { stopTimer(); $('#studio-run').classList.add('hidden'); $('#studio-setup').classList.remove('hidden'); updateCount(); }

  function startTimer(sec) {
    const el = $('#sim-timer'); el.classList.remove('hidden'); SESSION.endTs = Date.now() + sec * 1000;
    const tick = () => {
      const left = Math.max(0, Math.round((SESSION.endTs - Date.now()) / 1000));
      el.textContent = '⏱ ' + String(Math.floor(left / 60)).padStart(2, '0') + ':' + String(left % 60).padStart(2, '0');
      if (left <= 0) { stopTimer(); alert('Tempo scaduto! Rivedi le risposte con calma.'); }
    };
    tick(); SESSION.timer = setInterval(tick, 1000);
  }
  function stopTimer() { if (SESSION.timer) clearInterval(SESSION.timer); SESSION.timer = null; $('#sim-timer').classList.add('hidden'); }

  // ---------- render question ----------
  function renderQ() {
    const q = SESSION.list[SESSION.i];
    if (!q) { renderDone(); return; }
    markSeen(q.id);
    $('#run-progress').textContent = (SESSION.i + 1) + ' / ' + SESSION.list.length;
    const card = $('#qcard');
    const it = item(q.id);
    const tags = [
      '<span class="tag topic">' + esc(TOPIC_LABEL[q.topic] || q.topic) + '</span>',
      q.defenseAngle ? '<span class="tag angle">' + esc(ANGLE_LABEL[q.defenseAngle] || q.defenseAngle) + '</span>' : '',
      '<span class="tag diff-' + q.difficulty + '">' + esc(q.difficulty) + '</span>',
      '<span class="tag">' + esc(TYPE_LABEL[q.type] || q.type) + '</span>'
    ].join('');
    card.innerHTML =
      '<div class="progress-mini"><i style="width:' + ((SESSION.i) / SESSION.list.length * 100) + '%"></i></div>' +
      '<div class="qmeta">' + tags + '</div>' +
      '<div class="qsub">' + esc(q.subtopic || '') + '</div>' +
      '<div class="qtext">' + esc(q.question) + '</div>' +
      '<div id="q-body"></div>' +
      '<div id="q-solution"></div>' +
      '<div class="qfoot no-print" id="q-foot"></div>';
    renderBody(q);
    renderFoot(q);
    if (F.oral && !SESSION.sim) speak(q.question);
  }

  let answerState = null; // per-question interaction state

  function renderBody(q) {
    const body = $('#q-body'); answerState = { picked: null, order: null, pairs: null, free: '' };
    if (q.type === 'multipla') {
      const multi = Array.isArray(q.answer);
      answerState.picked = new Set();
      body.innerHTML = '<div class="opts">' + q.options.map((o, i) =>
        '<button class="opt" data-i="' + i + '"><span class="mk">' + letter(i) + '</span><span>' + esc(o) + '</span></button>').join('') + '</div>';
      $$('.opt', body).forEach(b => b.onclick = () => {
        const i = b.dataset.i;
        if (multi) { b.classList.toggle('sel'); b.classList.contains('sel') ? answerState.picked.add(i) : answerState.picked.delete(i); }
        else { $$('.opt', body).forEach(x => x.classList.remove('sel')); b.classList.add('sel'); answerState.picked = new Set([i]); }
      });
    } else if (q.type === 'vero_falso') {
      body.innerHTML = '<div class="opts"><button class="opt" data-v="vero"><span class="mk">V</span><span>Vero</span></button>' +
        '<button class="opt" data-v="falso"><span class="mk">F</span><span>Falso</span></button></div>';
      $$('.opt', body).forEach(b => b.onclick = () => { $$('.opt', body).forEach(x => x.classList.remove('sel')); b.classList.add('sel'); answerState.picked = b.dataset.v; });
    } else if (q.type === 'riordino') {
      answerState.order = shuffle(q.options.map((o, i) => i));
      drawOrder(q);
    } else if (q.type === 'abbinamento') {
      const pairs = (q.options || []).map(p => { const m = String(p).split(/\s*(?:->|→|:)\s*/); return { l: m[0], r: m.slice(1).join(' -> ') }; }).filter(p => p.r);
      answerState.pairs = pairs; const rights = shuffle(pairs.map(p => p.r));
      body.innerHTML = '<div class="opts">' + pairs.map((p, i) =>
        '<div class="opt" style="cursor:default"><span style="flex:1">' + esc(p.l) + '</span><select class="free-input" data-i="' + i + '" style="flex:1;min-height:auto">' +
        '<option value="">— scegli —</option>' + rights.map(r => '<option value="' + esc(r) + '">' + esc(r) + '</option>').join('') + '</select></div>').join('') + '</div>';
    } else if (q.type === 'cloze') {
      if (q.options && q.options.length) {
        answerState.picked = null;
        body.innerHTML = '<div class="opts">' + q.options.map((o, i) =>
          '<button class="opt" data-i="' + i + '"><span class="mk">' + letter(i) + '</span><span>' + esc(o) + '</span></button>').join('') + '</div>';
        $$('.opt', body).forEach(b => b.onclick = () => { $$('.opt', body).forEach(x => x.classList.remove('sel')); b.classList.add('sel'); answerState.picked = b.dataset.i; });
      } else {
        body.innerHTML = '<input class="free-input" id="free" placeholder="completa…">';
      }
    } else { // aperta, flashcard
      body.innerHTML = '<textarea class="free-input" id="free" placeholder="' + (q.type === 'flashcard' ? 'pensa la risposta, poi rivela…' : 'scrivi (o pensa) la tua risposta, poi rivela…') + '"></textarea>';
    }
  }

  function drawOrder(q) {
    const body = $('#q-body');
    body.innerHTML = '<ol class="order-list">' + answerState.order.map((idx, pos) =>
      '<li class="order-item" data-pos="' + pos + '"><span class="h">⋮⋮</span><span style="flex:1">' + esc(q.options[idx]) + '</span>' +
      '<span class="mvs"><button data-up="' + pos + '">↑</button><button data-down="' + pos + '">↓</button></span></li>').join('') + '</ol>';
    $$('[data-up]', body).forEach(b => b.onclick = () => { const p = +b.dataset.up; if (p > 0) { swap(p, p - 1); drawOrder(q); } });
    $$('[data-down]', body).forEach(b => b.onclick = () => { const p = +b.dataset.down; if (p < answerState.order.length - 1) { swap(p, p + 1); drawOrder(q); } });
  }
  function swap(a, b) { const o = answerState.order;[o[a], o[b]] = [o[b], o[a]]; }

  // ---------- check answer ----------
  function checkAnswer(q) {
    if (q.type === 'multipla') {
      const correct = new Set((Array.isArray(q.answer) ? q.answer : [q.answer]).map(String));
      const picked = answerState.picked || new Set();
      if (!picked.size) return null;
      const ok = correct.size === picked.size && Array.from(correct).every(c => picked.has(c));
      $$('.opt', $('#q-body')).forEach(b => { const i = b.dataset.i; if (correct.has(i)) b.classList.add('correct'); else if (picked.has(i)) b.classList.add('wrong'); });
      return ok;
    }
    if (q.type === 'vero_falso') {
      if (!answerState.picked) return null;
      const ok = norm(answerState.picked) === norm(q.answer);
      $$('.opt', $('#q-body')).forEach(b => { if (b.dataset.v === norm(q.answer)) b.classList.add('correct'); else if (b.dataset.v === answerState.picked) b.classList.add('wrong'); });
      return ok;
    }
    if (q.type === 'riordino') {
      const correct = resolveOrder(q); // array of option-indices in correct order
      const ok = JSON.stringify(answerState.order) === JSON.stringify(correct);
      return ok;
    }
    if (q.type === 'abbinamento') {
      const sels = $$('#q-body select'); let ok = true, any = false;
      sels.forEach((s, i) => { if (s.value) any = true; const right = answerState.pairs[i].r; if (norm(s.value) === norm(right)) { s.style.borderColor = 'var(--ok)'; } else { s.style.borderColor = 'var(--bad)'; ok = false; } });
      return any ? ok : null;
    }
    if (q.type === 'cloze') {
      if (q.options && q.options.length) { if (answerState.picked == null) return null; return norm(q.options[+answerState.picked]) === norm(answerSolText(q)); }
      const v = ($('#free') && $('#free').value) || ''; if (!norm(v)) return null;
      return norm(v) === norm(q.answer) || norm(q.answer).includes(norm(v)) && norm(v).length > 2;
    }
    return null; // aperta/flashcard -> self eval
  }
  function answerSolText(q) {
    // for cloze with options + index answer, resolve to text; else the text answer
    if (q.options && q.options.length && /^\d+$/.test(String(q.answer))) return q.options[+q.answer];
    return q.answer;
  }
  function resolveOrder(q) {
    // returns correct order as array of option indices
    let ans = q.answer;
    if (!Array.isArray(ans)) ans = String(ans).split(/\s*(?:,|;|>|→|->)\s*/).filter(Boolean);
    // if numeric indices
    if (ans.every(a => /^\d+$/.test(String(a).trim()))) return ans.map(a => +a);
    // else match texts to options
    return ans.map(a => { const i = q.options.findIndex(o => norm(o) === norm(a)); return i >= 0 ? i : 0; });
  }

  // ---------- solution + foot ----------
  function showSolution(q, autoCorrect) {
    const sol = $('#q-solution');
    let solText = q.answer;
    if (q.type === 'multipla') solText = (Array.isArray(q.answer) ? q.answer : [q.answer]).map(i => letter(+i) + '. ' + q.options[+i]).join('  ·  ');
    else if (q.type === 'vero_falso') solText = (norm(q.answer) === 'vero') ? 'Vero' : 'Falso';
    else if (q.type === 'riordino') solText = resolveOrder(q).map((idx, n) => (n + 1) + '. ' + q.options[idx]).join('  →  ');
    else if (q.type === 'abbinamento') solText = answerState && answerState.pairs ? answerState.pairs.map(p => p.l + ' → ' + p.r).join('  ·  ') : q.answer;
    else if (q.type === 'cloze') solText = answerSolText(q);
    const verdict = autoCorrect === true ? '<span class="verdict ok">✓ Corretto</span>' : autoCorrect === false ? '<span class="verdict bad">✗ Da rivedere</span>' : '';
    sol.innerHTML = '<div class="solution">' + verdict +
      '<div class="lab">Soluzione</div><div class="ans">' + esc(solText) + '</div>' +
      '<div>' + esc(q.explanation) + '</div>' +
      '<div class="src">📎 Fonte: ' + esc(q.source) + '</div></div>';
    if (F.oral && !SESSION.sim) speak('La soluzione è: ' + solText);
  }

  function renderFoot(q) {
    const foot = $('#q-foot'); const auto = ['vero_falso', 'multipla', 'riordino', 'abbinamento', 'cloze'].includes(q.type);
    foot.innerHTML =
      '<button class="btn ghost sm tip" data-tip="Rivela la risposta, la spiegazione (il «perché») e la fonte." id="btn-sol">💡 Mostra soluzione</button>' +
      '<div class="seg" id="seg-status"><button class="review tip" data-tip="Marca «da ripassare»: tornerà più spesso e finirà nel Ripasso." data-s="review">Da ripassare</button><button class="know tip" data-tip="«La so»: la rivedrai meno spesso (sale di scatola Leitner)." data-s="know">La so</button></div>' +
      '<button class="btn primary sm tip" data-tip="Vai alla prossima domanda (rivela la soluzione se non l’hai già vista)." id="btn-next" style="margin-left:auto">Prossima ›</button>';
    let revealed = false;
    const reveal = () => {
      if (revealed) return; revealed = true;
      let res = auto ? checkAnswer(q) : null;
      if (auto && res !== null) recordOutcome(q.id, res);
      showSolution(q, res);
      // pre-select segment from outcome
      if (res === true) preselect('know'); else if (res === false) preselect('review');
    };
    $('#btn-sol', foot).onclick = reveal;
    function preselect(s) { $$('#seg-status button', foot).forEach(b => b.classList.toggle('on', b.dataset.s === s)); setStatus(q.id, s, true); }
    $$('#seg-status button', foot).forEach(b => b.onclick = () => { $$('#seg-status button', foot).forEach(x => x.classList.remove('on')); b.classList.add('on'); setStatus(q.id, b.dataset.s, false); });
    const cur = prog.items[q.id]; if (cur && cur.status) $$('#seg-status button', foot).forEach(b => b.classList.toggle('on', b.dataset.s === cur.status));
    $('#btn-next', foot).onclick = () => { reveal(); setTimeout(() => { SESSION.i++; renderQ(); }, 0); };
  }

  function renderDone() {
    stopTimer();
    $('#qcard').innerHTML = '<div class="empty"><div class="big">✓</div><h3>Sessione completata</h3>' +
      '<p class="lead">Hai visto ' + SESSION.list.length + ' domande. Le «da ripassare» restano salvate per la prossima volta.</p>' +
      '<div class="btn-row" style="justify-content:center"><button class="btn primary" id="again">↺ Nuova sessione</button></div></div>';
    $('#again').onclick = endSession; refreshTabsBadges();
  }

  // ---------- TTS ----------
  let voices = [];
  function loadVoices() { voices = (window.speechSynthesis ? speechSynthesis.getVoices() : []).filter(v => /it/i.test(v.lang)); const sel = $('#tts-voice'); if (sel) { sel.innerHTML = voices.length ? voices.map((v, i) => '<option value="' + i + '">' + esc(v.name) + ' (' + v.lang + ')</option>').join('') : '<option>— nessuna voce italiana —</option>'; } }
  function speak(text) {
    if (!window.speechSynthesis) return; speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); u.lang = 'it-IT';
    const sel = $('#tts-voice'); if (voices.length && sel && voices[+sel.value]) u.voice = voices[+sel.value];
    u.rate = .98; speechSynthesis.speak(u);
  }
  if (window.speechSynthesis) { speechSynthesis.onvoiceschanged = loadVoices; }

  // ---------- views ----------
  function showView(v) {
    $$('.view').forEach(s => s.classList.add('hidden'));
    $('#view-' + v).classList.remove('hidden');
    $$('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.view === v));
    if (v === 'ripasso') renderReview();
    if (v === 'dashboard') renderDashboard();
    if (v === 'materiali') renderMaterials();
  }
  $$('#tabs button').forEach(b => b.onclick = () => showView(b.dataset.view));

  // ---------- review complete ----------
  function reviewQuestions() { return DATA.filter(q => { const it = prog.items[q.id]; return it && it.status === 'review'; }); }
  function solutionPlain(q) {
    if (q.type === 'multipla') return (Array.isArray(q.answer) ? q.answer : [q.answer]).map(i => q.options[+i]).join(' · ');
    if (q.type === 'vero_falso') return norm(q.answer) === 'vero' ? 'Vero' : 'Falso';
    if (q.type === 'riordino') return resolveOrder(q).map((idx, n) => (n + 1) + '. ' + q.options[idx]).join(' → ');
    if (q.type === 'cloze' && q.options && q.options.length && /^\d+$/.test(String(q.answer))) return q.options[+q.answer];
    return Array.isArray(q.answer) ? q.answer.join(' · ') : q.answer;
  }
  function renderReview() {
    const list = reviewQuestions(); $('#review-count').textContent = list.length + ' da ripassare';
    const c = $('#review-list');
    if (!list.length) { c.innerHTML = '<div class="panel empty">Nessuna domanda marcata «da ripassare». Marca le domande durante lo studio.</div>'; return; }
    c.innerHTML = list.map(q =>
      '<div class="review-q"><div class="qmeta"><span class="tag topic">' + esc(TOPIC_LABEL[q.topic] || q.topic) + '</span>' +
      (q.defenseAngle ? '<span class="tag angle">' + esc(ANGLE_LABEL[q.defenseAngle] || q.defenseAngle) + '</span>' : '') + '</div>' +
      '<div class="q">' + esc(q.question) + '</div>' +
      '<div class="a"><strong>R:</strong> ' + esc(solutionPlain(q)) + '</div>' +
      '<div class="a">' + esc(q.explanation) + '</div>' +
      '<div class="s">📎 ' + esc(q.source) + '</div></div>').join('');
  }
  $('#btn-print').onclick = () => window.print();
  $('#mat-back').onclick = () => showMatIndex();
  $('#mat-print').onclick = () => window.print();
  $('#btn-export-review').onclick = () => {
    const list = reviewQuestions();
    let md = '# Ripasso completo — domande da ripassare\n\n';
    list.forEach((q, n) => { md += '## ' + (n + 1) + '. ' + q.question + '\n\n- **Topic:** ' + q.topic + (q.defenseAngle ? ' · **Angolo:** ' + q.defenseAngle : '') + '\n- **Risposta:** ' + solutionPlain(q) + '\n- **Perché:** ' + q.explanation + '\n- **Fonte:** ' + q.source + '\n\n'; });
    download('ripasso_da_ripassare.md', md, 'text/markdown');
  };

  // ---------- dashboard ----------
  function renderDashboard() {
    const total = DATA.length, seen = DATA.filter(q => prog.items[q.id] && prog.items[q.id].seen).length;
    const known = DATA.filter(q => prog.items[q.id] && prog.items[q.id].status === 'know').length;
    const review = reviewQuestions().length;
    $('#kpis').innerHTML = kpi(total, 'domande totali') + kpi(seen, 'viste') + kpi(known, 'so', 'var(--ok)') + kpi(review, 'da ripassare', 'var(--orange-d)');
    $('#topic-table').innerHTML = dimTable('topic', TOPIC_LABEL);
    $('#angle-table').innerHTML = dimTable('angle', ANGLE_LABEL);
  }
  function kpi(v, l, color) { return '<div class="kpi"><div class="v"' + (color ? ' style="color:' + color + '"' : '') + '>' + v + '</div><div class="l">' + l + '</div></div>'; }
  function dimTable(dim, labels) {
    const keys = {};
    DATA.forEach(q => { const k = dim === 'angle' ? q.defenseAngle : q[dim]; if (!k) return; (keys[k] = keys[k] || { t: 0, k: 0, r: 0 }).t++; const it = prog.items[q.id]; if (it && it.status === 'know') keys[k].k++; if (it && it.status === 'review') keys[k].r++; });
    let h = '<tr><th>' + (dim === 'angle' ? 'Angolo' : 'Argomento') + '</th><th>Padronanza</th><th>So</th><th>Ripassa</th><th>Tot</th></tr>';
    Object.keys(keys).sort((a, b) => keys[b].t - keys[a].t).forEach(k => {
      const o = keys[k], pct = Math.round(o.k / o.t * 100);
      h += '<tr><td>' + esc(labels[k] || k) + '</td><td>' + pct + '%<div class="bar"><i style="width:' + pct + '%"></i></div></td><td>' + o.k + '</td><td>' + o.r + '</td><td>' + o.t + '</td></tr>';
    });
    return h;
  }

  // ---------- materials (mini markdown) ----------
  const MAT_META = [
    ['defense_brief', '📘', 'Brief di difesa', 'La spina dorsale argomentativa, capitolo per capitolo.'],
    ['domande_giuria', '🎙', 'Domande della giuria', 'Le domande più probabili con risposta modello.'],
    ['punti_deboli', '🛡', 'Punti deboli & contromosse', 'Red-team: gli anelli deboli e come rispondere.'],
    ['cheat_sheet', '🗂', 'Cheat-sheet dei numeri', 'Le statistiche da avere sulla punta della lingua.'],
    ['glossario', '📖', 'Glossario', 'I termini tecnici, una definizione cristallina ciascuno.'],
    ['timeline_contesto', '🗓', 'Timeline 1960–65', 'Il contesto storico-letterario, anno per anno.']
  ];
  let curMat = null;
  function renderMaterials() {
    const avail = MAT_META.filter(m => MATERIALS[m[0]]);
    const cards = $('#mat-cards');
    if (!avail.length) { $('#mat-index').classList.remove('hidden'); $('#mat-reader').classList.add('hidden'); cards.innerHTML = '<div class="panel empty">Materiali non ancora generati.</div>'; return; }
    cards.innerHTML = avail.map(m =>
      '<button class="mat-card" data-k="' + m[0] + '"><div class="ic">' + m[1] + '</div>' +
      '<h3>' + esc(m[2]) + '</h3><p>' + esc(m[3]) + '</p><span class="go">Apri →</span></button>').join('') +
      (window.HAS_SLIDES ? '<a class="mat-card dl" href="slide_difesa.pptx" download><div class="ic">🖥</div><h3>Slide di difesa</h3><p>La scaletta della presentazione (14 slide, PowerPoint).</p><span class="go">Scarica .pptx ↓</span></a>' : '');
    $$('#mat-cards .mat-card[data-k]').forEach(b => b.onclick = () => openMat(b.dataset.k));
    showMatIndex();
  }
  function showMatIndex() { $('#mat-index').classList.remove('hidden'); $('#mat-reader').classList.add('hidden'); }
  function openMat(k) {
    curMat = k;
    const avail = MAT_META.filter(m => MATERIALS[m[0]]);
    $('#mat-index').classList.add('hidden'); $('#mat-reader').classList.remove('hidden');
    $('#mat-nav').innerHTML = avail.map(m => '<button data-k="' + m[0] + '"' + (m[0] === curMat ? ' class="active"' : '') + '>' + esc(m[1] + ' ' + m[2]) + '</button>').join('');
    $$('#mat-nav button').forEach(b => b.onclick = () => openMat(b.dataset.k));
    $('#mat-body').innerHTML = mdToHtml(MATERIALS[curMat] || '');
    window.scrollTo(0, 0);
  }
  function mdToHtml(md) {
    const lines = String(md).replace(/\r/g, '').split('\n'); let html = '', i = 0;
    const inline = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>').replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    while (i < lines.length) {
      let l = lines[i];
      if (/^\s*$/.test(l)) { i++; continue; }
      let m;
      if (m = l.match(/^(#{1,4})\s+(.*)/)) { const n = m[1].length; html += '<h' + n + '>' + inline(m[2]) + '</h' + n + '>'; i++; continue; }
      if (/^\s*([-*]{3,})\s*$/.test(l)) { html += '<hr>'; i++; continue; }
      if (l.indexOf('|') >= 0 && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1])) {
        const rows = []; while (i < lines.length && lines[i].indexOf('|') >= 0) { rows.push(lines[i]); i++; }
        html += renderTable(rows, inline); continue;
      }
      if (/^\s*>/.test(l)) { let bq = ''; while (i < lines.length && /^\s*>/.test(lines[i])) { bq += inline(lines[i].replace(/^\s*>\s?/, '')) + '<br>'; i++; } html += '<blockquote>' + bq + '</blockquote>'; continue; }
      if (/^\s*([-*+]|\d+\.)\s+/.test(l)) {
        const ol = /^\s*\d+\./.test(l); let items = '';
        while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) { items += '<li>' + inline(lines[i].replace(/^\s*([-*+]|\d+\.)\s+/, '')) + '</li>'; i++; }
        html += ol ? '<ol>' + items + '</ol>' : '<ul>' + items + '</ul>'; continue;
      }
      let p = ''; while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^\s*(#{1,4}\s|>|[-*+]\s|\d+\.\s)/.test(lines[i]) && lines[i].indexOf('|') < 0) { p += (p ? ' ' : '') + lines[i]; i++; }
      if (p) html += '<p>' + inline(p) + '</p>'; else i++;
    }
    return html;
  }
  function renderTable(rows, inline) {
    const cells = r => r.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(c => c.trim());
    const head = cells(rows[0]); const body = rows.slice(2).map(cells);
    let h = '<table><thead><tr>' + head.map(c => '<th>' + inline(c) + '</th>').join('') + '</tr></thead><tbody>';
    body.forEach(r => { h += '<tr>' + head.map((_, j) => '<td>' + inline(r[j] || '') + '</td>').join('') + '</tr>'; });
    return h + '</tbody></table>';
  }

  // ---------- export / import / reset ----------
  function download(name, text, type) { const b = new Blob([text], { type: type || 'application/json' }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(u), 1000); }
  $('#btn-export').onclick = () => download('ivoc_progresso.json', JSON.stringify(prog, null, 1));
  $('#imp-file').onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try { const p = JSON.parse(r.result); if (p && p.items) { prog = p; save(); alert('Progresso importato.'); refreshTabsBadges(); } else alert('File non valido.'); } catch (x) { alert('Errore lettura file.'); } }; r.readAsText(f); };
  $('#btn-reset').onclick = () => { if (confirm('Azzerare tutto il progresso (viste, da ripassare, Leitner)?')) { prog = { version: 1, items: {} }; save(); refreshTabsBadges(); alert('Progresso azzerato.'); } };
  $('#tts-test').onclick = () => speak('Prova della voce italiana per la modalità orale.');

  // ---------- badges on tabs ----------
  function refreshTabsBadges() {
    const r = reviewQuestions().length; const btn = $('#tabs button[data-view="ripasso"]');
    btn.textContent = 'Ripasso' + (r ? ' (' + r + ')' : '');
  }

  // ---------- wire setup ----------
  ['t-review', 't-unseen', 't-random', 't-leitner', 't-oral'].forEach(id => {
    const map = { 't-review': 'review', 't-unseen': 'unseen', 't-random': 'random', 't-leitner': 'leitner', 't-oral': 'oral' };
    $('#' + id).onchange = e => { F[map[id]] = e.target.checked; if (id === 't-review' || id === 't-unseen') updateCount(); };
  });
  $('#f-search').oninput = e => { F.search = e.target.value; updateCount(); };
  $('#btn-start').onclick = () => startSession(false);
  $('#btn-sim').onclick = () => startSession(true);
  $('#btn-back').onclick = endSession;

  // ---------- init ----------
  function init() {
    if (!DATA.length) { $('#studio-setup').innerHTML = '<div class="panel empty"><div class="big">⏳</div><h3>Dati non ancora pronti</h3><p class="lead">Il file <code>data.js</code> verrà generato al termine della pipeline.</p></div>'; return; }
    buildChips('f-topic', 'topic', TOPIC_LABEL);
    buildChips('f-type', 'type', TYPE_LABEL);
    buildChips('f-angle', 'angle', ANGLE_LABEL);
    updateCount(); refreshTabsBadges(); loadVoices();
    $('#dataset-info').innerHTML = '<strong>' + DATA.length + '</strong> domande caricate · generato ' + esc(window.QUIZ_BUILD || 'n/d') + '.';
  }
  init();
})();
