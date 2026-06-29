"use client";

import { useState, useMemo, useEffect } from "react";
import { Icons } from "@/lib/icons";
import listStyles from "../../expedientes/page.module.css";
import { getLibroIvaData, type FacturaGeneral, type FacturaREAV } from "@/actions/facturacion";

export default function LibroIvaPage() {
  const [periodo, setPeriodo] = useState<"ALL" | "Q1" | "Q2" | "Q3" | "Q4">("ALL");
  const [tipo, setTipo] = useState<"emitidas" | "recibidas">("emitidas");
  const [regimen, setRegimen] = useState<"TODOS" | "GENERAL" | "REAV">("TODOS");

  const [loading, setLoading] = useState<boolean>(true);
  const [ventasGeneral, setVentasGeneral] = useState<FacturaGeneral[]>([]);
  const [ventasReav, setVentasReav] = useState<FacturaREAV[]>([]);
  const [comprasGeneral, setComprasGeneral] = useState<FacturaGeneral[]>([]);
  const [comprasReav, setComprasReav] = useState<FacturaREAV[]>([]);

  // Cargar datos reales de facturación desde la base de datos
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const data = await getLibroIvaData();
        setVentasGeneral(data.ventasGeneral);
        setVentasReav(data.ventasReav);
        setComprasGeneral(data.comprasGeneral);
        setComprasReav(data.comprasReav);
      } catch (err) {
        console.error("Error al cargar los datos del Libro de IVA:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Filter dynamic lists
  const listGeneralFiltered = useMemo(() => {
    const list = tipo === "emitidas" ? ventasGeneral : comprasGeneral;
    if (periodo === "ALL") return list;
    return list.filter(f => f.periodo === periodo);
  }, [tipo, periodo, ventasGeneral, comprasGeneral]);

  const listREAVFiltered = useMemo(() => {
    const list = tipo === "emitidas" ? ventasReav : comprasReav;
    if (periodo === "ALL") return list;
    return list.filter(f => f.periodo === periodo);
  }, [tipo, periodo, ventasReav, comprasReav]);

  // Aggregate calculations for footer totals
  const totals = useMemo(() => {
    let baseGen = 0;
    let cuotaGen = 0;
    let baseReav = 0;
    let cuotaReav = 0;

    listGeneralFiltered.forEach(f => {
      baseGen += f.base;
      cuotaGen += f.cuota;
    });

    listREAVFiltered.forEach(f => {
      baseReav += f.baseIva;
      cuotaReav += f.cuota;
    });

    return {
      baseGen,
      cuotaGen,
      baseReav,
      cuotaReav,
      totalDeclarar: cuotaGen + cuotaReav
    };
  }, [listGeneralFiltered, listREAVFiltered]);

  const formatEuro = (val: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR"
    }).format(val);
  };

  // 📥 EXPORT OFFICIAL EXCEL (SpreadsheetML XML format with multiple worksheets)
  const handleExportExcel = () => {
    // General dataset for export
    const genData = tipo === "emitidas" ? ventasGeneral : comprasGeneral;
    const reavData = tipo === "emitidas" ? ventasReav : comprasReav;
    
    const labelTipo = tipo === "emitidas" ? "Emitidas_Ventas" : "Recibidas_Compras";
    const filename = `Libro_IVA_${labelTipo}_2026.xls`;

    // Constructing standard XML SpreadsheetML markup compatible with MS Excel
    let xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Author>MOMO Accounting Suite</Author>
  <Created>${new Date().toISOString()}</Created>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Bottom"/>
   <Borders/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="HeaderStyle">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#1E293B" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="CurrencyStyle">
   <NumberFormat ss:Format="&quot;€&quot;\ #,##0.00"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Régimen General">
  <Table>
   <Column ss:Width="100"/>
   <Column ss:Width="100"/>
   <Column ss:Width="200"/>
   <Column ss:Width="100"/>
   <Column ss:Width="120"/>
   <Column ss:Width="80"/>
   <Column ss:Width="120"/>
   <Column ss:Width="120"/>
   <Row ss:Height="22">
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Fecha</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Nº Factura</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Cliente/Proveedor</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">NIF</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Base Imponible</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">% IVA</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Cuota IVA</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Total</Data></Cell>
   </Row>`;

    genData.forEach(item => {
      xml += `
   <Row>
    <Cell><Data ss:Type="String">${item.fecha}</Data></Cell>
    <Cell><Data ss:Type="String">${item.factura}</Data></Cell>
    <Cell><Data ss:Type="String">${item.entidad}</Data></Cell>
    <Cell><Data ss:Type="String">${item.nif}</Data></Cell>
    <Cell ss:StyleID="CurrencyStyle"><Data ss:Type="Number">${item.base}</Data></Cell>
    <Cell><Data ss:Type="String">${item.tipoIva}%</Data></Cell>
    <Cell ss:StyleID="CurrencyStyle"><Data ss:Type="Number">${item.cuota}</Data></Cell>
    <Cell ss:StyleID="CurrencyStyle"><Data ss:Type="Number">${item.total}</Data></Cell>
   </Row>`;
    });

    xml += `
  </Table>
 </Worksheet>
 <Worksheet ss:Name="Régimen REAV">
  <Table>
   <Column ss:Width="100"/>
   <Column ss:Width="100"/>
   <Column ss:Width="200"/>
   <Column ss:Width="120"/>
   <Column ss:Width="120"/>
   <Column ss:Width="120"/>
   <Column ss:Width="120"/>
   <Column ss:Width="120"/>
   <Row ss:Height="22">
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Fecha</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Nº Factura</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Cliente</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Importe Venta (A)</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Coste Proveedor (B)</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Margen Bruto (A-B)</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Base IVA (Margen/1.21)</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Cuota IVA REAV (21%)</Data></Cell>
   </Row>`;

    reavData.forEach(item => {
      xml += `
   <Row>
    <Cell><Data ss:Type="String">${item.fecha}</Data></Cell>
    <Cell><Data ss:Type="String">${item.factura}</Data></Cell>
    <Cell><Data ss:Type="String">${item.cliente}</Data></Cell>
    <Cell ss:StyleID="CurrencyStyle"><Data ss:Type="Number">${item.importe}</Data></Cell>
    <Cell ss:StyleID="CurrencyStyle"><Data ss:Type="Number">${item.coste}</Data></Cell>
    <Cell ss:StyleID="CurrencyStyle"><Data ss:Type="Number">${item.margen}</Data></Cell>
    <Cell ss:StyleID="CurrencyStyle"><Data ss:Type="Number">${item.baseIva}</Data></Cell>
    <Cell ss:StyleID="CurrencyStyle"><Data ss:Type="Number">${item.cuota}</Data></Cell>
   </Row>`;
    });

    xml += `
  </Table>
 </Worksheet>
</Workbook>`;

    const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={`${listStyles.container} libroIvaPageContainer`}>
      {/* 🚀 CABECERA CON BOTÓN EXPORTAR EXCEL */}
      <header className={listStyles.header} style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: "1rem", marginBottom: "1.25rem" }}>
        <div className={listStyles.headerRow} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: "36px", height: "36px", borderRadius: "0.5rem",
              backgroundColor: "color-mix(in srgb, var(--primary-color, #475569) 10%, transparent)",
              color: "var(--primary-color, #475569)"
            }}>
              <Icons.Iva size={20} />
            </div>
            <h1 className={listStyles.title} style={{ margin: 0 }}>Libro de IVA</h1>
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          </div>
        </div>
      </header>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "350px" }}>
          <div style={{
            border: "3px solid #e2e8f0",
            borderTop: "3px solid var(--primary-color, #475569)",
            borderRadius: "50%",
            width: "36px",
            height: "36px",
            animation: "spin 1s linear infinite",
            marginBottom: "1rem"
          }} />
          <span style={{ fontFamily: '"Montserrat", "Inter", sans-serif', fontSize: "0.85rem", fontWeight: "600", color: "#64748b" }}>
            Cargando registros contables reales de la base de datos...
          </span>
        </div>
      ) : (
        <>
          {/* 📊 RESUMEN IVA ACUMULADO (Arriba del todo con iconos Lucide) */}
      <div style={{
        backgroundColor: "#f8fafc",
        border: "1px solid #cbd5e1",
        borderRadius: "0.75rem",
        padding: "1rem 1.5rem",
        fontFamily: '"Montserrat", "Inter", sans-serif',
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
        marginBottom: "1.25rem"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", borderBottom: "1px solid #e2e8f0", paddingBottom: "0.5rem", marginBottom: "0.75rem" }}>
          <Icons.Shield size={16} style={{ color: "var(--primary-color, #475569)" }} />
          <span style={{ fontSize: "0.75rem", fontWeight: "800", color: "#334155", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            📊 RESUMEN IVA ACUMULADO [{periodo === "ALL" ? "EJERCICIO 2026" : `${periodo} 2026`}]
          </span>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "1rem"
        }}>
          {/* Tarjeta 1: Régimen General */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            padding: "0.75rem 1rem",
            backgroundColor: "#ffffff",
            borderRadius: "0.5rem",
            border: "1px solid #cbd5e1"
          }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: "40px", height: "40px", borderRadius: "0.375rem",
              backgroundColor: "color-mix(in srgb, #3b82f6 10%, transparent)",
              color: "#3b82f6"
            }}>
              <Icons.Scale size={20} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", flexGrow: 1 }}>
              <span style={{ fontSize: "0.68rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Régimen General</span>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "#475569", marginTop: "0.15rem" }}>
                <span>Total Base Imponible:</span>
                <strong style={{ color: "#0f172a" }}>{formatEuro(totals.baseGen)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "#475569" }}>
                <span>Total Cuota IVA {tipo === "emitidas" ? "(Repercutido)" : "(Soportado)"}:</span>
                <strong style={{ color: "#3b82f6" }}>{formatEuro(totals.cuotaGen)}</strong>
              </div>
            </div>
          </div>

          {/* Tarjeta 2: Régimen Especial REAV */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            padding: "0.75rem 1rem",
            backgroundColor: "#ffffff",
            borderRadius: "0.5rem",
            border: "1px solid #cbd5e1"
          }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: "40px", height: "40px", borderRadius: "0.375rem",
              backgroundColor: "color-mix(in srgb, #10b981 10%, transparent)",
              color: "#10b981"
            }}>
              <Icons.Plane size={20} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", flexGrow: 1 }}>
              <span style={{ fontSize: "0.68rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Régimen Especial (REAV)</span>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "#475569", marginTop: "0.15rem" }}>
                <span>Total Base REAV (Margen):</span>
                <strong style={{ color: "#0f172a" }}>{formatEuro(totals.baseReav)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "#475569" }}>
                <span>Total Cuota REAV:</span>
                <strong style={{ color: "#10b981" }}>{formatEuro(totals.cuotaReav)}</strong>
              </div>
            </div>
          </div>

          {/* Tarjeta 3: Total Declarar Modelo 303 */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            padding: "0.75rem 1rem",
            backgroundColor: "color-mix(in srgb, var(--primary-color, #475569) 8%, #ffffff)",
            borderRadius: "0.5rem",
            border: "1px solid #cbd5e1"
          }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: "40px", height: "40px", borderRadius: "0.375rem",
              backgroundColor: "color-mix(in srgb, var(--primary-color, #475569) 15%, transparent)",
              color: "var(--primary-color, #475569)"
            }}>
              <Icons.Euro size={20} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", flexGrow: 1 }}>
              <span style={{ fontSize: "0.68rem", fontWeight: "800", color: "var(--primary-color, #475569)", textTransform: "uppercase" }}>
                Modelo 303 — Total {tipo === "emitidas" ? "Repercutido" : "Soportado"}
              </span>
              <strong style={{ fontSize: "1.05rem", fontWeight: "900", color: "var(--primary-color, #475569)", marginTop: "0.15rem" }}>
                {formatEuro(totals.totalDeclarar)}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* 🎨 BLOQUE 1: FILTROS & SELECTOR DE RÉGIMEN */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div style={{
          background: "#ffffff",
          borderRadius: "0.75rem",
          border: "1px solid #e2e8f0",
          padding: "1.25rem",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)"
        }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            flexWrap: "wrap",
            gap: "1.25rem"
          }}>
            <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap", alignItems: "flex-end" }}>
              {/* Filtro de Periodo */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", minWidth: "220px" }}>
                <span style={{ fontSize: "0.72rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                  Periodo Fiscal
                </span>
                <select
                  value={periodo}
                  onChange={(e) => setPeriodo(e.target.value as any)}
                  style={{
                    padding: "0.45rem 0.75rem",
                    fontSize: "0.8rem",
                    fontWeight: "600",
                    height: "38px",
                    borderRadius: "0.375rem",
                    border: "1px solid #cbd5e1",
                    backgroundColor: "#ffffff",
                    color: "#0f172a",
                    outline: "none"
                  }}
                >
                  <option value="ALL">Año Completo (2026)</option>
                  <option value="Q1">Q1 (Enero - Marzo)</option>
                  <option value="Q2">Q2 (Abril - Junio)</option>
                  <option value="Q3">Q3 (Julio - Septiembre)</option>
                  <option value="Q4">Q4 (Octubre - Diciembre)</option>
                </select>
              </div>

              {/* Selector de Régimen (Segmented Control / Pills) */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                <span style={{ fontSize: "0.72rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                  Régimen de IVA
                </span>
                <div style={{
                  display: "inline-flex",
                  backgroundColor: "#f1f5f9",
                  padding: "0.25rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #e2e8f0"
                }}>
                  <button
                    onClick={() => setRegimen("TODOS")}
                    style={{
                      padding: "0.45rem 1rem",
                      fontSize: "0.78rem",
                      fontWeight: "700",
                      borderRadius: "0.375rem",
                      border: "none",
                      cursor: "pointer",
                      backgroundColor: regimen === "TODOS" ? "#ffffff" : "transparent",
                      color: regimen === "TODOS" ? "#0f172a" : "#64748b",
                      boxShadow: regimen === "TODOS" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                      transition: "all 0.15s ease"
                    }}
                  >
                    Todos
                  </button>
                  <button
                    onClick={() => setRegimen("GENERAL")}
                    style={{
                      padding: "0.45rem 1rem",
                      fontSize: "0.78rem",
                      fontWeight: "700",
                      borderRadius: "0.375rem",
                      border: "none",
                      cursor: "pointer",
                      backgroundColor: regimen === "GENERAL" ? "#ffffff" : "transparent",
                      color: regimen === "GENERAL" ? "#0f172a" : "#64748b",
                      boxShadow: regimen === "GENERAL" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                      transition: "all 0.15s ease"
                    }}
                  >
                    Régimen General
                  </button>
                  <button
                    onClick={() => setRegimen("REAV")}
                    style={{
                      padding: "0.45rem 1rem",
                      fontSize: "0.78rem",
                      fontWeight: "700",
                      borderRadius: "0.375rem",
                      border: "none",
                      cursor: "pointer",
                      backgroundColor: regimen === "REAV" ? "#ffffff" : "transparent",
                      color: regimen === "REAV" ? "#0f172a" : "#64748b",
                      boxShadow: regimen === "REAV" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                      transition: "all 0.15s ease"
                    }}
                  >
                    REAV (Régimen Especial)
                  </button>
                </div>
              </div>
            </div>

            {/* Botón de Exportación (sólo icono, upload, color principal) */}
            <button
              onClick={handleExportExcel}
              title="Exportar Excel (Libro Oficial)"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "38px",
                height: "38px",
                borderRadius: "0.5rem",
                border: "none",
                backgroundColor: "var(--primary-color, #475569)",
                color: "#ffffff",
                cursor: "pointer",
                boxShadow: "0 4px 6px -1px rgba(71, 85, 105, 0.2), 0 2px 4px -1px rgba(71, 85, 105, 0.1)",
                transition: "all 0.2s ease"
              }}
              className="exportButtonHover"
            >
              <Icons.Upload size={18} />
            </button>
          </div>
        </div>

        {/* 📋 TABS DE TIPO: EMITIDAS (VENTAS) VS RECIBIDAS (COMPRAS) */}
        <div style={{
          display: "flex",
          borderBottom: "2px solid #e2e8f0",
          marginBottom: "0.5rem"
        }}>
          <button
            onClick={() => setTipo("emitidas")}
            style={{
              padding: "0.75rem 1.5rem",
              fontSize: "0.85rem",
              fontWeight: "700",
              border: "none",
              borderBottom: tipo === "emitidas" ? "3px solid var(--primary-color, #475569)" : "3px solid transparent",
              backgroundColor: "transparent",
              color: tipo === "emitidas" ? "var(--primary-color, #475569)" : "#64748b",
              cursor: "pointer",
              transition: "all 0.15s ease"
            }}
          >
            Facturas Emitidas (Ventas)
          </button>
          <button
            onClick={() => setTipo("recibidas")}
            style={{
              padding: "0.75rem 1.5rem",
              fontSize: "0.85rem",
              fontWeight: "700",
              border: "none",
              borderBottom: tipo === "recibidas" ? "3px solid var(--primary-color, #475569)" : "3px solid transparent",
              backgroundColor: "transparent",
              color: tipo === "recibidas" ? "var(--primary-color, #475569)" : "#64748b",
              cursor: "pointer",
              transition: "all 0.15s ease"
            }}
          >
            Facturas Recibidas (Compras)
          </button>
        </div>

        {/* 🎨 BLOQUE 2: TABLAS DINÁMICAS DE DATOS */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem", minHeight: "350px" }}>
          {/* TABLA: RÉGIMEN GENERAL */}
          {(regimen === "TODOS" || regimen === "GENERAL") && (
            <div style={{
              background: "#ffffff",
              borderRadius: "0.75rem",
              border: "1px solid #e2e8f0",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
              overflow: "hidden"
            }}>
              <div style={{
                backgroundColor: "#f8fafc",
                borderBottom: "1px solid #e2e8f0",
                padding: "0.75rem 1.25rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem"
              }}>
                <div style={{ width: "6px", height: "16px", borderRadius: "3px", backgroundColor: "#3b82f6" }} />
                <h3 style={{ fontSize: "0.85rem", fontWeight: "700", color: "#1e293b", margin: 0, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                  Libro de IVA — Régimen General
                </h3>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem", textAlign: "left" }} className="tableIva">
                  <thead>
                    <tr style={{ backgroundColor: "#fafcfd", borderBottom: "1px solid #e2e8f0" }}>
                      <th style={{ padding: "0.25rem 1.25rem", color: "#64748b", fontWeight: "700", fontSize: "0.7rem", textTransform: "uppercase" }}>Fecha</th>
                      <th style={{ padding: "0.25rem 1.25rem", color: "#64748b", fontWeight: "700", fontSize: "0.7rem", textTransform: "uppercase" }}>Nº Factura</th>
                      <th style={{ padding: "0.25rem 1.25rem", color: "#64748b", fontWeight: "700", fontSize: "0.7rem", textTransform: "uppercase" }}>{tipo === "emitidas" ? "Cliente" : "Proveedor"}</th>
                      <th style={{ padding: "0.25rem 1.25rem", color: "#64748b", fontWeight: "700", fontSize: "0.7rem", textTransform: "uppercase" }}>NIF</th>
                      <th style={{ padding: "0.25rem 1.25rem", color: "#64748b", fontWeight: "700", fontSize: "0.7rem", textTransform: "uppercase", textAlign: "right" }}>Base Imponible</th>
                      <th style={{ padding: "0.25rem 1.25rem", color: "#64748b", fontWeight: "700", fontSize: "0.7rem", textTransform: "uppercase", textAlign: "center" }}>% IVA</th>
                      <th style={{ padding: "0.25rem 1.25rem", color: "#64748b", fontWeight: "700", fontSize: "0.7rem", textTransform: "uppercase", textAlign: "right" }}>Cuota IVA</th>
                      <th style={{ padding: "0.25rem 1.25rem", color: "#64748b", fontWeight: "700", fontSize: "0.7rem", textTransform: "uppercase", textAlign: "right" }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listGeneralFiltered.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ padding: "2rem", textAlign: "center", color: "#94a3b8", fontStyle: "italic" }}>
                          No hay facturas registradas en este periodo
                        </td>
                      </tr>
                    ) : (
                      listGeneralFiltered.map((f, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }} className="rowHover">
                          <td style={{ padding: "0.25rem 1.25rem", fontWeight: "500", color: "#475569" }}>{f.fecha}</td>
                          <td style={{ padding: "0.25rem 1.25rem", fontWeight: "700", color: "#0f172a" }}>{f.factura}</td>
                          <td style={{ padding: "0.25rem 1.25rem", fontWeight: "600", color: "#334155" }}>{f.entidad}</td>
                          <td style={{ padding: "0.25rem 1.25rem", fontFamily: "monospace", color: "#64748b" }}>{f.nif}</td>
                          <td style={{ padding: "0.25rem 1.25rem", textAlign: "right", fontWeight: "700", color: "#0f172a" }}>{formatEuro(f.base)}</td>
                          <td style={{ padding: "0.25rem 1.25rem", textAlign: "center" }}>
                            <span style={{
                              backgroundColor: "#f1f5f9", color: "#475569",
                              fontSize: "0.68rem", fontWeight: "700",
                              padding: "0.15rem 0.4rem", borderRadius: "0.25rem"
                            }}>
                              {f.tipoIva}%
                            </span>
                          </td>
                          <td style={{ padding: "0.25rem 1.25rem", textAlign: "right", fontWeight: "700", color: "var(--primary-color, #475569)" }}>{formatEuro(f.cuota)}</td>
                          <td style={{ padding: "0.25rem 1.25rem", textAlign: "right", fontWeight: "800", color: "#0f172a" }}>{formatEuro(f.total)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TABLA: RÉGIMEN REAV */}
          {(regimen === "TODOS" || regimen === "REAV") && (
            <div style={{
              background: "#ffffff",
              borderRadius: "0.75rem",
              border: "1px solid #e2e8f0",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
              overflow: "hidden"
            }}>
              <div style={{
                backgroundColor: "#f8fafc",
                borderBottom: "1px solid #e2e8f0",
                padding: "0.75rem 1.25rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem"
              }}>
                <div style={{ width: "6px", height: "16px", borderRadius: "3px", backgroundColor: "#10b981" }} />
                <h3 style={{ fontSize: "0.85rem", fontWeight: "700", color: "#1e293b", margin: 0, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                  Libro de IVA — Régimen Especial REAV (Agencias de Viajes)
                </h3>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem", textAlign: "left" }} className="tableIva">
                  <thead>
                    <tr style={{ backgroundColor: "#fafcfd", borderBottom: "1px solid #e2e8f0" }}>
                      <th style={{ padding: "0.25rem 1.25rem", color: "#64748b", fontWeight: "700", fontSize: "0.7rem", textTransform: "uppercase" }}>Fecha</th>
                      <th style={{ padding: "0.25rem 1.25rem", color: "#64748b", fontWeight: "700", fontSize: "0.7rem", textTransform: "uppercase" }}>Nº Factura</th>
                      <th style={{ padding: "0.25rem 1.25rem", color: "#64748b", fontWeight: "700", fontSize: "0.7rem", textTransform: "uppercase" }}>{tipo === "emitidas" ? "Cliente" : "Proveedor"}</th>
                      <th style={{ padding: "0.25rem 1.25rem", color: "#64748b", fontWeight: "700", fontSize: "0.7rem", textTransform: "uppercase", textAlign: "right" }}>{tipo === "emitidas" ? "Importe Venta (A)" : "Costo Ticket (A)"}</th>
                      <th style={{ padding: "0.25rem 1.25rem", color: "#64748b", fontWeight: "700", fontSize: "0.7rem", textTransform: "uppercase", textAlign: "right" }}>{tipo === "emitidas" ? "Coste Proveedor (B)" : "Base Sujeto (B)"}</th>
                      <th style={{ padding: "0.25rem 1.25rem", color: "#64748b", fontWeight: "700", fontSize: "0.7rem", textTransform: "uppercase", textAlign: "right" }}>Margen Bruto (A - B)</th>
                      <th style={{ padding: "0.25rem 1.25rem", color: "#64748b", fontWeight: "700", fontSize: "0.7rem", textTransform: "uppercase", textAlign: "right" }}>Base IVA (Margen / 1.21)</th>
                      <th style={{ padding: "0.25rem 1.25rem", color: "#64748b", fontWeight: "700", fontSize: "0.7rem", textTransform: "uppercase", textAlign: "right" }}>Cuota REAV (21%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listREAVFiltered.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ padding: "2rem", textAlign: "center", color: "#94a3b8", fontStyle: "italic" }}>
                          No hay facturas registradas en este periodo
                        </td>
                      </tr>
                    ) : (
                      listREAVFiltered.map((f, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }} className="rowHover">
                          <td style={{ padding: "0.25rem 1.25rem", fontWeight: "500", color: "#475569" }}>{f.fecha}</td>
                          <td style={{ padding: "0.25rem 1.25rem", fontWeight: "700", color: "#0f172a" }}>{f.factura}</td>
                          <td style={{ padding: "0.25rem 1.25rem", fontWeight: "600", color: "#334155" }}>{f.cliente}</td>
                          <td style={{ padding: "0.25rem 1.25rem", textAlign: "right", fontWeight: "700", color: "#0f172a" }}>{formatEuro(f.importe)}</td>
                          <td style={{ padding: "0.25rem 1.25rem", textAlign: "right", fontWeight: "600", color: "#64748b" }}>{formatEuro(f.coste)}</td>
                          <td style={{ padding: "0.25rem 1.25rem", textAlign: "right", fontWeight: "700", color: "#3b82f6" }}>{formatEuro(f.margen)}</td>
                          <td style={{ padding: "0.25rem 1.25rem", textAlign: "right", fontWeight: "700", color: "#0f172a" }}>{formatEuro(f.baseIva)}</td>
                          <td style={{ padding: "0.25rem 1.25rem", textAlign: "right", fontWeight: "800", color: "#10b981" }}>{formatEuro(f.cuota)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )}


      {/* Global Local Styles */}
      <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .tableIva th,
        .tableIva td {
          padding: 0.25rem 1.25rem !important;
          vertical-align: middle;
        }
        .rowHover {
          transition: background-color 0.15s ease;
        }
        .rowHover:hover {
          background-color: #f8fafc;
        }
        .exportButtonHover:hover {
          background-color: #334155 !important;
          transform: translateY(-1px);
          box-shadow: 0 6px 12px -1px rgba(71, 85, 105, 0.3), 0 4px 6px -1px rgba(71, 85, 105, 0.15) !important;
        }
        .exportButtonHover:active {
          transform: translateY(0);
        }
      `}</style>
    </div>
  );
}
