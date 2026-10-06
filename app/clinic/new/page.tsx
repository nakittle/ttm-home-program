"use client";
import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { Ban, Check, CircleAlert, ExternalLink, QrCode } from "lucide-react";
import { addDaysLocal, api, todayLocal, enterOpenClinic } from "@/lib/client";
import { activeGroups, getPosture, groupsFile, posturesForGroups } from "@/lib/content";
import { ClinicShell } from "@/components/clinic/Shell";

const POSITION_TH = { sitting_floor: "นั่งพื้น", standing: "ยืน", kneeling: "คุกเข่า" } as const;

function Step({ n, title, children, i }: { n: number; title: string; children: ReactNode; i: number }) {
  return (
    <section className="card rise space-y-4 p-6" style={{ ["--i" as string]: i }}>
      <h2 className="flex items-center gap-3 text-xl font-semibold">
        <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-xl bg-sage-tint text-lg font-bold text-brand">
          {n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

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
  const sending = useRef(false);

  const postureIds = posturesForGroups(groups).filter((id) => !removed.includes(id));

  return (
    <ClinicShell>
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="rise">
          <h1 className="font-display text-[36px] font-bold leading-[1.4] text-brand">
            สร้างแผน<span className="text-clay-ink">การบ้านหลังนวด</span>
          </h1>
          <p className="mt-2 text-base leading-relaxed text-muted">ไม่ต้องกรอกชื่อหรือ HN จดรหัสแผนบนใบนัดคู่กับ HN ในระบบของคลินิกเอง</p>
        </div>

        <Step n={1} title="กลุ่มอาการ" i={1}>
          <div className="flex flex-wrap gap-2">
            {activeGroups().map((g) => {
              const on = groups.includes(g.id);
              return (
                <label
                  key={g.id}
                  className={`inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-full border-2 px-5 text-lg font-semibold transition has-[input:focus-visible]:outline-3 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-clay-ink ${
                    on ? "border-brand bg-brand text-white shadow-btn" : "border-sage bg-surface text-brand"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={on}
                    onChange={(e) => setGroups(e.target.checked ? [...groups, g.id] : groups.filter((x) => x !== g.id))}
                  />
                  {on && <Check aria-hidden className="h-5 w-5" strokeWidth={3} />}
                  {g.name_th}
                </label>
              );
            })}
          </div>
          <p className="text-base text-muted">
            กลุ่มอื่นยังไม่เปิดใช้กล้อง:{" "}
            {groupsFile.groups
              .filter((g) => !g.active)
              .map((g) => (
                <a
                  key={g.id}
                  className="mr-3 inline-flex items-center gap-1 font-semibold text-indigo underline underline-offset-4"
                  href={groupsFile.sheets[String(g.sheet)].url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {g.name_th}
                  <ExternalLink aria-hidden className="h-4 w-4" strokeWidth={2} />
                </a>
              ))}
          </p>
        </Step>

        {groups.length > 0 && (
          <Step n={2} title="ท่า (ตามแผ่นกรมฯ เอาออกได้) · ตรวจข้อห้ามก่อนสั่ง" i={2}>
            <div className="grid items-start gap-3 sm:grid-cols-2">
              {posturesForGroups(groups).map((id) => {
                const p = getPosture(id);
                const on = !removed.includes(id);
                return (
                  <label
                    key={id}
                    className={`flex cursor-pointer gap-3 rounded-2xl border-2 p-4 transition has-[input:focus-visible]:outline-3 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-clay-ink ${
                      on ? "border-brand/50 bg-surface" : "border-dashed border-line bg-background opacity-70"
                    }`}
                  >
                    <input type="checkbox" className="sr-only" checked={on} onChange={() => setRemoved(on ? [...removed, id] : removed.filter((x) => x !== id))} />
                    <span
                      aria-hidden
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 ${on ? "border-brand bg-brand text-white" : "border-sage bg-surface"}`}
                    >
                      {on && <Check className="h-5 w-5" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 space-y-1">
                      <span className="block text-lg font-semibold">
                        {p.name_th} <span className="text-base font-normal text-muted">({POSITION_TH[p.position]})</span>
                      </span>
                      {p.contraindications_th.length > 0 && (
                        <span className="flex gap-1.5 text-base text-emergency">
                          <Ban aria-hidden className="mt-1 h-4 w-4 shrink-0" strokeWidth={2.25} />
                          <span>ข้อห้าม: {p.contraindications_th.join(" / ")}</span>
                        </span>
                      )}
                      {p.cautions_th.length > 0 && (
                        <span className="flex gap-1.5 text-base text-muted">
                          <CircleAlert aria-hidden className="mt-1 h-4 w-4 shrink-0" strokeWidth={2.25} />
                          <span>ข้อควรระวัง: {p.cautions_th.join(" / ")}</span>
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          </Step>
        )}

        <Step n={groups.length > 0 ? 3 : 2} title="ความถี่และวันนัด" i={3}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 font-semibold">
              วันละ 1 รอบ สัปดาห์ละ
              <select className="input font-normal" value={days} onChange={(e) => setDays(Number(e.target.value))}>
                {[7, 6, 5, 4, 3, 2, 1].map((d) => (
                  <option key={d} value={d}>
                    {d === 7 ? "ทุกวัน" : `${d} วัน`}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 font-semibold">
              เวลาเตือน
              <input className="input font-normal" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </label>
            <label className="space-y-1 font-semibold">
              เริ่ม
              <input className="input font-normal" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </label>
            <label className="space-y-1 font-semibold">
              นัดครั้งถัดไป
              <input className="input font-normal" type="date" value={visit} onChange={(e) => setVisit(e.target.value)} />
            </label>
          </div>
        </Step>

        {err && <p className="font-semibold text-emergency">{err}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-line bg-surface p-4 shadow-soft">
          <p className="text-base text-muted">
            {postureIds.length > 0 ? (
              <>
                สั่ง <span className="font-semibold text-foreground">{postureIds.length} ท่า</span> ·{" "}
                {days === 7 ? "ทุกวัน" : `สัปดาห์ละ ${days} วัน`} เวลา {time}
              </>
            ) : (
              "เลือกกลุ่มอาการก่อน"
            )}
          </p>
          <button
            className="btn min-h-14 px-7 text-lg"
            disabled={busy || postureIds.length === 0}
            onClick={async () => {
              // A second tap before the re-render would otherwise create a duplicate plan.
              if (sending.current) return;
              sending.current = true;
              setBusy(true);
              setErr(null);
              const send = () =>
                api<{ code: string; secret: string }>("/api/plans", {
                  body: { group_ids: groups, posture_ids: postureIds, days_per_week: days, remind_time: time, start_date: start, next_visit_date: visit },
                });
              let r = await send();
              if (r.status === 401 && (await enterOpenClinic())) r = await send();
              if (r.ok) {
                // Stay busy until the slip page replaces this one.
                router.push(`/clinic/slip/${r.data.code}#${r.data.secret}`);
                return;
              }
              sending.current = false;
              setBusy(false);
              setErr(r.status === 401 ? "โปรดเข้าสู่ระบบใหม่" : (r.message_th ?? "สร้างแผนไม่สำเร็จ"));
            }}
          >
            <QrCode aria-hidden className="h-6 w-6" strokeWidth={2} />
            ออกใบนัดพร้อม QR
          </button>
        </div>
      </div>
    </ClinicShell>
  );
}
