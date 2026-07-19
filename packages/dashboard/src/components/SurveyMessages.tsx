import { useEffect, useState } from 'react';
import { api, type SurveySetting } from '../api.js';

const PRODUCT_LABEL: Record<string, string> = {
  crm: 'CRM',
  marketing: 'Marketing',
  bot: 'Bot',
};

/** Admin-only editor for the per-product survey copy the widget displays. */
export function SurveyMessages({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState<SurveySetting[] | null>(null);
  const [draft, setDraft] = useState<Record<string, { question: string; reasonPrompt: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getSettings().then((r) => {
      setSettings(r.settings);
      setDraft(
        Object.fromEntries(
          r.settings.map((s) => [s.product, { question: s.question, reasonPrompt: s.reasonPrompt }]),
        ),
      );
    }).catch((e) => setError(String(e)));
  }, []);

  async function save(product: string) {
    setSavingId(product);
    setError(null);
    try {
      await api.updateSetting(product, draft[product]);
      setSavedId(product);
      setTimeout(() => setSavedId(null), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="drawer" style={{ width: 640 }}>
        <div className="dh">
          <div>
            <h2>Survey messages</h2>
            <div className="muted" style={{ fontSize: 12 }}>
              Edit the question and follow-up prompt each product's pop-up shows. Changes apply to new surveys immediately.
            </div>
          </div>
          <button className="close-x" onClick={onClose}>×</button>
        </div>

        {error && <div className="login-error">{error}</div>}
        {settings === null ? (
          <div className="loading">Loading…</div>
        ) : (
          settings.map((s) => (
            <div className="panel" key={s.product}>
              <h2 style={{ fontSize: 14, marginBottom: 10 }}>
                {PRODUCT_LABEL[s.product]}{' '}
                {savedId === s.product && <span className="pill good" style={{ marginLeft: 6 }}>Saved ✓</span>}
              </h2>
              <label className="fld">Question (0–10 scale)
                <textarea
                  value={draft[s.product]?.question ?? ''}
                  maxLength={300}
                  onChange={(e) => setDraft((d) => ({ ...d, [s.product]: { ...d[s.product], question: e.target.value } }))}
                  style={{ width: '100%', minHeight: 54, marginTop: 5, padding: 9, border: '1px solid var(--line)', borderRadius: 9, fontSize: 13 }}
                />
              </label>
              <label className="fld">Follow-up reason prompt
                <textarea
                  value={draft[s.product]?.reasonPrompt ?? ''}
                  maxLength={300}
                  onChange={(e) => setDraft((d) => ({ ...d, [s.product]: { ...d[s.product], reasonPrompt: e.target.value } }))}
                  style={{ width: '100%', minHeight: 40, marginTop: 5, padding: 9, border: '1px solid var(--line)', borderRadius: 9, fontSize: 13 }}
                />
              </label>
              <button className="btn primary" style={{ marginTop: 12 }} disabled={savingId === s.product} onClick={() => save(s.product)}>
                {savingId === s.product ? 'Saving…' : 'Save'}
              </button>
            </div>
          ))
        )}
      </div>
    </>
  );
}
