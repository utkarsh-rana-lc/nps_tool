import type { NpsConfig } from './types.js';

const PRODUCT_LABEL: Record<string, string> = {
  crm: 'LimeChat CRM',
  marketing: 'LimeChat Marketing',
  bot: 'LimeChat Bot',
};

export interface UiCallbacks {
  onScore: (score: number, reason: string) => void;
  onClose: () => void;
}

/**
 * Renders the NPS pop-up inside a Shadow DOM so host-page CSS can never
 * interfere. Two steps: pick a 0–10 score, then give a reason.
 */
export function renderWidget(cfg: NpsConfig, cb: UiCallbacks): { destroy: () => void } {
  const accent = cfg.accentColor ?? '#1fa97a';
  const position = cfg.position ?? 'bottom-right';

  const host = document.createElement('div');
  host.setAttribute('data-limechat-nps', '');
  document.body.appendChild(host);
  const root = host.attachShadow({ mode: 'open' });

  const posCss =
    position === 'center'
      ? 'left:50%;bottom:auto;top:50%;transform:translate(-50%,-50%);'
      : position === 'bottom-left'
        ? 'left:24px;right:auto;'
        : 'right:24px;';

  root.innerHTML = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
      .card {
        position: fixed; bottom: 24px; ${posCss}
        width: 360px; max-width: calc(100vw - 32px);
        background: #fff; border-radius: 16px;
        box-shadow: 0 12px 40px rgba(0,0,0,.18);
        padding: 20px; z-index: 2147483647;
        animation: pop .25s ease;
      }
      @keyframes pop { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; } }
      .center .card { animation: none; }
      .close { position: absolute; top: 12px; right: 12px; border: 0; background: transparent;
        font-size: 20px; line-height: 1; color: #98a2b3; cursor: pointer; }
      h3 { margin: 0 8px 14px 0; font-size: 15px; font-weight: 600; color: #1a2b3b; }
      .scale { display: grid; grid-template-columns: repeat(11, 1fr); gap: 4px; }
      .scale button {
        aspect-ratio: 1; border: 1px solid #e4e7ec; border-radius: 7px; background: #fff;
        font-size: 13px; color: #475467; cursor: pointer; transition: transform .08s, background .12s;
      }
      .scale button:hover { transform: translateY(-2px); }
      .scale button.sel { color: #fff; font-weight: 600; }
      .legend { display: flex; justify-content: space-between; font-size: 11px; color: #98a2b3; margin-top: 8px; }
      .reason { margin-top: 14px; }
      textarea {
        width: 100%; min-height: 72px; resize: vertical; border: 1px solid #e4e7ec;
        border-radius: 10px; padding: 10px; font-size: 13px; color: #1a2b3b;
      }
      textarea:focus { outline: none; border-color: ${accent}; }
      .actions { display: flex; justify-content: flex-end; margin-top: 12px; }
      .submit {
        border: 0; border-radius: 10px; padding: 9px 18px; font-size: 13px; font-weight: 600;
        color: #fff; background: ${accent}; cursor: pointer;
      }
      .submit:disabled { opacity: .5; cursor: not-allowed; }
      .thanks { text-align: center; padding: 8px 0; }
      .thanks .tick { font-size: 34px; }
      .thanks p { margin: 8px 0 0; font-size: 14px; color: #1a2b3b; }
      .hidden { display: none; }
    </style>
    <div class="wrap ${position === 'center' ? 'center' : ''}">
      <div class="card">
        <button class="close" aria-label="Close">×</button>
        <div class="step-score">
          <h3>How likely are you to recommend ${PRODUCT_LABEL[cfg.product] ?? 'LimeChat'} to a friend or colleague?</h3>
          <div class="scale"></div>
          <div class="legend"><span>Not likely</span><span>Very likely</span></div>
        </div>
        <div class="step-reason reason hidden">
          <h3>What's the most important reason for your score?</h3>
          <textarea placeholder="Tell us a little more…"></textarea>
          <div class="actions"><button class="submit">Submit</button></div>
        </div>
        <div class="step-thanks thanks hidden">
          <div class="tick">🙏</div>
          <p>Thank you — your feedback helps us improve.</p>
        </div>
      </div>
    </div>`;

  const q = <T extends Element>(sel: string) => root.querySelector(sel) as T;
  const scaleEl = q<HTMLDivElement>('.scale');
  const stepScore = q<HTMLDivElement>('.step-score');
  const stepReason = q<HTMLDivElement>('.step-reason');
  const stepThanks = q<HTMLDivElement>('.step-thanks');
  const textarea = q<HTMLTextAreaElement>('textarea');
  const submitBtn = q<HTMLButtonElement>('.submit');

  let chosen = -1;

  // color ramp: 0–6 red, 7–8 amber, 9–10 green
  const colorFor = (n: number) => (n <= 6 ? '#e5533c' : n <= 8 ? '#e0a500' : accent);

  for (let n = 0; n <= 10; n++) {
    const b = document.createElement('button');
    b.textContent = String(n);
    b.addEventListener('click', () => {
      chosen = n;
      root.querySelectorAll('.scale button').forEach((el) => {
        el.classList.remove('sel');
        (el as HTMLElement).style.background = '#fff';
      });
      b.classList.add('sel');
      b.style.background = colorFor(n);
      stepScore.classList.add('hidden');
      stepReason.classList.remove('hidden');
      textarea.focus();
    });
    scaleEl.appendChild(b);
  }

  submitBtn.addEventListener('click', () => {
    if (chosen < 0) return;
    cb.onScore(chosen, textarea.value.trim());
    stepReason.classList.add('hidden');
    stepThanks.classList.remove('hidden');
    setTimeout(destroy, 1600);
  });

  q<HTMLButtonElement>('.close').addEventListener('click', () => {
    cb.onClose();
    destroy();
  });

  function destroy() {
    host.remove();
  }

  return { destroy };
}
