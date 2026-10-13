/**
 * Lachlan's World - Retro Client-Side Search
 * Powered by Zola's native ElasticLunr index with zero external dependencies.
 */
(function () {
  'use strict';

  var searchInput = document.getElementById('site-search-input');
  var searchClearBtn = document.getElementById('site-search-clear');
  var searchDropdown = document.getElementById('search-results-dropdown');
  var searchCloseBtn = document.getElementById('search-close-btn');
  var searchStatusBar = document.getElementById('search-status-bar');
  var searchResultsList = document.getElementById('search-results-list');

  if (!searchInput || !searchDropdown || !searchResultsList) return;

  // Immediately ensure dropdown starts completely hidden
  searchDropdown.hidden = true;
  searchDropdown.style.display = 'none';
  if (searchClearBtn) {
    searchClearBtn.hidden = true;
    searchClearBtn.style.display = 'none';
  }

  var config = window.SEARCH_CONFIG || {};
  var elasticlunrUrl = config.elasticlunrUrl || '/elasticlunr.min.js';
  var searchIndexUrl = config.searchIndexUrl || '/search_index.en.js';
  var loadingText = config.loadingText || 'Searching index...';
  var noResultsText = config.noResultsText || 'No matching records found.';
  var matchesSuffix = config.matchesSuffix || 'match(es) found';

  var searchIndexInstance = null;
  var isIndexLoading = false;
  var loadIndexPromise = null;
  var debounceTimer = null;
  var activeIndex = -1;

  function loadScript(url) {
    return new Promise(function (resolve, reject) {
      // Check if already in DOM
      var existing = document.querySelector('script[src="' + url + '"]');
      if (existing) {
        if (existing.getAttribute('data-loaded') === 'true') {
          return resolve();
        }
        existing.addEventListener('load', function () { resolve(); });
        existing.addEventListener('error', function (e) { reject(e); });
        return;
      }

      var script = document.createElement('script');
      script.src = url;
      script.async = true;
      script.onload = function () {
        script.setAttribute('data-loaded', 'true');
        resolve();
      };
      script.onerror = function (e) {
        reject(new Error('Failed to load script: ' + url));
      };
      document.head.appendChild(script);
    });
  }

  function ensureSearchIndex() {
    if (searchIndexInstance) return Promise.resolve(searchIndexInstance);
    if (loadIndexPromise) return loadIndexPromise;

    isIndexLoading = true;
    loadIndexPromise = loadScript(elasticlunrUrl)
      .then(function () {
        return loadScript(searchIndexUrl);
      })
      .then(function () {
        if (!window.searchIndex || typeof window.elasticlunr === 'undefined') {
          throw new Error('Search index or elasticlunr library missing on window.');
        }
        searchIndexInstance = window.elasticlunr.Index.load(window.searchIndex);
        isIndexLoading = false;
        return searchIndexInstance;
      })
      .catch(function (err) {
        isIndexLoading = false;
        console.error('Failed to initialize search engine:', err);
        throw err;
      });

    return loadIndexPromise;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function highlightMatches(text, terms) {
    if (!text || !terms || terms.length === 0) return escapeHtml(text || '');
    var escapedText = escapeHtml(text);
    terms.forEach(function (term) {
      if (!term || term.length < 2) return;
      try {
        var regex = new RegExp('(' + escapeRegExp(escapeHtml(term)) + ')', 'gi');
        escapedText = escapedText.replace(regex, '<mark class="search-match">$1</mark>');
      } catch (e) {}
    });
    return escapedText;
  }

  function createSnippet(doc, terms) {
    var content = doc.body || doc.description || '';
    if (!content) return '';

    var lowerContent = content.toLowerCase();
    var firstMatchIdx = -1;

    for (var i = 0; i < terms.length; i++) {
      var t = terms[i].toLowerCase();
      if (t.length >= 2) {
        var idx = lowerContent.indexOf(t);
        if (idx !== -1 && (firstMatchIdx === -1 || idx < firstMatchIdx)) {
          firstMatchIdx = idx;
        }
      }
    }

    var snippetLength = 120;
    var start = 0;
    var prefix = '';
    var suffix = '';

    if (firstMatchIdx !== -1) {
      start = Math.max(0, firstMatchIdx - 35);
      if (start > 0) prefix = '...';
      if (start + snippetLength < content.length) suffix = '...';
    } else if (content.length > snippetLength) {
      suffix = '...';
    }

    var rawSnippet = content.substring(start, start + snippetLength).replace(/\s+/g, ' ').trim();
    return prefix + highlightMatches(rawSnippet, terms) + suffix;
  }

  var isExplicitlyClosed = false;

  function openDropdown() {
    searchDropdown.hidden = false;
    searchDropdown.style.display = 'flex';
    searchInput.setAttribute('aria-expanded', 'true');
    isExplicitlyClosed = false;
  }

  function closeDropdown() {
    searchDropdown.hidden = true;
    searchDropdown.style.display = 'none';
    searchInput.setAttribute('aria-expanded', 'false');
    activeIndex = -1;
    isExplicitlyClosed = true;
  }

  function updateActiveItem(items) {
    items.forEach(function (item, idx) {
      if (idx === activeIndex) {
        item.classList.add('selected');
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove('selected');
      }
    });
  }

  function executeSearch() {
    var rawQuery = searchInput.value || '';
    var query = rawQuery.trim();

    if (!query) {
      closeDropdown();
      searchResultsList.innerHTML = '';
      searchStatusBar.textContent = '';
      if (searchClearBtn) {
        searchClearBtn.hidden = true;
        searchClearBtn.style.display = 'none';
      }
      return;
    }

    if (searchClearBtn) {
      searchClearBtn.hidden = false;
      searchClearBtn.style.display = 'block';
    }
    openDropdown();

    if (!searchIndexInstance) {
      searchStatusBar.textContent = loadingText;
      searchResultsList.innerHTML = '';
      ensureSearchIndex()
        .then(function () {
          executeSearch();
        })
        .catch(function () {
          searchStatusBar.textContent = 'Error loading search index.';
        });
      return;
    }

    var terms = query.split(/\s+/).filter(function (t) { return t.length > 1; });
    var results = searchIndexInstance.search(query, {
      fields: {
        title: { boost: 3 },
        description: { boost: 2 },
        body: { boost: 1 }
      },
      bool: 'OR',
      expand: true
    });

    if (!results || results.length === 0) {
      searchStatusBar.textContent = noResultsText;
      searchResultsList.innerHTML = '';
      return;
    }

    searchStatusBar.textContent = results.length + ' ' + matchesSuffix;
    searchResultsList.innerHTML = '';
    activeIndex = -1;

    // Show up to top 8 matches
    var maxResults = Math.min(results.length, 8);
    for (var i = 0; i < maxResults; i++) {
      var itemRef = results[i].ref;
      var doc = searchIndexInstance.documentStore.getDoc(itemRef);
      if (!doc) continue;

      var li = document.createElement('li');
      li.className = 'search-result-item';
      li.setAttribute('role', 'option');

      var link = document.createElement('a');
      link.className = 'search-result-link';
      link.href = doc.path || doc.id || itemRef;

      var titleDiv = document.createElement('div');
      titleDiv.className = 'search-result-row';

      var titleSpan = document.createElement('span');
      titleSpan.className = 'search-result-title';
      titleSpan.innerHTML = highlightMatches(doc.title || 'Untitled', terms);
      titleDiv.appendChild(titleSpan);

      var isBlog = (doc.path && doc.path.indexOf('/blog/') !== -1) || (doc.id && doc.id.indexOf('/blog/') !== -1);
      var badge = document.createElement('span');
      badge.className = 'search-result-badge';
      badge.textContent = isBlog ? '[BLOG]' : '[PAGE]';
      titleDiv.appendChild(badge);

      link.appendChild(titleDiv);

      var snippet = createSnippet(doc, terms);
      if (snippet) {
        var snippetDiv = document.createElement('div');
        snippetDiv.className = 'search-result-snippet';
        snippetDiv.innerHTML = snippet;
        link.appendChild(snippetDiv);
      }

      li.appendChild(link);
      searchResultsList.appendChild(li);
    }
  }

  // Pre-fetch search index when input receives focus or hover
  searchInput.addEventListener('focus', function () {
    ensureSearchIndex();
    if (!isExplicitlyClosed && searchInput.value.trim().length > 0) {
      openDropdown();
    }
  });

  // Re-open if user clicks into input
  searchInput.addEventListener('click', function () {
    if (searchInput.value.trim().length > 0 && searchDropdown.hidden) {
      openDropdown();
      executeSearch();
    }
  });

  searchInput.addEventListener('input', function () {
    isExplicitlyClosed = false;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(executeSearch, 150);
  });

  // Clear query button
  if (searchClearBtn) {
    searchClearBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      searchInput.value = '';
      searchClearBtn.hidden = true;
      closeDropdown();
      searchInput.focus();
    });
  }

  // Close popup button [x]
  if (searchCloseBtn) {
    searchCloseBtn.addEventListener('mousedown', function (e) {
      e.preventDefault();
      e.stopPropagation();
    });
    searchCloseBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      closeDropdown();
      searchInput.blur();
    });
  }

  // Keyboard navigation & accessibility
  searchInput.addEventListener('keydown', function (e) {
    var items = searchResultsList.querySelectorAll('.search-result-item');
    if (e.key === 'ArrowDown') {
      if (items.length > 0) {
        e.preventDefault();
        openDropdown();
        activeIndex = (activeIndex + 1) % items.length;
        updateActiveItem(items);
      }
    } else if (e.key === 'ArrowUp') {
      if (items.length > 0) {
        e.preventDefault();
        openDropdown();
        activeIndex = (activeIndex - 1 + items.length) % items.length;
        updateActiveItem(items);
      }
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < items.length) {
        e.preventDefault();
        var link = items[activeIndex].querySelector('a');
        if (link) link.click();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeDropdown();
      searchInput.blur();
    }
  });

  // Close dropdown on outside click
  document.addEventListener('click', function (e) {
    var searchBox = document.querySelector('.search-box');
    if (searchBox && !searchBox.contains(e.target)) {
      closeDropdown();
    }
  });
})();
