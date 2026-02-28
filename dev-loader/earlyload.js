(async function () {
  var maxWait = 20000;
  var interval = 50;

  var elapsed = 0;
  while (!window.doli && elapsed < maxWait) {
    await new Promise(function (r) { setTimeout(r, interval); });
    elapsed += interval;
  }

  var doli = window.doli;
  if (!doli) {
    console.error('[DOLI DevLoader] earlyload: doli not found after ' + maxWait + 'ms');
    return;
  }

  try {
    await doli.init();
    console.log('[DOLI DevLoader] earlyload: init complete');
  } catch (e) {
    console.error('[DOLI DevLoader] earlyload init failed:', e);
  }
})();
