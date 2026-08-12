"use client";

import { useState, useRef, useEffect } from "react";
import { Icons } from "@/lib/icons";
import styles from "./MultiSelectDropdown.module.css";

interface Option {
  value: string;
  label: string;
}

interface SingleSelectDropdownProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}

export default function SingleSelectDropdown({
  options,
  value,
  onChange,
  placeholder = "Seleccionar...",
  style,
}: SingleSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((o) => o.value === value);
  const displayText = selectedOption ? selectedOption.label : placeholder;

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
          <div className={styles.optionsList}>
            {options.map((option) => (
              <label
                key={option.value}
                className={styles.option}
                onClick={() => { onChange(option.value); setIsOpen(false); }}
              >
                <input
                  type="radio"
                  checked={value === option.value}
                  onChange={() => {}}
                  className={styles.checkbox}
                />
                <span className={styles.optionLabel}>{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
