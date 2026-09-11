#!/usr/bin/env node
/**
 * scrape-neonfighters.js
 *
 * Scrapes Tekken 8 movelists from neonfighters.gg for characters not yet on
 * your site. No headless browser needed — the page is plain server-rendered
 * HTML (I fetched /characters/paul directly and the full move table with
 * ~143 rows was already there, nothing loaded afterward by JS). That means
 * a lightweight fetch + cheerio parse works, no Puppeteer/Chromium download.
 *
 * Usage:
 *   npm install cheerio
 *   node scrape-neonfighters.js            # scrape everyone in CHARACTERS
 *   node scrape-neonfighters.js law         # scrape just one slug (do this first!)
 *
 * VERIFY BEFORE TRUSTING THE OUTPUT — three things I could not confirm
 * without a real browser's dev tools, only an AI-summarized fetch:
 *
 *   1. Run it against "law" or "paul" first. Those already exist correctly
 *      in your data/ folder — diff the scraper's output against the real
 *      file. If command/name/notes line up, the parsing logic is sound and
 *      you can trust it for the rest.
 *
 *   2. STANCE_PREFIX below is a best-effort guess. Move commands on the site
 *      are split across separate tables per stance (Normal, While Standing,
 *      Full Crouch, Heat, Rage Art, Side Step, Back Turned...), and the
 *      table itself likely only shows the bare command (e.g. "1+2"), not
 *      the full notation your data files use (e.g. "H.1+2"). The script
 *      prepends a prefix based on the heading text above each table. Every
 *      heading it doesn't recognize gets logged to the console as an
 *      "unrecognized section heading" warning with no prefix applied —
 *      check for those after each run and add missing entries. This matters
 *      most for characters with unique stances (Kazuya's DVS, Law's DSS,
 *      Jin's ZEN/DVS, Nina's throw follow-ups BHS/ABK/BTR/CHD/HHD/NTM/STB/TSS,
 *      etc.) — none of those are in the map since I have no confirmed
 *      example of their heading text.
 *
 *   3. Output filenames use the neonfighters.gg URL slug. Some won't match
 *      this project's data/characters.json slug for that character —
 *      devil-jin, jack-8, xiaoyu (vs. ling-xiaoyu), and dragunov (vs.
 *      sergei-dragunov) are the ones most likely to differ. Check
 *      characters.json and rename the output file to match before you
 *      commit it, or the site won't find it.
 */

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const OUT_DIR = path.join(__dirname, "output");

// Remaining roster: neonfighters.gg slug -> display name for the JSON's
// top-level "name" field (must match what your character dropdown already
// shows — these values were pulled from your live site).
const CHARACTERS = {
  "alisa": "Alisa Bosconovitch",
  "anna": "Anna Williams",
  "armor-king": "Armor King",
  "asuka": "Asuka Kazama",
  "bob": "Bob",
  "bryan": "Bryan Fury",
  "claudio": "Claudio Serafino",
  "clive": "Clive Rosfield",
  "devil-jin": "Devil Jin",
  "eddy": "Eddy Gordo",
  "fahkumram": "Fahkumram",
  "feng": "Feng Wei",
  "heihachi": "Heihachi Mishima",
  "hwoarang": "Hwoarang",
  "jack-8": "Jack-8",
  "jun": "Jun Kazama",
  "king": "King",
  "kuma": "Kuma",
  "kunimitsu": "Kunimitsu",
  "lars": "Lars Alexandersson",
  "lee": "Lee Chaolan",
  "leo": "Leo",
  "leroy": "Leroy Smith",
  "lidia": "Lidia Sobieska",
  "lili": "Lili",
  "xiaoyu": "Ling Xiaoyu",
  "panda": "Panda",
  "raven": "Raven",
  "reina": "Reina",
  "dragunov": "Sergei Dragunov",
  "shaheen": "Shaheen",
  "steve": "Steve Fox",
  "victor": "Victor Chevalier",
  "yoshimitsu": "Yoshimitsu",
  "zafina": "Zafina",
  // "nina" deliberately left out — already live on the site.
};

