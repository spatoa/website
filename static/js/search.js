/**
 * @module Search
 * @description Client-side search powered by Zola's native ElasticLunr index.
 * Lazily loads elasticlunr.min.js and search index JSON on first focus, rendering an accessible
 * retro search results dropdown.
 *
 * @dependencies
 * - DOM: #site-search-input, #search-results-dropdown, #search-status-bar, #search-results-list
 * - window.SEARCH_CONFIG (injected inline in base.html)
 *
 * @exports
 * - window.searchIndex
 * - window.elasticlunr
 *
 * @storageKeys
 * - None
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
  var loadIndexPromise = null;
  var debounceTimer = null;
  var activeIndex = -1;

  function toRelativeAssetUrl(url) {
    if (!url || typeof url !== 'string') return url;
    try {
      var parsed = new URL(url, window.location.origin);
      if (parsed.hostname === 'www.lachlans.world' || parsed.hostname === 'lachlans.world') {
        return parsed.pathname + parsed.search + parsed.hash;
      }
      return parsed.href;
    } catch (e) {
      return url;
    }
  }

  function sanitizeResultUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return '#';
    var trimmed = rawUrl.trim();
    if (/^(javascript|data|vbscript):/i.test(trimmed)) {
      return '#';
    }
    return toRelativeAssetUrl(trimmed);
  }

  function loadScript(url) {
    var resolvedUrl = toRelativeAssetUrl(url);
    return new Promise(function (resolve, reject) {
      var scripts = document.querySelectorAll('script[src]');
      var existing = null;
      for (var i = 0; i < scripts.length; i++) {
        var srcAttr = scripts[i].getAttribute('src');
        if (srcAttr === resolvedUrl || srcAttr === url) {
          existing = scripts[i];
          break;
        }
      }

      if (existing) {
        if (existing.getAttribute('data-loaded') === 'true') {
          return resolve();
        }
        existing.addEventListener('load', function () { resolve(); }, { once: true });
        existing.addEventListener('error', function () { reject(new Error('Failed to load script: ' + resolvedUrl)); }, { once: true });
        return;
      }

      var script = document.createElement('script');
      script.src = resolvedUrl;
      script.async = true;
      script.onload = function () {
        script.setAttribute('data-loaded', 'true');
        resolve();
      };
      script.onerror = function () {
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
        reject(new Error('Failed to load script: ' + resolvedUrl));
      };
      document.head.appendChild(script);
    });
  }

  function ensureSearchIndex() {
    if (searchIndexInstance) return Promise.resolve(searchIndexInstance);
    if (loadIndexPromise) return loadIndexPromise;

    loadIndexPromise = loadScript(elasticlunrUrl)
      .then(function () {
        return loadScript(searchIndexUrl);
      })
      .then(function () {
        if (!window.searchIndex || typeof window.elasticlunr === 'undefined') {
          throw new Error('Search index or elasticlunr library missing on window.');
        }
        searchIndexInstance = window.elasticlunr.Index.load(window.searchIndex);
        return searchIndexInstance;
      })
      .catch(function (err) {
        loadIndexPromise = null;
        console.error('Failed to initialize search engine:', err);
        throw err;
      });

    return loadIndexPromise;
  }

  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Safe DOM-based highlight renderer (prevents XSS and nested <mark> tag corruption)
   */
  function appendHighlightedText(container, text, terms) {
    var safeText = String(text || '');
    if (!safeText) return;

    var validTerms = (terms || [])
      .filter(function (t) { return typeof t === 'string' && t.length >= 2; })
      .sort(function (a, b) { return b.length - a.length; });

    if (validTerms.length === 0) {
      container.appendChild(document.createTextNode(safeText));
      return;
    }

    var pattern = '(' + validTerms.map(escapeRegExp).join('|') + ')';
    var regex;
    try {
      regex = new RegExp(pattern, 'gi');
    } catch (e) {
      container.appendChild(document.createTextNode(safeText));
      return;
    }

    var parts = safeText.split(regex);
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i];
      if (!part) continue;
      if (i % 2 === 1) {
        var mark = document.createElement('mark');
        mark.className = 'search-match';
        mark.textContent = part;
        container.appendChild(mark);
      } else {
        container.appendChild(document.createTextNode(part));
      }
    }
  }

  function extractRawSnippet(doc, terms) {
    var content = doc.body || doc.description || '';
    if (!content) return null;

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
    return {
      prefix: prefix,
      text: rawSnippet,
      suffix: suffix
    };
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
    searchInput.removeAttribute('aria-activedescendant');
    activeIndex = -1;
    isExplicitlyClosed = true;
  }

  function updateActiveItem(items) {
    items.forEach(function (item, idx) {
      if (idx === activeIndex) {
        item.classList.add('selected');
        item.setAttribute('aria-selected', 'true');
        if (item.id) {
          searchInput.setAttribute('aria-activedescendant', item.id);
        }
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove('selected');
        item.setAttribute('aria-selected', 'false');
      }
    });
  }

  function executeSearch() {
    var rawQuery = searchInput.value || '';
    var query = rawQuery.trim();

    if (!query) {
      closeDropdown();
      searchResultsList.replaceChildren();
      if (searchStatusBar) searchStatusBar.textContent = '';
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
      if (searchStatusBar) searchStatusBar.textContent = loadingText;
      searchResultsList.replaceChildren();
      ensureSearchIndex()
        .then(function () {
          executeSearch();
        })
        .catch(function () {
          if (searchStatusBar) searchStatusBar.textContent = 'Error loading search index.';
        });
      return;
    }

    var terms = query.split(/\s+/).filter(function (t) { return t.length > 1; });
    var results = [];
    try {
      results = searchIndexInstance.search(query, {
        fields: {
          title: { boost: 3 },
          description: { boost: 2 },
          body: { boost: 1 }
        },
        bool: 'OR',
        expand: true
      });
    } catch (err) {
      results = [];
    }

    if (!results || results.length === 0) {
      if (searchStatusBar) searchStatusBar.textContent = noResultsText;
      searchResultsList.replaceChildren();
      return;
    }

    if (searchStatusBar) searchStatusBar.textContent = results.length + ' ' + matchesSuffix;
    searchResultsList.replaceChildren();
    activeIndex = -1;

    // Show up to top 8 matches
    var maxResults = Math.min(results.length, 8);
    for (var i = 0; i < maxResults; i++) {
      var itemRef = results[i].ref;
      var doc = searchIndexInstance.documentStore.getDoc(itemRef);
      if (!doc) continue;

      var li = document.createElement('li');
      li.className = 'search-result-item';
      li.id = 'search-result-opt-' + i;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', 'false');

      var link = document.createElement('a');
      link.className = 'search-result-link';
      link.href = sanitizeResultUrl(doc.path || doc.id || itemRef);

      var titleDiv = document.createElement('div');
      titleDiv.className = 'search-result-row';

      var titleSpan = document.createElement('span');
      titleSpan.className = 'search-result-title';
      appendHighlightedText(titleSpan, doc.title || 'Untitled', terms);
      titleDiv.appendChild(titleSpan);

      var isBlog = (doc.path && doc.path.indexOf('/blog/') !== -1) || (doc.id && doc.id.indexOf('/blog/') !== -1);
      var badge = document.createElement('span');
      badge.className = 'search-result-badge';
      badge.textContent = isBlog ? '[BLOG]' : '[PAGE]';
      titleDiv.appendChild(badge);

      link.appendChild(titleDiv);

      var snippetObj = extractRawSnippet(doc, terms);
      if (snippetObj && snippetObj.text) {
        var snippetDiv = document.createElement('div');
        snippetDiv.className = 'search-result-snippet';
        if (snippetObj.prefix) {
          snippetDiv.appendChild(document.createTextNode(snippetObj.prefix));
        }
        appendHighlightedText(snippetDiv, snippetObj.text, terms);
        if (snippetObj.suffix) {
          snippetDiv.appendChild(document.createTextNode(snippetObj.suffix));
        }
        link.appendChild(snippetDiv);
      }

      li.appendChild(link);
      searchResultsList.appendChild(li);
    }
  }

  // Pre-fetch search index when input receives focus
  searchInput.addEventListener('focus', function () {
    ensureSearchIndex().catch(function () {});
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
      searchClearBtn.style.display = 'none';
      searchResultsList.replaceChildren();
      if (searchStatusBar) searchStatusBar.textContent = '';
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
    var searchBox = searchInput.closest('.search-box');
    if (searchBox && !searchBox.contains(e.target)) {
      closeDropdown();
    }
  });
})();
