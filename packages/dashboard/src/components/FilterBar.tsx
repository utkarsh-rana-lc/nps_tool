import type { Filters, ProductFilter } from '../types.js';

const PRODUCTS: { key: ProductFilter; label: string }[] = [
  { key: 'all', label: 'All products' },
  { key: 'crm', label: 'CRM' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'bot', label: 'Bot' },
];

export function FilterBar({
  filters,
  onChange,
  onExportAll,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  onExportAll: () => void;
}) {
  return (
    <div className="filters">
      <div className="seg">
        {PRODUCTS.map((p) => (
          <button
            key={p.key}
            className={filters.product === p.key ? 'active' : ''}
            onClick={() => onChange({ ...filters, product: p.key })}
          >
            {p.label}
          </button>
        ))}
      </div>

      <span className="muted" style={{ fontSize: 12 }}>From</span>
      <input
        type="month"
        value={filters.dateFrom.slice(0, 7)}
        onChange={(e) => onChange({ ...filters, dateFrom: `${e.target.value}-01` })}
        aria-label="From month"
      />
      <span className="muted" style={{ fontSize: 12 }}>to</span>
      <input
        type="month"
        value={filters.dateTo.slice(0, 7)}
        onChange={(e) => onChange({ ...filters, dateTo: `${e.target.value}-01` })}
        aria-label="To month"
      />

      <div className="spacer" />
      <button className="btn" onClick={onExportAll}>⬇ Export all (CSV)</button>
    </div>
  );
}
