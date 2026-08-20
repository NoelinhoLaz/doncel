"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Icons } from "@/lib/icons";
import styles from "./MultiSelectDropdown.module.css";

interface MultiSelectDropdownProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}

export default function MultiSelectDropdown({
  options,
  selected,
  onChange,
  placeholder = "Seleccionar...",
  style,
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        !(target as HTMLElement).closest?.(`.${styles.dropdown}`)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
  }, [isOpen]);

  const filteredOptions = options.filter((opt) =>
    opt.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter((item) => item !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  const clearAll = () => {
    onChange([]);
    setSearchTerm("");
  };

  const displayText =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? selected[0]
        : `${selected.length} seleccionados`;

  return (
    <div ref={containerRef} className={styles.container}>
      <button
        ref={triggerRef}
        className={styles.trigger}
        onClick={() => setIsOpen(!isOpen)}
        type="button"
        style={style}
      >
        <span className={styles.triggerText}>{displayText}</span>
        <Icons.ChevronDown
          size={16}
          className={`${styles.triggerIcon} ${isOpen ? styles.open : ""}`}
        />
      </button>

      {isOpen && dropdownPos && typeof document !== "undefined" && createPortal(
        <div
          className={styles.dropdown}
          style={{ position: "fixed", top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, marginTop: 0, zIndex: 9000 }}
        >
          <div className={styles.searchContainer}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
          </div>

          <div className={styles.optionsList}>
            {filteredOptions.length === 0 ? (
              <div className={styles.noOptions}>No hay opciones</div>
            ) : (
              filteredOptions.map((option) => (
                <label key={option} className={styles.option}>
                  <input
                    type="checkbox"
                    checked={selected.includes(option)}
                    onChange={() => toggleOption(option)}
                    className={styles.checkbox}
                  />
                  <span className={styles.optionLabel}>{option}</span>
                </label>
              ))
            )}
          </div>

          <div className={styles.footer}>
            <button
              type="button"
              className={styles.clearButton}
              onClick={clearAll}
              disabled={selected.length === 0}
              style={selected.length === 0 ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
            >
              Limpiar
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
