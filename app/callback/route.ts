import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/providers";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    const bankId = await getProvider().handleCallback(params);
    return NextResponse.redirect(`${appUrl}/?bank=${bankId}`);
  } catch (err) {
    console.error("[callback]", err);
    return NextResponse.redirect(`${appUrl}/?error=connection_failed`);
  }
}
