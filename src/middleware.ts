import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, SESSION_COOKIE } from "@/lib/brand";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  // Constant-time comparison
  let result = 0;
  for (let i = 0; i < bufA.length; i++) {
    result |= bufA[i] ^ bufB[i];
  }
  return result === 0;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Admin routes: validate admin token (timing-safe)
  if (pathname.startsWith("/admin")) {
    const token = request.cookies.get(ADMIN_COOKIE)?.value;
    const secret = process.env.ADMIN_SECRET;

    if (!secret || !token || !timingSafeEqual(token, secret)) {
      const loginUrl = new URL("/admin-login", request.url);
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
  }

  // Public skill file — must be accessible without auth for agent onboarding
  if (pathname === "/affiliate/skill.md") {
    return NextResponse.next();
  }

  // Dashboard and affiliate dashboard routes: session cookie gate
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/affiliate")) {
    const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;

    if (!sessionToken) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*", "/affiliate/:path*"],
};
