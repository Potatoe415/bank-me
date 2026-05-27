// Temporary simulation script — shows what would remain Unknown after new rules
const db = require("better-sqlite3")("data.db");
const rows = db.prepare("SELECT id, description, counterpart, tx_type, amount, bank_id FROM transactions").all();

function wouldBeUnknown(tx) {
  const tc = tx.counterpart || "";
  const td = tx.description;
  const both = tc + " " + td;

  if (/PRELEVEMENT AUTOMATIQUE ENREGISTRE-MERCI|COTISATION|WEBLOYALTY|claude\.ai|anthropic|GLOVO/i.test(both)) return false;
  if (/FNAC/i.test(both) && /EBOOK/i.test(td)) return false;
  if (/american express|amex/i.test(td) && /prlv|prelevement|debit/i.test(td)) return false;
  if (tx.tx_type === "TRANSFER" || tx.tx_type === "TOPUP") return false;
  if (/remboursement carte|credit card payment|carte bancaire/i.test(td)) return false;
  if (/virement (recu|emis|sepa)|overschrijving|iDEAL|eigen rekening/i.test(td) && !tc) return false;
  if (/tikkie|aab inz tikkie/i.test(both)) return false;
  if (/REMI ROUX|remi\.roux|ROUX REMI/i.test(tc)) return false;
  if (/loyer|huur|rent|hypotheek|mortgage|charges (copro|loc)|syndic/i.test(both)) return false;
  if (/ing hypotheken|vve |verening van eigenare|vereniging van eigenaren/i.test(both)) return false;
  if (/edf|engie|direct energie|vattenfall|nuon|essent|electr|gaz naturel|waternet|waterleiding|veolia|suez eau|greenchoice|eneco/i.test(both)) return false;
  if (/bouygues telecom|sfr|orange|free (mobile|telecom)|t-mobile|odido|vodafone|KPN|PRLV SEPA FREE/i.test(both)) return false;
  if (/internet|fiber|fibre|bbox|livebox|freebox/i.test(td)) return false;
  if (/assurance|insurance|axa|allianz|groupama|maif|macif|mma |april|ag2r|harmonie mutuelle|mutuelle|prevoyance|generali/i.test(both)) return false;
  if (/nationale.nederlanden|nn schadeverzekering|nn leven|centraal beheer/i.test(both)) return false;
  if (/zorgverzekering|zorgpremie|CZ |VGZ |menzis|achmea|interpolis/i.test(both)) return false;
  if (/amende|amendes|web amende|amende\.gouv|treso controle/i.test(both)) return false;
  if (/impot|taxe|tva|belasting|dgfip|tresor public|tax (return|office)|belastingdienst/i.test(both)) return false;
  if (/github|gitlab|vercel|aws |amazon web|google (cloud|workspace|one)|microsoft 365|office 365|azure|digitalocean|heroku|cloudflare|1password|bitwarden|notion|figma|linear|slack|zoom|loom|cursor|copilot/i.test(both)) return false;
  if (/salesforce|sfdc /i.test(both)) return false;
  if (/google/i.test(both)) return false;
  if (/openai|anthropic|mistral|chatgpt|claude\.ai/i.test(both)) return false;
  if (/adobe|sketch|affinity|canva|miro|airtable|zapier|make\.com|pipedream/i.test(both)) return false;
  if (/netflix|spotify|apple (music|tv|arcade|one)|disney\+|prime video|amazon prime|hulu|deezer|youtube premium|canal\+|molotov|arte |twitch|gaming|playstation|xbox|nintendo/i.test(both)) return false;
  if (/kindle|audible|scribd|duolingo|coursera|udemy|linkedin learning/i.test(both)) return false;
  if (/pathe|vue cinema|cineworld|ugc |mk2 |ticketmaster|ticketswap|eventbrite|fnac spectacles/i.test(both)) return false;
  if (/plaisir de lire|librair|boekhandel/i.test(both)) return false;
  if (/frais (bancaires|de tenue|de carte|de virement|swift)|bank fee|account fee|rekeningkosten|cotisation (carte|compte)|COMMISSION/i.test(td)) return false;
  if (/card delivery fee|delivery fee/i.test(td)) return false;
  if (/revolut premium|revolut metal|revolut plus|wise plan|n26 metal/i.test(both)) return false;
  if (/sncf|thalys|eurostar|transavia|easyjet|ryanair|air france|klm|lufthansa|british airways|iberia|vueling|flixbus|ouigo|intercity|ns\.nl|trenitalia|renfe|blablacar/i.test(both)) return false;
  if (/airport|aeroport|airline|fly |flight|trein|billet(s)? (avion|train)/i.test(td)) return false;
  if (/airbnb|booking\.com|hotel|hostel|marriott|hilton|ibis|novotel|accor|bnb|gite|logement/i.test(both)) return false;
  if (/goldcar|hertz|avis |europcar|sixt|budget car|enterprise rent|autoeurope/i.test(both)) return false;
  if (/albert heijn|ah (to go)?|jumbo|lidl|aldi|carrefour|monoprix|casino (supermarche)?|franprix|picard|bio c bon|naturalia|leclerc|intermarche|super u|hyper u|simply market|netto|dirk|spar|coop |delhaize|colruyt|plus supermarkt|deen |vomar|poiesz|jan linders|u express/i.test(both)) return false;
  if (/ekoplaza|marqt|odin |bilder (en de)|organic market/i.test(both)) return false;
  if (/boucherie|slagerij|charcuterie|fromagerie/i.test(both)) return false;
  if (/marche|markt|supermarche|supermarkt|epicerie|versmarkt|fresh market|grocery/i.test(td) && !/restaurant|snack|traiteur/i.test(td)) return false;
  if (/restaurant|brasserie|bistro|bistrot|pizzeria|sushi|mcdonalds|mcdonald|burger king|kfc|subway|domino|pizza hut|five guys|leon |nando|wagamama|starbucks|costa coffee|paul (cafe)?|brioche doree|quick |popeyes|taco bell/i.test(both)) return false;
  if (/cafe|coffee|bar |pub |taverne|brasserij|eetcafe|snackbar|frituur|bakker|bakery|patisserie|boulangerie|traiteur|horeca/i.test(both)) return false;
  if (/pizzabakkers|bartender|smartendr|thefork|thai noodles|spaghetteria|bali brunch|brunch|muang thai|wakuli|eetplek|eethuisje|groot melkhuis|walhalla|staring at jacob|bella ciao|gangnam|stach /i.test(both)) return false;
  if (tx.tx_type === "CARD_PAYMENT" && /pizza|thai|sushi|burger|brunch|spaghett|noodle|ramen|wok|tapas|doner|kebab|shawarma|falafel|poke|bbq|sichuan|korean|chinese|chicken/i.test(both)) return false;
  if (/uber eats|deliveroo|just eat|thuisbezorgd|gorillas|getir|flink|picnic|takeaway/i.test(both)) return false;
  if (/uber|bolt |lyft|taxi|vtc |chauffeur|ov-chipkaart|gvb |ret |htm |connexxion|arriva|transdev|stadsregio|ns reizigers|navigo|ratp|sncf (transilien|idf)|velib|tier |lime |check (e-scooter)|step |trottinette/i.test(both)) return false;
  if (/autoroutes|autoroute|peage|toll|viapass|sanef|cofiroute|escota|aprr/i.test(both)) return false;
  if (/fastned|allego|ionity|tesla supercharger|charging station|laadpaal/i.test(both)) return false;
  if (/media markt|fnac|darty|boulanger|coolblue|bol\.com|amazon|cdiscount|apple store|ikea|action |hema |primark|decathlon|intersport|leroy merlin|castorama|brico/i.test(both)) return false;
  if (/praxis|gamma |karwei|hornbach|mr\. bricolage/i.test(both)) return false;
  if (/paypal/i.test(both)) return false;
  if (/kruidvat|etos |da drogerie|drogist/i.test(both)) return false;
  if (/pharmacie|apotheek|pharmacy|medecin|dokter|dentiste|tandarts|opticien|optician|hopital|ziekenhuis|kinesitherapeute|physiotherap|laboratoire|labo |sante |health |doctolib|zocdoc/i.test(both)) return false;
  return true;
}

const unknowns = rows.filter(wouldBeUnknown);
console.log("Remaining unknowns: " + unknowns.length + "\n");
unknowns.forEach(r => {
  const key = (r.counterpart || r.description).substring(0, 80);
  console.log(r.tx_type + " | " + r.amount + " | " + key);
});

db.close();
