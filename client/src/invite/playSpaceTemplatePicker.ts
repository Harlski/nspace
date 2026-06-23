import { apiUrl } from "../net/apiBase.js";

export type PlaySpaceTemplateOption = {
  id: string;
  displayName: string;
  isDefault: boolean;
  archived: boolean;
};

const ADMIN_PICK_STORAGE_KEY = "nspace_admin_play_space_template_id";

export async function fetchActivePlaySpaceTemplates(
  token: string
): Promise<PlaySpaceTemplateOption[]> {
  const res = await fetch(apiUrl("/api/admin/play-space-templates"), {
    headers: { Authorization: `Bearer ${token}` },
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) return [];
  const body = (await res.json()) as {
    templates?: PlaySpaceTemplateOption[];
  };
  return (body.templates ?? []).filter((t) => !t.archived);
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

/** Admin-only: pick an active template when more than one exists; `null` = cancelled. */
export async function pickPlaySpaceTemplateId(
  token: string
): Promise<string | undefined | null> {
  const templates = await fetchActivePlaySpaceTemplates(token);
  if (templates.length <= 1) return undefined;

  const stored = sessionStorage.getItem(ADMIN_PICK_STORAGE_KEY);
  const defaultId =
    (stored && templates.some((t) => t.id === stored) ? stored : null) ??
    templates.find((t) => t.isDefault)?.id ??
    templates[0]!.id;

  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "play-space-template-picker-backdrop";
    const options = templates
      .map(
        (t) =>
          `<label class="play-space-template-picker-option"><input type="radio" name="pst" value="${escHtml(t.id)}"${
            t.id === defaultId ? " checked" : ""
          }/> ${escHtml(t.displayName)}${t.isDefault ? " (default)" : ""}</label>`
      )
      .join("");
    backdrop.innerHTML =
      "<div class='play-space-template-picker' role='dialog' aria-labelledby='pst-title'>" +
      "<h3 id='pst-title'>Choose Play Space template</h3>" +
      "<div class='play-space-template-picker-list'>" +
      options +
      "</div>" +
      "<div class='play-space-template-picker-actions'>" +
      "<button type='button' data-pst-cancel>Cancel</button>" +
      "<button type='button' data-pst-confirm>Use template</button>" +
      "</div></div>";
    document.body.appendChild(backdrop);

    const close = (picked: string | undefined | null): void => {
      backdrop.remove();
      document.removeEventListener("keydown", onKey);
      resolve(picked);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") close(null);
    };
    document.addEventListener("keydown", onKey);
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) close(null);
    });
    backdrop.querySelector("[data-pst-cancel]")?.addEventListener("click", () => {
      close(null);
    });
    backdrop.querySelector("[data-pst-confirm]")?.addEventListener("click", () => {
      const checked = backdrop.querySelector<HTMLInputElement>(
        "input[name=pst]:checked"
      );
      const id = checked?.value?.trim();
      if (id) sessionStorage.setItem(ADMIN_PICK_STORAGE_KEY, id);
      close(id || undefined);
    });
  });
}
