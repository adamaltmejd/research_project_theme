/**
 * List Filter & Search
 * Loads JSON index, renders list items, and provides search + dynamic filtering.
 */
(function () {
  'use strict';

  // Configuration
  const CONFIG = {
    minSearchChars: 2,
    searchFields: ['title', 'authors', 'journal', 'desc', 'content'],
    dropdownThreshold: 3,
    debounceMs: 150
  };

  // DOM elements
  const elements = {
    controls: document.getElementById('listControls'),
    itemList: document.getElementById('itemList'),
    searchInput: document.getElementById('searchInput'),
    filtersContainer: document.getElementById('filtersContainer')
  };

  // Exit early if no item list exists
  if (!elements.itemList || !elements.controls) return;

  const indexUrl = elements.controls.dataset.indexUrl;
  if (!indexUrl) return;

  // Parse configuration
  const searchEnabled = elements.controls.dataset.searchEnabled === 'true';

  // State
  let items = [];
  const selectedFilters = new Map(); // field -> Set of selected values

  // --- Utility Functions ---

  function parseJSON(str, fallback) {
    try {
      return JSON.parse(str) || fallback;
    } catch {
      return fallback;
    }
  }

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function debounce(fn, ms) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), ms);
    };
  }

  // Create element with attributes and children
  function el(tag, attrs = {}, ...children) {
    const element = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (key === 'className') element.className = value;
      else if (key.startsWith('data')) element.setAttribute(key.replace(/([A-Z])/g, '-$1').toLowerCase(), value);
      else element.setAttribute(key, value);
    });
    children.forEach(child => {
      if (child != null) {
        element.append(typeof child === 'string' ? document.createTextNode(child) : child);
      }
    });
    return element;
  }

  // --- Card Rendering ---

  const PAPER_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="currentColor" viewBox="0 0 384 512"><path d="M64 0C28.7 0 0 28.7 0 64v384c0 35.3 28.7 64 64 64h256c35.3 0 64-28.7 64-64V160H256c-17.7 0-32-14.3-32-32V0H64zm192 0v128h128L256 0zM112 256h160c8.8 0 16 7.2 16 16s-7.2 16-16 16H112c-8.8 0-16-7.2-16-16s7.2-16 16-16zm0 64h160c8.8 0 16 7.2 16 16s-7.2 16-16 16H112c-8.8 0-16-7.2-16-16s7.2-16 16-16zm0 64h160c8.8 0 16 7.2 16 16s-7.2 16-16 16H112c-8.8 0-16-7.2-16-16s7.2-16 16-16z"/></svg>';

  function createBadges(item) {
    const badges = el('div', { className: 'float-end ms-2' });

    if (item.paper_url) {
      const link = el('a', { href: item.paper_url, className: 'text-muted', title: 'View paper' });
      link.innerHTML = PAPER_ICON_SVG;
      badges.append(el('span', { className: 'badge text-bg-secondary ms-1 mb-1' }, link));
    }

    if (item.status) {
      const statusClass = item.status === 'Published' ? 'text-bg-success' : 'text-bg-warning';
      badges.append(el('span', { className: `badge ${statusClass} ms-1 mb-1` }, item.status));
    }

    return badges;
  }

  function renderCard(item) {
    const cardBody = el('div', { className: 'card-body' },
      createBadges(item),
      el('h5', { className: 'card-title mb-3' }, item.title),
      el('h6', { className: 'card-subtitle mb-2 text-muted' }, item.authors),
      el('p', { className: 'card-text' }, item.desc)
    );

    const footerLink = el('a', {
      href: item.relpermalink,
      className: 'card-link stretched-link text-muted'
    });
    footerLink.innerHTML = '<nobr>Read more →</nobr>';

    const cardFooter = el('div', { className: 'card-footer' },
      `Last updated: ${item.date_formatted}`,
      el('div', { className: 'float-end text-muted' }, footerLink)
    );

    return el('div', { className: 'card my-1' }, cardBody, cardFooter);
  }

  function renderItems(filteredItems) {
    elements.itemList.innerHTML = '';
    if (filteredItems.length === 0) {
      elements.itemList.append(el('div', { className: 'text-center text-muted py-4' }, 'No items found.'));
    } else {
      const fragment = document.createDocumentFragment();
      filteredItems.forEach(item => fragment.append(renderCard(item)));
      elements.itemList.append(fragment);
    }
  }

  // --- Filter Building ---

  function createFilterCheckbox(field, value, isButtonGroup) {
    const normalizedValue = value.toLowerCase();
    const id = `filter-${field}-${normalizedValue.replace(/\s+/g, '-')}`;

    // Add to selected filters (all checked by default)
    selectedFilters.get(field).add(normalizedValue);

    const input = el('input', {
      type: 'checkbox',
      className: isButtonGroup ? 'btn-check' : 'form-check-input',
      id,
      value: normalizedValue,
      autocomplete: 'off'
    });
    input.checked = true;

    input.addEventListener('change', () => {
      const filterSet = selectedFilters.get(field);
      input.checked ? filterSet.add(normalizedValue) : filterSet.delete(normalizedValue);
      applyFilters();
    });

    return { input, id };
  }

  function buildButtonGroup(field, container, values) {
    values.forEach(value => {
      const { input, id } = createFilterCheckbox(field, value, true);
      container.append(input, el('label', { className: 'btn btn-outline-primary', for: id }, value));
    });
  }

  function buildDropdown(field, container, values) {
    container.className = 'dropdown';

    const toggleBtn = el('button', {
      className: 'btn btn-outline-primary dropdown-toggle',
      type: 'button',
      'data-bs-toggle': 'dropdown',
      'data-bs-auto-close': 'outside',
      'aria-expanded': 'false'
    }, capitalize(field));

    const menu = el('ul', { className: 'dropdown-menu' });

    values.forEach(value => {
      const { input, id } = createFilterCheckbox(field, value, false);
      const formCheck = el('div', { className: 'form-check' },
        input,
        el('label', { className: 'form-check-label', for: id }, value)
      );
      menu.append(el('li', { className: 'dropdown-item' }, formCheck));
    });

    container.append(toggleBtn, menu);
  }

  function buildFilters() {
    if (!elements.filtersContainer) return;

    elements.filtersContainer.querySelectorAll('.filter-group').forEach(group => {
      const field = group.dataset.filterField;
      if (!field) return;

      const values = [...new Set(items.map(i => i[field]).filter(Boolean))].sort();

      if (values.length === 0) {
        group.style.display = 'none';
        return;
      }

      // Initialize the filter set for this field
      selectedFilters.set(field, new Set());

      if (values.length > CONFIG.dropdownThreshold) {
        buildDropdown(field, group, values);
      } else {
        buildButtonGroup(field, group, values);
      }
    });
  }

  // --- Filtering Logic ---

  function matchesSearch(item, query) {
    if (!searchEnabled || query.length < CONFIG.minSearchChars) return true;

    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    return terms.every(term =>
      CONFIG.searchFields.some(field => (item[field] || '').toLowerCase().includes(term))
    );
  }

  function matchesFilters(item) {
    for (const [field, selected] of selectedFilters) {
      // If no values selected for this filter, nothing matches
      if (selected.size === 0) return false;
      const itemValue = (item[field] || '').toLowerCase();
      if (!selected.has(itemValue)) return false;
    }
    return true;
  }

  function applyFilters() {
    const query = elements.searchInput?.value.trim() || '';
    const filtered = items.filter(item => matchesFilters(item) && matchesSearch(item, query));
    renderItems(filtered);
  }

  // --- Initialization ---

  async function init() {
    try {
      const response = await fetch(indexUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      items = await response.json();

      buildFilters();

      if (searchEnabled && elements.searchInput) {
        const debouncedFilter = debounce(applyFilters, CONFIG.debounceMs);
        elements.searchInput.addEventListener('input', debouncedFilter);
        elements.searchInput.addEventListener('keydown', e => {
          if (e.key === 'Escape') {
            elements.searchInput.value = '';
            applyFilters();
          }
        });
      }

      applyFilters();
    } catch (err) {
      console.error('Failed to load index:', err);
      elements.itemList.innerHTML = '';
      elements.itemList.append(el('div', { className: 'text-center text-danger py-4' }, 'Error loading items.'));
    }
  }

  init();
})();