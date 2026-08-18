import { NextResponse } from "next/server";
import { getAgencyDbClient, getCurrentSchemaName, bucketNameForSchema } from "@/lib/agencyDb";

const PREFIX = "propuestas";

export async function GET() {
  try {
    const agencyDb = await getAgencyDbClient();
    const bucket = bucketNameForSchema("propuestas-media", await getCurrentSchemaName());

    const { data: files, error } = await agencyDb.storage
      .from(bucket)
      .list(PREFIX, {
        limit: 200,
        sortBy: { column: "created_at", order: "desc" },
      });

    if (error) throw error;

    const images = (files ?? [])
      .filter((f) => f.id) // descarta placeholders de carpeta
      .map((f) => {
        const path = `${PREFIX}/${f.name}`;
        const { data: urlData } = agencyDb.storage.from(bucket).getPublicUrl(path);
        return { url: urlData.publicUrl, name: f.name, createdAt: f.created_at };
      });

    return NextResponse.json({ images });
  } catch (e: any) {
    console.error("list-images:", e?.message);
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
