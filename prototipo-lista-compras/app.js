/**
 * Listou - Lista de Compras & Despensa (Spotify-Inspired)
 * Interface com design escuro limpo, sem emojis, com ícones SVG nativos,
 * catálogo de 521 itens e controle completo de estoque doméstico (Despensa).
 */

// Estado Global da Aplicação
const state = {
  products: window.PRODUCTS_DATA || [],
  shoppingList: [],
  pantryList: [],
  activeTab: 'viewMinhaLista',
  listFilter: 'all', // 'all', 'pending', 'completed'
  pantryFilter: 'all', // 'all', 'low', 'empty', 'full'
  catalogSearch: '',
  catalogCategory: 'Todas',
  lastActiveItem: null,
  iconBaseUrl: localStorage.getItem('listou_spotify_icon_base') || 'http://localhost:4321/icones',
  aiChatHistory: [],
  aiConfig: {
    baseUrl: 'http://localhost:20128',
    messagesEndpoint: 'http://localhost:20128/v1/messages',
    apiKey: localStorage.getItem('sp_omniroute_api_key') || 'sk-7d670ad9c936d6ae-b3bc5d-826c9227',
    model: 'google'
  }
};

// Áudio Sintetizado (Feedback Sonoro via Web Audio API)
function playChime(success = true) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    const now = ctx.currentTime;
    if (success) {
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.12); // G5
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
      osc.start(now);
      osc.stop(now + 0.22);
    } else {
      osc.frequency.setValueAtTime(329.63, now); // E4
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    }
  } catch (e) {
    // Silently continue
  }
}