// Already live on the site — kept separate from CHARACTERS so a full run
// (no arguments) never touches them, but you can still name them on the
// command line to test the parser against a file you already know is right.
const TEST_CHARACTERS = {
  "law": "Marshall Law",
  "paul": "Paul Phoenix",
  "nina": "Nina Williams",
  "kazuya": "Kazuya Mishima",
  "jin-kazama": "Jin Kazama",
};
// Confirmed working slugs (checked directly): law, paul, nina, kazuya,
// jin-kazama. Note "jin" 404s — it has to be "jin-kazama".

const ALL_KNOWN = { ...CHARACTERS, ...TEST_CHARACTERS };

// Heading text (lowercased, whitespace-collapsed) -> command prefix.
// Extend this as you find headings the script doesn't recognize.
const STANCE_PREFIX = {
  "normal moves": "",
  "normal": "",
  "while standing": "ws",
  "ws": "ws",
  "full crouch": "FC.",
  "fc": "FC.",
  "off the ground": "OTG.",
  "otg": "OTG.",
  "heat": "H.",
  "heat engager": "H.",
  "h": "H.",
  "rage art": "R.",
  "rage": "R.",
  "r": "R.",
  "side step": "SS.",
  "sidestep": "SS.",
  "ss": "SS.",
  "back turned": "BT.",
  "bt": "BT.",
  "crouch dash": "CD.",
  "cd": "CD.",
  // Character-specific stances — confirmed as real section names via the
  // roster's actual pages (Kazuya: Devil, Law: DSS, Jin: ZEN/DVS), but I
  // still can't confirm the EXACT heading text (full word vs. abbreviation),
  // so both forms are mapped. Nina's throw-chain follow-up sections (ABK,
  // BHS, BTR, CHD, HHD, NTM, STB, TSS) are abbreviations already, per her
  // page's own section list.
  "devil": "DVS.",
  "devil stance": "DVS.",
  "dvs": "DVS.",
  "dss": "DSS.",
  "zen": "ZEN.",
  "abk": "ABK.",
  "bhs": "BHS.",
  "btr": "BTR.",
  "chd": "CHD.",
  "hhd": "HHD.",
  "ntm": "NTM.",
  "stb": "STB.",
  "tss": "TSS.",
};

const BASE_URL = "https://neonfighters.gg/characters";
const DELAY_MS = 800; // be polite across 35 requests

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeHeading(text) {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

// Headings that are real page furniture, not stance sections — always ignore
// these with no warning. Also ignore anything ending in "frame data" (the
// page's own H1 title, e.g. "Marshall Law – Frame Data").
const IGNORE_HEADINGS = new Set(["navigate", "popular guides", "stay updated"]);

// Cache of prefixes we've auto-derived from the "<CODE> Stance" pattern, so
// we only compute/announce each one once per process.
const derivedPrefixCache = {};

function prefixFor(headingText, slug) {
  if (!headingText) return "";
  const raw = headingText.trim();
  const key = normalizeHeading(raw);

  if (!key || IGNORE_HEADINGS.has(key) || /frame data$/i.test(key)) return "";

  if (key in STANCE_PREFIX) return STANCE_PREFIX[key];

  // Real pattern observed on neonfighters.gg: section headings are literally
  // "<CODE> Stance", e.g. "BT Stance", "FC Stance", "H. Stance", "R. Stance",
  // "DSS Stance". Auto-derive the prefix from the code instead of requiring
  // every character's stance codes to be hardcoded ahead of time.
  const stanceMatch = raw.match(/^(.+?)\s+stance$/i);
  if (stanceMatch) {
    let code = stanceMatch[1].trim();
    // Normalize trailing punctuation/spacing: "H." stays "H.", "BT" becomes "BT."
    code = code.replace(/\.+$/, "");
    const prefix = code.toLowerCase() === "ws" ? "ws" : `${code}.`;
    if (!(key in derivedPrefixCache)) {
      derivedPrefixCache[key] = prefix;
      console.log(`    · [${slug}] derived stance prefix "${prefix}" from heading "${raw}"`);
    }
    return prefix;
  }

  console.warn(
    `    ! [${slug}] unrecognized section heading "${headingText}" — no prefix applied. Add it to STANCE_PREFIX if commands look wrong.`
  );
  return "";
}

// Splits the combined "name + command link + badges" first cell into
// { name, command }. The command lives in an <a> tag (links to ?move=N on
// the same page). The move name precedes that link in the cell's markup,
// but it isn't necessarily a bare text node — it's very often wrapped in its
// own <span> or similar. Slicing the cell's raw HTML at the first <a> tag and
// stripping tags from the "before" half is robust to either case.
function splitNameAndCommand($, cell) {
  const $cell = $(cell);
  const $link = $cell.find("a").first();
  let command = "";
  let name = "";

  if ($link.length) {
    command = $link.text().trim().replace(/[›»▸]+\s*$/, "").trim();

    const html = $cell.html() || "";
    const linkIndex = html.search(/<a[\s>]/i);
    if (linkIndex > -1) {
      const beforeHtml = html.slice(0, linkIndex);
      name = cheerio.load(beforeHtml).text().trim();
    }
  } else {
    command = $cell.text().trim();
  }

  return { name, command };
}

// Rebuilds notes as "* item1* item2* item3" — the exact format already used
// across every existing data/*.json file.
function extractNotes($, cell) {
  const $cell = $(cell);
  const items = $cell
    .find("li")
    .map((_, li) => $(li).text().trim())
    .get()
    .filter(Boolean);

  if (items.length) return "* " + items.join("* ");

  const text = $cell.text().trim();
  return text ? "* " + text : "";
}

async function fetchWithRetry(url, attempts = 3) {
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; movelist-fetch/1.0)" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (i === attempts) throw err;
      console.warn(`    retrying (${i}/${attempts}) after error: ${err.message}`);
      await sleep(1000 * i);
    }
  }
}

