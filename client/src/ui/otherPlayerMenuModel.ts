/** Pure shape of the Other Player Menu (viewer + target → panels/rows). */

export type OtherPlayerMenuPanelId =
  | "root"
  | "actions"
  | "more"
  | "administrative";

export type OtherPlayerMenuRowId =
  | "view"
  | "accept1v1"
  | "viewProfile"
  | "whisper"
  | "more"
  | "administrative"
  | "freeze";

export type OtherPlayerMenuRow = {
  id: OtherPlayerMenuRowId;
  label: string;
  kind: "drill" | "action";
  drillTo?: OtherPlayerMenuPanelId;
  disabled?: boolean;
  showIdenticon?: boolean;
};

export type OtherPlayerMenuPanel = {
  id: OtherPlayerMenuPanelId;
  /** Present on non-root panels for the header Back row. */
  title?: string;
  rows: OtherPlayerMenuRow[];
};

export type OtherPlayerMenuModel = {
  panels: Record<OtherPlayerMenuPanelId, OtherPlayerMenuPanel | undefined>;
};

export type OtherPlayerMenuModelInput = {
  username: string;
  challengeOpen: boolean;
  viewerIsGameAdmin: boolean;
  targetIsGameAdmin: boolean;
  targetFrozen: boolean;
};

export function buildOtherPlayerMenuModel(
  input: OtherPlayerMenuModelInput
): OtherPlayerMenuModel {
  const name = input.username.trim() || "Player";

  const adminRows: OtherPlayerMenuRow[] = [];
  if (input.viewerIsGameAdmin) {
    adminRows.push({
      id: "freeze",
      label: input.targetFrozen ? "Unfreeze Player" : "Freeze Player",
      kind: "action",
      disabled: input.targetIsGameAdmin,
    });
  }

  const moreRows: OtherPlayerMenuRow[] = [];
  if (adminRows.length > 0) {
    moreRows.push({
      id: "administrative",
      label: "Administrative",
      kind: "drill",
      drillTo: "administrative",
    });
  }

  const actionRows: OtherPlayerMenuRow[] = [
    { id: "viewProfile", label: "View Profile", kind: "action" },
    { id: "whisper", label: "Whisper", kind: "action" },
  ];
  if (moreRows.length > 0) {
    actionRows.push({
      id: "more",
      label: "More",
      kind: "drill",
      drillTo: "more",
    });
  }

  const rootRows: OtherPlayerMenuRow[] = [
    {
      id: "view",
      label: `View ${name}`,
      kind: "drill",
      drillTo: "actions",
      showIdenticon: true,
    },
  ];
  if (input.challengeOpen) {
    rootRows.push({
      id: "accept1v1",
      label: "⚽ Accept 1v1 challenge",
      kind: "action",
    });
  }

  return {
    panels: {
      root: { id: "root", rows: rootRows },
      actions: { id: "actions", title: name, rows: actionRows },
      more:
        moreRows.length > 0
          ? { id: "more", title: "More", rows: moreRows }
          : undefined,
      administrative:
        adminRows.length > 0
          ? {
              id: "administrative",
              title: "Administrative",
              rows: adminRows,
            }
          : undefined,
    },
  };
}
