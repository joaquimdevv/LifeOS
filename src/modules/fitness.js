import { formatDate, html, isValidDateOnly, makeId, optionalText, requireText, todayLocal } from '../validation.js';
import { $ } from '../dom.js';
import { getModulePreferences } from './customization.js';

const types = { running: 'Corrida', cycling: 'Ciclismo', jiuJitsu: 'Jiu-jitsu', strength: 'Força', custom: 'Outra atividade' };

export async function renderFitness(vault, view, toast) {
  let periodDays = (await getModulePreferences(vault)).fitnessDays;
  let editingId = '';
  let editorOpen = false;
  let typeFilter = 'all';
  const run = (action) => action().catch((e) => toast(`Não foi possível concluir: ${e.message}`));

  async function render() {
    const activities = (await vault.list('fitnessActivities')).map(({ id, value }) => ({ ...value, id })).sort((a, b) => b.date.localeCompare(a.date));
    const editing = activities.find((item) => item.id === editingId);
    const cutoff = new Date(`${todayLocal()}T12:00:00`); cutoff.setDate(cutoff.getDate() - periodDays + 1);
    const period = activities.filter((item) => new Date(`${item.date}T12:00:00`) >= cutoff);
    const filtered = activities.filter((item) => typeFilter === 'all' || item.type === typeFilter);
    const distance = period.reduce((sum, item) => sum + Number(item.distance || 0), 0);
    const duration = period.reduce((sum, item) => sum + Number(item.minutes || 0), 0);
    view.innerHTML = `<div class="page-heading"><div><p class="eyebrow">MOVIMENTO</p><h1>Atividades físicas</h1><p class="muted">Registre seu histórico manualmente, com métricas adequadas a cada atividade.</p></div><button id="new-fitness" class="button button-primary" type="button">＋ Registrar atividade</button></div>
      <div class="module-toolbar fitness-toolbar"><label for="fitness-period">Resumo</label><select id="fitness-period"><option value="7"${periodDays === 7 ? ' selected' : ''}>Últimos 7 dias</option><option value="30"${periodDays === 30 ? ' selected' : ''}>Últimos 30 dias</option><option value="90"${periodDays === 90 ? ' selected' : ''}>Últimos 90 dias</option></select></div>
      <section class="metric-strip"><div><strong>${period.length}</strong><span>atividades no período</span></div><div><strong>${Math.floor(duration / 60)}h ${duration % 60}m</strong><span>tempo registrado</span></div><div><strong>${distance.toFixed(1)} km</strong><span>distância informada</span></div></section>
      <section class="module-panel fitness-breakdown"><h2>Frequência por atividade</h2><div class="fitness-type-grid">${Object.entries(types).map(([key, label]) => { const count = period.filter((item) => item.type === key).length; const mins = period.filter((item) => item.type === key).reduce((sum, item) => sum + item.minutes, 0); return `<div><strong>${count}</strong><span>${label}</span><small>${mins} min</small></div>`; }).join('')}</div></section>
      ${editorOpen ? `<section class="module-panel inline-editor"><div class="editor-heading"><h2>${editing ? 'Editar atividade' : 'Nova atividade'}</h2><button id="close-fitness" class="icon-button" type="button" aria-label="Fechar formulário">×</button></div><form id="fitness-form" class="module-form"><label for="fitness-type">Atividade</label><select id="fitness-type" name="type">${Object.entries(types).map(([key, label]) => `<option value="${key}"${(editing?.type || 'running') === key ? ' selected' : ''}>${label}</option>`).join('')}</select><div id="custom-type-field"${(editing?.type || 'running') === 'custom' ? '' : ' hidden'}><label for="fitness-custom-type">Nome da atividade</label><input id="fitness-custom-type" name="customType" maxlength="60" value="${html(editing?.customType || '')}" placeholder="Ex.: natação"></div><div class="form-two"><div><label for="fitness-date">Data</label><input id="fitness-date" name="date" type="date" max="${todayLocal()}" value="${html(editing?.date || todayLocal())}" required></div><div><label for="fitness-minutes">Duração (minutos)</label><input id="fitness-minutes" name="minutes" type="number" min="1" max="1440" value="${Number(editing?.minutes || 45)}" required></div></div><div class="form-two"><div><label for="fitness-distance">Distância (km, opcional)</label><input id="fitness-distance" name="distance" type="number" min="0" max="1000" step="0.01" value="${editing?.distance ?? ''}" placeholder="Não aplicável"></div><div><label for="fitness-metric-label">Nome da métrica extra (opcional)</label><input id="fitness-metric-label" name="metricLabel" maxlength="40" value="${html(editing?.metricLabel || '')}" placeholder="Ex.: rounds, séries"></div></div><label for="fitness-metric-value">Valor da métrica extra</label><input id="fitness-metric-value" name="metricValue" maxlength="80" value="${html(editing?.metricValue || '')}"><label for="fitness-notes">Observações</label><textarea id="fitness-notes" name="notes" maxlength="1500">${html(editing?.notes || '')}</textarea><div class="form-actions"><button class="button button-primary" type="submit">${editing ? 'Salvar alterações' : 'Salvar atividade'}</button><button id="cancel-fitness" class="button button-quiet" type="button">Cancelar</button></div><p id="fitness-error" class="error-message" role="alert" hidden></p></form></section>` : ''}
      <section class="module-panel fitness-history"><div class="module-panel-heading"><div><p class="eyebrow">HISTÓRICO</p><h2>Registros</h2></div><label class="fitness-filter">Filtrar<select id="fitness-filter"><option value="all">Todas</option>${Object.entries(types).map(([key, label]) => `<option value="${key}"${typeFilter === key ? ' selected' : ''}>${label}</option>`).join('')}</select></label></div>${filtered.length ? `<div class="fitness-record-list">${filtered.map((item) => `<article class="fitness-record"><span class="fitness-type-mark">${html((types[item.type] || 'Atividade').slice(0, 1))}</span><div class="fitness-record-main"><strong>${html(item.type === 'custom' ? item.customType : types[item.type] || 'Atividade')}</strong><p>${formatDate(item.date, { day: 'numeric', month: 'short', year: 'numeric' })}${item.distance ? ` · ${Number(item.distance).toLocaleString('pt-BR')} km` : ''}${item.metricLabel && item.metricValue ? ` · ${html(item.metricLabel)}: ${html(item.metricValue)}` : ''}</p>${item.notes ? `<p>${html(item.notes)}</p>` : ''}</div><strong class="fitness-duration">${item.minutes} min</strong><div class="task-actions"><button class="icon-button" type="button" data-edit-fitness="${html(item.id)}" aria-label="Editar atividade">✎</button><button class="icon-button danger-action" type="button" data-delete-fitness="${html(item.id)}" aria-label="Excluir atividade">×</button></div></article>`).join('')}</div>` : `<div class="empty-state"><h2>${activities.length ? 'Sem registros neste filtro' : 'Seu histórico começa aqui'}</h2><p>${activities.length ? 'Escolha outra atividade no filtro.' : 'Registre uma atividade para formar seu histórico pessoal.'}</p><button id="empty-fitness" class="button button-secondary" type="button">＋ Registrar atividade</button></div>`}</section>`;

    $('#new-fitness', view).addEventListener('click', () => openEditor());
    $('#empty-fitness', view)?.addEventListener('click', () => openEditor());
    $('#close-fitness', view)?.addEventListener('click', closeEditor);
    $('#cancel-fitness', view)?.addEventListener('click', closeEditor);
    $('#fitness-form', view)?.addEventListener('submit', saveActivity);
    $('#fitness-type', view)?.addEventListener('change', (e) => { $('#custom-type-field', view).hidden = e.target.value !== 'custom'; });
    $('#fitness-filter', view).addEventListener('change', (e) => { typeFilter = e.target.value; render(); });
    $('#fitness-period', view).addEventListener('change', (e) => { periodDays = Number(e.target.value); render(); });
    view.querySelectorAll('[data-edit-fitness]').forEach((button) => button.addEventListener('click', () => openEditor(button.dataset.editFitness)));
    view.querySelectorAll('[data-delete-fitness]').forEach((button) => button.addEventListener('click', () => run(() => deleteActivity(button.dataset.deleteFitness))));
  }
  function openEditor(id = '') { editingId = id; editorOpen = true; render(); }
  function closeEditor() { editingId = ''; editorOpen = false; render(); }
  async function saveActivity(event) {
    event.preventDefault(); const form = event.currentTarget; const v = Object.fromEntries(new FormData(form)); const error = $('#fitness-error', view);
    try {
      const previous = editingId ? await vault.get('fitnessActivities', editingId) : null;
      const minutes = Number(v.minutes); if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) throw new Error('A duração deve ficar entre 1 e 1.440 minutos.');
      if (!isValidDateOnly(v.date) || v.date > todayLocal()) throw new Error('Informe uma data válida que não seja futura.');
      const distance = v.distance === '' ? null : Number(v.distance); if (distance !== null && (!Number.isFinite(distance) || distance < 0 || distance > 1000)) throw new Error('A distância precisa ser um número entre zero e 1.000 km.');
      const type = Object.hasOwn(types, v.type) ? v.type : 'custom';
      await vault.save('fitnessActivities', editingId || makeId(), { type, customType: type === 'custom' ? requireText(v.customType, 'Nome da atividade', 60) : '', date: v.date, minutes, distance, metricLabel: optionalText(v.metricLabel, 40), metricValue: optionalText(v.metricValue, 80), notes: optionalText(v.notes, 1500), createdAt: previous?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() });
      toast(previous ? 'Atividade atualizada.' : 'Atividade registrada.'); editingId = ''; editorOpen = false; await render();
    } catch (e) { error.textContent = e.message; error.hidden = false; }
  }
  async function deleteActivity(id) { const record = await vault.get('fitnessActivities', id); if (!record || !confirm('Excluir este registro de atividade?')) return; await vault.delete('fitnessActivities', id); toast('Atividade excluída.'); await render(); }
  await render();
}
