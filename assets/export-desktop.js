/* ════════════════════════════════════════════════════════════════════
   USTExport — "copy chart as image" always renders the desktop card.

   The export builds its PNG from the *live* DOM: it clones the chart panel,
   rasterizes the live SVGs and scales the result up to EXPORT_STYLE.width.
   That makes the image a faithful record of whatever the card looks like at
   that moment — which is the problem on a phone. A 390px card has a phone
   layout (stacked controls, a shrunken logo, half the axis ticks, the data
   explorer's whole html.mobile layout) and phone proportions, so blowing it
   up to 1600px produced a tall, sparse image that looked nothing like the
   chart as published.

   What a reader expects from "copy chart as image" is the chart, not the
   device it was copied from. So the export is always taken at ONE canonical
   size per card — the size that card has on the desktop landing page (see
   DESKTOP below, measured from en_index.html at any width ≥ --max-w, where
   the grid stops growing). Phone, tablet and desktop all produce the same
   image for the same selection; only the selection can change it.

   How: the card is moved into an off-screen host box of exactly that size,
   relaid out there, captured, and moved back. Off-screen, because the
   previous attempt did it in place — the widget visibly snapped to the
   desktop layout, sat there for a second, and snapped back, which reads as a
   glitch rather than as an export. While the card is away its slot keeps the
   same box (so nothing on the page jumps) and shows a short caption.

   Nothing about the card's state is touched: same selections, same tab, same
   time range, same sort. Only the layout it is drawn in changes.

   The one thing that does not follow the card is a viewport media query, so
   the 560px block in responsive.css is switched off for the duration via
   html.exporting-desktop — a phone-width viewport must not keep applying
   phone rules to a 631px card. Pages also skip their height postMessage
   while the class is set, or the embedding page would resize the iframe to
   fit a card that is about to move back.
════════════════════════════════════════════════════════════════════ */
window.USTExport = (function () {

  /* Canonical card size per widget, in CSS px: the border box of
     #explorer-scale-container on the landing page at desktop width.

     .viz-section is capped at --max-w (1360px) with 2rem of side padding, so
     the numbers stop moving once the window is that wide — 1296 of content,
     a 1.5rem grid gap, minus the scrollbar the landing page carries:

       explorer / weapons (full row) : 1288 wide
       the four paired cards         :  631 wide
       shared height of the tiles    :  552 (the tallest of the four asks for
                                        it and en_index.html gives all five
                                        the same height)
       explorer height               :  815 (1288/1155 × its 730px design box)

     Change a number here and every export of that card changes with it —
     that is the intent; it is the one place the exported geometry is set. */
  const DESKTOP = {
    explorer:              { width: 1288, height: 815 },
    weapons:               { width: 1288, height: 552 },
    tile:                  { width:  631, height: 552 }
  };

  const HOST_X = -200000;   // far enough left to never intersect the viewport

  function caption() {
    return document.documentElement.lang === 'de'
      ? 'Bild wird vorbereitet …'
      : 'Preparing image …';
  }

  function frame() {
    return new Promise(r => requestAnimationFrame(r));
  }

  /**
   * Run `capture` with the card laid out at its canonical desktop size.
   *
   * @param {Object}   size            {width, height} — one of DESKTOP
   * @param {Function} [size.relayout] called after the move (and after the
   *        move back) to make the page redraw its chart for the new box.
   *        A resize event is dispatched either way; this is for pages whose
   *        redraw does not hang off one.
   * @param {Function} capture         does the actual html2canvas work
   */
  async function withDesktopLayout(size, capture) {
    const root      = document.documentElement;
    const container = document.getElementById('explorer-scale-container');
    const wrap      = document.getElementById('explorer-wrap');
    const relayout  = size.relayout || function () {};
    if (!container || !wrap) return capture();

    /* Every export goes through the staging box, including one taken on a
       desktop where the card is already that size. Skipping it there as an
       optimisation made the desktop image the odd one out: the charts that
       correct their own layout after a render — the by-donor rankings redraw
       once when setting the plot height makes a scrollbar appear, which
       changes the width the labels were fitted to — settled differently
       after a fresh two-pass layout than they had over the page's lifetime,
       and a donor name would be ellipsized in one image and not the other.
       One path, one result, on every device. */
    const rect = container.getBoundingClientRect();

    const wasMobile = root.classList.contains('mobile');
    const parent    = container.parentNode;

    /* Keeps the page from collapsing while the card is off-screen. Same box,
       same frame, so only the content inside it changes. */
    const slot = document.createElement('div');
    slot.style.cssText =
      'width:' + Math.round(rect.width) + 'px;' +
      'height:' + Math.round(rect.height) + 'px;' +
      'display:flex;align-items:center;justify-content:center;' +
      'box-sizing:border-box;border:1px solid #ddd6c8;border-radius:6px;' +
      'background:#f6f1e7;color:#8a8375;font-size:0.85rem;';
    slot.textContent = caption();

    const host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText =
      'position:fixed;top:0;left:' + HOST_X + 'px;' +
      'width:' + size.width + 'px;height:' + size.height + 'px;' +
      'overflow:visible;pointer-events:none;';

    root.classList.add('exporting-desktop');
    root.classList.remove('mobile');
    parent.insertBefore(slot, container);
    host.appendChild(container);
    document.body.appendChild(host);

    try {
      /* Two passes. The first gives the card its new box; the second lets
         anything that sizes itself from the *result* of that reflow settle —
         the footer band (chart-layout.js) reserves space from rendered
         geometry, and a legend that rewraps changes the height the chart is
         drawn into. Each pass gets a frame to lay out and a frame to paint. */
      for (let i = 0; i < 2; i++) {
        window.dispatchEvent(new Event('resize'));
        relayout();
        await frame();
        await frame();
      }
      return await capture();
    } finally {
      host.removeChild(container);
      parent.insertBefore(container, slot);
      parent.removeChild(slot);
      document.body.removeChild(host);
      root.classList.remove('exporting-desktop');
      if (wasMobile) root.classList.add('mobile');
      window.dispatchEvent(new Event('resize'));
      relayout();
    }
  }

  /** True while a card is staged off-screen — pages use it to suppress the
   *  height they postMessage to an embedder. */
  function isExporting() {
    return document.documentElement.classList.contains('exporting-desktop');
  }

  return {
    DESKTOP: DESKTOP,
    withDesktopLayout: withDesktopLayout,
    isExporting: isExporting
  };
})();
