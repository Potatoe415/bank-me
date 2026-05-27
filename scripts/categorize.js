/**
 * Deterministic transaction categorizer.
 * Reads ALL rows, applies taxonomy rules, writes updates to data.db.
 * Run: node scripts/categorize.js
 * Run with --dry to preview without writing.
 */

const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "..", "data.db"));
const dry = process.argv.includes("--dry");

// ─── Taxonomy ────────────────────────────────────────────────────────────────

const TAXONOMY = {
  "Fixed Costs":       ["Housing", "Insurance", "Taxes"],
  "Lifestyle":         ["Groceries", "Dining Out", "Food Delivery", "Daily Transit"],
  "Travel":            ["Flights & Trains", "Accommodation", "Local Expenses"],
  "Subscriptions":     ["Tech Tools", "Entertainment", "Bank Fees"],
  "One-off":           ["Hardware & Gear", "Healthcare"],
  "Internal Transfer": ["Account Transfer", "Credit Card Payment"],
  "Unknown":           ["Unclassifiable"],
};

// ─── Classification rules ─────────────────────────────────────────────────────
// Rules are evaluated in order; first match wins.

const RULES = [

  // ── Manual overrides from the taxonomy prompt — checked first ───────────────
  {
    // "PRELEVEMENT AUTOMATIQUE ENREGISTRE-MERCI" → credit card auto-payment
    test: tx => /PRELEVEMENT AUTOMATIQUE ENREGISTRE-MERCI/i.test(tx.description),
    category: "Internal Transfer", subcategory: "Credit Card Payment",
  },
  {
    // COTISATION → bank membership/card fee
    test: tx => /COTISATION/i.test(tx.description),
    category: "Subscriptions", subcategory: "Bank Fees",
  },
  {
    // WEBLOYALTY → dubious loyalty subscription (often charged without clear consent)
    test: tx => /WEBLOYALTY/i.test(tx.description + " " + (tx.counterpart || "")),
    category: "Subscriptions", subcategory: "Bank Fees",
  },
  {
    // FNAC + EBOOK keyword → digital book subscription
    test: tx => /FNAC/i.test(tx.description + " " + (tx.counterpart || "")) && /EBOOK/i.test(tx.description),
    category: "Subscriptions", subcategory: "Entertainment",
  },
  {
    // CLAUDE.AI or ANTHROPIC → AI subscription
    test: tx => /claude\.ai|anthropic/i.test(tx.description + " " + (tx.counterpart || "")),
    category: "Subscriptions", subcategory: "Tech Tools",
  },
  {
    // GLOVO → food delivery
    test: tx => /GLOVO/i.test(tx.description + " " + (tx.counterpart || "")),
    category: "Lifestyle", subcategory: "Food Delivery",
  },

  // ── Internal Transfers ───────────────────────────────────────────────────────
  {
    // American Express auto-debit (credit card payment from bank account)
    test: tx => /american express|amex/i.test(tx.description) && /prlv|prelevement|debit/i.test(tx.description),
    category: "Internal Transfer", subcategory: "Credit Card Payment",
  },
  {
    test: tx => tx.tx_type === "TRANSFER",
    category: "Internal Transfer", subcategory: "Account Transfer",
  },
  {
    // Top-ups (Revolut) from external sources or persons
    test: tx => tx.tx_type === "TOPUP",
    category: "Internal Transfer", subcategory: "Account Transfer",
  },
  {
    // Generic credit-card payment keywords
    test: tx => /remboursement carte|credit card payment|carte bancaire/i.test(tx.description),
    category: "Internal Transfer", subcategory: "Credit Card Payment",
  },
  {
    // Self-transfers (SEPA virements without a counterpart)
    test: tx => /virement (recu|emis|sepa)|overschrijving|iDEAL|eigen rekening/i.test(tx.description) && !tx.counterpart,
    category: "Internal Transfer", subcategory: "Account Transfer",
  },
  {
    // Tikkie (Dutch P2P payment app) — always a person-to-person transfer
    test: tx => /tikkie|aab inz tikkie/i.test(tx.description + " " + (tx.counterpart || "")),
    category: "Internal Transfer", subcategory: "Account Transfer",
  },
  {
    // Transfers to/from self by name
    test: tx => /REMI ROUX|remi\.roux|ROUX REMI/i.test(tx.counterpart || ""),
    category: "Internal Transfer", subcategory: "Account Transfer",
  },

  // ── Fixed Costs — Housing ────────────────────────────────────────────────────
  {
    test: tx => /loyer|huur|rent|hypotheek|mortgage|charges (copro|loc)|syndic/i.test(tx.description + " " + (tx.counterpart || "")),
    category: "Fixed Costs", subcategory: "Housing",
  },
  {
    // Mortgage and homeowners fees
    test: tx => /ing hypotheken|hypotheek|vve |verening van eigenare|vereniging van eigenaren/i.test(tx.counterpart || tx.description),
    category: "Fixed Costs", subcategory: "Housing",
  },
  {
    test: tx => /edf|engie|direct energie|vattenfall|nuon|essent|electr|gaz naturel|water(net|leiding)|veolia|suez eau|greenchoice|eneco|vattenfall/i.test(tx.counterpart || tx.description),
    category: "Fixed Costs", subcategory: "Housing",
  },
  {
    test: tx => /bouygues telecom|sfr|orange|free (mobile|telecom)|t-mobile|odido|vodafone|KPN|PRLV SEPA FREE/i.test(tx.description + " " + (tx.counterpart || "")),
    category: "Fixed Costs", subcategory: "Housing",
  },
  {
    test: tx => /internet|fiber|fibre|bbox|livebox|freebox/i.test(tx.description),
    category: "Fixed Costs", subcategory: "Housing",
  },

  // ── Fixed Costs — Insurance ──────────────────────────────────────────────────
  {
    test: tx => /assurance|insurance|axa|allianz|groupama|maif|macif|mma |april|ag2r|harmonie mutuelle|mutuelle|prevoyance|generali/i.test(tx.counterpart || tx.description),
    category: "Fixed Costs", subcategory: "Insurance",
  },
  {
    // Dutch insurers
    test: tx => /zorgverzekering|zorgpremie|CZ |VGZ |menzis|achmea|interpolis|nationale.nederlanden|nn schadeverzekering|nn leven|centraal beheer/i.test(tx.counterpart || tx.description),
    category: "Fixed Costs", subcategory: "Insurance",
  },

  // ── Fixed Costs — Taxes ──────────────────────────────────────────────────────
  {
    // Government fines and penalties
    test: tx => /amende|amendes|web amende|amende\.gouv|treso controle/i.test(tx.description + " " + (tx.counterpart || "")),
    category: "Fixed Costs", subcategory: "Taxes",
  },
  {
    test: tx => /impot|taxe|tva|belasting|dgfip|tresor public|tax (return|office)|belastingdienst/i.test(tx.counterpart || tx.description),
    category: "Fixed Costs", subcategory: "Taxes",
  },

  // ── Subscriptions — Tech Tools ────────────────────────────────────────────────
  {
    test: tx => /github|gitlab|vercel|aws |amazon web|google (cloud|workspace|one)|microsoft 365|office 365|azure|digitalocean|heroku|cloudflare|1password|bitwarden|notion|figma|linear|slack|zoom|loom|cursor|copilot/i.test(tx.counterpart || tx.description),
    category: "Subscriptions", subcategory: "Tech Tools",
  },
  {
    // Salesforce / SFDC
    test: tx => /salesforce|sfdc /i.test(tx.counterpart || tx.description),
    category: "Subscriptions", subcategory: "Tech Tools",
  },
  {
    // Google temporary authorization holds → Google subscription or purchase
    test: tx => /google/i.test(tx.counterpart || tx.description),
    category: "Subscriptions", subcategory: "Tech Tools",
  },
  {
    test: tx => /openai|anthropic|mistral|chatgpt|claude\.ai/i.test(tx.counterpart || tx.description),
    category: "Subscriptions", subcategory: "Tech Tools",
  },
  {
    test: tx => /adobe|sketch|affinity|canva|miro|airtable|zapier|make\.com|pipedream/i.test(tx.counterpart || tx.description),
    category: "Subscriptions", subcategory: "Tech Tools",
  },

  // ── Subscriptions — Entertainment ────────────────────────────────────────────
  {
    test: tx => /netflix|spotify|apple (music|tv|arcade|one)|disney\+|prime video|amazon prime|hulu|deezer|youtube premium|canal\+|molotov|arte |twitch|gaming|playstation|xbox|nintendo/i.test(tx.counterpart || tx.description),
    category: "Subscriptions", subcategory: "Entertainment",
  },
  {
    test: tx => /kindle|audible|scribd|duolingo|coursera|udemy|linkedin learning/i.test(tx.counterpart || tx.description),
    category: "Subscriptions", subcategory: "Entertainment",
  },
  {
    // Cinema, theaters, ticketing
    test: tx => /pathe|vue cinema|cineworld|ugc |mk2 |ticketmaster|ticketswap|eventbrite|fnac spectacles/i.test(tx.counterpart || tx.description),
    category: "Subscriptions", subcategory: "Entertainment",
  },
  {
    // Bookshops (books = entertainment / culture)
    test: tx => /plaisir de lire|librair|boekhandel|fnac.*livre/i.test(tx.counterpart || tx.description),
    category: "Subscriptions", subcategory: "Entertainment",
  },

  // ── Subscriptions — Bank Fees ─────────────────────────────────────────────────
  {
    test: tx => /frais (bancaires|de tenue|de carte|de virement|swift)|bank fee|account fee|rekeningkosten|cotisation (carte|compte)|COMMISSION/i.test(tx.description),
    category: "Subscriptions", subcategory: "Bank Fees",
  },
  {
    // Card delivery or bank product fees
    test: tx => /card delivery fee|delivery fee/i.test(tx.description),
    category: "Subscriptions", subcategory: "Bank Fees",
  },
  {
    test: tx => /revolut premium|revolut metal|revolut plus|wise plan|n26 metal/i.test(tx.counterpart || tx.description),
    category: "Subscriptions", subcategory: "Bank Fees",
  },

  // ── Travel — Flights & Trains ─────────────────────────────────────────────────
  {
    test: tx => /sncf|thalys|eurostar|transavia|easyjet|ryanair|air france|klm|lufthansa|british airways|iberia|vueling|flixbus|ouigo|intercity|ns\.nl|trenitalia|renfe|blablacar/i.test(tx.counterpart || tx.description),
    category: "Travel", subcategory: "Flights & Trains",
  },
  {
    test: tx => /airport|aeroport|airline|fly |flight|trein|billet(s)? (avion|train)/i.test(tx.description),
    category: "Travel", subcategory: "Flights & Trains",
  },

  // ── Travel — Accommodation ────────────────────────────────────────────────────
  {
    test: tx => /airbnb|booking\.com|hotel|hostel|marriott|hilton|ibis|novotel|accor|bnb|gite|logement/i.test(tx.counterpart || tx.description),
    category: "Travel", subcategory: "Accommodation",
  },

  // ── Travel — Local Expenses ───────────────────────────────────────────────────
  {
    // Car rental while travelling
    test: tx => /goldcar|hertz|avis |europcar|sixt|budget car|enterprise rent/i.test(tx.counterpart || tx.description),
    category: "Travel", subcategory: "Local Expenses",
  },

  // ── Lifestyle — Groceries ─────────────────────────────────────────────────────
  {
    test: tx => /albert heijn|ah (to go)?|jumbo|lidl|aldi|carrefour|monoprix|casino (supermarche)?|franprix|picard|bio c bon|naturalia|leclerc|intermarche|super u|hyper u|simply market|netto|dirk|spar|coop |delhaize|colruyt|plus supermarkt|deen |vomar|poiesz|jan linders|u express/i.test(tx.counterpart || tx.description),
    category: "Lifestyle", subcategory: "Groceries",
  },
  {
    // Organic/health supermarkets
    test: tx => /ekoplaza|marqt|odin |bilder (en de)|organic market/i.test(tx.counterpart || tx.description),
    category: "Lifestyle", subcategory: "Groceries",
  },
  {
    // Butchers and delis
    test: tx => /boucherie|slagerij|charcuterie|fromagerie/i.test(tx.counterpart || tx.description),
    category: "Lifestyle", subcategory: "Groceries",
  },
  {
    test: tx => /marche|markt|supermarche|supermarkt|epicerie|versmarkt|fresh market|grocery/i.test(tx.description) && !/restaurant|snack|traiteur/i.test(tx.description),
    category: "Lifestyle", subcategory: "Groceries",
  },

  // ── Lifestyle — Dining Out ────────────────────────────────────────────────────
  {
    test: tx => /restaurant|brasserie|bistro|bistrot|pizzeria|sushi|mcdonalds|mcdonald's|mc donald's|burger king|kfc|subway|domino|pizza hut|five guys|leon |nando|wagamama|starbucks|costa coffee|paul (cafe)?|brioche doree|quick |popeyes|taco bell/i.test(tx.counterpart || tx.description),
    category: "Lifestyle", subcategory: "Dining Out",
  },
  {
    test: tx => /cafe|coffee|bar |pub |taverne|brasserij|eetcafe|snackbar|frituur|bakker|bakery|patisserie|boulangerie|traiteur|horeca/i.test(tx.counterpart || tx.description),
    category: "Lifestyle", subcategory: "Dining Out",
  },
  {
    // Named restaurant patterns (Dutch/international/well-known)
    test: tx => /pizzabakkers|bartender|smartendr|thefork|thai noodles|spaghetteria|bali brunch|brunch|muang thai|wakuli|eetplek|eethuisje|groot melkhuis|walhalla|staring at jacob|bella ciao|gangnam|stach /i.test(tx.counterpart || tx.description),
    category: "Lifestyle", subcategory: "Dining Out",
  },
  {
    // Catch restaurants by food-type keywords in counterpart names
    test: tx => tx.tx_type === "CARD_PAYMENT" && /pizza|thai|sushi|burger|brunch|spaghett|noodle|ramen|wok|tapas|doner|kebab|shawarma|falafel|poke|bbq|sichuan|korean|chinese|chicken/i.test(tx.counterpart || tx.description),
    category: "Lifestyle", subcategory: "Dining Out",
  },

  // ── Lifestyle — Food Delivery ─────────────────────────────────────────────────
  {
    test: tx => /uber eats|deliveroo|just eat|thuisbezorgd|gorillas|getir|flink|picnic|takeaway/i.test(tx.counterpart || tx.description),
    category: "Lifestyle", subcategory: "Food Delivery",
  },

  // ── Lifestyle — Daily Transit ─────────────────────────────────────────────────
  {
    test: tx => /uber|bolt |lyft|taxi|vtc |chauffeur|ov-chipkaart|gvb |ret |htm |connexxion|arriva|transdev|stadsregio|ns reizigers|navigo|ratp|sncf (transilien|idf)|velib|tier |lime |check (e-scooter)|step |trottinette/i.test(tx.counterpart || tx.description),
    category: "Lifestyle", subcategory: "Daily Transit",
  },
  {
    // Highway tolls
    test: tx => /autoroutes|autoroute|peage|toll|viapass|sanef|cofiroute|escota|aprr/i.test(tx.counterpart || tx.description),
    category: "Lifestyle", subcategory: "Daily Transit",
  },
  {
    // EV charging
    test: tx => /fastned|allego|ionity|tesla supercharger|charging station|laadpaal/i.test(tx.counterpart || tx.description),
    category: "Lifestyle", subcategory: "Daily Transit",
  },

  // ── One-off — Hardware & Gear ─────────────────────────────────────────────────
  {
    test: tx => /media markt|fnac|darty|boulanger|coolblue|bol\.com|amazon|cdiscount|apple store|ikea|action |hema |primark|decathlon|intersport|leroy merlin|castorama|brico/i.test(tx.counterpart || tx.description),
    category: "One-off", subcategory: "Hardware & Gear",
  },
  {
    // DIY and hardware stores
    test: tx => /praxis|gamma |karwei|hornbach|mr\. bricolage/i.test(tx.counterpart || tx.description),
    category: "One-off", subcategory: "Hardware & Gear",
  },
  {
    // PayPal payments — payment platform used for online purchases
    test: tx => /paypal/i.test(tx.description + " " + (tx.counterpart || "")),
    category: "One-off", subcategory: "Hardware & Gear",
  },
  {
    test: tx => /laptop|ordinateur|telephone|smartphone|tablette|ecran|monitor|camera|imprimante|casque|headphone|keyboard|souris mouse/i.test(tx.description),
    category: "One-off", subcategory: "Hardware & Gear",
  },

  // ── One-off — Healthcare ──────────────────────────────────────────────────────
  {
    // Drugstores & pharmacies
    test: tx => /kruidvat|etos |da drogerie|drogist/i.test(tx.counterpart || tx.description),
    category: "One-off", subcategory: "Healthcare",
  },
  {
    test: tx => /pharmacie|apotheek|pharmacy|medecin|dokter|dentiste|tandarts|opticien|optician|hopital|ziekenhuis|kinesitherapeute|physiotherap|laboratoire|labo |sante |health |doctolib|zocdoc/i.test(tx.counterpart || tx.description),
    category: "One-off", subcategory: "Healthcare",
  },

  // ── Fallback ──────────────────────────────────────────────────────────────────
  {
    test: () => true,
    category: "Unknown", subcategory: "Unclassifiable",
  },
];

