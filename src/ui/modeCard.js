// Mode card: name, dispersion relation (KaTeX), key facts, notes and warnings.

import { richText } from './text.js';

let katex = null;
const katexReady = import('katex')
  .then((m) => {
    katex = m.default ?? m;
  })
  .catch(() => {
    katex = null; // offline: fall back to showing the TeX source
  });

function renderEquation(el, tex) {
  if (katex) {
    katex.render(tex, el, { displayMode: true, throwOnError: false });
  } else {
    el.textContent = tex;
    el.classList.add('tex-fallback');
  }
}

/**
 * Predict-first block. predict = { quiz: {answer, options}, guess: key|null, onGuess }.
 * Returns true when the wave may be revealed (a guess has been made).
 */
function renderQuiz(container, predict) {
  const box = document.createElement('div');
  box.className = 'quiz';
  const q = document.createElement('p');
  q.className = 'quiz-q';
  q.textContent = 'Predict first: which wave do these settings give?';
  const opts = document.createElement('div');
  opts.className = 'quiz-options';
  for (const o of predict.quiz.options) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = o.label;
    if (predict.guess) {
      b.disabled = true;
      if (o.key === predict.quiz.answer) b.classList.add('right');
      else if (o.key === predict.guess) b.classList.add('wrong');
    }
    b.addEventListener('click', () => predict.onGuess(o.key));
    opts.append(b);
  }
  box.append(q, opts);
  if (predict.guess) {
    const fb = document.createElement('p');
    const ok = predict.guess === predict.quiz.answer;
    fb.className = `quiz-feedback ${ok ? 'right' : 'wrong'}`;
    fb.textContent = ok ? 'Right.' : 'Not quite: compare your pick with the description below.';
    box.append(fb);
  }
  container.append(box);
  return Boolean(predict.guess);
}

export function renderModeCard(container, res, predict = null) {
  container.replaceChildren();
  if (predict && !renderQuiz(container, predict)) return;
  if (res.status !== 'mode') return;

  const h = document.createElement('h2');
  h.className = 'mode-name';
  h.textContent = res.name;

  const eq = document.createElement('div');
  eq.className = 'equation';
  renderEquation(eq, res.equation);
  // KaTeX may still be loading on first render
  if (!katex) katexReady.then(() => katex && renderEquation(eq, res.equation));

  const facts = document.createElement('ul');
  facts.className = 'facts';
  for (const f of res.facts) {
    const li = document.createElement('li');
    li.innerHTML = richText(f);
    facts.append(li);
  }

  const callouts = [
    ...res.notes.map((t) => ['note', t]),
    ...res.warnings.map((t) => ['warning', t]),
  ].map(([kind, t]) => {
    const p = document.createElement('p');
    p.className = `callout ${kind}`;
    p.innerHTML = richText(t);
    return p;
  });

  container.append(h, eq, facts, ...callouts);
}

/** Shown in place of the "no wave" overlay until the student has guessed. */
export function predictPlaceholder() {
  const card = document.createElement('div');
  card.className = 'card';
  const p = document.createElement('p');
  p.textContent = 'Make your prediction in the panel on the right (below on a phone) to see what happens.';
  card.append(p);
  return card;
}
