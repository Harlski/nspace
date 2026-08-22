import {
  getSharedTranslator,
  LOCALE_DISPLAY_NAME,
  LOCALE_FLAG_CODE,
  SUPPORTED_LOCALES,
  t,
  type SupportedLocale,
} from "@nspace/i18n";
import { setClientLocale } from "../i18n/bootstrap.js";
import { createFlagImg } from "./flags.js";

export type LanguageModal = {
  open: () => void;
  close: () => void;
  isOpen: () => boolean;
  root: HTMLElement;
};

/**
 * Full-screen language picker (confirm-dialog chrome). Flags stay recognizable
 * after a locale switch so players can find their way back.
 */
export function createLanguageModal(parent: HTMLElement): LanguageModal {
  const root = document.createElement("div");
  root.className = "external-visit-confirm language-modal";
  root.hidden = true;
  root.setAttribute("aria-hidden", "true");

  const backdrop = document.createElement("div");
  backdrop.className = "external-visit-confirm__backdrop";
  backdrop.setAttribute("aria-hidden", "true");

  const dialog = document.createElement("div");
  dialog.className = "external-visit-confirm__dialog language-modal__dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "language-modal-title");

  const recovery = document.createElement("p");
  recovery.className = "language-modal__recovery";
  recovery.id = "language-modal-recovery";

  const title = document.createElement("h2");
  title.className = "external-visit-confirm__title";
  title.id = "language-modal-title";

  const lead = document.createElement("p");
  lead.className = "external-visit-confirm__lead language-modal__lead";

  const list = document.createElement("div");
  list.className = "language-modal__list";
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-labelledby", "language-modal-title");

  const actions = document.createElement("div");
  actions.className = "external-visit-confirm__actions";

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className =
    "external-visit-confirm__btn external-visit-confirm__btn--cancel";

  actions.appendChild(closeBtn);
  dialog.append(recovery, title, lead, list, actions);
  root.append(backdrop, dialog);
  parent.appendChild(root);

  let open = false;
  let escHandler: ((e: KeyboardEvent) => void) | null = null;

  function applyCopy(): void {
    // Always English so a switched locale still reads as "Language".
    recovery.textContent =
      getSharedTranslator().en("language.recoveryTitle") ?? "Language";
    title.textContent = t("language.title");
    lead.textContent = t("language.modalLead");
    closeBtn.textContent = t("common.close");
  }

  function renderChoices(): void {
    list.replaceChildren();
    const current = getSharedTranslator().getLocale();
    for (const loc of SUPPORTED_LOCALES) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "language-modal__option";
      btn.setAttribute("role", "option");
      btn.dataset.locale = loc;
      btn.setAttribute(
        "aria-selected",
        loc === current ? "true" : "false"
      );
      if (loc === current) {
        btn.classList.add("language-modal__option--current");
      }

      const flag =
        createFlagImg(LOCALE_FLAG_CODE[loc], {
          className: "language-modal__flag",
          size: "28px",
          title: LOCALE_DISPLAY_NAME[loc],
        }) ?? document.createElement("span");
      if (!(flag instanceof HTMLImageElement)) {
        flag.className = "language-modal__flag language-modal__flag--fallback";
        flag.textContent = LOCALE_FLAG_CODE[loc];
      }

      const name = document.createElement("span");
      name.className = "language-modal__name";
      name.textContent = LOCALE_DISPLAY_NAME[loc];

      btn.append(flag, name);
      btn.addEventListener("click", () => {
        setClientLocale(loc as SupportedLocale);
        closeModal();
      });
      list.appendChild(btn);
    }
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key !== "Escape") return;
    e.preventDefault();
    e.stopPropagation();
    closeModal();
  }

  function closeModal(): void {
    if (!open) return;
    open = false;
    root.hidden = true;
    root.setAttribute("aria-hidden", "true");
    if (escHandler) {
      window.removeEventListener("keydown", escHandler, true);
      escHandler = null;
    }
  }

  function openModal(): void {
    applyCopy();
    renderChoices();
    open = true;
    root.hidden = false;
    root.setAttribute("aria-hidden", "false");
    escHandler = onKeydown;
    window.addEventListener("keydown", escHandler, true);
    const current = list.querySelector(
      ".language-modal__option--current"
    ) as HTMLButtonElement | null;
    (current ?? closeBtn).focus();
  }

  backdrop.addEventListener("click", () => closeModal());
  closeBtn.addEventListener("click", () => closeModal());

  getSharedTranslator().subscribe(() => {
    if (!open) return;
    applyCopy();
    renderChoices();
  });

  return {
    root,
    open: openModal,
    close: closeModal,
    isOpen: () => open,
  };
}
