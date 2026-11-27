import { html, makeId, requireText } from '../validation.js';
import { $ } from '../dom.js';

const widgetLabels = {
  metrics: 'Resumo do dia', priorities: 'Tarefas prioritárias', agenda: 'Próximos eventos',
  habits: 'Hábitos de hoje', goals: 'Objetivos ativos', insights: 'Atividade recente'
};
const categoryScopes = { tasks: 'Tarefas', projects: 'Projetos', goals: 'Objetivos', habits: 'Hábitos' };
const defaultModules = { taskLayout: 'list', analyticsDays: 30, fitnessDays: 30, graphLimit: 80 };
const defaultDashboard = { order: Object.keys(widgetLabels), visible: Object.keys(widgetLabels) };

function normalizeDashboard(value = {}) {
  const order = [...new Set([...(Array.isArray(value.order) ? value.order : []), ...Object.keys(widgetLabels)])].filter((key) => widgetLabels[key]);
  const visible = (Array.isArray(value.visible) ? value.visible : defaultDashboard.visible).filter((key) => widgetLabels[key]);
  return { order, visible: [...new Set(['metrics', ...visible])] };
}

export async function getModulePreferences(vault) {
  const saved = await vault.get('settings', 'modulePreferences') || {};
  return {
    taskLayout: ['list', 'board', 'calendar'].includes(saved.taskLayout) ? saved.taskLayout : defaultModules.taskLayout,
    analyticsDays: [7, 30, 90].includes(Number(saved.analyticsDays)) ? Number(saved.analyticsDays) : defaultModules.analyticsDays,
    fitnessDays: [7, 30, 90].includes(Number(saved.fitnessDays)) ? Number(saved.fitnessDays) : defaultModules.fitnessDays,
    graphLimit: [40, 80, 120].includes(Number(saved.graphLimit)) ? Number(saved.graphLimit) : defaultModules.graphLimit
  };
}

export async function getDashboardPreferences(vault) {
  return normalizeDashboard(await vault.get('settings', 'dashboardLayout') || {});
}

export async function getCustomCategories(vault, scope) {
  const saved = await vault.get('settings', 'customCategories') || {};
  return Array.isArray(saved[scope]) ? saved[scope] : [];
}

