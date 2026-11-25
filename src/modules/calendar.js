import { formatDate, html, isRecurringOn, localDateFromInstant, localDateTimeValue, makeId, fromLocalDateTime, requireText, optionalText, shiftDate, todayLocal } from '../validation.js';

const weekdays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const repeatLabels = { none: 'Não se repete', daily: 'Diário', weekly: 'Semanal', monthly: 'Mensal' };

function mondayOf(dateOnly) {
  const weekday = new Date(`${dateOnly}T12:00:00`).getDay();
  return shiftDate(dateOnly, -((weekday + 6) % 7));
}

function eventInstance(event, dateOnly) {
  const originalDate = localDateFromInstant(event.startAt);
  const original = new Date(event.startAt);
  const [year, month, day] = dateOnly.split('-').map(Number);
  const start = new Date(year, month - 1, day, original.getHours(), original.getMinutes(), 0, 0);
  const duration = Math.max(0, new Date(event.endAt).getTime() - original.getTime());
  const end = new Date(start.getTime() + duration);
  return { ...event, dateOnly, originalDate, start, end };
}

export async function renderCalendar(vault, view, toast) {
  const runAction = (action) => { action().catch((error) => toast(`Não foi possível concluir: ${error.message}`)); };
  let anchorDate = todayLocal();
  let mode = 'month';
  let editingId = '';
  let editorOpen = false;
  let formDate = todayLocal();
  let categoryFilter = 'all';

  async function render() {
    const [rawEvents, rawTasks] = await Promise.all([vault.list('events'), vault.list('tasks')]);
    const events = rawEvents.map(({ id, value }) => ({ ...value, id }));
    const categories = [...new Set(events.map((event) => event.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const tasks = rawTasks.map(({ id, value }) => ({ ...value, id })).filter((task) => task.status !== 'done' && task.dueDate);
    let rangeStart;
    let visibleDates;
    let heading;
    if (mode === 'month') {
      const [year, month] = anchorDate.split('-').map(Number);
      const first = `${year}-${String(month).padStart(2, '0')}-01`;
      rangeStart = mondayOf(first);
      visibleDates = Array.from({ length: 42 }, (_, index) => shiftDate(rangeStart, index));
      heading = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
    } else if (mode === 'week') {
      rangeStart = mondayOf(anchorDate);
      visibleDates = Array.from({ length: 7 }, (_, index) => shiftDate(rangeStart, index));
      heading = `${formatDate(visibleDates[0], { day: 'numeric', month: 'short' })} — ${formatDate(visibleDates[6], { day: 'numeric', month: 'short', year: 'numeric' })}`;
    } else {
      rangeStart = anchorDate;
      visibleDates = [anchorDate];
      heading = formatDate(anchorDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }
    const rangeEnd = visibleDates.at(-1);
    const eventsByDate = new Map(visibleDates.map((date) => [date, []]));
    for (const event of events) {
      if (categoryFilter !== 'all' && (event.category || '') !== categoryFilter) continue;
      for (const date of visibleDates) {
        if (isRecurringOn(event, date)) eventsByDate.get(date).push(eventInstance(event, date));
      }
    }
    eventsByDate.forEach((items) => items.sort((a, b) => a.start - b.start));
    const tasksByDate = new Map(visibleDates.map((date) => [date, []]));
    tasks.filter((task) => task.dueDate >= rangeStart && task.dueDate <= rangeEnd).forEach((task) => tasksByDate.get(task.dueDate).push(task));
    const [editId, edit] = editingId ? [editingId, events.find((event) => event.id === editingId)] : ['', null];
    const startValue = edit ? localDateTimeValue(edit.startAt) : `${formDate}T09:00`;
    const endValue = edit ? localDateTimeValue(edit.endAt) : `${formDate}T10:00`;
    const dayCells = visibleDates.map((date) => {
      const selectedMonth = anchorDate.slice(0, 7);
      const current = date === todayLocal();
      const dimmed = mode === 'month' && date.slice(0, 7) !== selectedMonth;
      const dayItems = eventsByDate.get(date) || [];
      const dayTasks = tasksByDate.get(date) || [];
      return `<div class="calendar-cell${current ? ' is-today' : ''}${dimmed ? ' is-dimmed' : ''}${mode === 'day' ? ' is-day-cell' : ''}" data-calendar-date="${date}"><button class="calendar-date" type="button" data-calendar-add="${date}" aria-label="Adicionar evento em ${formatDate(date, { day: 'numeric', month: 'long', year: 'numeric' })}">${date.slice(-2).replace(/^0/, '')}${mode !== 'month' ? `<span>${weekdays[(new Date(`${date}T12:00:00`).getDay() + 6) % 7]}</span>` : ''}</button><div class="calendar-items">${dayItems.slice(0, mode === 'month' ? 3 : 20).map((instance) => `<button type="button" class="calendar-event" data-event-edit="${html(instance.id)}" title="${html(instance.title)}${instance.recurrence !== 'none' ? ` · ${html(repeatLabels[instance.recurrence])}` : ''}"><span class="event-time">${instance.allDay ? 'Dia todo' : new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(instance.start)}</span><span class="event-title">${html(instance.title)}</span></button>`).join('')}${dayItems.length > (mode === 'month' ? 3 : 20) ? `<span class="calendar-more">+ ${dayItems.length - 3} eventos</span>` : ''}${dayTasks.slice(0, mode === 'month' ? 2 : 10).map((task) => `<a class="calendar-task" href="#tasks" title="Prazo: ${html(task.title)}"><span aria-hidden="true">◇</span>${html(task.title)}</a>`).join('')}${dayTasks.length > (mode === 'month' ? 2 : 10) ? `<span class="calendar-more">+ ${dayTasks.length - (mode === 'month' ? 2 : 10)} prazos</span>` : ''}</div></div>`;
    }).join('');
    const weekdayHeaders = mode === 'day' ? '' : weekdays.map((day) => `<span>${day}</span>`).join('');
    view.innerHTML = `
      <div class="page-heading"><div><p class="eyebrow">PLANEJAMENTO</p><h1>Calendário</h1><p class="muted">Eventos e prazos em um só lugar.</p></div><button id="new-event" class="button button-primary" type="button">＋ Novo evento</button></div>
      <section class="module-panel calendar-panel"><div class="calendar-toolbar"><div class="calendar-navigation"><button id="calendar-prev" class="icon-button" type="button" aria-label="Período anterior">‹</button><h2>${html(heading)}</h2><button id="calendar-next" class="icon-button" type="button" aria-label="Próximo período">›</button><button id="calendar-today" class="button button-quiet" type="button">Hoje</button></div><div class="calendar-options"><label class="sr-only" for="calendar-category">Filtrar eventos por categoria</label><select id="calendar-category" class="select-control"><option value="all">Todas categorias</option><option value=""${categoryFilter === '' ? ' selected' : ''}>Sem categoria</option>${categories.map((category) => `<option value="${html(category)}"${categoryFilter === category ? ' selected' : ''}>${html(category)}</option>`).join('')}</select><div class="segmented" role="group" aria-label="Visualização do calendário"><button type="button" data-calendar-mode="day" aria-pressed="${mode === 'day'}">Dia</button><button type="button" data-calendar-mode="week" aria-pressed="${mode === 'week'}">Semana</button><button type="button" data-calendar-mode="month" aria-pressed="${mode === 'month'}">Mês</button></div></div></div><div class="calendar-grid ${mode === 'month' ? 'month-grid' : mode === 'week' ? 'week-grid' : 'day-grid'}" style="--calendar-columns:${mode === 'day' ? 1 : 7}">${weekdayHeaders ? `<div class="calendar-weekdays">${weekdayHeaders}</div>` : ''}<div class="calendar-days">${dayCells}</div></div><div class="calendar-legend"><span><i class="legend-event"></i> Eventos</span><span><i class="legend-task"></i> Prazo de tarefa</span><span>Repetições aparecem em cada ocorrência; um único evento é salvo.</span></div></section>
      <section id="event-editor" class="module-panel event-editor"${editorOpen ? '' : ' hidden'}><div class="editor-heading"><div><p class="eyebrow">${edit ? 'ATUALIZAR' : 'NOVO'}</p><h2>${edit ? 'Editar evento' : 'Novo evento'}</h2></div><button id="close-event-editor" class="icon-button" type="button" aria-label="Fechar formulário">×</button></div><form id="event-form" class="module-form event-form"><div class="form-two"><div><label for="event-title">Título</label><input id="event-title" name="title" maxlength="160" required value="${html(edit?.title || '')}" placeholder="Ex.: Conversa com equipe"></div><div><label for="event-category">Categoria</label><input id="event-category" name="category" maxlength="60" value="${html(edit?.category || '')}" placeholder="Pessoal, trabalho…"></div></div><div class="form-two"><div><label for="event-start">Início</label><input id="event-start" name="startAt" type="datetime-local" required value="${html(startValue)}"></div><div><label for="event-end">Fim</label><input id="event-end" name="endAt" type="datetime-local" required value="${html(endValue)}"></div></div><div class="form-two"><div><label for="event-repeat">Repetição</label><select id="event-repeat" name="recurrence">${Object.entries(repeatLabels).map(([key, label]) => `<option value="${key}"${(edit?.recurrence || 'none') === key ? ' selected' : ''}>${label}</option>`).join('')}</select></div><label class="inline-check"><input type="checkbox" name="allDay"${edit?.allDay ? ' checked' : ''}><span>Dia inteiro</span></label></div><label for="event-description">Descrição</label><textarea id="event-description" name="description" rows="2" maxlength="2000">${html(edit?.description || '')}</textarea><div class="form-actions"><button type="submit" class="button button-primary">${edit ? 'Salvar evento' : 'Adicionar evento'}</button><button id="cancel-event" type="button" class="button button-quiet">Cancelar</button>${edit ? '<button id="delete-event" type="button" class="button button-danger">Excluir</button>' : ''}</div><p id="event-error" class="error-message" role="alert" hidden></p></form></section>`;

    view.querySelectorAll('[data-calendar-mode]').forEach((button) => button.addEventListener('click', () => { mode = button.dataset.calendarMode; render(); }));
    $('#calendar-category', view).addEventListener('change', (event) => { categoryFilter = event.target.value; render(); });
    $('#calendar-prev', view).addEventListener('click', () => move(-1));
    $('#calendar-next', view).addEventListener('click', () => move(1));
    $('#calendar-today', view).addEventListener('click', () => { anchorDate = todayLocal(); render(); });
    $('#new-event', view).addEventListener('click', () => openEditor('', anchorDate));
    view.querySelectorAll('[data-calendar-add]').forEach((button) => button.addEventListener('click', () => openEditor('', button.dataset.calendarAdd)));
    view.querySelectorAll('[data-event-edit]').forEach((button) => button.addEventListener('click', () => openEditor(button.dataset.eventEdit, anchorDate)));
    $('#close-event-editor', view)?.addEventListener('click', closeEditor);
    $('#cancel-event', view)?.addEventListener('click', closeEditor);
    $('#event-form', view)?.addEventListener('submit', saveEvent);
    $('#delete-event', view)?.addEventListener('click', () => runAction(deleteEvent));
  }

  function move(amount) {
    const [year, month] = anchorDate.split('-').map(Number);
    if (mode === 'month') {
      const date = new Date(year, month - 1 + amount, 1);
      anchorDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
    } else anchorDate = shiftDate(anchorDate, amount * (mode === 'week' ? 7 : 1));
    render();
  }

  async function openEditor(id = '', date = todayLocal()) { editingId = id; editorOpen = true; formDate = date; await render(); $('#event-title', view).focus(); $('#event-editor', view).scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  function closeEditor() { editingId = ''; editorOpen = false; render(); }

  async function saveEvent(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const id = editingId || makeId();
      const previous = editingId ? await vault.get('events', editingId) : null;
      const startAt = fromLocalDateTime(values.startAt);
      const endAt = fromLocalDateTime(values.endAt);
      if (new Date(endAt) < new Date(startAt)) throw new Error('O fim deve acontecer depois do início.');
      const next = { title: requireText(values.title, 'Título', 160), description: optionalText(values.description, 2000), category: optionalText(values.category, 60), startAt, endAt, allDay: new FormData(event.currentTarget).has('allDay'), recurrence: ['daily', 'weekly', 'monthly'].includes(values.recurrence) ? values.recurrence : 'none', createdAt: previous?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
      await vault.save('events', id, next);
      editingId = '';
      editorOpen = false;
      toast(previous ? 'Evento atualizado.' : 'Evento adicionado.');
      await render();
    } catch (error) { const node = $('#event-error', view); node.textContent = error.message; node.hidden = false; }
  }

  async function deleteEvent() {
    const event = await vault.get('events', editingId);
    if (!event || !window.confirm(`Excluir “${event.title}” e todas as ocorrências? Esta ação não pode ser desfeita.`)) return;
    await vault.delete('events', editingId);
    editingId = '';
    editorOpen = false;
    toast('Evento excluído.');
    await render();
  }

  await render();
}
