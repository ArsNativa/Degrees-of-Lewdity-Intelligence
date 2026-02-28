/**
 * Floating action button — toggles the assistant chat panel.
 */
import { CSS_PREFIX } from '../../utils/constants.js';
import { t } from '../../utils/i18n/index.js';

export class FloatButton {
  private el: HTMLButtonElement | null = null;
  private onClick: () => void;

  constructor(onClick: () => void) {
    this.onClick = onClick;
  }

  mount(): void {
    if (this.el) return;

    const btn = document.createElement('button');
    btn.className = `${CSS_PREFIX}float-btn`;
    btn.title = t('ui.float_btn_title');
    btn.setAttribute('aria-label', t('ui.float_btn_title'));

    const icon = document.createElement('img');
    icon.className = `${CSS_PREFIX}btn-icon-img`;
    icon.src = 'img/ui/sym_awareness.png';
    icon.alt = '';
    icon.setAttribute('aria-hidden', 'true');
    btn.appendChild(icon);

    btn.addEventListener('click', () => this.onClick());
    document.body.appendChild(btn);
    this.el = btn;
  }

  unmount(): void {
    this.el?.remove();
    this.el = null;
  }
}
