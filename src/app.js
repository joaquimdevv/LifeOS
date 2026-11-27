import { openDatabase, hasVault, createVault, unlockVault } from './database.js';
import { createBackupFile, readBackupFile, BACKUP_FORMAT, MAX_BACKUP_BYTES } from './backup.js';
import { ACCENT_PRESETS, DEFAULT_PREFERENCES, TYPOGRAPHIES, applyPreferences, normalizePreferences } from './preferences.js';
import { renderDashboard } from './modules/dashboard.js';
import { renderTasks } from './modules/tasks.js';
import { renderCalendar } from './modules/calendar.js';
import { renderHabits } from './modules/habits.js';
import { renderGoals } from './modules/goals.js';
import { renderStudy } from './modules/study.js';
import { renderProjects } from './modules/projects.js';
import { renderNotes } from './modules/notes.js';
import { pauseFocus, renderFocus } from './modules/focus.js';
import { renderFitness } from './modules/fitness.js';
import { renderAnalytics } from './modules/analytics.js';
import { renderKnowledgeGraph } from './modules/knowledge-graph.js';
import { renderCustomization } from './modules/customization.js';
import { renderAccessibility } from './modules/accessibility.js';
import { $ } from './dom.js'

const view = $('#view');
const appShell = $('.app-shell');
const lockScreen = $('#lock-screen');
let db;
let vault;
let preferences = { ...DEFAULT_PREFERENCES };
let deferredInstallPrompt;
let announcedUpdateWorker;

function toast(message, actionLabel, action) {
  const region = $('#toast-region');
  region.replaceChildren();
  const item = document.createElement('div');
  item.className = 'toast';
  const text = document.createElement('span');
  text.textContent = message;
  item.append(text);
  if (actionLabel && action) {
    const button = document.createElement('button');
    button.className = 'text-button';
    button.type = 'button';
    button.textContent = actionLabel;
    button.addEventListener('click', action, { once: true });
    item.append(button);
  }
  region.append(item);
  window.setTimeout(() => item.remove(), 6500);
}

function formatBytes(value) {
  if (!Number.isFinite(value)) return 'indisponível';
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB'];
  let size = value / 1024;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) { size /= 1024; index += 1; }
  return `${size.toFixed(1)} ${units[index]}`;
}

