import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase-middleware";

const CITY_SLUGS: Record<string, string> = {
  houston: "houston",
};

function matchCity(name: string): string | undefined {
  return CITY_SLUGS[name.toLowerCase().trim()];
}

const PROTECTED_ROUTES = ["/profile"];

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

  // Skip the admin login page
  if (pathname === "/admin/login") return supabaseResponse;

  // Protect /admin routes (existing cookie-based admin auth)
  if (pathname.startsWith("/admin")) {
    const session = request.cookies.get("admin_session")?.value;
    if (!session) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  // Protect user routes (Supabase auth)
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
