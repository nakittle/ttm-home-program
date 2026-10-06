"use client";
import { useCallback, useEffect, useState } from "react";
import { BellRing, CalendarCheck, Camera, Check, ChevronDown, CircleCheck, ClipboardList, DoorOpen, LogIn, NotebookPen, Printer, Square } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import type { DashboardItem } from "@/lib/aggregate";
import { api, clearClinicLoggedOut, enterOpenClinic, markClinicLoggedOut, pct, thaiDate, type ApiResult } from "@/lib/client";
import { getGroup, getPosture } from "@/lib/content";
import { ruleById } from "@/lib/redflags";
import { LevelBadge } from "@/components/LevelBadge";
import { ClinicShell } from "@/components/clinic/Shell";
import { GrowBar } from "@/components/patient/Progress";

interface Dashboard {
  clinic: { code: string; name: string; phone: string | null; is_demo: boolean };
  items: DashboardItem[];
  data_as_of: string;
  memory_store: boolean;
}

function Login({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <main className="flex flex-1 items-center justify-center px-5 py-12">
      <form
        className="card rise w-full max-w-sm space-y-5 p-7"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const r = await api("/api/clinic/login", { body: { code, pin } });
          setBusy(false);
          if (r.ok) {
            clearClinicLoggedOut();
            onDone();
          } else setErr(r.message_th ?? "เข้าสู่ระบบไม่สำเร็จ");
        }}
      >
        <div className="flex items-center gap-3">
          <LogoMark className="h-12 w-12" />
          <div className="leading-tight">
            <p className="text-base text-muted">การบ้านหลังนวด</p>
            <h1 className="font-display text-[28px] font-bold text-brand">เข้าสู่ระบบคลินิก</h1>
          </div>
        </div>
        <button
          type="button"
          className="btn w-full"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const ok = await enterOpenClinic(true);
            setBusy(false);
            if (ok) onDone();
            else setErr("เข้าคลินิกทดลองไม่สำเร็จ ลองอีกครั้ง");
          }}
        >
          <DoorOpen aria-hidden className="h-5 w-5" strokeWidth={2} />
          เข้าคลินิกทดลอง ไม่ต้องใส่รหัส
        </button>
        <p className="flex items-center gap-3 text-base text-muted before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">หรือคลินิกที่มี PIN</p>
        <label className="block space-y-1 font-semibold">
          รหัสคลินิก
          <input className="input font-normal" value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="characters" required />
        </label>
        <label className="block space-y-1 font-semibold">
          PIN 6 หลัก
          <input className="input font-normal" value={pin} onChange={(e) => setPin(e.target.value)} inputMode="numeric" pattern="\d{6}" type="password" required />
        </label>
        {err && <p className="font-semibold text-emergency">{err}</p>}
        <button className="btn-ghost w-full" disabled={busy}>
          <LogIn aria-hidden className="h-5 w-5" strokeWidth={2} />
          เข้าสู่ระบบ
        </button>
      </form>
    </main>
  );
}

