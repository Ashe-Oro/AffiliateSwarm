import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, SESSION_COOKIE, SESSION_DURATION_MS } from "@/lib/auth/session";
import { errorResponse, successResponse } from "@/lib/api-response";

const LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = LoginSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Invalid input",
        400,
        parsed.error.flatten().fieldErrors
      );
    }

    const { email, password } = parsed.data;

    const user = await prisma.userAccount.findUnique({
      where: { email },
    });

    if (!user) {
      return errorResponse(
        "AUTH_INVALID_CREDENTIALS",
        "Invalid email or password",
        401
      );
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return errorResponse(
        "AUTH_INVALID_CREDENTIALS",
        "Invalid email or password",
        401
      );
    }

    const token = await createSession(user.id);

    const response = successResponse({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      },
    });

    const isProduction = process.env.NODE_ENV === "production";
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DURATION_MS / 1000,
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred", 500);
  }
}
