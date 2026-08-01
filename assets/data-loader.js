/* ════════════════════════════════════════════════════════════════════
   USTData — shared CSV loader for the Ukraine Support Tracker widgets.

   Every chart page (data_explorer, total_allocations, allocations_by_region,
   weapons_by_donor, procurement_trends) includes this file and calls
   USTData.fetchCSV('<name>.csv') / USTData.fetchReleaseLabel() to load its
   data at runtime instead of embedding it in the page. That means: to
   publish a new release, drop updated CSVs (produced by the R export
   script) into DATA_BASE_URL — the HTML files themselves never change.

   CSV format expectations:
     - comma-delimited, UTF-8, first row = header
     - fields containing a comma must be quoted with " " (standard CSV
       quoting — this is what R's write.csv()/readr::write_csv() produce
       automatically)
     - numeric-looking values are auto-converted to JS numbers
════════════════════════════════════════════════════════════════════ */
window.USTData = (function () {

  // ── Preview mode ──────────────────────────────────────────────────
  // Adding "?preview" to a page's URL makes every widget on it read from
  // data-preview/ instead of data/. That lets a new release be checked in
  // the real charts before it goes live: drop the CSVs into data-preview/,
  // look at the ?preview links, and only then drop the same files into
  // data/.
  //
  // A chart page opened inside an iframe has no query string of its own,
  // so it also asks the embedding page. That read throws a SecurityError
  // when the parent is on another domain — which is exactly the case on
  // the live Kiel Institute site — so production always falls through to
  // the live data folder. The try/catch is the safety net, not a nicety.
  function isPreview() {
    if (new URLSearchParams(location.search).has('preview')) return true;
    try {
      if (window.parent !== window &&
          new URLSearchParams(window.parent.location.search).has('preview')) {
        return true;
      }
    } catch (e) {
      // cross-origin parent → not our preview site → live data
    }
    return false;
  }

  const PREVIEW = isPreview();

  // Resolves to the repo's own "data/" folder, two levels up from
  // HTML/<lang>/*.html (works both on GitHub Pages and locally, since
  // fetch() resolves relative to the HTML file's own URL, not the parent
  // page embedding it in an iframe). Both language folders — HTML/english
  // and HTML/german — share this one data folder, so a new release only
  // has to be dropped in once. To publish a new release: replace the
  // CSVs in data/ produced by extract_ust_data.R and push — no HTML
  // changes needed.
  const DATA_BASE_URL = PREVIEW ? '../../data-preview/' : '../../data/';

  function parseCSV(text) {
    const rows = [];
    let row = [], field = '', inQuotes = false;
    const pushField = () => { row.push(field); field = ''; };
    const pushRow = () => { rows.push(row); row = []; };

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else {
          field += c;
        }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        pushField();
      } else if (c === '\n') {
        pushField(); pushRow();
      } else if (c === '\r') {
        // skip, \n handles the row break
      } else {
        field += c;
      }
    }
    if (field.length || row.length) { pushField(); pushRow(); }

    const cleaned = rows.filter(r => !(r.length === 1 && r[0] === ''));
    if (!cleaned.length) return [];
    const headers = cleaned[0].map(h => h.trim());

    return cleaned.slice(1).map(cells => {
      const obj = {};
      headers.forEach((h, i) => {
        const raw = (cells[i] ?? '').trim();
        obj[h] = raw === '' ? '' : (isNaN(raw) ? raw : Number(raw));
      });
      return obj;
    });
  }

  async function fetchCSV(filename) {
    const res = await fetch(DATA_BASE_URL + filename, { cache: 'no-store' });
    if (!res.ok) {
      if (PREVIEW && res.status === 404) {
        throw new Error(
          `USTData: ${filename} is missing from data-preview/. ` +
          `All CSVs have to be uploaded there, not just the changed ones.`);
      }
      throw new Error(`USTData: failed to load ${filename} (${res.status})`);
    }
    return parseCSV(await res.text());
  }

  // release_info.csv columns: release,period,date,label
  // "label" is the exact string shown throughout the widgets, e.g.
  // "Ukraine Support Tracker, Release 30 (07/2026)"
  async function fetchReleaseLabel(fallback) {
    try {
      const rows = await fetchCSV('release_info.csv');
      return (rows[0] && rows[0].label) ? String(rows[0].label) : fallback;
    } catch (e) {
      console.warn('USTData: could not load release_info.csv, using fallback label', e);
      return fallback;
    }
  }

  // A chart page opened on its own in preview mode gets a corner badge, so
  // a screenshot of it can never be mistaken for the live chart. Inside an
  // iframe it stays out of the way — the index page shows one banner for
  // the whole set instead of six.
  function markPreview() {
    if (!PREVIEW || window.parent !== window) return;
    const badge = document.createElement('div');
    badge.textContent = 'PREVIEW DATA';
    badge.style.cssText =
      'position:fixed;top:8px;right:8px;z-index:9999;background:#b3261e;' +
      'color:#fff;font:600 11px/1 system-ui,sans-serif;letter-spacing:.06em;' +
      'padding:6px 9px;border-radius:4px;pointer-events:none;';
    document.body.appendChild(badge);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', markPreview);
  } else {
    markPreview();
  }

  return { PREVIEW, DATA_BASE_URL, parseCSV, fetchCSV, fetchReleaseLabel };
})();
