import { describe, expect, it } from "vitest";
import { compareSemverDesc } from "./collectPatchnotes.js";
import { patchnoteMdToHtml, stripPatchnoteAudienceDepth } from "./mdToHtml.js";

describe("patchnoteMdToHtml", () => {
  it("renders lists and bold", () => {
    const html = patchnoteMdToHtml("- **A:** one\n- two");
    expect(html).toContain("<ul>");
    expect(html).toContain("<strong>A:</strong>");
    expect(html).toContain("<li>");
  });

  it("renders hr and headings", () => {
    const html = patchnoteMdToHtml("## Hi\n\n---\n\npara");
    expect(html).toContain("<h2>");
    expect(html).toContain("<hr />");
    expect(html).toContain("<p>");
  });

  it("renders known list change tags as badges", () => {
    const html = patchnoteMdToHtml("- [NEW] Ship it\n- [FIX] Crash gone");
    expect(html).toContain("patchnote-tag--new");
    expect(html).toContain("patchnote-tag--fix");
    expect(html).toContain("Ship it");
    expect(html).toContain("Crash gone");
  });

  it("leaves unknown bracket codes in list items", () => {
    const html = patchnoteMdToHtml("- [XYZ] mystery");
    expect(html).not.toContain("patchnote-tag");
    expect(html).toContain("[XYZ]");
  });

  it("renders leading paragraph change tag", () => {
    const html = patchnoteMdToHtml("[CHANGE] One line.");
    expect(html).toContain("patchnote-tag--change");
    expect(html).toContain("One line.");
  });
});

describe("stripPatchnoteAudienceDepth", () => {
  it("removes Audience and Depth lines", () => {
    const md = `Hello\n\n**Audience:** x\n**Depth:** y\n\nMore`;
    expect(stripPatchnoteAudienceDepth(md)).toBe("Hello\n\n\nMore");
  });
});

describe("compareSemverDesc", () => {
  it("orders highest first", () => {
    expect(compareSemverDesc("0.3.4", "0.3.3")).toBeLessThan(0);
    expect(compareSemverDesc("0.3.3", "0.3.4")).toBeGreaterThan(0);
    expect(compareSemverDesc("0.3.4", "0.3.4")).toBe(0);
  });
});
