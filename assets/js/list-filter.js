/**
 * List Filter & Search
 * Loads JSON index, renders list items, and provides search + dynamic filtering.
 * Supports URL query parameters for shareable filter states.
 */
(function () {
  'use strict';

  // =============================================================================
  // Configuration
  // =============================================================================

  const CONFIG = {
    minSearchChars: 3,
    searchFields: ['title', 'authors', 'journal', 'desc', 'content'],
    dropdownThreshold: 2,
    debounceMs: 200,
    searchParam: 'q'
  };

  // =============================================================================
  // DOM Utilities
  // =============================================================================

  /**
   * Get element by ID
   * @param {string} id
   * @returns {HTMLElement|null}
   */
  const $ = (id) => document.getElementById(id);

  /**
   * Create an element with optional attributes and children
   * @param {string} tag
   * @param {Object} attrs
   * @param {Array} children
   * @returns {HTMLElement}
   */
  function createElement(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (key === 'className') el.className = value;
      else if (key === 'textContent') el.textContent = value;
      else if (key === 'innerHTML') el.innerHTML = value;
      else if (key.startsWith('data')) el.dataset[key.slice(4).toLowerCase()] = value;
      else el[key] = value;
    });
    children.forEach(child => el.appendChild(child));
    return el;
  }

  /**
   * Debounce function execution
   * @param {Function} fn
   * @param {number} ms
   * @returns {Function}
   */
  function debounce(fn, ms) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), ms);
    };
  }

  /**
   * Convert string to Title Case
   * @param {string} str
   * @returns {string}
   */
  function toTitleCase(str) {
    if (!str) return '';
    return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  }

  // =============================================================================
  // URL State Management
  // =============================================================================

  /**
   * Parse URL query parameters into filter state
   * @returns {{ search: string, filters: Map<string, Set<string>> }}
   */
  function parseUrlState(filterFields) {
    const params = new URLSearchParams(window.location.search);
    const search = params.get(CONFIG.searchParam) || '';
    const filters = new Map();

    for (const [key, value] of params) {
      // Only parse params that match known filter fields
      if (key !== CONFIG.searchParam && filterFields.has(key)) {
        if (!filters.has(key)) {
          filters.set(key, new Set());
        }
        // Values are comma-separated
        value.split(',').forEach(v => {
          if (v) filters.get(key).add(v.toLowerCase());
        });
      }
    }

    return { search, filters };
  }

  /**
   * Update URL with current filter state (without page reload)
   * @param {Map<string, Set<string>>} selectedFilters
   * @param {string} searchQuery
   */
  function updateUrlState(selectedFilters, searchQuery) {
    const params = new URLSearchParams();

    // Add search query
    if (searchQuery && searchQuery.trim().length >= CONFIG.minSearchChars) {
      params.set(CONFIG.searchParam, searchQuery.trim());
    }

    // Add filters
    for (const [field, values] of selectedFilters) {
      if (values.size > 0) {
        params.set(field, [...values].join(','));
      }
    }

    // Build new URL
    const newUrl = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;

    // Only push if URL actually changed
    if (newUrl !== window.location.pathname + window.location.search) {
      window.history.pushState({}, '', newUrl);
    }
  }

  // =============================================================================
  // Card Renderer
  // =============================================================================

  /**
   * Render a single card from item data
   * @param {HTMLTemplateElement} template
   * @param {Object} item
   * @returns {HTMLElement}
   */
  function renderCard(template, item) {
    const card = template.content.cloneNode(true).firstElementChild;
    const field = (name) => card.querySelector(`[data-field="${name}"]`);

    // Required fields
    field('title').textContent = item.title || '';
    field('authors').textContent = item.authors || '';
    field('desc').textContent = item.desc || '';
    field('date').textContent = item.date_formatted ? `Last updated: ${item.date_formatted}` : '';
    field('link').href = item.relpermalink || '#';

    // Optional: journal
    const journalEl = field('journal');
    if (journalEl && item.journal) {
      journalEl.textContent = item.publication_date
        ? `${item.journal}, ${item.publication_date}`
        : item.journal;
      journalEl.hidden = false;
    }

    // Optional: paper link
    const paperEl = field('paper');
    if (paperEl && item.paper_url) {
      paperEl.href = item.paper_url;
      paperEl.hidden = false;
    }

    // Optional: status badge
    const statusEl = field('status');
    if (statusEl && item.status) {
      statusEl.textContent = item.status;
      statusEl.classList.add(item.status === 'Published' ? 'text-bg-success' : 'text-bg-warning');
      statusEl.hidden = false;
    }

    return card;
  }

  /**
   * Render all items to the container
   * @param {HTMLElement} container
   * @param {HTMLTemplateElement} template
   * @param {Array} items
   */
  function renderItems(container, template, items) {
    container.innerHTML = '';

    if (items.length === 0) {
      container.innerHTML = '<div class="text-center text-muted py-4">No items found.</div>';
      return;
    }

    const fragment = document.createDocumentFragment();
    items.forEach(item => fragment.appendChild(renderCard(template, item)));
    container.appendChild(fragment);
  }

  // =============================================================================
  // Filter Builder
  // =============================================================================

  /**
   * Extract unique values for a field from items (handles both string and array values)
   * @param {Array} items
   * @param {string} field
   * @returns {string[]}
   */
  function getUniqueValues(items, field) {
    const values = new Set();
    items.forEach(item => {
      const value = item[field];
      if (Array.isArray(value)) {
        value.forEach(v => { if (v) values.add(toTitleCase(v)); });
      } else if (value) {
        values.add(toTitleCase(value));
      }
    });
    return [...values].sort();
  }

  /**
   * Create a sanitized ID from field and value
   * @param {string} field
   * @param {string} value
   * @returns {string}
   */
  function createFilterId(field, value) {
    return `filter-${field}-${value.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  }

  /**
   * Build a button-group filter (for few options)
   * @param {HTMLElement} group
   * @param {string} field
   * @param {string[]} values
   * @param {Function} onChange
   * @param {Set<string>} initialSelected - Initially selected values from URL
   */
  function buildButtonFilter(group, field, values, onChange, initialSelected = new Set()) {
    values.forEach(value => {
      const id = createFilterId(field, value);
      const valueLower = value.toLowerCase();
      const isChecked = initialSelected.has(valueLower);

      const input = createElement('input', {
        type: 'checkbox',
        id,
        value: valueLower,
        checked: isChecked,
        className: 'btn-check',
        autocomplete: 'off'
      });
      const label = createElement('label', {
        className: 'btn btn-outline-primary',
        htmlFor: id,
        textContent: value
      });

      input.addEventListener('change', () => onChange(field, input.value, input.checked));
      group.append(input, label);
    });
  }

  /**
   * Build a dropdown filter (for many options)
   * @param {HTMLElement} group
   * @param {string} field
   * @param {string[]} values
   * @param {Function} onChange
   * @param {Set<string>} initialSelected - Initially selected values from URL
   */
  function buildDropdownFilter(group, field, values, onChange, initialSelected = new Set()) {
    group.className = 'dropdown';

    const selectedCount = initialSelected.size;
    const buttonText = selectedCount > 0
      ? `${field.charAt(0).toUpperCase() + field.slice(1)} (${selectedCount})`
      : field.charAt(0).toUpperCase() + field.slice(1);

    const button = createElement('button', {
      className: 'btn btn-outline-primary dropdown-toggle',
      type: 'button',
      textContent: buttonText
    });
    button.setAttribute('data-bs-toggle', 'dropdown');
    button.setAttribute('data-bs-auto-close', 'outside');

    const ul = createElement('ul', { className: 'dropdown-menu' });

    values.forEach(value => {
      const id = createFilterId(field, value);
      const valueLower = value.toLowerCase();
      const isChecked = initialSelected.has(valueLower);

      const input = createElement('input', {
        type: 'checkbox',
        id,
        value: valueLower,
        checked: isChecked,
        className: 'form-check-input'
      });
      const label = createElement('label', {
        className: 'form-check-label',
        htmlFor: id,
        textContent: value
      });

      input.addEventListener('change', () => {
        onChange(field, input.value, input.checked);
        // Update button text to show count
        const checkedCount = ul.querySelectorAll('input:checked').length;
        button.textContent = checkedCount > 0
          ? `${field.charAt(0).toUpperCase() + field.slice(1)} (${checkedCount})`
          : field.charAt(0).toUpperCase() + field.slice(1);
      });

      const li = createElement('li', { className: 'dropdown-item' }, [
        createElement('div', { className: 'form-check' }, [input, label])
      ]);
      ul.appendChild(li);
    });

    group.append(button, ul);
  }

  /**
   * Build all filter groups
   * @param {HTMLElement} container
   * @param {Array} items
   * @param {Map} selectedFilters
   * @param {Function} onFilterChange
   * @param {Map<string, Set<string>>} initialFilters - Initial filter state from URL
   */
  function buildFilters(container, items, selectedFilters, onFilterChange, initialFilters = new Map()) {
    if (!container) return;

    container.querySelectorAll('.filter-group').forEach(group => {
      const field = group.dataset.filterField;
      if (!field) return;

      const values = getUniqueValues(items, field);

      if (values.length === 0) {
        group.style.display = 'none';
        return;
      }

      // Initialize with filters from URL or empty set
      const initialSet = initialFilters.get(field) || new Set();
      selectedFilters.set(field, new Set(initialSet));

      const onChange = (fieldName, value, isChecked) => {
        const filterSet = selectedFilters.get(fieldName);
        if (isChecked) {
          filterSet.add(value);
        } else {
          filterSet.delete(value);
        }
        onFilterChange();
      };

      // Choose button group or dropdown based on number of options
      if (values.length > CONFIG.dropdownThreshold) {
        buildDropdownFilter(group, field, values, onChange, initialSet);
      } else {
        buildButtonFilter(group, field, values, onChange, initialSet);
      }
    });
  }

  // =============================================================================
  // Search & Filter Logic
  // =============================================================================

  /**
   * Check if item matches all active filters (handles both string and array values)
   * @param {Object} item
   * @param {Map} selectedFilters
   * @returns {boolean}
   */
  function matchesFilters(item, selectedFilters) {
    for (const [field, selectedValues] of selectedFilters) {
      // No filter selected = show all (don't filter on this field)
      if (selectedValues.size === 0) continue;

      const itemValue = item[field];

      // Handle array values (e.g., multiple subjects)
      if (Array.isArray(itemValue)) {
        // Empty array doesn't match any filter
        if (itemValue.length === 0) return false;
        // Item matches if any of its values are in the selected set
        const hasMatch = itemValue.some(v => selectedValues.has((v || '').toLowerCase()));
        if (!hasMatch) return false;
      } else {
        // Handle string values - empty string doesn't match any filter
        const normalized = (itemValue || '').toLowerCase();
        if (!normalized || !selectedValues.has(normalized)) return false;
      }
    }
    return true;
  }

  /**
   * Check if item matches search query
   * @param {Object} item
   * @param {string[]} searchTerms
   * @returns {boolean}
   */
  function matchesSearch(item, searchTerms) {
    if (searchTerms.length === 0) return true;

    return searchTerms.every(term =>
      CONFIG.searchFields.some(field => {
        const value = item[field];
        return value && value.toLowerCase().includes(term);
      })
    );
  }

  /**
   * Parse search query into terms
   * @param {string} query
   * @returns {string[]}
   */
  function parseSearchQuery(query) {
    const trimmed = query.trim().toLowerCase();
    if (trimmed.length < CONFIG.minSearchChars) return [];
    return trimmed.split(/\s+/).filter(Boolean);
  }

  /**
   * Filter items based on filters and search
   * @param {Array} items
   * @param {Map} selectedFilters
   * @param {string} searchQuery
   * @param {boolean} searchEnabled
   * @returns {Array}
   */
  function filterItems(items, selectedFilters, searchQuery, searchEnabled) {
    const searchTerms = searchEnabled ? parseSearchQuery(searchQuery) : [];

    return items.filter(item =>
      matchesFilters(item, selectedFilters) && matchesSearch(item, searchTerms)
    );
  }

  // =============================================================================
  // Search Input Handler
  // =============================================================================

  /**
   * Set up search input event handlers
   * @param {HTMLInputElement} input
   * @param {Function} onSearch
   */
  function setupSearchInput(input, onSearch) {
    if (!input) return;

    const debouncedSearch = debounce(onSearch, CONFIG.debounceMs);

    input.addEventListener('input', debouncedSearch);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        input.value = '';
        onSearch();
      }
    });
  }

  // =============================================================================
  // Data Loader
  // =============================================================================

  /**
   * Fetch items from JSON index
   * @param {string} url
   * @returns {Promise<Array>}
   */
  async function fetchItems(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch index: HTTP ${response.status}`);
    }
    return response.json();
  }

  // =============================================================================
  // Main Application
  // =============================================================================

  /**
   * Initialize the list filter application
   */
  async function init() {
    // Get required DOM elements
    const elements = {
      controls: $('listControls'),
      itemList: $('itemList'),
      searchInput: $('searchInput'),
      filtersContainer: $('filtersContainer'),
      cardTemplate: $('cardTemplate')
    };

    // Validate required elements exist
    if (!elements.controls || !elements.itemList || !elements.cardTemplate) {
      return;
    }

    const indexUrl = elements.controls.dataset.indexUrl;
    if (!indexUrl) {
      return;
    }

    const searchEnabled = elements.controls.dataset.searchEnabled === 'true';
    const selectedFilters = new Map();

    // Collect known filter fields from the DOM
    const filterFields = new Set();
    elements.filtersContainer?.querySelectorAll('.filter-group').forEach(group => {
      const field = group.dataset.filterField;
      if (field) filterFields.add(field);
    });

    // Parse initial state from URL
    const urlState = parseUrlState(filterFields);

    // Apply filters and re-render
    const applyFilters = (updateUrl = true) => {
      const searchQuery = elements.searchInput?.value || '';
      const filtered = filterItems(items, selectedFilters, searchQuery, searchEnabled);
      renderItems(elements.itemList, elements.cardTemplate, filtered);

      // Update URL with current state
      if (updateUrl) {
        updateUrlState(selectedFilters, searchQuery);
      }
    };

    // Load data
    let items = [];
    try {
      items = await fetchItems(indexUrl);
    } catch (err) {
      console.error('Failed to load index:', err);
      elements.itemList.innerHTML = '<div class="text-center text-danger py-4">Error loading items.</div>';
      return;
    }

    // Build filter UI with initial state from URL
    buildFilters(elements.filtersContainer, items, selectedFilters, applyFilters, urlState.filters);

    // Set up search with initial value from URL
    if (searchEnabled) {
      if (urlState.search) {
        elements.searchInput.value = urlState.search;
      }
      setupSearchInput(elements.searchInput, applyFilters);
    }

    // Initial render (don't update URL on initial load to avoid replacing entry)
    applyFilters(false);

    // Handle browser back/forward navigation
    window.addEventListener('popstate', () => {
      const newState = parseUrlState(filterFields);

      // Update search input
      if (elements.searchInput) {
        elements.searchInput.value = newState.search;
      }

      // Update filter checkboxes and state
      for (const [field, values] of selectedFilters) {
        const newValues = newState.filters.get(field) || new Set();
        selectedFilters.set(field, new Set(newValues));

        // Update checkbox UI
        const group = elements.filtersContainer?.querySelector(`[data-filter-field="${field}"]`);
        if (group) {
          group.querySelectorAll('input[type="checkbox"]').forEach(input => {
            input.checked = newValues.has(input.value);
          });

          // Update dropdown button text if applicable
          const dropdownBtn = group.querySelector('.dropdown-toggle');
          if (dropdownBtn) {
            const checkedCount = newValues.size;
            dropdownBtn.textContent = checkedCount > 0
              ? `${field.charAt(0).toUpperCase() + field.slice(1)} (${checkedCount})`
              : field.charAt(0).toUpperCase() + field.slice(1);
          }
        }
      }

      // Re-render without updating URL
      applyFilters(false);
    });
  }

  // Start the application
  init();
})();