import { NextRequest, NextResponse } from "next/server";
import { syncBridgeTransactionsByUserUuid } from "@/lib/banco/bridgeApi";

// Bridge envía eventos tipo item.account.created, item.refreshed, transaction.created/updated, etc.
// Aquí solo nos interesan los que indican que hay transacciones nuevas o actualizadas que sincronizar.
const EVENTOS_SYNC = new Set([
  "item.refreshed",
  "item.account.created",
  "transaction.created",
  "transaction.updated",
]);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, user_uuid } = body || {};

    if (!type || !user_uuid) {
      return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
    }

    if (!EVENTOS_SYNC.has(type)) {
      return NextResponse.json({ received: true, skipped: true });
    }

    const result = await syncBridgeTransactionsByUserUuid(user_uuid);

    if (result.error) {
      console.error("[Bridge Webhook] Error sincronizando:", result.error);
      return NextResponse.json({ received: true, error: result.error }, { status: 200 });
    }

    return NextResponse.json({ received: true, insertados: result.insertados });
  } catch (error: any) {
    console.error("[Bridge Webhook] Error procesando webhook:", error);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}
