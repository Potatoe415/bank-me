/**
 * Deterministic transaction categorizer.
 * Reads ALL non-manual rows, applies taxonomy rules, writes category_path + governance columns.
 * Run: node scripts/categorize.js
 * Run with --dry to preview without writing.
 */

const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "..", "data.db"));
const dry = process.argv.includes("--dry");

// ─── Taxonomy metadata (mirrors lib/taxonomy.ts METADATA) ─────────────────────

const METADATA = {
  'income.regular':                 { cashflow_type: 'income',        behavior_bucket: 'neutral',   is_subscription: 0, is_excluded_from_spending: 0 },
  'income.extra':                   { cashflow_type: 'income',        behavior_bucket: 'neutral',   is_subscription: 0, is_excluded_from_spending: 0 },
  'income.reimbursement':           { cashflow_type: 'reimbursement', behavior_bucket: 'neutral',   is_subscription: 0, is_excluded_from_spending: 1 },
  'fixed.housing':                  { cashflow_type: 'expense',       behavior_bucket: 'fixed',     is_subscription: 0, is_excluded_from_spending: 0 },
  'fixed.utilities':                { cashflow_type: 'expense',       behavior_bucket: 'fixed',     is_subscription: 0, is_excluded_from_spending: 0 },
  'fixed.insurance':                { cashflow_type: 'expense',       behavior_bucket: 'fixed',     is_subscription: 0, is_excluded_from_spending: 0 },
  'fixed.subscriptions.work':       { cashflow_type: 'expense',       behavior_bucket: 'fixed',     is_subscription: 1, is_excluded_from_spending: 0 },
  'fixed.subscriptions.leisure':    { cashflow_type: 'expense',       behavior_bucket: 'fixed',     is_subscription: 1, is_excluded_from_spending: 0 },
  'fixed.obligations':              { cashflow_type: 'expense',       behavior_bucket: 'fixed',     is_subscription: 0, is_excluded_from_spending: 0 },
  'fixed.fees':                     { cashflow_type: 'expense',       behavior_bucket: 'fixed',     is_subscription: 0, is_excluded_from_spending: 0 },
  'variable.groceries':             { cashflow_type: 'expense',       behavior_bucket: 'variable',  is_subscription: 0, is_excluded_from_spending: 0 },
  'variable.leisure':               { cashflow_type: 'expense',       behavior_bucket: 'variable',  is_subscription: 0, is_excluded_from_spending: 0 },
  'variable.transport':             { cashflow_type: 'expense',       behavior_bucket: 'variable',  is_subscription: 0, is_excluded_from_spending: 0 },
  'variable.shopping':              { cashflow_type: 'expense',       behavior_bucket: 'variable',  is_subscription: 0, is_excluded_from_spending: 0 },
  'irregular.travel':               { cashflow_type: 'expense',       behavior_bucket: 'irregular', is_subscription: 0, is_excluded_from_spending: 0 },
  'irregular.maintenance':          { cashflow_type: 'expense',       behavior_bucket: 'irregular', is_subscription: 0, is_excluded_from_spending: 0 },
  'irregular.medical':              { cashflow_type: 'expense',       behavior_bucket: 'irregular', is_subscription: 0, is_excluded_from_spending: 0 },
  'irregular.events':               { cashflow_type: 'expense',       behavior_bucket: 'irregular', is_subscription: 0, is_excluded_from_spending: 0 },
  'irregular.admin':                { cashflow_type: 'expense',       behavior_bucket: 'irregular', is_subscription: 0, is_excluded_from_spending: 0 },
  'assets.savings':                 { cashflow_type: 'allocation',    behavior_bucket: 'asset',     is_subscription: 0, is_excluded_from_spending: 1 },
  'assets.investments.core':        { cashflow_type: 'allocation',    behavior_bucket: 'asset',     is_subscription: 0, is_excluded_from_spending: 1 },
  'assets.investments.speculative': { cashflow_type: 'allocation',    behavior_bucket: 'asset',     is_subscription: 0, is_excluded_from_spending: 1 },
  'transfers.internal':             { cashflow_type: 'transfer',      behavior_bucket: 'neutral',   is_subscription: 0, is_excluded_from_spending: 1 },
  'transfers.credit_card':          { cashflow_type: 'transfer',      behavior_bucket: 'neutral',   is_subscription: 0, is_excluded_from_spending: 1 },
  'transfers.cash.withdrawal':      { cashflow_type: 'transfer',      behavior_bucket: 'neutral',   is_subscription: 0, is_excluded_from_spending: 1 },
  'transfers.cash.deposit':         { cashflow_type: 'transfer',      behavior_bucket: 'neutral',   is_subscription: 0, is_excluded_from_spending: 1 },
  'uncategorized':                  { cashflow_type: 'expense',       behavior_bucket: 'variable',  is_subscription: 0, is_excluded_from_spending: 0 },
};

