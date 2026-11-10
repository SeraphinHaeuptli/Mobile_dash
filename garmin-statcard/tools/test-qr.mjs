// Runs source/QrCode.mc under Node (it is written in a JS-compatible subset of
// Monkey C) and checks that an independent decoder (jsQR) reads every symbol back.
import { readFileSync } from "node:fs";
import jsQR from "jsqr";

const src = readFileSync(new URL("../source/QrCode.mc", import.meta.url), "utf8");
const js = src
  .replace(/^\s*(import|using) .*;$/gm, "")
  .replace(/^module QrCode \{/m, "")
  .replace(/\}\s*$/, "")
  .replace(/new \[([^\]]+)\]/g, "new Array($1)")
  .replace(/\.size\(\)/g, ".length");
const QrCode = new Function(`${js}\nreturn { encode, MAX_BYTES };`)();

function decode(rows, scale = 4, quiet = 2) {
  const n = rows.length + 2 * quiet;
  const px = n * scale;
  const img = new Uint8ClampedArray(px * px * 4).fill(255);
  rows.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (!dark) return;
      for (let dy = 0; dy < scale; dy++)
        for (let dx = 0; dx < scale; dx++) {
          const i = (((y + quiet) * scale + dy) * px + (x + quiet) * scale + dx) * 4;
          img[i] = img[i + 1] = img[i + 2] = 0;
        }
    })
  );
  const r = jsQR(img, px, px, { inversionAttempts: "dontInvert" });
  return r && r.data;
}

const cases = [
  "https://www.strava.com/athletes/12345678",
  "A",
  "Sam - Garmin stats\nSteps today: 12345\n7 days: 48.2 km\nActive min/wk: 312\nResting HR: 52\nVO2 max: 54\nLast: Run 10.2 km 52:30",
];
// Every length 1..MAX_BYTES (covers versions 1-6 and their boundaries), random printable ASCII.
let seed = 42;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
for (let len = 1; len <= QrCode.MAX_BYTES; len++) {
  let s = "";
  for (let i = 0; i < len; i++) s += String.fromCharCode(32 + Math.floor(rnd() * 95));
  cases.push(s);
}

let failed = 0;
for (const text of cases) {
  const rows = QrCode.encode([...Buffer.from(text, "utf8")]);
  const got = rows && decode(rows);
  if (got !== text) {
    failed++;
    console.log(`FAIL len=${text.length} size=${rows && rows.length}: ${JSON.stringify(text).slice(0, 60)}`);
  }
}
const tooLong = QrCode.encode(new Array(QrCode.MAX_BYTES + 1).fill(65));
if (tooLong !== null) {
  failed++;
  console.log("FAIL: input over MAX_BYTES should return null");
}
console.log(`${cases.length - failed + (tooLong === null ? 1 : 0)}/${cases.length + 1} passed`);
process.exit(failed ? 1 : 0);
