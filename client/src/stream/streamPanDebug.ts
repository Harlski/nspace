import type { Game, StreamPanDebugInfo, StreamPanTune } from "../game/Game.js";

type SliderDef = {
  key: keyof StreamPanTune;
  label: string;
  min: number;
  max: number;
  step: number;
};

const SLIDERS: SliderDef[] = [
  { key: "speed", label: "Pan speed (world u/s)", min: 1, max: 40, step: 0.5 },
  { key: "marginNorth", label: "Y inset — top (−Z)", min: 0, max: 200, step: 1 },
  { key: "marginSouth", label: "Y inset — bottom (+Z)", min: 0, max: 200, step: 1 },
  { key: "marginWest", label: "X inset — left (−X)", min: 0, max: 200, step: 1 },
  { key: "marginEast", label: "X inset — right (+X)", min: 0, max: 200, step: 1 },
];

export function mountStreamPanDebugPanel(
  game: Game,
  root: HTMLElement
): () => void {
  const panel = document.createElement("div");
  panel.className = "stream-pan-debug";
  panel.innerHTML = `
    <div class="stream-pan-debug__title">Stream pan tune</div>
    <div class="stream-pan-debug__hint">?streamDebug=1 — adjust X/Y insets (world tiles) and pan speed while watching the live readout.</div>
    <div class="stream-pan-debug__sliders"></div>
    <pre class="stream-pan-debug__readout" aria-live="polite"></pre>
    <button type="button" class="stream-pan-debug__copy">Copy tune JSON</button>
  `;
  root.appendChild(panel);

  const slidersHost = panel.querySelector(
    ".stream-pan-debug__sliders"
  ) as HTMLElement;
  const readout = panel.querySelector(
    ".stream-pan-debug__readout"
  ) as HTMLPreElement;
  const copyBtn = panel.querySelector(
    ".stream-pan-debug__copy"
  ) as HTMLButtonElement;

  const inputs = new Map<keyof StreamPanTune, HTMLInputElement>();

  for (const def of SLIDERS) {
    const row = document.createElement("label");
    row.className = "stream-pan-debug__row";
    const span = document.createElement("span");
    span.className = "stream-pan-debug__label";
    const tune = game.getStreamPanTune();
    const updateLabel = (v: number): void => {
      span.textContent = `${def.label}: ${v}`;
    };
    updateLabel(tune[def.key]);
    const input = document.createElement("input");
    input.type = "range";
    input.min = String(def.min);
    input.max = String(def.max);
    input.step = String(def.step);
    input.value = String(tune[def.key]);
    input.addEventListener("input", () => {
      const v = Number(input.value);
      game.setStreamPanTune({ [def.key]: v });
      updateLabel(v);
      game.requestRender();
    });
    inputs.set(def.key, input);
    row.append(span, input);
    slidersHost.appendChild(row);
  }

  const formatInfo = (info: StreamPanDebugInfo | null): string => {
    if (!info) return "Pan debug unavailable";
    const t = info.tune;
    return [
      `look X/Z: ${info.lookX.toFixed(2)} / ${info.lookZ.toFixed(2)}`,
      `half W/H: ${info.halfW.toFixed(2)} / ${info.halfH.toFixed(2)}`,
      `view west→east: ${info.west.toFixed(2)} → ${info.east.toFixed(2)}`,
      `view north→south: ${info.north.toFixed(2)} → ${info.south.toFixed(2)}`,
      `room outer Z: ${info.roomMinZ.toFixed(2)} → ${info.roomMaxZ.toFixed(2)}`,
      `look limits X: ${info.limitMinX.toFixed(2)} → ${info.limitMaxX.toFixed(2)}`,
      `look limits Z: ${info.limitMinZ.toFixed(2)} → ${info.limitMaxZ.toFixed(2)}`,
      `tune: speed=${t.speed} N=${t.marginNorth} S=${t.marginSouth} W=${t.marginWest} E=${t.marginEast}`,
    ].join("\n");
  };

  let raf = 0;
  const tick = (): void => {
    const tune = game.getStreamPanTune();
    for (const def of SLIDERS) {
      const input = inputs.get(def.key);
      if (!input) continue;
      const v = tune[def.key];
      if (input.value !== String(v)) {
        input.value = String(v);
      }
      const label = input.previousElementSibling as HTMLElement | null;
      if (label?.classList.contains("stream-pan-debug__label")) {
        label.textContent = `${def.label}: ${v}`;
      }
    }
    readout.textContent = formatInfo(game.getStreamPanDebugInfo());
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  copyBtn.addEventListener("click", () => {
    const json = JSON.stringify(game.getStreamPanTune(), null, 2);
    void navigator.clipboard.writeText(json).catch(() => {
      /* ignore */
    });
    copyBtn.textContent = "Copied!";
    setTimeout(() => {
      copyBtn.textContent = "Copy tune JSON";
    }, 1200);
  });

  return () => {
    cancelAnimationFrame(raf);
    panel.remove();
  };
}