function deriveMeta(category_path) {
  return METADATA[category_path] ?? METADATA['uncategorized'];
}

// ─── Classification rules ─────────────────────────────────────────────────────
// Rules are evaluated in order; first match wins.
// Each rule returns a category_path string from the canonical taxonomy.

const RULES = [

  // ── Manual overrides — checked first ────────────────────────────────────────
  {
    test: tx => /PRELEVEMENT AUTOMATIQUE ENREGISTRE-MERCI/i.test(tx.description),
    category_path: 'transfers.credit_card',
  },
  {
    test: tx => /COTISATION/i.test(tx.description),
    category_path: 'fixed.fees',
  },
  {
    test: tx => /WEBLOYALTY/i.test(tx.description + " " + (tx.counterpart || "")),
    category_path: 'fixed.fees',
  },
  {
    test: tx => /FNAC/i.test(tx.description + " " + (tx.counterpart || "")) && /EBOOK/i.test(tx.description),
    category_path: 'fixed.subscriptions.leisure',
  },
  {
    test: tx => /claude\.ai|anthropic/i.test(tx.description + " " + (tx.counterpart || "")),
    category_path: 'fixed.subscriptions.work',
  },
  {
    test: tx => /GLOVO/i.test(tx.description + " " + (tx.counterpart || "")),
    category_path: 'variable.leisure',
  },

  // ── Transfers & Internal ─────────────────────────────────────────────────────
  {
    test: tx => /american express|amex/i.test(tx.description) && /prlv|prelevement|debit/i.test(tx.description),
    category_path: 'transfers.credit_card',
  },
  {
    test: tx => tx.tx_type === "TRANSFER",
    category_path: 'transfers.internal',
  },
  {
    test: tx => tx.tx_type === "TOPUP",
    category_path: 'transfers.internal',
  },
  {
    test: tx => /remboursement carte|credit card payment|carte bancaire/i.test(tx.description),
    category_path: 'transfers.credit_card',
  },
  {
    test: tx => /virement (recu|emis|sepa)|overschrijving|iDEAL|eigen rekening/i.test(tx.description) && !tx.counterpart,
    category_path: 'transfers.internal',
  },
  {
    test: tx => /tikkie|aab inz tikkie/i.test(tx.description + " " + (tx.counterpart || "")),
    category_path: 'transfers.internal',
  },
  {
    test: tx => /REMI ROUX|remi\.roux|ROUX REMI/i.test(tx.counterpart || ""),
    category_path: 'transfers.internal',
  },

  // ── Fixed — Housing ──────────────────────────────────────────────────────────
  {
    test: tx => /loyer|huur|rent|hypotheek|mortgage|charges (copro|loc)|syndic/i.test(tx.description + " " + (tx.counterpart || "")),
    category_path: 'fixed.housing',
  },
  {
    test: tx => /ing hypotheken|hypotheek|vve |verening van eigenare|vereniging van eigenaren/i.test(tx.counterpart || tx.description),
    category_path: 'fixed.housing',
  },
  {
    test: tx => /edf|engie|direct energie|vattenfall|nuon|essent|electr|gaz naturel|water(net|leiding)|veolia|suez eau|greenchoice|eneco/i.test(tx.counterpart || tx.description),
    category_path: 'fixed.utilities',
  },
  {
    test: tx => /bouygues telecom|sfr|orange|free (mobile|telecom)|t-mobile|odido|vodafone|KPN|PRLV SEPA FREE/i.test(tx.description + " " + (tx.counterpart || "")),
    category_path: 'fixed.housing',
  },
  {
    test: tx => /internet|fiber|fibre|bbox|livebox|freebox/i.test(tx.description),
    category_path: 'fixed.housing',
  },

  // ── Fixed — Insurance ────────────────────────────────────────────────────────
  {
    test: tx => /assurance|insurance|axa|allianz|groupama|maif|macif|mma |april|ag2r|harmonie mutuelle|mutuelle|prevoyance|generali/i.test(tx.counterpart || tx.description),
    category_path: 'fixed.insurance',
  },
  {
    test: tx => /zorgverzekering|zorgpremie|CZ |VGZ |menzis|achmea|interpolis|nationale.nederlanden|nn schadeverzekering|nn leven|centraal beheer/i.test(tx.counterpart || tx.description),
    category_path: 'fixed.insurance',
  },

  // ── Fixed — Obligations (taxes/fines) ────────────────────────────────────────
  {
    test: tx => /amende|amendes|web amende|amende\.gouv|treso controle/i.test(tx.description + " " + (tx.counterpart || "")),
    category_path: 'fixed.obligations',
  },
  {
    test: tx => /impot|taxe|tva|belasting|dgfip|tresor public|tax (return|office)|belastingdienst/i.test(tx.counterpart || tx.description),
    category_path: 'fixed.obligations',
  },

  // ── Fixed — Subscriptions work ───────────────────────────────────────────────
  {
    test: tx => /github|gitlab|vercel|aws |amazon web|google (cloud|workspace|one)|microsoft 365|office 365|azure|digitalocean|heroku|cloudflare|1password|bitwarden|notion|figma|linear|slack|zoom|loom|cursor|copilot/i.test(tx.counterpart || tx.description),
    category_path: 'fixed.subscriptions.work',
  },
  {
    test: tx => /salesforce|sfdc /i.test(tx.counterpart || tx.description),
    category_path: 'fixed.subscriptions.work',
  },
  {
    test: tx => /google/i.test(tx.counterpart || tx.description),
    category_path: 'fixed.subscriptions.work',
  },
  {
    test: tx => /openai|anthropic|mistral|chatgpt|claude\.ai/i.test(tx.counterpart || tx.description),
    category_path: 'fixed.subscriptions.work',
  },
  {
    test: tx => /adobe|sketch|affinity|canva|miro|airtable|zapier|make\.com|pipedream/i.test(tx.counterpart || tx.description),
    category_path: 'fixed.subscriptions.work',
  },

  // ── Fixed — Subscriptions leisure ───────────────────────────────────────────
  {
    test: tx => /netflix|spotify|apple (music|tv|arcade|one)|disney\+|prime video|amazon prime|hulu|deezer|youtube premium|canal\+|molotov|arte |twitch|gaming|playstation|xbox|nintendo/i.test(tx.counterpart || tx.description),
    category_path: 'fixed.subscriptions.leisure',
  },
  {
    test: tx => /kindle|audible|scribd|duolingo|coursera|udemy|linkedin learning/i.test(tx.counterpart || tx.description),
    category_path: 'fixed.subscriptions.leisure',
  },
  {
    test: tx => /pathe|vue cinema|cineworld|ugc |mk2 |ticketmaster|ticketswap|eventbrite|fnac spectacles/i.test(tx.counterpart || tx.description),
    category_path: 'variable.leisure',
  },
  {
    test: tx => /plaisir de lire|librair|boekhandel|fnac.*livre/i.test(tx.counterpart || tx.description),
    category_path: 'variable.leisure',
  },

  // ── Fixed — Fees ─────────────────────────────────────────────────────────────
  {
    test: tx => /frais (bancaires|de tenue|de carte|de virement|swift)|bank fee|account fee|rekeningkosten|cotisation (carte|compte)|COMMISSION/i.test(tx.description),
    category_path: 'fixed.fees',
  },
  {
    test: tx => /card delivery fee|delivery fee/i.test(tx.description),
    category_path: 'fixed.fees',
  },
  {
    test: tx => /revolut premium|revolut metal|revolut plus|wise plan|n26 metal/i.test(tx.counterpart || tx.description),
    category_path: 'fixed.fees',
  },

  // ── Irregular — Travel ───────────────────────────────────────────────────────
  {
    test: tx => /sncf|thalys|eurostar|transavia|easyjet|ryanair|air france|klm|lufthansa|british airways|iberia|vueling|flixbus|ouigo|intercity|ns\.nl|trenitalia|renfe|blablacar/i.test(tx.counterpart || tx.description),
    category_path: 'irregular.travel',
  },
  {
    test: tx => /airport|aeroport|airline|fly |flight|trein|billet(s)? (avion|train)/i.test(tx.description),
    category_path: 'irregular.travel',
  },
  {
    test: tx => /airbnb|booking\.com|hotel|hostel|marriott|hilton|ibis|novotel|accor|bnb|gite|logement/i.test(tx.counterpart || tx.description),
    category_path: 'irregular.travel',
  },
  {
    test: tx => /goldcar|hertz|avis |europcar|sixt|budget car|enterprise rent/i.test(tx.counterpart || tx.description),
    category_path: 'irregular.travel',
  },

  // ── Variable — Groceries ─────────────────────────────────────────────────────
  {
    test: tx => /albert heijn|ah (to go)?|jumbo|lidl|aldi|carrefour|monoprix|casino (supermarche)?|franprix|picard|bio c bon|naturalia|leclerc|intermarche|super u|hyper u|simply market|netto|dirk|spar|coop |delhaize|colruyt|plus supermarkt|deen |vomar|poiesz|jan linders|u express/i.test(tx.counterpart || tx.description),
    category_path: 'variable.groceries',
  },
  {
    test: tx => /ekoplaza|marqt|odin |bilder (en de)|organic market/i.test(tx.counterpart || tx.description),
    category_path: 'variable.groceries',
  },
  {
    test: tx => /boucherie|slagerij|charcuterie|fromagerie/i.test(tx.counterpart || tx.description),
    category_path: 'variable.groceries',
  },
  {
    test: tx => /marche|markt|supermarche|supermarkt|epicerie|versmarkt|fresh market|grocery/i.test(tx.description) && !/restaurant|snack|traiteur/i.test(tx.description),
    category_path: 'variable.groceries',
  },

  // ── Variable — Leisure (dining, food delivery, events) ───────────────────────
  {
    test: tx => /restaurant|brasserie|bistro|bistrot|pizzeria|sushi|mcdonalds|mcdonald's|mc donald's|burger king|kfc|subway|domino|pizza hut|five guys|leon |nando|wagamama|starbucks|costa coffee|paul (cafe)?|brioche doree|quick |popeyes|taco bell/i.test(tx.counterpart || tx.description),
    category_path: 'variable.leisure',
  },
  {
    test: tx => /cafe|coffee|bar |pub |taverne|brasserij|eetcafe|snackbar|frituur|bakker|bakery|patisserie|boulangerie|traiteur|horeca/i.test(tx.counterpart || tx.description),
    category_path: 'variable.leisure',
  },
  {
    test: tx => /pizzabakkers|bartender|smartendr|thefork|thai noodles|spaghetteria|bali brunch|brunch|muang thai|wakuli|eetplek|eethuisje|groot melkhuis|walhalla|staring at jacob|bella ciao|gangnam|stach /i.test(tx.counterpart || tx.description),
    category_path: 'variable.leisure',
  },
  {
    test: tx => tx.tx_type === "CARD_PAYMENT" && /pizza|thai|sushi|burger|brunch|spaghett|noodle|ramen|wok|tapas|doner|kebab|shawarma|falafel|poke|bbq|sichuan|korean|chinese|chicken/i.test(tx.counterpart || tx.description),
    category_path: 'variable.leisure',
  },
  {
    test: tx => /uber eats|deliveroo|just eat|thuisbezorgd|gorillas|getir|flink|picnic|takeaway/i.test(tx.counterpart || tx.description),
    category_path: 'variable.leisure',
  },

  // ── Variable — Transport ─────────────────────────────────────────────────────
  {
    test: tx => /uber|bolt |lyft|taxi|vtc |chauffeur|ov-chipkaart|gvb |ret |htm |connexxion|arriva|transdev|stadsregio|ns reizigers|navigo|ratp|sncf (transilien|idf)|velib|tier |lime |check (e-scooter)|step |trottinette/i.test(tx.counterpart || tx.description),
    category_path: 'variable.transport',
  },
  {
    test: tx => /autoroutes|autoroute|peage|toll|viapass|sanef|cofiroute|escota|aprr/i.test(tx.counterpart || tx.description),
    category_path: 'variable.transport',
  },
  {
    test: tx => /fastned|allego|ionity|tesla supercharger|charging station|laadpaal/i.test(tx.counterpart || tx.description),
    category_path: 'variable.transport',
  },

  // ── Variable — Shopping ──────────────────────────────────────────────────────
  {
    test: tx => /media markt|fnac|darty|boulanger|coolblue|bol\.com|amazon|cdiscount|apple store|ikea|action |hema |primark|decathlon|intersport|leroy merlin|castorama|brico/i.test(tx.counterpart || tx.description),
    category_path: 'variable.shopping',
  },
  {
    test: tx => /praxis|gamma |karwei|hornbach|mr\. bricolage/i.test(tx.counterpart || tx.description),
    category_path: 'variable.shopping',
  },
  {
    test: tx => /paypal/i.test(tx.description + " " + (tx.counterpart || "")),
    category_path: 'variable.shopping',
  },
  {
    test: tx => /laptop|ordinateur|telephone|smartphone|tablette|ecran|monitor|camera|imprimante|casque|headphone|keyboard|souris mouse/i.test(tx.description),
    category_path: 'variable.shopping',
  },

  // ── Irregular — Medical ──────────────────────────────────────────────────────
  {
    test: tx => /kruidvat|etos |da drogerie|drogist/i.test(tx.counterpart || tx.description),
    category_path: 'irregular.medical',
  },
  {
    test: tx => /pharmacie|apotheek|pharmacy|medecin|dokter|dentiste|tandarts|opticien|optician|hopital|ziekenhuis|kinesitherapeute|physiotherap|laboratoire|labo |sante |health |doctolib|zocdoc/i.test(tx.counterpart || tx.description),
    category_path: 'irregular.medical',
  },

  // ── Fallback ──────────────────────────────────────────────────────────────────
  {
    test: () => true,
    category_path: 'uncategorized',
  },
];

