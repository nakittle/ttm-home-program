import { describe, expect, it } from "vitest";
import { buildIcs, foldLine, rrule } from "@/lib/ics";
import { hashSecret, newPlanCode, newSecret, PLAN_CODE_RE, patientUrl, secretMatches } from "@/lib/plan";

describe("plan codes and secrets", () => {
  it("makes readable codes without confusing characters", () => {
    for (let i = 0; i < 200; i++) {
      const c = newPlanCode();
      expect(c).toMatch(PLAN_CODE_RE);
      expect(c).not.toMatch(/[IO01]/);
    }
  });

  it("makes 128-bit url-safe secrets", () => {
    const s = newSecret();
    expect(s).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(newSecret()).not.toBe(s);
  });

  it("stores only a hash and compares in constant time", () => {
    const s = newSecret();
    const h = hashSecret(s);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain(s);
    expect(secretMatches(s, h)).toBe(true);
    expect(secretMatches(s + "x", h)).toBe(false);
    expect(secretMatches(s, "abc")).toBe(false);
  });

  it("puts the secret after # in the patient link", () => {
    expect(patientUrl("https://x.app", "KPT-42", "sec")).toBe("https://x.app/p/KPT-42#sec");
  });
});

describe("calendar file", () => {
  it("uses DAILY for 7 days a week and spaced weekdays otherwise", () => {
    expect(rrule(7, "2026-10-20")).toBe("RRULE:FREQ=DAILY;UNTIL=20261020T165959Z");
    expect(rrule(3, "2026-10-20")).toBe("RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20261020T165959Z");
  });

  it("folds long Thai lines at 75 bytes", () => {
    const line = "DESCRIPTION:" + "ก".repeat(60);
    for (const part of foldLine(line).split("\r\n")) expect(Buffer.byteLength(part, "utf8")).toBeLessThanOrEqual(75);
  });

  it("builds a valid VCALENDAR with a Bangkok start time and an alarm", () => {
    const ics = buildIcs({
      code: "KPT-42", daysPerWeek: 7, remindTime: "19:00", startDate: "2026-10-05", untilDate: "2026-10-19",
      url: "https://x.app/p/KPT-42#sec", now: new Date("2026-10-04T00:00:00Z"),
    });
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART;TZID=Asia/Bangkok:20261005T190000");
    expect(ics).toContain("BEGIN:VALARM");
    expect(ics.replace(/\r\n /g, "")).toContain("URL:https://x.app/p/KPT-42#sec");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
});
