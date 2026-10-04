"use client";
import { useCallback, useEffect, useState } from "react";
import type { DtamSummary } from "@/lib/aggregate";
import { api, pct, thaiDate } from "@/lib/client";
import { getGroup } from "@/lib/content";
import type { RedFlagLevel } from "@/lib/content/schema";
import { LEVEL_TH } from "@/components/LevelBadge";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <div className="text-sm text-stone-600">{label}</div>
      <div className="text-3xl font-bold text-brand">{value}</div>
    </div>
  );
}

function WeeklyBars({ weeks }: { weeks: DtamSummary["weekly_adherence"] }) {
  return (
    <div className="flex items-end gap-2 h-40" aria-label="อัตราทำตามแผนรายสัปดาห์">
      {weeks.map((w) => (
        <div key={w.week_start} className="flex-1 flex flex-col items-center gap-1">
          <span className="text-xs">{pct(w.adherence)}</span>
          <div className="w-full rounded-t bg-brand" style={{ height: `${Math.round((w.adherence ?? 0) * 110)}px` }} />
          <span className="text-[10px] text-stone-500">{thaiDate(w.week_start).replace(/ \d{4}$/, "")}</span>
        </div>
      ))}
    </div>
  );
}

export default function DtamPage() {
  const [data, setData] = useState<DtamSummary | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await api<DtamSummary>("/api/dtam/summary");
    if (r.status === 401) return setNeedLogin(true);
    if (r.ok) {
      setNeedLogin(false);
      setData(r.data);
    }
  }, []);
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  if (needLogin)
    return (
      <main className="px-4 py-10">
        <form
          className="card mx-auto max-w-sm space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await api("/api/dtam/login", { body: { password } });
            if (r.ok) load();
            else setErr(r.message_th ?? "เข้าสู่ระบบไม่สำเร็จ");
          }}
        >
          <h1 className="text-2xl font-bold">ภาพรวมสำหรับกรมฯ</h1>
          <input className="input" type="password" placeholder="รหัสผ่านเดโม" value={password} onChange={(e) => setPassword(e.target.value)} />
          {err && <p className="text-red-700">{err}</p>}
          <button className="btn w-full">เข้าดู</button>
        </form>
      </main>
    );
  if (!data) return <main className="p-10 text-center">กำลังโหลด…</main>;

  const levels: RedFlagLevel[] = ["call_1669", "stop_and_contact_clinic", "pause_posture", "note_for_next_visit"];
  const groups = [...new Set(data.flags_by_group.map((f) => f.group_id))];
  const demo = data.clinics.some((c) => c.is_demo);
  return (
    <main className="mx-auto max-w-5xl px-4 py-6 space-y-5">
      <header>
        <h1 className="text-2xl font-bold">ท่าฤๅษีดัดตนที่แจกไป มีคนทำจริงกี่ %</h1>
        <p className="text-sm text-stone-600">
          ตัวเลขรวมเท่านั้น ไม่มีข้อมูลรายคน · ศูนย์ที่มีผู้ป่วยน้อยกว่า 5 คนจะไม่แสดงตัวเลข · ณ {thaiDate(data.generated_on)}
          {demo && <span className="ml-2 rounded bg-yellow-100 px-2">ข้อมูลจำลอง</span>}
        </p>
      </header>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="แผนที่ออก" value={String(data.totals.plans)} />
        <Stat label="ผู้ป่วยที่ยังทำอยู่ (14 วัน)" value={String(data.totals.active_patients)} />
        <Stat label="ทำตามแผน" value={pct(data.totals.adherence)} />
        <Stat label="มาครบคอร์ส" value={pct(data.totals.completion_rate)} />
        <Stat label="นับด้วยกล้อง" value={pct(data.totals.camera_share)} />
      </div>
      <section className="card">
        <h2 className="font-semibold mb-2">อัตราทำตามแผนรายสัปดาห์ (8 สัปดาห์)</h2>
        <WeeklyBars weeks={data.weekly_adherence} />
      </section>
      <section className="card overflow-x-auto">
        <h2 className="font-semibold mb-2">ธงแดงตามกลุ่มอาการ</h2>
        <table className="w-full text-left">
          <thead>
            <tr>
              <th>กลุ่ม</th>
              {levels.map((l) => (
                <th key={l}>
                  {LEVEL_TH[l].icon} {LEVEL_TH[l].label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g} className="border-t">
                <td>{getGroup(g).name_th}</td>
                {levels.map((l) => (
                  <td key={l}>{data.flags_by_group.find((f) => f.group_id === g && f.level === l)?.count ?? 0}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card overflow-x-auto">
        <h2 className="font-semibold mb-2">เทียบรายศูนย์</h2>
        <table className="w-full text-left">
          <thead>
            <tr>
              <th>ศูนย์</th>
              <th>แผน</th>
              <th>ยังทำอยู่</th>
              <th>ทำตามแผน</th>
              <th>ครบคอร์ส</th>
              <th>กล้อง</th>
            </tr>
          </thead>
          <tbody>
            {data.clinics.map((c) => (
              <tr key={c.clinic_code} className="border-t">
                <td>{c.clinic_name}</td>
                {c.hidden ? (
                  <td colSpan={5} className="text-stone-500">
                    &lt; 5 ราย (ไม่แสดง)
                  </td>
                ) : (
                  <>
                    <td>{c.plans}</td>
                    <td>{c.active_patients}</td>
                    <td>{pct(c.adherence)}</td>
                    <td>{pct(c.completion_rate)}</td>
                    <td>{pct(c.camera_share)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p className="text-sm text-stone-500">ขั้นต่อไป (เฟส 2): ส่งออกข้อมูลตามมาตรฐาน HDC / 43 แฟ้ม เพื่อรวมกับระบบรายงานของกระทรวง</p>
    </main>
  );
}
