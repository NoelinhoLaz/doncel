"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  getDocumentosExpediente,
  getPagosDocumento,
  conciliarPagoProveedor,
  getMovimientosBanco,
} from "@/actions/banco";

export function useDocumentos(expedienteId: string) {
  const [documentos, setDocumentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [search, setSearchRaw] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  const [reconcilingPago, setReconcilingPago] = useState<any | null>(null);
  const [bankMovements, setBankMovements] = useState<any[]>([]);
  const [loadingBank, setLoadingBank] = useState(false);
  const [selectedBankMovId, setSelectedBankMovId] = useState<string | null>(null);
  const [reconcileLoading, setReconcileLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try { setDocumentos((await getDocumentosExpediente(expedienteId)) || []); }
    catch { setDocumentos([]); }
    finally { setLoading(false); }
  }, [expedienteId]);

  useEffect(() => { loadDocuments(); }, [loadDocuments]);

  const loadPayments = async (docId: string) => {
    setLoadingPayments(true);
    try { setPayments((await getPagosDocumento(docId)) || []); }
    catch { setPayments([]); }
    finally { setLoadingPayments(false); }
  };

  const loadBankMovements = async (pagoImporte: number) => {
    setLoadingBank(true);
    try {
      const result = await getMovimientosBanco({ page: 1, limit: 50, search: "" });
      const pending = (result.data || []).filter((m: any) => m.estado !== "conciliado" && m.importe < 0);
      setBankMovements(
        [...pending].sort((a: any, b: any) =>
          Math.abs(Math.abs(a.importe) - pagoImporte) - Math.abs(Math.abs(b.importe) - pagoImporte)
        )
      );
    } catch { setBankMovements([]); }
    finally { setLoadingBank(false); }
  };

  const startReconcile = (pago: any) => {
    setReconcilingPago(pago);
    loadBankMovements(Number(pago.importe));
  };

  const cancelReconcile = () => {
    setReconcilingPago(null);
    setSelectedBankMovId(null);
  };

  const handleReconcile = async () => {
    if (!reconcilingPago || !selectedBankMovId) return;
    setReconcileLoading(true);
    setErrorMessage(null);
    try {
      const result = await conciliarPagoProveedor(reconcilingPago.id, selectedBankMovId);
      if (result?.success) {
        setSuccessMessage("¡Pago conciliado correctamente! Asiento contable registrado.");
        setTimeout(() => setSuccessMessage(null), 4000);
        cancelReconcile();
        if (selectedDoc) loadPayments(selectedDoc.id);
        loadDocuments();
      } else {
        setErrorMessage(result?.error || "Error en conciliación del pago.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Error al conciliar el pago.");
    } finally {
      setReconcileLoading(false);
    }
  };

  const openDocDetails = (doc: any) => {
    setSelectedDoc(doc);
    setReconcilingPago(null);
    setSelectedBankMovId(null);
    loadPayments(doc.id);
  };

  const closeDetails = () => {
    setSelectedDoc(null);
    setReconcilingPago(null);
    setSelectedBankMovId(null);
  };

  const filteredData = useMemo(
    () => documentos.filter(d =>
      (d.documento_numero || "").toLowerCase().includes(search.toLowerCase()) ||
      (d.extraccion_json?.cabecera?.proveedor_nombre || d.archivo_nombre || "").toLowerCase().includes(search.toLowerCase())
    ),
    [documentos, search]
  );

  const paginatedData = useMemo(
    () => filteredData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage),
    [filteredData, currentPage, rowsPerPage]
  );

  return {
    documentos, loading, filteredData, paginatedData,
    currentPage, setCurrentPage,
    rowsPerPage, setRowsPerPage: (r: number) => { setRowsPerPage(r); setCurrentPage(1); },
    search, setSearch: (v: string) => { setSearchRaw(v); setCurrentPage(1); },
    viewMode, setViewMode,
    selectedDoc, payments, loadingPayments,
    reconcilingPago, bankMovements, loadingBank,
    selectedBankMovId, setSelectedBankMovId,
    reconcileLoading, successMessage, errorMessage,
    openDocDetails, closeDetails, startReconcile, cancelReconcile, handleReconcile,
  };
}
