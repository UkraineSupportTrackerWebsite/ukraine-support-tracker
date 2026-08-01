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

  /* ══════════════════════════════════════════════════════════════════
     THE KIEL LOGO IN AN EXPORTED CARD

     The header logo is the one image in the card that is not already a
     raster. Every chart SVG is rasterized to a PNG before capture
     (svgToPngImage in the pages); the logo used to be a straight clone of
     the live <img src="Kiel Institut Logo.svg"> with width:100%;height:auto,
     handed to html2canvas as an SVG.

     WebKit does not resolve that the way Blink does. An SVG image whose
     height is `auto` inside a box html2canvas has measured itself comes out
     cropped and mis-scaled — on an iPhone the logo rendered as two orange
     rectangles. It is not worth chasing which of the two is "right": the
     fix is to not give html2canvas an SVG at all.

     So the logo is rasterized here, once per page load, at a fixed pixel
     width with the destination size passed explicitly to drawImage, and the
     card gets a PNG <img> with both width and height in px. That path is
     identical in every engine.
  ══════════════════════════════════════════════════════════════════ */

  /* Wide enough for the largest use (260 CSS px) at pixelRatio 2, with room
     to spare — the logo is a few kB of paths, so oversampling costs nothing. */
  const LOGO_RASTER_WIDTH = 1200;

  /* Intrinsic size of Kiel Institut Logo.svg, used only if an engine reports
     naturalWidth/naturalHeight of 0 for an SVG image. */
  const LOGO_RATIO = 634.53 / 1818.02;

  let logoRaster = null;   // Promise<{url, ratio}>, resolved once and reused

  function rasterizeLogo(src) {
    if (logoRaster) return logoRaster;
    logoRaster = new Promise(function (resolve, reject) {
      const img = new Image();
      img.onload = function () {
        const ratio = (img.naturalWidth && img.naturalHeight)
          ? img.naturalHeight / img.naturalWidth
          : LOGO_RATIO;
        const w = LOGO_RASTER_WIDTH;
        const h = Math.round(w * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        /* Explicit destination width and height: the whole point. Nothing is
           left for the engine to infer from an intrinsic ratio. */
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        /* Throws if the canvas is tainted — opening the page over file://
           taints it, so the caller keeps the SVG in that case. */
        resolve({ url: canvas.toDataURL('image/png'), ratio: ratio });
      };
      img.onerror = reject;
      img.src = src;
    });
    /* A failure must not be cached as a permanent one: a later export gets a
       fresh attempt rather than inheriting a rejected promise. */
    logoRaster.catch(function () { logoRaster = null; });
    return logoRaster;
  }

  /**
   * An <img> of the Kiel logo for an export card, sized in explicit px.
   *
   * @param {HTMLImageElement} liveImg  the page's own .kiel-logo img
   * @param {Object} box  {width} or {height} in export px — the other side
   *        is derived from the logo's aspect ratio.
   * @returns {Promise<HTMLImageElement>} already loaded, ready to append
   */
  async function logoElement(liveImg, box) {
    let url   = liveImg.src;
    let ratio = LOGO_RATIO;
    try {
      const png = await rasterizeLogo(liveImg.src);
      url   = png.url;
      ratio = png.ratio;
    } catch (e) {
      /* Rasterizing failed (file://, or the SVG did not load). Fall back to
         the SVG — but still with both dimensions set explicitly, which is
         the part WebKit actually needs. */
    }
    const w = box.width  != null ? box.width  : Math.round(box.height / ratio);
    const h = box.height != null ? box.height : Math.round(box.width  * ratio);

    const img = document.createElement('img');
    img.alt = liveImg.alt || '';
    img.style.cssText = 'width:' + w + 'px;height:' + h + 'px;display:block;';
    img.src = url;
    /* html2canvas skips images that are not complete when it walks the tree. */
    try { await img.decode(); } catch (e) {}
    return img;
  }

  /* ══════════════════════════════════════════════════════════════════
     PUTTING THE PNG WHERE THE READER ASKED FOR IT

     WebKit only lets a page write to the clipboard while the tap that asked
     for it is still the current task. Building the image takes seconds —
     two layout passes off-screen, html2canvas, then toBlob — so by the time
     the old code reached navigator.clipboard.write() the user activation was
     long gone and WebKit threw NotAllowedError. Every "copy chart as image"
     failed on an actual iPhone.

     It did not fail in Chrome's device-emulation view on a Mac, because that
     is still Chrome's clipboard implementation and Chrome does not enforce
     this. Phone-view testing cannot catch this class of bug.

     The supported way to do slow work and still write to the clipboard is to
     hand ClipboardItem a *Promise* for the blob and call write() immediately,
     with no await in between. WebKit then holds the activation open until the
     promise settles. That is what deliverPng does, so it must be called
     directly from the click handler — awaiting anything before it puts the
     bug straight back.
  ══════════════════════════════════════════════════════════════════ */

  /** canvas.toBlob as a promise. Pages use this to end their capture. */
  function canvasToBlob(canvas, type) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (blob) resolve(blob);
        else reject(new Error('toBlob failed'));
      }, type || 'image/png');
    });
  }

  /**
   * Copy the captured PNG to the clipboard, or save it if that is refused.
   *
   * MUST be called synchronously from the click handler — see above.
   *
   * @param {Function} makeBlob  starts the capture, returns Promise<Blob>.
   *        Called once; both delivery paths share the one result.
   * @param {Object} opts
   *        fileStem  {string}   download name, without .png
   *        onStatus  {Function} shows a toast
   *        copied/saved/failed {string} the three messages
   */
  function deliverPng(makeBlob, opts) {
    opts = opts || {};
    const status = opts.onStatus || function () {};
    const de     = document.documentElement.lang === 'de';
    const copied = opts.copied || (de ? 'Bild kopiert!' : 'Image copied!');
    const saved  = opts.saved  || (de ? 'Bild gespeichert!' : 'Image saved!');
    const failed = opts.failed || (de ? 'Bild konnte nicht kopiert werden'
                                      : 'Could not copy image');

    let blobPromise;
    try { blobPromise = Promise.resolve(makeBlob()); }
    catch (e) { blobPromise = Promise.reject(e); }

    /* The blob promise is consumed twice at most and may be handed to
       ClipboardItem, which reports its own failure. This handle keeps a
       capture error from also surfacing as an unhandled rejection. */
    blobPromise.catch(function () {});

    function save() {
      return blobPromise.then(function (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = (opts.fileStem || 'chart') + '.png';
        a.rel = 'noopener';
        /* iOS Safari ignores the download attribute and opens the PNG in its
           previewer instead, with a share button — different from a desktop
           download, but it does get the reader the image. */
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        /* Not revoked synchronously: WebKit reads the blob URL after click()
           returns, and pulling it out from under the download cancels it. */
        setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
        status(saved);
      });
    }

    const canClipboard = !!(window.ClipboardItem &&
                            navigator.clipboard &&
                            navigator.clipboard.write);
    if (!canClipboard) {
      return save().catch(function () { status(failed); });
    }

    /* No await before this line. */
    return navigator.clipboard
      .write([new ClipboardItem({ 'image/png': blobPromise })])
      .then(function () { status(copied); })
      .catch(function () {
        return save().catch(function () { status(failed); });
      });
  }

  return {
    DESKTOP: DESKTOP,
    withDesktopLayout: withDesktopLayout,
    isExporting: isExporting,
    logoElement: logoElement,
    canvasToBlob: canvasToBlob,
    deliverPng: deliverPng
  };
})();
