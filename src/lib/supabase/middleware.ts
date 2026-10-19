import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAuthCookieName, isDeadSessionError } from "@/lib/supabase/session-errors";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // A cookie from a deleted account / revoked session can never refresh. Drop it (for this request and the
  // browser) and carry on as signed-out, instead of retrying and logging the same error on every request.
  if (!user && isDeadSessionError(error)) {
    const stale = request.cookies.getAll().filter((c) => isAuthCookieName(c.name));
    stale.forEach((c) => request.cookies.delete(c.name));
    supabaseResponse = NextResponse.next({ request });
    stale.forEach((c) => supabaseResponse.cookies.set(c.name, "", { path: "/", maxAge: 0 }));
  }

  return { supabaseResponse, user };
}