function userError(error, fallback = 'A operação não pôde ser concluída.') {
  if (error?.name === 'QuotaExceededError') return 'O navegador está sem espaço para salvar esses dados. Libere espaço e tente novamente.';
  if (error?.name === 'AbortError') return 'O navegador cancelou a gravação. Os dados anteriores foram preservados; tente novamente.';
  return error?.message || fallback;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function showLock(hasExistingVault) {
  appShell.hidden = true;
  lockScreen.hidden = false;
  $('#lock-title').textContent = hasExistingVault ? 'Desbloqueie seu LifeOS' : 'Crie seu cofre local';
  $('#lock-description').textContent = hasExistingVault
    ? 'Digite sua senha para abrir os dados criptografados neste dispositivo.'
    : 'Escolha uma senha longa para criptografar seus dados neste dispositivo.';
  $('#confirm-row').hidden = hasExistingVault;
  $('#passphrase').autocomplete = hasExistingVault ? 'current-password' : 'new-password';
  $('#vault-submit').textContent = hasExistingVault ? 'Desbloquear cofre' : 'Criar cofre';
  $('#passphrase').focus();
}

async function lockVault() {
  pauseFocus();
  if (vault) vault.lock();
  vault = null;
  preferences = { ...DEFAULT_PREFERENCES };
  showLock(true);
}

function setPageTitle(title) {
  $('#page-title').textContent = title;
  document.title = `${title} — LifeOS`;
}

function setActiveRoute(route) {
  document.querySelectorAll('[data-route]').forEach((link) => {
    const active = link.dataset.route === route;
    link.classList.toggle('is-active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

function renderDashboardView() { return renderDashboard(vault, view); }

async function renderAppearance() {
  preferences = normalizePreferences(vault ? (await vault.get('settings', 'appearance')) || preferences : preferences);
  setPageTitle('Aparência');
  const presetButtons = ACCENT_PRESETS.map(({ name, color }) => `<button class="swatch${preferences.accent === color ? ' is-selected' : ''}" type="button" data-accent="${color}" aria-label="Cor ${name}" title="${name}" style="--swatch:${color}"></button>`).join('');
  const typeOptions = Object.keys(TYPOGRAPHIES).map((key) => {
    const labels = { system: 'Sistema', humanist: 'Humanista', editorial: 'Editorial', mono: 'Monoespaçada' };
    return `<option value="${key}"${preferences.typography === key ? ' selected' : ''}>${labels[key]}</option>`;
  }).join('');
  view.innerHTML = `
    <div class="page-heading"><div><p class="eyebrow">PREFERÊNCIAS</p><h1>Aparência</h1><p class="muted">Ajuste a interface ao seu jeito. As mudanças são salvas no cofre local.</p></div><button id="reset-appearance" type="button" class="button button-quiet">Restaurar padrão</button></div>
    <div class="settings-layout">
      <section class="settings-panel">
        <div class="setting-section"><div><h2>Tema</h2><p>Automático acompanha a preferência do dispositivo.</p></div><div class="segmented" role="group" aria-label="Tema"><button type="button" data-theme-value="system" aria-pressed="${preferences.theme === 'system'}">Auto</button><button type="button" data-theme-value="light" aria-pressed="${preferences.theme === 'light'}">Claro</button><button type="button" data-theme-value="dark" aria-pressed="${preferences.theme === 'dark'}">Escuro</button></div></div>
        <div class="setting-section"><div><h2>Cor de destaque</h2><p>Use uma paleta ou escolha qualquer cor.</p></div><div class="color-controls"><div class="swatch-row">${presetButtons}<label class="custom-color" title="Escolher cor personalizada"><input id="accent-color" type="color" value="${preferences.accent}" aria-label="Cor de destaque personalizada"><span aria-hidden="true">＋</span></label></div><span id="accent-value" class="field-hint">${preferences.accent.toUpperCase()}</span></div></div>
        <div class="setting-section"><div><h2>Tipografia</h2><p>Escolha o estilo de leitura da interface.</p></div><label class="sr-only" for="typography">Tipografia</label><select id="typography" class="select-control">${typeOptions}</select></div>
        <div class="setting-section"><div><h2>Densidade</h2><p>Mais espaço ou mais conteúdo na tela.</p></div><div class="segmented" role="group" aria-label="Densidade"><button type="button" data-density-value="spacious" aria-pressed="${preferences.density === 'spacious'}">Ampla</button><button type="button" data-density-value="comfortable" aria-pressed="${preferences.density === 'comfortable'}">Confortável</button><button type="button" data-density-value="compact" aria-pressed="${preferences.density === 'compact'}">Compacta</button></div></div>
        <div class="setting-section"><div><h2>Superfície dos painéis</h2><p>Escolha o contraste dos cartões em relação ao fundo.</p></div><select id="surface-style" class="select-control"><option value="standard"${preferences.surface === 'standard' ? ' selected' : ''}>Padrão</option><option value="soft"${preferences.surface === 'soft' ? ' selected' : ''}>Suave</option></select></div>
        <div class="setting-section range-section"><div><h2>Cantos</h2><p>Controle o arredondamento dos painéis.</p></div><div class="range-control"><input id="corner-radius" type="range" min="8" max="24" step="2" value="${preferences.radius}"><output id="corner-radius-output">${preferences.radius}px</output></div></div>
        <div class="setting-section"><div><h2>Acessibilidade</h2><p>Ajuste o tamanho do texto, o contraste, o movimento e a simplicidade em um só lugar.</p></div><a class="button button-secondary" href="#accessibility">Abrir centro de acessibilidade</a></div>
      </section>
      <aside class="preview-column"><div class="preview-label"><span class="eyebrow">PRÉVIA</span><span class="live-indicator"><span class="status-dot"></span> Ao vivo</span></div><div class="preview-card"><div class="preview-top"><span class="preview-mark">L</span><span class="preview-lines"><i></i><i></i></span><span class="preview-avatar"></span></div><div class="preview-content"><span class="preview-kicker">SEU ESPAÇO</span><h3>Um dia de cada vez</h3><p>Pequenos passos também contam.</p><div class="preview-progress"><span></span></div><button type="button" class="preview-button" tabindex="-1" aria-hidden="true">Continuar</button></div></div><p class="preview-note">A prévia reflete tema, cor, tipografia, escala, densidade e superfície.</p></aside>
    </div>`;
  const save = async (changes) => {
    const previous = preferences;
    preferences = normalizePreferences({ ...preferences, ...changes });
    applyPreferences(preferences);
    try { await vault.save('settings', 'appearance', preferences); }
    catch (error) {
      preferences = previous;
      applyPreferences(preferences);
      toast(`Não foi possível salvar: ${userError(error)}`);
    }
    $('#accent-value').textContent = preferences.accent.toUpperCase();
    $('#accent-color').value = preferences.accent;
    $('#typography').value = preferences.typography;
    $('#surface-style').value = preferences.surface;
    $('#corner-radius-output').textContent = `${preferences.radius}px`;
    $('#corner-radius').value = String(preferences.radius);
    view.querySelectorAll('[data-theme-value]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.themeValue === preferences.theme)));
    view.querySelectorAll('[data-density-value]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.densityValue === preferences.density)));
    view.querySelectorAll('[data-accent]').forEach((button) => button.classList.toggle('is-selected', button.dataset.accent === preferences.accent));
  };
  view.querySelectorAll('[data-theme-value]').forEach((button) => button.addEventListener('click', () => save({ theme: button.dataset.themeValue })));
  view.querySelectorAll('[data-density-value]').forEach((button) => button.addEventListener('click', () => save({ density: button.dataset.densityValue })));
  view.querySelectorAll('[data-accent]').forEach((button) => button.addEventListener('click', () => save({ accent: button.dataset.accent })));
  $('#accent-color').addEventListener('input', (event) => save({ accent: event.target.value }));
  $('#typography').addEventListener('change', (event) => save({ typography: event.target.value }));
  $('#surface-style').addEventListener('change', (event) => save({ surface: event.target.value }));
  $('#corner-radius').addEventListener('input', (event) => save({ radius: Number(event.target.value) }));
  $('#reset-appearance').addEventListener('click', async () => {
    await save({ ...DEFAULT_PREFERENCES });
    toast('A aparência padrão foi restaurada.');
  });
}

async function renderPrivacy() {
  setPageTitle('Privacidade');
  const info = await vault.storageInfo();
  const storageLine = info.estimate
    ? `${formatBytes(info.estimate.usage)} usados${Number.isFinite(info.estimate.quota) ? ` de ${formatBytes(info.estimate.quota)}` : ''}`
    : 'Estimativa indisponível neste navegador.';
  const collectionNames = { tasks: 'Tarefas', events: 'Eventos', habits: 'Hábitos', habitLogs: 'Registros de hábitos', goals: 'Objetivos', settings: 'Configurações', notes: 'Anotações', projects: 'Projetos', studySessions: 'Estudos', focusSessions: 'Foco', fitnessActivities: 'Atividades físicas' };
  const collectionLine = Object.entries(info.collectionCounts).sort(([a], [b]) => a.localeCompare(b)).map(([name, count]) => `${escapeHtml(collectionNames[name] || name)}: ${count}`).join(' · ') || 'Nenhum registro';
  view.innerHTML = `
    <div class="page-heading"><div><p class="eyebrow">SEUS DADOS</p><h1>Privacidade e segurança</h1><p class="muted">O LifeOS mantém o conteúdo no navegador deste dispositivo.</p></div></div>
    <section class="privacy-grid">
      <article class="panel-card privacy-card"><div class="card-icon accent-icon">⌑</div><p class="eyebrow">CRIPTOGRAFIA</p><h2>Cofre AES-256-GCM</h2><p>O conteúdo de cada registro é cifrado antes de chegar ao IndexedDB. Sua senha deriva a chave localmente e não é enviada nem armazenada.</p><div class="privacy-fact"><span>Estado</span><strong>Desbloqueado</strong></div><button id="privacy-lock" class="button button-secondary" type="button">Bloquear cofre agora</button></article>
      <article class="panel-card privacy-card"><div class="card-icon">▤</div><p class="eyebrow">ARMAZENAMENTO</p><h2>Neste navegador</h2><p>${escapeHtml(storageLine)}. O navegador pode aplicar limites ou remover dados do site; a persistência não é garantida.</p><div class="privacy-fact"><span>Registros cifrados</span><strong>${info.count}</strong></div><p class="field-hint">${collectionLine}</p><div class="privacy-fact"><span>Armazenamento persistente</span><strong>${escapeHtml(info.persistence)}</strong></div><button id="request-persistence" class="button button-quiet" type="button">Solicitar preservação</button><button id="validate-storage" class="button button-secondary" type="button">Validar dados locais</button><p id="persistence-result" class="field-hint" role="status"></p><p id="storage-validation-result" class="field-hint" role="status" aria-live="polite"></p></article>
      <article class="panel-card privacy-card wide-card"><div class="card-icon">↗</div><p class="eyebrow">BACKUPS E TRANSFERÊNCIA</p><h2>Backup criptografado</h2><p>O arquivo contém um snapshot cifrado independente da senha do cofre. Guarde a senha do backup separadamente. O LifeOS não envia esse arquivo para a rede.</p>
        <form id="backup-export-form" class="backup-form"><label for="backup-export-password">Senha do backup (mínimo 10 caracteres)</label><input id="backup-export-password" type="password" minlength="10" autocomplete="new-password" required><label for="backup-export-confirm">Confirme a senha</label><input id="backup-export-confirm" type="password" minlength="10" autocomplete="new-password" required><button class="button button-secondary" type="submit">Exportar backup</button></form>
        <form id="backup-import-form" class="backup-form"><label for="backup-file">Arquivo de backup (até 50 MB)</label><input id="backup-file" type="file" accept=".json,application/vnd.lifeos.backup+json,application/json" required><label for="backup-import-password">Senha do backup</label><input id="backup-import-password" type="password" autocomplete="current-password" required><button class="button button-quiet" type="submit">Validar e restaurar</button></form><p id="backup-result" class="field-hint" role="status" aria-live="polite"></p></article>
      <article class="panel-card privacy-card wide-card"><div class="card-icon">◌</div><p class="eyebrow">CONTEÚDO</p><h2>Você controla o acesso</h2><p>Ao bloquear ou fechar o LifeOS, a chave em memória é descartada. Enquanto o cofre estiver aberto, a página precisa descriptografar os registros para exibi-los. Proteja também o dispositivo e mantenha sua senha segura.</p><div class="privacy-fact"><span>Rede externa</span><strong>Nenhum dado enviado</strong></div><div class="privacy-fact"><span>Telemetria e publicidade</span><strong>Desativadas</strong></div></article>
    </section>`;
  $('#privacy-lock').addEventListener('click', lockVault);
  $('#request-persistence').addEventListener('click', async () => {
    const result = await vault.requestPersistence();
    const messages = { granted: 'O navegador concedeu armazenamento persistente.', denied: 'O navegador não concedeu armazenamento persistente.', unsupported: 'Este navegador não oferece essa solicitação.' };
    $('#persistence-result').textContent = messages[result];
    toast(messages[result]);
  });
  $('#backup-export-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = $('#backup-result');
    status.textContent = 'Validando e cifrando os registros…';
    try {
      const password = $('#backup-export-password').value;
      if (password !== $('#backup-export-confirm').value) throw new Error('As senhas do backup não coincidem.');
      const file = await createBackupFile(await vault.exportSnapshot(), password);
      const blob = new Blob([JSON.stringify(file, null, 2)], { type: BACKUP_FORMAT });
      if (blob.size > MAX_BACKUP_BYTES) throw new Error('O backup excede o limite de 50 MB.');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `lifeos-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      status.textContent = `Backup criptografado exportado (${formatBytes(blob.size)}).`;
      $('#backup-export-form').reset();
    } catch (error) { status.textContent = userError(error, 'Falha ao exportar o backup.'); }
  });
  $('#backup-import-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = $('#backup-result');
    const file = $('#backup-file').files?.[0];
    if (!file) { status.textContent = 'Escolha um arquivo de backup.'; return; }
    if (file.size > MAX_BACKUP_BYTES) { status.textContent = 'O arquivo excede o limite de 50 MB.'; return; }
    status.textContent = 'Validando arquivo e autenticação…';
    try {
      const snapshot = await readBackupFile(await file.text(), $('#backup-import-password').value);
      const current = await vault.storageInfo();
      const accepted = window.confirm(`Backup válido com ${snapshot.records.length} registros. Restaurar agora substituirá todos os ${current.count} registros deste cofre. Esta ação não pode ser desfeita. Continuar?`);
      if (!accepted) { status.textContent = 'Restauração cancelada; o cofre não foi alterado.'; return; }
      const count = await vault.replaceAll(snapshot.records);
      status.textContent = `Restauração concluída: ${count} registros autenticados e regravados no cofre.`;
      toast('Backup restaurado.');
      $('#backup-import-form').reset();
    } catch (error) { status.textContent = userError(error, 'Falha ao validar ou restaurar o backup.'); }
  });
  $('#validate-storage').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    const status = $('#storage-validation-result');
    button.disabled = true;
    status.textContent = 'Verificando autenticação e formato dos registros…';
    try {
      const result = await vault.validateIntegrity();
      status.textContent = result.failures.length
        ? `${result.valid} de ${result.total} registros válidos; ${result.failures.length} com falha de integridade. Nenhum dado foi alterado.`
        : `Integridade confirmada: ${result.valid} registros autenticados e válidos.`;
    } catch (error) { status.textContent = userError(error, 'Não foi possível validar o armazenamento.'); }
    finally { button.disabled = false; }
  });
}

async function route() {
  const [name, routeParam = ''] = (location.hash.slice(1) || 'dashboard').split('/');
  const validRoutes = ['dashboard', 'tasks', 'calendar', 'habits', 'goals', 'study', 'projects', 'notes', 'focus', 'fitness', 'analytics', 'knowledge', 'customization', 'appearance', 'accessibility', 'privacy'];
  const routeName = validRoutes.includes(name) ? name : 'dashboard';
  if (!validRoutes.includes(name)) history.replaceState(null, '', '#dashboard');
  setActiveRoute(routeName);
  setSidebarOpen(false);
  if (!vault && !['appearance', 'privacy'].includes(routeName)) return;
  if (routeName === 'dashboard') { setPageTitle('Painel'); await renderDashboardView(); }
  else if (routeName === 'tasks') { setPageTitle('Tarefas'); await renderTasks(vault, view, toast); }
  else if (routeName === 'calendar') { setPageTitle('Calendário'); await renderCalendar(vault, view, toast); }
  else if (routeName === 'habits') { setPageTitle('Hábitos'); await renderHabits(vault, view, toast); }
  else if (routeName === 'goals') { setPageTitle('Objetivos'); await renderGoals(vault, view, toast); }
  else if (routeName === 'study') { setPageTitle('Estudos'); await renderStudy(vault, view, toast); }
  else if (routeName === 'projects') { setPageTitle('Projetos'); await renderProjects(vault, view, toast); }
  else if (routeName === 'notes') { setPageTitle('Anotações'); await renderNotes(vault, view, toast, decodeURIComponent(routeParam)); }
  else if (routeName === 'focus') { setPageTitle('Modo Foco'); await renderFocus(vault, view, toast); }
  else if (routeName === 'fitness') { setPageTitle('Atividades físicas'); await renderFitness(vault, view, toast); }
  else if (routeName === 'analytics') { setPageTitle('Estatísticas'); await renderAnalytics(vault, view); }
  else if (routeName === 'knowledge') { setPageTitle('Mapa de conhecimento'); await renderKnowledgeGraph(vault, view); }
  else if (routeName === 'customization') { setPageTitle('Personalização'); await renderCustomization(vault, view, toast); }
  else if (routeName === 'appearance') await renderAppearance();
  else if (routeName === 'accessibility') { setPageTitle('Acessibilidade'); await renderAccessibility(vault, view, toast); }
  else if (routeName === 'privacy') await renderPrivacy();
  $('#main-content').focus({ preventScroll: true });
}

function setSidebarOpen(open) {
  const mobile = matchMedia('(max-width: 720px)').matches;
  const expanded = Boolean(open && mobile);
  const sidebar = $('.sidebar');
  sidebar.classList.toggle('is-open', expanded);
  sidebar.inert = mobile && !expanded;
  sidebar.setAttribute('aria-hidden', String(mobile && !expanded));
  document.body.classList.toggle('sidebar-open', expanded);
  $('#menu-button').setAttribute('aria-expanded', String(expanded));
  $('#sidebar-overlay').hidden = !expanded;
}

async function unlockSubmit(event) {
  event.preventDefault();
  const password = $('#passphrase').value;
  const hasExistingVault = await hasVault(db);
  const error = $('#lock-error');
  error.hidden = true;
  if (password.length < 10) {
    error.textContent = 'Use uma senha com pelo menos 10 caracteres.';
    error.hidden = false;
    return;
  }
  $('#vault-submit').disabled = true;
  $('#vault-submit').textContent = hasExistingVault ? 'Desbloqueando…' : 'Criando cofre…';
  try {
    if (!hasExistingVault) {
      if (password !== $('#passphrase-confirm').value) throw new Error('As senhas não coincidem.');
      vault = await createVault(db, password);
      toast('Cofre criado e pronto para uso neste dispositivo.');
    } else {
      vault = await unlockVault(db, password);
    }
    preferences = normalizePreferences((await vault.get('settings', 'appearance')) || DEFAULT_PREFERENCES);
    applyPreferences(preferences);
    lockScreen.hidden = true;
    appShell.hidden = false;
    $('#passphrase').value = '';
    $('#passphrase-confirm').value = '';
    await route();
  } catch (caught) {
    error.textContent = caught.message || 'Não foi possível abrir o cofre.';
    error.hidden = false;
  } finally {
    $('#vault-submit').disabled = false;
    $('#vault-submit').textContent = hasExistingVault ? 'Desbloquear cofre' : 'Criar cofre';
  }
}

function updateConnectivity() {
  const online = navigator.onLine;
  const badge = $('#connectivity');
  badge.classList.toggle('is-offline', !online);
  badge.lastElementChild.textContent = online ? 'Online' : 'Offline';
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register('./service-worker.js', { scope: './' });
    const announceUpdate = (worker) => {
      if (!worker || !navigator.serviceWorker.controller || announcedUpdateWorker === worker) return;
      announcedUpdateWorker = worker;
      toast('Uma atualização do LifeOS está pronta.', 'Atualizar', () => worker.postMessage({ type: 'SKIP_WAITING' }));
    };
    announceUpdate(registration.waiting);
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed') announceUpdate(registration.waiting || worker);
      });
    });
    registration.update().catch(() => {});
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload());
  } catch (error) {
    console.warn('Service Worker não pôde ser registrado.', error);
  }
}

function bindGlobalControls() {
  let wasMobile = matchMedia('(max-width: 720px)').matches;
  window.addEventListener('hashchange', route);
  $('#lock-button').addEventListener('click', lockVault);
  $('#top-lock-button').addEventListener('click', lockVault);
  $('#menu-button').addEventListener('click', () => {
    const opening = !$('.sidebar').classList.contains('is-open');
    setSidebarOpen(opening);
    if (opening) $('#close-sidebar').focus();
  });
  $('#close-sidebar').addEventListener('click', () => { setSidebarOpen(false); $('#menu-button').focus(); });
  $('#sidebar-overlay').addEventListener('click', () => { setSidebarOpen(false); $('#menu-button').focus(); });
  window.addEventListener('keydown', (event) => { if (event.key === 'Escape' && $('.sidebar').classList.contains('is-open')) { setSidebarOpen(false); $('#menu-button').focus(); } });
  window.addEventListener('resize', () => {
    const isMobile = matchMedia('(max-width: 720px)').matches;
    if (isMobile !== wasMobile) { wasMobile = isMobile; setSidebarOpen(false); }
  });
  setSidebarOpen(false);
  window.addEventListener('online', updateConnectivity);
  window.addEventListener('offline', updateConnectivity);
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Operação inesperada no LifeOS.', event.reason);
    toast(userError(event.reason, 'Uma operação não foi concluída. Confira os dados e tente novamente.'));
  });
  window.addEventListener('error', (event) => {
    console.error('Erro inesperado no LifeOS.', event.error || event.message);
    toast('Ocorreu um erro inesperado. Atualize a tela; seus dados salvos permanecem no armazenamento local.');
  });
  updateConnectivity();
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    let button = $('#install-button');
    if (!button) {
      button = document.createElement('button');
      button.id = 'install-button';
      button.className = 'button button-quiet install-button';
      button.type = 'button';
      button.textContent = 'Instalar';
      $('.topbar-actions').prepend(button);
      button.addEventListener('click', async () => {
        if (!deferredInstallPrompt) return;
        await deferredInstallPrompt.prompt();
        deferredInstallPrompt = null;
        button.remove();
      });
    }
  });
  $('#vault-form').addEventListener('submit', unlockSubmit);
}

async function init() {
  bindGlobalControls();
  await registerServiceWorker();
  try {
    if (!('indexedDB' in window)) throw new Error('Este navegador não oferece IndexedDB.');
    db = await openDatabase();
    showLock(await hasVault(db));
  } catch (error) {
    showLock(true);
    $('#lock-description').textContent = error.message;
    $('#vault-form').hidden = true;
  }
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    if (preferences.theme === 'system') applyPreferences(preferences);
  });
}

init();
