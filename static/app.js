const state = { favoriteOnly: false, recipes: [], detailRecipeId: null, category: '' };
const recipeCategories = ['Antipasti', 'Primi', 'Secondi', 'Contorni', 'Dolci', 'Pane e pizza', 'Altro'];
function availableCategories() {
  const customCategories = state.recipes.flatMap(categoryLabels).filter(category => !recipeCategories.includes(category));
  return [...recipeCategories, ...new Set(customCategories)];
}

// Supporto per multiple categorie
const DEFAULT_CATEGORIES = ['Antipasti', 'Primi', 'Secondi', 'Contorni', 'Dolci', 'Pane e pizza', 'Altro'];

function normalizeCategoryLabel(category) {
  const raw = String(category || '').toLowerCase();
  if (raw.includes('antipast')) return 'Antipasti';
  if (raw.includes('prim') || raw.includes('pasta') || raw.includes('risott')) return 'Primi';
  if (raw.includes('second') || raw.includes('carne') || raw.includes('pesce')) return 'Secondi';
  if (raw.includes('contorn') || raw.includes('verdure')) return 'Contorni';
  if (raw.includes('dessert') || raw.includes('dolc') || raw.includes('torta')) return 'Dolci';
  if (raw.includes('pane') || raw.includes('pizza')) return 'Pane e pizza';
  return category || 'Altro';
}

function categoryLabels(recipe) {
  return recipe.categories?.length
    ? [...new Set(recipe.categories.map(normalizeCategoryLabel))]
    : ['Altro'];
}

function categoryLabel(recipe) {
  return categoryLabels(recipe)[0];
}

// Alias for display purposes (same logic as categoryLabel)
function getDisplayCategoryName(recipe) {
  if (!recipe.categories || !recipe.categories.length) return 'Altro';
  const raw = String(recipe.categories[0] || '').toLowerCase();
  if (raw.includes('antipast')) return 'Antipasti';
  if (raw.includes('prim') || raw.includes('pasta') || raw.includes('risott')) return 'Primi';
  if (raw.includes('second') || raw.includes('carne') || raw.includes('pesce')) return 'Secondi';
  if (raw.includes('contorn') || raw.includes('verdure')) return 'Contorni';
  if (raw.includes('dessert') || raw.includes('dolc') || raw.includes('torta')) return 'Dolci';
  if (raw.includes('pane') || raw.includes('pizza')) return 'Pane e pizza';
  return recipe.categories?.[0] || 'Altro';
}

function categoryTags(recipe) {
  // Restituisci array di nomi categorie per visualizzazione come tag
  const shortLabels = {
    'Antipasti': 'Antipasti',
    'Primi': 'Primi',
    'Secondi': 'Secondi',
    'Contorni': 'Contorni',
    'Dolci': 'Dolci',
    'Pane e pizza': 'Pane & Pizza',
    'Altro': 'Altro'
  };
  return recipe.categories.map(cat => shortLabels[cat] || cat);
}


function categoriesHtml(recipe) {
  if (!recipe.categories || !recipe.categories.length) return "";
  const tags = recipe.categories.map(cat => `<span class="category-tag">${escapeHtml(categoryLabel({categories:[cat]}) || cat)}</span>`).join("");
  return `<div class="recipe-categories">${tags}</div>`;
}

