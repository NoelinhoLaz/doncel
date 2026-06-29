"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PdfViewer({ url }: { url: string }) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageWidth, setPageWidth] = useState(390);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNumPages(null);
  }, [url]);

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setPageWidth(containerRef.current.offsetWidth);
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        overflowY: "auto",
        maxHeight: "70vh",
        background: "#e2e8f0",
        borderRadius: "0.75rem",
      }}
    >
      <Document
        file={url}
        onLoadSuccess={({ numPages }) => setNumPages(numPages)}
        loading={
          <div style={{ padding: "3rem", textAlign: "center", color: "#94a3b8" }}>
            Cargando PDF...
          </div>
        }
        error={
          <div style={{ padding: "3rem", textAlign: "center", color: "#b91c1c" }}>
            No se pudo cargar el PDF
          </div>
        }
      >
        {numPages &&
          Array.from({ length: numPages }, (_, i) => (
            <Page
              key={i + 1}
              pageNumber={i + 1}
              width={pageWidth}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          ))}
      </Document>
    </div>
  );
}
