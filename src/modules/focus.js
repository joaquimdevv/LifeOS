import { html, makeId, optionalText, todayLocal } from '../validation.js';

import { $ } from '../dom.js';

let state = { mode: 'focus', running: false, remaining: 25 * 60, total: 25 * 60, startedAt: 0, elapsedBefore: 0, taskId: '', projectId: '', subjectId: '' };
let intervalId;
let currentView;
let currentToast;
let settings = { focusMinutes: 25, shortBreak: 5, longBreak: 15, sessionsBeforeLong: 4 };

export function pauseFocus() {
  if (intervalId) clearInterval(intervalId);
  intervalId = null;
  if (state.running) { state.elapsedBefore += Math.max(0, Math.floor((Date.now() - state.startedAt) / 1000)); state.remaining = Math.max(0, state.total - state.elapsedBefore); }
  state.running = false;
  updateTimerDisplay();
}

function updateTimerDisplay() {
  const node = currentView?.querySelector('#focus-clock');
  if (!node) return;
  const seconds = Math.max(0, state.remaining);
  node.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  const label = currentView.querySelector('#focus-state-label');
  if (label) label.textContent = state.running ? 'Em andamento' : 'Pausado';
  const start = currentView.querySelector('#focus-start');
  if (start) start.textContent = state.running ? 'Pausar' : state.elapsedBefore ? 'Retomar' : 'Iniciar';
}

function modeSeconds(mode) { return (mode === 'focus' ? settings.focusMinutes : mode === 'short' ? settings.shortBreak : settings.longBreak) * 60; }

