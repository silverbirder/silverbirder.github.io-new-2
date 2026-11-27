import {
  archiveMonthTarget,
  refreshArchiveMonthTargets,
  setArchiveMonthSearch,
} from './blog-month-nav';

type SearchMatch = { data: () => Promise<{ url: string }> };
type Pagefind = {
  options: (settings: { baseUrl: string }) => Promise<void>;
  filters: () => Promise<unknown>;
  search: (
    query: string,
    settings: { sort: { date: 'desc' } },
  ) => Promise<{ results: SearchMatch[]; filters: { month?: Record<string, number> } }>;
};

const resultPageSize = 8;

function setupFindDialogs() {
  for (const trigger of document.querySelectorAll<HTMLButtonElement>('[data-open-find-dialog]')) {
    const id = trigger.getAttribute('aria-controls');
    const dialog = id && document.getElementById(id);
    if (!(dialog instanceof HTMLDialogElement)) continue;

    trigger.addEventListener('click', () => {
      dialog.showModal();
      dialog.querySelector('input')?.focus();
      dialog.querySelector('[data-active-tag]')?.scrollIntoView({ block: 'nearest' });
    });

    const mobile = window.matchMedia('(width <= 48rem)');
    mobile.addEventListener('change', ({ matches }) => {
      if (!matches && dialog.open) dialog.close();
    });
  }
}

function updateYears(years: NodeListOf<HTMLElement>) {
  for (const year of years) year.hidden = !year.querySelector('.archive-entry:not([hidden])');
}

function monthOffsets(counts: Record<string, number> = {}) {
  let offset = 0;
  const months = new Map<string, number>();
  for (const [month, count] of Object.entries(counts).toSorted(([left], [right]) =>
    right.localeCompare(left),
  )) {
    if (count === 0) continue;
    months.set(month, offset);
    offset += count;
  }
  return months;
}

function getSearchElements(status: HTMLElement) {
  const archive = status.closest<HTMLElement>('.blog-archive');
  const base = status.dataset.siteBase;
  if (!archive || !base) return;
  const entries = archive.querySelector<HTMLElement>('.archive-entries');
  const forms = archive.querySelectorAll<HTMLFormElement>('[data-blog-search]');
  const tail = entries?.querySelector<HTMLElement>('[data-search-tail]');
  const filterDisplays = [...archive.querySelectorAll<HTMLElement>('[data-active-search]')].flatMap(
    (filter) => {
      const label = filter.querySelector<HTMLElement>('.archive-current-filter-label');
      const clear = filter.querySelector('a');
      return label && clear ? [{ filter, label, clear }] : [];
    },
  );
  if (!entries || !tail) return;
  return { entries, forms, tail, base, filterDisplays };
}

const termFromUrl = () => new URL(location.href).searchParams.get('q')?.trim() ?? '';

