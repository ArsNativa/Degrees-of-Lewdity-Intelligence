/**
 * Markdown rendering utility — two-phase strategy.
 *
 * Phase 1 (streaming): plain textContent, throttled via requestAnimationFrame.
 * Phase 2 (complete):  full marked.parse → DOMPurify.sanitize → innerHTML.
 *
 * @module utils/markdown
 */
import { marked } from 'marked';
import DOMPurify from 'dompurify';

// ── marked configuration ─────────────────────────────────────

marked.setOptions({
  gfm: true,
  breaks: true,      // Convert single \n to <br> — matches chat UX expectations
});

// ── Public API ───────────────────────────────────────────────

/**
 * Render a complete Markdown string to sanitised HTML.
 * Used in Phase 2 (completion) and history replay.
 */
export function renderMarkdown(text: string): string {
  if (!text) return '';
  const raw = marked.parse(text) as string;
  return DOMPurify.sanitize(raw);
}

/**
 * A RAF-throttled writer that sets `el.textContent` at most once per frame.
 *
 * Call `update()` on every token; the actual DOM write is deferred to the
 * next animation frame, collapsing rapid successive calls into one.
 *
 * Call `flush()` to force a synchronous write (e.g. before switching to
 * Phase 2 rendering).
 */
export class StreamThrottle {
  private el: HTMLElement;
  private pending = false;
  private rafId = 0;
  private latestText = '';

  constructor(el: HTMLElement) {
    this.el = el;
  }

  /** Queue a textContent update (RAF-throttled). */
  update(text: string): void {
    this.latestText = text;
    if (!this.pending) {
      this.pending = true;
      this.rafId = requestAnimationFrame(() => {
        this.el.textContent = this.latestText;
        this.pending = false;
      });
    }
  }

  /** Cancel any pending RAF and force-write now. */
  flush(): void {
    if (this.pending) {
      cancelAnimationFrame(this.rafId);
      this.pending = false;
    }
    this.el.textContent = this.latestText;
  }

  /** Cancel pending RAF without writing. */
  cancel(): void {
    if (this.pending) {
      cancelAnimationFrame(this.rafId);
      this.pending = false;
    }
  }
}
