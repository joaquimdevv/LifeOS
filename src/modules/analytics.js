import { html, localDateFromInstant, shiftDate, todayLocal } from '../validation.js';
import { $ } from '../dom.js';

function daySeries(days, values) {
  const today = todayLocal();
  return Array.from({ length: days }, (_, index) => {
    const date = shiftDate(today, index - days + 1);
    return { date, value: Number(values.get(date) || 0) };
  });
}

function barChart(series, label, unit = '') {
  const max = Math.max(1, ...series.map((point) => point.value));
  const width = 760; const height = 180; const pad = { left: 34, right: 12, top: 12, bottom: 26 };
  const chartWidth = width - pad.left - pad.right; const chartHeight = height - pad.top - pad.bottom;
  const step = chartWidth / series.length; const barWidth = Math.max(2, Math.min(20, step * 0.62));
  const bars = series.map((point, index) => {
    const barHeight = point.value ? Math.max(2, point.value / max * chartHeight) : 0;
    const x = pad.left + index * step + (step - barWidth) / 2; const y = pad.top + chartHeight - barHeight;
    const day = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' }).format(new Date(`${point.date}T12:00:00`));
    return `<g><title>${html(day)}: ${point.value}${html(unit)}</title><rect class="analytics-bar" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${barHeight.toFixed(1)}" rx="2"/></g>`;
  }).join('');
  const ticks = [0, .5, 1].map((fraction) => { const y = pad.top + chartHeight * (1 - fraction); const value = Math.round(max * fraction); return `<g class="analytics-axis"><line x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}"/><text x="${pad.left - 7}" y="${y + 3}" text-anchor="end">${value}</text></g>`; }).join('');
  const labels = [0, Math.floor(series.length / 2), series.length - 1].map((i) => { const x = pad.left + i * step + step / 2; const date = series[i].date; return `<text class="analytics-date" x="${x}" y="${height - 6}" text-anchor="middle">${date.slice(5)}</text>`; }).join('');
  return `<svg class="analytics-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${html(label)}">${ticks}${bars}${labels}</svg>`;
}

