import { readFile } from "node:fs/promises";
import path from "node:path";
import db from "@/lib/db";
import { getBankById, type BankConfig } from "@/lib/banks.config";
import ExportWorkspace from "@/app/components/ExportWorkspace";

type PageProps = {
  searchParams: Promise<{
    imported?: string;
    skipped?: string;
    total?: string;
    import_error?: string;
  }>;
};

function getConnectedBanks(): BankConfig[] {
  const rows = db
    .prepare("SELECT provider, account_uids, state, expires_at FROM provider_tokens")
    .all() as { provider: string; account_uids: string; state: string | null; expires_at: string | null }[];

  return rows
    .filter((row) => {
      if (row.expires_at && new Date(row.expires_at) < new Date()) return false;
      if (row.state === null) return true;
      return JSON.parse(row.account_uids).length > 0;
    })
    .map((row) => row.provider.replace("enablebanking_", ""))
    .map((id) => getBankById(id))
    .filter((bank): bank is BankConfig => bank !== undefined);
}

function toNumber(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function getTaxonomyPrompt(): Promise<string> {
  const filePath = path.join(process.cwd(), "taxonomy_prompt.md");
  const prompt = await readFile(filePath, "utf8");
  return prompt.trimEnd();
}

export default async function ExportPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const connectedBanks = getConnectedBanks();
  const taxonomyPrompt = await getTaxonomyPrompt();

  return (
    <main className="min-h-screen bg-gray-50">
      <ExportWorkspace
        banks={connectedBanks}
        taxonomyPrompt={taxonomyPrompt}
        imported={toNumber(params.imported)}
        skipped={toNumber(params.skipped)}
        total={toNumber(params.total)}
        importError={params.import_error}
      />
    </main>
  );
}
