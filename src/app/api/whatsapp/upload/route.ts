import { NextRequest, NextResponse } from "next/server";
import { getAgencyDbClient } from "@/lib/agencyDb";

export const dynamic = "force-dynamic";

const BUCKET = "whatsapp-media";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const ext = file.name.split(".").pop() || "bin";
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const agencyDb = await getAgencyDbClient();
    const buffer = Buffer.from(await file.arrayBuffer());

    // Ensure bucket exists (idempotent)
    const { data: buckets } = await agencyDb.storage.listBuckets();
    const exists = buckets?.some((b) => b.name === BUCKET);
    if (!exists) {
      await agencyDb.storage.createBucket(BUCKET, {
        public: true,
        allowedMimeTypes: [
          "image/jpeg", "image/png", "image/gif", "image/webp",
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "text/plain", "text/csv",
        ],
      });
    }

    const { error: uploadError } = await agencyDb.storage
      .from(BUCKET)
      .upload(filename, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json({ error: "Error al subir archivo al almacenamiento" }, { status: 500 });
    }

    // Get public URL
    const { data: publicUrlData } = agencyDb.storage
      .from(BUCKET)
      .getPublicUrl(filename);

    const url = publicUrlData?.publicUrl || "";
    return NextResponse.json({ url, filename });
  } catch (e: any) {
    console.error("Upload error:", e?.message);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get("filename");
    if (!filename) {
      return NextResponse.json({ error: "filename query param required" }, { status: 400 });
    }
    const agencyDb = await getAgencyDbClient();
    const { error } = await agencyDb.storage.from(BUCKET).remove([filename]);
    if (error) {
      console.error("Storage delete error:", error);
      return NextResponse.json({ error: "Error al eliminar archivo" }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("Delete error:", e?.message);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
