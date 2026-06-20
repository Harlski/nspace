/**
 * World Cup soccer — searchable country picker (seasonal, deletable).
 *
 * Reuses the blocking-overlay pattern of `usernamePromptModal` but is fully
 * self-contained (inline styles) so it can be removed with the rest of `worldcup/`.
 */
import { COUNTRIES, type Country, countryName, flagEmoji } from "./countries.js";

export type CountryPickerOptions = {
  currentCode: string | null;
  onPick: (code: string) => void;
  /** When true the player may dismiss without choosing (backdrop / Esc / close). */
  dismissable?: boolean;
  /** Optional reason line (e.g. "You scored! Pick your country."). */
  prompt?: string;
};

let openOverlay: HTMLDivElement | null = null;

export function closeCountryPicker(): void {
  if (openOverlay) {
    openOverlay.remove();
    openOverlay = null;
  }
}

export function showCountryPickerModal(opts: CountryPickerOptions): void {
  closeCountryPicker();

  const wrap = document.createElement("div");
  openOverlay = wrap;
  wrap.setAttribute("role", "dialog");
  wrap.setAttribute("aria-modal", "true");
  wrap.setAttribute("aria-label", "Pick your country");
  wrap.style.cssText =
    "position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:2147483646;display:flex;align-items:center;justify-content:center;padding:1rem;box-sizing:border-box;font-family:inherit;";

  const card = document.createElement("div");
  card.style.cssText =
    "background:#16181d;color:#f4f5f7;border:1px solid rgba(255,255,255,0.12);border-radius:14px;width:min(420px,94vw);max-height:80vh;display:flex;flex-direction:column;box-shadow:0 18px 60px rgba(0,0,0,0.5);overflow:hidden;";

  const header = document.createElement("div");
  header.style.cssText = "padding:1rem 1rem 0.5rem;";
  const title = document.createElement("h2");
  title.textContent = "Pick your country";
  title.style.cssText = "margin:0;font-size:1.05rem;font-weight:700;";
  header.appendChild(title);
  if (opts.prompt) {
    const p = document.createElement("p");
    p.textContent = opts.prompt;
    p.style.cssText = "margin:0.35rem 0 0;font-size:0.85rem;opacity:0.8;";
    header.appendChild(p);
  }
  card.appendChild(header);

  const search = document.createElement("input");
  search.type = "text";
  search.placeholder = "Search countries…";
  search.autocomplete = "off";
  search.spellcheck = false;
  search.style.cssText =
    "margin:0.5rem 1rem;padding:0.55rem 0.7rem;border-radius:9px;border:1px solid rgba(255,255,255,0.16);background:#0e1014;color:#fff;font-size:0.95rem;outline:none;";
  card.appendChild(search);

  const list = document.createElement("div");
  list.style.cssText =
    "overflow-y:auto;flex:1 1 auto;padding:0.25rem 0.5rem 0.75rem;min-height:120px;";
  card.appendChild(list);

  const current = opts.currentCode?.toUpperCase() ?? null;

  const rowFor = (c: Country): HTMLButtonElement => {
    const row = document.createElement("button");
    row.type = "button";
    row.dataset["code"] = c.code;
    const isCurrent = c.code === current;
    row.style.cssText = `display:flex;align-items:center;gap:0.6rem;width:100%;text-align:left;padding:0.5rem 0.6rem;border:none;border-radius:8px;background:${isCurrent ? "rgba(255,255,255,0.10)" : "transparent"};color:#f4f5f7;font-size:0.95rem;cursor:pointer;`;
    const flag = document.createElement("span");
    flag.textContent = flagEmoji(c.code);
    flag.style.cssText = "font-size:1.25rem;line-height:1;";
    const name = document.createElement("span");
    name.textContent = c.name;
    name.style.cssText = "flex:1 1 auto;";
    row.appendChild(flag);
    row.appendChild(name);
    if (isCurrent) {
      const tick = document.createElement("span");
      tick.textContent = "✓";
      tick.style.cssText = "opacity:0.7;";
      row.appendChild(tick);
    }
    row.addEventListener("mouseenter", () => {
      row.style.background = "rgba(255,255,255,0.08)";
    });
    row.addEventListener("mouseleave", () => {
      row.style.background = isCurrent
        ? "rgba(255,255,255,0.10)"
        : "transparent";
    });
    row.addEventListener("click", () => {
      opts.onPick(c.code);
      closeCountryPicker();
    });
    return row;
  };

  const render = (filter: string): void => {
    const q = filter.trim().toLowerCase();
    list.textContent = "";
    const matches = q
      ? COUNTRIES.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.code.toLowerCase().includes(q)
        )
      : COUNTRIES;
    if (matches.length === 0) {
      const empty = document.createElement("div");
      empty.textContent = "No matches";
      empty.style.cssText = "padding:0.75rem 0.6rem;opacity:0.6;";
      list.appendChild(empty);
      return;
    }
    for (const c of matches) list.appendChild(rowFor(c));
  };

  search.addEventListener("input", () => render(search.value));
  search.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      const first = list.querySelector("button[data-code]");
      if (first instanceof HTMLButtonElement) first.click();
    } else if (ev.key === "Escape" && opts.dismissable !== false) {
      closeCountryPicker();
    }
  });

  if (opts.dismissable !== false) {
    wrap.addEventListener("click", (ev) => {
      if (ev.target === wrap) closeCountryPicker();
    });
  }

  render("");
  wrap.appendChild(card);
  document.body.appendChild(wrap);
  setTimeout(() => search.focus(), 30);
}

export { countryName, flagEmoji };
