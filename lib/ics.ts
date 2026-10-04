/** Recurring reminder as an iCalendar file (RFC 5545) that phone calendars import. */
export interface IcsInput {
  code: string;
  daysPerWeek: number; // 1..7
  remindTime: string; // "HH:MM" Bangkok time
  startDate: string; // YYYY-MM-DD
  untilDate: string; // YYYY-MM-DD (next visit)
  url: string; // link back to the plan
  now?: Date;
}

const BYDAY: Record<number, string> = {
  1: "MO",
  2: "MO,TH",
  3: "MO,WE,FR",
  4: "MO,TU,TH,FR",
  5: "MO,TU,WE,TH,FR",
  6: "MO,TU,WE,TH,FR,SA",
};

const ymd = (d: string) => d.replaceAll("-", "");
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/** Fold lines longer than 75 octets (Thai characters are 3 bytes in UTF-8). */
export function foldLine(line: string): string {
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const b = Buffer.byteLength(ch, "utf8");
    const limit = out.length === 0 ? 75 : 74; // continuation lines start with a space
    if (bytes + b > limit) {
      out.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join("\r\n ");
}

export function rrule(daysPerWeek: number, untilDate: string): string {
  const until = `UNTIL=${ymd(untilDate)}T165959Z`; // end of that day in Bangkok
  if (daysPerWeek >= 7) return `RRULE:FREQ=DAILY;${until}`;
  return `RRULE:FREQ=WEEKLY;BYDAY=${BYDAY[Math.max(1, daysPerWeek)]};${until}`;
}

export function buildIcs(i: IcsInput): string {
  const [hh, mm] = i.remindTime.split(":");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TTM Home Program//TH",
    "CALSCALE:GREGORIAN",
    "BEGIN:VTIMEZONE",
    "TZID:Asia/Bangkok",
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:+0700",
    "TZOFFSETTO:+0700",
    "TZNAME:ICT",
    "END:STANDARD",
    "END:VTIMEZONE",
    "BEGIN:VEVENT",
    `UID:${i.code}@ttm-home-program`,
    `DTSTAMP:${stamp(i.now ?? new Date())}`,
    `DTSTART;TZID=Asia/Bangkok:${ymd(i.startDate)}T${hh}${mm}00`,
    "DURATION:PT15M",
    rrule(i.daysPerWeek, i.untilDate),
    `SUMMARY:${escapeText("ทำท่าฤๅษีดัดตน (การบ้านหลังนวด)")}`,
    `DESCRIPTION:${escapeText(`เปิดแผนของคุณ: ${i.url}`)}`,
    `URL:${i.url}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeText("ถึงเวลาทำท่าฤๅษีดัดตนแล้ว")}`,
    "TRIGGER:PT0M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
