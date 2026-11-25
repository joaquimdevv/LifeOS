import { dueToday, formatDate, html, makeId, optionalText, requireText, shiftDate, todayLocal } from '../validation.js';

import { $ } from '../dom.js';

const weekdays = [{ day: 1, short: 'S', name: 'Segunda' }, { day: 2, short: 'T', name: 'Terça' }, { day: 3, short: 'Q', name: 'Quarta' }, { day: 4, short: 'Q', name: 'Quinta' }, { day: 5, short: 'S', name: 'Sexta' }, { day: 6, short: 'S', name: 'Sábado' }, { day: 0, short: 'D', name: 'Domingo' }];
const defaultColor = '#75dbc2';

function mondayOf(dateOnly) {
  const weekday = new Date(`${dateOnly}T12:00:00`).getDay();
  return shiftDate(dateOnly, -((weekday + 6) % 7));
}

export async function renderHabits(vault, view, toast) {
  const runAction = (action) => { action().catch((error) => toast(`Não foi possível concluir: ${error.message}`)); };
  let editingId = '';
  let editorOpen = false;

  async function render() {
    const [rawHabits, rawEntries] = await Promise.all([vault.list('habits'), vault.list('habitEntries')]);
    const habits = rawHabits.map(({ id, value }) => ({ ...value, id })).filter((habit) => !habit.archivedAt);
    const entries = rawEntries.map(({ id, value }) => ({ ...value, id }));
    const today = todayLocal();
    const startWeek = mondayOf(today);
    const weekDates = Array.from({ length: 7 }, (_, index) => shiftDate(startWeek, index));
    const completed = new Set(entries.filter((entry) => entry.completedAt).map((entry) => `${entry.habitId}|${entry.localDate}`));
    const editing = habits.find((habit) => habit.id === editingId);
    const dueCount = habits.filter((habit) => dueToday(habit, today)).length;
    const completeToday = habits.filter((habit) => completed.has(`${habit.id}|${today}`)).length;
    view.innerHTML = `
      <div class="page-heading"><div><p class="eyebrow">ROTINA</p><h1>Hábitos</h1><p class="muted">Acompanhe o que faz sentido para você, sem transformar pausas em fracasso.</p></div><button id="new-habit" type="button" class="button button-primary">＋ Novo hábito</button></div>
      <section class="metric-strip"><div><strong>${completeToday}</strong><span>marcados hoje</span></div><div><strong>${dueCount}</strong><span>previstos para hoje</span></div><div><strong>${habits.length}</strong><span>hábitos ativos</span></div></section>
      <div class="habits-layout"><section class="module-panel habit-list-panel"><div class="module-panel-heading"><div><p class="eyebrow">ESTA SEMANA</p><h2>Seu ritmo, no seu tempo</h2></div><span class="field-hint">${formatDate(weekDates[0], { day: 'numeric', month: 'short' })} — ${formatDate(weekDates[6], { day: 'numeric', month: 'short' })}</span></div>
        ${habits.length ? `<div class="habit-list">${habits.map((habit) => {
          const due = dueToday(habit, today);
          const isDone = completed.has(`${habit.id}|${today}`);
          const weekCompleted = weekDates.filter((date) => completed.has(`${habit.id}|${date}`)).length;
          const days = Array.from({ length: 28 }, (_, index) => shiftDate(today, index - 27));
          return `<article class="habit-row"><div class="habit-mark" style="--habit-color:${html(habit.color || defaultColor)}" aria-hidden="true">${html((habit.name || '?').slice(0, 1).toUpperCase())}</div><div class="habit-content"><div class="habit-heading"><div><h3>${html(habit.name)}</h3><p>${html(habit.category || 'Sem categoria')} · ${habit.frequency === 'daily' ? 'Todos os dias' : (habit.days || []).map((day) => weekdays.find((item) => item.day === day)?.short).filter(Boolean).join(' ')} · Meta ${habit.weeklyTarget || 1}× / semana</p></div><div class="habit-actions"><button type="button" class="icon-button" data-habit-edit="${html(habit.id)}" aria-label="Editar ${html(habit.name)}">✎</button><button type="button" class="icon-button danger-action" data-habit-delete="${html(habit.id)}" aria-label="Excluir ${html(habit.name)}">×</button></div></div><div class="habit-week">${weekDates.map((date, index) => {
            const dayNo = new Date(`${date}T12:00:00`).getDay();
            const wasDone = completed.has(`${habit.id}|${date}`);
            return `<div class="habit-day${date === today ? ' is-current' : ''}${wasDone ? ' is-complete' : ''}" title="${weekdays.find((item) => item.day === dayNo)?.name} ${formatDate(date, { day: 'numeric', month: 'short' })}"><span>${weekdays.find((item) => item.day === dayNo)?.short}</span><i>${wasDone ? '✓' : '·'}</i></div>`;
          }).join('')}</div><div class="habit-foot"><div class="consistency-calendar" aria-label="Últimos 28 dias">${days.map((date) => `<i class="consistency-day${completed.has(`${habit.id}|${date}`) ? ' is-complete' : ''}" title="${formatDate(date, { day: 'numeric', month: 'short', year: 'numeric' })}${completed.has(`${habit.id}|${date}`) ? ': concluído' : ''}"></i>`).join('')}</div><span class="habit-week-count">${weekCompleted} / ${habit.weeklyTarget || 1} esta semana</span><button class="habit-check${isDone ? ' is-done' : ''}" type="button" data-habit-check="${html(habit.id)}" aria-pressed="${isDone}" aria-label="${isDone ? 'Desmarcar' : 'Marcar'} ${html(habit.name)} como concluído hoje"${!due && !isDone ? ' title="Este hábito não está previsto para hoje"' : ''}>${isDone ? '✓ Feito hoje' : 'Marcar hoje'}</button></div></div></article>`;
        }).join('')}</div>` : `<div class="empty-state"><span class="empty-icon">◌</span><h2>Crie um ritmo possível</h2><p>Adicione um hábito e escolha a frequência que combina com sua rotina.</p><button type="button" class="button button-secondary" data-empty-habit>＋ Criar hábito</button></div>`}
      </section>
      <section id="habit-editor" class="module-panel editor-panel"${editorOpen ? '' : ' hidden'}><div class="editor-heading"><div><p class="eyebrow">${editing ? 'ATUALIZAR' : 'NOVO'}</p><h2>${editing ? 'Editar hábito' : 'Novo hábito'}</h2></div><button id="close-habit-editor" class="icon-button" type="button" aria-label="Fechar formulário">×</button></div><form id="habit-form" class="module-form"><label for="habit-name">Nome</label><input id="habit-name" name="name" required maxlength="100" value="${html(editing?.name || '')}" placeholder="Ex.: Alongar pela manhã"><label for="habit-category">Categoria</label><input id="habit-category" name="category" maxlength="60" value="${html(editing?.category || '')}" placeholder="Bem-estar, estudo…"><label for="habit-frequency">Frequência</label><select id="habit-frequency" name="frequency"><option value="daily"${(editing?.frequency || 'daily') === 'daily' ? ' selected' : ''}>Diária</option><option value="specific"${editing?.frequency === 'specific' ? ' selected' : ''}>Dias específicos</option></select><fieldset id="habit-days-field" class="weekday-picker"${(editing?.frequency || 'daily') === 'daily' ? ' hidden' : ''}><legend>Dias da semana</legend>${weekdays.map((item) => `<label><input type="checkbox" name="days" value="${item.day}"${(editing?.days || []).includes(item.day) ? ' checked' : ''}><span>${item.short}</span><em class="sr-only">${item.name}</em></label>`).join('')}</fieldset><div class="form-two"><div><label for="habit-target">Meta semanal</label><select id="habit-target" name="weeklyTarget">${Array.from({ length: 7 }, (_, index) => index + 1).map((number) => `<option value="${number}"${(editing?.weeklyTarget || 3) === number ? ' selected' : ''}>${number} vez${number > 1 ? 'es' : ''}</option>`).join('')}</select></div><div><label for="habit-color">Cor</label><input id="habit-color" name="color" type="color" value="${html(editing?.color || defaultColor)}"></div></div><div class="form-actions"><button type="submit" class="button button-primary">${editing ? 'Salvar alterações' : 'Adicionar hábito'}</button><button id="cancel-habit" type="button" class="button button-quiet">Cancelar</button></div><p id="habit-error" class="error-message" role="alert" hidden></p></form></section></div>`;

    $('#new-habit', view).addEventListener('click', () => openEditor());
    view.querySelector('[data-empty-habit]')?.addEventListener('click', () => openEditor());
    $('#close-habit-editor', view)?.addEventListener('click', closeEditor);
    $('#cancel-habit', view)?.addEventListener('click', closeEditor);
    $('#habit-form', view)?.addEventListener('submit', saveHabit);
    $('#habit-frequency', view)?.addEventListener('change', (event) => { $('#habit-days-field', view).hidden = event.target.value === 'daily'; });
    view.querySelectorAll('[data-habit-check]').forEach((button) => button.addEventListener('click', () => runAction(() => toggleToday(button.dataset.habitCheck))));
    view.querySelectorAll('[data-habit-edit]').forEach((button) => button.addEventListener('click', () => openEditor(button.dataset.habitEdit)));
    view.querySelectorAll('[data-habit-delete]').forEach((button) => button.addEventListener('click', () => runAction(() => deleteHabit(button.dataset.habitDelete))));
  }

  async function openEditor(id = '') { editingId = id; editorOpen = true; await render(); $('#habit-name', view).focus(); $('#habit-editor', view).scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  function closeEditor() { editingId = ''; editorOpen = false; render(); }

  async function saveHabit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    try {
      const previous = editingId ? await vault.get('habits', editingId) : null;
      const selectedDays = [...form.querySelectorAll('input[name="days"]:checked')].map((input) => Number(input.value));
      if (values.frequency === 'specific' && !selectedDays.length) throw new Error('Escolha ao menos um dia da semana.');
      const id = editingId || makeId();
      const next = { name: requireText(values.name, 'Nome', 100), category: optionalText(values.category, 60), frequency: values.frequency === 'specific' ? 'specific' : 'daily', days: values.frequency === 'specific' ? selectedDays : [], weeklyTarget: Math.min(7, Math.max(1, Number(values.weeklyTarget) || 1)), color: /^#[0-9a-fA-F]{6}$/.test(values.color) ? values.color : defaultColor, createdAt: previous?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(), archivedAt: previous?.archivedAt || null };
      await vault.save('habits', id, next);
      editingId = '';
      editorOpen = false;
      toast(previous ? 'Hábito atualizado.' : 'Hábito adicionado.');
      await render();
    } catch (error) { const node = $('#habit-error', view); node.textContent = error.message; node.hidden = false; }
  }

  async function toggleToday(id) {
    const habit = await vault.get('habits', id);
    if (!habit) return;
    const date = todayLocal();
    const entryId = `${id}:${date}`;
    const entry = await vault.get('habitEntries', entryId);
    await vault.save('habitEntries', entryId, { habitId: id, localDate: date, completedAt: entry?.completedAt ? null : new Date().toISOString() });
    toast(entry?.completedAt ? 'Marcação de hoje removida; seu histórico foi mantido.' : 'Hábito marcado para hoje.');
    await render();
  }

  async function deleteHabit(id) {
    const habit = await vault.get('habits', id);
    if (!habit || !window.confirm(`Excluir “${habit.name}” e seu histórico? Esta ação não pode ser desfeita.`)) return;
    const entries = await vault.list('habitEntries');
    const related = entries.filter(({ value }) => value.habitId === id).map((entry) => ({ collection: 'habitEntries', id: entry.id }));
    await vault.deleteBatch([...related, { collection: 'habits', id }]);
    toast('Hábito e histórico excluídos.');
    await render();
  }

  await render();
}
