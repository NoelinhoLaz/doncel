"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

export function useMiniPager<T>(items: T[], pageState: [number, (n: number) => void], pageSize = 5) {
  const [page, setPage] = pageState;
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const paginated = items.slice(safePage * pageSize, safePage * pageSize + pageSize);
  return { paginated, page: safePage, totalPages, setPage };
}

export function MiniPager({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (n: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, marginTop: "0.5rem" }}>
      <button
        type="button"
        onClick={() => onChange(Math.max(0, page - 1))}
        disabled={page === 0}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, border: "1px solid #e2e8f0", borderRadius: 5, background: "#fff", cursor: page === 0 ? "default" : "pointer", color: "#64748b", opacity: page === 0 ? 0.4 : 1 }}
      >
        <ChevronLeft size={13} />
      </button>
      <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>{page + 1} / {totalPages}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(totalPages - 1, page + 1))}
        disabled={page === totalPages - 1}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, border: "1px solid #e2e8f0", borderRadius: 5, background: "#fff", cursor: page === totalPages - 1 ? "default" : "pointer", color: "#64748b", opacity: page === totalPages - 1 ? 0.4 : 1 }}
      >
        <ChevronRight size={13} />
      </button>
    </div>
  );
}