// ─── Classify ─────────────────────────────────────────────────────────────────

function classify(tx) {
  for (const rule of RULES) {
    if (rule.test(tx)) {
      return { category: rule.category, subcategory: rule.subcategory };
    }
  }
  return { category: "Unknown", subcategory: "Unclassifiable" };
}

// ─── Run ──────────────────────────────────────────────────────────────────────

const rows = db
  .prepare("SELECT id, amount, currency, description, counterpart, tx_type, bank_id FROM transactions")
  .all();

console.log(`\nClassifying ${rows.length} transactions${dry ? " (dry run)" : ""}…\n`);

const updateStmt = db.prepare(
  "UPDATE transactions SET category = @category, subcategory = @subcategory WHERE id = @id"
);

const counts = {};
let updated = 0;

if (!dry) {
  db.transaction(() => {
    for (const tx of rows) {
      const { category, subcategory } = classify(tx);
      updateStmt.run({ id: tx.id, category, subcategory });
      counts[category] = (counts[category] || 0) + 1;
      updated++;
    }
  })();
} else {
  for (const tx of rows) {
    const { category, subcategory } = classify(tx);
    counts[category] = (counts[category] || 0) + 1;
    updated++;
  }
}

db.close();

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log("─".repeat(52));
console.log(`  ${"Category".padEnd(22)} ${"Count".padStart(6)}`);
console.log("─".repeat(52));

const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
for (const [cat, count] of sorted) {
  const pct = ((count / updated) * 100).toFixed(1);
  console.log(`  ${cat.padEnd(22)} ${String(count).padStart(6)}  (${pct}%)`);
}

console.log("─".repeat(52));
console.log(`  ${"TOTAL".padEnd(22)} ${String(updated).padStart(6)}`);
console.log("─".repeat(52));
console.log(`\nDone.${dry ? " (no writes — re-run without --dry to apply)" : ` All ${updated} rows updated in data.db.`}\n`);
