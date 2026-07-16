"use client";

import React, { useState, useRef, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu, FloatingMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Bold, Italic, Underline as UnderlineIcon, Link as LinkIcon, Heading1, Heading2, Quote, Plus, Image as ImageIcon, Minus, Type } from "lucide-react";
import Underline from "@tiptap/extension-underline";
import MediaSelector from "../propuestas/nueva/components/Editor/MediaSelector";
import { ResizableImage } from "./ImageNodeView";

export function RichContentEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const [mediaAbierto, setMediaAbierto] = useState(false);
  const [addMenuAbierto, setAddMenuAbierto] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({}),
      Underline,
      ResizableImage.configure({}),
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder: "Escribe la historia…" }),
    ],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        style: "min-height: 55vh; outline: none; font-size: 1.05rem; line-height: 1.75; color: #1e293b;",
      },
    },
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setMediaAbierto(false);
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) setAddMenuAbierto(false);
    };
    if (mediaAbierto || addMenuAbierto) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [mediaAbierto, addMenuAbierto]);

  if (!editor) return null;

  const setLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL del enlace", previous ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const bubbleBtn = (active: boolean) => ({
    display: "flex", alignItems: "center", justifyContent: "center",
    width: "32px", height: "32px", border: "none", borderRadius: "0.3rem",
    background: active ? "#334155" : "transparent", color: "#ffffff",
    cursor: "pointer",
  });

  return (
    <div style={{ position: "relative" }}>
      <BubbleMenu
        editor={editor}
        options={{ placement: "top" }}
        style={{ display: "flex", alignItems: "center", gap: "2px", background: "#1e293b", borderRadius: "0.4rem", padding: "3px", boxShadow: "0 8px 16px -4px rgba(15,23,42,0.35)" }}
      >
        <button type="button" title="Negrita" style={bubbleBtn(editor.isActive("bold"))} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold size={14} />
        </button>
        <button type="button" title="Cursiva" style={bubbleBtn(editor.isActive("italic"))} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic size={14} />
        </button>
        <button type="button" title="Subrayado" style={bubbleBtn(editor.isActive("underline"))} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon size={14} />
        </button>
        <button type="button" title="Enlace" style={bubbleBtn(editor.isActive("link"))} onClick={setLink}>
          <LinkIcon size={14} />
        </button>
        <div style={{ width: "1px", height: "18px", background: "rgba(255,255,255,0.2)", margin: "0 2px" }} />
        <button type="button" title="Título" style={bubbleBtn(editor.isActive("heading", { level: 1 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
          <Heading1 size={14} />
        </button>
        <button type="button" title="Subtítulo" style={bubbleBtn(editor.isActive("heading", { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 size={14} />
        </button>
        <button type="button" title="Cita" style={bubbleBtn(editor.isActive("blockquote"))} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quote size={14} />
        </button>
      </BubbleMenu>

      <FloatingMenu
        editor={editor}
        options={{ placement: "left-start", offset: 12 }}
        style={{ position: "relative" }}
      >
        <div ref={addMenuRef} style={{ position: "relative" }}>
          <button
            type="button"
            title="Añadir"
            onClick={() => setAddMenuAbierto(v => !v)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: "28px", height: "28px", borderRadius: "50%",
              border: "1.5px solid #cbd5e1", background: "#ffffff", color: "#64748b",
              cursor: "pointer", transform: addMenuAbierto ? "rotate(45deg)" : "none", transition: "transform 0.15s ease",
            }}
          >
            <Plus size={16} />
          </button>

          {addMenuAbierto && (
            <div style={{ position: "absolute", top: 0, left: "calc(100% + 8px)", zIndex: 30, display: "flex", alignItems: "center", gap: "4px", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "999px", padding: "3px", boxShadow: "0 8px 16px -4px rgba(15,23,42,0.15)" }}>
              <button
                type="button"
                title="Imagen"
                onClick={() => { setAddMenuAbierto(false); setMediaAbierto(v => !v); }}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", borderRadius: "50%", border: "none", background: "transparent", color: "#475569", cursor: "pointer" }}
              >
                <ImageIcon size={15} />
              </button>
              <button
                type="button"
                title="Línea separadora"
                onClick={() => { setAddMenuAbierto(false); editor.chain().focus().setHorizontalRule().run(); }}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", borderRadius: "50%", border: "none", background: "transparent", color: "#475569", cursor: "pointer" }}
              >
                <Minus size={15} />
              </button>
              <button
                type="button"
                title="Texto"
                onClick={() => { setAddMenuAbierto(false); editor.chain().focus().setParagraph().run(); }}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", borderRadius: "50%", border: "none", background: "transparent", color: "#475569", cursor: "pointer" }}
              >
                <Type size={15} />
              </button>
            </div>
          )}

          {mediaAbierto && (
            <div ref={popoverRef} style={{ position: "absolute", top: 0, left: "calc(100% + 8px)", zIndex: 40, width: "320px", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "0.5rem", boxShadow: "0 10px 15px -3px rgba(15,23,42,0.15)", padding: "0.6rem" }}>
              <MediaSelector
                value={undefined}
                onChange={m => {
                  if (m?.url) {
                    if (m.tipo === "video") {
                      editor.chain().focus().insertContent(`<p><a href="${m.url}" target="_blank" rel="noopener noreferrer">${m.url}</a></p>`).run();
                    } else {
                      editor.chain().focus().setImage({ src: m.url }).run();
                    }
                  }
                  setMediaAbierto(false);
                }}
              />
            </div>
          )}
        </div>
      </FloatingMenu>

      <div className="momo-rich-content" style={{ cursor: "text" }} onClick={() => editor.chain().focus().run()}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
