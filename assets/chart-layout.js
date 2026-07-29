/* ════════════════════════════════════════════════════════════════════
   USTLayout — keeps the floating action buttons clear of chart content.

   Every chart card ends with a .chart-footer pinned to the bottom-right
   holding the info / download / share buttons. The buttons sit *over* the
   chart on a translucent blurred backdrop (.footer-icons::before, which
   bleeds 40px further left and 6px above/below the buttons themselves).

   On a wide card that overlap lands on empty plot area and looks deliberate.
   As the card narrows, the same buttons start covering real content — the
   series legend, the last x-axis label, the bottom table row.

   applyFooterBand() reserves a strip the height of that button cluster as
   margin-bottom on the card's last flow child, but only on cards narrower
   than WIDE_CARD. Because the card is a column flex box whose chart area is
   flex:1, the margin steals space from the chart rather than from the page:
   the content column shifts up and the legend lands *above* the buttons
   instead of behind them.

   The reservation is a function of the card's width and the button cluster's
   own size — never of where the chart's content currently sits. That looks
   like a missed refinement and is the whole point: the chart redraws to fill
   whatever the pane's height ends up being, so a reservation derived from
   the chart's geometry is derived from its own previous output. Every such
   variant oscillated between overlapping and leaving a gap. See the comment
   in applyFooterBand() for the full account.

   The pages do not add this to the height they request from an embedder. The
   card keeps the height its aspect ratio dictates and the plot gives up the
   pixels; adding it back simply moved the collision out and left a dead
   strip along the bottom.

   One case gets the space back instead of reserving it: once the legend has
   wrapped, its last row is usually a single item with the rest of the line
   empty, and the buttons fit in that hole. tuckIntoLegend() detects it, skips
   the band, and reports the skipped pixels through footerShed() so the page
   can ask its embedder for a correspondingly shorter card — which is what
   lifts the buttons off the bottom edge and up beside the legend's last row.
════════════════════════════════════════════════════════════════════ */
window.USTLayout = (function () {

  /* Must match .footer-icons::before in chart-base.css. */
  const BLEED = { left: 40, top: 6, right: 8, bottom: 6 };

  /* Breathing room between content and the backdrop's soft edge. */
  const GAP = 4;

  /* Cards at least this wide keep the original look, where the buttons float
     over the plot on their blurred backdrop. That is the design working as
     intended: on a wide card they land on empty chart area, and the one thing
     that reaches under them — the last x-axis label — stays perfectly legible
     through the blur. Reserving space there just pushes the chart up and
     leaves a bare strip. The collision only becomes a real problem once the
     card is narrow enough that the buttons cover the legend or a bar label. */
  const WIDE_CARD = 700;

  /* Pixels of daylight demanded between the last legend item and the left
     edge of the occluder before the buttons are allowed to share its line. */
  const TUCK_CLEARANCE = 8;

  /* Per-card record of what the last applyFooterBand() call chose not to
     reserve, read back by footerShed(). */
  const shed = new WeakMap();

  function occluderBox(root) {
    const icons = root.querySelector('.footer-icons');
    if (!icons) return null;
    const r = icons.getBoundingClientRect();
    if (!r.width) return null;

    let box = {
      top: r.top - BLEED.top,
      left: r.left - BLEED.left,
      right: r.right + BLEED.right,
      bottom: r.bottom + BLEED.bottom
    };

    /* allocations_by_donor / military_allocations_by_donor keep their legend
       inside .chart-footer, so it occludes the chart just as the buttons do. */
    const footerLegend = root.querySelector('.chart-footer .bar-legend');
    if (footerLegend && footerLegend.offsetParent !== null) {
      const l = footerLegend.getBoundingClientRect();
      if (l.width) {
        box.top = Math.min(box.top, l.top);
        box.left = Math.min(box.left, l.left);
        box.right = Math.max(box.right, l.right);
        box.bottom = Math.max(box.bottom, l.bottom);
      }
    }
    return box;
  }

  /**
   * Can the buttons sit *beside* the legend's last row instead of below it?
   *
   * Only for a `.line-legend` — the flat, wrapping series legend that lives in
   * the card's flow. The by-donor cards keep their legend inside .chart-footer,
   * where responsive.css already wraps it onto its own line, and the remaining
   * cards end in a chart or a table, which has no hole to tuck into.
   *
   * Both tests are answers about the card's *width*: how the legend wraps, and
   * how much of the last row is left over. Neither depends on the reservation
   * this decides, so the decision settles on the first pass — the same property
   * the width-only rule in applyFooterBand() relies on.
   *
   * @param  {Element} anchor  the legend
   * @param  {Object}  occ     occluderBox()
   * @return {boolean}
   */
  function tuckIntoLegend(anchor, occ) {
    if (!anchor.classList || !anchor.classList.contains('line-legend')) return false;

    const rects = Array.prototype.map
      .call(anchor.children, el => el.getBoundingClientRect())
      .filter(r => r.width);
    if (rects.length < 2) return false;

    /* Rows by top edge. An unwrapped legend has exactly one, and its line is
       already as full as it is going to get — there is no hole to use. */
    const tops = rects.map(r => Math.round(r.top));
    const lastTop = Math.max.apply(null, tops);
    if (lastTop === Math.min.apply(null, tops)) return false;

    const lastRowRight = Math.max.apply(null, rects
      .filter((r, i) => tops[i] === lastTop)
      .map(r => r.right));

    /* occ.left, not the buttons' own left edge: the blurred backdrop bleeds
       40px further left, and a legend label ending under it reads as debris. */
    return lastRowRight + TUCK_CLEARANCE <= occ.left;
  }

  /**
   * Pixels the last applyFooterBand() left unreserved by tucking the buttons
   * into the legend's last row — subtract from the height the card asks its
   * embedder for, so the freed strip is not left blank under the buttons.
   *
   * @param  {Element} root
   * @return {number}
   */
  function footerShed(root) {
    return shed.get(root || document.getElementById('explorer-wrap')) || 0;
  }

  /**
   * Reserve space so the action buttons clear the content.
   * @param  {Element} root  the card wrapper (#explorer-wrap)
   * @param  {Object}  [opts]
   * @param  {boolean} [opts.reserve=true]  when false, measure the band and
   *         report it — so the card still asks its embedder for the same
   *         height — but leave the content column running all the way to the
   *         bottom edge. The weapons table uses this: its rows are meant to
   *         reach the bottom of the card and pass *under* the blurred
   *         backdrop, the way the buttons float over a chart.
   * @return {number}        pixels of band — add this to the suggested height
   */
  function applyFooterBand(root, opts) {
    root = root || document.getElementById('explorer-wrap');
    if (!root) return 0;

    const reserve = !(opts && opts.reserve === false);

    const footer = root.querySelector('.chart-footer');
    const anchor = footer && footer.previousElementSibling;
    if (!anchor) return 0;

    if (root.getBoundingClientRect().width >= WIDE_CARD) {
      anchor.style.marginBottom = '';
      shed.set(root, 0);
      return 0;
    }

    /* (1) measure from a clean slate */
    const previous = anchor.style.marginBottom;
    anchor.style.marginBottom = '0px';

    const occ = occluderBox(root);
    if (!occ) {
      anchor.style.marginBottom = reserve ? previous : '';
      shed.set(root, 0);
      return 0;
    }

    /* Discount whatever bottom padding the anchor already contributes — the
       legend carries 0.55rem of its own, which would otherwise sit on top of
       the reservation and read as a gap a whole legend line deep. */
    const ownPad = parseFloat(getComputedStyle(anchor).paddingBottom) || 0;

    /* On a narrow card the band is always reserved. Nothing about the chart
       is measured, deliberately.

       Every measured variant of this test oscillated, for the same reason
       each time: the pane is what gets reserved, and the chart redraws to
       fill the pane, so any question asked about where the chart's content
       sits is really a question about the answer given last time. Reserve →
       chart redraws shorter → "nothing collides any more" → un-reserve → the
       pane grows back, but the chart has already been drawn small → a
       shrunken chart floating in a half-empty panel. Which is exactly the
       symptom this was supposed to prevent.

       A card's width does not depend on its reservation, so deciding from
       width alone settles on the first pass. The cost is that a narrow card
       gives up the band even where its content would have cleared the
       buttons unaided; cards where that leaves more air than the design
       wants get a shorter aspect ratio instead (see allocations_by_region). */
    const needed = Math.max(0, Math.ceil(occ.bottom - occ.top + GAP - ownPad));

    anchor.style.marginBottom = (reserve && needed) ? needed + 'px' : '';
    return needed;
  }

  /**
   * Re-run `cb` whenever the card's contents change.
   *
   * The band is measured from rendered geometry, but the first measurement
   * runs before the CSV has arrived and the chart has drawn anything — so it
   * finds no axis labels, reserves nothing, and is never asked again because
   * the only trigger was a resize that never comes. Standalone, that left the
   * bottom row of labels sitting under the buttons.
   *
   * Watches childList only: applying the band sets an inline style, which is
   * an attribute change, so re-measuring cannot retrigger the observer.
   *
   * @param {Element}  root
   * @param {Function} cb
   */
  function watch(root, cb) {
    if (!root || typeof MutationObserver === 'undefined') return;
    let timer = null;
    new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(cb, 60);
    }).observe(root, { childList: true, subtree: true });
  }

  /**
   * Re-run `cb` when the pane the band is applied to changes size.
   *
   * Reserving the band resizes that pane but not the card, and the pages hang
   * their redraw off a ResizeObserver on the card — so the chart kept the
   * dimensions it was drawn at and its viewBox simply scaled the whole
   * drawing down into the smaller pane. On a phone that showed up as a chart
   * two thirds the size it should be, letterboxed inside its own panel.
   *
   * The first callback is skipped: that one is the observer's initial
   * delivery, not a change.
   *
   * @param {Element}  root
   * @param {Function} cb   the page's resize handler (redraws, then re-measures)
   */
  function observeAnchor(root, cb) {
    root = root || document.getElementById('explorer-wrap');
    const footer = root && root.querySelector('.chart-footer');
    const anchor = footer && footer.previousElementSibling;
    if (!anchor || typeof ResizeObserver === 'undefined') return;

    let first = true;
    new ResizeObserver(() => {
      if (first) { first = false; return; }
      cb();
    }).observe(anchor);
  }

  return {
    applyFooterBand: applyFooterBand,
    watch: watch,
    observeAnchor: observeAnchor
  };
})();
