import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isPreviewMode } from "@/lib/preview-mode";

export async function proxy(request: NextRequest) {
  if (isPreviewMode()) {
    if (request.nextUrl.pathname.startsWith("/api/") || !["GET", "HEAD"].includes(request.method)) {
      return NextResponse.json({ error: "Sample preview: server interactions are disabled." }, { status: 403 });
    }
    if (request.nextUrl.pathname.startsWith("/_next/") || request.nextUrl.pathname === "/manifest.webmanifest") return NextResponse.next();
    if (!request.nextUrl.pathname.startsWith("/preview")) {
      const url = request.nextUrl.clone();
      url.pathname = `/preview${url.pathname === "/" ? "/dashboard" : url.pathname}`;
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        },
      },
    },
  );
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
