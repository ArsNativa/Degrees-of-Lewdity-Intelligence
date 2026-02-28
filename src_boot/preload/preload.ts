/**
 * preload phase — after mod data merge, before SC2 engine starts.
 *
 * Registers a `:storyready` listener that attaches the assistant UI
 * once the game engine is fully operational.
 */
(() => {
  const doli = (window as any).doli;
  if (!doli) {
    console.error('[DOLI] preload: doli not found on window');
    return;
  }

  $(document).one(':storyready', () => {
    try {
      doli.attach();
    } catch (e) {
      console.error('[DOLI] storyready attach failed:', e);
    }
  });
})();