export async function renderAnalytics(vault, view) {
  let days = 30;
  async function render() {
    const [tasksRaw, sessionsRaw, focusRaw, activitiesRaw, habitsRaw, entriesRaw, goalsRaw, projectsRaw, subjectsRaw] = await Promise.all([
      vault.list('tasks'), vault.list('studySessions'), vault.list('focusSessions'), vault.list('fitnessActivities'), vault.list('habits'), vault.list('habitEntries'), vault.list('goals'), vault.list('projects'), vault.list('studySubjects')
    ]);
    const tasks = tasksRaw.map(({ id, value }) => ({ ...value, id }));
    const sessions = sessionsRaw.map(({ value }) => value).filter((s) => s.source !== 'focus');
    const focus = focusRaw.map(({ value }) => value);
    const activities = activitiesRaw.map(({ value }) => value);
    const entries = entriesRaw.map(({ value }) => value).filter((e) => e.completedAt);
    const habits = habitsRaw.map(({ value }) => value);
    const goals = goalsRaw.map(({ value }) => value);
    const projects = projectsRaw.map(({ value }) => value);
    const subjects = subjectsRaw.map(({ id, value }) => ({ ...value, id }));
    const today = todayLocal(); const start = shiftDate(today, -days + 1);
    const previousEnd = shiftDate(start, -1); const previousStart = shiftDate(previousEnd, -days + 1);
    const inRange = (date) => date >= start && date <= today;
    const dailyTasks = new Map(); const dailyStudy = new Map(); const dailyFitness = new Map(); const dailyHabits = new Map();
    const studyBySubject = new Map(); const fitnessByType = new Map();
    tasks.filter((t) => t.status === 'done' && t.completedAt).forEach((task) => { const date = localDateFromInstant(task.completedAt); if (inRange(date)) dailyTasks.set(date, (dailyTasks.get(date) || 0) + 1); });
    sessions.forEach((session) => { if (!session.startedAt) return; const date = localDateFromInstant(session.startedAt); if (inRange(date)) dailyStudy.set(date, (dailyStudy.get(date) || 0) + Number(session.minutes || 0)); });
    sessions.filter((session) => inRange(localDateFromInstant(session.startedAt || ''))).forEach((session) => { const key = session.subjectId || 'none'; studyBySubject.set(key, (studyBySubject.get(key) || 0) + Number(session.minutes || 0)); });
    focus.forEach((session) => { const date = session.date || (session.finishedAt ? localDateFromInstant(session.finishedAt) : ''); if (inRange(date)) { dailyStudy.set(date, (dailyStudy.get(date) || 0) + Number(session.minutes || 0)); const key = session.subjectId || 'none'; studyBySubject.set(key, (studyBySubject.get(key) || 0) + Number(session.minutes || 0)); } });
    activities.filter((activity) => inRange(activity.date)).forEach((activity) => { dailyFitness.set(activity.date, (dailyFitness.get(activity.date) || 0) + 1); const label = activity.type === 'custom' ? (activity.customType || 'Outra atividade') : ({ running: 'Corrida', cycling: 'Ciclismo', jiuJitsu: 'Jiu-jitsu', strength: 'Força' }[activity.type] || 'Outra atividade'); fitnessByType.set(label, (fitnessByType.get(label) || 0) + 1); });
    entries.filter((entry) => inRange(entry.localDate)).forEach((entry) => dailyHabits.set(entry.localDate, (dailyHabits.get(entry.localDate) || 0) + 1));
    const totalStudyMinutes = [...dailyStudy.values()].reduce((sum, value) => sum + value, 0);
    const totalFitness = [...dailyFitness.values()].reduce((sum, value) => sum + value, 0);
    const completedTasks = [...dailyTasks.values()].reduce((sum, value) => sum + value, 0);
    const habitCheckins = [...dailyHabits.values()].reduce((sum, value) => sum + value, 0);
    const overdueTasks = tasks.filter((task) => task.status !== 'done' && task.dueDate && task.dueDate < today).length;
    const previousTasks = tasks.filter((task) => task.status === 'done' && task.completedAt).filter((task) => { const date = localDateFromInstant(task.completedAt); return date >= previousStart && date <= previousEnd; }).length;
    const previousStudy = [...sessions, ...focus].reduce((sum, session) => { const date = session.startedAt ? localDateFromInstant(session.startedAt) : session.date || (session.finishedAt ? localDateFromInstant(session.finishedAt) : ''); return date >= previousStart && date <= previousEnd ? sum + Number(session.minutes || 0) : sum; }, 0);
    const comparison = (current, previous) => previous ? `${current >= previous ? '+' : ''}${Math.round((current - previous) / previous * 100)}% vs. período anterior` : 'Sem base de comparação anterior';
    view.innerHTML = `<div class="page-heading"><div><p class="eyebrow">DADOS REGISTRADOS</p><h1>Estatísticas</h1><p class="muted">Indicadores calculados dos seus registros. Dias sem dados permanecem vazios.</p></div><label class="analytics-period">Período<select id="analytics-days"><option value="7"${days === 7 ? ' selected' : ''}>7 dias</option><option value="30"${days === 30 ? ' selected' : ''}>30 dias</option><option value="90"${days === 90 ? ' selected' : ''}>90 dias</option></select></label></div>
      <section class="metric-strip analytics-metrics"><div><strong>${completedTasks}</strong><span>tarefas concluídas · ${html(comparison(completedTasks, previousTasks))}</span></div><div><strong>${Math.floor(totalStudyMinutes / 60)}h ${totalStudyMinutes % 60}m</strong><span>estudo e foco · ${html(comparison(totalStudyMinutes, previousStudy))}</span></div><div><strong>${habitCheckins}</strong><span>check-ins de hábitos</span></div><div><strong>${totalFitness}</strong><span>atividades físicas</span></div><div><strong>${overdueTasks}</strong><span>tarefas atrasadas agora</span></div><div><strong>${goals.filter((g) => g.status === 'active').length}</strong><span>objetivos ativos</span></div></section>
      <section class="analytics-grid">${chartCard('Tarefas concluídas por dia', dailyTasks, 'tarefas')}${chartCard('Minutos de estudo e foco por dia', dailyStudy, ' min')}${chartCard('Atividades físicas por dia', dailyFitness, ' sessões')}${chartCard('Check-ins de hábitos por dia', dailyHabits, ' check-ins')}</section>
      <section class="analytics-breakdowns"><article class="module-panel"><div class="module-panel-heading"><div><p class="eyebrow">ESTUDOS</p><h2>Tempo por disciplina</h2></div></div>${studyBySubject.size ? [...studyBySubject.entries()].sort((a, b) => b[1] - a[1]).map(([id, minutes]) => { const name = subjects.find((subject) => subject.id === id)?.name || 'Sem disciplina'; const pct = Math.round(minutes / totalStudyMinutes * 100); return `<div class="analytics-progress"><div><span>${html(name)}</span><strong>${Math.floor(minutes / 60)}h ${minutes % 60}m · ${pct}%</strong></div><div class="goal-progress-bar"><span style="width:${pct}%"></span></div></div>`; }).join('') : '<p class="muted">Sem sessões de estudo neste período.</p>'}</article><article class="module-panel"><div class="module-panel-heading"><div><p class="eyebrow">ATIVIDADES</p><h2>Frequência por modalidade</h2></div></div>${fitnessByType.size ? [...fitnessByType.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => `<div class="analytics-progress"><div><span>${html(name)}</span><strong>${count}</strong></div><div class="goal-progress-bar"><span style="width:${Math.round(count / totalFitness * 100)}%"></span></div></div>`).join('') : '<p class="muted">Sem atividades registradas neste período.</p>'}</article></section>
      <section class="analytics-lists"><article class="module-panel"><div class="module-panel-heading"><div><p class="eyebrow">OBJETIVOS</p><h2>Progresso registrado</h2></div></div>${goals.filter((g) => g.status === 'active').length ? goals.filter((g) => g.status === 'active').map((g) => { const progress = g.milestones?.length ? Math.round(g.milestones.filter((m) => m.done).length / g.milestones.length * 100) : Number(g.progress || 0); return `<div class="analytics-progress"><div><span>${html(g.title)}</span><strong>${progress}%</strong></div><div class="goal-progress-bar"><span style="width:${Math.min(100, Math.max(0, progress))}%"></span></div></div>`; }).join('') : '<p class="muted">Ainda não há objetivos ativos para resumir.</p>'}</article><article class="module-panel"><div class="module-panel-heading"><div><p class="eyebrow">PROJETOS</p><h2>Em andamento</h2></div></div>${projects.filter((p) => p.status === 'active').length ? projects.filter((p) => p.status === 'active').map((p) => { const progress = p.milestones?.length ? Math.round(p.milestones.filter((m) => m.done).length / p.milestones.length * 100) : null; return `<div class="analytics-progress"><div><span>${html(p.name)}</span><strong>${progress === null ? 'Sem marcos' : `${progress}%`}</strong></div>${progress === null ? '' : `<div class="goal-progress-bar"><span style="width:${progress}%"></span></div>`}</div>`; }).join('') : '<p class="muted">Ainda não há projetos em andamento.</p>'}</article></section>`;
    $('#analytics-days', view).addEventListener('change', (event) => { days = Number(event.target.value); render(); });
  }
  function chartCard(title, map, unit) { const series = daySeries(days, map); const total = series.reduce((sum, point) => sum + point.value, 0); return `<article class="module-panel analytics-chart-card"><div class="module-panel-heading"><div><p class="eyebrow">ÚLTIMOS ${days} DIAS</p><h2>${title}</h2></div><strong>${total}${html(unit)}</strong></div>${total ? barChart(series, title, unit) : `<p class="analytics-empty">Sem registros neste período. O gráfico será preenchido conforme você usar o LifeOS.</p>`}</article>`; }
  await render();
}
