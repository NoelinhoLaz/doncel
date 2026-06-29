import styles from "./Pagination.module.css";
import { Icons } from "@/lib/icons";

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange?: (items: number) => void;
}

export default function Pagination({
  currentPage,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
}: PaginationProps) {
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

  if (totalPages <= 1 && !onItemsPerPageChange) return null;

  return (
    <div className={styles.paginationContainer}>
      <div className={styles.paginationLeft}>
        {onItemsPerPageChange && (
          <div className={styles.rowsControl}>
            <label>Filas:</label>
            <select 
              value={itemsPerPage}
              onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={20}>20</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>Todas</option>
            </select>
          </div>
        )}
      </div>
      
      <div className={styles.paginationRight}>
        <div className={styles.segmentedControl}>
          <button
            className={styles.segmentedButton}
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            title="Anterior"
          >
            <Icons.ChevronRight size={16} style={{ transform: "rotate(180deg)" }} />
          </button>

          <div className={styles.selectWrapper}>
            <select
              className={styles.segmentedSelect}
              value={currentPage}
              onChange={(e) => onPageChange(Number(e.target.value))}
              title="Seleccionar página"
            >
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <span className={styles.selectArrow}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 4L5 2L7 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M3 6L5 8L7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
          </div>

          <button
            className={styles.segmentedButton}
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            title="Siguiente"
          >
            <Icons.ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