function setupSearch(status: HTMLElement) {
  const elements = getSearchElements(status);
  if (!elements) return;
  const { entries, forms, tail, base, filterDisplays } = elements;

  const report = (message: string, announcementOnly = false) => {
    status.toggleAttribute('data-announcement-only', announcementOnly);
    status.textContent = message;
  };

  let pagefind: Promise<Pagefind> | undefined;
  let matches: SearchMatch[] = [];
  let request = 0;
  let shown = 0;
  let selectedMonth = '';
  const years = entries.querySelectorAll<HTMLElement>('.archive-year');
  const rows = new Map(
    [...entries.querySelectorAll<HTMLAnchorElement>('.archive-entry-link')].map((link) => [
      link.pathname,
      link.closest('li'),
    ]),
  );

  async function loadSearchEngine() {
    try {
      const module: Pagefind = await import(/* @vite-ignore */ `${base}pagefind/pagefind.js`);
      await module.options({ baseUrl: base });
      await module.filters();
      return module;
    } catch (error) {
      pagefind = undefined;
      throw error;
    }
  }

  const showNext = async (current: number, end = shown + resultPageSize) => {
    const start = shown;
    observer.unobserve(tail);
    tail.hidden = true;
    const found = await Promise.all(matches.slice(start, end).map((match) => match.data()));
    if (current !== request) return;
    for (const { url } of found) {
      const row = rows.get(new URL(url, location.href).pathname);
      if (row) row.hidden = false;
    }
    updateYears(years);
    shown = Math.max(shown, start + found.length);
    refreshArchiveMonthTargets();
    if (shown < matches.length) {
      tail.hidden = false;
      observer.observe(tail);
    }
  };

  const selectMonth = async (month: string, offsets: Map<string, number>, current: number) => {
    const offset = offsets.get(month);
    if (offset === undefined) return;
    selectedMonth = month;
    try {
      if (offset >= shown) await showNext(current, offset + resultPageSize);
      if (current !== request || selectedMonth !== month) return;
      const target = archiveMonthTarget(month);
      if (!target) return;
      history.replaceState(null, '', `#month-${month}`);
      target.scrollIntoView({ block: 'start' });
      target.querySelector('a')?.focus({ preventScroll: true });
    } catch {
      if (current === request) report('選んだ月の記事を読み込めませんでした。');
    }
  };

  function updateSearchMonths(filters: Record<string, number> | undefined, current: number) {
    const offsets = monthOffsets(filters);
    const select = (month: string) => void selectMonth(month, offsets, current);
    setArchiveMonthSearch({ months: new Set(offsets.keys()), select });
    const requested = location.hash.slice('#month-'.length);
    if (location.hash.startsWith('#month-') && offsets.has(requested)) select(requested);
  }

  const resetSearch = (term: string) => {
    const active = term.length > 0;
    for (const { filter, label } of filterDisplays) {
      filter.hidden = !active;
      label.textContent = term;
      label.title = term;
    }
    matches = [];
    shown = 0;
    rows.forEach((row) => {
      if (row) row.hidden = active;
    });
    updateYears(years);
    observer.unobserve(tail);
    tail.hidden = true;
    setArchiveMonthSearch(active ? { months: new Set(), select: () => {} } : undefined);
    for (const form of forms) {
      const input = form.elements.namedItem('q');
      if (input instanceof HTMLInputElement) input.value = term;
    }
    return active;
  };

  const search = async (term: string) => {
    const current = ++request;
    const active = resetSearch(term);
    if (!active) {
      report('');
      return;
    }

    report('検索中…');
    try {
      pagefind ??= loadSearchEngine();
      const module = await pagefind;
      const { results, filters } = await module.search(term, { sort: { date: 'desc' } });
      if (current !== request) return;
      matches = results;
      await showNext(current);
      if (current === request) {
        updateSearchMonths(filters.month, current);
        report(
          results.length ? `検索結果は${results.length}件です。` : '該当する記事はありません。',
          results.length > 0,
        );
      }
    } catch {
      if (current === request) {
        report('検索結果を読み込めませんでした。もう一度お試しください。');
      }
    }
  };

  const goTo = (term: string) => {
    const url = new URL(location.href);
    url.hash = '';
    if (term) url.searchParams.set('q', term);
    else url.searchParams.delete('q');
    if (url.href !== location.href) history.pushState(null, '', url);
    void search(term);
    window.scrollTo({ top: 0 });
  };

  for (const form of forms) {
    const input = form.elements.namedItem('q');
    if (!(input instanceof HTMLInputElement)) continue;

    input.addEventListener('input', () => {
      if (!input.value.trim() && termFromUrl()) goTo('');
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      form.closest('dialog')?.close();
      goTo(input.value.trim());
    });
  }
  for (const { filter, clear } of filterDisplays) {
    clear.addEventListener('click', (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      goTo('');
      filter.parentElement
        ?.querySelector<HTMLElement>(
          '[aria-controls="archive-search-dialog"], input[type="search"]',
        )
        ?.focus({ preventScroll: true });
    });
  }

  const observer = new IntersectionObserver(
    (intersections) => {
      if (tail.hidden || !intersections.some((entry) => entry.isIntersecting)) return;
      const current = request;
      void showNext(current).catch(() => {
        if (current === request) {
          report('続きを読み込めませんでした。もう一度検索してください。');
        }
      });
    },
    { rootMargin: '240px 0px' },
  );

  window.addEventListener('popstate', () => void search(termFromUrl()));
  if (termFromUrl()) void search(termFromUrl());
}

setupFindDialogs();
const status = document.querySelector<HTMLElement>('[data-search-status]');
if (status) setupSearch(status);
