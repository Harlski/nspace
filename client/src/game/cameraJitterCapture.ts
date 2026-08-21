/**
 * Opt-in capture for local camera / self-pose hitch diagnosis.
 * Enable with `?camjit=1`, walk a straight line, then dump via Shift+J
 * or `window.__nspaceCamJitDump()`.
 *
 * All console lines use the `[DEBUG-camjit]` prefix for easy grep cleanup.
 */

export type CamJitSample = {
  t: number;
  dt: number;
  meshX: number;
  meshZ: number;
  targetX: number;
  targetZ: number;
  lookX: number;
  lookZ: number;
  aheadX: number;
  aheadZ: number;
  /** Camera world aim = lookAt + lookAhead (what the player sees). */
  camX: number;
  camZ: number;
  svx: number;
  svz: number;
  playback: boolean;
  /** Frame delta of mesh (pre look-ahead); not velocity/sec. */
  dMeshX: number;
  dMeshZ: number;
  tags: string[];
};

export type CamJitFrameInput = {
  t: number;
  dt: number;
  meshX: number;
  meshZ: number;
  targetX: number;
  targetZ: number;
  lookX: number;
  lookZ: number;
  aheadX: number;
  aheadZ: number;
  svx: number;
  svz: number;
  playback: boolean;
};

const MESH_JUMP = 0.08;
const MESH_REWIND = 0.04;
const AHEAD_SPIKE = 0.35;
const CAM_JUMP = 0.12;
const TARGET_JUMP = 0.15;

/** Pure classifier so we can unit-test spike tags without a WebGL loop. */
export function classifyCamJitSpike(
  prev: CamJitFrameInput | null,
  cur: CamJitFrameInput
): { tags: string[]; dMeshX: number; dMeshZ: number } {
  if (!prev) {
    return { tags: ["start"], dMeshX: 0, dMeshZ: 0 };
  }
  const dMeshX = cur.meshX - prev.meshX;
  const dMeshZ = cur.meshZ - prev.meshZ;
  const dMesh = Math.hypot(dMeshX, dMeshZ);
  const dTarget = Math.hypot(cur.targetX - prev.targetX, cur.targetZ - prev.targetZ);
  const dAhead = Math.hypot(cur.aheadX - prev.aheadX, cur.aheadZ - prev.aheadZ);
  const camX = cur.lookX + cur.aheadX;
  const camZ = cur.lookZ + cur.aheadZ;
  const prevCamX = prev.lookX + prev.aheadX;
  const prevCamZ = prev.lookZ + prev.aheadZ;
  const dCam = Math.hypot(camX - prevCamX, camZ - prevCamZ);
  const tags: string[] = [];

  if (dMesh > MESH_JUMP) tags.push("mesh_jump");
  if (dTarget > TARGET_JUMP) tags.push("target_jump");
  if (dAhead > AHEAD_SPIKE) tags.push("ahead_spike");
  if (dCam > CAM_JUMP) tags.push("cam_jump");

  // Rewind = mesh moved opposite to recent travel while playback claims forward motion.
  const speed = Math.hypot(cur.svx, cur.svz);
  if (speed > 0.5 && dMesh > 1e-4) {
    const along = (dMeshX * cur.svx + dMeshZ * cur.svz) / (speed * dMesh);
    if (along < -0.2 && dMesh > MESH_REWIND) tags.push("mesh_rewind");
  }

  // Path Playback target + soft-extrap double-count: mesh ahead of target along velocity.
  if (cur.playback && speed > 0.5) {
    const leadX = cur.meshX - cur.targetX;
    const leadZ = cur.meshZ - cur.targetZ;
    const lead = Math.hypot(leadX, leadZ);
    const leadAlong = (leadX * cur.svx + leadZ * cur.svz) / speed;
    if (leadAlong > 0.05 && lead > 0.05) tags.push("extrap_lead");
  }

  if (prev.playback && !cur.playback) tags.push("playback_end");
  if (!prev.playback && cur.playback) tags.push("playback_start");

  return { tags, dMeshX, dMeshZ };
}

export type CamJitDump = {
  capturedAt: string;
  sampleCount: number;
  eventCount: number;
  summary: Record<string, number>;
  events: CamJitSample[];
  /** Last N frames (including quiet ones) for context around spikes. */
  tail: CamJitSample[];
};

const PREFIX = "[DEBUG-camjit]";

export class CameraJitterCapture {
  private readonly maxSamples: number;
  private readonly samples: CamJitSample[] = [];
  private prev: CamJitFrameInput | null = null;
  private enabled = true;

  constructor(maxSamples = 2400) {
    this.maxSamples = maxSamples;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  clear(): void {
    this.samples.length = 0;
    this.prev = null;
  }

  sample(input: CamJitFrameInput): CamJitSample | null {
    if (!this.enabled) return null;
    const { tags, dMeshX, dMeshZ } = classifyCamJitSpike(this.prev, input);
    const sample: CamJitSample = {
      ...input,
      camX: input.lookX + input.aheadX,
      camZ: input.lookZ + input.aheadZ,
      dMeshX,
      dMeshZ,
      tags,
    };
    this.samples.push(sample);
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }
    this.prev = input;
    if (tags.some((t) => t !== "start")) {
      // eslint-disable-next-line no-console
      console.log(PREFIX, tags.join(","), {
        t: sample.t.toFixed(0),
        mesh: `${sample.meshX.toFixed(3)},${sample.meshZ.toFixed(3)}`,
        target: `${sample.targetX.toFixed(3)},${sample.targetZ.toFixed(3)}`,
        ahead: `${sample.aheadX.toFixed(3)},${sample.aheadZ.toFixed(3)}`,
        cam: `${sample.camX.toFixed(3)},${sample.camZ.toFixed(3)}`,
        sv: `${sample.svx.toFixed(2)},${sample.svz.toFixed(2)}`,
        playback: sample.playback,
        dt: sample.dt.toFixed(3),
      });
    }
    return sample;
  }

  dump(): CamJitDump {
    const summary: Record<string, number> = {};
    const events: CamJitSample[] = [];
    for (const s of this.samples) {
      for (const tag of s.tags) {
        if (tag === "start") continue;
        summary[tag] = (summary[tag] ?? 0) + 1;
      }
      if (s.tags.some((t) => t !== "start")) events.push(s);
    }
    const dump: CamJitDump = {
      capturedAt: new Date().toISOString(),
      sampleCount: this.samples.length,
      eventCount: events.length,
      summary,
      events,
      tail: this.samples.slice(-120),
    };
    // eslint-disable-next-line no-console
    console.log(PREFIX, "dump", {
      sampleCount: dump.sampleCount,
      eventCount: dump.eventCount,
      summary: dump.summary,
    });
    return dump;
  }

  /** Pretty one-liner for the debug HUD. */
  hudLine(): string {
    const summary = this.tagSummary();
    const parts = Object.entries(summary)
      .map(([k, v]) => `${k}:${v}`)
      .join(" ");
    return `camjit events ${parts || "(none yet)"} — Shift+J dump`;
  }

  private tagSummary(): Record<string, number> {
    const summary: Record<string, number> = {};
    for (const s of this.samples) {
      for (const tag of s.tags) {
        if (tag === "start") continue;
        summary[tag] = (summary[tag] ?? 0) + 1;
      }
    }
    return summary;
  }
}

declare global {
  interface Window {
    __nspaceCamJitDump?: () => CamJitDump;
    __nspaceCamJitClear?: () => void;
  }
}
