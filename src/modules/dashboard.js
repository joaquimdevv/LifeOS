import { formatDate, html, isOverdue, isRecurringOn, shiftDate, todayLocal } from '../validation.js';
import { getDashboardPreferences } from './customization.js';

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
}

export async function renderDashboard(vault, view) {
  const [rawTasks, rawEvents, rawHabits, rawEntries, rawGoals, rawStudy, rawFocus, rawFitness, preferences] = await Promise.all([
    vault.list('tasks'), vault.list('events'), vault.list('habits'), vault.list('habitEntries'), vault.list('goals'),
    vault.list('studySessions'), vault.list('focusSessions'), vault.list('fitnessActivities'), getDashboardPreferences(vault)
  ]);
  const tasks = rawTasks.map(({ id, value }) => ({ ...value, id }));
  const events = rawEvents.map(({ id, value }) => ({ ...value, id }));
  const habits = rawHabits.map(({ id, value }) => ({ ...value, id })).filter((habit) => !habit.archivedAt);
  const goals = rawGoals.map(({ id, value }) => ({ ...value, id })).filter((goal) => goal.status === 'active');
  const today = todayLocal();
  const dueToday = tasks.filter((task) => task.status !== 'done' && task.dueDate === today);
  const overdue = tasks.filter((task) => isOverdue(task, today));
  const priorities = { urgent: 0, high: 1, medium: 2, low: 3 };
  const priorityTasks = [...dueToday, ...overdue].sort((a, b) => (priorities[a.priority] ?? 4) - (priorities[b.priority] ?? 4) || String(a.dueDate).localeCompare(String(b.dueDate))).slice(0, 5);
  const completedEntries = new Set(rawEntries.map(({ value }) => value).filter((entry) => entry.completedAt).map((entry) => `${entry.habitId}|${entry.localDate}`));
  const dueHabits = habits.filter((habit) => habit.frequency === 'daily' || (habit.days || []).includes(new Date(`${today}T12:00:00`).getDay()));
  const upcoming = [];
  for (let offset = 0; offset < 15 && upcoming.length < 5; offset += 1) {
    const date = shiftDate(today, offset);
    for (const event of events) if (isRecurringOn(event, date)) upcoming.push({ event, date, start: event.startAt, allDay: event.allDay });
  }
  upcoming.sort((a, b) => `${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`));
  const activeGoals = goals.sort((a, b) => String(a.targetDate || '9999').localeCompare(String(b.targetDate || '9999'))).slice(0, 4);
  const now = new Date();
  const since = new Date(`${today}T00:00:00`); since.setDate(since.getDate() - 6);
  const recentStudy = rawStudy.map(({ value }) => value).filter((session) => session.startedAt && new Date(session.startedAt) >= since && new Date(session.startedAt) <= now);
  const studyMinutes = recentStudy.reduce((sum, session) => sum + Number(session.minutes || 0), 0);
  const focusMinutes = rawFocus.map(({ value }) => value).filter((session) => session.date >= shiftDate(today, -6) && session.date <= today).reduce((sum, session) => sum + Number(session.minutes || 0), 0);
  const fitnessCount = rawFitness.map(({ value }) => value).filter((item) => item.date >= shiftDate(today, -6) && item.date <= today).length;
  const date = new Date();
  const widgetMarkup = {
    metrics: `<section class="metric-strip dashboard-metrics"><div><strong>${dueToday.length}</strong><span>tarefas para hoje</span></div><div><strong>${overdue.length}</strong><span>tarefas atrasadas</span></div><div><strong>${upcoming.filter((item) => item.date === today).length}</strong><span>eventos hoje</span></div><div><strong>${dueHabits.filter((habit) => !completedEntries.has(`${habit.id}|${today}`)).length}</strong><span>hábitos previstos hoje</span></div></section>`,
    priorities: `<article class="module-panel dashboard-widget"><div class="widget-heading"><div><p class="eyebrow">PRIORIDADES</p><h2>O que pede atenção</h2></div><a class="subtle-link" href="#tasks">Ver tarefas →</a></div>${priorityTasks.length ? `<div class="dashboard-task-list">${priorityTasks.map((task) => `<a class="dashboard-task${isOverdue(task, today) ? ' overdue-text' : ''}" href="#tasks"><span class="dashboard-task-priority priority-${html(task.priority || 'medium')}"></span><span>${html(task.title)}</span><small>${isOverdue(task, today) ? `Atrasada · ${formatDate(task.dueDate)}` : 'Hoje'}</small></a>`).join('')}</div>` : `<p class="widget-empty">Sem tarefas atrasadas ou com prazo hoje. Você pode adicionar uma tarefa quando quiser.</p>`}<a class="button button-secondary" href="#tasks">＋ Adicionar tarefa</a></article>`,
    agenda: `<article class="module-panel dashboard-widget"><div class="widget-heading"><div><p class="eyebrow">AGENDA</p><h2>Próximos eventos</h2></div><a class="subtle-link" href="#calendar">Calendário →</a></div>${upcoming.length ? `<div class="upcoming-list">${upcoming.slice(0, 4).map(({ event, date: eventDate, start, allDay }) => `<div class="upcoming-item"><div class="upcoming-date"><strong>${eventDate.slice(-2).replace(/^0/, '')}</strong><span>${new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(new Date(`${eventDate}T12:00:00`))}</span></div><div><h3>${html(event.title)}</h3><p>${eventDate === today ? 'Hoje' : formatDate(eventDate, { weekday: 'short', day: 'numeric', month: 'short' })}${allDay ? ' · Dia todo' : ` · ${new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(start))}`}</p></div></div>`).join('')}</div>` : `<p class="widget-empty">Nenhum evento programado nos próximos 14 dias.</p>`}<a class="button button-secondary" href="#calendar">＋ Criar evento</a></article>`,
    habits: `<article class="module-panel dashboard-widget"><div class="widget-heading"><div><p class="eyebrow">HÁBITOS</p><h2>Seu ritmo de hoje</h2></div><a class="subtle-link" href="#habits">Ver hábitos →</a></div>${dueHabits.length ? `<div class="dashboard-habits">${dueHabits.slice(0, 5).map((habit) => { const done = completedEntries.has(`${habit.id}|${today}`); return `<div class="dashboard-habit"><span class="habit-mark small-mark" style="--habit-color:${html(habit.color || '#75dbc2')}" aria-hidden="true">${html((habit.name || '?').slice(0, 1).toUpperCase())}</span><span>${html(habit.name)}</span><span class="habit-state${done ? ' is-complete' : ''}">${done ? 'Feito' : 'Previsto'}</span></div>`; }).join('')}</div>` : `<p class="widget-empty">Nenhum hábito previsto hoje. Você pode criar uma rotina na frequência que fizer sentido.</p>`}<a class="button button-secondary" href="#habits">＋ Adicionar hábito</a></article>`,
    goals: `<article class="module-panel dashboard-widget"><div class="widget-heading"><div><p class="eyebrow">OBJETIVOS</p><h2>Direções em andamento</h2></div><a class="subtle-link" href="#goals">Ver objetivos →</a></div>${activeGoals.length ? `<div class="dashboard-goals">${activeGoals.map((goal) => { const progress = goal.milestones?.length ? Math.round(goal.milestones.filter((item) => item.done).length / goal.milestones.length * 100) : Number(goal.progress) || 0; return `<div class="dashboard-goal"><div><h3>${html(goal.title)}</h3><span>${progress}%</span></div><div class="goal-progress-bar"><span style="width:${Math.min(100, Math.max(0, progress))}%"></span></div></div>`; }).join('')}</div>` : `<p class="widget-empty">Seus objetivos aparecem aqui quando você definir um. Os dados são calculados a partir do que registrar.</p>`}<a class="button button-secondary" href="#goals">＋ Criar objetivo</a></article>`,
    insights: `<article class="module-panel dashboard-widget"><div class="widget-heading"><div><p class="eyebrow">ÚLTIMOS 7 DIAS</p><h2>Atividade recente</h2></div><a class="subtle-link" href="#analytics">Estatísticas →</a></div><div class="dashboard-insights"><div><strong>${studyMinutes + focusMinutes} min</strong><span>estudo e foco registrados</span></div><div><strong>${fitnessCount}</strong><span>atividades físicas</span></div><div><strong>${recentStudy.length}</strong><span>sessões de estudo</span></div></div></article>`
  };
  const orderedWidgets = preferences.order.filter((key) => preferences.visible.includes(key)).map((key) => widgetMarkup[key]).filter(Boolean);
  view.innerHTML = `<section class="welcome-block"><div><p class="eyebrow">PAINEL</p><h1>${greeting()}.</h1><p class="muted">Seu dia, organizado no seu dispositivo.</p></div><div class="welcome-actions"><div class="date-card"><span class="date-label">Hoje</span><strong>${new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date)}</strong><span class="muted">${formatDate(today, { weekday: 'long', day: 'numeric', month: 'long' })}</span></div><a class="button button-quiet" href="#customization">Personalizar painel</a></div></section><div class="dashboard-grid">${orderedWidgets.join('')}</div><section class="dashboard-footer"><span>O LifeOS mostra apenas informações registradas por você.</span><a href="#privacy">Dados locais criptografados · Privacidade →</a></section>`;
}
