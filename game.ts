import { element as $, input, select } from './dom';
function field(id: string): HTMLInputElement | HTMLSelectElement {
  const el = $(id);
  if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement))
    throw new Error(`Expected field #${id}`);
  return el;
}
function details(id: string): HTMLDetailsElement {
  const el = $(id);
  if (!(el instanceof HTMLDetailsElement)) throw new Error(`Expected details #${id}`);
  return el;
}
function fieldset(id: string): HTMLFieldSetElement {
  const el = $(id);
  if (!(el instanceof HTMLFieldSetElement)) throw new Error(`Expected fieldset #${id}`);
  return el;
}
function progress(id: string): HTMLProgressElement {
  const el = $(id);
  if (!(el instanceof HTMLProgressElement)) throw new Error(`Expected progress #${id}`);
  return el;
}
import { FieldState } from './state';
import { FieldVisuals } from './visuals';
import { lessons } from './lessons';
import { experiments } from './experiments';

function button(id: string): HTMLButtonElement {
  const el = $(id);
  if (!(el instanceof HTMLButtonElement)) throw new Error(`Expected button #${id}`);
  return el;
}

(() => {
  'use strict';
  const key = 'wilson-field-lab-v2';
  let state: ReturnType<typeof FieldState.empty>,
    hints = 0,
    zoom = false,
    announcement: ReturnType<typeof setTimeout> | undefined,
    lastWidth = 0,
    lastScale = 0;
  try {
    state = FieldState.restore(
      localStorage.getItem(key),
      localStorage.getItem('wilson-field-lab-v1'),
    );
  } catch {
    state = FieldState.empty();
  }
  const id = () =>
    state.section === 0 && state.step >= 5 ? state.step + 20 : state.section * 5 + state.step;
  const done = () => state.solved.includes(id());
  function save() {
    try {
      localStorage.setItem(key, JSON.stringify(state));
      $('storage-status').textContent = '';
    } catch {
      $('storage-status').textContent =
        'Progress cannot be saved in this browser. You can still explore this session.';
    }
  }
  const announce = (text: string) => {
    $('announcer').textContent = text;
  };
  const sectionCount = (i: number) =>
    state.solved.filter((n) => (i === 0 ? n < 5 || n >= 25 : Math.floor(n / 5) === i)).length;
  function chrome() {
    const stages: [number, string][] =
      state.section === 0
        ? [
            [0, '1 · Geometry'],
            [5, '2 · Load lines'],
            [6, '3 · Conductor'],
            [7, '4 · Grading'],
            [1, '5 · Explain'],
            [4, '6 · New case'],
          ]
        : [
            [0, '1 · Experiment'],
            [1, '2 · Explain'],
            [4, '3 · New case'],
          ];
    $('stages').innerHTML = stages
      .map(
        ([n, label]) =>
          `<button type="button" data-stage="${n}">${label}${state.solved.includes(n >= 5 ? n + 20 : state.section * 5 + n) ? ' ✓' : ''}</button>`,
      )
      .join('');
    $('stages')
      .querySelectorAll('button')
      .forEach((b) => (b.onclick = () => navigate(state.section, Number(b.dataset.stage))));
    $('sections')
      .querySelectorAll('button')
      .forEach((b, i) => {
        b.setAttribute('aria-current', i === state.section ? 'step' : 'false');
        b.querySelector('.count')!.textContent = `${sectionCount(i)}/${i === 0 ? 8 : 5}`;
      });
    select('section-select').value = String(state.section);
    $('stages')
      .querySelectorAll('button')
      .forEach((b) =>
        b.setAttribute(
          'aria-current',
          Number(b.dataset.stage) === (state.step > 0 && state.step < 4 ? 1 : state.step)
            ? 'step'
            : 'false',
        ),
      );
    progress('progress').value = state.solved.length;
    $('progress-label').textContent = `${state.solved.length}/28 complete`;
    $('score').hidden = !state.xp;
    $('score').textContent = `${state.solved.length * 10} participation XP`;
    input('xp-toggle').checked = state.xp;
  }
  function navigate(section: number, step: number) {
    state.section = section;
    state.step = step;
    render(true);
  }
  function render(focus = false) {
    clearTimeout(announcement);
    hints = 0;
    lastWidth = 0;
    const s = lessons[state.section];
    chrome();
    save();
    $('stages').hidden = false;
    $('part-label').textContent = `${s.number} · ${s.name}`;
    $('lesson-heading').textContent = s.title;
    $('page-ref').textContent = `Book pp. ${s.pages} · Figures ↓`;
    document.body.dataset.lessonSection = String(state.section);
    document.body.dataset.lessonStep = String(state.step);
    document.body.dataset.geometryLength = String(state.values[0]);
    document.body.dataset.lessonStage = String(state.section === 0 ? state.step : -1);
    $('design-desk').hidden = !(state.section === 0 && state.step >= 5);
    $('playground').hidden = !(state.section === 0 && state.step === 6);
    $('integrated-next').hidden = state.step < 5;
    if (state.step >= 5) integrated();
    else if (state.step === 0) lab();
    else if (state.step < 4) quiz();
    else transfer();
    document.dispatchEvent(new Event('lesson-stage'));
    if (focus) $('lesson-heading').focus({ preventScroll: false });
  }
  const feedbackMarkup = () =>
    '<div id="feedback" role="status" aria-live="polite" aria-atomic="true"></div>';
  function feedback(pass: boolean, title: string, message: string) {
    $('feedback').className = pass ? 'feedback success' : 'feedback retry';
    $('feedback').innerHTML = `<strong>${title}</strong><p>${message}</p>`;
  }
  function award() {
    if (!done()) state.solved.push(id());
    chrome();
    save();
  }
  function table(rows: (string | number)[][]) {
    return `<table><caption>Sampled values for the current model</caption><thead><tr><th scope="col">Position / resolution</th><th scope="col">Field / error</th></tr></thead><tbody>${rows.map(([a, b]) => `<tr><th scope="row">${a}</th><td>${b}</td></tr>`).join('')}</tbody></table>`;
  }
  function lab() {
    const i = state.section,
      s = lessons[i],
      e = experiments[i],
      v = state.values[i],
      predicted = state.predictions[i],
      unlocked = predicted !== null || done();
    const primary = e.options
      ? `<select id="parameter" aria-describedby="fixed">${e.options.map(([n, label]) => `<option value="${n}">${label}</option>`).join('')}</select>`
      : `<input id="parameter" type="range" min="${e.min}" max="${e.max}" step="${e.step}" value="${v}" aria-describedby="fixed"><label class="number-label" for="exact-value">Exact value (${e.unit})<input id="exact-value" type="number" min="${e.min}" max="${e.max}" step="${e.step}" value="${v}"></label>`;
    $('mission').innerHTML =
      `<p class="goal"><span class="eyebrow">Your experiment</span>${e.goal}</p><div class="bench"><div id="sketch" class="sketch"></div><section class="tools" aria-label="Experiment controls">
      <details id="prediction-panel" ${unlocked ? '' : 'open'}><summary id="prediction-summary">${predicted === null ? 'Predict before you try' : predicted === -1 ? 'Free exploration' : `Your prediction: ${e.choices[predicted]}`}</summary><label for="prediction">${e.prediction}</label><select id="prediction"><option value="">Choose a prediction…</option>${e.choices.map((c, j) => `<option value="${j}">${c}</option>`).join('')}</select><button id="free" type="button" class="quiet">Or explore freely</button></details>
      <fieldset id="control-fields" ${unlocked ? '' : 'disabled'}><legend class="sr-only">Adjust the experiment</legend><label for="parameter">${e.label}${e.unit ? ` (${e.unit})` : ''}</label><div class="parameter-row"><button type="button" id="minus" aria-label="Decrease ${e.label.toLowerCase()}">−</button><div class="parameter-main">${primary}</div><button type="button" id="plus" aria-label="Increase ${e.label.toLowerCase()}">+</button></div>
      ${i === 1 ? '<label for="probe">Probe position x/a (y = 0)</label><input id="probe" type="range" min="0" max="0.8" step="0.05"><label class="number-label" for="probe-number">Exact probe x/a<input id="probe-number" type="number" min="0" max="0.8" step="0.05"></label>' : ''}</fieldset>
      <p id="input-error" role="alert"></p><div id="readout" class="readout"></div><div id="measurement-explanation"></div><p id="fixed" class="fixed">${e.fixed}</p><div class="actions"><button id="check" type="button" class="primary" ${unlocked ? '' : 'disabled'}>Test design</button><button id="hint-button" type="button">Hint 1 of 3</button></div><p id="hint" class="hint" role="status"></p>${feedbackMarkup()}
      <div class="actions secondary"><button id="keep" type="button" ${unlocked ? '' : 'disabled'}>Keep this design</button><button id="reset" type="button">Reset experiment</button></div><p id="comparison" class="comparison"></p><button id="clear-kept" type="button" class="quiet" ${state.kept[i] === null ? 'hidden' : ''}>Remove comparison</button>
      </section><section class="plot-area" aria-label="Field plot">${i === 0 ? '<label class="check-label"><input type="checkbox" id="zoom"> Zoom to working region</label>' : ''}<div id="plot"></div><p id="legend" class="legend"></p><p id="caption" class="caption"></p></section></div>
      <details class="explanation"><summary>Read the field & inspect the model</summary><p id="trend"></p><p>${s.intro}</p><p class="formula" aria-hidden="true">${s.formula}</p><p>${e.spoken}</p><p>${s.model}</p><div id="data-table"></div></details><div class="next-row"><span>${done() ? '✓ Experiment previously completed. Keep exploring.' : 'Test a design to record this experiment.'}</span><button id="next" type="button">Continue to explanations →</button></div>`;
    field('parameter').value = String(v);
    select('prediction').value = String(predicted === null || predicted === -1 ? '' : predicted);
    const unlock = (p: number) => {
      state.predictions[i] = p;
      details('prediction-panel').open = false;
      $('prediction-summary').textContent =
        p === -1 ? 'Free exploration' : `Your prediction: ${e.choices[p]}`;
      fieldset('control-fields').disabled = false;
      button('check').disabled = false;
      button('keep').disabled = false;
      save();
      field('parameter').focus();
      announce(
        p === -1
          ? 'Explore freely. The controls are ready.'
          : 'Prediction recorded. Test it with the controls.',
      );
    };
    select('prediction').onchange = () => {
      if (select('prediction').value !== '') unlock(+select('prediction').value);
    };
    $('free').onclick = () => unlock(-1);
    field('parameter').oninput = () => setValue(+field('parameter').value);
    field('parameter').onchange = settle;
    if (document.getElementById('exact-value'))
      input('exact-value').onchange = () => {
        const el = input('exact-value');
        if (!el.checkValidity() || el.value === '') {
          $('input-error').textContent =
            `Enter ${e.min}–${e.max} ${e.unit}, in steps of ${e.step}.`;
          return;
        }
        setValue(+el.value);
        settle();
      };
    for (const [button, direction] of [
      ['minus', -1],
      ['plus', 1],
    ] as [string, number][])
      $(button).onclick = () => {
        const value = e.options
          ? e.options[
              Math.max(
                0,
                Math.min(
                  e.options.length - 1,
                  e.options.findIndex((o) => o[0] === state.values[i]) + direction,
                ),
              )
            ][0]
          : Math.max(e.min!, Math.min(e.max!, state.values[i] + direction * e.step!));
        setValue(+Number(value).toFixed(4));
        settle();
      };
    if (i === 1) {
      input('probe').oninput = () => setProbe(+input('probe').value);
      input('probe').onchange = settle;
      input('probe-number').onchange = () => {
        const el = input('probe-number');
        if (el.value === '' || !el.checkValidity()) {
          $('input-error').textContent = 'Enter a probe position from 0 to 0.8 in steps of 0.05.';
          return;
        }
        setProbe(+el.value);
        settle();
      };
    }
    if (document.getElementById('zoom')) {
      input('zoom').checked = zoom;
      input('zoom').onchange = () => {
        zoom = input('zoom').checked;
        draw();
        settle();
      };
    }
    $('hint-button').onclick = () => {
      $('hint').textContent = e.hints[hints];
      hints = Math.min(2, hints + 1);
      $('hint-button').textContent = hints === 2 ? 'Worked example' : `Hint ${hints + 1} of 3`;
    };
    button('check').onclick = () => {
      const ok = FieldVisuals.pass(i, state.values[i]),
        p = state.predictions[i];
      if (ok) award();
      feedback(
        ok,
        ok ? (i === 0 ? 'Field requirements met.' : 'Design meets the brief.') : 'Not there yet.',
        ok
          ? `${s.success} ${p !== null && p !== -1 ? `Your prediction (${e.choices[p]}) ${p === e.answer ? 'matched' : 'did not match'} the model. ${e.discovery}` : e.discovery}`
          : `${currentView().summary} ${i === 4 && state.values[i] > 64 ? 'The tolerance is met, but a smaller offered count also meets it.' : 'Compare these readings with the goal, or reveal a hint.'}`,
      );
    };
    button('keep').onclick = () => {
      state.kept[i] = state.values[i];
      save();
      draw();
      settle();
    };
    $('clear-kept').onclick = () => {
      state.kept[i] = null;
      save();
      draw();
      button('keep').focus();
      settle();
    };
    $('reset').onclick = () => {
      state.values[i] = e.start;
      state.kept[i] = null;
      state.predictions[i] = null;
      if (i === 1) state.probe = 0.4;
      render(true);
      announce('Experiment reset. Completed exercises are kept.');
    };
    if (i === 0) $('next').textContent = 'Continue to load lines →';
    $('next').onclick = () => navigate(i, i === 0 ? 5 : 1);
    let dragging: string | null = null;
    $('sketch').onpointerdown = (event) => {
      const target =
        event.target instanceof Element ? event.target.closest<HTMLElement>('[data-drag]') : null;
      if (!target || fieldset('control-fields').disabled) return;
      dragging = target.dataset.drag ?? null;
      $('sketch').setPointerCapture(event.pointerId);
      event.preventDefault();
    };
    $('sketch').onpointermove = (event) => {
      if (!dragging) return;
      const rect = $('sketch').getBoundingClientRect(),
        value = FieldVisuals.dragValue(i, dragging, event.clientX - rect.left, rect.width);
      if (dragging === 'probe') setProbe(Math.round(Math.max(0, Math.min(0.8, value)) * 20) / 20);
      else if (e.min !== undefined && e.max !== undefined && e.step !== undefined)
        setValue(
          +(Math.round(Math.max(e.min!, Math.min(e.max!, value)) / e.step) * e.step).toFixed(4),
        );
    };
    $('sketch').onpointerup = () => {
      dragging = null;
      settle();
    };
    $('sketch').onpointercancel = () => {
      dragging = null;
    };
    draw();
  }
  function integrated() {
    const stages: Record<number, [string, string, string]> = {
        5: [
          'The conductor sets the limit',
          'For this separate book load-line example, reach at least 4.0 T with at least 20% current margin. Follow the peak-field load line, not just the useful centre field.',
          'Conductor',
        ],
        6: [
          'Build a winding the wire can carry',
          'Meet your selected field target and axial tolerance, fit the wire into the winding pack, and retain at least 20% estimated current margin. All three checks must pass.',
          'Grading',
        ],
        7: [
          'Use different wires at one series current',
          'Make at least 5.0 T with at least 20% current margin in both zones. Use thinner wire in the lower-field outer zone than in the inner zone.',
          'Explain',
        ],
      },
      [title, goal, next] = stages[state.step];
    $('lesson-heading').textContent = title;
    $('mission').innerHTML =
      `<p class="goal"><span class="eyebrow">Your experiment · §3.1</span>${goal}</p>`;
    $('integrated-next').innerHTML =
      `<div class="actions"><button id="integrated-check" class="primary" type="button">Test this stage</button></div><div id="integrated-feedback" role="status"></div><div class="next-row"><span>${done() ? '✓ Stage previously completed' : 'Test your design to record this stage.'}</span><button id="integrated-continue" type="button">Continue to ${next.toLowerCase()} →</button></div>`;
    $('integrated-check').onclick = () => {
      const check = { stage: state.step, pass: false, message: '' };
      document.dispatchEvent(new CustomEvent('check-design-stage', { detail: check }));
      if (check.pass) award();
      $('integrated-feedback').textContent =
        `${check.pass ? '✓ Stage complete.' : 'Not yet.'} ${check.message}`;
    };
    $('integrated-continue').onclick = () => navigate(0, state.step === 7 ? 1 : state.step + 1);
  }
  function currentView() {
    return FieldVisuals.render(
      state.section,
      state.values[state.section],
      state.kept[state.section],
      state.probe,
      zoom,
      Math.max(200, $('plot').clientWidth),
      parseFloat(getComputedStyle(document.documentElement).fontSize) / 16,
    );
  }
  function draw() {
    if (state.step !== 0 || !document.getElementById('plot')) return;
    const view = currentView(),
      i = state.section,
      e = experiments[i],
      v = state.values[i];
    $('sketch').innerHTML = view.sketch;
    $('plot').innerHTML = view.graph;
    $('measurement-explanation').innerHTML = view.explanation;
    $('readout').innerHTML = view.readout
      .map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`)
      .join('');
    for (const [target, value] of [
      ['trend', view.summary],
      ['legend', view.legend + (state.kept[i] !== null ? ' · dashed curve / ◇: kept design' : '')],
      ['caption', view.caption],
      ['comparison', view.compare],
    ])
      $(target).textContent = value;
    $('data-table').innerHTML = table(view.rows);
    $('clear-kept').hidden = state.kept[i] === null;
    field('parameter').value = String(v);
    if (document.getElementById('exact-value') && document.activeElement !== input('exact-value'))
      input('exact-value').value = String(v);
    field('parameter').setAttribute(
      'aria-valuetext',
      e.options ? String(e.options.find((o) => o[0] === v)?.[1] ?? v) : `${v} ${e.unit}`,
    );
    if (document.getElementById('probe')) {
      input('probe').value = String(state.probe);
      if (document.activeElement !== input('probe-number'))
        input('probe-number').value = String(state.probe);
      input('probe').setAttribute(
        'aria-valuetext',
        `${state.probe.toFixed(2)} bore radii along x; y equals zero`,
      );
    }
  }
  function setValue(value: number) {
    if (!FieldState.valid(state.section, value)) return;
    state.values[state.section] = value;
    $('input-error').textContent = '';
    $('feedback').innerHTML = '';
    draw();
    save();
    clearTimeout(announcement);
    announcement = setTimeout(settle, 400);
  }
  function setProbe(value: number) {
    state.probe = value;
    $('input-error').textContent = '';
    draw();
    save();
    clearTimeout(announcement);
    announcement = setTimeout(settle, 400);
  }
  function settle() {
    clearTimeout(announcement);
    if (state.step === 0 && document.getElementById('plot')) {
      const view = currentView();
      announce(`${view.summary} ${view.compare}`);
    }
  }
  function nextStep() {
    if (state.step < 4) navigate(state.section, state.step + 1);
    else if (state.section < 4) navigate(state.section + 1, 0);
    else debrief();
  }
  function choices(options: string[]) {
    return `<div class="choices">${options.map((o, i) => `<button type="button" data-answer="${i}" aria-pressed="false"><span class="letter">${'ABC'[i]}</span><span>${o}</span><span class="answer-state"></span></button>`).join('')}</div>`;
  }
  function bindChoices(q: { answer: number; why: string; wrong?: string[] }) {
    $('mission')
      .querySelectorAll<HTMLButtonElement>('[data-answer]')
      .forEach(
        (b) =>
          (b.onclick = () => {
            const ok = Number(b.dataset.answer) === q.answer;
            $('mission')
              .querySelectorAll<HTMLButtonElement>('[data-answer]')
              .forEach((x) => {
                x.className = '';
                x.setAttribute('aria-pressed', 'false');
                x.querySelector('.answer-state')!.textContent = '';
              });
            b.className = ok ? 'correct' : 'wrong';
            b.setAttribute('aria-pressed', 'true');
            b.querySelector('.answer-state')!.textContent = ok ? '✓ Correct' : 'Try again';
            if (ok) award();
            feedback(
              ok,
              ok ? 'That reasoning holds.' : 'Try another explanation.',
              ok
                ? q.why
                : q.wrong?.[Number(b.dataset.answer)] ||
                    'Check the ratio and what the measurements actually establish.',
            );
          }),
      );
  }
  function quiz() {
    const s = lessons[state.section],
      q = s.questions[state.step - 1];
    $('mission').innerHTML =
      `<div class="quiz"><nav class="question-nav" aria-label="Explanation questions">${s.questions.map((_, j) => `<button type="button" data-question="${j + 1}" aria-current="${j + 1 === state.step ? 'step' : 'false'}">Idea ${j + 1}${state.solved.includes(state.section * 5 + j + 1) ? ' ✓' : ''}</button>`).join('')}</nav><p class="eyebrow">Explain what you observed</p><h2>${q.title}</h2><p class="question">${q.q}</p>${choices(q.options)}${feedbackMarkup()}<details><summary>Read the concept</summary><p>${q.lesson}</p></details><div class="next-row"><span>${done() ? '✓ Previously completed' : 'You can revisit an experiment at any time.'}</span><button type="button" id="next">${state.step === 3 ? 'Try a new case →' : 'Next idea →'}</button></div><p class="muted">Reading connection: ${q.ref}</p></div>`;
    $('mission')
      .querySelectorAll<HTMLButtonElement>('[data-question]')
      .forEach((b) => (b.onclick = () => navigate(state.section, Number(b.dataset.question))));
    bindChoices(q);
    $('next').onclick = nextStep;
  }
  function transfer() {
    const q = experiments[state.section].transfer;
    $('mission').innerHTML =
      `<div class="quiz"><p class="eyebrow">Transfer your intuition</p><h2>A fresh specification</h2><p class="question">${q.q}</p>${q.table ? table(q.table) : ''}${q.options ? choices(q.options) : `<form id="transfer-form"><label for="transfer-value">Your answer (${q.unit})</label><div class="answer-entry"><input id="transfer-value" type="number" step="any" required min="0" inputmode="decimal"><button type="submit" class="primary">Check reasoning</button></div></form>`}${feedbackMarkup()}<p class="muted">Try this without a hint first. The Experiment and Explain stages remain available.</p><div class="next-row"><span>${done() ? '✓ Previously completed' : 'A correct new-case answer records one exercise.'}</span><button id="next" type="button">${state.section === 4 ? 'Chapter debrief →' : 'Next section →'}</button></div></div>`;
    if (q.options) bindChoices(q);
    else
      $('transfer-form').onsubmit = (event) => {
        event.preventDefault();
        const value = +input('transfer-value').value,
          ok = Number.isFinite(value) && Math.abs(value - q.value) <= q.tolerance;
        if (ok) award();
        feedback(
          ok,
          ok ? 'You transferred the idea.' : 'Revisit the relationship.',
          ok
            ? q.why
            : 'Check which quantity changed and which stayed fixed. You can return to the experiment, compare two settings, and try again.',
        );
      };
    $('next').onclick = nextStep;
  }
  function debrief() {
    clearTimeout(announcement);
    $('lesson-heading').textContent = 'Your field toolkit';
    $('stages').hidden = true;
    $('mission').innerHTML =
      `<div class="quiz"><p>${state.solved.length}/28 exercises complete. Completion records practice, not demonstrated long-term mastery.</p><div class="review-list">${lessons.map((s, i) => `<button type="button" data-review="${i}">${s.number} ${s.name} · ${sectionCount(i)}/${i === 0 ? 8 : 5}</button>`).join('')}</div><h2>Test your explanation</h2><p>Choose a setting you have not tried. Before changing it, say what should happen, what stays fixed, and which part of the field this model cannot establish. Then check the plot.</p></div>`;
    $('mission')
      .querySelectorAll<HTMLButtonElement>('[data-review]')
      .forEach(
        (b) =>
          (b.onclick = () => {
            const i = Number(b.dataset.review),
              first = (i === 0 ? [0, 5, 6, 7, 1, 2, 3, 4] : [0, 1, 2, 3, 4]).find(
                (j) => !state.solved.includes(j >= 5 ? j + 20 : i * 5 + j),
              );
            navigate(i, first ?? 0);
          }),
      );
    $('lesson-heading').focus();
  }
  $('sections').innerHTML = lessons
    .map(
      (s, i) =>
        `<button type="button" data-section="${i}"><span>${s.number} ${s.name}</span><span class="count"></span></button>`,
    )
    .join('');
  select('section-select').innerHTML = lessons
    .map((s, i) => `<option value="${i}">${s.number} ${s.name}</option>`)
    .join('');
  $('sections')
    .querySelectorAll('button')
    .forEach((b) => (b.onclick = () => navigate(Number(b.dataset.section), 0)));
  select('section-select').onchange = () => navigate(+select('section-select').value, 0);
  $('stages')
    .querySelectorAll('button')
    .forEach((b) => (b.onclick = () => navigate(state.section, Number(b.dataset.stage))));
  // Completion is historical; a previous check must not describe newly edited settings.
  for (const type of ['input', 'change', 'click'])
    document.addEventListener(type, (e) => {
      if (
        state.step >= 5 &&
        e.target instanceof Element &&
        e.target.closest('#design-desk, #playground')
      )
        $('integrated-feedback').textContent = '';
    });
  input('xp-toggle').onchange = () => {
    state.xp = input('xp-toggle').checked;
    chrome();
    save();
  };
  $('restart').onclick = () => {
    if (!confirm('Clear this browser’s chapter progress, predictions, and saved comparisons?'))
      return;
    state = FieldState.empty();
    zoom = false;
    const menu = $('restart').closest('details');
    if (menu) menu.open = false;
    document.dispatchEvent(new Event('chapter-reset'));
    render(true);
  };
  let resizeFrame = 0;
  new ResizeObserver((entries) => {
    const width = entries[0].contentRect.width,
      scale = parseFloat(getComputedStyle(document.documentElement).fontSize);
    if (width !== lastWidth || scale !== lastScale) {
      lastWidth = width;
      lastScale = scale;
      // Keep layout writes out of ResizeObserver delivery to avoid resize loops.
      if (!resizeFrame)
        resizeFrame = requestAnimationFrame(() => {
          resizeFrame = 0;
          draw();
        });
    }
  }).observe($('mission'));
  render();
})();
