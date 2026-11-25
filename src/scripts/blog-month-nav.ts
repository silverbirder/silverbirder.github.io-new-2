function setupMonthNavigation() {
  const monthNav = document.querySelector('[data-month-nav]');
  const track = monthNav?.querySelector<HTMLOListElement>('[data-month-track]');
  if (!track) return;

  const slotCount = Number(track.dataset.monthTrack);
  const months = Array.from(track.querySelectorAll('a')).flatMap((link) => {
    const target = document.getElementById(link.hash.slice(1));
    return target ? [{ link, target, slot: Number(link.dataset.monthSlot) }] : [];
  });
  const first = months[0];
  if (!first) return;

  let current = first.link;
  let animation = 0;
  const updateMonth = () => {
    animation = 0;
    const scrollMargin = Number.parseFloat(
      window.getComputedStyle(first.target).scrollMarginBlockStart,
    );
    const scrollPadding =
      Number.parseFloat(
        window.getComputedStyle(document.documentElement).scrollPaddingBlockStart,
      ) || 0;
    const end = document.documentElement.scrollHeight - window.innerHeight;
    const atEnd = end > 0 && window.scrollY >= end - 1;
    const visible = atEnd
      ? months.at(-1)
      : months.findLast(
          ({ target }) => target.getBoundingClientRect().top <= scrollPadding + scrollMargin + 1,
        );
    const next = visible?.link ?? first.link;
    if (next === current) return;

    current.removeAttribute('aria-current');
    next.setAttribute('aria-current', 'location');
    current = next;
  };

  const scheduleUpdate = () => {
    if (!animation) animation = requestAnimationFrame(updateMonth);
  };
  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate);
  window.addEventListener('pageshow', scheduleUpdate);
  scheduleUpdate();

  let dragStart: { id: number; y: number } | undefined;
  let lastTarget: HTMLElement | undefined;

  track.addEventListener('pointerdown', (event) => {
    if (event.isPrimary && event.button === 0) {
      dragStart = { id: event.pointerId, y: event.clientY };
      lastTarget = undefined;
    }
  });

  track.addEventListener('pointermove', (event) => {
    if (dragStart?.id !== event.pointerId || event.buttons === 0) return;
    if (!track.hasPointerCapture(event.pointerId)) {
      if (Math.abs(event.clientY - dragStart.y) < 5) return;
      track.setPointerCapture(event.pointerId);
    }

    const { top, height } = track.getBoundingClientRect();
    const slot = ((event.clientY - top) / height) * slotCount + 0.5;
    const closest = months.reduce((nearest, month) =>
      Math.abs(month.slot - slot) < Math.abs(nearest.slot - slot) ? month : nearest,
    );
    if (closest.target === lastTarget) return;
    closest.target.scrollIntoView({ block: 'start' });
    lastTarget = closest.target;
  });

  const stopDragging = () => {
    dragStart = undefined;
  };
  track.addEventListener('pointerup', stopDragging);
  track.addEventListener('pointercancel', stopDragging);
  track.addEventListener('lostpointercapture', (event) => {
    if (event.target === track) stopDragging();
  });
}

function setupMonthDialog() {
  const dialog = document.querySelector<HTMLDialogElement>('#archive-month-dialog');
  const trigger = document.querySelector('[data-open-month-dialog]');
  if (!dialog || !trigger) return;
  const choices = Array.from(dialog.querySelectorAll('a'));

  trigger.addEventListener('click', () => {
    const current = document.querySelector<HTMLAnchorElement>(
      "[data-month-nav] a[aria-current='location']",
    );
    const choice = choices.find((link) => link.hash === current?.hash);
    dialog.querySelector('[aria-current]')?.removeAttribute('aria-current');
    choice?.setAttribute('aria-current', 'location');
    dialog.showModal();
    choice?.scrollIntoView({ block: 'nearest' });
  });

  dialog.addEventListener('click', (event) => {
    if (!(event.target instanceof HTMLAnchorElement)) return;
    const { hash } = event.target;
    const target = document.getElementById(hash.slice(1));
    if (!target) return;

    event.preventDefault();
    dialog.close();
    window.location.hash = hash;
    target.scrollIntoView({ block: 'start' });
    target.querySelector('a')?.focus({ preventScroll: true });
  });
}

setupMonthNavigation();
setupMonthDialog();
