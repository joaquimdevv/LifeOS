import { html, makeId, optionalText, requireText } from '../validation.js';

function renderMarkdown(source, notes = []) {
  const safe = html(source);
  return safe.replace(/\[\[([^\]]{1,160})\]\]/g, (match, title) => {
    const target = notes.find((note) => note.title.toLocaleLowerCase('pt-BR') === title.trim().toLocaleLowerCase('pt-BR'));
    return target ? `<a href="#notes" class="note-wikilink" data-note-link="${html(target.id)}">${title}</a>` : `<span class="note-wikilink is-unresolved">${title}</span>`;
  }).split('\n').map((line) => {
    if (line.startsWith('### ')) return `<h4>${line.slice(4)}</h4>`;
    if (line.startsWith('## ')) return `<h3>${line.slice(3)}</h3>`;
    if (line.startsWith('# ')) return `<h2>${line.slice(2)}</h2>`;
    if (/^[-*] /.test(line)) return `<p class="markdown-list-line">• ${line.slice(2)}</p>`;
    return `<p>${line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/`(.+?)`/g, '<code>$1</code>') || '<br>'}</p>`;
  }).join('');
}

export async function renderNotes(vault, view, toast) {
  let query = '';
  let folderFilter = '';
  let favoritesOnly = false;
  let editingId = '';
  let editorOpen = false;
  let preview = false;
  let draftBody = null;
  const run = (action) => action().catch((e) => toast(`Não foi possível concluir: ${e.message}`));

  async function render() {
    const notes = (await vault.list('notes')).map(({ id, value }) => ({ ...value, id })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const selected = notes.find((note) => note.id === editingId);
    if (editorOpen && draftBody === null) draftBody = selected?.body || '';
    const folders = [...new Set(notes.map((n) => n.folder).filter(Boolean))].sort();
    const filtered = notes.filter((n) => (!favoritesOnly || n.favorite) && (!folderFilter || n.folder === folderFilter) && `${n.title} ${n.body} ${n.tags.join(' ')} ${n.folder}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')));
    view.innerHTML = `<div class="page-heading"><div><p class="eyebrow">CAPTURA E REFERÊNCIA</p><h1>Anotações</h1><p class="muted">Notas locais com editor Markdown seguro e busca por conteúdo.</p></div><button id="new-note" class="button button-primary" type="button">＋ Nova nota</button></div>
      <div class="notes-layout"><section class="notes-library"><div class="module-panel notes-toolbar"><label class="search-field"><span aria-hidden="true">⌕</span><input id="note-search" type="search" value="${html(query)}" placeholder="Buscar notas" aria-label="Buscar notas"></label><select id="note-folder-filter" aria-label="Filtrar pasta"><option value="">Todas as pastas</option>${folders.map((f) => `<option${folderFilter === f ? ' selected' : ''}>${html(f)}</option>`).join('')}</select><button id="note-favorites" class="button button-quiet" type="button" aria-pressed="${favoritesOnly}">☆ Favoritas</button></div>${filtered.map((n) => `<article class="module-panel note-card"><div class="note-card-title"><button type="button" data-open-note="${html(n.id)}"><h2>${html(n.title)}</h2></button><button type="button" class="icon-button${n.favorite ? ' is-favorite' : ''}" data-favorite-note="${html(n.id)}" aria-label="${n.favorite ? 'Remover dos' : 'Adicionar aos'} favoritos">${n.favorite ? '★' : '☆'}</button></div><p class="note-excerpt">${html(n.body.slice(0, 220))}${n.body.length > 220 ? '…' : ''}</p><div class="note-meta"><span>${html(n.folder || 'Sem pasta')}</span><time>${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(n.updatedAt))}</time></div>${n.tags?.length ? `<div class="tag-list">${n.tags.map((tag) => `<span class="tag">${html(tag)}</span>`).join('')}</div>` : ''}</article>`).join('') || `<div class="module-panel empty-state"><h2>${notes.length ? 'Nenhuma nota encontrada' : 'Sua primeira nota começa aqui'}</h2><p>Guarde ideias, referências e registros pessoais.</p><button id="empty-note" class="button button-secondary" type="button">＋ Criar nota</button></div>`}</section>
      ${editorOpen ? `<section class="module-panel note-editor"><div class="editor-heading"><h2>${selected ? 'Editar nota' : 'Nova nota'}</h2><button id="close-note" class="icon-button" type="button" aria-label="Fechar editor">×</button></div><form id="note-form" class="module-form"><label for="note-title">Título</label><input id="note-title" name="title" required maxlength="160" value="${html(selected?.title || '')}"><div class="form-two"><div><label for="note-folder">Pasta</label><input id="note-folder" name="folder" maxlength="80" value="${html(selected?.folder || '')}" placeholder="Pessoal, estudos…"></div><div><label for="note-tags">Etiquetas</label><input id="note-tags" name="tags" maxlength="300" value="${html((selected?.tags || []).join(', '))}" placeholder="Separadas por vírgula"></div></div>${!selected ? `<label for="note-template">Modelo</label><select id="note-template"><option value="">Nota em branco</option><option value="daily">Nota diária</option><option value="meeting">Reunião</option><option value="study">Estudo</option><option value="project">Projeto</option></select>` : ''}<label for="note-body">Conteúdo <span class="field-hint">Markdown básico: # título, **negrito**, *itálico*, código inline, - lista. Use [[título da nota]] para criar um link interno.</span></label><div class="note-editor-controls"><button id="note-preview-toggle" type="button" class="button button-quiet">${preview ? 'Editar texto' : 'Prévia'}</button><label class="note-favorite-check"><input name="favorite" type="checkbox"${selected?.favorite ? ' checked' : ''}> Favorita</label></div><textarea id="note-body" name="body" rows="14" maxlength="30000" required placeholder="# Uma ideia\n\nEscreva aqui…"${preview ? ' hidden' : ''}>${html(draftBody ?? selected?.body ?? '')}</textarea><div class="markdown-preview"${preview ? '' : ' hidden'}>${renderMarkdown(draftBody ?? selected?.body ?? '', notes)}</div><div class="form-actions"><button class="button button-primary" type="submit">${selected ? 'Salvar nota' : 'Criar nota'}</button><button id="cancel-note" class="button button-quiet" type="button">Cancelar</button>${selected ? `<button id="delete-note" class="button button-quiet danger-action" type="button">Excluir</button>` : ''}</div><p id="note-error" class="error-message" role="alert" hidden></p></form></section>` : ''}</div>`;
    $('#new-note', view).addEventListener('click', () => openEditor());
    $('#empty-note', view)?.addEventListener('click', () => openEditor());
    $('#note-search', view).addEventListener('input', (e) => { query = e.target.value; const cursor = query.length; render().then(() => { const input = $('#note-search', view); input.focus(); input.setSelectionRange(cursor, cursor); }); });
    $('#note-folder-filter', view).addEventListener('change', (e) => { folderFilter = e.target.value; render(); });
    $('#note-favorites', view).addEventListener('click', () => { favoritesOnly = !favoritesOnly; render(); });
    view.querySelectorAll('[data-open-note]').forEach((b) => b.addEventListener('click', () => openEditor(b.dataset.openNote)));
    view.querySelectorAll('[data-note-link]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); openEditor(b.dataset.noteLink); }));
    view.querySelectorAll('[data-favorite-note]').forEach((b) => b.addEventListener('click', () => run(() => toggleFavorite(b.dataset.favoriteNote))));
    $('#note-form', view)?.addEventListener('submit', saveNote);
    $('#note-template', view)?.addEventListener('change', (e) => { const templates = { daily: ['Registro diário', `# ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date())}\n\n## Prioridades\n- \n\n## Notas\n`], meeting: ['Reunião', '# Reunião\n\n## Participantes\n\n## Pauta\n\n## Decisões\n\n## Próximas ações\n- '], study: ['Sessão de estudo', '# Estudo\n\n## Tema\n\n## O que aprendi\n\n## Dúvidas\n'], project: ['Registro de projeto', '# Atualização do projeto\n\n## Progresso\n\n## Decisões\n\n## Próximo passo\n'] }; const value = templates[e.target.value]; if (value) { $('#note-title', view).value = value[0]; $('#note-body', view).value = value[1]; draftBody = value[1]; } });
    $('#note-body', view)?.addEventListener('input', (e) => { draftBody = e.target.value; $('.markdown-preview', view).innerHTML = renderMarkdown(draftBody, notes); });
    $('#note-preview-toggle', view)?.addEventListener('click', () => { draftBody = $('#note-body', view).value; preview = !preview; $('#note-body', view).hidden = preview; $('.markdown-preview', view).hidden = !preview; $('#note-preview-toggle', view).textContent = preview ? 'Editar texto' : 'Prévia'; });
    $('#cancel-note', view)?.addEventListener('click', closeEditor);
    $('#close-note', view)?.addEventListener('click', closeEditor);
    $('#delete-note', view)?.addEventListener('click', () => run(() => deleteNote(editingId)));
  }
  function openEditor(id = '') { editingId = id; editorOpen = true; preview = false; draftBody = null; render(); }
  function closeEditor() { editingId = ''; editorOpen = false; preview = false; draftBody = null; render(); }
  async function saveNote(event) { event.preventDefault(); const form = event.currentTarget; const v = Object.fromEntries(new FormData(form)); const error = $('#note-error', view); try { const previous = editingId ? await vault.get('notes', editingId) : null; const allNotes = (await vault.list('notes')).filter((n) => n.id !== editingId); const tags = [...new Set(String(v.tags || '').split(',').map((x) => x.trim()).filter(Boolean))].slice(0, 20).map((x) => requireText(x, 'Etiqueta', 40)); const body = requireText(v.body, 'Conteúdo', 30000); const title = requireText(v.title, 'Título', 160); const links = [...new Set([...body.matchAll(/\[\[([^\]]{1,160})\]\]/g)].map((m) => allNotes.find((n) => n.value.title.toLocaleLowerCase('pt-BR') === m[1].trim().toLocaleLowerCase('pt-BR'))?.id).filter(Boolean))]; await vault.save('notes', editingId || makeId(), { title, folder: optionalText(v.folder, 80), tags, body, favorite: form.querySelector('[name="favorite"]').checked, links, createdAt: previous?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() }); editingId = ''; editorOpen = false; draftBody = null; toast(previous ? 'Nota atualizada.' : 'Nota criada.'); await render(); } catch (e) { error.textContent = e.message; error.hidden = false; } }
  async function toggleFavorite(id) { const note = await vault.get('notes', id); if (!note) return; await vault.save('notes', id, { ...note, favorite: !note.favorite, updatedAt: new Date().toISOString() }); await render(); }
  async function deleteNote(id) { const note = await vault.get('notes', id); if (!note || !confirm(`Excluir a nota “${note.title}”? Esta ação não pode ser desfeita.`)) return; await vault.delete('notes', id); editingId = ''; editorOpen = false; toast('Nota excluída.'); await render(); }
  await render();
}
