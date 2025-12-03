/**
 * List Filter & Search
 * Loads JSON index, renders list items, and provides search + status filtering.
 */

(function () {
  'use strict';

  const MIN_SEARCH_CHARS = 2;
  const SEARCH_FIELDS = ['title', 'authors', 'desc', 'content'];

  // DOM references
  const listControls = document.getElementById('listControls');
  const itemList = document.getElementById('itemList');
  const searchInput = document.getElementById('searchInput');
  const statusFilter = document.getElementById('statusFilter');

  if (!listControls || !itemList) return;

  const indexUrl = listControls.dataset.indexUrl;
  if (!indexUrl) return;

  // State
  let items = [];
  let selectedStatuses = new Set();

  // Create a text node safely (no innerHTML for user content)
  const text = (str) => document.createTextNode(str || '');

  // Create element with attributes and children
  function el(tag, attrs = {}, ...children) {
    const element = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'className') element.className = value;
      else if (key === 'dataset') Object.assign(element.dataset, value);
      else element.setAttribute(key, value);
    }
    for (const child of children) {
      element.append(typeof child === 'string' ? text(child) : child);
    }
    return element;
  }

  // Render a single card
  function renderCard(item) {
    const statusClass = item.status === 'Published' ? 'text-bg-success' : 'text-bg-warning';

    // Badge container
    const badges = el('div', { className: 'float-end ms-2' });
    
    if (item.paper_url) {
      const icon = el('span', { className: 'badge text-bg-secondary ms-1 mb-1' });
      const link = el('a', { href: item.paper_url, className: 'text-muted', title: 'View paper' });
      link.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="currentColor" viewBox="0 0 384 512"><path d="M64 0C28.7 0 0 28.7 0 64v384c0 35.3 28.7 64 64 64h256c35.3 0 64-28.7 64-64V160H256c-17.7 0-32-14.3-32-32V0H64zm192 0v128h128L256 0zM112 256h160c8.8 0 16 7.2 16 16s-7.2 16-16 16H112c-8.8 0-16-7.2-16-16s7.2-16 16-16zm0 64h160c8.8 0 16 7.2 16 16s-7.2 16-16 16H112c-8.8 0-16-7.2-16-16s7.2-16 16-16zm0 64h160c8.8 0 16 7.2 16 16s-7.2 16-16 16H112c-8.8 0-16-7.2-16-16s7.2-16 16-16z"/></svg>';
      icon.append(link);
      badges.append(icon);
    }

    if (item.status) {
      badges.append(el('span', { className: `badge ${statusClass} ms-1 mb-1` }, item.status));
    }

    const cardBody = el('div', { className: 'card-body' },
      badges,
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
      text(`Last updated: ${item.date_formatted}`),
      el('div', { className: 'float-end text-muted' }, footerLink)
    );

    return el('div', { className: 'card my-1' }, cardBody, cardFooter);
  }

  // Render filtered items to the list
  function renderItems(filteredItems) {
    itemList.innerHTML = '';
    if (filteredItems.length === 0) {
      itemList.append(el('div', { className: 'text-center text-muted py-4' }, 'No items found.'));
    } else {
      filteredItems.forEach(item => itemList.append(renderCard(item)));
    }
  }

  // Build status filter buttons
  function buildStatusFilter() {
    const statuses = [...new Set(items.map(i => i.status).filter(Boolean))].sort();

    if (statuses.length === 0) {
      statusFilter.style.display = 'none';
      return;
    }

    statuses.forEach(status => {
      const value = status.toLowerCase();
      const id = `filter-${value.replace(/\s+/g, '-')}`;
      const isPublished = value === 'published';
      
      // Default to only published
      if (isPublished) {
        selectedStatuses.add(value);
      }

      const input = el('input', {
        type: 'checkbox',
        className: 'btn-check',
        name: 'statusFilter',
        id,
        value,
        autocomplete: 'off'
      });
      if (isPublished) input.checked = true;

      input.addEventListener('change', () => {
        input.checked ? selectedStatuses.add(value) : selectedStatuses.delete(value);
        applyFilters();
      });

      statusFilter.append(input, el('label', { className: 'btn btn-outline-primary', for: id }, status));
    });
  }

  // Check if item matches search terms
  function matchesSearch(item, query) {
    if (query.length < MIN_SEARCH_CHARS) return true;

    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    return terms.every(term =>
      SEARCH_FIELDS.some(field => (item[field] || '').toLowerCase().includes(term))
    );
  }

  // Apply filters and re-render
  function applyFilters() {
    const query = searchInput?.value.trim() || '';
    const filtered = items.filter(item =>
      selectedStatuses.has((item.status || '').toLowerCase()) && matchesSearch(item, query)
    );
    renderItems(filtered);
  }

  // Load index and initialize
  async function init() {
    try {
      const response = await fetch(indexUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      items = await response.json();

      buildStatusFilter();

      searchInput?.addEventListener('input', applyFilters);
      searchInput?.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
          searchInput.value = '';
          applyFilters();
        }
      });

      applyFilters();
    } catch (err) {
      console.error('Failed to load index:', err);
      itemList.innerHTML = '';
      itemList.append(el('div', { className: 'text-center text-danger py-4' }, 'Error loading items.'));
    }
  }

  init();
})();