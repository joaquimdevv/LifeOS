import { addRecurrence, formatDate, html, isOverdue, makeId, optionalText, requireText, todayLocal } from '../validation.js';

import { $ } from '../dom.js';

const priorities = { low: 'Baixa', medium: 'Média', high: 'Alta', urgent: 'Urgente' };
const statuses = { open: 'A fazer', done: 'Concluída' };

function parseSubtasks(text) {
  return String(text ?? '').split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const done = /^\[x\]\s*/i.test(line);
    return { text: line.replace(/^\[(?:x| )\]\s*/i, '').trim(), done };
  }).filter((item) => item.text);
}

function taskDateLabel(task) {
  if (!task.dueDate) return 'Sem prazo';
  if (isOverdue(task)) return `Atrasada · ${formatDate(task.dueDate)}`;
  if (task.dueDate === todayLocal()) return 'Hoje';
  return formatDate(task.dueDate, { day: 'numeric', month: 'short', year: 'numeric' });
}

export async function renderTasks(vault, view, toast) {
  const runAction = (action) => { action().catch((error) => toast(`Não foi possível concluir: ${error.message}`)); };
  let editingId = '';
  let editorOpen = false;
  let query = '';
  let statusFilter = 'active';
  let priorityFilter = 'all';
  let sortBy = 'dueDate';
  let layout = 'list';
  let calendarMonth = `${todayLocal().slice(0, 7)}-01`;
  let newTaskDate = '';

  async function render() {
    const [tasks, goals] = await Promise.all([vault.list('tasks'), vault.list('goals')]);
    const list = tasks.map(({ id, value }) => ({ ...value, id }));
    const editing = list.find((task) => task.id === editingId);
    const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR');
    const filtered = list.filter((task) => {
      const matchesQuery = !normalizedQuery || `${task.title} ${task.description} ${task.category} ${(task.tags || []).join(' ')}`.toLocaleLowerCase('pt-BR').includes(normalizedQuery);
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? task.status !== 'done' : task.status === statusFilter);
      const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
      return matchesQuery && matchesStatus && matchesPriority;
    }).sort((a, b) => {
      if (sortBy === 'priority') return ['urgent', 'high', 'medium', 'low'].indexOf(a.priority) - ['urgent', 'high', 'medium', 'low'].indexOf(b.priority);
      if (sortBy === 'createdAt') return String(b.createdAt).localeCompare(String(a.createdAt));
      return String(a.dueDate || '9999-12-31').localeCompare(String(b.dueDate || '9999-12-31'));
    });
    const activeCount = list.filter((task) => task.status !== 'done').length;
    const doneCount = list.filter((task) => task.status === 'done').length;
    const overdueCount = list.filter((task) => isOverdue(task)).length;
    const goalOptions = goals.map(({ id, value }) => `<option value="${html(id)}"${editing?.goalId === id ? ' selected' : ''}>${html(value.title)}</option>`).join('');
    const subtasksText = (editing?.subtasks || []).map((item) => `${item.done ? '[x] ' : ''}${item.text}`).join('\n');
    view.innerHTML = `
      <div class="page-heading"><div><p class="eyebrow">ORGANIZAÇÃO</p><h1>Tarefas</h1><p class="muted">Uma lista clara para o próximo passo.</p></div><button id="new-task" type="button" class="button button-primary">＋ Nova tarefa</button></div>
      <section class="metric-strip"><div><strong>${activeCount}</strong><span>em aberto</span></div><div><strong>${overdueCount}</strong><span>atrasadas</span></div><div><strong>${doneCount}</strong><span>concluídas</span></div></section>
      <div class="tasks-layout">
        <section class="module-panel task-list-panel">
          <div class="module-toolbar"><label class="search-field"><span aria-hidden="true">⌕</span><input id="task-search" type="search" placeholder="Buscar tarefas" value="${html(query)}" aria-label="Buscar tarefas"></label><div class="toolbar-filters"><select id="task-status" aria-label="Filtrar por estado"><option value="active"${statusFilter === 'active' ? ' selected' : ''}>Em aberto</option><option value="all"${statusFilter === 'all' ? ' selected' : ''}>Todas</option><option value="done"${statusFilter === 'done' ? ' selected' : ''}>Concluídas</option></select><select id="task-priority" aria-label="Filtrar por prioridade"><option value="all">Todas prioridades</option>${Object.entries(priorities).map(([key, label]) => `<option value="${key}"${priorityFilter === key ? ' selected' : ''}>${label}</option>`).join('')}</select><select id="task-sort" aria-label="Ordenar tarefas"><option value="dueDate"${sortBy === 'dueDate' ? ' selected' : ''}>Prazo</option><option value="priority"${sortBy === 'priority' ? ' selected' : ''}>Prioridade</option><option value="createdAt"${sortBy === 'createdAt' ? ' selected' : ''}>Criação</option></select></div><div class="segmented view-switch" role="group" aria-label="Visualização"><button type="button" data-layout="list" aria-pressed="${layout === 'list'}">Lista</button><button type="button" data-layout="board" aria-pressed="${layout === 'board'}">Quadro</button><button type="button" data-layout="calendar" aria-pressed="${layout === 'calendar'}">Calendário</button></div></div>
          <div id="task-results">${filtered.length || layout === 'calendar' ? layout === 'list' ? `<div class="task-items">${filtered.map((task) => renderTask(task)).join('')}</div>` : layout === 'board' ? renderBoard(filtered) : renderTaskCalendar(filtered) : `<div class="empty-state"><span class="empty-icon">✓</span><h2>${list.length ? 'Nenhuma tarefa encontrada' : 'Sua lista começa aqui'}</h2><p>${list.length ? 'Tente ajustar a busca ou os filtros.' : 'Adicione uma tarefa para transformar uma intenção em próximo passo.'}</p><button type="button" class="button button-secondary" data-empty-new>＋ Criar tarefa</button></div>`}</div>
        </section>
        <section id="task-editor" class="module-panel editor-panel"${editorOpen ? '' : ' hidden'}>
          <div class="editor-heading"><div><p class="eyebrow">${editing ? 'ATUALIZAR' : 'NOVA'}</p><h2>${editing ? 'Editar tarefa' : 'Nova tarefa'}</h2></div><button id="close-task-editor" class="icon-button" type="button" aria-label="Fechar formulário">×</button></div>
          <form id="task-form" class="module-form">
            <label for="task-title">Título</label><input id="task-title" name="title" maxlength="160" required value="${html(editing?.title || '')}" placeholder="Ex.: Preparar material da semana">
            <label for="task-description">Descrição</label><textarea id="task-description" name="description" rows="3" maxlength="2000" placeholder="Detalhes ou contexto">${html(editing?.description || '')}</textarea>
            <div class="form-two"><div><label for="task-priority-input">Prioridade</label><select id="task-priority-input" name="priority">${Object.entries(priorities).map(([key, label]) => `<option value="${key}"${(editing?.priority || 'medium') === key ? ' selected' : ''}>${label}</option>`).join('')}</select></div><div><label for="task-due">Prazo</label><input id="task-due" name="dueDate" type="date" value="${html(editing?.dueDate || newTaskDate)}"></div></div>
            <div class="form-two"><div><label for="task-category">Categoria</label><input id="task-category" name="category" maxlength="60" value="${html(editing?.category || '')}" placeholder="Pessoal, trabalho…"></div><div><label for="task-tags">Etiquetas</label><input id="task-tags" name="tags" value="${html((editing?.tags || []).join(', '))}" placeholder="Separadas por vírgula"></div></div>
            <label for="task-goal">Objetivo vinculado</label><select id="task-goal" name="goalId"><option value="">Sem objetivo</option>${goalOptions}</select>
            <label for="task-recurrence">Repetição</label><select id="task-recurrence" name="recurrence"><option value="none"${(editing?.recurrence || 'none') === 'none' ? ' selected' : ''}>Não se repete</option><option value="daily"${editing?.recurrence === 'daily' ? ' selected' : ''}>Diária</option><option value="weekly"${editing?.recurrence === 'weekly' ? ' selected' : ''}>Semanal</option><option value="monthly"${editing?.recurrence === 'monthly' ? ' selected' : ''}>Mensal</option></select>
            <label for="task-subtasks">Checklist <span class="field-hint">Um item por linha; use [x] no começo para marcar como concluído.</span></label><textarea id="task-subtasks" name="subtasks" rows="3" maxlength="1000" placeholder="Separar materiais\nRevisar rascunho">${html(subtasksText)}</textarea>
            <div class="form-actions"><button type="submit" class="button button-primary">${editing ? 'Salvar alterações' : 'Adicionar tarefa'}</button><button id="cancel-task" type="button" class="button button-quiet">Cancelar</button></div>
            <p id="task-error" class="error-message" role="alert" hidden></p>
          </form>
        </section>
      </div>`;

    view.querySelectorAll('[data-layout]').forEach((button) => button.addEventListener('click', () => { layout = button.dataset.layout; render(); }));
    $('#task-search', view).addEventListener('input', async (event) => { query = event.target.value; const cursor = query.length; await render(); const search = $('#task-search', view); search.focus(); search.setSelectionRange(cursor, cursor); });
    $('#task-status', view).addEventListener('change', (event) => { statusFilter = event.target.value; render(); });
    $('#task-priority', view).addEventListener('change', (event) => { priorityFilter = event.target.value; render(); });
    $('#task-sort', view).addEventListener('change', (event) => { sortBy = event.target.value; render(); });
    $('#new-task', view).addEventListener('click', () => openEditor());
    view.querySelector('[data-empty-new]')?.addEventListener('click', () => openEditor());
    $('#close-task-editor', view)?.addEventListener('click', closeEditor);
    $('#cancel-task', view)?.addEventListener('click', closeEditor);
    $('#task-form', view)?.addEventListener('submit', saveTask);
    view.querySelectorAll('[data-task-edit]').forEach((button) => button.addEventListener('click', () => openEditor(button.dataset.taskEdit)));
    view.querySelectorAll('[data-task-toggle]').forEach((button) => button.addEventListener('click', () => runAction(() => toggleTask(button.dataset.taskToggle))));
    view.querySelectorAll('[data-task-delete]').forEach((button) => button.addEventListener('click', () => runAction(() => deleteTask(button.dataset.taskDelete))));
    view.querySelectorAll('[data-subtask]').forEach((checkbox) => checkbox.addEventListener('change', () => runAction(() => toggleSubtask(checkbox.dataset.subtask, Number(checkbox.dataset.index), checkbox.checked))));
    view.querySelectorAll('[data-task-calendar-nav]').forEach((button) => button.addEventListener('click', () => moveTaskCalendar(Number(button.dataset.taskCalendarNav))));
    view.querySelectorAll('[data-task-cal-add]').forEach((button) => button.addEventListener('click', () => openEditor('', button.dataset.taskCalAdd)));
    view.querySelectorAll('[data-calendar-task]').forEach((button) => button.addEventListener('click', () => openEditor(button.dataset.calendarTask)));
  }

  function renderTask(task) {
    const overdue = isOverdue(task);
    return `<article class="task-row${task.status === 'done' ? ' is-done' : ''}${overdue ? ' is-overdue' : ''}"><button class="task-check" type="button" data-task-toggle="${html(task.id)}" aria-label="${task.status === 'done' ? 'Reabrir' : 'Concluir'}: ${html(task.title)}" aria-pressed="${task.status === 'done'}">${task.status === 'done' ? '✓' : ''}</button><div class="task-main"><div class="task-title-line"><h3>${html(task.title)}</h3><span class="priority-badge priority-${html(task.priority || 'medium')}">${html(priorities[task.priority] || priorities.medium)}</span></div>${task.description ? `<p class="task-description">${html(task.description)}</p>` : ''}<div class="task-meta"><span class="task-date${overdue ? ' overdue-text' : ''}">${html(taskDateLabel(task))}</span>${task.category ? `<span>${html(task.category)}</span>` : ''}${task.goalTitle ? `<span>Objetivo: ${html(task.goalTitle)}</span>` : ''}${task.recurrence && task.recurrence !== 'none' ? `<span aria-label="Recorrente">↻ ${html({ daily: 'Diária', weekly: 'Semanal', monthly: 'Mensal' }[task.recurrence] || '')}</span>` : ''}<span>${(task.subtasks || []).length ? `${task.subtasks.filter((item) => item.done).length}/${task.subtasks.length} itens` : ''}</span></div>${(task.subtasks || []).length ? `<div class="subtask-list">${task.subtasks.map((item, index) => `<label><input type="checkbox" data-subtask="${html(task.id)}" data-index="${index}"${item.done ? ' checked' : ''}><span>${html(item.text)}</span></label>`).join('')}</div>` : ''}${task.tags?.length ? `<div class="tag-list">${task.tags.map((tag) => `<span class="tag">${html(tag)}</span>`).join('')}</div>` : ''}</div><div class="task-actions"><button type="button" class="icon-button" data-task-edit="${html(task.id)}" aria-label="Editar ${html(task.title)}" title="Editar">✎</button><button type="button" class="icon-button danger-action" data-task-delete="${html(task.id)}" aria-label="Excluir ${html(task.title)}" title="Excluir">×</button></div></article>`;
  }

  function renderBoard(tasks) {
    return `<div class="kanban-board">${['open', 'done'].map((status) => `<section class="kanban-column"><h2>${statuses[status]} <span>${tasks.filter((task) => task.status === status).length}</span></h2><div>${tasks.filter((task) => task.status === status).map((task) => `<article class="kanban-card"><div class="task-title-line"><h3>${html(task.title)}</h3><span class="priority-badge priority-${html(task.priority || 'medium')}">${html(priorities[task.priority] || priorities.medium)}</span></div><p class="task-date${isOverdue(task) ? ' overdue-text' : ''}">${html(taskDateLabel(task))}</p><div class="kanban-actions"><button type="button" class="text-button" data-task-toggle="${html(task.id)}">${status === 'done' ? 'Reabrir' : 'Concluir'}</button><button type="button" class="text-button" data-task-edit="${html(task.id)}">Editar</button></div></article>`).join('') || '<p class="muted small-copy">Sem tarefas.</p>'}</div></section>`).join('')}</div>`;
  }

  function renderTaskCalendar(tasks) {
    const [year, month] = calendarMonth.split('-').map(Number);
    const first = `${year}-${String(month).padStart(2, '0')}-01`;
    const weekday = new Date(`${first}T12:00:00`).getDay();
    const start = shiftDate(first, -((weekday + 6) % 7));
    const dates = Array.from({ length: 42 }, (_, index) => shiftDate(start, index));
    const byDate = new Map(dates.map((date) => [date, []]));
    tasks.forEach((task) => { if (byDate.has(task.dueDate)) byDate.get(task.dueDate).push(task); });
    const title = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
    return `<div class="task-calendar"><div class="task-calendar-toolbar"><button type="button" class="icon-button" data-task-calendar-nav="-1" aria-label="Mês anterior">‹</button><h2>${html(title)}</h2><button type="button" class="icon-button" data-task-calendar-nav="1" aria-label="Próximo mês">›</button></div><div class="task-calendar-weekdays"><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span><span>Dom</span></div><div class="task-calendar-days">${dates.map((date) => `<div class="task-calendar-cell${date.slice(0, 7) !== calendarMonth.slice(0, 7) ? ' is-dimmed' : ''}${date === todayLocal() ? ' is-today' : ''}"><button type="button" data-task-cal-add="${date}" aria-label="Adicionar tarefa em ${formatDate(date, { day: 'numeric', month: 'long' })}">${date.slice(-2).replace(/^0/, '')}</button>${byDate.get(date).map((task) => `<button type="button" class="task-calendar-chip${isOverdue(task) ? ' overdue-text' : ''}" data-calendar-task="${html(task.id)}" title="${html(task.title)}">${html(task.title)}</button>`).join('')}</div>`).join('')}</div></div>`;
  }

  function moveTaskCalendar(amount) {
    const [year, month] = calendarMonth.split('-').map(Number);
    const date = new Date(year, month - 1 + amount, 1);
    calendarMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
    render();
  }

  async function openEditor(id = '', date = '') {
    editingId = id;
    newTaskDate = date;
    editorOpen = true;
    await render();
    $('#task-title', view).focus();
    $('#task-editor', view).scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function closeEditor() { editingId = ''; newTaskDate = ''; editorOpen = false; render(); }

  async function saveTask(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(form.entries());
    const error = $('#task-error', view);
    try {
      const id = editingId || makeId();
      const current = editingId ? await vault.get('tasks', editingId) : null;
      const goals = await vault.list('goals');
      const selectedGoal = goals.find((goal) => goal.id === values.goalId);
      const tags = [...new Set(String(values.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean))].slice(0, 12).map((tag) => requireText(tag, 'Etiqueta', 40));
      const next = {
        title: requireText(values.title, 'Título', 160),
        description: optionalText(values.description, 2000),
        priority: Object.hasOwn(priorities, values.priority) ? values.priority : 'medium',
        dueDate: values.dueDate || '', status: current?.status || 'open', completedAt: current?.completedAt || null,
        category: optionalText(values.category, 60), tags,
        goalId: selectedGoal?.id || '', goalTitle: selectedGoal?.value?.title || '',
        recurrence: ['daily', 'weekly', 'monthly'].includes(values.recurrence) ? values.recurrence : 'none',
        subtasks: parseSubtasks(values.subtasks), createdAt: current?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString()
      };
      await vault.save('tasks', id, next);
      editingId = '';
      newTaskDate = '';
      editorOpen = false;
      toast(current ? 'Tarefa atualizada.' : 'Tarefa adicionada.');
      await render();
    } catch (caught) { error.textContent = caught.message; error.hidden = false; }
  }

  async function toggleTask(id) {
    const task = await vault.get('tasks', id);
    if (!task) return;
    if (task.status === 'done') {
      await vault.save('tasks', id, { ...task, status: 'open', completedAt: null, updatedAt: new Date().toISOString() });
      toast('Tarefa reaberta.');
    } else {
      const completedAt = new Date().toISOString();
      await vault.save('tasks', id, { ...task, status: 'done', completedAt, updatedAt: completedAt });
      if (task.recurrence && task.recurrence !== 'none') {
        const baseDate = task.dueDate > todayLocal() ? task.dueDate : todayLocal();
        const next = { ...task, dueDate: addRecurrence(baseDate, task.recurrence), status: 'open', completedAt: null, createdAt: completedAt, updatedAt: completedAt, subtasks: (task.subtasks || []).map((item) => ({ ...item, done: false })) };
        await vault.save('tasks', makeId(), next);
        toast(`Concluída. Próxima tarefa criada para ${formatDate(next.dueDate, { day: 'numeric', month: 'long' })}.`);
      } else toast('Tarefa concluída.');
    }
    await render();
  }

  async function toggleSubtask(id, index, done) {
    const task = await vault.get('tasks', id);
    if (!task?.subtasks?.[index]) return;
    const subtasks = task.subtasks.map((item, itemIndex) => itemIndex === index ? { ...item, done } : item);
    await vault.save('tasks', id, { ...task, subtasks, updatedAt: new Date().toISOString() });
    await render();
  }

  async function deleteTask(id) {
    const task = await vault.get('tasks', id);
    if (!task || !window.confirm(`Excluir “${task.title}”? Esta ação não pode ser desfeita.`)) return;
    await vault.delete('tasks', id);
    toast('Tarefa excluída.');
    await render();
  }

  await render();
}
