import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { sendNewsletterSignupNotification } from "@/lib/contact/notify";
import { allowContactAttempt, getClientIp } from "@/lib/contact/rate-limit";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  if (!allowContactAttempt(`newsletter:${getClientIp(request)}`)) {
    return NextResponse.json(
      { error: "Too many signups from this connection. Please wait a few minutes." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid submission." }, { status: 400 });
  }

  const raw = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const website = typeof raw.website === "string" ? raw.website.trim() : "";
  const email = typeof raw.email === "string" ? raw.email.trim().toLowerCase() : "";

  if (website) {
    return NextResponse.json({ error: "Invalid submission." }, { status: 400 });
  }

  if (!email || email.length > 320 || !EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  try {
    await sendNewsletterSignupNotification(email, randomUUID());
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Newsletter signup failed:", error);
    return NextResponse.json(
      {
        error:
          "We could not sign you up right now. Please try again or email hello@clinic-genie.com.",
      },
      { status: 500 }
    );
  }
}
