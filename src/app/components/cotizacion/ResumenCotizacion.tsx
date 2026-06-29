"use client";

import { formatCurrency } from "@/hooks/useCotizacion";

interface Props {
  totalCost: number;
  totalRevenue: number;
  summaryPlazas: number;
  summaryFree: number;
  summaryPvpViajero: number;
  hasEditedPvp: boolean;
  onPvpChange: (v: number) => void;
  onPlazasChange: (v: number) => void;
  onFreeChange: (v: number) => void;
}

const numInput: React.CSSProperties = {
  height: '30px', textAlign: 'right', border: '1px solid #cbd5e1', borderRadius: '6px',
  fontSize: '0.8rem', fontWeight: '600', color: '#0f172a', fontFamily: '"Montserrat", sans-serif',
  outline: 'none', background: '#ffffff', boxSizing: 'border-box', padding: '0.2rem 0.5rem',
};

export default function ResumenCotizacion({ totalCost, totalRevenue, summaryPlazas, summaryFree, summaryPvpViajero, hasEditedPvp, onPvpChange, onPlazasChange, onFreeChange }: Props) {
  const costViajero = summaryPlazas > 0 ? totalCost / summaryPlazas : 0;
  const computedRevenue = hasEditedPvp ? (summaryPvpViajero * summaryPlazas) : totalRevenue;
  const totalBenefit = computedRevenue - totalCost;
  const benefitPercentage = computedRevenue > 0 ? (totalBenefit / computedRevenue) * 100 : 0;

  return (
    <div style={{
      flex: '0 0 280px', width: '280px',
      background: 'color-mix(in srgb, var(--primary-color, #475569), transparent 90%)',
      border: '2px solid var(--primary-color, #475569)', borderRadius: '0.75rem',
      padding: '1.25rem', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.05)',
      display: 'flex', flexDirection: 'column', gap: '1rem',
      fontFamily: '"Montserrat", sans-serif',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>Resumen</h3>
        {summaryPvpViajero < costViajero && (
          <span style={{ backgroundColor: '#fee2e2', color: '#ef4444', borderRadius: '9999px', padding: '0.2rem 0.6rem', fontSize: '0.7rem', fontWeight: '700', letterSpacing: '0.05em' }}>
            {summaryPvpViajero <= costViajero * 0.85 ? 'CRÍTICO' : 'AJUSTAR'}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>PVP VIAJERO</span>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{benefitPercentage.toFixed(1)}%</span>
      </div>

      <input
        type="text"
        value={summaryPvpViajero}
        onChange={(e) => onPvpChange(Number(e.target.value.replace(/[^\d.]/g, '')) || 0)}
        style={{ ...numInput, width: '100%', fontWeight: '700' }}
      />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: '600', color: '#334155' }}>Plazas:</span>
          <input
            type="text"
            value={summaryPlazas}
            onChange={(e) => onPlazasChange(Number(e.target.value.replace(/\D/g, '')) || 0)}
            style={{ ...numInput, width: '60px' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Free:</span>
          <input
            type="text"
            value={summaryFree}
            onChange={(e) => onFreeChange(Number(e.target.value.replace(/\D/g, '')) || 0)}
            style={{ ...numInput, width: '60px', color: '#475569' }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
        {[
          { label: 'Costes Viajero:', val: costViajero, color: '#475569', weight: '600' },
          { label: 'Costes Total:', val: totalCost, color: '#0f172a', weight: '600' },
          { label: 'Ingresos Total:', val: totalRevenue, color: '#15803d', weight: '700' },
          { label: 'Beneficio Total:', val: totalBenefit, color: '#15803d', weight: '700' },
        ].map(({ label, val, color, weight }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color }}>
            <span>{label}</span>
            <span style={{ fontWeight: weight }}>{formatCurrency(val)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
