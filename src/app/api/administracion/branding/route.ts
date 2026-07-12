import { NextRequest, NextResponse } from "next/server";
import { createAdminServiceClient } from "@/lib/supabaseServer";

export async function GET(req: NextRequest) {
  try {
    const hostParam = req.nextUrl.searchParams.get("host");
    const hostHeader = req.headers.get("host") || "";
    const rawHost = (hostParam || hostHeader).toLowerCase().trim();

    // Clean port from host if present (e.g., localhost:3000 -> localhost)
    const host = rawHost.split(":")[0];

    if (!host) {
      return NextResponse.json({ success: false, error: "No host provided" }, { status: 400 });
    }

    const adminServiceSupabase = createAdminServiceClient();

    // 1. Try to search by dominio (exact match)
    let { data: agency, error } = await adminServiceSupabase
      .from("agencias")
      .select("id, nombre_comercial, color_corporativo, color_secundario, logo_url, subdomain, dominio")
      .eq("dominio", host)
      .maybeSingle();

    if (error) {
      console.error("[Branding API] Error searching by dominio:", error);
    }

    // 2. If not found, try to search by subdomain (e.g. doncel.momo.com -> doncel)
    if (!agency) {
      // Extract subdomain: e.g. "doncel.momo.com" -> ["doncel", "momo", "com"]
      const parts = host.split(".");
      if (parts.length > 2) {
        const potentialSubdomain = parts[0];
        const { data: subAgency, error: subError } = await adminServiceSupabase
          .from("agencias")
          .select("id, nombre_comercial, color_corporativo, color_secundario, logo_url, subdomain, dominio")
          .eq("subdomain", potentialSubdomain)
          .maybeSingle();

        if (!subError && subAgency) {
          agency = subAgency;
        }
      }
    }

    // 3. Fallback: if in local dev, match direct host or slug-like subdomains
    if (!agency) {
      const { data: fallbackAgency } = await adminServiceSupabase
        .from("agencias")
        .select("id, nombre_comercial, color_corporativo, color_secundario, logo_url, subdomain, dominio")
        .eq("subdomain", host)
        .maybeSingle();
      if (fallbackAgency) {
        agency = fallbackAgency;
      }
    }

    if (!agency) {
      // Return default branding (Alivia)
      return NextResponse.json({
        success: true,
        branding: {
          is_custom: false,
          nombre_comercial: "Alivia",
          color_corporativo: "#3189F4", // Default primary blue
          color_secundario: "#1e293b",
          logo_url: "/logo_alivia.png"
        }
      });
    }

    return NextResponse.json({
      success: true,
      branding: {
        is_custom: true,
        nombre_comercial: agency.nombre_comercial,
        color_corporativo: agency.color_corporativo || "#3189F4",
        color_secundario: agency.color_secundario || "#1e293b",
        logo_url: agency.logo_url || "/logo_alivia.png"
      }
    });

  } catch (error: any) {
    console.error("[Branding API] General Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
