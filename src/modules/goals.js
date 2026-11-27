import { formatDate, html, makeId, optionalText, requireText, todayLocal } from '../validation.js';

import { $ } from '../dom.js';
import { getCustomCategories } from './customization.js';

const horizons = { short: 'Curto prazo', medium: 'Médio prazo', long: 'Longo prazo' };
const statuses = { active: 'Em andamento', completed: 'Concluído', cancelled: 'Cancelado' };

function parseMilestones(value, existing = []) {
  const oldByText = new Map(existing.map((item) => [item.text.toLocaleLowerCase('pt-BR'), item]));
  return String(value ?? '').split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const done = /^\[x\]\s*/i.test(line);
    const text = line.replace(/^\[(?:x| )\]\s*/i, '').trim();
    const previous = oldByText.get(text.toLocaleLowerCase('pt-BR'));
    return { id: previous?.id || makeId(), text, done: done || Boolean(previous?.done) };
  }).filter((item) => item.text).slice(0, 30);
}

function progressFromMilestones(milestones) {
  return milestones.length ? Math.round(milestones.filter((item) => item.done).length / milestones.length * 100) : null;
}

export async function renderGoals(vault, view, toast) {
  const runAction = (action) => { action().catch((error) => toast(`Não foi possível concluir: ${error.message}`)); };
  let editingId = '';
  let editorOpen = false;
  let statusFilter = 'active';

  async function render() {
    const [rawGoals, rawTasks, customCategories] = await Promise.all([vault.list('goals'), vault.list('tasks'), getCustomCategories(vault, 'goals')]);
    const goals = rawGoals.map(({ id, value }) => ({ ...value, id }));
    const tasks = rawTasks.map(({ id, value }) => ({ ...value, id }));
    const filtered = goals.filter((goal) => statusFilter === 'all' || goal.status === statusFilter);
    const editing = goals.find((goal) => goal.id === editingId);
    const activeCount = goals.filter((goal) => goal.status === 'active').length;
    const formMilestones = (editing?.milestones || []).map((item) => `${item.done ? '[x] ' : ''}${item.text}`).join('\n');
    view.innerHTML = `
      <div class="page-heading"><div><p class="eyebrow">DIREÇÃO</p><h1>Objetivos</h1><p class="muted">Marcos ajudam a enxergar progresso; os prazos são opcionais.</p></div><button id="new-goal" class="button button-primary" type="button">＋ Novo objetivo</button></div>
      <section class="metric-strip"><div><strong>${activeCount}</strong><span>em andamento</span></div><div><strong>${goals.filter((goal) => goal.status === 'completed').length}</strong><span>concluídos</span></div><div><strong>${goals.filter((goal) => goal.status === 'cancelled').length}</strong><span>arquivados</span></div></section>
      <div class="module-toolbar goal-toolbar"><div class="segmented" role="group" aria-label="Filtrar objetivos"><button type="button" data-goal-filter="active" aria-pressed="${statusFilter === 'active'}">Ativos</button><button type="button" data-goal-filter="all" aria-pressed="${statusFilter === 'all'}">Todos</button><button type="button" data-goal-filter="completed" aria-pressed="${statusFilter === 'completed'}">Concluídos</button><button type="button" data-goal-filter="cancelled" aria-pressed="${statusFilter === 'cancelled'}">Cancelados</button></div></div>
      <div class="goals-layout"><section class="goal-list">${filtered.length ? filtered.map((goal) => renderGoal(goal, tasks)).join('') : `<div class="module-panel empty-state"><span class="empty-icon">◎</span><h2>${goals.length ? 'Nenhum objetivo neste filtro' : 'Escolha uma direção'}</h2><p>Defina o que quer alcançar e que passos podem aproximar você.</p><button type="button" class="button button-secondary" data-empty-goal>＋ Criar objetivo</button></div>`}</section>
      <section id="goal-editor" class="module-panel editor-panel"${editorOpen ? '' : ' hidden'}><div class="editor-heading"><div><p class="eyebrow">${editing ? 'ATUALIZAR' : 'NOVO'}</p><h2>${editing ? 'Editar objetivo' : 'Novo objetivo'}</h2></div><button id="close-goal-editor" class="icon-button" type="button" aria-label="Fechar formulário">×</button></div><form id="goal-form" class="module-form"><label for="goal-title">Título</label><input id="goal-title" name="title" required maxlength="160" value="${html(editing?.title || '')}" placeholder="Ex.: Concluir curso de fotografia"><label for="goal-description">Descrição</label><textarea id="goal-description" name="description" rows="3" maxlength="2000" placeholder="O que significa alcançar esse objetivo?">${html(editing?.description || '')}</textarea><label for="goal-motivation">Motivação</label><textarea id="goal-motivation" name="motivation" rows="2" maxlength="500" placeholder="Por que isso importa para você?">${html(editing?.motivation || '')}</textarea><div class="form-two"><div><label for="goal-horizon">Horizonte</label><select id="goal-horizon" name="horizon">${Object.entries(horizons).map(([key, label]) => `<option value="${key}"${(editing?.horizon || 'medium') === key ? ' selected' : ''}>${label}</option>`).join('')}</select></div><div><label for="goal-due">Prazo opcional</label><input id="goal-due" name="targetDate" type="date" value="${html(editing?.targetDate || '')}"></div></div><label for="goal-category">Categoria</label><input id="goal-category" name="category" maxlength="60" value="${html(editing?.category || '')}" placeholder="Saúde, carreira…"><label for="goal-milestones">Marcos <span class="field-hint">Um por linha; use [x] no começo para marcar como concluído.</span></label><textarea id="goal-milestones" name="milestones" rows="4" maxlength="2000" placeholder="Pesquisar opções\nMontar um plano\nConcluir primeira etapa">${html(formMilestones)}</textarea><label for="goal-progress">Progresso ${editing?.milestones?.length ? '<span class="field-hint">Será calculado pelos marcos.</span>' : ''}</label><div class="goal-progress-input"><input id="goal-progress" name="progress" type="range" min="0" max="100" step="5" value="${editing?.progress || 0}"${editing?.milestones?.length ? ' disabled' : ''}><output id="goal-progress-value">${editing?.progress || 0}%</output></div><div class="form-actions"><button type="submit" class="button button-primary">${editing ? 'Salvar alterações' : 'Adicionar objetivo'}</button><button id="cancel-goal" type="button" class="button button-quiet">Cancelar</button></div><p id="goal-error" class="error-message" role="alert" hidden></p></form></section></div>`;

    const categoryInput = $('#goal-category', view);
    if (categoryInput) { categoryInput.setAttribute('list', 'goal-categories'); const options = document.createElement('datalist'); options.id = 'goal-categories'; options.innerHTML = customCategories.map((item) => `<option value="${html(item.name)}"></option>`).join(''); categoryInput.after(options); }
    $('#new-goal', view).addEventListener('click', () => openEditor());
    view.querySelector('[data-empty-goal]')?.addEventListener('click', () => openEditor());
    view.querySelectorAll('[data-goal-filter]').forEach((button) => button.addEventListener('click', () => { statusFilter = button.dataset.goalFilter; render(); }));
    $('#goal-progress', view)?.addEventListener('input', (event) => { $('#goal-progress-value', view).textContent = `${event.target.value}%`; });
    $('#goal-milestones', view)?.addEventListener('input', (event) => { const hasMilestones = event.target.value.trim().length > 0; $('#goal-progress', view).disabled = hasMilestones; if (hasMilestones) $('#goal-progress-value', view).textContent = 'Calculado'; });
    $('#close-goal-editor', view)?.addEventListener('click', closeEditor);
    $('#cancel-goal', view)?.addEventListener('click', closeEditor);
    $('#goal-form', view)?.addEventListener('submit', saveGoal);
    view.querySelectorAll('[data-goal-edit]').forEach((button) => button.addEventListener('click', () => openEditor(button.dataset.goalEdit)));
    view.querySelectorAll('[data-goal-status]').forEach((button) => button.addEventListener('click', () => runAction(() => setStatus(button.dataset.goalStatus, button.dataset.statusValue))));
    view.querySelectorAll('[data-goal-delete]').forEach((button) => button.addEventListener('click', () => runAction(() => deleteGoal(button.dataset.goalDelete))));
    view.querySelectorAll('[data-milestone]').forEach((checkbox) => checkbox.addEventListener('change', () => runAction(() => toggleMilestone(checkbox.dataset.goal, checkbox.dataset.milestone, checkbox.checked))));
  }

  function renderGoal(goal, tasks) {
    const milestones = goal.milestones || [];
    const progress = milestones.length ? progressFromMilestones(milestones) : Math.min(100, Math.max(0, Number(goal.progress) || 0));
    const linked = tasks.filter((task) => task.goalId === goal.id);
    const linkedDone = linked.filter((task) => task.status === 'done').length;
    const overdue = goal.targetDate && goal.targetDate < todayLocal();
    return `<article class="module-panel goal-card${goal.status !== 'active' ? ' is-archived' : ''}"><div class="goal-card-header"><div><span class="horizon-badge">${html(horizons[goal.horizon] || horizons.medium)}</span><span class="goal-status status-${html(goal.status)}">${html(statuses[goal.status] || statuses.active)}</span></div><div class="task-actions"><button type="button" class="icon-button" data-goal-edit="${html(goal.id)}" aria-label="Editar ${html(goal.title)}">✎</button><button type="button" class="icon-button danger-action" data-goal-delete="${html(goal.id)}" aria-label="Excluir ${html(goal.title)}">×</button></div></div><h2>${html(goal.title)}</h2>${goal.description ? `<p class="goal-description">${html(goal.description)}</p>` : ''}${goal.motivation ? `<p class="goal-motivation">“${html(goal.motivation)}”</p>` : ''}<div class="goal-progress-meta"><span>Progresso${milestones.length ? ' pelos marcos' : ''}</span><strong>${progress}%</strong></div><div class="goal-progress-bar" role="progressbar" aria-label="Progresso de ${html(goal.title)}" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100"><span style="width:${progress}%"></span></div><div class="goal-details">${goal.category ? `<span>${html(goal.category)}</span>` : ''}${goal.targetDate ? `<span class="${overdue ? 'overdue-text' : ''}">${overdue ? 'Prazo passou' : 'Prazo'} · ${formatDate(goal.targetDate, { day: 'numeric', month: 'short', year: 'numeric' })}</span>` : ''}<span>${linkedDone}/${linked.length} tarefas vinculadas concluídas</span></div>${milestones.length ? `<div class="milestone-list"><h3>Marcos</h3>${milestones.map((item) => `<label class="milestone-item"><input type="checkbox" data-goal="${html(goal.id)}" data-milestone="${html(item.id)}"${item.done ? ' checked' : ''}><span${item.done ? ' class="is-done"' : ''}>${html(item.text)}</span></label>`).join('')}</div>` : ''}<div class="goal-card-footer">${goal.status === 'active' ? `<button type="button" class="text-button" data-goal-status="${html(goal.id)}" data-status-value="completed">Marcar como concluído</button><button type="button" class="text-button muted-action" data-goal-status="${html(goal.id)}" data-status-value="cancelled">Arquivar</button>` : `<button type="button" class="text-button" data-goal-status="${html(goal.id)}" data-status-value="active">Reabrir objetivo</button>`}</div></article>`;
  }

  async function openEditor(id = '') { editingId = id; editorOpen = true; await render(); $('#goal-title', view).focus(); $('#goal-editor', view).scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  function closeEditor() { editingId = ''; editorOpen = false; render(); }

  async function saveGoal(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    const error = $('#goal-error', view);
    try {
      const previous = editingId ? await vault.get('goals', editingId) : null;
      const milestones = parseMilestones(values.milestones, previous?.milestones || []);
      const progress = progressFromMilestones(milestones) ?? Math.min(100, Math.max(0, Number(values.progress) || 0));
      const id = editingId || makeId();
      const title = requireText(values.title, 'Título', 160);
      const history = [...(previous?.history || [])];
      if (!previous || progress !== previous.progress || title !== previous.title) history.push({ at: new Date().toISOString(), progress, note: previous ? 'Objetivo atualizado' : 'Objetivo criado' });
      const next = { title, description: optionalText(values.description, 2000), motivation: optionalText(values.motivation, 500), horizon: Object.hasOwn(horizons, values.horizon) ? values.horizon : 'medium', targetDate: values.targetDate || '', category: optionalText(values.category, 60), status: previous?.status || 'active', progress, milestones, history, createdAt: previous?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
      await vault.save('goals', id, next);
      editingId = '';
      editorOpen = false;
      toast(previous ? 'Objetivo atualizado.' : 'Objetivo adicionado.');
      await render();
    } catch (caught) { error.textContent = caught.message; error.hidden = false; }
  }

  async function toggleMilestone(goalId, milestoneId, done) {
    const goal = await vault.get('goals', goalId);
    if (!goal) return;
    const milestones = (goal.milestones || []).map((item) => item.id === milestoneId ? { ...item, done } : item);
    const progress = progressFromMilestones(milestones) ?? goal.progress;
    const history = [...(goal.history || []), { at: new Date().toISOString(), progress, note: 'Marco atualizado' }];
    await vault.save('goals', goalId, { ...goal, milestones, progress, history, updatedAt: new Date().toISOString() });
    toast('Marco atualizado.');
    await render();
  }

  async function setStatus(id, status) {
    const goal = await vault.get('goals', id);
    if (!goal || !Object.hasOwn(statuses, status)) return;
    const at = new Date().toISOString();
    const history = [...(goal.history || []), { at, progress: goal.progress, note: `Status: ${statuses[status]}` }];
    await vault.save('goals', id, { ...goal, status, history, updatedAt: at });
    toast(status === 'completed' ? 'Objetivo concluído.' : status === 'cancelled' ? 'Objetivo arquivado.' : 'Objetivo reaberto.');
    await render();
  }

  async function deleteGoal(id) {
    const goal = await vault.get('goals', id);
    if (!goal || !window.confirm(`Excluir “${goal.title}”? As tarefas vinculadas permanecerão e serão desvinculadas. Esta ação não pode ser desfeita.`)) return;
    const tasks = await vault.list('tasks');
    for (const task of tasks.filter(({ value }) => value.goalId === id)) await vault.save('tasks', task.id, { ...task.value, goalId: '', goalTitle: '', updatedAt: new Date().toISOString() });
    await vault.delete('goals', id);
    toast('Objetivo excluído; tarefas vinculadas foram preservadas.');
    await render();
  }

  await render();
}
