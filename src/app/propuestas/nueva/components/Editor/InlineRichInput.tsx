"use client";

import React from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Bold, Italic, Strikethrough, Code, List, ListOrdered } from "lucide-react";

export default function InlineRichInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        // Enter inserta un salto de línea simple en vez de un párrafo nuevo.
        paragraph: { HTMLAttributes: {} },
      }).extend({
        addKeyboardShortcuts() {
          return {
            Enter: () => this.editor.commands.setHardBreak(),
          };
        },
      }),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
    ],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "momo-rich-inline",
        style: "outline: none; font-size: 0.83rem; line-height: 1.5; color: #1e293b;",
      },
    },
  });

  const bubbleBtn = (active: boolean) => ({
    display: "flex", alignItems: "center", justifyContent: "center",
    width: "28px", height: "28px", border: "none", borderRadius: "0.3rem",
    background: active ? "#334155" : "transparent", color: "#ffffff",
    cursor: "pointer",
  });

  if (!editor) return null;

  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: "0.5rem",
        background: "#f8fafc",
        padding: "0.45rem 0.65rem",
      }}
      onFocus={e => { (e.currentTarget as HTMLElement).style.background = "#ffffff"; (e.currentTarget as HTMLElement).style.borderColor = "#6366f1"; }}
      onBlur={e => { (e.currentTarget as HTMLElement).style.background = "#f8fafc"; (e.currentTarget as HTMLElement).style.borderColor = "#e2e8f0"; }}
    >
      <BubbleMenu
        editor={editor}
        options={{ placement: "top" }}
        style={{ display: "flex", alignItems: "center", gap: "2px", background: "#1e293b", borderRadius: "0.4rem", padding: "3px", boxShadow: "0 8px 16px -4px rgba(15,23,42,0.35)" }}
      >
        <button type="button" title="Negrita" style={bubbleBtn(editor.isActive("bold"))} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold size={13} />
        </button>
        <button type="button" title="Cursiva" style={bubbleBtn(editor.isActive("italic"))} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic size={13} />
        </button>
        <button type="button" title="Tachado" style={bubbleBtn(editor.isActive("strike"))} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <Strikethrough size={13} />
        </button>
        <button type="button" title="Código" style={bubbleBtn(editor.isActive("code"))} onClick={() => editor.chain().focus().toggleCode().run()}>
          <Code size={13} />
        </button>
        <div style={{ width: "1px", height: "16px", background: "rgba(255,255,255,0.2)", margin: "0 2px" }} />
        <button type="button" title="Lista numerada" style={bubbleBtn(editor.isActive("orderedList"))} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered size={13} />
        </button>
        <button type="button" title="Lista con viñetas" style={bubbleBtn(editor.isActive("bulletList"))} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List size={13} />
        </button>
      </BubbleMenu>
      <EditorContent editor={editor} />
    </div>
  );
}
