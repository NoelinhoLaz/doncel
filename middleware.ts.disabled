import { NextResponse, type NextRequest } from "next/server";

const PORTAL_SESSION_COOKIE = "portal_session";

function getEffectiveDomain(request: NextRequest): string | null {
  const host = request.headers.get("host");
  if (!host) return null;
  // En local el host es localhost:3000 — no hay dominio de agencia real
  if (host.startsWith("localhost") || host.startsWith("127.0.0.1")) return null;
  return host.split(":")[0];
}

// Rate limiter para el login del portal
// En producción multi-instancia reemplazar con Redis (e.g. @upstash/ratelimit)
const WINDOW_MS = 15 * 60 * 1000; // 15 minutos
const MAX_ATTEMPTS = 10;

interface RateLimitEntry {
  count: number;
  windowStart: number;
}
const loginAttempts = new Map<string, RateLimitEntry>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, windowStart: now });
    return false;
  }

  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

export async function middleware(request: NextRequest) {
  try {
    const pathname = request.nextUrl.pathname;

    // Rate limiting en el login del portal
    if (pathname === "/api/portal/login" && request.method === "POST") {
      const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
        request.headers.get("x-real-ip") ||
        "unknown";

      if (isRateLimited(ip)) {
        return NextResponse.redirect(
          new URL("/portal/login?error=Demasiados+intentos.+Espera+15+minutos.", request.nextUrl),
          { status: 303 }
        );
      }
    }

    // Protect /portal/* routes (except /portal/login)
    if (pathname.startsWith("/portal/") && pathname !== "/portal/login") {
      const sessionCookie = request.cookies.get(PORTAL_SESSION_COOKIE)?.value;

      if (!sessionCookie) {
        const url = request.nextUrl.clone();
        url.pathname = "/portal/login";
        return NextResponse.redirect(url);
      }
    }

    // Propagar el dominio efectivo como header de REQUEST para que headers() lo lea en Server Components
    const domain = getEffectiveDomain(request);
    const requestHeaders = new Headers(request.headers);
    if (domain) {
      requestHeaders.set("x-agency-domain", domain);
    }
    // Sanitizar cabeceras para eliminar caracteres no-ASCII (acentos, etc.) que hacen fallar a Vercel
    requestHeaders.forEach((value, key) => {
      if (/[^\x00-\x7F]/.test(value)) {
        requestHeaders.delete(key);
      }
    });
    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch (error) {
    console.error("Middleware invocation crashed:", error);
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
