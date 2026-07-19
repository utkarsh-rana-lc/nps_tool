import type { NpsConfig } from './types.js';
import { checkEligibility, submitResponse, dismiss } from './api.js';
import { renderWidget } from './ui.js';

type Command = ['init', NpsConfig] | ['show'] | [string, ...unknown[]];

class LimeChatNPS {
  private config: NpsConfig | null = null;
  private shown = false;

  handle(cmd: Command): void {
    const [name, arg] = cmd;
    if (name === 'init') this.init(arg as NpsConfig);
    else if (name === 'show') void this.show();
  }

  private init(config: NpsConfig): void {
    this.config = config;
    if (config.auto ?? true) {
      const delay = config.showDelayMs ?? 4000;
      setTimeout(() => void this.show(), delay);
    }
  }

  /** Ask the server if this user is due; if so, render the pop-up. */
  async show(): Promise<void> {
    if (!this.config || this.shown) return;
    let promptId: string | null = null;
    let copy: { question?: string; reasonPrompt?: string } = {};
    try {
      const elig = await checkEligibility(this.config);
      if (!elig.eligible || !elig.promptId) return;
      promptId = elig.promptId;
      copy = { question: elig.question, reasonPrompt: elig.reasonPrompt };
    } catch {
      return; // never break the host app over NPS
    }

    this.shown = true;
    const cfg = this.config;
    renderWidget(
      cfg,
      {
        onScore: (score, reason) => {
          void submitResponse(cfg, promptId!, score, reason);
          cfg.onSubmit?.({ score, reason });
        },
        onClose: () => {
          void dismiss(cfg, promptId!);
          cfg.onDismiss?.();
        },
      },
      copy,
    );
  }
}

// Drain and replace the command queue (analytics-SDK pattern).
(function bootstrap() {
  const instance = new LimeChatNPS();
  const w = window as unknown as { LimeChatNPS?: Command[] | { push: (c: Command) => void } };
  const existing = w.LimeChatNPS;
  const queued: Command[] = Array.isArray(existing) ? existing : [];
  const api = { push: (cmd: Command) => instance.handle(cmd) };
  w.LimeChatNPS = api;
  queued.forEach((cmd) => instance.handle(cmd));
})();