function categoryInputHtml(recipe) {
  const categories = [...new Set([
    ...DEFAULT_CATEGORIES,
    ...state.recipes.flatMap(item => item.categories || []),
    ...(recipe.categories || []),
  ])];
  const selected = recipe.categories || [];
  return `<details class="category-input-container">
    <summary class="category-editor-summary">
      <span class="category-editor-title">Categorie</span>
      <span id="recipe-category-display">${selected.length ? escapeHtml(selected.join(', ')) : 'Nessuna categoria'}</span>
    </summary>
    <div class="category-editor-content">
      <label class="category-search-box">
        <span class="sr-only">Cerca categoria</span>
        <input type="search" id="recipe-category-search" class="form-control" placeholder="Cerca categoria..." aria-label="Cerca categoria">
      </label>
      <div class="category-dropdown-list" id="recipe-category-list">
        ${categories.map(category => `
          <label class="category-dropdown-item">
            <input type="checkbox" name="recipe-categories" value="${escapeHtml(category)}" ${selected.includes(category) ? 'checked' : ''}>
            <span>${escapeHtml(category)}</span>
          </label>
        `).join('')}
      </div>
      <div class="new-category-form">
        <label for="new-category">Nuova categoria</label>
        <div class="new-category-form-input">
          <input id="new-category" type="text" maxlength="40" placeholder="es. Preferite estive">
          <button class="secondary" type="button" id="recipe-category-add-btn">Aggiungi</button>
        </div>
      </div>
    </div>
  </details>`;
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function categoryMultiselectValue() {
  return Array.from(document.querySelectorAll('#recipe-category-list input[name="recipe-categories"]:checked'), input => input.value);
}

function setupCategoryEditor(onChange = () => {}) {
  const list = document.getElementById('recipe-category-list');
  const search = document.getElementById('recipe-category-search');
  const display = document.getElementById('recipe-category-display');
  const newCategoryInput = document.getElementById('new-category');
  const addButton = document.getElementById('recipe-category-add-btn');
  if (!list || !search || !display || !newCategoryInput || !addButton) return;

  const updateDisplay = () => {
    const selected = Array.from(list.querySelectorAll('input[name="recipe-categories"]:checked'), input => input.value);
    display.textContent = selected.length ? selected.join(', ') : 'Nessuna categoria';
    onChange(selected);
  };
  const filterCategories = () => {
    const term = search.value.trim().toLowerCase();
    list.querySelectorAll('.category-dropdown-item').forEach(item => {
      item.hidden = term !== '' && !item.textContent.toLowerCase().includes(term);
    });
  };

  search.addEventListener('input', filterCategories);
  list.addEventListener('change', updateDisplay);
  addButton.addEventListener('click', () => {
    const name = newCategoryInput.value.trim();
    if (!name) return;
    let checkbox = Array.from(list.querySelectorAll('input[name="recipe-categories"]'))
      .find(input => input.value.toLowerCase() === name.toLowerCase());
    if (!checkbox) {
      const label = document.createElement('label');
      label.className = 'category-dropdown-item';
      checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.name = 'recipe-categories';
      checkbox.value = name;
      const text = document.createElement('span');
      text.textContent = name;
      label.append(checkbox, text);
      list.appendChild(label);
    }
    checkbox.checked = true;
    newCategoryInput.value = '';
    filterCategories();
    updateDisplay();
  });
}

document.addEventListener('click', (event) => {
  const addBtn = event.target.closest('.add-category-btn');
  if (!addBtn) return;

  const wrapper = addBtn.closest('.category-multiselect-wrapper');
  const customInputDiv = wrapper.querySelector('.custom-category-input') || 
                          document.createElement('div');
  if (!customInputDiv.classList.contains('custom-category-input')) {
    customInputDiv.className = 'custom-category-input';
    customInputDiv.innerHTML = `
      <input type="text" id="new-category-custom" placeholder="Nuova categoria..." class="form-control">
      <button class="primary" type="button" id="confirm-new-category">OK</button>
      <button class="secondary danger-button" type="button" data-cancel="true">Annulla</button>
    `;
    wrapper.appendChild(customInputDiv);
  }
  customInputDiv.style.display = 'flex';
  customInputDiv.querySelector('input').focus();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Tab') {
    const inputDiv = document.querySelector('.custom-category-input');
    if (inputDiv) inputDiv.style.display = 'none';
  }
});

document.addEventListener('click', (event) => {
  if (!event.target.closest('.category-multiselect-wrapper')) {
    const inputDiv = document.querySelector('.custom-category-input');
    if (inputDiv) inputDiv.style.display = 'none';
  }
});

