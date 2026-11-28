type MonthSearch = {
  months: ReadonlySet<string>;
  select: (month: string) => void;
};

let monthSearch: MonthSearch | undefined;
const monthFromLink = (link: HTMLAnchorElement) => link.hash.slice('#month-'.length);
const monthsChanged = 'archive-months-changed';
const loadedMonths = new Map<string, HTMLElement>();

export function archiveMonthTarget(month: string) {
  return monthSearch ? loadedMonths.get(month) : document.getElementById(`month-${month}`);
}

export function refreshArchiveMonthTargets() {
  loadedMonths.clear();
  if (monthSearch) {
    for (const row of document.querySelectorAll<HTMLElement>(
      '[data-archive-month]:not([hidden])',
    )) {
      const month = row.dataset.archiveMonth;
      if (month && !loadedMonths.has(month)) loadedMonths.set(month, row);
    }
  }
  window.dispatchEvent(new Event(monthsChanged));
}

function setDialogMonths(search?: MonthSearch) {
  for (const section of document.querySelectorAll<HTMLElement>('[data-month-dialog-year]')) {
    for (const link of section.querySelectorAll('a')) {
      link
        .closest('li')
        ?.toggleAttribute('hidden', !!search && !search.months.has(monthFromLink(link)));
    }
    section.hidden = !section.querySelector('li:not([hidden])');
  }
}

export function setArchiveMonthSearch(search?: MonthSearch) {
  monthSearch = search;
  const nav = document.querySelector<HTMLElement>('[data-month-nav]');
  const trigger = document.querySelector<HTMLButtonElement>('[data-open-month-dialog]');
  const empty = search?.months.size === 0;
  if (nav) nav.hidden = empty;
  if (trigger) trigger.hidden = empty;

  let previousYear = '';
  for (const link of document.querySelectorAll<HTMLAnchorElement>('[data-month-nav] a')) {
    const month = monthFromLink(link);
    const visible = !search || search.months.has(month);
    link.closest('li')?.toggleAttribute('hidden', !visible);
    if (!visible) continue;
    const year = month.slice(0, 4);
    link.classList.toggle('month-nav-year', year !== previousYear);
    previousYear = year;
  }

  setDialogMonths(search);
  refreshArchiveMonthTargets();
}

function setupTagMonthPreview(track: HTMLOListElement, links: readonly HTMLAnchorElement[]) {
  const tags = document.querySelectorAll<HTMLAnchorElement>(
    '#archive-tags-panel [data-tag-months]',
  );
  let hovered: HTMLAnchorElement | undefined;
  let focused: HTMLAnchorElement | undefined;

  const update = () => {
    const tag = hovered ?? focused;
    const months = new Set(tag?.dataset.tagMonths?.split(' '));
    track.toggleAttribute('data-tag-preview-active', !!tag);
    for (const link of links) {
      link.toggleAttribute('data-tag-preview', months.has(monthFromLink(link)));
    }
  };

  for (const tag of tags) {
    tag.addEventListener('pointerenter', ({ pointerType }) => {
      if (pointerType === 'touch') return;
      hovered = tag;
      update();
    });
    tag.addEventListener('pointerleave', () => {
      if (hovered !== tag) return;
      hovered = undefined;
      update();
    });
    tag.addEventListener('focus', () => {
      if (!tag.matches(':focus-visible')) return;
      focused = tag;
      update();
    });
    tag.addEventListener('blur', () => {
      if (focused !== tag) return;
      focused = undefined;
      update();
    });
  }
}

function setupMonthNavigation() {
  const track = document.querySelector<HTMLOListElement>('[data-month-track]');
  const yearHeading = document.querySelector('[data-archive-current-year]');
  if (!track || !yearHeading) return;

  const slotCount = Number(track.dataset.monthTrack);
  const links = [...track.querySelectorAll<HTMLAnchorElement>('a')];
  setupTagMonthPreview(track, links);
  const getMonths = () =>
    links.flatMap((link) => {
      if (link.closest('li')?.hidden) return [];
      const target = archiveMonthTarget(monthFromLink(link));
      return target ? [{ link, target, slot: Number(link.dataset.monthSlot) }] : [];
    });

  let current: HTMLAnchorElement | undefined = links[0];
  let animation = 0;
  const updateMonth = () => {
    animation = 0;
    const months = getMonths();
    const first = months[0];
    if (!first) {
      current?.removeAttribute('aria-current');
      current = undefined;
      return;
    }
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

    current?.removeAttribute('aria-current');
    next.setAttribute('aria-current', 'location');
    yearHeading.textContent = `${monthFromLink(next).slice(0, 4)}年`;
    current = next;
  };

  const scheduleUpdate = () => {
    if (!animation) animation = requestAnimationFrame(updateMonth);
  };
  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate);
  window.addEventListener('pageshow', scheduleUpdate);
  window.addEventListener(monthsChanged, scheduleUpdate);
  scheduleUpdate();

  track.addEventListener('click', (event) => {
    const link = event.target instanceof Element ? event.target.closest('a') : null;
    if (!link || !monthSearch) return;
    event.preventDefault();
    monthSearch.select(monthFromLink(link));
  });

  let dragStart: { id: number; y: number } | undefined;
  let lastTarget: HTMLElement | undefined;

  track.addEventListener('pointerdown', (event) => {
    if (!monthSearch && event.isPrimary && event.button === 0) {
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

    const months = getMonths();
    const first = months[0];
    if (!first) return;
    const { top, height } = track.getBoundingClientRect();
    const slot = ((event.clientY - top) / height) * slotCount + 0.5;
    const closest = months.reduce(
      (nearest, month) =>
        Math.abs(month.slot - slot) < Math.abs(nearest.slot - slot) ? month : nearest,
      first,
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
  const choices = [...dialog.querySelectorAll('a')];

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
    const link = event.target;
    const month = monthFromLink(link);
    if (monthSearch) {
      event.preventDefault();
      dialog.close();
      monthSearch.select(month);
      return;
    }

    const target = archiveMonthTarget(month);
    if (!target) return;
    event.preventDefault();
    dialog.close();
    window.location.hash = link.hash;
    target.scrollIntoView({ block: 'start' });
    target.querySelector('a')?.focus({ preventScroll: true });
  });
}

setupMonthNavigation();
setupMonthDialog();
