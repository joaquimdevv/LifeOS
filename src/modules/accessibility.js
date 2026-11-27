import { DEFAULT_PREFERENCES, applyPreferences, normalizePreferences } from '../preferences.js';
import { $ } from '../dom.js';

export async function renderAccessibility(vault, view, toast) {
  let preferences = normalizePreferences((await vault.get('settings', 'appearance')) || DEFAULT_PREFERENCES);

  function render() {
    view.innerHTML = `<div class="page-heading"><div><p class="eyebrow">ACESSIBILIDADE</p><h1>Centro de acessibilidade</h1><p class="muted">Ajuste leitura, contraste, movimento e simplicidade. As preferências são aplicadas à interface inteira e salvas no cofre.</p></div></div>
      <section class="settings-panel accessibility-panel">
        <div class="setting-section range-section"><div><h2 id="access-text-title">Tamanho do texto</h2><p>Amplie até 200% para facilitar a leitura. A interface reorganiza o conteúdo conforme o espaço disponível.</p></div><div class="range-control"><input id="access-text-scale" type="range" min="90" max="200" step="5" value="${preferences.textScale}" aria-labelledby="access-text-title" aria-describedby="access-text-help"><output id="access-text-output" for="access-text-scale">${preferences.textScale}%</output></div><span id="access-text-help" class="field-hint">Use as setas do teclado para ajustar em passos de 5%.</span></div>
        <div class="setting-section"><div><h2>Contraste reforçado</h2><p>Realça bordas e textos secundários.</p></div><label class="switch"><input id="access-contrast" type="checkbox"${preferences.contrast ? ' checked' : ''}><span class="switch-track"></span><span class="sr-only">Contraste reforçado</span></label></div>
        <div class="setting-section"><div><h2>Reduzir movimento</h2><p>Minimiza animações e transições da interface.</p></div><label class="switch"><input id="access-motion" type="checkbox"${preferences.reducedMotion ? ' checked' : ''}><span class="switch-track"></span><span class="sr-only">Reduzir movimento</span></label></div>
        <div class="setting-section"><div><h2>Interface simplificada</h2><p>Oculta adornos visuais que não carregam informação e reduz efeitos de superfície.</p></div><label class="switch"><input id="access-simple" type="checkbox"${preferences.simplified ? ' checked' : ''}><span class="switch-track"></span><span class="sr-only">Interface simplificada</span></label></div>
        <p id="access-status" class="field-hint" role="status" aria-live="polite">As alterações são salvas neste cofre.</p>
      </section>
      <section class="module-panel accessibility-guidance"><h2>Teclado e leitores de tela</h2><ul><li>Use Tab e Shift+Tab para percorrer controles; Enter ou Espaço ativa botões e opções.</li><li>Pressione Esc para fechar a navegação móvel e modais que oferecem esse atalho.</li><li>Ao abrir uma página, o foco é levado à área principal para anunciar o novo conteúdo.</li></ul><a class="button button-quiet" href="#appearance">Abrir outras preferências visuais</a></section>`;
    bind();
  }

  function bind() {
    $('#access-text-scale', view).addEventListener('input', (event) => { $('#access-text-output', view).value = `${event.target.value}%`; $('#access-text-output', view).textContent = `${event.target.value}%`; });
    $('#access-text-scale', view).addEventListener('change', (event) => update({ textScale: Number(event.target.value) }));
    $('#access-contrast', view).addEventListener('change', (event) => update({ contrast: event.target.checked }));
    $('#access-motion', view).addEventListener('change', (event) => update({ reducedMotion: event.target.checked }));
    $('#access-simple', view).addEventListener('change', (event) => update({ simplified: event.target.checked }));
  }

  async function update(changes) {
    const previous = preferences;
    preferences = normalizePreferences({ ...preferences, ...changes });
    applyPreferences(preferences);
    const status = $('#access-status', view);
    status.textContent = 'Salvando preferências…';
    try {
      await vault.save('settings', 'appearance', preferences);
      status.textContent = 'Preferências de acessibilidade salvas neste cofre.';
    } catch (error) {
      preferences = previous;
      applyPreferences(preferences);
      toast(`Não foi possível salvar as preferências: ${error.message}`);
      render();
    }
  }

  render();
}
