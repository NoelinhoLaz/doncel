"use client";

import React, { useState } from "react";
import { NodeViewWrapper, NodeViewProps, ReactNodeViewRenderer } from "@tiptap/react";
import TiptapImage from "@tiptap/extension-image";
import { mergeAttributes } from "@tiptap/core";
import { AlignCenter, GalleryHorizontal, MoveHorizontal, Trash2 } from "lucide-react";

type Ancho = "normal" | "ancha" | "completa";

const ANCHO_STYLE: Record<Ancho, React.CSSProperties> = {
  normal: { width: "100%" },
  ancha: { width: "100%" },
  completa: { width: "100%" },
};

function ImageNodeViewComponent({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const ancho: Ancho = (node.attrs.ancho as Ancho) || "normal";
  const caption: string = node.attrs.caption || "";
  const [mostrarCaption, setMostrarCaption] = useState(!!caption);

  const anchoBtn = (active: boolean) => ({
    display: "flex", alignItems: "center", gap: "5px",
    padding: "5px 9px", border: "none", borderRadius: "0.3rem",
    background: active ? "#1e293b" : "transparent", color: active ? "#ffffff" : "#475569",
    cursor: "pointer", fontSize: "0.7rem", fontWeight: 600,
  });

  return (
    <NodeViewWrapper
      style={{
        margin: "1.5rem 0",
        ...(ancho === "ancha" ? { marginLeft: "calc(50% - 50vw + 1px)", marginRight: "calc(50% - 50vw + 1px)", width: "auto", maxWidth: "min(1100px, 100vw - 2rem)" } : {}),
        ...(ancho === "completa" ? { marginLeft: "calc(50% - 50vw)", marginRight: "calc(50% - 50vw)", width: "100vw" } : {}),
      }}
    >
      <div style={{ position: "relative" }} contentEditable={false}>
        <img
          src={node.attrs.src}
          alt={node.attrs.alt || ""}
          style={{ display: "block", width: "100%", height: "auto", borderRadius: ancho === "completa" ? 0 : "0.5rem" }}
        />
        {selected && (
          <div style={{ position: "absolute", bottom: "10px", left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: "3px", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "0.4rem", padding: "3px", boxShadow: "0 8px 16px -4px rgba(15,23,42,0.25)" }}>
            <button type="button" title="Ancho normal" style={anchoBtn(ancho === "normal")} onClick={() => updateAttributes({ ancho: "normal" })}>
              <AlignCenter size={13} />
            </button>
            <button type="button" title="Ancho amplio" style={anchoBtn(ancho === "ancha")} onClick={() => updateAttributes({ ancho: "ancha" })}>
              <GalleryHorizontal size={13} />
            </button>
            <button type="button" title="Ancho completo" style={anchoBtn(ancho === "completa")} onClick={() => updateAttributes({ ancho: "completa" })}>
              <MoveHorizontal size={13} />
            </button>
            <div style={{ width: "1px", height: "16px", background: "#e2e8f0", margin: "0 2px" }} />
            <button type="button" title={mostrarCaption ? "Quitar pie de foto" : "Añadir pie de foto"} style={anchoBtn(mostrarCaption)} onClick={() => setMostrarCaption(v => !v)}>
              Añadir pie de foto
            </button>
            <div style={{ width: "1px", height: "16px", background: "#e2e8f0", margin: "0 2px" }} />
            <button type="button" title="Eliminar imagen" style={{ ...anchoBtn(false), color: "#ef4444" }} onClick={() => deleteNode()}>
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>
      {mostrarCaption && (
        <input
          type="text"
          value={caption}
          onChange={e => updateAttributes({ caption: e.target.value })}
          placeholder="Escribe un pie de foto…"
          style={{ display: "block", width: "100%", textAlign: "center", marginTop: "0.5rem", fontSize: "0.8rem", color: "#94a3b8", border: "none", outline: "none", background: "transparent" }}
        />
      )}
    </NodeViewWrapper>
  );
}

export const ResizableImage = TiptapImage.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ancho: {
        default: "normal",
        parseHTML: el => el.closest("figure")?.getAttribute("data-ancho") || "normal",
      },
      caption: {
        default: null,
        parseHTML: el => el.closest("figure")?.querySelector("figcaption")?.textContent || null,
      },
    };
  },
  parseHTML() {
    return [{ tag: "figure img" }, { tag: "img[src]" }];
  },
  renderHTML({ HTMLAttributes }) {
    const { ancho, caption, ...imgAttrs } = HTMLAttributes;
    const children: any[] = [["img", mergeAttributes(imgAttrs)]];
    if (caption) children.push(["figcaption", {}, caption]);
    return ["figure", { "data-ancho": ancho || "normal", class: `momo-figura momo-figura-${ancho || "normal"}` }, ...children];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeViewComponent);
  },
});
