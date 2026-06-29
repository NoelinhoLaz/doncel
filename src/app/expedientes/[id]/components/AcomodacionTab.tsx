"use client";

import { useState } from "react";
import { Icons } from "@/lib/icons";
import Pagination from "@/app/components/Pagination";
import styles from "../page.module.css";

const acomodacionData = [
  { id: 1, hotel: "Hotel Salou Park", regimen: "PENSIÓN COMPLETA", tipo: "Habitación Triple (Nº 204)", viajeros: "GARCÍA L., ANTONIO; PÉREZ G., LUCÍA; SÁNCHEZ T., DAVID", entrada: "12/04/2026", salida: "17/04/2026", estado: "ASIGNADA" },
  { id: 2, hotel: "Hotel Salou Park", regimen: "PENSIÓN COMPLETA", tipo: "Habitación Doble (Nº 205)", viajeros: "MARTÍNEZ R., ELENA; RODRÍGUEZ F., ANA", entrada: "12/04/2026", salida: "17/04/2026", estado: "ASIGNADA" },
  { id: 3, hotel: "Hotel Salou Park", regimen: "PENSIÓN COMPLETA", tipo: "Habitación Doble (Nº 206)", viajeros: "GÓMEZ B., CARLOS; HERRERA D., MANUEL", entrada: "12/04/2026", salida: "17/04/2026", estado: "ASIGNADA" },
  { id: 4, hotel: "Hotel Salou Park", regimen: "PENSIÓN COMPLETA", tipo: "Habitación Triple", viajeros: "MÉNDEZ C., SOFÍA; VÁZQUEZ R., ROSA; CASTILLO M., NATALIA", entrada: "12/04/2026", salida: "17/04/2026", estado: "PENDIENTE" },
  { id: 5, hotel: "Hotel Salou Park", regimen: "PENSIÓN COMPLETA", tipo: "Habitación Individual (Nº 102)", viajeros: "LEÓN GUTIÉRREZ, PABLO", entrada: "12/04/2026", salida: "17/04/2026", estado: "ASIGNADA" }
];

export default function AcomodacionTab() {
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [search, setSearch] = useState("");

  const filteredData = acomodacionData.filter(item => 
    item.hotel.toLowerCase().includes(search.toLowerCase()) ||
    item.tipo.toLowerCase().includes(search.toLowerCase()) ||
    item.viajeros.toLowerCase().includes(search.toLowerCase())
  );

  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedData = filteredData.slice(startIndex, endIndex);

  return (
    <div className={styles.tabContainer}>
      <div className={styles.listHeaderTop}>
        <div className={styles.listTitleWrapper}>
          <Icons.Acomodacion size={18} className={styles.titleIcon} />
          <h2 className={styles.listTitle}>Asignación de Acomodación ({filteredData.length})</h2>
        </div>
        <div className={styles.actionsWrapper}>
          <div className={styles.searchWrapper}>
            <Icons.Search size={16} className={styles.searchIcon} />
            <input 
              type="text" 
              placeholder="Buscar por hotel, tipo o viajero..." 
              className={styles.searchInput}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <button className={styles.actionIconButton} title="Filtrar">
            <Icons.Filter size={18} />
          </button>
          <button className={styles.actionIconButton} title="Exportar asignaciones">
            <Icons.Export size={18} />
          </button>
          <button className={styles.addActionButton} title="Añadir acomodación">
            <Icons.Add size={18} />
          </button>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>
                <div className={styles.headerSort}>
                  <span>HOTEL / RÉGIMEN</span>
                  <Icons.ChevronDown size={12} className={styles.sortIcon} />
                </div>
              </th>
              <th>
                <div className={styles.headerSort}>
                  <span>TIPO HABITACIÓN</span>
                  <Icons.ChevronDown size={12} className={styles.sortIcon} />
                </div>
              </th>
              <th>
                <div className={styles.headerSort}>
                  <span>VIAJEROS ASIGNADOS</span>
                  <Icons.ChevronDown size={12} className={styles.sortIcon} />
                </div>
              </th>
              <th>
                <div className={styles.headerSort}>
                  <span>F. ENTRADA</span>
                  <Icons.ChevronDown size={12} className={styles.sortIcon} />
                </div>
              </th>
              <th>
                <div className={styles.headerSort}>
                  <span>F. SALIDA</span>
                  <Icons.ChevronDown size={12} className={styles.sortIcon} />
                </div>
              </th>
              <th style={{ textAlign: "right" }}>
                <div className={styles.headerSort} style={{ justifyContent: "flex-end" }}>
                  <span>ESTADO</span>
                  <Icons.ChevronDown size={12} className={styles.sortIcon} />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((item) => (
              <tr key={item.id}>
                <td>
                  <div className={styles.stackedCell}>
                    <span className={styles.mainText}>{item.hotel}</span>
                    <span className={styles.subText}>{item.regimen}</span>
                  </div>
                </td>
                <td>{item.tipo}</td>
                <td style={{ maxWidth: "250px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={item.viajeros}>
                  {item.viajeros}
                </td>
                <td>{item.entrada}</td>
                <td>{item.salida}</td>
                <td style={{ textAlign: "right" }}>
                  <span className={`${styles.statusTag} ${item.estado === "ASIGNADA" ? styles.statusSuccess : styles.statusPending}`}>
                    {item.estado}
                  </span>
                </td>
              </tr>
            ))}
            {paginatedData.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", color: "#64748b", padding: "2rem" }}>
                  No se encontraron asignaciones de acomodación.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {filteredData.length > 0 && (
          <Pagination 
            currentPage={currentPage}
            totalItems={filteredData.length}
            itemsPerPage={rowsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={(newRows) => {
              setRowsPerPage(newRows);
              setCurrentPage(1);
            }}
          />
        )}
      </div>
    </div>
  );
}
