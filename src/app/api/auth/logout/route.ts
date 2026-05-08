import { NextRequest, NextResponse } from "next/server";
import { destroySession, SESSION_COOKIE } from "@/lib/auth/session";

function redirectToLogin(req: NextRequest) {
  // After a POST logout, force the follow-up request to /login to be a GET.
  return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE)?.value;

    if (token) {
      await destroySession(token);
    }

    const response = redirectToLogin(req);

    response.cookies.set(SESSION_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error("Logout error:", error);
    return redirectToLogin(req);
  }
}
