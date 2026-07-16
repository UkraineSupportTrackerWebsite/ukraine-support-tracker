/* ════════════════════════════════════════════════════════════════════
   USTData — shared CSV loader for the Ukraine Support Tracker widgets.

   Every chart page (data_explorer, total_allocations, allocations_by_region,
   weapons_by_country, procurement_trends) includes this file and calls
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

  // Resolves to the repo's own "data/" folder, one level up from
  // HTML/*.html (works both on GitHub Pages and locally, since fetch()
  // resolves relative to the HTML file's own URL, not the parent page
  // embedding it in an iframe). To publish a new release: replace the
  // CSVs in data/ produced by extract_ust_data.R and push — no HTML
  // changes needed.
  const DATA_BASE_URL = '../data/';

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
    if (!res.ok) throw new Error(`USTData: failed to load ${filename} (${res.status})`);
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

  return { DATA_BASE_URL, parseCSV, fetchCSV, fetchReleaseLabel };
})();