// ============================================================================
// Resolução de Ícones & Fallback Visual SVG por Categoria
// ============================================================================
function normalizeStr(str) {
  return (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function getIconUrl(item) {
  if (!item) return '';
  const defaultBase = 'https://cdn.jsdelivr.net/gh/wenderfl/Pack_PLugins_Super_Productivity@main/plugin_lista_de_compras/icones';
  let base = (state && state.iconBaseUrl) ? state.iconBaseUrl : (localStorage.getItem('listou_spotify_icon_base') || defaultBase);
  if (base.includes('localhost:4321')) {
    base = defaultBase;
    try { localStorage.setItem('listou_spotify_icon_base', defaultBase); } catch (e) {}
  }
  const cleanBase = base.replace(/\/+$/, '');
  
  let raw = '';
  if (typeof item === 'string') {
    raw = item;
  } else {
    raw = item.arquivo || item.icone || (item.nome ? item.nome + '.webp' : '');
  }
  let cleanFilename = String(raw).replace(/^.*\/icones\//, '').replace(/^icones\//, '').trim();
  try { cleanFilename = decodeURIComponent(cleanFilename); } catch (e) {}
  return cleanBase + '/' + encodeURIComponent(cleanFilename);
}

const _CAT_COLORS = {
  'Frutas': '#1ed760',
  'Verduras e Legumes': '#10b981',
  'Carnes e Proteínas': '#ef4444',
  'Laticínios': '#3b82f6',
  'Padaria': '#f59e0b',
  'Confeitaria': '#ec4899',
  'Bebidas Alcoólicas': '#8b5cf6',
  'Bebidas sem Álcool': '#06b6d4',
  'Biscoitos e Snacks': '#d97706',
  'Doces e Guloseimas': '#f43f5e',
  'Sorvetes e Sobremesas': '#a855f7',
  'Enlatados': '#64748b',
  'Mercearia': '#eab308',
  'Temperos e Condimentos': '#ea580c',
  'Congelados': '#0284c7',
  'Limpeza': '#14b8a6',
  'Ultilidades Domésticas': '#6366f1',
  'Higiene Pessoal e Cosméticos': '#f472b6',
  'Farmácia': '#dc2626',
  'Infantil': '#fbbf24',
  'Pet': '#f97316'
};

function getCatColor(cat) {
  return _CAT_COLORS[cat] || '#1ed760';
}

function getCatSvg(cat) {
  const c = cat || '';
  if (c.includes('Fruta') || c.includes('Verdura') || c.includes('Legume')) {
    return '<svg viewBox="0 0 24 24"><path d="M12 2a5 5 0 0 0-5 5c0 4 5 10 5 10s5-6 5-10a5 5 0 0 0-5-5z"/></svg>';
  }
  return '<svg viewBox="0 0 24 24"><path d="M19 6h-2c0-2.8-2.2-5-5-5S7 3.2 7 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-3c1.7 0 3 1.3 3 3H9c0-1.7 1.3-3 3-3z"/></svg>';
}

function handleIconError(img, cat) {
  if (!img) return;
  img.onerror = null;
  if (img.src && img.src.includes('cdn.jsdelivr.net')) {
    img.src = img.src.replace('https://cdn.jsdelivr.net/gh/wenderfl/Pack_PLugins_Super_Productivity@main', 'https://raw.githubusercontent.com/wenderfl/Pack_PLugins_Super_Productivity/main');
    return;
  }
  img.style.display = 'none';
  const p = img.parentElement;
  if (!p) return;
  const col = getCatColor(cat);
  const svg = getCatSvg(cat);
  let b = p.querySelector('.sp-fallback-badge');
  if (!b) {
    b = document.createElement('div');
    b.className = 'sp-fallback-badge';
    b.style.cssText = `width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${col}1a;color:${col};border-radius:inherit;`;
    b.innerHTML = svg;
    const svgEl = b.querySelector('svg');
    if (svgEl) {
      svgEl.style.cssText = 'width:55%;height:55%;fill:currentColor;';
    }
    p.appendChild(b);
  }
}

// Inicialização
function initApp() {
  try { loadSavedShoppingList(); } catch (e) {}
  try { loadSavedPantryList(); } catch (e) {}
  try { loadSavedAiChatHistory(); } catch (e) {}
  try { renderCategoryChips(); } catch (e) {}
  try { renderCatalog(); } catch (e) {}
  try { renderShoppingList(); } catch (e) {}
  try { renderPantryList(); } catch (e) {}
  try { setupEventListeners(); } catch (e) {}
  try { updateMetrics(); } catch (e) {}
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// ============================================================================
// Persistência: Lista de Compras & Despensa
// ============================================================================
function loadSavedShoppingList() {
  const saved = localStorage.getItem('listou_spotify_shopping_list');
  if (saved) {
    try {
      state.shoppingList = (JSON.parse(saved) || []).map(item => {
        if (item) item.icone = getIconUrl(item);
        return item;
      });
      if (state.shoppingList.length > 0) {
        state.lastActiveItem = state.shoppingList[0];
      }
      return;
    } catch (e) {
      console.error('Erro ao ler lista salva:', e);
    }
  }

  // Por padrão a lista começa vazia
  state.shoppingList = [];
  state.lastActiveItem = null;
  saveShoppingList();
}

function saveShoppingList() {
  localStorage.setItem('listou_spotify_shopping_list', JSON.stringify(state.shoppingList));
  updateMetrics();
}

function loadSavedPantryList() {
  const saved = localStorage.getItem('listou_spotify_pantry');
  if (saved) {
    try {
      state.pantryList = (JSON.parse(saved) || []).map(item => {
        if (item) item.icone = getIconUrl(item);
        return item;
      });
      return;
    } catch (e) {
      console.error('Erro ao ler despensa salva:', e);
    }
  }

  // Por padrão a despensa começa vazia
  state.pantryList = [];
  savePantryList();
}

function savePantryList() {
  localStorage.setItem('listou_spotify_pantry', JSON.stringify(state.pantryList));
  updateMetrics();
}

// ============================================================================
// Métricas & Bottom Player Bar do Spotify
// ============================================================================
function updateMetrics() {
  const totalItems = state.shoppingList.length;
  const completedItems = state.shoppingList.filter(i => i.comprado).length;
  const pct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
  
  const totalEstimate = state.shoppingList.reduce((acc, item) => {
    const p = parseFloat(item.preco) || 0;
    const q = parseFloat(item.quantidade) || 1;
    return acc + (p * q);
  }, 0);

  // Bottom Player Visibility & Elements
  const bottomPlayer = document.querySelector('.sp-bottom-player');
  if (bottomPlayer) {
    if (totalItems === 0) {
      bottomPlayer.classList.add('hidden');
      document.body.classList.add('player-hidden');
    } else {
      bottomPlayer.classList.remove('hidden');
      document.body.classList.remove('player-hidden');
    }
  }

  const playerStats = document.getElementById('playerProgressStats');
  const playerProgressFill = document.getElementById('playerProgressFill');
  const playerTotalVal = document.getElementById('playerTotalVal');
  const badgeListCount = document.getElementById('badgeListCount');
  const badgePantryCount = document.getElementById('badgePantryCount');
  
  if (playerStats) {
    playerStats.textContent = `${completedItems} de ${totalItems} itens concluidos (${pct}%)`;
  }
  if (playerProgressFill) {
    playerProgressFill.style.width = `${pct}%`;
  }
  if (playerTotalVal) {
    playerTotalVal.textContent = totalEstimate.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  if (badgeListCount) {
    badgeListCount.textContent = totalItems;
  }
  if (badgePantryCount) {
    badgePantryCount.textContent = state.pantryList.length;
  }

  // Active Item Preview on Bottom Player Left
  const playerThumb = document.getElementById('playerThumb');
  const playerTitle = document.getElementById('playerTitle');
  const playerSub = document.getElementById('playerSub');

  if (state.lastActiveItem && playerThumb && playerTitle && playerSub) {
    const pImg = playerThumb.querySelector('img');
    const oldBadge = playerThumb.querySelector('.sp-fallback-badge');
    if (oldBadge) oldBadge.remove();
    if (pImg) {
      pImg.style.display = 'block';
      pImg.src = getIconUrl(state.lastActiveItem);
      pImg.onerror = () => handleIconError(pImg, state.lastActiveItem.categoria);
    }
    playerTitle.textContent = state.lastActiveItem.nome;
    playerSub.textContent = `${state.lastActiveItem.categoria} • ${state.lastActiveItem.quantidade} ${state.lastActiveItem.unidade}`;
  } else if (playerTitle && playerSub) {
    playerTitle.textContent = 'Lista de Compras';
    playerSub.textContent = 'Nenhum item selecionado';
  }
}

// ============================================================================
// Renderização: Minha Lista (Estilo Tracklist do Spotify)
// ============================================================================
function renderShoppingList() {
  const container = document.getElementById('shoppingListContainer');
  if (!container) return;

  let filtered = [...state.shoppingList];
  if (state.listFilter === 'pending') {
    filtered = filtered.filter(i => !i.comprado);
  } else if (state.listFilter === 'completed') {
    filtered = filtered.filter(i => i.comprado);
  }

  if (filtered.length === 0) {
    let emptyTitle = 'Sua lista esta vazia';
    let emptyDesc = 'Explore o catalogo ou a despensa para adicionar produtos.';
    if (state.listFilter === 'pending') {
      emptyTitle = 'Tudo comprado';
      emptyDesc = 'Todos os itens da lista ja foram marcados.';
    } else if (state.listFilter === 'completed') {
      emptyTitle = 'Nenhum item marcado';
      emptyDesc = 'Marque os itens conforme for pegando nas prateleiras.';
    }

    container.innerHTML = `
      <div class="sp-empty">
        <h3>${emptyTitle}</h3>
        <p>${emptyDesc}</p>
        <button class="sp-btn-primary" id="emptyBtnGoCatalog">
          <svg class="icon-svg"><use href="#icon-grid"></use></svg>
          Abrir Catalogo
        </button>
      </div>
    `;

    const btn = document.getElementById('emptyBtnGoCatalog');
    if (btn) btn.addEventListener('click', () => switchTab('viewCatalogo'));
    return;
  }

  const groups = {};
  filtered.forEach(item => {
    const cat = item.categoria || 'Outros';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  });

  let html = '';
  Object.keys(groups).sort().forEach(cat => {
    const items = groups[cat];
    html += `
      <div style="margin-bottom: 24px;">
        <div class="sp-group-header">
          <span>${cat}</span>
          <span style="font-size: 0.8rem; font-weight: 600; color: var(--sp-subtext);">${items.length} itens</span>
        </div>
        <div class="sp-items-table">
          ${items.map(item => createShoppingItemRowHTML(item)).join('')}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
  attachShoppingListEvents(container);
}

function createShoppingItemRowHTML(item) {
  return `
    <div class="sp-item-row ${item.comprado ? 'completed' : ''}" data-id="${item.id}" id="row-${item.id}">
      <button class="sp-check-btn" data-action="toggle-check" title="Marcar item" aria-label="Marcar item">
        <svg class="icon-svg"><use href="#icon-check"></use></svg>
      </button>

      <div class="sp-item-art">
        <img src="${getIconUrl(item)}" alt="${item.nome}" loading="lazy" onerror="handleIconError(this, '${escapeHtml(item.categoria)}')">
      </div>

      <div class="sp-item-details">
        <div class="sp-item-title" title="${item.nome}">${item.nome}</div>
        <div class="sp-item-meta">${item.categoria}</div>
      </div>

      <div class="sp-qty-stepper">
        <button class="sp-stepper-btn" data-action="decrease-qty" aria-label="Diminuir">
          <svg class="icon-svg"><use href="#icon-minus"></use></svg>
        </button>
        <span class="sp-stepper-val">${item.quantidade} <span style="font-size: 0.72rem; color: var(--sp-subtext);">${item.unidade}</span></span>
        <button class="sp-stepper-btn" data-action="increase-qty" aria-label="Aumentar">
          <svg class="icon-svg"><use href="#icon-plus"></use></svg>
        </button>
      </div>

      <div class="sp-price-box" title="Preco unitario">
        <span class="sp-price-cur">R$</span>
        <input 
          type="number" 
          step="0.01" 
          min="0" 
          inputmode="decimal"
          class="sp-price-input" 
          value="${item.preco ? Number(item.preco).toFixed(2) : ''}" 
          placeholder="0,00"
          data-action="change-price"
          aria-label="Preco"
        >
        <div class="sp-price-spinners">
          <button class="sp-spin-btn" data-action="spin-price-up" title="Aumentar preco" aria-label="Aumentar preco">
            <svg class="icon-svg-xs"><use href="#icon-chevron-up"></use></svg>
          </button>
          <button class="sp-spin-btn" data-action="spin-price-down" title="Diminuir preco" aria-label="Diminuir preco">
            <svg class="icon-svg-xs"><use href="#icon-chevron-down"></use></svg>
          </button>
        </div>
      </div>

      <div class="sp-item-actions">
        ${item.comprado ? `
          <button class="sp-btn-move-pantry" data-action="move-to-pantry" title="Mover para a despensa" aria-label="Mover para despensa">
            <svg class="icon-svg"><use href="#icon-pantry"></use></svg>
            <span>Despensa</span>
          </button>
        ` : ''}
        <button class="sp-btn-del" data-action="delete-item" title="Remover" aria-label="Remover">
          <svg class="icon-svg"><use href="#icon-trash"></use></svg>
        </button>
      </div>
    </div>
  `;
}

function attachShoppingListEvents(container) {
  container.querySelectorAll('[data-action="toggle-check"]').forEach(el => {
    el.addEventListener('click', (e) => {
      const row = e.target.closest('.sp-item-row');
      toggleItemComprado(row.dataset.id);
    });
  });

  container.querySelectorAll('[data-action="increase-qty"]').forEach(el => {
    el.addEventListener('click', (e) => {
      const row = e.target.closest('.sp-item-row');
      updateItemQty(row.dataset.id, 1);
    });
  });

  container.querySelectorAll('[data-action="decrease-qty"]').forEach(el => {
    el.addEventListener('click', (e) => {
      const row = e.target.closest('.sp-item-row');
      updateItemQty(row.dataset.id, -1);
    });
  });

  container.querySelectorAll('[data-action="change-price"]').forEach(el => {
    el.addEventListener('change', (e) => {
      const row = e.target.closest('.sp-item-row');
      const val = parseFloat(e.target.value) || 0;
      updateItemPrice(row.dataset.id, val);
    });
  });

  // Spinners customizados do Preço
  container.querySelectorAll('[data-action="spin-price-up"]').forEach(el => {
    el.addEventListener('click', (e) => {
      const row = e.target.closest('.sp-item-row');
      const item = state.shoppingList.find(i => i.id === row.dataset.id);
      if (item) {
        const cur = parseFloat(item.preco) || 0;
        updateItemPrice(row.dataset.id, Math.round((cur + 0.50) * 100) / 100);
        renderShoppingList();
      }
    });
  });

  container.querySelectorAll('[data-action="spin-price-down"]').forEach(el => {
    el.addEventListener('click', (e) => {
      const row = e.target.closest('.sp-item-row');
      const item = state.shoppingList.find(i => i.id === row.dataset.id);
      if (item) {
        const cur = parseFloat(item.preco) || 0;
        updateItemPrice(row.dataset.id, Math.max(0, Math.round((cur - 0.50) * 100) / 100));
        renderShoppingList();
      }
    });
  });

  container.querySelectorAll('[data-action="move-to-pantry"]').forEach(el => {
    el.addEventListener('click', (e) => {
      const row = e.target.closest('.sp-item-row');
      moveItemToPantry(row.dataset.id);
    });
  });

  container.querySelectorAll('[data-action="delete-item"]').forEach(el => {
    el.addEventListener('click', (e) => {
      const row = e.target.closest('.sp-item-row');
      deleteItem(row.dataset.id);
    });
  });
}

function moveItemToPantry(id) {
  const idx = state.shoppingList.findIndex(i => i.id === id);
  if (idx === -1) return;

  const item = state.shoppingList[idx];
  
  // Verifica se o item já existe na despensa
  const existingInPantry = state.pantryList.find(p => p.id === item.id);
  if (existingInPantry) {
    existingInPantry.quantidade = (existingInPantry.quantidade || 0) + (item.quantidade || 1);
    existingInPantry.status = 'full';
  } else {
    state.pantryList.push({
      id: item.id,
      nome: item.nome,
      categoria: item.categoria,
      unidade: item.unidade || 'un',
      icone: item.icone,
      quantidade: item.quantidade || 1,
      status: 'full'
    });
  }

  // Remove da lista de compras
  state.shoppingList.splice(idx, 1);

  playChime(true);
  savePantryList();
  saveShoppingList();
  renderShoppingList();
  renderPantryList();
  renderMarketMode();
  renderCatalog();
  showToast(`"${item.nome}" movido para a despensa`);
}

function moveAllPurchasedToPantry() {
  const purchased = state.shoppingList.filter(i => i.comprado);
  if (purchased.length === 0) {
    showToast('Nenhum item comprado para mover');
    return;
  }

  purchased.forEach(item => {
    const existingInPantry = state.pantryList.find(p => p.id === item.id);
    if (existingInPantry) {
      existingInPantry.quantidade = (existingInPantry.quantidade || 0) + (item.quantidade || 1);
      existingInPantry.status = 'full';
    } else {
      state.pantryList.push({
        id: item.id,
        nome: item.nome,
        categoria: item.categoria,
        unidade: item.unidade || 'un',
        icone: item.icone,
        quantidade: item.quantidade || 1,
        status: 'full'
      });
    }
  });

  // Remove todos os comprados da lista
  state.shoppingList = state.shoppingList.filter(i => !i.comprado);

  playChime(true);
  savePantryList();
  saveShoppingList();
  renderShoppingList();
  renderPantryList();
  renderMarketMode();
  renderCatalog();
  showToast(`${purchased.length} itens movidos para a despensa`);
}

function toggleItemComprado(id) {
  const item = state.shoppingList.find(i => i.id === id);
  if (!item) return;

  item.comprado = !item.comprado;
  state.lastActiveItem = item;
  saveShoppingList();
  renderShoppingList();
  renderMarketMode();

  if (item.comprado) {
    playChime(true);
    showToast(`"${item.nome}" marcado como comprado`);
  }
}

function updateItemQty(id, delta) {
  const item = state.shoppingList.find(i => i.id === id);
  if (!item) return;

  item.quantidade = Math.max(1, (item.quantidade || 1) + delta);
  state.lastActiveItem = item;
  saveShoppingList();
  renderShoppingList();
  renderMarketMode();
}

function updateItemPrice(id, newPrice) {
  const item = state.shoppingList.find(i => i.id === id);
  if (!item) return;

  item.preco = Math.max(0, newPrice);
  state.lastActiveItem = item;
  saveShoppingList();
  updateMetrics();
}

function deleteItem(id) {
  const idx = state.shoppingList.findIndex(i => i.id === id);
  if (idx === -1) return;

  const item = state.shoppingList[idx];
  state.shoppingList.splice(idx, 1);
  saveShoppingList();
  renderShoppingList();
  renderMarketMode();
  renderCatalog();

  playChime(false);
  showToast(`"${item.nome}" removido`);
}

// ============================================================================
// Renderização: Despensa (Pantry Inventory)
// ============================================================================
function renderPantryList() {
  const grid = document.getElementById('pantryGrid');
  if (!grid) return;

  let filtered = [...state.pantryList];
  if (state.pantryFilter === 'low') {
    filtered = filtered.filter(i => i.status === 'low');
  } else if (state.pantryFilter === 'empty') {
    filtered = filtered.filter(i => i.status === 'empty');
  } else if (state.pantryFilter === 'full') {
    filtered = filtered.filter(i => i.status === 'full');
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1;" class="sp-empty">
        <h3>Nenhum item na despensa</h3>
        <p>Adicione produtos que voce costuma guardar em casa para gerenciar o estoque.</p>
        <button class="sp-btn-primary" id="emptyBtnAddPantry">
          <svg class="icon-svg"><use href="#icon-plus"></use></svg>
          Adicionar Item
        </button>
      </div>
    `;

    const btn = document.getElementById('emptyBtnAddPantry');
    if (btn) btn.addEventListener('click', openAddPantryModal);
    return;
  }

  grid.innerHTML = filtered.map(item => {
    let statusLabel = 'Em Estoque';
    let statusClass = 'full';
    if (item.status === 'low') {
      statusLabel = 'Acabando';
      statusClass = 'low';
    } else if (item.status === 'empty') {
      statusLabel = 'Esgotado';
      statusClass = 'empty';
    }

    return `
      <div class="sp-pantry-card" data-id="${item.id}">
        <div class="sp-pantry-thumb">
          <img src="${getIconUrl(item)}" alt="${item.nome}" loading="lazy" onerror="handleIconError(this, '${escapeHtml(item.categoria)}')">
        </div>

        <div class="sp-pantry-info">
          <div class="sp-pantry-name" title="${item.nome}">${item.nome}</div>
          <div class="sp-pantry-meta">${item.quantidade} ${item.unidade} em casa</div>
          <div class="sp-status-badge ${statusClass}" data-action="cycle-status" title="Clique para alterar status" style="cursor: pointer;">
            <span class="sp-status-dot"></span>
            <span>${statusLabel}</span>
          </div>
        </div>

        <div class="sp-pantry-ctrls">
          <button class="sp-btn-add-to-list" data-action="add-to-shopping" title="Adicionar a Lista de Compras">
            <svg class="icon-svg"><use href="#icon-plus"></use></svg>
            Lista
          </button>
          
          <div class="sp-qty-stepper" style="padding: 1px 4px;">
            <button class="sp-stepper-btn" data-action="pantry-dec" style="width: 20px; height: 20px;">
              <svg class="icon-svg" style="width: 12px; height: 12px;"><use href="#icon-minus"></use></svg>
            </button>
            <span class="sp-stepper-val" style="font-size: 0.8rem; min-width: 24px;">${item.quantidade}</span>
            <button class="sp-stepper-btn" data-action="pantry-inc" style="width: 20px; height: 20px;">
              <svg class="icon-svg" style="width: 12px; height: 12px;"><use href="#icon-plus"></use></svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  attachPantryEvents(grid);
}

function attachPantryEvents(grid) {
  // Add to Shopping List
  grid.querySelectorAll('[data-action="add-to-shopping"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const card = e.target.closest('.sp-pantry-card');
      const item = state.pantryList.find(p => p.id === card.dataset.id);
      if (item) {
        addProductFromCatalog(item.id);
      }
    });
  });

  // Cycle Status (full -> low -> empty -> full)
  grid.querySelectorAll('[data-action="cycle-status"]').forEach(el => {
    el.addEventListener('click', (e) => {
      const card = e.target.closest('.sp-pantry-card');
      const item = state.pantryList.find(p => p.id === card.dataset.id);
      if (item) {
        if (item.status === 'full') item.status = 'low';
        else if (item.status === 'low') item.status = 'empty';
        else item.status = 'full';

        savePantryList();
        renderPantryList();
        showToast(`Status de "${item.nome}" atualizado`);
      }
    });
  });

  // Pantry Qty Inc
  grid.querySelectorAll('[data-action="pantry-inc"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const card = e.target.closest('.sp-pantry-card');
      const item = state.pantryList.find(p => p.id === card.dataset.id);
      if (item) {
        item.quantidade = (item.quantidade || 0) + 1;
        if (item.quantidade > 0 && item.status === 'empty') item.status = 'low';
        savePantryList();
        renderPantryList();
      }
    });
  });

  // Pantry Qty Dec
  grid.querySelectorAll('[data-action="pantry-dec"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const card = e.target.closest('.sp-pantry-card');
      const item = state.pantryList.find(p => p.id === card.dataset.id);
      if (item) {
        item.quantidade = Math.max(0, (item.quantidade || 0) - 1);
        if (item.quantidade === 0) item.status = 'empty';
        savePantryList();
        renderPantryList();
      }
    });
  });
}

// Repor todos os itens em falta na despensa
function restockAllLowItems() {
  const needsRestock = state.pantryList.filter(i => i.status === 'low' || i.status === 'empty');
  if (needsRestock.length === 0) {
    showToast('Nenhum item em falta na despensa');
    return;
  }

  let addedCount = 0;
  needsRestock.forEach(pantryItem => {
    const existing = state.shoppingList.find(i => i.id === pantryItem.id);
    if (existing) {
      existing.quantidade += 1;
    } else {
      state.shoppingList.push({
        id: pantryItem.id,
        nome: pantryItem.nome,
        categoria: pantryItem.categoria,
        unidade: pantryItem.unidade,
        icone: pantryItem.icone,
        quantidade: 1,
        preco: 0,
        comprado: false,
        adicionadoEm: Date.now()
      });
      addedCount++;
    }
  });

  playChime(true);
  saveShoppingList();
  renderShoppingList();
  renderCatalog();
  renderMarketMode();

  showToast(`${needsRestock.length} itens da despensa adicionados a lista`);
  switchTab('viewMinhaLista');
}

// Modal: Adicionar Item a Despensa
function openAddPantryModal() {
  const modal = document.getElementById('addPantryModal');
  const search = document.getElementById('pantryModalSearch');
  if (modal) {
    modal.classList.add('open');
    if (search) {
      search.value = '';
      search.focus();
    }
    renderPantryModalCatalog('');
  }
}

function closeAddPantryModal() {
  const modal = document.getElementById('addPantryModal');
  if (modal) modal.classList.remove('open');
}

function renderPantryModalCatalog(query) {
  const resultsContainer = document.getElementById('pantryModalCatalogResults');
  if (!resultsContainer) return;

  const q = normalizeStr(query || '');
  const filtered = state.products.filter(p => !q || normalizeStr(p.nome).includes(q) || normalizeStr(p.categoria).includes(q)).slice(0, 30);

  if (filtered.length === 0) {
    resultsContainer.innerHTML = '<div style="color: var(--sp-subtext); text-align: center; padding: 20px;">Nenhum produto encontrado.</div>';
    return;
  }

  const inPantrySet = new Set(state.pantryList.map(p => p.id));

  resultsContainer.innerHTML = filtered.map(prod => `
    <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: var(--sp-elevated); border-radius: var(--radius-sm);">
      <div style="display: flex; align-items: center; gap: 10px;">
        <div style="width: 38px; height: 38px; border-radius: 4px; overflow: hidden; display: flex; align-items: center; justify-content: center; background: var(--sp-card); flex-shrink: 0;">
          <img src="${getIconUrl(prod)}" alt="${prod.nome}" style="width: 100%; height: 100%; object-fit: cover;" onerror="handleIconError(this, '${escapeHtml(prod.categoria)}')">
        </div>
        <div>
          <div style="font-weight: 700; font-size: 0.9rem;">${prod.nome}</div>
          <div style="font-size: 0.75rem; color: var(--sp-subtext);">${prod.categoria} • ${prod.unidade}</div>
        </div>
      </div>
      <button class="sp-btn-primary" data-pantry-add-id="${prod.id}" style="padding: 6px 14px; font-size: 0.78rem;">
        ${inPantrySet.has(prod.id) ? 'Adicionado' : 'Adicionar'}
      </button>
    </div>
  `).join('');

  resultsContainer.querySelectorAll('[data-pantry-add-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.pantryAddId;
      const prod = state.products.find(p => p.id === id);
      if (prod) {
        if (!state.pantryList.some(p => p.id === id)) {
          state.pantryList.push({
            id: prod.id,
            nome: prod.nome,
            categoria: prod.categoria,
            unidade: prod.unidade || 'un',
            icone: prod.icone,
            quantidade: 1,
            status: 'full'
          });
          savePantryList();
          renderPantryList();
          btn.textContent = 'Adicionado';
          showToast(`"${prod.nome}" adicionado a despensa`);
        }
      }
    });
  });
}

// ============================================================================
// Renderização: Catálogo (Spotify Album Grid)
// ============================================================================
function renderCategoryChips() {
  const container = document.getElementById('categoryChipsContainer');
  if (!container) return;

  const categories = ['Todas'];
  const catSet = new Set();
  state.products.forEach(p => {
    if (p.categoria) catSet.add(p.categoria);
  });
  Array.from(catSet).sort().forEach(c => categories.push(c));

  container.innerHTML = categories.map(cat => `
    <button class="sp-cat-pill ${state.catalogCategory === cat ? 'active' : ''}" data-cat="${cat}">
      ${cat}
    </button>
  `).join('');

  container.querySelectorAll('.sp-cat-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.sp-cat-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.catalogCategory = btn.dataset.cat;
      renderCatalog();
    });
  });

  if (!container.dataset.wheelBound) {
    container.dataset.wheelBound = "1";
    container.addEventListener('wheel', (e) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        container.scrollLeft += e.deltaY;
      }
    }, { passive: false });
  }
}

function renderCatalog() {
  const grid = document.getElementById('catalogGrid');
  const countSpan = document.getElementById('catalogResultsCount');
  if (!grid) return;

  const query = normalizeStr((state.catalogSearch || '').trim());

  const filtered = state.products.filter(p => {
    const matchesCat = state.catalogCategory === 'Todas' || p.categoria === state.catalogCategory;
    const normNome = normalizeStr(p.nome);
    const normCat = normalizeStr(p.categoria);
    const matchesQuery = !query || normNome.includes(query) || normCat.includes(query);
    return matchesCat && matchesQuery;
  });

  if (countSpan) {
    countSpan.textContent = `Exibindo ${filtered.length} de ${state.products.length} produtos`;
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1;" class="sp-empty">
        <h3>Nenhum resultado</h3>
        <p>Nao encontramos produtos correspondentes para "${state.catalogSearch}".</p>
      </div>
    `;
    return;
  }

  const inCartMap = {};
  state.shoppingList.forEach(item => {
    inCartMap[item.id] = item.quantidade;
  });

  grid.innerHTML = filtered.map(prod => {
    const qtyInCart = inCartMap[prod.id] || 0;
    return `
      <div class="sp-album-card" data-id="${prod.id}">
        <div class="sp-art-wrapper">
          <img src="${getIconUrl(prod)}" alt="${prod.nome}" loading="lazy" onerror="handleIconError(this, '${escapeHtml(prod.categoria)}')">
          
          ${qtyInCart > 0 ? `<div class="sp-in-cart-indicator">${qtyInCart}</div>` : ''}

          <button class="sp-hover-add-btn" data-action="add-product" title="Adicionar ${prod.nome}" aria-label="Adicionar">
            <svg class="icon-svg"><use href="#icon-plus"></use></svg>
          </button>
        </div>

        <div class="sp-card-name" title="${prod.nome}">${prod.nome}</div>
        <div class="sp-card-sub">${prod.categoria} • ${prod.unidade}</div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.sp-album-card').forEach(card => {
    card.addEventListener('click', () => {
      addProductFromCatalog(card.dataset.id);
    });
  });
}

function addProductFromCatalog(productId) {
  const prod = state.products.find(p => p.id === productId);
  if (!prod) return;

  const existing = state.shoppingList.find(i => i.id === productId);
  if (existing) {
    existing.quantidade = (existing.quantidade || 1) + 1;
    state.lastActiveItem = existing;
    showToast(`Adicionado mais 1x "${prod.nome}" (total: ${existing.quantidade})`);
  } else {
    const newItem = {
      id: prod.id,
      nome: prod.nome,
      categoria: prod.categoria,
      unidade: prod.unidade || 'un',
      icone: prod.icone,
      quantidade: 1,
      preco: 0,
      comprado: false,
      adicionadoEm: Date.now()
    };
    state.shoppingList.push(newItem);
    state.lastActiveItem = newItem;
    showToast(`"${prod.nome}" adicionado`);
  }

  playChime(true);
  saveShoppingList();
  renderShoppingList();
  renderCatalog();
  renderMarketMode();
}

// ============================================================================
// Renderização: Modo Mercado
// ============================================================================
function renderMarketMode() {
  const container = document.getElementById('marketItemsList');
  if (!container) return;

  if (state.shoppingList.length === 0) {
    container.innerHTML = `
      <div class="sp-empty">
        <h3>Lista Vazia</h3>
        <p>Adicione produtos pelo catalogo ou despensa para usar o Modo Mercado.</p>
      </div>
    `;
    return;
  }

  const sorted = [...state.shoppingList].sort((a, b) => {
    if (a.comprado === b.comprado) return 0;
    return a.comprado ? 1 : -1;
  });

  container.innerHTML = sorted.map(item => `
    <div class="sp-market-item ${item.comprado ? 'checked' : ''}" data-id="${item.id}">
      <div class="sp-market-checkbox">
        <svg class="icon-svg"><use href="#icon-check"></use></svg>
      </div>

      <div class="sp-market-art">
        <img src="${getIconUrl(item)}" alt="${item.nome}" loading="lazy" onerror="handleIconError(this, '${escapeHtml(item.categoria)}')">
      </div>

      <div style="flex: 1;">
        <div class="sp-market-name">${item.nome}</div>
        <div class="sp-market-info-meta">
          <span>${item.quantidade} ${item.unidade}</span>
          <span>•</span>
          <span>${item.categoria}</span>
          ${item.preco ? `<span>• R$ ${Number(item.preco).toFixed(2)}</span>` : ''}
        </div>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.sp-market-item').forEach(card => {
    card.addEventListener('click', () => {
      toggleItemComprado(card.dataset.id);
    });
  });
}

// ============================================================================
// Eventos e Navegação
// ============================================================================
function setupEventListeners() {
  // Tabs
  document.querySelectorAll('.sp-pill-btn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
    });
  });

  // Filtros Minha Lista
  document.querySelectorAll('.sp-filter-chip[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sp-filter-chip[data-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.listFilter = btn.dataset.filter;
      renderShoppingList();
    });
  });

  // Filtros Despensa
  document.querySelectorAll('.sp-filter-chip[data-pantry-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sp-filter-chip[data-pantry-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.pantryFilter = btn.dataset.pantryFilter;
      renderPantryList();
    });
  });

  // Botão Adicionar do Catálogo
  const btnGoToCatalog = document.getElementById('btnGoToCatalog');
  if (btnGoToCatalog) {
    btnGoToCatalog.addEventListener('click', () => switchTab('viewCatalogo'));
  }

  // Ações da Despensa
  const btnRestockAllLow = document.getElementById('btnRestockAllLow');
  if (btnRestockAllLow) {
    btnRestockAllLow.addEventListener('click', restockAllLowItems);
  }

  const btnAddPantryItem = document.getElementById('btnAddPantryItem');
  if (btnAddPantryItem) {
    btnAddPantryItem.addEventListener('click', openAddPantryModal);
  }

  const closeAddPantryModalBtn = document.getElementById('closeAddPantryModalBtn');
  if (closeAddPantryModalBtn) {
    closeAddPantryModalBtn.addEventListener('click', closeAddPantryModal);
  }

  const pantryModalSearch = document.getElementById('pantryModalSearch');
  if (pantryModalSearch) {
    pantryModalSearch.addEventListener('input', (e) => {
      renderPantryModalCatalog(e.target.value);
    });
  }

  // Pesquisa do Catálogo
  const searchInput = document.getElementById('catalogSearchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.catalogSearch = e.target.value;
      if (clearSearchBtn) {
        clearSearchBtn.classList.toggle('visible', state.catalogSearch.length > 0);
      }
      renderCatalog();
    });
  }

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        state.catalogSearch = '';
        clearSearchBtn.classList.remove('visible');
        renderCatalog();
        searchInput.focus();
      }
    });
  }

  // Mover Todos os Comprados para Despensa
  const btnMoveAllPurchased = document.getElementById('btnMoveAllPurchased');
  if (btnMoveAllPurchased) btnMoveAllPurchased.addEventListener('click', moveAllPurchasedToPantry);

  // Chat com Assistente IA
  const aiChatBtn = document.getElementById('aiChatBtn');
  if (aiChatBtn) aiChatBtn.addEventListener('click', openAiChatModal);

  const closeAiChatModalBtn = document.getElementById('closeAiChatModalBtn');
  if (closeAiChatModalBtn) closeAiChatModalBtn.addEventListener('click', closeAiChatModal);

  const clearAiChatBtn = document.getElementById('clearAiChatBtn');
  if (clearAiChatBtn) clearAiChatBtn.addEventListener('click', clearAiChatHistory);

  const aiChatForm = document.getElementById('aiChatForm');
  if (aiChatForm) {
    aiChatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('aiChatInput');
      if (input && input.value.trim()) {
        sendAiChatMessage(input.value.trim());
        input.value = '';
      }
    });
  }

  document.querySelectorAll('.sp-chip-prompt').forEach(chip => {
    chip.addEventListener('click', () => {
      const prompt = chip.dataset.prompt;
      if (prompt) sendAiChatMessage(prompt);
    });
  });

  // Configurações
  const settingsBtn = document.getElementById('settingsBtn');
  if (settingsBtn) settingsBtn.addEventListener('click', openSettingsModal);

  const closeSettingsModalBtn = document.getElementById('closeSettingsModalBtn');
  if (closeSettingsModalBtn) closeSettingsModalBtn.addEventListener('click', closeSettingsModal);

  const btnExportData = document.getElementById('btnExportData');
  if (btnExportData) btnExportData.addEventListener('click', exportAppData);

  const btnShareListSettings = document.getElementById('btnShareListSettings');
  if (btnShareListSettings) btnShareListSettings.addEventListener('click', shareListWhatsApp);

  const btnResetData = document.getElementById('btnResetData');
  if (btnResetData) btnResetData.addEventListener('click', resetAllAppData);

  const btnSaveIconBase = document.getElementById('btnSaveIconBase');
  const settingIconBaseInput = document.getElementById('settingIconBaseInput');
  if (btnSaveIconBase && settingIconBaseInput) {
    settingIconBaseInput.value = state.iconBaseUrl || '';
    btnSaveIconBase.addEventListener('click', () => {
      const val = settingIconBaseInput.value.trim();
      state.iconBaseUrl = val;
      localStorage.setItem('listou_spotify_icon_base', val);
      showToast('Configuracao de icones salva');
      renderCatalog();
      renderShoppingList();
      renderPantryList();
      renderMarketMode();
    });
  }

  const closeResetConfirmBtn = document.getElementById('closeResetConfirmBtn');
  if (closeResetConfirmBtn) closeResetConfirmBtn.addEventListener('click', closeResetConfirmModal);

  const cancelResetBtn = document.getElementById('cancelResetBtn');
  if (cancelResetBtn) cancelResetBtn.addEventListener('click', closeResetConfirmModal);

  const confirmResetBtn = document.getElementById('confirmResetBtn');
  if (confirmResetBtn) confirmResetBtn.addEventListener('click', executeResetAllData);

  // Concluir Compras
  const finishShoppingBtn = document.getElementById('finishShoppingBtn');
  if (finishShoppingBtn) finishShoppingBtn.addEventListener('click', openSummaryModal);

  // Modal Close & Actions
  const closeSummaryModalBtn = document.getElementById('closeSummaryModalBtn');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalClearListBtn = document.getElementById('modalClearListBtn');
  const modalMoveToPantryBtn = document.getElementById('modalMoveToPantryBtn');
  
  if (closeSummaryModalBtn) closeSummaryModalBtn.addEventListener('click', closeSummaryModal);
  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeSummaryModal);
  if (modalClearListBtn) modalClearListBtn.addEventListener('click', () => {
    clearPurchasedItems();
    closeSummaryModal();
  });
  if (modalMoveToPantryBtn) modalMoveToPantryBtn.addEventListener('click', () => {
    moveAllPurchasedToPantry();
    closeSummaryModal();
  });
}

