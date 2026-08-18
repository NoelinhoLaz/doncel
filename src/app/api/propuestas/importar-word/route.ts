import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { extraerSeccionesDesdeWord, ImportarPropuestaError } from "@/lib/propuestas/importarPdf";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("word") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "WORD_INVALIDO", mensaje: "No se recibió ningún archivo" },
        { status: 400 }
      );
    }

    const resultado = await extraerSeccionesDesdeWord(file);

    return NextResponse.json(resultado, { status: 200 });
  } catch (error) {
    if (error instanceof ImportarPropuestaError) {
      return NextResponse.json(
        { error: error.codigo, mensaje: error.message },
        { status: error.codigo === "WORD_INVALIDO" ? 400 : 500 }
      );
    }

    console.error("[/api/propuestas/importar-word] Error inesperado:", error);
    return NextResponse.json(
      { error: "ERROR_DESCONOCIDO", mensaje: "Error inesperado en el servidor" },
      { status: 500 }
    );
  }
}
