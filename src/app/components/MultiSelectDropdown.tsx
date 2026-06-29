"use client";

import { useState, useRef, useEffect } from "react";
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
  const containerRef = useRef<HTMLDivElement>(null);

  // Cerrar el dropdown cuando se haga click afuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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

      {isOpen && (
        <div className={styles.dropdown}>
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

          {selected.length > 0 && (
            <div className={styles.footer}>
              <button
                type="button"
                className={styles.clearButton}
                onClick={clearAll}
              >
                Limpiar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
