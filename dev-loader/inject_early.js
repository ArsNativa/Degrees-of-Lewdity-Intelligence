(function () {
  var src = '/__dev__/DOLI.js?ts=' + Date.now();
  var script = document.createElement('script');
  script.src = src;
  script.async = false;
  script.onerror = function () {
    console.error('[DOLI DevLoader] inject_early: failed to load bundle', src);
  };
  (document.head || document.documentElement).appendChild(script);
  console.log('[DOLI DevLoader] inject_early: script tag injected', src);
})();
