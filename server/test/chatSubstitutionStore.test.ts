import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  addChatSubstitution,
  applyChatSubstitution,
  applyStoredChatSubstitution,
  listChatSubstitutions,
  patchChatSubstitution,
  removeChatSubstitution,
  type ChatSubstitution,
} from "../src/chatSubstitutionStore.js";

const joke = "I wet the bed and I can't stop.";

function rule(
  partial: Partial<ChatSubstitution> & Pick<ChatSubstitution, "trigger" | "replacement">
): ChatSubstitution {
  return {
    id: partial.id ?? "r1",
    trigger: partial.trigger,
    replacement: partial.replacement,
    enabled: partial.enabled ?? true,
  };
}

test("applyChatSubstitution replaces an exact enabled trigger", () => {
  const out = applyChatSubstitution(".I.", [
    rule({ trigger: ".I.", replacement: joke }),
  ]);
  assert.equal(out.text, joke);
  assert.equal(out.substitutedFrom, ".I.");
});

test("applyChatSubstitution leaves a non-matching line unchanged", () => {
  const out = applyChatSubstitution("hello", [
    rule({ trigger: ".I.", replacement: joke }),
  ]);
  assert.equal(out.text, "hello");
  assert.equal(out.substitutedFrom, null);
});

test("applyChatSubstitution ignores a disabled rule", () => {
  const out = applyChatSubstitution(".I.", [
    rule({ trigger: ".I.", replacement: joke, enabled: false }),
  ]);
  assert.equal(out.text, ".I.");
  assert.equal(out.substitutedFrom, null);
});

test("applyChatSubstitution does not match a trigger inside a longer line", () => {
  const out = applyChatSubstitution("hello .I. there", [
    rule({ trigger: ".I.", replacement: joke }),
  ]);
  assert.equal(out.text, "hello .I. there");
  assert.equal(out.substitutedFrom, null);
});

test("applyChatSubstitution does not fold I / ı / İ", () => {
  const rules = [rule({ trigger: ".I.", replacement: joke })];
  assert.equal(applyChatSubstitution(".i.", rules).substitutedFrom, null);
  assert.equal(applyChatSubstitution(".ı.", rules).substitutedFrom, null);
  assert.equal(applyChatSubstitution(".İ.", rules).substitutedFrom, null);
});

function withTempStore(run: () => void): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nspace-chat-sub-"));
  const prev = process.env.CHAT_SUBSTITUTION_STORE_FILE;
  process.env.CHAT_SUBSTITUTION_STORE_FILE = path.join(dir, "chat-substitutions.json");
  try {
    run();
  } finally {
    if (prev === undefined) delete process.env.CHAT_SUBSTITUTION_STORE_FILE;
    else process.env.CHAT_SUBSTITUTION_STORE_FILE = prev;
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("listChatSubstitutions seeds the three I-variant jokes when the store is missing", () => {
  withTempStore(() => {
    const list = listChatSubstitutions();
    assert.equal(list.length, 3);
    const byTrigger = new Map(list.map((s) => [s.trigger, s]));
    for (const trigger of [".I.", ".ı.", ".İ."]) {
      const row = byTrigger.get(trigger);
      assert.ok(row, trigger);
      assert.equal(row.replacement, joke);
      assert.equal(row.enabled, true);
    }
    assert.equal(applyChatSubstitution(".I.", list).text, joke);
    assert.equal(applyChatSubstitution(".ı.", list).text, joke);
    assert.equal(applyChatSubstitution(".İ.", list).text, joke);
  });
});

test("listChatSubstitutions does not re-seed an existing empty store", () => {
  withTempStore(() => {
    fs.writeFileSync(
      process.env.CHAT_SUBSTITUTION_STORE_FILE!,
      JSON.stringify({ substitutions: [] }),
      "utf8"
    );
    assert.equal(listChatSubstitutions().length, 0);
  });
});

test("addChatSubstitution persists a new enabled rule", () => {
  withTempStore(() => {
    fs.writeFileSync(
      process.env.CHAT_SUBSTITUTION_STORE_FILE!,
      JSON.stringify({ substitutions: [] }),
      "utf8"
    );
    const added = addChatSubstitution({
      trigger: "  ping  ",
      replacement: "pong",
    });
    assert.equal(added.ok, true);
    if (!added.ok) return;
    assert.equal(added.value.trigger, "ping");
    assert.equal(added.value.replacement, "pong");
    assert.equal(added.value.enabled, true);
    assert.equal(listChatSubstitutions().length, 1);
    assert.equal(applyStoredChatSubstitution("ping").text, "pong");
  });
});

test("addChatSubstitution rejects a duplicate trigger", () => {
  withTempStore(() => {
    const first = addChatSubstitution({ trigger: ".I.", replacement: "nope" });
    assert.equal(first.ok, false);
    if (first.ok) return;
    assert.equal(first.error, "duplicate_trigger");
  });
});

test("addChatSubstitution rejects empty trigger or replacement", () => {
  withTempStore(() => {
    fs.writeFileSync(
      process.env.CHAT_SUBSTITUTION_STORE_FILE!,
      JSON.stringify({ substitutions: [] }),
      "utf8"
    );
    const noTrigger = addChatSubstitution({ trigger: "   ", replacement: "x" });
    assert.equal(noTrigger.ok, false);
    if (!noTrigger.ok) assert.equal(noTrigger.error, "empty_trigger");
    const noReplacement = addChatSubstitution({
      trigger: "x",
      replacement: "\n",
    });
    assert.equal(noReplacement.ok, false);
    if (!noReplacement.ok) assert.equal(noReplacement.error, "empty_replacement");
  });
});

test("patchChatSubstitution can disable a seeded rule", () => {
  withTempStore(() => {
    const seeded = listChatSubstitutions();
    const ascii = seeded.find((s) => s.trigger === ".I.");
    assert.ok(ascii);
    const patched = patchChatSubstitution(ascii.id, { enabled: false });
    assert.equal(patched.ok, true);
    assert.equal(applyStoredChatSubstitution(".I.").substitutedFrom, null);
    assert.equal(applyStoredChatSubstitution(".ı.").text, joke);
  });
});

test("removeChatSubstitution deletes a rule", () => {
  withTempStore(() => {
    const seeded = listChatSubstitutions();
    const ascii = seeded.find((s) => s.trigger === ".I.");
    assert.ok(ascii);
    const removed = removeChatSubstitution(ascii.id);
    assert.equal(removed.ok, true);
    assert.equal(
      listChatSubstitutions().some((s) => s.id === ascii.id),
      false
    );
    assert.equal(applyStoredChatSubstitution(".I.").substitutedFrom, null);
  });
});

test("removeChatSubstitution reports not_found", () => {
  withTempStore(() => {
    const removed = removeChatSubstitution("missing-id");
    assert.equal(removed.ok, false);
    if (!removed.ok) assert.equal(removed.error, "not_found");
  });
});
