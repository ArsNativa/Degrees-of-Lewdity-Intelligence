/**
 * earlyload phase — async, before mod data is merged into the game.
 *
 * Calls doli.init() which loads settings from IndexedDB
 * and performs network environment checks.
 */
(async () => {
  const doli = (window as any).doli;
  if (!doli) {
    console.error('[DOLI] earlyload: doli not found on window');
    return;
  }
  try {
    await doli.init();
  } catch (e) {
    console.error('[DOLI] earlyload init failed:', e);
  }
})();
