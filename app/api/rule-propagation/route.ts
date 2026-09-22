import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { runWave1Propagation } from "@/lib/rule-propagation";
import type { PropagationParams } from "@/lib/rule-propagation";

export type { PropagationParams, PropagationResult, RuleEntry, ConflictEntry, AppliedTx } from "@/lib/rule-propagation";

export async function POST(req: NextRequest) {
  let params: PropagationParams;
  try {
    params = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = runWave1Propagation(params);

  if (!params.dryRun && result.stats.applied > 0) {
    revalidatePath("/");
    revalidatePath("/overview");
    revalidatePath("/category-stats");
    revalidatePath("/export");
    revalidatePath("/rule-propagation");
  }

  return NextResponse.json(result);
}
