"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { addDaysLocal, api, todayLocal } from "@/lib/client";
import { activeGroups, getPosture, groupsFile, posturesForGroups } from "@/lib/content";

const POSITION_TH = { sitting_floor: "นั่งพื้น", standing: "ยืน", kneeling: "คุกเข่า" } as const;

export default function NewPlanPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<string[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [days, setDays] = useState(7);
  const [time, setTime] = useState("19:00");
  const [start, setStart] = useState(todayLocal());
  const [visit, setVisit] = useState(addDaysLocal(todayLocal(), 14));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const postureIds = posturesForGroups(groups).filter((id) => !removed.includes(id));

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 space-y-5">
      <Link href="/clinic" className="text-stone-600">
        ← กลับ
      </Link>
      <h1 className="text-2xl font-bold">สร้างแผนการบ้านหลังนวด</h1>

      <section className="card space-y-2">
        <h2 className="font-semibold">1. กลุ่มอาการ</h2>
        <div className="flex flex-wrap gap-2">
          {activeGroups().map((g) => (
            <label key={g.id} className={`btn-ghost cursor-pointer ${groups.includes(g.id) ? "border-brand bg-orange-50" : ""}`}>
              <input
                type="checkbox"
                className="mr-2"
                checked={groups.includes(g.id)}
                onChange={(e) => setGroups(e.target.checked ? [...groups, g.id] : groups.filter((x) => x !== g.id))}
              />
              {g.name_th}
            </label>
          ))}
        </div>
        <p className="text-sm text-stone-500">
          กลุ่มอื่นยังไม่เปิดใช้กล้อง:{" "}
          {groupsFile.groups
            .filter((g) => !g.active)
            .map((g) => (
              <a key={g.id} className="underline mr-2" href={groupsFile.sheets[String(g.sheet)].url} target="_blank" rel="noreferrer">
                {g.name_th}
              </a>
            ))}
        </p>
      </section>

      {groups.length > 0 && (
        <section className="card space-y-3">
          <h2 className="font-semibold">2. ท่า (ตามแผ่นกรมฯ เอาออกได้) · ตรวจข้อห้ามก่อนสั่ง</h2>
          {posturesForGroups(groups).map((id) => {
            const p = getPosture(id);
            const on = !removed.includes(id);
            return (
              <div key={id} className={`rounded-xl border p-3 ${on ? "border-stone-300" : "border-dashed opacity-60"}`}>
                <label className="flex items-center gap-2 font-semibold">
                  <input type="checkbox" checked={on} onChange={() => setRemoved(on ? [...removed, id] : removed.filter((x) => x !== id))} />
                  {p.name_th} <span className="text-sm font-normal text-stone-500">({POSITION_TH[p.position]})</span>
                </label>
                {p.contraindications_th.length > 0 && (
                  <p className="text-sm text-red-800 mt-1">ข้อห้าม: {p.contraindications_th.join(" / ")}</p>
                )}
                {p.cautions_th.length > 0 && <p className="text-sm text-orange-800">ข้อควรระวัง: {p.cautions_th.join(" / ")}</p>}
              </div>
            );
          })}
        </section>
      )}

      <section className="card grid gap-3 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">3. ความถี่และวันนัด</h2>
        <label>
          วันละ 1 รอบ สัปดาห์ละ
          <select className="input" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {[7, 6, 5, 4, 3, 2, 1].map((d) => (
              <option key={d} value={d}>
                {d === 7 ? "ทุกวัน" : `${d} วัน`}
              </option>
            ))}
          </select>
        </label>
        <label>
          เวลาเตือน
          <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
        <label>
          เริ่ม
          <input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label>
          นัดครั้งถัดไป
          <input className="input" type="date" value={visit} onChange={(e) => setVisit(e.target.value)} />
        </label>
      </section>

      {err && <p className="text-red-700">{err}</p>}
      <button
        className="btn w-full text-xl"
        disabled={busy || postureIds.length === 0}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          const r = await api<{ code: string; secret: string }>("/api/plans", {
            body: { group_ids: groups, posture_ids: postureIds, days_per_week: days, remind_time: time, start_date: start, next_visit_date: visit },
          });
          setBusy(false);
          if (r.ok) router.push(`/clinic/slip/${r.data.code}#${r.data.secret}`);
          else setErr(r.status === 401 ? "โปรดเข้าสู่ระบบใหม่" : (r.message_th ?? "สร้างแผนไม่สำเร็จ"));
        }}
      >
        ออกใบนัดพร้อม QR
      </button>
      <p className="text-sm text-stone-500">ไม่ต้องกรอกชื่อหรือ HN จดรหัสแผนบนใบนัดคู่กับ HN ในระบบของคลินิกเอง</p>
    </main>
  );
}
