import { NextRequest, NextResponse } from "next/server";
import { getAgencyDbClient } from "@/lib/agencyDb";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const agencyDb = await getAgencyDbClient();

    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `propuestas/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    // Asegura que el bucket existe (lo crea si no)
    const { error: bucketErr } = await agencyDb.storage.createBucket("propuestas-media", {
      public: true,
      allowedMimeTypes: ["image/*"],
      fileSizeLimit: 10 * 1024 * 1024,
    });
    // Ignorar error si ya existe (código "Duplicate")
    if (bucketErr && !bucketErr.message.includes("already exists") && !bucketErr.message.includes("Duplicate")) {
      throw bucketErr;
    }

    const arrayBuffer = await file.arrayBuffer();
    const { error } = await agencyDb.storage
      .from("propuestas-media")
      .upload(path, arrayBuffer, { contentType: file.type, upsert: false });

    if (error) throw error;

    const { data: urlData } = agencyDb.storage
      .from("propuestas-media")
      .getPublicUrl(path);

    return NextResponse.json({ url: urlData.publicUrl });
  } catch (e: any) {
    console.error("upload-image:", e?.message);
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
