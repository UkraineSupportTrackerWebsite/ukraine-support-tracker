/* ════════════════════════════════════════════════════════════════════
   USTde — German country names for the Ukraine Support Tracker widgets.

   The CSVs in data/ are shared by both language folders (HTML/english and
   HTML/german) and always carry the English donor names, so a new release
   only ever has to be dropped in once. The German pages include this file
   and pass every donor name through USTde.country() at render time.

   Anything not in the map is returned unchanged — weapon model names,
   the EU institutions' short forms and any donor added to a future
   release therefore still show up, just untranslated, instead of
   disappearing from the chart.
════════════════════════════════════════════════════════════════════ */
window.USTde = (function () {

  const COUNTRIES = {
    'Australia': 'Australien',
    'Austria': 'Österreich',
    'Belgium': 'Belgien',
    'Bulgaria': 'Bulgarien',
    'Canada': 'Kanada',
    'China': 'China',
    'Croatia': 'Kroatien',
    'Cyprus': 'Zypern',
    'Czechia': 'Tschechien',
    'Czech Republic': 'Tschechien',
    'Denmark': 'Dänemark',
    'Estonia': 'Estland',
    'Finland': 'Finnland',
    'France': 'Frankreich',
    'Germany': 'Deutschland',
    'Greece': 'Griechenland',
    'Hungary': 'Ungarn',
    'Iceland': 'Island',
    'India': 'Indien',
    'Ireland': 'Irland',
    'Italy': 'Italien',
    'Japan': 'Japan',
    'Latvia': 'Lettland',
    'Lithuania': 'Litauen',
    'Luxembourg': 'Luxemburg',
    'Malta': 'Malta',
    'Netherlands': 'Niederlande',
    'New Zealand': 'Neuseeland',
    'Norway': 'Norwegen',
    'Poland': 'Polen',
    'Portugal': 'Portugal',
    'Romania': 'Rumänien',
    'Slovakia': 'Slowakei',
    'Slovenia': 'Slowenien',
    'South Korea': 'Südkorea',
    'Korea': 'Südkorea',
    'Spain': 'Spanien',
    'Sweden': 'Schweden',
    'Switzerland': 'Schweiz',
    'Taiwan': 'Taiwan',
    'Turkiye': 'Türkei',
    'Turkey': 'Türkei',
    'United Kingdom': 'Vereinigtes Königreich',
    'United States': 'Vereinigte Staaten',
    'United States of America': 'Vereinigte Staaten',
    'USA': 'Vereinigte Staaten',
    'Ukraine': 'Ukraine',
    'Russia': 'Russland',
    'EU (Commission and Council)': 'EU (Kommission und Rat)',
    'EU Institutions': 'EU-Institutionen',
    'EU institutions': 'EU-Institutionen',
    'European Union': 'Europäische Union'
  };

  // Translate a single donor/country name; unknown names pass through.
  function country(name) {
    if (name == null) return name;
    return COUNTRIES[String(name)] || name;
  }

  // Translate every name in an array.
  function countries(names) {
    return (names || []).map(country);
  }

  return { COUNTRIES, country, countries };
})();