function PainSpark({ pain }: { pain: DashboardItem["pain"] }) {
  const pts = pain.slice(-14);
  if (pts.length < 2) return <span className="text-base text-muted">ยังมีข้อมูลน้อย</span>;
  const W = 160;
  const H = 40;
  const line = (key: "before" | "after") =>
    pts
      .map((p, i) => (p[key] === null ? null : `${(i / (pts.length - 1)) * W},${H - ((p[key] as number) / 10) * H}`))
      .filter(Boolean)
      .join(" ");
  return (
    <svg width={W} height={H} className="overflow-visible" aria-label="กราฟระดับปวด">
      <polyline points={line("before")} fill="none" stroke="#9cb59a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={line("after")} fill="none" stroke="#2f4f3a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const PRIORITY = {
  0: { tone: "border-emergency/60 bg-emergency-tint text-emergency", dot: "bg-emergency" },
  1: { tone: "border-gold bg-gold-tint text-foreground", dot: "bg-gold" },
} as const;
const priorityStyle = (p: number) => PRIORITY[p as 0 | 1] ?? { tone: "border-line bg-brand-tint text-brand", dot: "bg-sage" };

function Row({ item, reload, onUnauthorized, index }: { item: DashboardItem; reload: () => void; onUnauthorized: () => void; index: number }) {
  const [open, setOpen] = useState(item.priority <= 1);
  const [rowErr, setRowErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Run one row action: 401 goes to the login form, other failures show in the row, success runs onOk (default: reload). */
  async function act<T>(call: () => Promise<ApiResult<T>>, onOk?: (data: T) => void) {
    if (busy) return;
    setBusy(true);
    setRowErr(null);
    const r = await call();
    setBusy(false);
    if (r.status === 401) return onUnauthorized();
    if (!r.ok) return setRowErr(r.message_th ?? "ทำรายการไม่สำเร็จ ลองใหม่อีกครั้ง");
    if (onOk) onOk(r.data);
    else reload();
  }
  const ps = priorityStyle(item.priority);
  return (
    <li className={`card rise p-0 ${item.priority === 0 ? "ring-2 ring-emergency/40" : ""}`} style={{ ["--i" as string]: Math.min(index, 8) }}>
      <button className="grid w-full items-center gap-x-5 gap-y-2 p-5 text-left sm:grid-cols-[auto_1fr_auto]" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="flex items-center gap-3">
          <span aria-hidden className={`h-3 w-3 shrink-0 rounded-full ${ps.dot}`} />
          <span className="font-display text-[26px] font-bold leading-none tracking-wide text-brand">{item.code}</span>
        </span>
        <span className="min-w-0 space-y-1.5">
          <span className="block text-lg font-semibold">{item.group_ids.map((g) => getGroup(g).name_th).join(" + ")}</span>
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-base text-muted">
            <span className="flex items-center gap-2">
              ทำตามแผน 7 วัน <GrowBar value={item.adherence_7d ?? 0} max={1} className="w-24" />
              <span className="font-semibold text-foreground">{pct(item.adherence_7d)}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <CalendarCheck aria-hidden className="h-[18px] w-[18px]" strokeWidth={2} />
              นัด {thaiDate(item.next_visit_date)}
            </span>
          </span>
        </span>
        <span className="flex items-center gap-2 sm:justify-end">
          <span className={`rounded-full border px-3 py-1 text-base font-semibold ${ps.tone}`}>{item.priority_reason}</span>
          <ChevronDown aria-hidden className={`h-6 w-6 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={2} />
        </span>
      </button>
      {open && (
        <div className="space-y-4 border-t border-line px-5 pt-4 pb-5">
          {item.open_flags.length > 0 && (
            <ul className="space-y-2">
              {item.open_flags.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-background px-4 py-3">
                  <LevelBadge level={f.level} />
                  <span className="min-w-0 flex-1">
                    {ruleById(f.rule_id).question_th}
                    {f.posture_id && <span className="text-muted"> (ท่า{getPosture(f.posture_id).name_th.replace(/^ท่า/, "")})</span>}
                  </span>
                  <button className="btn-ghost min-h-11 px-4 text-base" disabled={busy} onClick={() => act(() => api(`/api/flags/${f.id}/ack`, { body: {} }))}>
                    <Check aria-hidden className="h-[18px] w-[18px]" strokeWidth={2.5} />
                    รับทราบ
                  </button>
                </li>
              ))}
            </ul>
          )}
          {item.notes.length > 0 && (
            <p className="flex items-center gap-2 text-base text-muted">
              <NotebookPen aria-hidden className="h-[18px] w-[18px]" strokeWidth={2} />
              หมายเหตุ: ตึงเมื่อยเล็กน้อย {item.notes.length} ครั้ง
            </p>
          )}
          <dl className="grid gap-3 text-base sm:grid-cols-4">
            <div className="rounded-2xl bg-background px-4 py-3">
              <dt className="text-muted">ทั้งแผน</dt>
              <dd className="text-xl font-semibold">{pct(item.adherence_all)}</dd>
            </div>
            <div className="rounded-2xl bg-background px-4 py-3">
              <dt className="text-muted">ทำล่าสุด</dt>
              <dd className="text-xl font-semibold">{item.last_session_on ? thaiDate(item.last_session_on) : "ยังไม่เคย"}</dd>
            </div>
            <div className="rounded-2xl bg-background px-4 py-3">
              <dt className="flex items-center gap-1.5 text-muted">
                <Camera aria-hidden className="h-4 w-4" strokeWidth={2} />
                นับด้วยกล้อง
              </dt>
              <dd className="text-xl font-semibold">{pct(item.camera_share)}</dd>
            </div>
            <div className="rounded-2xl bg-background px-4 py-3">
              <dt className="text-muted">ระดับปวด (อ่อน=ก่อน, เข้ม=หลัง)</dt>
              <dd className="pt-1">
                <PainSpark pain={item.pain} />
              </dd>
            </div>
          </dl>
          {item.status === "active" && (
            <div className="flex flex-wrap gap-2">
              <button
                className="btn-ghost min-h-11 px-4 text-base"
                disabled={busy}
                onClick={() => {
                  if (!confirm("ออกใบนัดใหม่? QR เดิมของผู้ป่วยจะใช้ไม่ได้")) return;
                  act(
                    () => api<{ secret: string }>(`/api/plans/${item.code}/reissue`, { body: {} }),
                    (d) => {
                      window.location.href = `/clinic/slip/${item.code}#${d.secret}`;
                    },
                  );
                }}
              >
                <Printer aria-hidden className="h-[18px] w-[18px]" strokeWidth={2} />
                ออกใบนัดใหม่ (QR เดิมใช้ไม่ได้)
              </button>
              <button
                className="btn-ghost min-h-11 px-4 text-base"
                disabled={busy}
                onClick={() => {
                  if (!confirm("ปิดแผนว่าครบคอร์ส? เปิดใหม่ไม่ได้")) return;
                  act(() => api(`/api/plans/${item.code}`, { method: "PATCH", body: { status: "completed" } }));
                }}
              >
                <CircleCheck aria-hidden className="h-[18px] w-[18px]" strokeWidth={2} />
                ครบคอร์ส
              </button>
              <button
                className="btn-ghost min-h-11 px-4 text-base"
                disabled={busy}
                onClick={() => {
                  if (!confirm("หยุดแผนนี้? เปิดใหม่ไม่ได้")) return;
                  act(() => api(`/api/plans/${item.code}`, { method: "PATCH", body: { status: "stopped" } }));
                }}
              >
                <Square aria-hidden className="h-[18px] w-[18px]" strokeWidth={2} />
                หยุดแผน
              </button>
            </div>
          )}
          {rowErr && (
            <p role="alert" className="font-semibold text-emergency">
              {rowErr}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

export default function ClinicPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    let r = await api<Dashboard>("/api/clinic/dashboard");
    // No session: judges and visitors go straight into the open demo clinic (no PIN).
    if (r.status === 401 && (await enterOpenClinic())) r = await api<Dashboard>("/api/clinic/dashboard");
    if (r.status === 401) return setNeedLogin(true);
    if (!r.ok) return setOffline(true);
    setNeedLogin(false);
    setOffline(false);
    setData(r.data);
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    return () => clearTimeout(first);
  }, [load]);

  useEffect(() => {
    // Refresh every 30 s so new red flags appear without reloading, but never behind the PIN form.
    if (needLogin) return;
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, [load, needLogin]);

  if (needLogin) return <Login onDone={load} />;
  if (!data) return <main className="flex flex-1 items-center justify-center px-5 py-12 text-xl text-muted">{offline ? "เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง" : "กำลังโหลด…"}</main>;

  const active = data.items.filter((i) => i.status === "active");
  const closed = data.items.filter((i) => i.status !== "active");
  const urgent = active.filter((i) => i.priority === 0).length;
  const watch = active.filter((i) => i.priority === 1).length;
  return (
    <ClinicShell
      clinicName={data.clinic.name}
      onLogout={async () => {
        markClinicLoggedOut();
        await api("/api/clinic/logout", { body: {} });
        setNeedLogin(true);
      }}
    >
      <section className="rise flex flex-wrap items-end justify-between gap-4 pb-6">
        <div>
          <h1 className="font-display text-[36px] font-bold leading-[1.4] text-brand">
            แผนผู้ป่วย<span className="text-clay-ink">ที่ดูแลอยู่</span>
          </h1>
          <p className="mt-2 text-base leading-relaxed text-muted">
            ข้อมูลล่าสุดเมื่อ {new Date(data.data_as_of).toLocaleTimeString("th-TH")} · อัปเดตเองทุก 30 วินาที
            {data.memory_store && " · โหมดทดลอง (ข้อมูลไม่ถูกบันทึกถาวร)"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-base font-semibold">
          <span className="inline-flex items-center gap-2 rounded-full border border-emergency/50 bg-emergency-tint px-4 py-1.5 text-emergency">
            <BellRing aria-hidden className="h-[18px] w-[18px]" strokeWidth={2} />
            ต้องดูก่อน {urgent}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-gold bg-gold-tint px-4 py-1.5">เฝ้าดู {watch}</span>
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-1.5 text-brand">ทั้งหมด {active.length} แผน</span>
        </div>
      </section>
      {offline && <p className="pb-3 font-semibold text-clay-ink">เชื่อมต่อไม่ได้ แสดงข้อมูลล่าสุดที่โหลดไว้</p>}
      <ul className="space-y-3">
        {active.map((i, n) => (
          <Row key={i.code} item={i} index={n} reload={load} onUnauthorized={() => setNeedLogin(true)} />
        ))}
        {active.length === 0 && (
          <li className="card flex items-center gap-3 text-muted">
            <ClipboardList aria-hidden className="h-5 w-5" strokeWidth={2} />
            ยังไม่มีแผน กด “สร้างแผน” เพื่อเริ่ม
          </li>
        )}
      </ul>
      {closed.length > 0 && (
        <details className="group mt-6">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-lg font-semibold text-muted">
            <ChevronDown aria-hidden className="h-5 w-5 transition-transform group-open:rotate-180" strokeWidth={2} />
            แผนที่ปิดแล้ว ({closed.length})
          </summary>
          <ul className="mt-3 space-y-3">
            {closed.map((i, n) => (
              <Row key={i.code} item={i} index={n} reload={load} onUnauthorized={() => setNeedLogin(true)} />
            ))}
          </ul>
        </details>
      )}
    </ClinicShell>
  );
}