document.addEventListener('click', (event) => {
  const confirmButton = event.target.closest('#confirm-new-category');
  if (!confirmButton) return;

  const wrapper = confirmButton.closest('.category-multiselect-wrapper');
  const input = wrapper.querySelector('#new-category-custom');
  const list = wrapper.querySelector('#recipe-category-multiselect');
  const newCat = input.value.trim();
  if (newCat) {
    const existing = Array.from(list.querySelectorAll('input')).find(option => option.value.toLowerCase() === newCat.toLowerCase());
    if (existing) {
      existing.checked = true;
    } else {
      const label = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = newCat;
      checkbox.checked = true;
      label.append(checkbox, ` ${newCat}`);
      list.appendChild(label);
    }
    list.dispatchEvent(new Event('change', { bubbles: true }));
    toast(`Categoria aggiunta: ${newCat}`);
  }
  input.value = '';
  const customInput = wrapper.querySelector('.custom-category-input');
  if (customInput) customInput.style.display = 'none';
});

document.addEventListener('click', (event) => {
  if (event.target.closest('[data-cancel="true"]')) {
    const inputDiv = document.querySelector('.custom-category-input');
    if (inputDiv) inputDiv.style.display = 'none';
  }
});

const $ = (selector) => document.querySelector(selector);
const toast = (message) => { const node = $('#toast'); node.textContent = message; node.classList.add('show'); setTimeout(() => node.classList.remove('show'), 2600); };
const escapeHtml = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replace("'", '&#39;')
    .replace('"', '&quot;');

