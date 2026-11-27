import { html } from '../validation.js';
import { $ } from '../dom.js';
import { getModulePreferences } from './customization.js';

function noteLinks(note, notes) {
  const ids = new Set(Array.isArray(note.links) ? note.links : []);
  for (const [, title] of note.body.matchAll(/\[\[([^\]]{1,160})\]\]/g)) {
    const target = notes.find((item) => item.title.toLocaleLowerCase('pt-BR') === title.trim().toLocaleLowerCase('pt-BR'));
    if (target && target.id !== note.id) ids.add(target.id);
  }
  return [...ids].filter((id) => id !== note.id && notes.some((item) => item.id === id));
}

export async function renderKnowledgeGraph(vault, view) {
  const nodeLimit = (await getModulePreferences(vault)).graphLimit;
  let folderFilter = '';
  let tagFilter = '';
  let selectedId = '';
  let zoom = 1;
  let panX = 0;
  let panY = 0;

  async function render() {
    const notes = (await vault.list('notes')).map(({ id, value }) => ({ ...value, id })).sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
    const folders = [...new Set(notes.map((n) => n.folder).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const tags = [...new Set(notes.flatMap((n) => n.tags || []))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const filtered = notes.filter((n) => (!folderFilter || n.folder === folderFilter) && (!tagFilter || (n.tags || []).includes(tagFilter)));
    const visible = filtered.slice(0, nodeLimit);
    const ids = new Set(visible.map((n) => n.id));
    const center = { x: 450, y: 300 };
    const positions = new Map(visible.map((note, index) => {
      const angle = (index / Math.max(1, visible.length)) * Math.PI * 2 - Math.PI / 2;
      const radius = visible.length <= 1 ? 0 : Math.min(235, 70 + Math.sqrt(visible.length) * 22);
      return [note.id, { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius }];
    }));
    const edges = new Map();
    visible.forEach((note) => noteLinks(note, notes).forEach((targetId) => {
      if (!ids.has(targetId)) return;
      const [from, to] = [note.id, targetId].sort();
      edges.set(`${from}|${to}`, { from, to });
    }));
    const selected = filtered.find((n) => n.id === selectedId);
    const neighbors = new Set(selected ? noteLinks(selected, notes) : []);
    if (selected) filtered.filter((note) => noteLinks(note, notes).includes(selected.id)).forEach((note) => neighbors.add(note.id));
    const viewWidth = 900 / zoom; const viewHeight = 600 / zoom;
    const viewBox = `${(900 - viewWidth) / 2 + panX} ${(600 - viewHeight) / 2 + panY} ${viewWidth} ${viewHeight}`;
    view.innerHTML = `<div class="page-heading"><div><p class="eyebrow">RELAÇÕES ENTRE NOTAS</p><h1>Mapa de conhecimento</h1><p class="muted">Navegue pelos vínculos [[título da nota]] salvos nas suas anotações.</p></div></div>
      <div class="knowledge-filters module-panel"><label for="knowledge-folder">Pasta</label><select id="knowledge-folder"><option value="">Todas</option>${folders.map((f) => `<option value="${html(f)}"${folderFilter === f ? ' selected' : ''}>${html(f)}</option>`).join('')}</select><label for="knowledge-tag">Etiqueta</label><select id="knowledge-tag"><option value="">Todas</option>${tags.map((t) => `<option value="${html(t)}"${tagFilter === t ? ' selected' : ''}>${html(t)}</option>`).join('')}</select><span>${filtered.length} notas · ${edges.size} conexões no grafo${filtered.length > nodeLimit ? ` · grafo limitado a ${nodeLimit} nós; use os filtros e a lista para explorar` : ''}</span></div>
      ${filtered.length ? `<div class="knowledge-layout"><section class="module-panel knowledge-canvas-panel"><div class="knowledge-controls"><button id="graph-zoom-out" class="icon-button" type="button" aria-label="Diminuir zoom">−</button><span>${Math.round(zoom * 100)}%</span><button id="graph-zoom-in" class="icon-button" type="button" aria-label="Aumentar zoom">＋</button><button id="graph-reset" class="button button-quiet" type="button">Centralizar</button><button id="graph-pan-left" class="icon-button" type="button" aria-label="Mover mapa para a esquerda">←</button><button id="graph-pan-up" class="icon-button" type="button" aria-label="Mover mapa para cima">↑</button><button id="graph-pan-down" class="icon-button" type="button" aria-label="Mover mapa para baixo">↓</button><button id="graph-pan-right" class="icon-button" type="button" aria-label="Mover mapa para a direita">→</button></div><svg id="knowledge-graph" class="knowledge-graph" viewBox="${viewBox}" role="group" aria-label="Grafo interativo de notas">${[...edges.values()].map((edge) => { const a = positions.get(edge.from); const b = positions.get(edge.to); const active = !selectedId || edge.from === selectedId || edge.to === selectedId; return `<line class="knowledge-edge${active ? '' : ' is-muted'}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`; }).join('')}${visible.map((note) => { const p = positions.get(note.id); const active = !selectedId || note.id === selectedId || neighbors.has(note.id); const label = note.title.length > 22 ? `${note.title.slice(0, 21)}…` : note.title; return `<g class="knowledge-node${note.id === selectedId ? ' is-selected' : ''}${active ? '' : ' is-muted'}" data-knowledge-node="${html(note.id)}" tabindex="0" role="button" aria-label="Abrir nota: ${html(note.title)}"><circle cx="${p.x}" cy="${p.y}" r="${note.id === selectedId ? 11 : 8}"/><text x="${p.x}" y="${p.y + 25}" text-anchor="middle">${html(label)}</text><title>${html(note.title)}</title></g>`; }).join('')}</svg><p class="field-hint">Selecione um nó para destacar conexões. Use os controles para zoom e deslocamento.</p></section><aside class="module-panel knowledge-selection">${selected ? `<p class="eyebrow">NOTA SELECIONADA</p><h2>${html(selected.title)}</h2><p>${html(selected.body.slice(0, 600))}${selected.body.length > 600 ? '…' : ''}</p><p class="field-hint">${neighbors.size} conexões</p><button id="open-graph-note" class="button button-secondary" type="button">Abrir nota</button>` : `<div class="empty-state"><h2>Explore o mapa</h2><p>Escolha um ponto para ver a nota e seus vínculos.</p></div>`}<details class="knowledge-list"><summary>Alternativa em lista (${filtered.length})</summary><div>${filtered.map((note) => `<button type="button" data-note-list="${html(note.id)}"${note.id === selectedId ? ' aria-current="true"' : ''}>${html(note.title)}<small>${noteLinks(note, notes).length} conexões</small></button>`).join('')}</div></details></aside></div>` : `<section class="module-panel empty-state"><h2>${notes.length ? 'Nenhuma nota corresponde aos filtros' : 'Ainda não há notas para conectar'}</h2><p>${notes.length ? 'Altere os filtros de pasta ou etiqueta.' : 'Crie notas e use [[título da nota]] no texto para estabelecer relações entre elas.'}</p><a class="button button-secondary" href="#notes">Ir para anotações</a></section>`}`;
    $('#knowledge-folder', view).addEventListener('change', (event) => { folderFilter = event.target.value; selectedId = ''; render(); });
    $('#knowledge-tag', view).addEventListener('change', (event) => { tagFilter = event.target.value; selectedId = ''; render(); });
    view.querySelectorAll('[data-knowledge-node], [data-note-list]').forEach((node) => {
      const select = () => { selectedId = node.dataset.knowledgeNode || node.dataset.noteList; render(); };
      node.addEventListener('click', select);
      node.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(); } });
    });
    $('#graph-zoom-in', view)?.addEventListener('click', () => { zoom = Math.min(2.5, zoom + .2); render(); });
    $('#graph-zoom-out', view)?.addEventListener('click', () => { zoom = Math.max(.6, zoom - .2); render(); });
    $('#graph-pan-left', view)?.addEventListener('click', () => { panX -= 50 / zoom; render(); });
    $('#graph-pan-right', view)?.addEventListener('click', () => { panX += 50 / zoom; render(); });
    $('#graph-pan-up', view)?.addEventListener('click', () => { panY -= 50 / zoom; render(); });
    $('#graph-pan-down', view)?.addEventListener('click', () => { panY += 50 / zoom; render(); });
    $('#graph-reset', view)?.addEventListener('click', () => { zoom = 1; panX = 0; panY = 0; selectedId = ''; render(); });
    $('#open-graph-note', view)?.addEventListener('click', () => { location.hash = `#notes/${encodeURIComponent(selectedId)}`; });
  }
  await render();
}
