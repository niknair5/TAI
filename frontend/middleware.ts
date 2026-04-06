import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchMe(accessToken: string): Promise<{ role: string } | null> {
  try {
    const r = await fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!r.ok) return null;
    return r.json();
  } catch {
    return null;
  }
}

async function fetchEnrollment(accessToken: string, courseId: string): Promise<boolean> {
  try {
    const r = await fetch(`${API_URL}/api/me/enrollment/${courseId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    return r.ok;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnon) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnon,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  await supabase.auth.getUser();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const path = request.nextUrl.pathname;
  const token = session?.access_token;

  if (path.startsWith("/dashboard")) {
    if (!token) {
      return NextResponse.redirect(new URL("/auth/instructor-login", request.url));
    }
    const me = await fetchMe(token);
    if (!me || me.role !== "instructor") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  if (path.startsWith("/dashboard/course/")) {
    if (!token) {
      return NextResponse.redirect(new URL("/auth/instructor-login", request.url));
    }
    const me = await fetchMe(token);
    if (!me || me.role !== "instructor") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  const courseMatch = path.match(/^\/course\/([^/]+)/);
  if (courseMatch) {
    const courseId = courseMatch[1];
    if (!token) {
      return NextResponse.redirect(new URL(`/join?next=/course/${courseId}`, request.url));
    }
    const me = await fetchMe(token);
    if (!me || me.role !== "student") {
      return NextResponse.redirect(new URL("/", request.url));
    }
    const ok = await fetchEnrollment(token, courseId);
    if (!ok) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  if (
    path.startsWith("/auth/instructor-login") ||
    path.startsWith("/auth/instructor-signup")
  ) {
    if (token) {
      const me = await fetchMe(token);
      if (me?.role === "instructor") {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    }
  }

  if (path.startsWith("/auth/student-signup") || path.startsWith("/auth/student-login")) {
    if (token) {
      const me = await fetchMe(token);
      if (me?.role === "student") {
        return NextResponse.redirect(new URL("/", request.url));
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
