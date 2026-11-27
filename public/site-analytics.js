(() => {
  const config = document.currentScript?.dataset;
  if (!config || location.origin !== config.analyticsOrigin) return;

  function loadTag(src) {
    const tag = document.createElement('script');
    tag.async = true;
    tag.src = src;
    document.head.append(tag);
  }

  if (config.gaId) {
    const dataLayer = (window.dataLayer ??= []);
    window.gtag ??= function gtag() {
      dataLayer.push(arguments);
    };
    window.gtag('js', new Date());
    window.gtag('config', config.gaId);
    loadTag('https://www.googletagmanager.com/gtag/js?id=' + config.gaId);
  }

  if (config.clarityId) {
    const queue = [];
    window.clarity ??= Object.assign(
      function clarity() {
        queue.push(arguments);
      },
      { q: queue },
    );
    loadTag('https://www.clarity.ms/tag/' + config.clarityId);
  }
})();
