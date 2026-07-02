"use client";

import { P, PL } from "../constants";

export function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: '0.28rem 0.65rem', fontSize: '0.72rem', fontWeight: 600, borderRadius: 99,
      border: `1.5px solid ${active ? P : '#cbd5e1'}`,
      background: active ? PL : '#fff',
      color: active ? P : '#64748b',
      cursor: 'pointer', transition: 'all 0.12s', whiteSpace: 'nowrap',
    }}>{label}</button>
  );
}

export function ChipGroup({ label, options, value, onChange, multi = false }: {
  label: string;
  options: { value: string; label: string }[];
  value: string | string[];
  onChange: (v: string | string[]) => void;
  multi?: boolean;
}) {
  const selected = Array.isArray(value) ? value : value ? [value] : [];
  const toggle = (v: string) => {
    if (multi) {
      onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v]);
    } else {
      onChange(selected.includes(v) ? '' : v);
    }
  };
  return (
    <div>
      <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
        {options.map(o => <Chip key={o.value} label={o.label} active={selected.includes(o.value)} onClick={() => toggle(o.value)} />)}
      </div>
    </div>
  );
}
