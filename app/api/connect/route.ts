import { NextRequest, NextResponse } from "next/server";
import { EnableBankingProvider } from "@/lib/providers/enablebanking";

export async function GET(request: NextRequest) {
  const bankId = request.nextUrl.searchParams.get("bank") ?? "revolut";
  const provider = new EnableBankingProvider();
  const url = await provider.connect(bankId);
  return NextResponse.redirect(url);
}
