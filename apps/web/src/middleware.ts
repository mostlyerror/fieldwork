import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase-middleware";

const CITY_SLUGS: Record<string, string> = {
  houston: "houston",
};

function matchCity(name: string): string | undefined {
  return CITY_SLUGS[name.toLowerCase().trim()];
}

const PROTECTED_ROUTES = ["/profile", "/admin"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Refresh auth session on every request (keeps cookies fresh)
  const { supabaseResponse, user } = await updateSession(request);

  // Geo-redirect: root path -> city slug
  if (pathname === "/") {
    const ipCity = request.headers.get("x-vercel-ip-city");
    const slug = ipCity ? matchCity(ipCity) : undefined;
    const target = slug ?? "houston";
    const url = request.nextUrl.clone();
    url.pathname = `/${target}`;
    return NextResponse.redirect(url, 307);
  }

  // Protect routes (Supabase auth — role gating happens in layout)
  if (PROTECTED_ROUTES.some((route) => pathname.startsWith(route))) {
    if (!user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/", "/admin/:path*", "/profile/:path*", "/login", "/signup"],
};
