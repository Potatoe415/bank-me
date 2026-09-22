import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/providers";

export async function GET(request: NextRequest) {
  const bankId = request.nextUrl.searchParams.get("bank") ?? "revolut";
  const provider = getProvider();
  const url = await provider.connect(bankId);
  return NextResponse.redirect(url);
}
