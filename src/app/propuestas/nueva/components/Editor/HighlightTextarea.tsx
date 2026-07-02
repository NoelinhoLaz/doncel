"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import styles from "../../page.module.css";
import type { TextoEstilo } from "../../types";
import { estiloTextoCSS } from "../../utils/style-utils";
import { FUENTE_FAMILY } from "../../constants";

export default function HighlightTextarea({
  value,
  onChange,
  placeholder,
  rows = 3
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  rows?: number;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backingRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);

  const handleScroll = () => {
    if (textareaRef.current && backingRef.current) {
      backingRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    // Get text as plain text
    const text = e.clipboardData.getData("text/plain");

    // Get current cursor selection
    const start = e.currentTarget.selectionStart;
    const end = e.currentTarget.selectionEnd;
    const currentValue = e.currentTarget.value;

    const newValue = currentValue.substring(0, start) + text + currentValue.substring(end);

    const mockEvent = {
      target: { value: newValue }
    } as React.ChangeEvent<HTMLTextAreaElement>;

    onChange(mockEvent);

    // Set cursor position after the state update
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + text.length;
      }
    }, 0);
  };

  const renderConDestacadoConAsteriscos = (texto: string) => {
    const partes = texto.split(/(\*\*.*?\*\*)/g);
    return partes.map((p, i) =>
      p.startsWith("**") && p.endsWith("**")
        ? <strong key={i} style={{ color: "#6366f1", fontWeight: "bold" }}>{p}</strong>
        : p
    );
  };

  // Adjust height to content dynamically
  useEffect(() => {
    if (textareaRef.current && backingRef.current) {
      textareaRef.current.style.height = "auto";
      const nextHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${nextHeight}px`;
      backingRef.current.style.height = `${nextHeight}px`;
    }
  }, [value]);

  return (
    <div style={{ position: "relative", width: "100%", height: "auto" }}>
      <div
        ref={backingRef}
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          color: "#1e293b",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          overflowY: "hidden",
          zIndex: 1,
          border: focused ? "1px solid #6366f1" : "1px solid #e2e8f0",
          borderRadius: "0.5rem",
          background: focused ? "#ffffff" : "#f8fafc",
          fontFamily: "inherit",
          fontSize: "0.83rem",
          lineHeight: "1.5",
          padding: "0.45rem 0.65rem",
          boxSizing: "border-box"
        }}
      >
        {renderConDestacadoConAsteriscos(value || " ")}
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={onChange}
        onScroll={handleScroll}
        onPaste={handlePaste}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        rows={rows}
        style={{
          position: "relative",
          width: "100%",
          display: "block",
          background: "transparent",
          border: "1px solid transparent",
          color: "transparent",
          caretColor: "#1e293b",
          zIndex: 2,
          resize: "none",
          fontFamily: "inherit",
          fontSize: "0.83rem",
          lineHeight: "1.5",
          padding: "0.45rem 0.65rem",
          outline: "none",
          boxSizing: "border-box",
          overflowY: "hidden"
        }}
      />
    </div>
  );
}
