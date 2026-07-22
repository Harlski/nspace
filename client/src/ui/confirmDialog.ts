/** Reusable, promise-based confirm dialog request (see HUD `showConfirm`). */
export type ConfirmRequest = {
  title: string;
  /** Primary explanatory line. */
  message: string;
  /** Optional secondary line rendered in a monospace style (e.g. an address). */
  detail?: string;
  /** Confirm button label (default "Confirm"). */
  confirmLabel?: string;
  /** Cancel button label (default "Cancel"). */
  cancelLabel?: string;
};
