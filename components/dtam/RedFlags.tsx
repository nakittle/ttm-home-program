"use client";
import { useState } from "react";
import { CircleAlert, CirclePause, Flag, Layers, NotebookPen, Siren } from "lucide-react";
import type { DtamSummary } from "@/lib/aggregate";
import { getGroup } from "@/lib/content";
import type { RedFlagLevel } from "@/lib/content/schema";
import { LevelBadge } from "@/components/LevelBadge";
import { CardHead, Segmented } from "./ui";

const LEVELS: RedFlagLevel[] = ["call_1669", "stop_and_contact_clinic", "pause_posture", "note_for_next_visit"];

/**
 * Fill per level. Red only for the two danger levels; pause takes the sun fill, notes the forest.
 * Grid shades are three fixed steps (14% / 30% tint with ink, full colour with white or ink), so every
 * number clears 7:1 — no mid-tone where neither ink nor white reads.
 */
const FILL: Record<RedFlagLevel, { bar: string; base: string; onFull: string }> = {
  call_1669: { bar: "bg-emergency", base: "#a51c22", onFull: "text-white" },
  stop_and_contact_clinic: { bar: "bg-emergency/65", base: "#a51c22", onFull: "text-white" },
  pause_posture: { bar: "bg-gold", base: "#f2c14e", onFull: "text-foreground" },
  note_for_next_visit: { bar: "bg-brand-2", base: "#2f4f3a", onFull: "text-white" },
};
const SURFACE = "#fbfcf8";
function mixHex(a: string, b: string, t: number): string {
  const ch = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return `rgb(${[0, 1, 2].map((i) => Math.round(ch(a, i) * t + ch(b, i) * (1 - t))).join(" ")})`;
}
function cellStyle(level: RedFlagLevel, n: number, max: number): { bg: string; ink: string } {
  if (n === 0) return { bg: "var(--background)", ink: "text-muted" };
  const r = n / max;
  if (r > 2 / 3) return { bg: FILL[level].base, ink: FILL[level].onFull };
  return { bg: mixHex(FILL[level].base, SURFACE, r > 1 / 3 ? 0.3 : 0.14), ink: "text-foreground" };
}

const SHORT: Record<RedFlagLevel, { label: string; Icon: typeof Siren }> = {
  call_1669: { label: "1669", Icon: Siren },
  stop_and_contact_clinic: { label: "หยุด", Icon: CircleAlert },
  pause_posture: { label: "พักท่า", Icon: CirclePause },
  note_for_next_visit: { label: "บันทึก", Icon: NotebookPen },
};

const groupName = (id: string) => {
  try {
    return getGroup(id).name_th;
  } catch {
    return id;
  }
};

/**
 * Red flags reported from home, by level and symptom group. Left: one bar per level for the chosen group.
 * Right: a group × level grid, shade = count (one hue per level, darker = more). Picking a group in the chips
 * or on a grid row drives both.
 */