async function loadStats() {
  const response = await fetch('/api/stats'); const stats = await response.json();
  $('#total-count').textContent = stats.total; $('#favorite-count').textContent = stats.favorites;
}
async function loadLibrary() {
  const query = new URLSearchParams({ q: $('#library-search').value, ingredient: $('#ingredient-filter').value, exclude_ingredient: $('#exclude-ingredient-filter').value, status: $('#status-filter').value, favorite: state.favoriteOnly });
  const response = await fetch(`/api/recipes?${query}`); state.recipes = await response.json(); renderLibrary(); loadStats();
}
function recipeCard(recipe) {
  const tags = categoryTags(recipe);
  return `<article class="recipe-card" data-id="${recipe.id}">
    <div class="recipe-image ${recipe.image_path ? '' : 'no-image'}" ${recipe.image_path ? `style="background-image:url('${recipe.image_path}')"` : ''}>
      ${recipe.image_path ? '' : '✦'}<button class="heart" data-favorite="${recipe.id}" title="Preferita">${recipe.favorite ? '♥' : '♡'}</button>
    </div><div class="recipe-body"><small>${escapeHtml(getDisplayCategoryName(recipe))}${tags.length > 1 ? ` <span style="color:var(--muted)">${tags.slice(1).join(', ')}</span>` : ''}</small><h3>${escapeHtml(recipe.title)}</h3><p>${escapeHtml(recipe.description || (recipe.ingredients || []).slice(0, 3).join(' · '))}</p>${(recipe.source_url || '').startsWith('manual://') ? '' : `<a class="recipe-source" href="${escapeHtml(recipe.source_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(recipe.source_url)}</a>`}</div>
  </article>`;
}
function renderLibrary() {
  const grid = $('#recipe-grid'); $('#empty-library').classList.toggle('hidden', state.recipes.length > 0);
  const selectedCategory = state.category;
  const categoriesForFilter = availableCategories();
  $('#category-tabs').innerHTML = `<button class="category-tab ${selectedCategory ? '' : 'active'}" data-category="" type="button">Tutte <span>${state.recipes.length}</span></button>${categoriesForFilter.map(category => { const count = state.recipes.filter(recipe => categoryLabels(recipe).includes(category)).length; return `<button class="category-tab ${selectedCategory === category ? 'active' : ''}" data-category="${escapeHtml(category)}" type="button">${escapeHtml(category)} <span>${count}</span></button>`; }).join('')}`;
  const visibleRecipes = state.recipes.filter(recipe => !selectedCategory || categoryLabels(recipe).includes(selectedCategory));
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
  $('#recipe-detail-content').innerHTML = `${recipe.image_path ? `<div class="recipe-detail-image" style="background-image:url('${recipe.image_path}')"></div>` : ''}<div class="recipe-detail-content"><small>${escapeHtml(recipe.source_site || 'ricetta')}</small><h2>${escapeHtml(recipe.title)}</h2><label class="status-control">Stato ricetta <select id="recipe-status"><option value="da provare" ${recipe.status === 'da provare' ? 'selected' : ''}>Da provare</option><option value="in preparazione" ${recipe.status === 'in preparazione' ? 'selected' : ''}>In preparazione</option><option value="già preparata" ${recipe.status === 'già preparata' ? 'selected' : ''}>Già preparata</option></select></label><div class="recipe-detail-meta">${[['Preparazione', recipe.prep_time], ['Cottura', recipe.cook_time], ['Totale', recipe.total_time], ['Porzioni', recipe.servings], ['Cucina', recipe.cuisine], ['Valutazione', recipe.rating]].filter(([, value]) => value).map(([label, value]) => `<span>${escapeHtml(label)}: ${escapeHtml(value)}</span>`).join('')}</div><p>${escapeHtml(recipe.description || 'Nessuna descrizione disponibile.')}</p><h4>Ingredienti</h4>${list(recipe.ingredients, 'ul')}<h4>Procedimento</h4>${list(recipe.instructions, 'ol')}${nutrition ? `<h4>Informazioni nutrizionali</h4><p>${nutrition}</p>` : ''}<form id="manual-text-form" class="manual-text-form"><label for="manual-text">Testo aggiuntivo</label><textarea id="manual-text" rows="8" placeholder="Incolla qui una ricetta o degli appunti...">${escapeHtml(recipe.manual_text || '')}</textarea><button class="primary" type="submit">Salva testo</button></form><h4>Fonte originale</h4>${recipe.source_url.startsWith('manual://') ? '<p>Inserita manualmente</p>' : `<a class="recipe-source" href="${escapeHtml(recipe.source_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(recipe.source_url)}</a>`}<div class="recipe-detail-tools">${categoryInputHtml(recipe)}<label class="image-upload">${recipe.image_path ? 'Sostituisci immagine' : 'Aggiungi immagine'}<input id="recipe-image-upload" type="file" accept="image/*"></label></div><button id="delete-recipe" class="danger-button" type="button">Elimina ricetta</button></div>`;
  const saveRecipeCategoriesDebounced = debounce((categories) => {
    fetch(`/api/recipes/${recipe.id}`, {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({categories}),
    }).then(async response => {
      if (!response.ok) throw new Error('Impossibile aggiornare le categorie');
      Object.assign(recipe, await response.json());
      const current = state.recipes.find(item => item.id === recipe.id);
      if (current) Object.assign(current, recipe);
      renderLibrary();
    }).catch(error => toast(error.message));
  }, 400);
  setupCategoryEditor(categories => {
    recipe.categories = categories;
    saveRecipeCategoriesDebounced(categories);
  });
  const statusSelect = $('#recipe-status');
  statusSelect.options[1].textContent = 'In preparazione';
  statusSelect.value = recipe.status === 'preparata' ? 'già preparata' : recipe.status;
  $('#recipe-detail').classList.remove('hidden');
  $('#delete-recipe').addEventListener('click', async () => {
    if (!window.confirm(`Eliminare la ricetta "${recipe.title}"?`)) return;
    const response = await fetch(`/api/recipes/${recipe.id}`, {method: 'DELETE'});
    if (response.ok) { closeRecipeDetail(); toast('Ricetta eliminata'); loadLibrary(); }
    else toast('Impossibile eliminare la ricetta');
  });
  $('#recipe-image-upload').addEventListener('change', uploadRecipeImage);
  $('#recipe-status').addEventListener('change', async (event) => {
    const status = event.target.value === 'già preparata' ? 'preparata' : event.target.value;
    const response = await fetch(`/api/recipes/${recipe.id}`, { method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({status}) });
    if (response.ok) { recipe.status = status; toast('Stato della ricetta aggiornato'); loadLibrary(); }
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
  $('#recipe-detail-content').innerHTML = `<form id="manual-recipe-form" class="recipe-detail-content manual-recipe-form"><h2>Nuova ricetta</h2><label for="manual-title">Titolo *</label><input id="manual-title" name="title" required maxlength="200" autofocus><label for="manual-description">Descrizione</label><textarea id="manual-description" name="description" rows="2"></textarea>${categoryInputHtml({})}<div class="form-row"><label for="manual-prep-time">Preparazione<input id="manual-prep-time" name="prep_time" placeholder="es. 20 min"></label><label for="manual-cook-time">Cottura<input id="manual-cook-time" name="cook_time" placeholder="es. 35 min"></label></div><label for="manual-servings">Porzioni</label><input id="manual-servings" name="servings" placeholder="es. 4 persone"><label class="status-control">Stato ricetta <select id="manual-status" name="status"><option value="da provare" selected>Da provare</option><option value="in preparazione">In preparazione</option><option value="preparata">preparata</option></select></label><label for="manual-ingredients">Ingredienti <small>Uno per riga</small></label><textarea id="manual-ingredients" name="ingredients" rows="5" placeholder="200 g di pasta&#10;1 cipolla"></textarea><label for="manual-instructions">Procedimento <small>Un passaggio per riga</small></label><textarea id="manual-instructions" name="instructions" rows="6"></textarea><label for="manual-notes">Appunti</label><textarea id="manual-notes" name="manual_text" rows="3"></textarea><div class="form-actions"><button class="secondary" type="button" id="cancel-manual-recipe">Annulla</button><button class="primary" type="submit">Salva ricetta</button></div></form>`;
  $('#recipe-detail').classList.remove('hidden');
  setupCategoryEditor();
  $('#manual-title').focus();
  $('#cancel-manual-recipe').addEventListener('click', closeRecipeDetail);
  $('#manual-recipe-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const lines = (value) => String(value).split(/\r?\n/).map(item => item.trim()).filter(Boolean);
    const payload = {
      title: data.get('title'), description: data.get('description'),
      categories: categoryMultiselectValue(), ingredients: lines(data.get('ingredients')),
      instructions: lines(data.get('instructions')), prep_time: data.get('prep_time'),
      cook_time: data.get('cook_time'), servings: data.get('servings'), status: data.get('status'),
      manual_text: data.get('manual_text'),
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
  setupCategoryInteractions(recipe);


function setupCategoryInteractions(recipe) {
  const toggle = document.getElementById('recipe-category-toggle');
  const dropdown = document.getElementById('recipe-category-dropdown');
  const display = document.getElementById('recipe-category-display');
  const addBtn = document.getElementById('recipe-category-add-btn');
  const newCategoryForm = document.getElementById('new-category-form');
  const newCategoryInput = document.getElementById('new-category');

  if (!toggle || !dropdown) return;

  // Toggle dropdown visibility
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('hidden');
    toggle.classList.toggle('active');
  });

  // Close dropdown on click outside
  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && !toggle.contains(e.target)) {
      dropdown.classList.add('hidden');
      toggle.classList.remove('active');
    }
  });

  // Update display when checkboxes change
  dropdown.querySelectorAll('input[name="recipe-categories"]').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      const selected = Array.from(dropdown.querySelectorAll('input[name="recipe-categories"]:checked'))
        .map(cb => cb.value);
      updateRecipeCategories(recipe, selected);
    });
  });

  // Add new category from form
  newCategoryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newCat = newCategoryInput.value.trim();
    if (newCat) {
      const currentCategories = Array.from(dropdown.querySelectorAll('input[name="recipe-categories"]:checked')).map(cb => cb.value);
      if (!currentCategories.includes(newCat)) {
        currentCategories.push(newCat);
        updateRecipeCategories(recipe, currentCategories);
        newCategoryInput.value = '';
        newCategoryForm.classList.add('hidden');
        // Also update the state.recipes so it appears in the dropdown for other recipes
        const recipeIndex = state.recipes.findIndex(r => r.id === recipe.id);
        if (recipeIndex !== -1) {
          state.recipes[recipeIndex].categories = currentCategories;
        }
      }
    }
  });

  // Toggle new category form visibility
  addBtn.addEventListener('click', () => {
    newCategoryForm.classList.toggle('hidden');
  });
}

function updateRecipeCategories(recipe, selectedCategories) {
  recipe.categories = selectedCategories;
  const display = document.getElementById('recipe-category-display');
  if (recipe.categories && recipe.categories.length > 0) {
    display.innerHTML = recipe.categories.map(cat => `<span class="category-tag">${escapeHtml(categoryLabel({categories: [cat]}) || cat)}</span>`).join('');
  } else {
    display.innerHTML = '<span class="category-placeholder">Nessuna categoria</span>';
  }
}

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
