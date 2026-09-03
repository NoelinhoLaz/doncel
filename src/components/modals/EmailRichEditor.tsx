"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Link as LinkIcon,
  Unlink,
} from "lucide-react";

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
};

export default function EmailRichEditor({ value, onChange, placeholder = "Escribe el contenido del mensaje…" }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      Underline,
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
          "min-height: 160px",
          "outline: none",
          "font-size: 0.855rem",
          "line-height: 1.65",
          "color: #1e293b",
          "padding: 0.55rem 0.65rem",
        ].join(";"),
      },
    },
  });

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
    width: 30,
    height: 30,
    border: "none",
    borderRadius: "0.3rem",
    background: active ? "#e2e8f0" : "transparent",
    color: active ? "#1e293b" : "#64748b",
    cursor: "pointer" as const,
    transition: "background 0.1s",
  });

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
          gap: 2,
          padding: "0.3rem 0.5rem",
          borderBottom: "1px solid #e2e8f0",
          background: "#f8fafc",
          flexWrap: "wrap",
        }}
      >
        <button type="button" title="Negrita (Ctrl+B)" style={toolbarBtn(editor.isActive("bold"))} onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }}>
          <Bold size={14} />
        </button>
        <button type="button" title="Cursiva (Ctrl+I)" style={toolbarBtn(editor.isActive("italic"))} onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }}>
          <Italic size={14} />
        </button>
        <button type="button" title="Subrayado (Ctrl+U)" style={toolbarBtn(editor.isActive("underline"))} onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleUnderline().run(); }}>
          <UnderlineIcon size={14} />
        </button>

        <div style={{ width: 1, height: 18, background: "#e2e8f0", margin: "0 4px" }} />

        <button type="button" title="Lista con viñetas" style={toolbarBtn(editor.isActive("bulletList"))} onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBulletList().run(); }}>
          <List size={14} />
        </button>
        <button type="button" title="Lista numerada" style={toolbarBtn(editor.isActive("orderedList"))} onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleOrderedList().run(); }}>
          <ListOrdered size={14} />
        </button>

        <div style={{ width: 1, height: 18, background: "#e2e8f0", margin: "0 4px" }} />

        <button type="button" title="Insertar enlace" style={toolbarBtn(editor.isActive("link"))} onMouseDown={(e) => { e.preventDefault(); setLink(); }}>
          <LinkIcon size={14} />
        </button>
        {editor.isActive("link") && (
          <button type="button" title="Quitar enlace" style={toolbarBtn(false)} onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().unsetLink().run(); }}>
            <Unlink size={14} />
          </button>
        )}
      </div>

      {/* Editor area */}
      <EditorContent editor={editor} />
    </div>
  );
}
