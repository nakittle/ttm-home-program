import { describe, expect, it } from "vitest";
import { activeGroups, creditLine, getPosture, groupsFile, postures, posturesForGroups, redflags, rulesAskedAt } from "@/lib/content";

describe("content files", () => {
  it("has the 13 unique postures from DTAM sheets 1, 2 and 6", () => {
    expect(postures).toHaveLength(13);
    expect(new Set(postures.map((p) => p.id)).size).toBe(13);
    for (const p of postures) expect([1, 2, 6]).toContain(p.source.sheet);
  });

  it("every active group lists only known postures and every posture belongs to a group", () => {
    const listed = new Set(activeGroups().flatMap((g) => g.posture_ids));
    for (const id of listed) expect(() => getPosture(id)).not.toThrow();
    for (const p of postures) expect(listed.has(p.id)).toBe(true);
  });

  it("every sheet referenced by a group or posture has a URL", () => {
    for (const g of groupsFile.groups) expect(groupsFile.sheets[String(g.sheet)]).toBeDefined();
    for (const p of postures) expect(groupsFile.sheets[String(p.source.sheet)].url).toMatch(/^https:\/\/www\.dtam\.moph\.go\.th\//);
  });

  it("does not link the frozen-shoulder sheet to news page 47002 (it embeds the wrong flipbook)", () => {
    expect(groupsFile.sheets["2"].url).not.toContain("47002");
  });

  it("alternate-side postures have an even number of units and a first side", () => {
    for (const p of postures.filter((x) => x.detector.sides === "alternate")) {
      expect(p.detector.units % 2).toBe(0);
      expect(p.detector.first_side).not.toBeNull();
    }
  });

  it("only kae-lom-pakang is counted as reps (its sheet gives no hold time)", () => {
    expect(postures.filter((p) => p.detector.mode === "reps").map((p) => p.id)).toEqual(["kae-lom-pakang"]);
  });

  it("de-duplicates the posture shared by the office and shoulder sheets", () => {
    const ids = posturesForGroups(["office", "shoulder"]);
    expect(ids.filter((id) => id === "kae-puat-thong-sabak-chom")).toHaveLength(1);
    expect(ids).toHaveLength(9);
  });

  it("builds a DTAM credit line with the page number", () => {
    expect(creditLine(getPosture("kae-kiat"))).toContain("หน้า 2");
    expect(creditLine(getPosture("kae-kiat"))).toContain("กรมการแพทย์แผนไทยและการแพทย์ทางเลือก");
  });
});

describe("red flag rules", () => {
  it("has 16 rules with a source and an evidence strength", () => {
    expect(redflags.rules).toHaveLength(16);
    for (const r of redflags.rules) {
      expect(r.source_th.length).toBeGreaterThan(5);
      expect(["stated", "derived", "team"]).toContain(r.strength);
    }
  });

  it("emergency and stop rules can never be switched off by a clinic", () => {
    for (const r of redflags.rules.filter((x) => x.level === "call_1669" || x.level === "stop_and_contact_clinic")) {
      expect(r.clinic_adjustable).toBe(false);
    }
  });

  it("asks 7 questions before a session", () => {
    expect(rulesAskedAt("pre").map((r) => r.id).sort()).toEqual(["RF01", "RF02", "RF05", "RF06", "RF14", "RF15", "RF16"]);
  });

  it("asks the kneeling question only before kae-sabak-na-chom", () => {
    expect(rulesAskedAt("before_posture", "kae-sabak-na-chom").map((r) => r.id)).toEqual(["RF12"]);
    expect(rulesAskedAt("before_posture", "kae-kiat")).toEqual([]);
  });
});