function switchTab(viewId) {
  state.activeTab = viewId;

  document.querySelectorAll('.sp-pill-btn[data-tab]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === viewId);
  });

  document.querySelectorAll('.view-section').forEach(view => {
    view.classList.toggle('active', view.id === viewId);
  });

  if (viewId === 'viewModoMercado') {
    renderMarketMode();
  } else if (viewId === 'viewDespensa') {
    renderPantryList();
  }
}

// ============================================================================
// Compartilhamento e Modais (Sem Emojis)
// ============================================================================
function shareListWhatsApp() {
  if (state.shoppingList.length === 0) {
    showToast('Adicione itens antes de compartilhar');
    return;
  }

  let text = '*LISTOU - LISTA DE COMPRAS*\n\n';
  
  const groups = {};
  state.shoppingList.forEach(item => {
    const cat = item.categoria || 'Outros';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  });

  Object.keys(groups).sort().forEach(cat => {
    text += `*${cat}:*\n`;
    groups[cat].forEach(i => {
      const status = i.comprado ? '[X]' : '[ ]';
      text += `${status} ${i.nome} - ${i.quantidade} ${i.unidade}\n`;
    });
    text += '\n';
  });

  const total = state.shoppingList.reduce((acc, i) => acc + ((parseFloat(i.preco) || 0) * (i.quantidade || 1)), 0);
  if (total > 0) {
    text += `*Total Estimado:* ${total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n`;
  }

  navigator.clipboard.writeText(text).then(() => {
    showToast('Lista copiada para a area de transferencia');
  }).catch(() => {
    showToast('Pronto para envio');
  });

  const encoded = encodeURIComponent(text);
  window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
}

