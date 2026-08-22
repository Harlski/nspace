import fs from "fs";

const src = fs.readFileSync("server/src/achievementDefinitions.ts", "utf8");
const constIds = {};
for (const m of src.matchAll(/export const ([A-Z0-9_]+)\s*=\s*"([^"]+)"/g)) {
  constIds[m[1]] = m[2];
}

const start = src.indexOf("export const ACHIEVEMENT_DEFINITIONS");
const arrStart = src.indexOf("[", start);
let depth = 0;
let i = arrStart;
for (; i < src.length; i++) {
  const c = src[i];
  if (c === "[") depth++;
  else if (c === "]") {
    depth--;
    if (depth === 0) {
      i++;
      break;
    }
  }
}
const body = src.slice(arrStart, i);

function unescapeStr(s) {
  return s
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

const defs = [];
const objRe =
  /\{\s*id:\s*(?:([A-Z_][A-Z0-9_]*)|"([^"]+)")\s*,\s*title:\s*"((?:\\.|[^"\\])*)"\s*,\s*description:\s*/gs;

let m;
while ((m = objRe.exec(body))) {
  const id = m[2] ?? constIds[m[1]];
  if (!id) {
    console.error("missing id for", m[1]);
    continue;
  }
  const title = unescapeStr(m[3]);
  let pos = objRe.lastIndex;
  // Skip whitespace
  while (pos < body.length && /\s/.test(body[pos])) pos++;
  let description = "";
  if (body[pos] === '"') {
    // single or adjacent string literals until category
    const chunkEnd = body.indexOf("\n    category:", pos);
    const chunk = body.slice(pos, chunkEnd > 0 ? chunkEnd : pos + 500);
    const parts = [...chunk.matchAll(/"((?:\\.|[^"\\])*)"/g)].map((x) =>
      unescapeStr(x[1]),
    );
    description = parts.join("");
  }
  defs.push({ id, title, description });
}

console.log("count", defs.length);
fs.writeFileSync(
  ".scratch/localization/achievements-extract.json",
  JSON.stringify(defs, null, 2),
);