async function scrapeCharacter(slug, displayName) {
  const url = `${BASE_URL}/${slug}`;
  const html = await fetchWithRetry(url);
  const $ = cheerio.load(html);

  const moves = [];
  let currentPrefix = "";
  let id = 1;

  // Walk headings and tables together, in document order, so we always know
  // which stance section we're under when a table is reached.
  $("h1, h2, h3, h4, table").each((_, el) => {
    const tag = el.tagName.toLowerCase();

    if (tag.startsWith("h")) {
      currentPrefix = prefixFor($(el).text(), slug);
      return;
    }

    $(el)
      .find("tbody tr, tr")
      .each((__, row) => {
        const cells = $(row).find("td");
        if (cells.length < 9) return; // skip header/spacer rows

        const { name, command } = splitNameAndCommand($, cells[0]);
        if (!command && !name) return;

        moves.push({
          command: currentPrefix ? `${currentPrefix}${command}` : command,
          name,
          hit_level: $(cells[1]).text().trim(),
          damage: $(cells[2]).text().trim(),
          startup: $(cells[3]).text().trim(),
          block: $(cells[4]).text().trim(),
          hit: $(cells[5]).text().trim(),
          counter_hit: $(cells[6]).text().trim(),
          active: $(cells[7]).text().trim(),
          notes: extractNotes($, cells[8]),
          scan: "",
          id: id++,
        });
      });
  });

  return { name: displayName, moves };
}

async function main() {
  const requested = process.argv.slice(2);
  const targets = requested.length
    ? requested.filter((slug) => {
        if (!ALL_KNOWN[slug]) {
          console.warn(`skipping "${slug}" — not in CHARACTERS or TEST_CHARACTERS map`);
          return false;
        }
        return true;
      })
    : Object.keys(CHARACTERS); // a full run only ever touches the remaining roster

  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const slug of targets) {
    const displayName = ALL_KNOWN[slug];
    process.stdout.write(`${slug} ... `);
    try {
      const data = await scrapeCharacter(slug, displayName);
      if (data.moves.length < 20) {
        console.log(
          `⚠ only ${data.moves.length} moves — likely a parsing problem, check this file manually before using it`
        );
      } else {
        console.log(`✓ ${data.moves.length} moves`);
      }
      fs.writeFileSync(
        path.join(OUT_DIR, `${slug}.json`),
        JSON.stringify(data, null, 2)
      );
    } catch (err) {
      console.log(`✗ ${err.message}`);
    }
    await sleep(DELAY_MS);
  }
}

main();
