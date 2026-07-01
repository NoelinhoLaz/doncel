import { NextResponse } from "next/server";
import { getAgencyDbClient } from "@/lib/agencyDb";
import { decryptAllergies } from "@/lib/encryption";
import ExcelJS from "exceljs";
import officeCrypto from "officecrypto-tool";
import { createRequire } from "module";

const cjsRequire = createRequire(import.meta.url);
const archiverModule = cjsRequire("archiver") as any;
const archiverZipEncryptedModule = cjsRequire("archiver-zip-encrypted") as any;

const archiver = typeof archiverModule === 'function'
  ? archiverModule
  : (archiverModule.default || archiverModule);

const archiverZipEncrypted = typeof archiverZipEncryptedModule === 'function'
  ? archiverZipEncryptedModule
  : (archiverZipEncryptedModule.default || archiverZipEncryptedModule);

// Register the password-protection ZIP compression format
try {
  if (archiver.registerFormat) {
    archiver.registerFormat("zip-encrypted", archiverZipEncrypted);
  } else if (archiverModule.registerFormat) {
    archiverModule.registerFormat("zip-encrypted", archiverZipEncrypted);
  }
} catch (e) {
  // Silently ignore if already registered
}

export async function POST(req: Request) {
  try {
    const { viajeroIds, columnas, clave, formato } = await req.json();

    if (!viajeroIds || !Array.isArray(viajeroIds) || viajeroIds.length === 0) {
      return NextResponse.json({ error: "No traveler IDs provided" }, { status: 400 });
    }

    if (!columnas || !Array.isArray(columnas) || columnas.length === 0) {
      return NextResponse.json({ error: "No columns selected" }, { status: 400 });
    }

    const agencyDb = await getAgencyDbClient();
    
    // Query travelers with related entity details
    const { data: rawViajeros, error } = await agencyDb
      .from("operativa_viajeros_expedientes")
      .select(`
        id, 
        alergias, 
        entidad_id, 
        contabilidad_entidades!operativa_viajeros_expedientes_entidad_id_fkey(
          id, 
          nombre, 
          documento, 
          metadatos
        )
      `)
      .in("id", viajeroIds);

    if (error) {
      console.error("Error fetching travelers for export API:", error);
      return NextResponse.json({ error: "Failed to fetch travelers" }, { status: 500 });
    }

    // Map and decrypt allergies on the fly
    const travelers = (rawViajeros || []).map((v: any) => {
      const ent = v.contabilidad_entidades || {};
      const meta = ent.metadatos || {};
      const decryptedAllergies = decryptAllergies(v.alergias);
      
      return {
        id: v.id,
        name: ent.nombre || "—",
        dni: ent.documento || "—",
        birthDate: meta.fecha_nacimiento || "—",
        alergias: decryptedAllergies
      };
    });

    const isHealthSelected = columnas.includes("alergias");

    // Excel formatting (.xlsx)
    if (formato === "xlsx") {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Viajeros");

      // Define structure and width
      const columnsDef = columnas.map((col: string) => {
        if (col === "nombre") return { header: "Nombre completo", key: "nombre", width: 35 };
        if (col === "dni") return { header: "DNI / Documento", key: "dni", width: 22 };
        if (col === "fecha_nacimiento") return { header: "Fecha Nacimiento", key: "fecha_nacimiento", width: 22 };
        if (col === "alergias") return { header: "Alergias / Regímenes", key: "alergias", width: 45 };
        return { header: col, key: col, width: 15 };
      });

      worksheet.columns = columnsDef;

      // Add traveler records
      travelers.forEach((v) => {
        const rowData: Record<string, string> = {};
        columnas.forEach((col: string) => {
          if (col === "nombre") rowData[col] = v.name;
          if (col === "dni") rowData[col] = v.dni;
          if (col === "fecha_nacimiento") rowData[col] = v.birthDate;
          if (col === "alergias") {
            rowData[col] = Array.isArray(v.alergias) ? v.alergias.join(", ") : String(v.alergias || "");
          }
        });
        worksheet.addRow(rowData);
      });

      // Export workbook to buffer
      const originalBuffer = await workbook.xlsx.writeBuffer() as any;
      let finalBuffer = originalBuffer;

      // Encrypt file if health data requested
      if (isHealthSelected && clave) {
        finalBuffer = await officeCrypto.encrypt(originalBuffer, { password: clave });
      }

      return new Response(finalBuffer as any, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${isHealthSelected ? 'listado_viajeros_protegido.xlsx' : 'listado_viajeros.xlsx'}"`,
        },
      });
    }

    // CSV formatting (.csv)
    if (formato === "csv") {
      const escapeCsv = (val: string) => {
        const str = val === null || val === undefined ? "" : String(val);
        return `"${str.replace(/"/g, '""')}"`;
      };

      const headers = columnas.map((col: string) => {
        if (col === "nombre") return "Nombre completo";
        if (col === "dni") return "DNI / Documento";
        if (col === "fecha_nacimiento") return "Fecha Nacimiento";
        if (col === "alergias") return "Alergias / Regímenes";
        return col;
      }).join(",");

      const rows = travelers.map((v) => {
        return columnas.map((col: string) => {
          if (col === "nombre") return escapeCsv(v.name);
          if (col === "dni") return escapeCsv(v.dni);
          if (col === "fecha_nacimiento") return escapeCsv(v.birthDate);
          if (col === "alergias") {
            const allergyStr = Array.isArray(v.alergias) ? v.alergias.join(", ") : String(v.alergias || "");
            return escapeCsv(allergyStr);
          }
          return '""';
        }).join(",");
      });

      const csvContent = "\ufeff" + [headers, ...rows].join("\n"); // Prepend UTF-8 BOM
      const csvBuffer = Buffer.from(csvContent, "utf-8");

      // Password-protected ZIP compression
      if (isHealthSelected && clave) {
        const chunks: Buffer[] = [];
        let archive: any;
        if (typeof archiver === 'function') {
          archive = archiver("zip-encrypted", {
            zlib: { level: 9 },
            encryptionMethod: "zip20", // Using zip20 to guarantee native support on macOS Finder & Windows Explorer
            password: clave,
          });
        } else if (archiver.create) {
          archive = archiver.create("zip-encrypted", {
            zlib: { level: 9 },
            encryptionMethod: "zip20",
            password: clave,
          });
        } else if (archiverModule.create) {
          archive = archiverModule.create("zip-encrypted", {
            zlib: { level: 9 },
            encryptionMethod: "zip20",
            password: clave,
          });
        } else {
          throw new Error("archiver is not a function and has no create method");
        }

        const zipPromise = new Promise<Buffer>((resolve, reject) => {
          archive.on("data", (chunk: Buffer) => chunks.push(chunk));
          archive.on("end", () => resolve(Buffer.concat(chunks)));
          archive.on("error", (err: any) => reject(err));
        });

        archive.append(csvBuffer, { name: "listado_viajeros.csv" });
        await archive.finalize();

        const zipBuffer = await zipPromise;

        return new Response(zipBuffer as any, {
          headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": 'attachment; filename="listado_viajeros_protegido.zip"',
          },
        });
      } else {
        // Unencrypted direct CSV download
        return new Response(csvBuffer as any, {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": 'attachment; filename="listado_viajeros.csv"',
          },
        });
      }
    }

    return NextResponse.json({ error: "Invalid format requested" }, { status: 400 });
  } catch (err: any) {
    console.error("Export API handler error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