function clearPurchasedItems() {
  const initialCount = state.shoppingList.length;
  state.shoppingList = state.shoppingList.filter(i => !i.comprado);
  const removed = initialCount - state.shoppingList.length;

  if (removed > 0) {
    saveShoppingList();
    renderShoppingList();
    renderMarketMode();
    renderCatalog();
    showToast(`${removed} itens comprados removidos`);
  } else {
    showToast('Nenhum item comprado para remover');
  }
}

function openSummaryModal() {
  const modal = document.getElementById('summaryModal');
  const modalTotal = document.getElementById('modalTotalSpent');
  const modalSummary = document.getElementById('modalItemsSummary');

  const total = state.shoppingList.reduce((acc, i) => acc + ((parseFloat(i.preco) || 0) * (i.quantidade || 1)), 0);
  const completed = state.shoppingList.filter(i => i.comprado).length;
  const totalItems = state.shoppingList.length;

  if (modalTotal) modalTotal.textContent = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  if (modalSummary) modalSummary.textContent = `Voce comprou ${completed} de ${totalItems} itens na lista.`;

  if (modal) modal.classList.add('open');
}

function closeSummaryModal() {
  const modal = document.getElementById('summaryModal');
  if (modal) modal.classList.remove('open');
}

function showToast(message) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'sp-toast';
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 260);
  }, 2400);
}

