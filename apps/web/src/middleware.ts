import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase-middleware";

const CITY_SLUGS: Record<string, string> = {
  houston: "houston",
};

function matchCity(name: string): string | undefined {
  return CITY_SLUGS[name.toLowerCase().trim()];
}

const PROTECTED_ROUTES = ["/profile", "/admin"];
// Subroutes under /profile that explicitly do NOT need auth (email-confirm flows etc.)
const PROFILE_PUBLIC_PREFIXES = ["/profile/find", "/profile/claim"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Geo-redirect: root path -> city slug (no auth needed)
  if (pathname === "/") {
    const ipCity = request.headers.get("x-vercel-ip-city");
    const slug = ipCity ? matchCity(ipCity) : undefined;
    const target = slug ?? "houston";
    const url = request.nextUrl.clone();
    url.pathname = `/${target}`;
    return NextResponse.redirect(url, 307);
  }

  // Only call Supabase for routes that need auth
  const isPublicProfile = PROFILE_PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
  const needsAuth = !isPublicProfile && PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
  const { supabaseResponse, user } = await updateSession(request);

  if (needsAuth && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/", "/admin/:path*", "/profile/:path*", "/login", "/signup"],
};
