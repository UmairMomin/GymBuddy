import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/** Routes reachable without a session. Everything else requires sign-in. */
const PUBLIC_PATHS = new Set(["/login", "/manifest.json", "/sw.js"]);

/** Only same-origin relative paths are accepted as a post-login destination. */
function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/login")) {
    return "/";
  }
  return value;
}

/** Redirect/deny while keeping any refreshed Supabase auth cookies from `source`. */
function withCookies(target: NextResponse, source: NextResponse) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  return target;
}

export async function proxy(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);
  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.has(pathname);

  if (!user && !isPublic) {
    // API and server-action (non-GET) requests get a 401 instead of an HTML redirect.
    if (pathname.startsWith("/api/") || (request.method !== "GET" && request.method !== "HEAD")) {
      return withCookies(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), supabaseResponse);
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", `${pathname}${search}`);
    }
    return withCookies(NextResponse.redirect(loginUrl), supabaseResponse);
  }

  if (user && pathname === "/login" && (request.method === "GET" || request.method === "HEAD")) {
    const destination = request.nextUrl.clone();
    const next = safeNext(request.nextUrl.searchParams.get("next"));
    const [nextPath, nextSearch = ""] = next.split("?");
    destination.pathname = nextPath;
    destination.search = nextSearch ? `?${nextSearch}` : "";
    return withCookies(NextResponse.redirect(destination), supabaseResponse);
  }

  return supabaseResponse;
}

export default proxy;

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - image/svg assets (icons)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
