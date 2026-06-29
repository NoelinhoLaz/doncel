import { NextRequest } from "next/server";
import { signToken, decrypt } from "@/lib/encryption";

function getSessionFromRequest(request: NextRequest) {
  try {
    const raw = request.cookies.get("portal_session")?.value;
    if (!raw) return null;
    const { d, iv, t } = JSON.parse(raw);
    if (!d || !iv || !t) return null;
    const decrypted = decrypt(d, iv, t);
    return JSON.parse(decrypted) as { entityId: string; entityName: string; email: string };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const expedienteId = searchParams.get("expedienteId");
  if (!expedienteId) {
    return Response.json({ error: "Falta expedienteId" }, { status: 400 });
  }

  const token = signToken(JSON.stringify({ expedienteId, entityId: session.entityId }));
  return Response.json({ token });
}