export async function renderFocus(vault, view, toast) {
  currentView = view; currentToast = toast;
  const [tasksRaw, projectsRaw, subjectsRaw, sessionsRaw, savedSettings] = await Promise.all([vault.list('tasks'), vault.list('projects'), vault.list('studySubjects'), vault.list('focusSessions'), vault.get('focusSettings', 'timer')]);
  if (savedSettings) settings = { ...settings, ...savedSettings };
  if (!state.running && state.elapsedBefore === 0) state.total = state.remaining = modeSeconds(state.mode);
  const tasks = tasksRaw.map(({ id, value }) => ({ ...value, id })).filter((t) => t.status !== 'done');
  const projects = projectsRaw.map(({ id, value }) => ({ ...value, id }));
  const subjects = subjectsRaw.map(({ id, value }) => ({ ...value, id }));
  const sessions = sessionsRaw.map(({ id, value }) => ({ ...value, id })).sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));
  const minutesToday = sessions.filter((s) => s.date === todayLocal()).reduce((sum, s) => sum + s.minutes, 0);
  const minutesWeek = sessions.filter((s) => { const d = new Date(`${s.date}T12:00:00`); const now = new Date(`${todayLocal()}T12:00:00`); return (now - d) / 86400000 < 7; }).reduce((sum, s) => sum + s.minutes, 0);
  const time = Math.max(0, state.remaining);
  view.innerHTML = `<div class="page-heading"><div><p class="eyebrow">ATENÇÃO PLENA</p><h1>Modo Foco</h1><p class="muted">Blocos de concentração configuráveis, pausas e histórico local.</p></div></div>
    <section class="metric-strip"><div><strong>${minutesToday} min</strong><span>foco hoje</span></div><div><strong>${minutesWeek} min</strong><span>últimos 7 dias</span></div><div><strong>${sessions.length}</strong><span>sessões concluídas</span></div></section>
    <div class="focus-layout"><section class="module-panel focus-panel"><div class="segmented focus-modes" role="group" aria-label="Modo do cronômetro"><button type="button" data-focus-mode="focus" aria-pressed="${state.mode === 'focus'}">Foco</button><button type="button" data-focus-mode="short" aria-pressed="${state.mode === 'short'}">Pausa curta</button><button type="button" data-focus-mode="long" aria-pressed="${state.mode === 'long'}">Pausa longa</button></div><div class="focus-clock-wrap"><span id="focus-clock" class="focus-clock">${String(Math.floor(time / 60)).padStart(2, '0')}:${String(time % 60).padStart(2, '0')}</span><span id="focus-state-label" class="field-hint">${state.running ? 'Em andamento' : 'Pronto quando você estiver'}</span></div><div class="focus-controls"><button id="focus-start" class="button button-primary" type="button">${state.running ? 'Pausar' : state.elapsedBefore ? 'Retomar' : 'Iniciar'}</button><button id="focus-end" class="button button-quiet" type="button"${state.elapsedBefore || state.running ? '' : ' disabled'}>Encerrar sessão</button></div><div class="form-two focus-links"><div><label for="focus-task">Tarefa (opcional)</label><select id="focus-task"><option value="">Sem tarefa</option>${tasks.map((t) => `<option value="${html(t.id)}"${state.taskId === t.id ? ' selected' : ''}>${html(t.title)}</option>`).join('')}</select></div><div><label for="focus-project">Projeto (opcional)</label><select id="focus-project"><option value="">Sem projeto</option>${projects.map((p) => `<option value="${html(p.id)}"${state.projectId === p.id ? ' selected' : ''}>${html(p.name)}</option>`).join('')}</select></div><div><label for="focus-subject">Disciplina (opcional)</label><select id="focus-subject"><option value="">Sem disciplina</option>${subjects.map((s) => `<option value="${html(s.id)}"${state.subjectId === s.id ? ' selected' : ''}>${html(s.name)}</option>`).join('')}</select></div></div></section>
    <aside class="module-panel focus-settings"><h2>Tempos</h2><form id="focus-settings-form" class="module-form"><label for="focus-minutes">Foco (min)</label><input id="focus-minutes" name="focusMinutes" type="number" min="15" max="90" step="5" value="${settings.focusMinutes}"><label for="short-break">Pausa curta (min)</label><input id="short-break" name="shortBreak" type="number" min="3" max="30" value="${settings.shortBreak}"><label for="long-break">Pausa longa (min)</label><input id="long-break" name="longBreak" type="number" min="10" max="60" value="${settings.longBreak}"><label for="sessions-before-long">Sessões antes da pausa longa</label><input id="sessions-before-long" name="sessionsBeforeLong" type="number" min="2" max="8" value="${settings.sessionsBeforeLong}"><button class="button button-secondary" type="submit">Salvar tempos</button><p id="focus-settings-status" class="field-hint" role="status"></p></form></aside></div>
    <section class="module-panel focus-history"><div class="module-panel-heading"><div><p class="eyebrow">HISTÓRICO</p><h2>Sessões concluídas</h2></div></div>${sessions.length ? sessions.slice(0, 30).map((s) => `<article class="study-session"><div><strong>${html(s.taskTitle || s.projectTitle || s.subjectTitle || 'Sessão de foco')}</strong><p>${html(formatFocusDate(s.date))}${s.mode === 'early' ? ' · Encerrada antes do fim' : ''}</p></div><strong>${s.minutes} min</strong></article>`).join('') : '<p class="muted">As sessões registradas aparecerão aqui.</p>'}</section>`;
  view.querySelectorAll('[data-focus-mode]').forEach((button) => button.addEventListener('click', () => { if (state.running || state.elapsedBefore) { currentToast('Encerre a sessão atual antes de trocar o modo.'); return; } state.mode = button.dataset.focusMode; state.total = state.remaining = modeSeconds(state.mode); renderFocus(vault, view, toast); }));
  $('#focus-task', view).addEventListener('change', (e) => { state.taskId = e.target.value; });
  $('#focus-project', view).addEventListener('change', (e) => { state.projectId = e.target.value; });
  $('#focus-subject', view).addEventListener('change', (e) => { state.subjectId = e.target.value; });
  $('#focus-start', view).addEventListener('click', () => { if (state.running) pauseFocus(); else startTimer(); renderFocus(vault, view, toast); });
  $('#focus-end', view).addEventListener('click', () => finishSession(true));
  $('#focus-settings-form', view).addEventListener('submit', saveSettings);

  function startTimer() { if (state.elapsedBefore === 0 && state.remaining === 0) state.remaining = state.total; state.startedAt = Date.now(); state.running = true; intervalId = setInterval(() => { state.remaining = Math.max(0, state.total - state.elapsedBefore - Math.floor((Date.now() - state.startedAt) / 1000)); updateTimerDisplay(); if (state.remaining <= 0) finishSession(false); }, 1000); }
  async function finishSession(early) {
    if (intervalId) clearInterval(intervalId); intervalId = null;
    if (state.running) state.elapsedBefore += Math.floor((Date.now() - state.startedAt) / 1000);
    const elapsed = state.elapsedBefore; state.running = false;
    const mode = state.mode; const minutes = Math.floor(elapsed / 60);
    if (mode === 'focus' && minutes > 0) {
      const task = tasks.find((t) => t.id === state.taskId); const project = projects.find((p) => p.id === state.projectId); const subject = subjects.find((s) => s.id === state.subjectId);
      const record = { minutes, date: todayLocal(), mode: early ? 'early' : 'completed', taskId: state.taskId, taskTitle: task?.title || '', projectId: state.projectId, projectTitle: project?.name || '', subjectId: state.subjectId, subjectTitle: subject?.name || '', finishedAt: new Date().toISOString(), createdAt: new Date().toISOString() };
      try { await vault.save('focusSessions', makeId(), record); if (state.subjectId) await vault.save('studySessions', makeId(), { topic: task?.title || project?.name || 'Sessão de foco', subjectId: state.subjectId, minutes, notes: optionalText('', 1500), startedAt: new Date(Date.now() - elapsed * 1000).toISOString(), createdAt: new Date().toISOString(), source: 'focus' }); toast(early ? `Sessão encerrada: ${minutes} min registrados.` : `Bloco concluído: ${minutes} min de foco.`); }
      catch (error) { toast(`Não foi possível registrar a sessão: ${error.message}`); }
    }
    state.mode = 'focus'; state.total = modeSeconds('focus'); state.remaining = state.total; state.elapsedBefore = 0; renderFocus(vault, view, toast);
  }
  async function saveSettings(event) { event.preventDefault(); const status = $('#focus-settings-status', view); if (state.running || state.elapsedBefore) { status.textContent = 'Encerre a sessão antes de alterar os tempos.'; return; } const v = Object.fromEntries(new FormData(event.currentTarget)); const nums = { focusMinutes: Number(v.focusMinutes), shortBreak: Number(v.shortBreak), longBreak: Number(v.longBreak), sessionsBeforeLong: Number(v.sessionsBeforeLong) }; if (nums.focusMinutes < 15 || nums.focusMinutes > 90 || nums.shortBreak < 3 || nums.shortBreak > 30 || nums.longBreak < 10 || nums.longBreak > 60 || nums.sessionsBeforeLong < 2 || nums.sessionsBeforeLong > 8) { status.textContent = 'Confira os limites informados.'; return; } try { settings = nums; await vault.save('focusSettings', 'timer', settings); state.total = state.remaining = modeSeconds(state.mode); status.textContent = 'Tempos salvos neste cofre.'; renderFocus(vault, view, toast); } catch (error) { status.textContent = `Não foi possível salvar: ${error.message}`; } }
}

function formatFocusDate(date) { return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(`${date}T12:00:00`)); }
