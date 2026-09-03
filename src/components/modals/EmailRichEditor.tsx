"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Mark, mergeAttributes } from "@tiptap/core";
import { useState, useRef, useEffect } from "react";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Link as LinkIcon,
  Unlink,
  Palette,
  Type,
  ChevronDown,
} from "lucide-react";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    customColor: {
      setColor: (color: string) => ReturnType;
      unsetColor: () => ReturnType;
    };
    customFontSize: {
      setFontSize: (size: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
  }
}

export const ColorMark = Mark.create({
  name: "customColor",
  addOptions() {
    return { HTMLAttributes: {} };
  },
  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element) => element.style.color || null,
        renderHTML: (attributes) => {
          if (!attributes.color) return {};
          return { style: `color: ${attributes.color}` };
        },
      },
    };
  },
  parseHTML() {
    return [{ tag: "span[style*=color]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },
  addCommands() {
    return {
      setColor:
        (color: string) =>
        ({ chain }) => {
          return chain().setMark(this.name, { color }).run();
        },
      unsetColor:
        () =>
        ({ chain }) => {
          return chain().unsetMark(this.name).run();
        },
    };
  },
});

export const FontSizeMark = Mark.create({
  name: "customFontSize",
  addOptions() {
    return { HTMLAttributes: {} };
  },
  addAttributes() {
    return {
      size: {
        default: null,
        parseHTML: (element) => element.style.fontSize || null,
        renderHTML: (attributes) => {
          if (!attributes.size) return {};
          return { style: `font-size: ${attributes.size}` };
        },
      },
    };
  },
  parseHTML() {
    return [{ tag: "span[style*=font-size]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },
  addCommands() {
    return {
      setFontSize:
        (size: string) =>
        ({ chain }) => {
          return chain().setMark(this.name, { size }).run();
        },
      unsetFontSize:
        () =>
        ({ chain }) => {
          return chain().unsetMark(this.name).run();
        },
    };
  },
});

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
};

const PALETA_COLORES = [
  { label: "Por defecto", value: "" },
  { label: "Oscuro", value: "#0f172a" },
  { label: "Gris", value: "#64748b" },
  { label: "Azul", value: "#2563eb" },
  { label: "Índigo", value: "#4f46e5" },
  { label: "Verde", value: "#16a34a" },
  { label: "Rojo", value: "#dc2626" },
  { label: "Naranja", value: "#ea580c" },
  { label: "Púrpura", value: "#9333ea" },
];

const TAMANIOS = [
  { label: "Pequeño", value: "12px" },
  { label: "Normal", value: "14px" },
  { label: "Mediano", value: "16px" },
  { label: "Grande", value: "19px" },
  { label: "Título", value: "24px" },
];

export default function EmailRichEditor({ value, onChange, placeholder = "Escribe el contenido del mensaje…" }: Props) {
  const [showColorMenu, setShowColorMenu] = useState(false);
  const [showSizeMenu, setShowSizeMenu] = useState(false);
  const colorMenuRef = useRef<HTMLDivElement>(null);
  const sizeMenuRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      Underline,
      ColorMark,
      FontSizeMark,
      Link.configure({ openOnClick: false, autolink: false }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "momo-rich-inline",
        style: [
          "min-height: 170px",
          "outline: none",
          "font-size: 0.875rem",
          "line-height: 1.65",
          "color: #1e293b",
          "padding: 0.65rem 0.75rem",
        ].join(";"),
      },
    },
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (colorMenuRef.current && !colorMenuRef.current.contains(e.target as Node)) {
        setShowColorMenu(false);
      }
      if (sizeMenuRef.current && !sizeMenuRef.current.contains(e.target as Node)) {
        setShowSizeMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!editor) return null;

  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL del enlace", prev ?? "https://");
    if (url === null) return;
    if (url.trim() === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  const toolbarBtn = (active: boolean) => ({
    display: "flex" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    width: 28,
    height: 28,
    border: "none",
    borderRadius: "0.3rem",
    background: active ? "#e2e8f0" : "transparent",
    color: active ? "#1e293b" : "#64748b",
    cursor: "pointer" as const,
    transition: "background 0.1s",
  });

  const activeColor = editor.getAttributes("customColor").color as string | undefined;
  const activeSize = editor.getAttributes("customFontSize").size as string | undefined;

  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: "0.5rem",
        background: "#fff",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 3,
          padding: "0.35rem 0.5rem",
          borderBottom: "1px solid #e2e8f0",
          background: "#f8fafc",
          flexWrap: "wrap",
          position: "relative",
        }}
      >
        {/* Tamaño de letra */}
        <div ref={sizeMenuRef} style={{ position: "relative" }}>
          <button
            type="button"
            title="Tamaño de texto"
            onClick={() => { setShowSizeMenu((v) => !v); setShowColorMenu(false); }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "0.25rem 0.45rem",
              height: 28,
              border: "1px solid #e2e8f0",
              borderRadius: "0.3rem",
              background: activeSize ? "#e0e7ff" : "#fff",
              color: activeSize ? "#4338ca" : "#475569",
              fontSize: "0.75rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            <Type size={13} />
            <span>{TAMANIOS.find((t) => t.value === activeSize)?.label ?? "Tamaño"}</span>
            <ChevronDown size={11} />
          </button>
          {showSizeMenu && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                left: 0,
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
                padding: "4px 0",
                zIndex: 99,
                minWidth: 120,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().unsetFontSize().run();
                  setShowSizeMenu(false);
                }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "0.35rem 0.75rem",
                  fontSize: "0.8rem",
                  background: !activeSize ? "#f1f5f9" : "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#334155",
                }}
              >
                Normal (14px)
              </button>
              {TAMANIOS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => {
                    editor.chain().focus().setFontSize(t.value).run();
                    setShowSizeMenu(false);
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "0.35rem 0.75rem",
                    fontSize: t.value === "24px" ? "1rem" : t.value === "19px" ? "0.9rem" : "0.8rem",
                    fontWeight: t.value === "24px" ? 700 : t.value === "19px" ? 600 : 400,
                    background: activeSize === t.value ? "#f1f5f9" : "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#334155",
                  }}
                >
                  {t.label} ({t.value})
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Color de texto */}
        <div ref={colorMenuRef} style={{ position: "relative" }}>
          <button
            type="button"
            title="Color de texto"
            onClick={() => { setShowColorMenu((v) => !v); setShowSizeMenu(false); }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 3,
              padding: "0.25rem 0.45rem",
              height: 28,
              border: "1px solid #e2e8f0",
              borderRadius: "0.3rem",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            <Palette size={13} style={{ color: activeColor ?? "#475569" }} />
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 2,
                background: activeColor ?? "#1e293b",
                border: "1px solid #cbd5e1",
              }}
            />
            <ChevronDown size={11} style={{ color: "#64748b" }} />
          </button>
          {showColorMenu && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                left: 0,
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
                padding: "8px",
                zIndex: 99,
                width: 170,
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 8 }}>
                {PALETA_COLORES.map((c) => (
                  <button
                    key={c.value || "default"}
                    type="button"
                    title={c.label}
                    onClick={() => {
                      if (!c.value) {
                        editor.chain().focus().unsetColor().run();
                      } else {
                        editor.chain().focus().setColor(c.value).run();
                      }
                      setShowColorMenu(false);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: 26,
                      borderRadius: 4,
                      border: activeColor === c.value ? "2px solid #000" : "1px solid #cbd5e1",
                      background: c.value || "#fff",
                      cursor: "pointer",
                    }}
                  >
                    {!c.value && <span style={{ fontSize: "0.65rem", color: "#64748b" }}>Auto</span>}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, borderTop: "1px solid #f1f5f9", paddingTop: 6 }}>
                <input
                  type="color"
                  value={activeColor ?? "#1e293b"}
                  onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
                  style={{ width: 24, height: 24, border: "none", borderRadius: 4, cursor: "pointer", padding: 0 }}
                />
                <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Personalizado</span>
              </div>
            </div>
          )}
        </div>

        <div style={{ width: 1, height: 18, background: "#e2e8f0", margin: "0 2px" }} />

        {/* Formatos básicos */}
        <button
          type="button"
          title="Negrita (Ctrl+B)"
          style={toolbarBtn(editor.isActive("bold"))}
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }}
        >
          <Bold size={14} />
        </button>
        <button
          type="button"
          title="Cursiva (Ctrl+I)"
          style={toolbarBtn(editor.isActive("italic"))}
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }}
        >
          <Italic size={14} />
        </button>
        <button
          type="button"
          title="Subrayado (Ctrl+U)"
          style={toolbarBtn(editor.isActive("underline"))}
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleUnderline().run(); }}
        >
          <UnderlineIcon size={14} />
        </button>

        <div style={{ width: 1, height: 18, background: "#e2e8f0", margin: "0 2px" }} />

        {/* Listas */}
        <button
          type="button"
          title="Lista con viñetas"
          style={toolbarBtn(editor.isActive("bulletList"))}
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBulletList().run(); }}
        >
          <List size={14} />
        </button>
        <button
          type="button"
          title="Lista numerada"
          style={toolbarBtn(editor.isActive("orderedList"))}
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleOrderedList().run(); }}
        >
          <ListOrdered size={14} />
        </button>

        <div style={{ width: 1, height: 18, background: "#e2e8f0", margin: "0 2px" }} />

        {/* Enlace */}
        <button
          type="button"
          title="Insertar enlace"
          style={toolbarBtn(editor.isActive("link"))}
          onMouseDown={(e) => { e.preventDefault(); setLink(); }}
        >
          <LinkIcon size={14} />
        </button>
        {editor.isActive("link") && (
          <button
            type="button"
            title="Quitar enlace"
            style={toolbarBtn(false)}
            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().unsetLink().run(); }}
          >
            <Unlink size={14} />
          </button>
        )}
      </div>

      {/* Editor area */}
      <EditorContent editor={editor} />
    </div>
  );
}
