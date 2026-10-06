import { describe, expect, it } from "vitest";
import { redflags, rulesAskedAt } from "@/lib/content";
import { evaluateRedFlags, stopsSession, worst } from "@/lib/redflags";

describe("red flags", () => {
  it("fires nothing when every answer is no and pain is low", () => {
    expect(evaluateRedFlags({ answers: {}, painBefore: 3, painAfter: 3 })).toEqual([]);
  });

  for (const r of redflags.rules.filter((x) => x.trigger.type === "yes")) {
    it(`${r.id} fires on "yes" with level ${r.level}`, () => {
      const out = evaluateRedFlags({ answers: { [r.id]: true }, painBefore: 2, painAfter: 2 });
      expect(out.map((f) => f.rule_id)).toContain(r.id);
    });
  }

  it("RF07: pain 8 or more before or after stops the session", () => {
    expect(worst(evaluateRedFlags({ answers: {}, painBefore: 8 }))?.rule_id).toBe("RF07");
    expect(worst(evaluateRedFlags({ answers: {}, painBefore: 2, painAfter: 9 }))?.level).toBe("stop_and_contact_clinic");
    expect(evaluateRedFlags({ answers: {}, painBefore: 7, painAfter: 7 })).toEqual([]);
  });

  it("RF08: pain up by 3 pauses (team proposal, default threshold 3)", () => {
    expect(evaluateRedFlags({ answers: {}, painBefore: 2, painAfter: 5 }).map((f) => f.rule_id)).toEqual(["RF08"]);
    expect(evaluateRedFlags({ answers: {}, painBefore: 2, painAfter: 4 })).toEqual([]);
  });

  it("RF09: mild soreness is only a note, and not when pain jumped", () => {
    expect(evaluateRedFlags({ answers: { RF09: true }, painBefore: 2, painAfter: 3 }).map((f) => f.level)).toEqual(["note_for_next_visit"]);
    expect(evaluateRedFlags({ answers: { RF09: true }, painBefore: 2, painAfter: 6 }).map((f) => f.rule_id)).toEqual(["RF08"]);
  });

  it("orders flags from most to least severe", () => {
    const out = evaluateRedFlags({ answers: { RF09: true, RF04: true, RF01: true }, painBefore: 2, painAfter: 2 });
    expect(out.map((f) => f.level)).toEqual(["call_1669", "stop_and_contact_clinic", "note_for_next_visit"]);
    expect(worst(out)?.rule_id).toBe("RF01");
  });

  it("clinics can change adjustable rules only", () => {
    const settings = { disabled: ["RF09", "RF01"], thresholds: { RF08: 5, RF07: 99 } };
    expect(evaluateRedFlags({ answers: { RF09: true }, painBefore: 1, painAfter: 2 }, settings)).toEqual([]);
    expect(evaluateRedFlags({ answers: {}, painBefore: 2, painAfter: 6 }, settings)).toEqual([]);
    expect(evaluateRedFlags({ answers: {}, painBefore: 2, painAfter: 7 }, settings).map((f) => f.rule_id)).toEqual(["RF08"]);
    // RF01 is an emergency rule and RF07 a stop rule: the clinic settings are ignored
    expect(evaluateRedFlags({ answers: { RF01: true } }, settings).map((f) => f.rule_id)).toEqual(["RF01"]);
    expect(evaluateRedFlags({ answers: {}, painBefore: 8 }, settings).map((f) => f.rule_id)).toEqual(["RF07"]);
  });

  it("records the posture for buttons pressed during a posture", () => {
    expect(evaluateRedFlags({ answers: { RF04: true }, postureId: "kae-kiat" })[0].posture_id).toBe("kae-kiat");
  });

  it("only emergency and stop levels end the session", () => {
    expect(stopsSession("call_1669")).toBe(true);
    expect(stopsSession("stop_and_contact_clinic")).toBe(true);
    expect(stopsSession("pause_posture")).toBe(false);
  });

  // The questions end at the first "yes" to a stop rule, so no 1669 question may come after a stop_and_contact_clinic one.
  it("asks every 1669 question before the stop-and-contact-clinic questions", () => {
    const places = [rulesAskedAt("pre"), rulesAskedAt("post"), ...redflags.rules.flatMap((r) => r.postures ?? []).map((id) => rulesAskedAt("before_posture", id))];
    for (const rules of places) {
      const levels = rules.map((r) => r.level);
      const firstStop = levels.indexOf("stop_and_contact_clinic");
      if (firstStop >= 0) expect(levels.slice(firstStop)).not.toContain("call_1669");
    }
  });
});