export async function renderCustomization(vault, view, toast) {
  let activeScope = 'tasks';
  const storedCategories = await vault.get('settings', 'customCategories') || {};
  let categories = Object.fromEntries(Object.keys(categoryScopes).map((scope) => [scope, Array.isArray(storedCategories[scope]) ? storedCategories[scope] : []]));
  let dashboard = normalizeDashboard(await vault.get('settings', 'dashboardLayout') || {});
  let modules = await getModulePreferences(vault);

  async function saveSetting(key, value) { await vault.save('settings', key, value); }
  function render() {
    view.innerHTML = `<div class="page-heading"><div><p class="eyebrow">DO SEU JEITO</p><h1>Personalização</h1><p class="muted">Configure o painel, as categorias e o comportamento inicial dos módulos. As opções ficam no cofre criptografado.</p></div></div>
      <section class="module-panel customization-section"><div class="module-panel-heading"><div><p class="eyebrow">PAINEL</p><h2>Widgets e ordem</h2></div></div><div class="custom-widget-list">${dashboard.order.map((key, index) => `<div class="custom-widget-row" draggable="true" data-widget-row="${key}"><label><input type="checkbox" data-widget-visible="${key}"${dashboard.visible.includes(key) ? ' checked' : ''}${key === 'metrics' ? ' disabled' : ''}>${widgetLabels[key]}</label><div><button class="icon-button" type="button" data-widget-move="up" data-widget-index="${index}" aria-label="Mover ${widgetLabels[key]} para cima"${index === 0 ? ' disabled' : ''}>↑</button><button class="icon-button" type="button" data-widget-move="down" data-widget-index="${index}" aria-label="Mover ${widgetLabels[key]} para baixo"${index === dashboard.order.length - 1 ? ' disabled' : ''}>↓</button></div></div>`).join('')}</div><p class="field-hint">Use as setas ou arraste os itens para reordenar. O resumo do dia permanece sempre visível.</p></section>
      <section class="module-panel customization-section"><div class="module-panel-heading"><div><p class="eyebrow">ORGANIZAÇÃO</p><h2>Categorias próprias</h2></div></div><label for="category-scope">Módulo</label><select id="category-scope">${Object.entries(categoryScopes).map(([key, label]) => `<option value="${key}"${activeScope === key ? ' selected' : ''}>${label}</option>`).join('')}</select><form id="category-form" class="category-add-form"><label for="category-name">Nova categoria</label><div><input id="category-name" name="name" maxlength="40" required placeholder="Ex.: Casa"><button class="button button-secondary" type="submit">Adicionar</button></div></form><ul class="custom-category-list">${(categories[activeScope] || []).map((item) => `<li>${html(item.name)}<button type="button" class="icon-button danger-action" data-category-delete="${html(item.id)}" aria-label="Excluir categoria ${html(item.name)}">×</button></li>`).join('') || '<li class="muted">Nenhuma categoria personalizada neste módulo.</li>'}</ul></section>
      <section class="module-panel customization-section"><div class="module-panel-heading"><div><p class="eyebrow">COMPORTAMENTO INICIAL</p><h2>Preferências por módulo</h2></div></div><div class="module-preference-grid"><label>Tarefas<select data-module-pref="taskLayout"><option value="list"${modules.taskLayout === 'list' ? ' selected' : ''}>Lista</option><option value="board"${modules.taskLayout === 'board' ? ' selected' : ''}>Quadro</option><option value="calendar"${modules.taskLayout === 'calendar' ? ' selected' : ''}>Calendário</option></select></label><label>Estatísticas<select data-module-pref="analyticsDays"><option value="7"${modules.analyticsDays === 7 ? ' selected' : ''}>7 dias</option><option value="30"${modules.analyticsDays === 30 ? ' selected' : ''}>30 dias</option><option value="90"${modules.analyticsDays === 90 ? ' selected' : ''}>90 dias</option></select></label><label>Atividades físicas<select data-module-pref="fitnessDays"><option value="7"${modules.fitnessDays === 7 ? ' selected' : ''}>7 dias</option><option value="30"${modules.fitnessDays === 30 ? ' selected' : ''}>30 dias</option><option value="90"${modules.fitnessDays === 90 ? ' selected' : ''}>90 dias</option></select></label><label>Mapa de conhecimento<select data-module-pref="graphLimit"><option value="40"${modules.graphLimit === 40 ? ' selected' : ''}>Até 40 notas</option><option value="80"${modules.graphLimit === 80 ? ' selected' : ''}>Até 80 notas</option><option value="120"${modules.graphLimit === 120 ? ' selected' : ''}>Até 120 notas</option></select></label></div><p class="field-hint">O Modo Foco mantém seus tempos e pausas próprios na tela do módulo.</p></section>`;
    bind();
  }
  function bind() {
    $('#category-scope', view).addEventListener('change', (event) => { activeScope = event.target.value; render(); });
    $('#category-name', view).addEventListener('input', (event) => event.target.setCustomValidity(''));
    $('#category-form', view).addEventListener('submit', async (event) => {
      event.preventDefault(); const name = requireText(new FormData(event.currentTarget).get('name'), 'Categoria', 40);
      const list = categories[activeScope] || [];
      if (list.some((item) => item.name.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'))) { $('#category-name', view).setCustomValidity('Essa categoria já existe.'); $('#category-name', view).reportValidity(); return; }
      categories = { ...categories, [activeScope]: [...list, { id: makeId(), name }] };
      try { await saveSetting('customCategories', categories); toast('Categoria adicionada.'); render(); }
      catch (error) { toast(`Não foi possível salvar: ${error.message}`); }
    });
    view.querySelectorAll('[data-category-delete]').forEach((button) => button.addEventListener('click', async () => {
      categories = { ...categories, [activeScope]: (categories[activeScope] || []).filter((item) => item.id !== button.dataset.categoryDelete) };
      try { await saveSetting('customCategories', categories); toast('Categoria removida.'); render(); }
      catch (error) { toast(`Não foi possível salvar: ${error.message}`); }
    }));
    view.querySelectorAll('[data-widget-visible]').forEach((input) => input.addEventListener('change', async () => {
      const visible = new Set(dashboard.visible); input.checked ? visible.add(input.dataset.widgetVisible) : visible.delete(input.dataset.widgetVisible);
      if (!visible.size) { visible.add('metrics'); }
      dashboard = { ...dashboard, visible: [...visible] }; try { await saveSetting('dashboardLayout', dashboard); render(); } catch (error) { toast(`Não foi possível salvar: ${error.message}`); }
    }));
    view.querySelectorAll('[data-widget-move]').forEach((button) => button.addEventListener('click', async () => {
      const index = Number(button.dataset.widgetIndex); const target = index + (button.dataset.widgetMove === 'up' ? -1 : 1);
      if (target < 0 || target >= dashboard.order.length) return;
      const order = [...dashboard.order]; [order[index], order[target]] = [order[target], order[index]]; dashboard = { ...dashboard, order };
      try { await saveSetting('dashboardLayout', dashboard); render(); } catch (error) { toast(`Não foi possível salvar: ${error.message}`); }
    }));
    view.querySelectorAll('[data-module-pref]').forEach((select) => select.addEventListener('change', async () => {
      const key = select.dataset.modulePref; const value = key === 'taskLayout' ? select.value : Number(select.value);
      modules = { ...modules, [key]: value }; try { await saveSetting('modulePreferences', modules); toast('Preferência salva.'); } catch (error) { toast(`Não foi possível salvar: ${error.message}`); }
    }));
    let dragged = '';
    view.querySelectorAll('[data-widget-row]').forEach((row) => {
      row.addEventListener('dragstart', () => { dragged = row.dataset.widgetRow; row.classList.add('is-dragging'); });
      row.addEventListener('dragend', () => row.classList.remove('is-dragging'));
      row.addEventListener('dragover', (event) => event.preventDefault());
      row.addEventListener('drop', async (event) => {
        event.preventDefault(); const target = row.dataset.widgetRow; if (!dragged || dragged === target) return;
        const order = dashboard.order.filter((key) => key !== dragged); order.splice(order.indexOf(target), 0, dragged); dashboard = { ...dashboard, order };
        try { await saveSetting('dashboardLayout', dashboard); render(); } catch (error) { toast(`Não foi possível salvar: ${error.message}`); }
      });
    });
  }
  render();
}