// ============================================================================
// Assistente IA e Configurações (Sem Emojis)
// ============================================================================
function loadSavedAiChatHistory() {
  const saved = localStorage.getItem('listou_spotify_ai_chat_history');
  if (saved) {
    try {
      state.aiChatHistory = JSON.parse(saved);
      renderAiChatHistory();
    } catch (e) {
      console.error('Erro ao carregar historico do chat:', e);
      state.aiChatHistory = [];
    }
  }
}

function saveAiChatHistory() {
  localStorage.setItem('listou_spotify_ai_chat_history', JSON.stringify(state.aiChatHistory));
}

function renderAiChatHistory() {
  const history = document.getElementById('aiChatHistory');
  if (!history) return;

  if (state.aiChatHistory.length === 0) {
    history.innerHTML = `
      <div class="sp-chat-msg bot">
        <div class="sp-msg-bubble">
          Ola! Sou o assistente inteligente do Listou. Como posso te ajudar com a sua lista de compras ou despensa hoje?
        </div>
      </div>
    `;
    return;
  }

  history.innerHTML = state.aiChatHistory.map(msg => {
    if (msg.role === 'user') {
      return `
        <div class="sp-chat-msg user">
          <div class="sp-msg-bubble">${escapeHtml(msg.content)}</div>
        </div>
      `;
    } else {
      return `
        <div class="sp-chat-msg bot">
          <div class="sp-msg-bubble">${formatAiResponse(msg.content)}</div>
        </div>
      `;
    }
  }).join('');

  setTimeout(() => {
    history.scrollTop = history.scrollHeight;
  }, 50);
}

