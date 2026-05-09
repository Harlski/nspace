/** Optional `- [CODE] …` / paragraph-leading `[CODE] …` markers → `/patchnotes` badges. See `docs/patchnotes-release.md`. */
const PATCHNOTE_TAG_META = {
  NEW: { label: "New", title: "New feature", className: "patchnote-tag--new" },
  FIX: { label: "Fix", title: "Bug fix", className: "patchnote-tag--fix" },
  CHANGE: { label: "Update", title: "Change or improvement", className: "patchnote-tag--change" },
  PERF: { label: "Perf", title: "Performance", className: "patchnote-tag--perf" },
  OPS: { label: "Ops", title: "Deploy or operations", className: "patchnote-tag--ops" },
  SEC: { label: "Sec", title: "Security", className: "patchnote-tag--sec" },
} as const;

const PATCHNOTE_TAG_LEAD = /^\[([A-Z]{2,6})\]\s+/;

/** Escape then light inline formatting for trusted repo-authored patch notes. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineFmt(s: string): string {
  let t = escapeHtml(s);
  t = t.replace(/\*\*((?:(?!\*\*).)+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
  t = t.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  return t;
}

function patchnoteTagPrefix(raw: string): { prefix: string; rest: string } {
  const m = PATCHNOTE_TAG_LEAD.exec(raw);
  if (!m) return { prefix: "", rest: raw };
  const code = m[1]!;
  const meta = PATCHNOTE_TAG_META[code as keyof typeof PATCHNOTE_TAG_META];
  if (!meta) return { prefix: "", rest: raw };
  const rest = raw.slice(m[0].length);
  const prefix = `<span class="patchnote-tag ${meta.className}" title="${escapeHtml(meta.title)}">${escapeHtml(meta.label)}</span> `;
  return { prefix, rest };
}

/**
 * Drops `**Audience:**` / `**Depth:**` lines (and leading-line variants) so patch-note sources
 * can keep editorial hints without showing them in `/patchnotes`.
 */
export function stripPatchnoteAudienceDepth(md: string): string {
  return md
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (/^\*{2}Audience:\*{2}/i.test(t)) return false;
      if (/^\*{2}Depth:\*{2}/i.test(t)) return false;
      return true;
    })
    .join("\n");
}

/** Minimal markdown → HTML for versioned patch-note markdown (headings, lists, hr, paragraphs). */
export function patchnoteMdToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").trim().split("\n");
  const out: string[] = [];
  let i = 0;
  let inUl = false;
  const closeUl = (): void => {
    if (inUl) {
      out.push("</ul>");
      inUl = false;
    }
  };
  while (i < lines.length) {
    const line = lines[i]!;
    if (line.trim() === "---") {
      closeUl();
      out.push("<hr />");
      i++;
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      closeUl();
      const level = Math.min(h[1]!.length, 3);
      out.push(`<h${level}>${inlineFmt(h[2]!)}</h${level}>`);
      i++;
      continue;
    }
    if (line.startsWith("- ")) {
      if (!inUl) {
        out.push("<ul>");
        inUl = true;
      }
      const item = line.slice(2);
      const { prefix, rest } = patchnoteTagPrefix(item);
      out.push(`<li>${prefix}${inlineFmt(rest)}</li>`);
      i++;
      continue;
    }
    if (line.trim() === "") {
      closeUl();
      i++;
      continue;
    }
    closeUl();
    const lead = line.trimStart();
    const { prefix: pPrefix, rest: pRest } = patchnoteTagPrefix(lead);
    if (pPrefix) {
      out.push(`<p>${pPrefix}${inlineFmt(pRest.trimStart())}</p>`);
    } else {
      out.push(`<p>${inlineFmt(line)}</p>`);
    }
    i++;
  }
  closeUl();
  return out.join("\n");
}