// ─── Classify ─────────────────────────────────────────────────────────────────

function classify(tx) {
  for (const rule of RULES) {
    if (rule.test(tx)) return rule.category_path;
  }
  return 'uncategorized';
}

// ─── Run ──────────────────────────────────────────────────────────────────────

const rows = db
  .prepare("SELECT id, amount, currency, description, counterpart, tx_type, bank_id FROM transactions WHERE COALESCE(category_is_manual, 0) = 0 AND is_deleted = 0")
  .all();

console.log(`\nClassifying ${rows.length} transactions${dry ? " (dry run)" : ""}…\n`);

const updateStmt = db.prepare(`
  UPDATE transactions
  SET
    category_path                = @category_path,
    cashflow_type                = @cashflow_type,
    behavior_bucket              = @behavior_bucket,
    is_subscription              = @is_subscription,
    is_excluded_from_spending    = @is_excluded_from_spending,
    categorization_source        = 'hardcoded_rule',
    confidence_level             = 'high',
    review_status                = 'confirmed',
    applied_rule_id              = 'categorize_js_v2',
    applied_rule_detail          = NULL
  WHERE id = @id
    AND COALESCE(category_is_manual, 0) = 0
    AND is_deleted = 0
`);

const counts = {};
let updated = 0;

if (!dry) {
  db.transaction(() => {
    for (const tx of rows) {
      const category_path = classify(tx);
      const meta = deriveMeta(category_path);
      updateStmt.run({ id: tx.id, category_path, ...meta });
      counts[category_path] = (counts[category_path] || 0) + 1;
      updated++;
    }
  })();
} else {
  for (const tx of rows) {
    const category_path = classify(tx);
    counts[category_path] = (counts[category_path] || 0) + 1;
    updated++;
  }
}

db.close();

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log("─".repeat(56));
console.log(`  ${"category_path".padEnd(36)} ${"Count".padStart(6)}`);
console.log("─".repeat(56));

const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
for (const [cat, count] of sorted) {
  const pct = ((count / updated) * 100).toFixed(1);
  console.log(`  ${cat.padEnd(36)} ${String(count).padStart(6)}  (${pct}%)`);
}

console.log("─".repeat(56));
console.log(`  ${"TOTAL".padEnd(36)} ${String(updated).padStart(6)}`);
console.log("─".repeat(56));
console.log(`\nDone.${dry ? " (no writes — re-run without --dry to apply)" : ` All ${updated} rows classified in data.db.`}\n`);
