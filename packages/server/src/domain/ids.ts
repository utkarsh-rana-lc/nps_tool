import { randomUUID } from 'node:crypto';

/** Prefixed, URL-safe ids: prm_… / res_… — human-scannable in logs & CSVs. */
export function newId(prefix: 'prm' | 'res'): string {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 20)}`;
}