function clearAiChatHistory() {
  if (state.aiChatHistory.length === 0) {
    showToast('A conversa ja esta limpa');
    return;
  }
  state.aiChatHistory = [];
  localStorage.removeItem('listou_spotify_ai_chat_history');
  renderAiChatHistory();
  showToast('Conversa com a IA limpa');
}

function openAiChatModal() {
  const modal = document.getElementById('aiChatModal');
  if (modal) {
    modal.classList.add('open');
    renderAiChatHistory();
    const input = document.getElementById('aiChatInput');
    if (input) setTimeout(() => input.focus(), 150);
  }
}

function closeAiChatModalBtnHandler() {
  const modal = document.getElementById('aiChatModal');
  if (modal) modal.classList.remove('open');
}

function closeAiChatModal() {
  closeAiChatModalBtnHandler();
}

function openSettingsModal() {
  const modal = document.getElementById('settingsModal');
  if (modal) {
    const input = document.getElementById('settingIconBaseInput');
    if (input) input.value = state.iconBaseUrl || '';
    modal.classList.add('open');
  }
}

function closeSettingsModal() {
  const modal = document.getElementById('settingsModal');
  if (modal) modal.classList.remove('open');
}

function exportAppData() {
  const exportPayload = {
    shoppingList: state.shoppingList,
    pantryList: state.pantryList,
    aiChatHistory: state.aiChatHistory,
    exportedAt: new Date().toISOString()
  };

  const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `listou_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Backup exportado com sucesso');
}

function openResetConfirmModal() {
  const modal = document.getElementById('resetConfirmModal');
  if (modal) modal.classList.add('open');
}

function closeResetConfirmModal() {
  const modal = document.getElementById('resetConfirmModal');
  if (modal) modal.classList.remove('open');
}

function executeResetAllData() {
  localStorage.removeItem('listou_spotify_shopping_list');
  localStorage.removeItem('listou_spotify_pantry');
  localStorage.removeItem('listou_spotify_ai_chat_history');
  state.shoppingList = [];
  state.pantryList = [];
  state.aiChatHistory = [];
  state.lastActiveItem = null;
  saveShoppingList();
  savePantryList();
  saveAiChatHistory();
  renderShoppingList();
  renderPantryList();
  renderMarketMode();
  renderCatalog();
  renderAiChatHistory();
  updateMetrics();
  closeResetConfirmModal();
  closeSettingsModal();
  showToast('Todos os dados foram redefinidos');
}

function resetAllAppData() {
  openResetConfirmModal();
}

async function sendAiChatMessage(userText) {
  const history = document.getElementById('aiChatHistory');
  if (!history) return;

  // Append User message
  const userMsg = document.createElement('div');
  userMsg.className = 'sp-chat-msg user';
  userMsg.innerHTML = `<div class="sp-msg-bubble">${escapeHtml(userText)}</div>`;
  history.appendChild(userMsg);
  history.scrollTop = history.scrollHeight;

  // Track conversation in state and persist
  state.aiChatHistory.push({ role: 'user', content: userText });
  saveAiChatHistory();

  // Bot typing state
  const botMsg = document.createElement('div');
  botMsg.className = 'sp-chat-msg bot';
  botMsg.innerHTML = `<div class="sp-msg-bubble" style="color: var(--sp-subtext);">Pensando com a IA do Listou...</div>`;
  history.appendChild(botMsg);
  history.scrollTop = history.scrollHeight;

  try {
    const aiResponseText = await callOmniRouteAI();
    botMsg.innerHTML = `<div class="sp-msg-bubble">${formatAiResponse(aiResponseText)}</div>`;
    state.aiChatHistory.push({ role: 'assistant', content: aiResponseText });
    saveAiChatHistory();
  } catch (err) {
    console.warn('Erro ao conectar com OmniRoute AI, usando fallback local:', err);
    const fallbackText = generateAiLocalFallback(userText);
    botMsg.innerHTML = `<div class="sp-msg-bubble">${fallbackText}</div>`;
    state.aiChatHistory.push({ role: 'assistant', content: fallbackText });
    saveAiChatHistory();
  }

  history.scrollTop = history.scrollHeight;
}

function escapeHtml(str) {
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}

function formatAiResponse(text) {
  // Converte quebras de linha e formata negrito sem permitir tags inseguras
  const clean = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  return clean
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>');
}

// ============================================================================
// Ferramentas de IA: Leitura e Modificação de Lista, Despensa e Catálogo
// ============================================================================
const AI_TOOLS_DEFINITIONS = [
  { name: 'read_current_state', description: 'Le lista e despensa', input_schema: { type: 'object' } },
  { name: 'search_catalog', description: 'Busca no catalogo', input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
  { name: 'modify_shopping_list', description: 'Modifica lista', input_schema: { type: 'object', properties: { action: { type: 'string' }, product_name: { type: 'string' }, quantity: { type: 'number' } }, required: ['action', 'product_name'] } },
  { name: 'modify_pantry', description: 'Modifica despensa', input_schema: { type: 'object', properties: { action: { type: 'string' }, product_name: { type: 'string' }, quantity: { type: 'number' }, status: { type: 'string' } }, required: ['action', 'product_name'] } },
  { name: 'modify_catalog_item', description: 'Modifica catalogo', input_schema: { type: 'object', properties: { product_name: { type: 'string' }, new_unit: { type: 'string' } }, required: ['product_name'] } }
];

function findProductInCatalog(name) {
  const norm = normalizeStr(name || '');
  return state.products.find(p => normalizeStr(p.nome) === norm) ||
         state.products.find(p => normalizeStr(p.nome).includes(norm));
}

function executeAiTool(name, input) {
  console.log(`[AI TOOL] Executando ferramenta ${name}:`, input);

  if (name === 'read_current_state') {
    return {
      shopping_list: state.shoppingList,
      pantry: state.pantryList,
      total_catalog_products: state.products.length
    };
  }

  if (name === 'search_catalog') {
    const q = normalizeStr(input.query || '');
    const normCat = normalizeStr(input.category || '');
    const matches = state.products.filter(p => {
      const matchName = normalizeStr(p.nome).includes(q);
      const matchCat = !normCat || normalizeStr(p.categoria).includes(normCat);
      return matchName && matchCat;
    }).slice(0, 15);
    return {
      results_found: matches.length,
      products: matches.map(m => ({ id: m.id, nome: m.nome, categoria: m.categoria, unidade: m.unidade }))
    };
  }

  if (name === 'modify_shopping_list') {
    const prodName = input.product_name;
    const prod = findProductInCatalog(prodName);
    const existing = state.shoppingList.find(i => 
      i.nome.toLowerCase() === prodName.toLowerCase() || (prod && i.id === prod.id)
    );

    if (input.action === 'add') {
      const qty = typeof input.quantity === 'number' ? input.quantity : 1;
      const price = typeof input.price === 'number' ? input.price : 0;
      
      if (existing) {
        existing.quantidade = (existing.quantidade || 1) + qty;
        if (typeof input.price === 'number') existing.preco = price;
        state.lastActiveItem = existing;
      } else {
        const pId = prod ? prod.id : `custom_${Date.now()}`;
        const pNome = prod ? prod.nome : prodName;
        const pCat = prod ? prod.categoria : 'Outros';
        const pIcone = prod ? prod.icone : 'icones/Abacate.webp';
        const pUn = input.unit || (prod ? prod.unidade : 'un');

        const newItem = {
          id: pId,
          nome: pNome,
          categoria: pCat,
          unidade: pUn,
          icone: pIcone,
          quantidade: qty,
          preco: price,
          comprado: false,
          adicionadoEm: Date.now()
        };
        state.shoppingList.push(newItem);
        state.lastActiveItem = newItem;
      }

      saveShoppingList();
      renderShoppingList();
      renderMarketMode();
      renderCatalog();
      playChime(true);
      showToast(`IA adicionou "${prodName}" a lista`);
      return { success: true, message: `"${prodName}" adicionado a lista com quantidade ${existing ? existing.quantidade : qty} e preco R$ ${input.price || 0}` };
    }

    if (input.action === 'update') {
      if (!existing) {
        return { success: false, error: `Item "${prodName}" nao encontrado na lista de compras` };
      }
      if (typeof input.quantity === 'number') existing.quantidade = input.quantity;
      if (typeof input.price === 'number') existing.preco = input.price;
      if (typeof input.purchased === 'boolean') existing.comprado = input.purchased;
      if (input.unit) existing.unidade = input.unit;

      saveShoppingList();
      renderShoppingList();
      renderMarketMode();
      showToast(`IA atualizou "${prodName}"`);
      return { success: true, item: existing };
    }

    if (input.action === 'mark_purchased') {
      if (!existing) {
        return { success: false, error: `Item "${prodName}" nao encontrado na lista` };
      }
      existing.comprado = input.purchased !== undefined ? input.purchased : true;
      saveShoppingList();
      renderShoppingList();
      renderMarketMode();
      return { success: true, message: `Item "${prodName}" marcado como ${existing.comprado ? 'comprado' : 'pendente'}` };
    }

    if (input.action === 'remove') {
      const idx = state.shoppingList.findIndex(i => 
        i.nome.toLowerCase() === prodName.toLowerCase() || (prod && i.id === prod.id)
      );
      if (idx !== -1) {
        state.shoppingList.splice(idx, 1);
        saveShoppingList();
        renderShoppingList();
        renderMarketMode();
        renderCatalog();
        showToast(`IA removeu "${prodName}" da lista`);
        return { success: true, message: `Item "${prodName}" removido da lista` };
      }
      return { success: false, error: `Item "${prodName}" nao constava na lista de compras` };
    }
  }

  if (name === 'modify_pantry') {
    const prodName = input.product_name;
    const prod = findProductInCatalog(prodName);
    const existing = state.pantryList.find(p => 
      p.nome.toLowerCase() === prodName.toLowerCase() || (prod && p.id === prod.id)
    );

    if (input.action === 'add') {
      const qty = typeof input.quantity === 'number' ? input.quantity : 1;
      const status = input.status || 'full';

      if (existing) {
        existing.quantidade = (existing.quantidade || 0) + qty;
        existing.status = status;
      } else {
        const pId = prod ? prod.id : `pantry_${Date.now()}`;
        const pNome = prod ? prod.nome : prodName;
        const pCat = prod ? prod.categoria : 'Outros';
        const pIcone = prod ? prod.icone : 'icones/Abacate.webp';
        const pUn = prod ? prod.unidade : 'un';

        state.pantryList.push({
          id: pId,
          nome: pNome,
          categoria: pCat,
          unidade: pUn,
          icone: pIcone,
          quantidade: qty,
          status: status
        });
      }

      savePantryList();
      renderPantryList();
      playChime(true);
      showToast(`IA guardou "${prodName}" na despensa`);
      return { success: true, message: `Item "${prodName}" guardado na despensa com quantidade ${existing ? existing.quantidade : qty}` };
    }

    if (input.action === 'update_quantity') {
      if (!existing) return { success: false, error: `"${prodName}" nao esta na despensa` };
      existing.quantidade = Math.max(0, input.quantity);
      if (existing.quantidade === 0) existing.status = 'empty';
      else if (existing.status === 'empty') existing.status = 'low';
      savePantryList();
      renderPantryList();
      return { success: true, item: existing };
    }

    if (input.action === 'update_status') {
      if (!existing) return { success: false, error: `"${prodName}" nao esta na despensa` };
      existing.status = input.status || 'full';
      savePantryList();
      renderPantryList();
      return { success: true, item: existing };
    }

    if (input.action === 'remove') {
      const idx = state.pantryList.findIndex(p => 
        p.nome.toLowerCase() === prodName.toLowerCase() || (prod && p.id === prod.id)
      );
      if (idx !== -1) {
        state.pantryList.splice(idx, 1);
        savePantryList();
        renderPantryList();
        showToast(`IA removeu "${prodName}" da despensa`);
        return { success: true, message: `"${prodName}" removido da despensa` };
      }
      return { success: false, error: `"${prodName}" nao encontrado na despensa` };
    }

    if (input.action === 'move_from_shopping') {
      const shopItem = state.shoppingList.find(i => 
        i.nome.toLowerCase() === prodName.toLowerCase() || (prod && i.id === prod.id)
      );
      if (shopItem) {
        moveItemToPantry(shopItem.id);
        return { success: true, message: `"${shopItem.nome}" transferido da lista para a despensa` };
      }
      return { success: false, error: `"${prodName}" nao encontrado na lista de compras para mover` };
    }
  }

  if (name === 'modify_catalog_item') {
    const prod = findProductInCatalog(input.product_name);
    if (prod && input.new_unit) {
      prod.unidade = input.new_unit;
      renderCatalog();
      return { success: true, message: `Unidade do produto "${prod.nome}" no catalogo alterada para ${input.new_unit}` };
    }
    return { success: false, error: `Produto "${input.product_name}" nao encontrado no catalogo` };
  }

  return { success: false, error: `Ferramenta desconhecida: ${name}` };
}

async function callOmniRouteAI() {
  const apiKey = state.aiConfig.apiKey;
  const endpoint = state.aiConfig.messagesEndpoint;
  const model = state.aiConfig.model;

  const shoppingSummary = state.shoppingList.length > 0
    ? state.shoppingList.map(i => `${i.nome} (qtd: ${i.quantidade} ${i.unidade}, preco: R$ ${(i.preco || 0).toFixed(2)}, ${i.comprado ? 'comprado' : 'pendente'})`).join('; ')
    : 'Lista atualmente vazia.';

  const pantrySummary = state.pantryList.length > 0
    ? state.pantryList.map(i => `${i.nome} (qtd: ${i.quantidade} ${i.unidade}, status: ${i.status})`).join('; ')
    : 'Despensa atualmente vazia.';

  const systemPrompt = `Assistente IA do Listou.
Capacidade: LER E MODIFICAR Lista, Despensa e Catalogo usando as ferramentas disponiveis.
Estado: Lista: ${shoppingSummary} | Despensa: ${pantrySummary}.
Regras: NUNCA use emojis. Responda em portugues de forma concisa.`;

  let currentMessages = state.aiChatHistory.map(m => ({
    role: m.role,
    content: m.content
  }));

  // Suporte a multi-turn tool calling (até 4 iterações)
  for (let iter = 0; iter < 4; iter++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1800);
    let response;
    try {
      response = await fetch(endpoint, {
        signal: controller.signal,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: model,
          max_tokens: 1000,
          system: systemPrompt,
          tools: AI_TOOLS_DEFINITIONS,
          messages: currentMessages
        })
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw new Error(`OmniRoute error status: ${response.status}`);
    }

    const data = await response.json();

    // Verifica se houve chamadas de ferramentas (tool_use)
    const toolUseBlocks = (data.content || []).filter(c => c.type === 'tool_use');
    const textBlocks = (data.content || []).filter(c => c.type === 'text' && c.text && c.text !== '(empty response)');

    if (toolUseBlocks.length > 0) {
      currentMessages.push({
        role: 'assistant',
        content: data.content
      });

      const toolResults = [];
      for (const toolCall of toolUseBlocks) {
        const result = executeAiTool(toolCall.name, toolCall.input || {});
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolCall.id,
          content: JSON.stringify(result)
        });
      }

      currentMessages.push({
        role: 'user',
        content: toolResults
      });
      continue;
    }

    if (textBlocks.length > 0) {
      return textBlocks.map(t => t.text).join('\n');
    }

    if (data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content || 'Acao concluida com sucesso.';
    }

    return 'Acao executada com sucesso.';
  }

  return 'Acao concluida na lista e despensa.';
}

function generateAiLocalFallback(prompt) {
  const p = normalizeStr(prompt);
  const lowPantry = state.pantryList.filter(i => i.status === 'low' || i.status === 'empty');
  const fullPantry = state.pantryList.filter(i => i.status === 'full');

  if (p.includes('limpar') && p.includes('lista')) {
    state.shoppingList = [];
    state.lastActiveItem = null;
    saveShoppingList();
    renderShoppingList();
    renderMarketMode();
    return 'Lista de compras esvaziada com sucesso.';
  }

  const sorted = [...state.products].sort((a, b) => b.nome.length - a.nome.length);
  const prod = sorted.find(item => p.includes(normalizeStr(item.nome)));
  const numMatch = prompt.match(/\b(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|un|duzia|pct)?\b/i);
  const qty = numMatch ? parseFloat(numMatch[1].replace(',', '.')) : 1;

  if (/(remov|tirar|tire|apagar|exclui)/i.test(p)) {
    const target = prod || state.shoppingList.find(i => p.includes(normalizeStr(i.nome)));
    if (target) {
      executeAiTool('modify_shopping_list', { action: 'remove', product_name: target.nome });
      return `Removi <strong>${target.nome}</strong> da sua lista de compras.`;
    }
    return 'Qual item voce deseja remover?';
  }

  if (/(marqu|comprei|ja comprei|concluid)/i.test(p)) {
    const target = prod ? state.shoppingList.find(i => i.nome === prod.nome) : state.shoppingList.find(i => p.includes(normalizeStr(i.nome)));
    if (target) {
      target.comprado = true;
      saveShoppingList();
      renderShoppingList();
      renderMarketMode();
      playChime(true);
      return `Marquei <strong>${target.nome}</strong> como comprado na sua lista!`;
    }
    return 'Item nao encontrado na lista para marcar.';
  }

  if (p.includes('despensa') && /(adicion|coloc|coloq|guard|inclu|bot|ponh|põe)/i.test(p)) {
    if (prod) {
      executeAiTool('modify_pantry', { action: 'add', product_name: prod.nome, quantity: qty });
      return `Adicionei <strong>${prod.nome}</strong> (${qty} ${prod.unidade}) a sua Despensa!`;
    }
  }

  if (/(adicion|compr|coloc|coloq|inclu|bot|ponh|põe)/i.test(p) || (prod && !p.includes('receita') && !p.includes('tem') && !p.includes('preco'))) {
    if (prod) {
      executeAiTool('modify_shopping_list', { action: 'add', product_name: prod.nome, quantity: qty });
      return `Adicionei <strong>${prod.nome}</strong> (${qty} ${prod.unidade}) a sua lista de compras!`;
    }
  }

  if (p.includes('falta') || p.includes('despensa') || p.includes('essencia')) {
    if (lowPantry.length > 0) {
      const names = lowPantry.map(i => `${i.nome} (${i.status === 'empty' ? 'esgotado' : 'acabando'})`).join(', ');
      return `Itens precisando de reposicao: <strong>${names}</strong>. Clique em 'Repor' na Despensa para adicionar a lista.`;
    }
    return 'Despensa abastecida! Nenhum item acabando ou esgotado.';
  }

  if (p.includes('receita') || p.includes('cozinhar') || p.includes('comida')) {
    if (fullPantry.length > 0) {
      const items = fullPantry.slice(0, 3).map(i => i.nome).join(', ');
      return `Com base em (${items}), sugiro preparar um prato rapido. Deseja adicionar complementos a lista?`;
    }
    return 'Cadastre itens na Despensa para sugestoes de receitas!';
  }

  if (p.includes('saudavel') || p.includes('semana') || p.includes('dieta')) {
    return 'Recomendo frutas frescas, legumes e proteinas do catalogo!';
  }

  if (p.includes('total') || p.includes('gasto') || p.includes('preco')) {
    const total = state.shoppingList.reduce((acc, i) => acc + ((parseFloat(i.preco) || 0) * (i.quantidade || 1)), 0);
    return `Total estimado: <strong>${total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong> (${state.shoppingList.length} itens).`;
  }

  return 'Comandos disponiveis: adicione ou remova itens ("adicione leite", "comprar 2 jiló"), marque comprados ("comprei ovos") ou consulte o total.';
}
