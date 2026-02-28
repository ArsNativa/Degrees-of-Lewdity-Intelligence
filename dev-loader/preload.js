(function () {
  var maxWait = 20000;
  var interval = 50;

  async function waitForDOLI() {
    var elapsed = 0;
    while (!window.doli && elapsed < maxWait) {
      await new Promise(function (r) { setTimeout(r, interval); });
      elapsed += interval;
    }
    return window.doli || null;
  }

  $(document).one(':storyready', async function () {
    var doli = await waitForDOLI();
    if (!doli) {
      console.error('[DOLI DevLoader] preload: doli not found after ' + maxWait + 'ms');
      return;
    }

    try {
      doli.attach();
      console.log('[DOLI DevLoader] preload: attach complete');
    } catch (e) {
      console.error('[DOLI DevLoader] preload attach failed:', e);
    }
  });
})();
