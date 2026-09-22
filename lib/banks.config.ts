export type BankConfig = {
  id: string;        // slug used in URLs and DB
  name: string;      // display name
  aspspName: string; // exact name in Enable Banking API
  country: string;
  color: string;     // brand color
  initial: string;   // avatar letters
  popular?: boolean;
};

export const BANKS: BankConfig[] = [
  // ── Popular ──────────────────────────────────────────────────────────
  { id: "revolut",       name: "Revolut",          aspspName: "Revolut",            country: "FR", color: "#0666eb", initial: "R",  popular: true },
  { id: "boursorama",    name: "Boursorama",        aspspName: "Boursorama Banque",   country: "FR", color: "#e8383d", initial: "Bo", popular: true },
  { id: "bnpparibas",    name: "BNP Paribas",       aspspName: "BNP Paribas",         country: "FR", color: "#009a44", initial: "BNP",popular: true },
  { id: "societegen",    name: "Société Générale",  aspspName: "Société Générale",    country: "FR", color: "#e30613", initial: "SG", popular: true },
  { id: "lcl",           name: "LCL",               aspspName: "LCL",                 country: "FR", color: "#e31837", initial: "LCL",popular: true },
  { id: "cic",           name: "CIC",               aspspName: "CIC",                 country: "FR", color: "#0066cc", initial: "CIC",popular: true },
  { id: "creditmutuel",  name: "Crédit Mutuel",     aspspName: "Crédit Mutuel",       country: "FR", color: "#003b8e", initial: "CM", popular: true },
  { id: "hellobank",     name: "Hello Bank",        aspspName: "Hello Bank",          country: "FR", color: "#1a1a1a", initial: "HB", popular: true },
  { id: "fortuneo",      name: "Fortuneo",          aspspName: "Fortuneo",            country: "FR", color: "#f07300", initial: "Fo", popular: true },
  { id: "labanquepost",  name: "La Banque Postale", aspspName: "La Banque Postale",   country: "FR", color: "#f5a800", initial: "LP", popular: true },
  { id: "n26",           name: "N26",               aspspName: "N26",                 country: "FR", color: "#1a1a1a", initial: "N26",popular: true },
  { id: "monabanq",      name: "Monabanq",          aspspName: "Monabanq",            country: "FR", color: "#6600cc", initial: "Mo", popular: true },
  { id: "qonto",         name: "Qonto",             aspspName: "Qonto",               country: "FR", color: "#7209b7", initial: "Q",  popular: true },
  { id: "wise",          name: "Wise",              aspspName: "Wise",                country: "FR", color: "#9fe870", initial: "W",  popular: true },
  { id: "hsbc",          name: "HSBC",              aspspName: "HSBC",                country: "FR", color: "#db0011", initial: "H",  popular: true },
  { id: "paypal",        name: "PayPal",            aspspName: "PayPal",              country: "FR", color: "#003087", initial: "PP", popular: true },
  { id: "paypal-us",     name: "PayPal US",         aspspName: "PayPal",              country: "FR", color: "#003087", initial: "PP" },

  // ── Crédit Agricole (régions) ─────────────────────────────────────────
  { id: "ca-idf",        name: "CA Île-de-France",          aspspName: "Crédit Agricole de Paris et d'Ile de France", country: "FR", color: "#00843d", initial: "CA" },
  { id: "ca-normandie",  name: "CA Normandie",              aspspName: "Crédit Agricole de Normandie",                country: "FR", color: "#00843d", initial: "CA" },
  { id: "ca-alpesprov",  name: "CA Alpes Provence",         aspspName: "Crédit Agricole Alpes Provence",              country: "FR", color: "#00843d", initial: "CA" },
  { id: "ca-alsace",     name: "CA Alsace Vosges",          aspspName: "Crédit Agricole Alsace Vosges",               country: "FR", color: "#00843d", initial: "CA" },
  { id: "ca-aquitaine",  name: "CA Aquitaine",              aspspName: "Crédit Agricole d'Aquitaine",                 country: "FR", color: "#00843d", initial: "CA" },
  { id: "ca-languedoc",  name: "CA Languedoc",              aspspName: "Crédit Agricole du Languedoc",                country: "FR", color: "#00843d", initial: "CA" },
  { id: "ca-sudrhone",   name: "CA Sud Rhône-Alpes",        aspspName: "Crédit Agricole Sud Rhône-Alpes",             country: "FR", color: "#00843d", initial: "CA" },
  { id: "ca-toulouse",   name: "CA Toulouse 31",            aspspName: "Crédit Agricole Toulouse 31",                 country: "FR", color: "#00843d", initial: "CA" },
  { id: "ca-finistere",  name: "CA Finistère",              aspspName: "Crédit Agricole du Finistère",                country: "FR", color: "#00843d", initial: "CA" },
  { id: "ca-bretagne",   name: "CA Bretagne Atlantique",    aspspName: "Crédit Agricole Atlantique Vendée",           country: "FR", color: "#00843d", initial: "CA" },

  // ── Caisse d'Epargne (régions) ───────────────────────────────────────
  { id: "ce-idf",        name: "CE Île-de-France",          aspspName: "Caisse d'Epargne Ile De France",              country: "FR", color: "#c8102e", initial: "CE" },
  { id: "ce-rhonealpes", name: "CE Rhône Alpes",            aspspName: "Caisse d'Epargne Rhône Alpes",                country: "FR", color: "#c8102e", initial: "CE" },
  { id: "ce-paca",       name: "CE Provence Alpes Corse",   aspspName: "Caisse d'Epargne Provence Alpes Corse",       country: "FR", color: "#c8102e", initial: "CE" },
  { id: "ce-nordpasdecalais", name: "CE Hauts de France",   aspspName: "Caisse d'Epargne Hauts de France",            country: "FR", color: "#c8102e", initial: "CE" },
  { id: "ce-cotedazur",  name: "CE Côte d'Azur",            aspspName: "Caisse d'Epargne Côte d'Azur",                country: "FR", color: "#c8102e", initial: "CE" },
  { id: "ce-grandest",   name: "CE Grand Est Europe",       aspspName: "Caisse d'Epargne Grand Est Europe",           country: "FR", color: "#c8102e", initial: "CE" },
  { id: "ce-bretagne",   name: "CE Bretagne",               aspspName: "Caisse d'Epargne Bretagne-Pays De Loire",     country: "FR", color: "#c8102e", initial: "CE" },

  // ── Banque Populaire (régions) ───────────────────────────────────────
  { id: "bp-rivesparis", name: "BP Rives de Paris",         aspspName: "Banque Populaire Rives de Paris",             country: "FR", color: "#003189", initial: "BP" },
  { id: "bp-grandouest", name: "BP Grand Ouest",            aspspName: "Banque Populaire Grand Ouest",                country: "FR", color: "#003189", initial: "BP" },
  { id: "bp-alsa",       name: "BP Alsace Lorraine",        aspspName: "Banque Populaire Alsace Lorraine Champagne",  country: "FR", color: "#003189", initial: "BP" },
  { id: "bp-med",        name: "BP Méditerranée",           aspspName: "Banque Populaire Méditerranée",               country: "FR", color: "#003189", initial: "BP" },
  { id: "bp-occitane",   name: "BP Occitane",               aspspName: "Banque Populaire Occitane",                   country: "FR", color: "#003189", initial: "BP" },
  { id: "bred",          name: "Bred Banque Populaire",     aspspName: "Bred Banque Populaire",                       country: "FR", color: "#003189", initial: "Br" },

  // ── Pays-Bas ─────────────────────────────────────────────────────────
  { id: "ing-nl",        name: "ING (Pays-Bas)",          aspspName: "ING",                   country: "NL", color: "#ff6200", initial: "ING", popular: true },
  { id: "abn-amro",      name: "ABN AMRO",                aspspName: "ABN AMRO",               country: "NL", color: "#007ab8", initial: "ABN", popular: true },
  { id: "rabobank",      name: "Rabobank",                aspspName: "Rabobank",               country: "NL", color: "#e2001a", initial: "Ra",  popular: true },
  { id: "sns",           name: "SNS Bank",                aspspName: "SNS Bank",               country: "NL", color: "#0058a3", initial: "SNS" },
  { id: "asn",           name: "ASN Bank",                aspspName: "ASN Bank",               country: "NL", color: "#00833e", initial: "ASN" },
  { id: "triodos",       name: "Triodos Bank",            aspspName: "Triodos Bank",           country: "NL", color: "#006e2e", initial: "Tr"  },
  { id: "knab",          name: "Knab",                    aspspName: "Knab",                   country: "NL", color: "#e30613", initial: "Kn"  },

  // ── Autres ───────────────────────────────────────────────────────────
  { id: "axabanque",     name: "AXA Banque",                aspspName: "AXA Banque",                                  country: "FR", color: "#00008f", initial: "AX" },
  { id: "shine",         name: "Shine",                     aspspName: "Shine",                                       country: "FR", color: "#5d2d91", initial: "Sh" },
  { id: "bunq",          name: "bunq",                      aspspName: "bunq",                                        country: "FR", color: "#00aeef", initial: "bq" },
  { id: "vivid",         name: "Vivid Money",               aspspName: "Vivid Money",                                 country: "FR", color: "#4a00e0", initial: "Vi" },
  { id: "americanex",   name: "American Express",           aspspName: "American Express",                            country: "FR", color: "#016fcb", initial: "Ax" },
];

export function getBankById(id: string): BankConfig | undefined {
  return BANKS.find((b) => b.id === id);
}

export function getBankByAspspName(name: string): BankConfig | undefined {
  return BANKS.find((b) => b.aspspName === name);
}
