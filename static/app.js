const state = { favoriteOnly: false, recipes: [], detailRecipeId: null, category: '' };
const recipeCategories = ['Antipasti', 'Primi', 'Secondi', 'Contorni', 'Dolci', 'Pane e pizza', 'Altro'];
function availableCategories() {
  const customCategories = state.recipes.map(categoryLabel).filter(category => !recipeCategories.includes(category));
  return [...recipeCategories, ...new Set(customCategories)];
}
const $ = (selector) => document.querySelector(selector);
const toast = (message) => { const node = $('#toast'); node.textContent = message; node.classList.add('show'); setTimeout(() => node.classList.remove('show'), 2600); };
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));

async function loadStats() {
  const response = await fetch('/api/stats'); const stats = await response.json();
  $('#total-count').textContent = stats.total; $('#favorite-count').textContent = stats.favorites;
}
async function loadLibrary() {
  const query = new URLSearchParams({ q: $('#library-search').value, ingredient: $('#ingredient-filter').value, exclude_ingredient: $('#exclude-ingredient-filter').value, status: $('#status-filter').value, favorite: state.favoriteOnly });
  const response = await fetch(`/api/recipes?${query}`); state.recipes = await response.json(); renderLibrary(); loadStats();
}
function categoryLabel(recipe) {
  const raw = String((recipe.categories || [])[0] || '').toLowerCase();
  if (raw.includes('antipast')) return 'Antipasti';
  if (raw.includes('prim') || raw.includes('pasta') || raw.includes('risott')) return 'Primi';
  if (raw.includes('second') || raw.includes('carne') || raw.includes('pesce')) return 'Secondi';
  if (raw.includes('contorn') || raw.includes('verdure')) return 'Contorni';
  if (raw.includes('dessert') || raw.includes('dolc') || raw.includes('torta')) return 'Dolci';
  if (raw.includes('pane') || raw.includes('pizza')) return 'Pane e pizza';
  return recipe.categories?.[0] || 'Altro';
}
function recipeCard(recipe) {
  return `<article class="recipe-card" data-id="${recipe.id}">
    <div class="recipe-image ${recipe.image_path ? '' : 'no-image'}" ${recipe.image_path ? `style="background-image:url('${recipe.image_path}')"` : ''}>
      ${recipe.image_path ? '' : '✦'}<button class="heart" data-favorite="${recipe.id}" title="Preferita">${recipe.favorite ? '♥' : '♡'}</button>
    </div><div class="recipe-body"><small>${escapeHtml(categoryLabel(recipe))}</small><h3>${escapeHtml(recipe.title)}</h3><p>${escapeHtml(recipe.description || (recipe.ingredients || []).slice(0, 3).join(' · '))}</p>${recipe.source_url.startsWith('manual://') ? '' : `<a class="recipe-source" href="${escapeHtml(recipe.source_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(recipe.source_url)}</a>`}</div>
  </article>`;
}
function renderLibrary() {
  const grid = $('#recipe-grid'); $('#empty-library').classList.toggle('hidden', state.recipes.length > 0);
  const selectedCategory = state.category;
  const categoriesForFilter = availableCategories();
  $('#category-tabs').innerHTML = `<button class="category-tab ${selectedCategory ? '' : 'active'}" data-category="" type="button">Tutte <span>${state.recipes.length}</span></button>${categoriesForFilter.map(category => { const count = state.recipes.filter(recipe => categoryLabel(recipe) === category).length; return `<button class="category-tab ${selectedCategory === category ? 'active' : ''}" data-category="${escapeHtml(category)}" type="button">${escapeHtml(category)} <span>${count}</span></button>`; }).join('')}`;
  const visibleRecipes = state.recipes.filter(recipe => !selectedCategory || categoryLabel(recipe) === selectedCategory);
  grid.innerHTML = visibleRecipes.map(recipeCard).join('');
  $('#category-tabs').querySelectorAll('.category-tab').forEach(button => button.addEventListener('click', () => { state.category = button.dataset.category; renderLibrary(); }));
  grid.querySelectorAll('[data-favorite]').forEach(button => button.addEventListener('click', async (event) => { event.stopPropagation(); await fetch(`/api/recipes/${button.dataset.favorite}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({favorite: button.textContent === '♡'}) }); loadLibrary(); }));
  grid.querySelectorAll('.recipe-image').forEach(image => image.addEventListener('click', () => showRecipeDetail(state.recipes.find(recipe => recipe.id === image.closest('.recipe-card').dataset.id))));
}
function showRecipeDetail(recipe) {
  if (!recipe) return;
  state.detailRecipeId = recipe.id;
  const list = (items, tag) => (items || []).length ? `<${tag}>${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</${tag}>` : '<p>Non disponibile</p>';
  const nutrition = Object.entries(recipe.nutrition || {}).map(([key, value]) => `${escapeHtml(key)}: ${escapeHtml(value)}`).join(' · ');
  const category = categoryLabel(recipe);
  const categoryOptions = availableCategories().map(item => `<option value="${escapeHtml(item)}" ${category === item ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('');
  $('#recipe-detail-content').innerHTML = `${recipe.image_path ? `<div class="recipe-detail-image" style="background-image:url('${recipe.image_path}')"></div>` : ''}<div class="recipe-detail-content"><small>${escapeHtml(recipe.source_site || 'ricetta')}</small><h2>${escapeHtml(recipe.title)}</h2><label class="category-control">Categoria <select id="recipe-category">${categoryOptions}<option value="__new__">+ Nuova categoria</option></select></label><form id="new-category-form" class="new-category-form hidden"><label for="new-category">Nuova categoria</label><div><input id="new-category" type="text" maxlength="40" placeholder="es. Preferite estive" required><button class="secondary" type="submit">Aggiungi</button></div></form><label class="image-upload">${recipe.image_path ? 'Sostituisci immagine' : 'Aggiungi immagine'}<input id="recipe-image-upload" type="file" accept="image/*"></label><label class="status-control">Stato ricetta <select id="recipe-status"><option value="da provare" ${recipe.status === 'da provare' ? 'selected' : ''}>Da provare</option><option value="preparata" ${recipe.status === 'preparata' ? 'selected' : ''}>Già preparata</option></select></label><div class="recipe-detail-meta">${[['Preparazione', recipe.prep_time], ['Cottura', recipe.cook_time], ['Totale', recipe.total_time], ['Porzioni', recipe.servings], ['Cucina', recipe.cuisine], ['Valutazione', recipe.rating]].filter(([, value]) => value).map(([label, value]) => `<span>${escapeHtml(label)}: ${escapeHtml(value)}</span>`).join('')}</div><p>${escapeHtml(recipe.description || 'Nessuna descrizione disponibile.')}</p><h4>Ingredienti</h4>${list(recipe.ingredients, 'ul')}<h4>Procedimento</h4>${list(recipe.instructions, 'ol')}${nutrition ? `<h4>Informazioni nutrizionali</h4><p>${nutrition}</p>` : ''}<form id="manual-text-form" class="manual-text-form"><label for="manual-text">Testo aggiuntivo</label><textarea id="manual-text" rows="8" placeholder="Incolla qui una ricetta o degli appunti...">${escapeHtml(recipe.manual_text || '')}</textarea><button class="primary" type="submit">Salva testo</button></form><h4>Fonte originale</h4>${recipe.source_url.startsWith('manual://') ? '<p>Inserita manualmente</p>' : `<a class="recipe-source" href="${escapeHtml(recipe.source_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(recipe.source_url)}</a>`}<button id="delete-recipe" class="danger-button" type="button">Elimina ricetta</button></div>`;
  $('#recipe-detail').classList.remove('hidden');
  $('#recipe-category').addEventListener('change', async (event) => {
    if (event.target.value === '__new__') {
      $('#new-category-form').classList.remove('hidden');
      $('#new-category').focus();
      return;
    }
    const response = await fetch(`/api/recipes/${recipe.id}`, { method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({categories: [event.target.value]}) });
    if (response.ok) { recipe.categories = [event.target.value]; toast('Categoria aggiornata'); loadLibrary(); }
  });
  $('#new-category-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = $('#new-category');
    const newCategory = input.value.trim();
    if (!newCategory) return;
    const existingCategory = availableCategories().find(item => item.toLocaleLowerCase() === newCategory.toLocaleLowerCase());
    const categoryToSave = existingCategory || newCategory;
    const response = await fetch(`/api/recipes/${recipe.id}`, { method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({categories: [categoryToSave]}) });
    if (response.ok) { recipe.categories = [categoryToSave]; toast('Nuova categoria aggiunta'); closeRecipeDetail(); loadLibrary(); }
    else toast('Impossibile aggiungere la categoria');
  });
  $('#delete-recipe').addEventListener('click', async () => {
    if (!window.confirm(`Eliminare la ricetta "${recipe.title}"?`)) return;
    const response = await fetch(`/api/recipes/${recipe.id}`, {method: 'DELETE'});
    if (response.ok) { closeRecipeDetail(); toast('Ricetta eliminata'); loadLibrary(); }
    else toast('Impossibile eliminare la ricetta');
  });
  $('#recipe-image-upload').addEventListener('change', uploadRecipeImage);
  $('#recipe-status').addEventListener('change', async (event) => {
    const response = await fetch(`/api/recipes/${recipe.id}`, { method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({status: event.target.value}) });
    if (response.ok) { recipe.status = event.target.value; toast('Stato della ricetta aggiornato'); loadLibrary(); }
  });
  $('#manual-text-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = $('#manual-text').value;
    const response = await fetch(`/api/recipes/${recipe.id}`, { method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({manual_text: text}) });
    if (response.ok) { Object.assign(recipe, await response.json()); showRecipeDetail(recipe); toast('Testo salvato'); }
    else toast('Impossibile salvare il testo');
  });
}
async function uploadRecipeImage(event) {
  const file = event.target.files[0]; if (!file) return;
  const recipeId = state.detailRecipeId;
  if (!recipeId) return toast('Ricetta non trovata');
  const formData = new FormData(); formData.append('image', file);
  const response = await fetch(`/api/recipes/${recipeId}/image`, {method: 'POST', body: formData});
  if (!response.ok) { const payload = await response.json(); return toast(payload.detail || 'Immagine non caricata'); }
  const recipe = await response.json(); const current = state.recipes.find(item => item.id === recipeId); Object.assign(current, recipe); toast('Immagine salvata'); closeRecipeDetail(); renderLibrary();
}
function closeRecipeDetail() { $('#recipe-detail').classList.add('hidden'); }
function showManualRecipeForm() {
  state.detailRecipeId = null;
  $('#recipe-detail-content').innerHTML = `<form id="manual-recipe-form" class="recipe-detail-content manual-recipe-form"><h2>Nuova ricetta</h2><label for="manual-title">Titolo *</label><input id="manual-title" name="title" required maxlength="200" autofocus><label for="manual-description">Descrizione</label><textarea id="manual-description" name="description" rows="2"></textarea><label for="manual-category">Categoria</label><input id="manual-category" name="category" placeholder="es. Primi"><div class="form-row"><label for="manual-prep-time">Preparazione<input id="manual-prep-time" name="prep_time" placeholder="es. 20 min"></label><label for="manual-cook-time">Cottura<input id="manual-cook-time" name="cook_time" placeholder="es. 35 min"></label></div><label for="manual-servings">Porzioni</label><input id="manual-servings" name="servings" placeholder="es. 4 persone"><label for="manual-ingredients">Ingredienti <small>Uno per riga</small></label><textarea id="manual-ingredients" name="ingredients" rows="5" placeholder="200 g di pasta&#10;1 cipolla"></textarea><label for="manual-instructions">Procedimento <small>Un passaggio per riga</small></label><textarea id="manual-instructions" name="instructions" rows="6"></textarea><label for="manual-notes">Appunti</label><textarea id="manual-notes" name="manual_text" rows="3"></textarea><div class="form-actions"><button class="secondary" type="button" id="cancel-manual-recipe">Annulla</button><button class="primary" type="submit">Salva ricetta</button></div></form>`;
  $('#recipe-detail').classList.remove('hidden');
  $('#manual-title').focus();
  $('#cancel-manual-recipe').addEventListener('click', closeRecipeDetail);
  $('#manual-recipe-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const lines = (value) => String(value).split(/\r?\n/).map(item => item.trim()).filter(Boolean);
    const payload = {
      title: data.get('title'), description: data.get('description'),
      categories: lines(data.get('category')), ingredients: lines(data.get('ingredients')),
      instructions: lines(data.get('instructions')), prep_time: data.get('prep_time'),
      cook_time: data.get('cook_time'), servings: data.get('servings'), manual_text: data.get('manual_text'),
    };
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const response = await fetch('/api/recipes', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)});
      const recipe = await response.json();
      if (!response.ok) throw new Error(recipe.detail || 'Impossibile salvare la ricetta');
      closeRecipeDetail();
      await loadLibrary();
      showRecipeDetail(recipe);
      toast('Ricetta salvata nella raccolta');
    } catch (error) {
      toast(error.message);
      button.disabled = false;
    }
  });
}
function showView(view) { $('#library-view').classList.toggle('hidden', view !== 'library'); $('#search-view').classList.toggle('hidden', view !== 'search'); $('#page-title').textContent = view === 'library' ? 'La mia raccolta' : 'Cerca online'; document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.view === view)); if (view === 'library') loadLibrary(); }
async function runSearch() {
  const query = $('#online-search').value.trim(); if (query.length < 2) return toast('Scrivi almeno due caratteri');
  const container = $('#search-results'); container.innerHTML = '<p>Sto cercando...</p>';
  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`); const payload = await response.json();
  if (!response.ok) { container.innerHTML = `<p class="empty">${escapeHtml(payload.detail || 'SearXNG non disponibile.')}</p>`; return; }
  const results = payload;
  container.innerHTML = results.length ? results.map(result => `<article class="result"><div><small>${escapeHtml(result.source)}</small><h3>${escapeHtml(result.title)}</h3><p>${escapeHtml(result.description || '')}</p><a class="result-url" href="${escapeHtml(result.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(result.url)}</a></div><button class="${result.saved ? 'saved' : ''}" data-url="${escapeHtml(result.url)}">${result.saved ? 'Già salvata' : '＋ Salva ricetta'}</button></article>`).join('') : '<p class="empty">Nessun risultato. Verifica che SearXNG sia raggiungibile.</p>';
  container.querySelectorAll('button:not(.saved)').forEach(button => button.addEventListener('click', async () => { button.disabled = true; button.textContent = 'Importazione...'; const response = await fetch('/api/import', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({urls:[button.dataset.url]})}); const [recipe] = await response.json(); if (recipe.error) { toast('Importazione non riuscita'); button.disabled = false; button.textContent = '＋ Salva ricetta'; } else { button.textContent = 'Salvata'; button.classList.add('saved'); toast('Ricetta salvata nella raccolta'); loadStats(); } }));
}
async function importFromUrl(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const input = $('#recipe-url');
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true; button.textContent = 'Importazione...';
  try {
    const response = await fetch('/api/import', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({urls:[input.value.trim()]})});
    const payload = await response.json();
    const recipe = payload[0];
    if (!response.ok || recipe?.error) throw new Error(recipe?.error || 'URL non valido');
    input.value = ''; form.classList.add('hidden'); toast('Ricetta importata nella raccolta'); await loadLibrary();
  } catch (error) {
    toast(`Importazione non riuscita: ${error.message}`);
  } finally {
    button.disabled = false; button.textContent = 'Importa';
  }
}
$('#library-search').addEventListener('input', loadLibrary); $('#ingredient-filter').addEventListener('input', loadLibrary); $('#exclude-ingredient-filter').addEventListener('input', loadLibrary); $('#status-filter').addEventListener('change', loadLibrary); $('#favorites-filter').addEventListener('click', () => { state.favoriteOnly = !state.favoriteOnly; $('#favorites-filter').textContent = state.favoriteOnly ? '♥' : '♡'; loadLibrary(); });
$('#run-search').addEventListener('click', runSearch); $('#online-search').addEventListener('keydown', event => { if (event.key === 'Enter') runSearch(); });
$('#new-search').addEventListener('click', () => showView('search')); $('#empty-search').addEventListener('click', () => showView('search')); $('#import-url-toggle').addEventListener('click', () => { $('#url-import-form').classList.toggle('hidden'); if (!$('#url-import-form').classList.contains('hidden')) $('#recipe-url').focus(); }); $('#url-import-form').addEventListener('submit', importFromUrl); document.querySelectorAll('.nav-item').forEach(item => item.addEventListener('click', () => showView(item.dataset.view)));
$('#manual-recipe-toggle').addEventListener('click', showManualRecipeForm);
$('#close-detail').addEventListener('click', closeRecipeDetail); $('#recipe-detail').addEventListener('click', event => { if (event.target.id === 'recipe-detail') closeRecipeDetail(); }); document.addEventListener('keydown', event => { if (event.key === 'Escape') closeRecipeDetail(); });
loadLibrary();