export function RedFlags({ flags, levels }: { flags: DtamSummary["flags_by_group"]; levels: DtamSummary["flags_by_level"] }) {
  const [group, setGroup] = useState<string>("all");
  const groups = [...new Set(flags.map((f) => f.group_id))].sort((a, b) => groupName(a).localeCompare(groupName(b), "th"));
  // "ทุกกลุ่ม" uses the per-level counts: summing groups would count a flag once for each group of its plan.
  const count = (g: string | "all", l: RedFlagLevel) =>
    g === "all" ? (levels.find((x) => x.level === l)?.count ?? 0) : flags.filter((f) => f.group_id === g && f.level === l).reduce((a, f) => a + f.count, 0);

  const byLevel = LEVELS.map((l) => ({ level: l, n: count(group, l) }));
  const total = byLevel.reduce((a, b) => a + b.n, 0);
  const urgent = byLevel.filter((b) => b.level === "call_1669" || b.level === "stop_and_contact_clinic").reduce((a, b) => a + b.n, 0);
  const maxLevel = Math.max(1, ...byLevel.map((b) => b.n));
  const maxCell = Math.max(1, ...flags.map((f) => f.count));

  return (
    <section aria-labelledby="flags-h" className="card rise flex flex-col gap-5 p-5 sm:p-6" style={{ ["--i" as string]: 7 }}>
      <CardHead id="flags-h" icon={Flag} title="ธงแดงที่ผู้ป่วยรายงานจากบ้าน" help="แยกตามระดับและกลุ่มอาการ · ทุกช่วงเวลา" />
      <Segmented<string>
        label="กลุ่มอาการ"
        grid
        value={group}
        onChange={setGroup}
        options={[{ value: "all", label: "ทุกกลุ่ม", icon: Layers }, ...groups.map((g) => ({ value: g, label: groupName(g) }))]}
      />

      {flags.length === 0 ? (
        <p className="rounded-2xl bg-background px-4 py-6 text-center text-muted">ยังไม่มีธงแดง</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-8">
          {/* Level bars */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-3">
              <p className="rounded-2xl bg-background px-4 py-2.5">
                <span className="block text-base text-muted">รวม{group === "all" ? "" : ` · ${groupName(group)}`}</span>
                <span className="font-display text-[31px] leading-tight font-bold text-brand">{total}</span> <span className="text-base text-muted">ครั้ง</span>
              </p>
              <p className={`rounded-2xl px-4 py-2.5 ${urgent > 0 ? "bg-emergency-tint" : "bg-background"}`}>
                <span className="block text-base text-muted">ต้องติดต่อด่วน</span>
                <span className={`font-display text-[31px] leading-tight font-bold ${urgent > 0 ? "text-emergency" : "text-brand"}`}>{urgent}</span>{" "}
                <span className="text-base text-muted">ครั้ง</span>
              </p>
            </div>
            <ul className="flex flex-col gap-3" aria-label="จำนวนธงแดงแยกตามระดับ">
              {byLevel.map(({ level, n }) => (
                <li key={level} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 sm:grid-cols-[13.5rem_minmax(0,1fr)_2.5rem]">
                  <span className="min-w-0">
                    <LevelBadge level={level} />
                  </span>
                  <span className="text-right font-display text-xl font-bold tabular-nums sm:col-start-3 sm:row-start-1">{n}</span>
                  <span aria-hidden className="col-span-2 block h-3 rounded-full bg-sage-tint/70 sm:col-span-1 sm:col-start-2 sm:row-start-1">
                    <span className={`block h-full rounded-full transition-[width] duration-500 ease-out ${FILL[level].bar}`} style={{ width: `${(n / maxLevel) * 100}%` }} />
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Group × level grid */}
          <div className="min-w-0">
            <div className="-mx-1 overflow-x-auto px-1 pb-1">
              <table className="w-full min-w-[440px] border-separate border-spacing-1.5 text-base">
                <caption className="sr-only">ธงแดงแยกตามกลุ่มอาการและระดับ</caption>
                <thead>
                  <tr>
                    <th scope="col" className="sticky left-0 z-[1] bg-surface px-1 pb-1 text-left font-semibold text-muted">
                      กลุ่มอาการ
                    </th>
                    {LEVELS.map((l) => {
                      const { label, Icon } = SHORT[l];
                      return (
                        <th key={l} scope="col" className="px-1 pb-1 text-center font-semibold text-muted">
                          <span className="inline-flex items-center gap-1 whitespace-nowrap">
                            <Icon aria-hidden className="h-[18px] w-[18px] shrink-0" strokeWidth={2.25} />
                            {label}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => {
                    const on = group === g;
                    const dim = group !== "all" && !on;
                    return (
                      <tr key={g} className={`transition-opacity duration-300 ${dim ? "opacity-40" : ""}`}>
                        <th scope="row" className="sticky left-0 z-[1] bg-surface p-0 text-left font-semibold">
                          <button
                            type="button"
                            aria-pressed={on}
                            onClick={() => setGroup(on ? "all" : g)}
                            className={`flex min-h-12 w-full items-center rounded-xl px-2 text-left leading-snug whitespace-nowrap transition-colors hover:bg-brand-tint ${on ? "bg-brand-tint text-brand" : ""}`}
                          >
                            {groupName(g)}
                          </button>
                        </th>
                        {LEVELS.map((l) => {
                          const n = flags.find((f) => f.group_id === g && f.level === l)?.count ?? 0;
                          const { bg, ink } = cellStyle(l, n, maxCell);
                          return (
                            <td
                              key={l}
                              title={`${groupName(g)} · ${SHORT[l].label}: ${n} ครั้ง`}
                              className={`h-12 min-w-14 rounded-xl text-center text-xl font-bold tabular-nums transition-colors duration-300 ${ink}`}
                              style={{ background: bg }}
                            >
                              {n}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-base text-muted sm:hidden">เลื่อนตารางไปทางซ้ายเพื่อดูระดับอื่น</p>
            <p className="mt-2 text-base text-muted">สีเข้ม = จำนวนมาก · แตะชื่อกลุ่มเพื่อเลือก · แผนเดียวอาจมีหลายกลุ่ม จึงอาจนับซ้ำ</p>
          </div>
        </div>
      )}
    </section>
  );
}
