// Keep native text selection, keyboard navigation and clipboard behavior.
// Only replace the painted background, whose native height follows font metrics.
for (const body of document.querySelectorAll<HTMLElement>('.notebook-body')) {
  const layer = document.createElement('div');
  layer.dataset.selectionLayer = '';
  layer.setAttribute('aria-hidden', 'true');
  body.append(layer);
  let frame = 0;

  const paint = () => {
    frame = 0;
    layer.replaceChildren();
    body.classList.remove('has-grid-selection');
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const style = getComputedStyle(body);
    const unit = parseFloat(style.lineHeight);
    const bounds = body.getBoundingClientRect();
    const padding = parseFloat(style.paddingTop);
    // The SVG rule is centered at 13.25 / 26 of its tile height.
    const firstRule = bounds.top + padding + parseFloat(style.backgroundPositionY)
      + unit * 13.25 / 26;
    const rows = new Map<number, { left: number; right: number }[]>();

    for (let i = 0; i < selection.rangeCount; i++) {
      const selected = selection.getRangeAt(i);
      if (!selected.intersectsNode(body)) continue;
      const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        if (layer.contains(node) || !node.textContent?.trim() || !selected.intersectsNode(node)) continue;
        const textRange = document.createRange();
        textRange.selectNodeContents(node);
        if (selected.startContainer === node) textRange.setStart(node, selected.startOffset);
        if (selected.endContainer === node) textRange.setEnd(node, selected.endOffset);
        if (textRange.collapsed) continue;
        for (const rect of textRange.getClientRects()) {
          if (rect.width < 0.1 || rect.height < 0.1) continue;
          const row = Math.round((rect.bottom - firstRule) / unit);
          const segments = rows.get(row) ?? [];
          segments.push({ left: rect.left - bounds.left, right: rect.right - bounds.left });
          rows.set(row, segments);
        }
      }
    }

    const fragment = document.createDocumentFragment();
    for (const [row, segments] of rows) {
      segments.sort((a, b) => a.left - b.left);
      const merged: typeof segments = [];
      for (const segment of segments) {
        const last = merged.at(-1);
        if (last && segment.left <= last.right + 0.5) last.right = Math.max(last.right, segment.right);
        else merged.push({ ...segment });
      }
      for (const { left, right } of merged) {
        const band = document.createElement('span');
        band.style.cssText = `left:${left}px;top:${firstRule - bounds.top + (row - 1) * unit}px;width:${right - left}px;height:${unit}px`;
        fragment.append(band);
      }
    }
    if (fragment.childElementCount) {
      layer.append(fragment);
      body.classList.add('has-grid-selection');
    }
  };

  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(paint);
  };
  document.addEventListener('selectionchange', schedule);
  window.addEventListener('resize', schedule, { passive: true });
  new ResizeObserver(schedule).observe(body);
  document.fonts.ready.then(schedule);
}
