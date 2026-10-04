"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { DashboardItem } from "@/lib/aggregate";
import { api, pct, thaiDate, type ApiResult } from "@/lib/client";
import { getGroup, getPosture } from "@/lib/content";
import { ruleById } from "@/lib/redflags";
import { LevelBadge } from "@/components/LevelBadge";

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
    <form
      className="card space-y-3 max-w-sm mx-auto"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const r = await api("/api/clinic/login", { body: { code, pin } });
        setBusy(false);
        if (r.ok) onDone();
        else setErr(r.message_th ?? "เข้าสู่ระบบไม่สำเร็จ");
      }}
    >
      <h1 className="text-2xl font-bold">เข้าสู่ระบบคลินิก</h1>
      <label className="block">
        รหัสคลินิก
        <input className="input" value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="characters" required />
      </label>
      <label className="block">
        PIN 6 หลัก
        <input className="input" value={pin} onChange={(e) => setPin(e.target.value)} inputMode="numeric" pattern="\d{6}" type="password" required />
      </label>
      {err && <p className="text-red-700">{err}</p>}
      <button className="btn w-full" disabled={busy}>
        เข้าสู่ระบบ
      </button>
    </form>
  );
}

function PainSpark({ pain }: { pain: DashboardItem["pain"] }) {
  const pts = pain.slice(-14);
  if (pts.length < 2) return <span className="text-stone-400 text-sm">ยังมีข้อมูลน้อย</span>;
  const W = 160;
  const H = 40;
  const line = (key: "before" | "after") =>
    pts
      .map((p, i) => (p[key] === null ? null : `${(i / (pts.length - 1)) * W},${H - ((p[key] as number) / 10) * H}`))
      .filter(Boolean)
      .join(" ");
  return (
    <svg width={W} height={H} className="overflow-visible" aria-label="กราฟระดับปวด">
      <polyline points={line("before")} fill="none" stroke="#a8a29e" strokeWidth="2" />
      <polyline points={line("after")} fill="none" stroke="#7c2d12" strokeWidth="2" />
    </svg>
  );
}

function Row({ item, reload, onUnauthorized }: { item: DashboardItem; reload: () => void; onUnauthorized: () => void }) {
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
  const urgent = item.priority === 0 ? "border-red-400" : item.priority === 1 ? "border-yellow-400" : "border-stone-200";
  return (
    <li className={`card border-2 ${urgent}`}>
      <button className="w-full text-left flex flex-wrap items-center gap-x-4 gap-y-1" onClick={() => setOpen(!open)}>
        <span className="font-mono text-xl font-bold">{item.code}</span>
        <span>{item.group_ids.map((g) => getGroup(g).name_th).join(" + ")}</span>
        <span className="text-stone-600">ทำตามแผน 7 วัน: {pct(item.adherence_7d)}</span>
        <span className="text-stone-600">นัด {thaiDate(item.next_visit_date)}</span>
        <span className="ml-auto text-sm">{item.priority_reason}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-3 border-t pt-3">
          {item.open_flags.map((f) => (
            <div key={f.id} className="flex flex-wrap items-center gap-2">
              <LevelBadge level={f.level} />
              <span>{ruleById(f.rule_id).question_th}</span>
              {f.posture_id && <span className="text-stone-500">(ท่า{getPosture(f.posture_id).name_th.replace(/^ท่า/, "")})</span>}
              <button
                className="btn-ghost py-1"
                disabled={busy}
                onClick={() => act(() => api(`/api/flags/${f.id}/ack`, { body: {} }))}
              >
                รับทราบ
              </button>
            </div>
          ))}
          {item.notes.length > 0 && <p className="text-sm text-stone-600">⚪ หมายเหตุ: ตึงเมื่อยเล็กน้อย {item.notes.length} ครั้ง</p>}
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span>ทั้งแผน {pct(item.adherence_all)}</span>
            <span>ทำล่าสุด {item.last_session_on ? thaiDate(item.last_session_on) : "ยังไม่เคย"}</span>
            <span>นับด้วยกล้อง {pct(item.camera_share)}</span>
            <span className="flex items-center gap-2">
              ระดับปวด (เทา=ก่อน, น้ำตาล=หลัง) <PainSpark pain={item.pain} />
            </span>
          </div>
          {item.status === "active" && (
            <div className="flex flex-wrap gap-2">
              <button
                className="btn-ghost"
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
                ออกใบนัดใหม่ (QR เดิมใช้ไม่ได้)
              </button>
              <button
                className="btn-ghost"
                disabled={busy}
                onClick={() => {
                  if (!confirm("ปิดแผนว่าครบคอร์ส? เปิดใหม่ไม่ได้")) return;
                  act(() => api(`/api/plans/${item.code}`, { method: "PATCH", body: { status: "completed" } }));
                }}
              >
                ครบคอร์ส
              </button>
              <button
                className="btn-ghost"
                disabled={busy}
                onClick={() => {
                  if (!confirm("หยุดแผนนี้? เปิดใหม่ไม่ได้")) return;
                  act(() => api(`/api/plans/${item.code}`, { method: "PATCH", body: { status: "stopped" } }));
                }}
              >
                หยุดแผน
              </button>
            </div>
          )}
          {rowErr && (
            <p role="alert" className="text-red-700">
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
    const r = await api<Dashboard>("/api/clinic/dashboard");
    if (r.status === 401) return setNeedLogin(true);
    if (!r.ok) return setOffline(true);
    setNeedLogin(false);
    setOffline(false);
    setData(r.data);
  }, []);

  useEffect(() => {
    // Initial fetch + refresh every 30 s so new red flags appear without reloading.
    const first = setTimeout(load, 0);
    const timer = setInterval(load, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load]);

  if (needLogin) return <main className="px-4 py-10"><Login onDone={load} /></main>;
  if (!data) return <main className="px-4 py-10 text-center">{offline ? "เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง" : "กำลังโหลด…"}</main>;

  const active = data.items.filter((i) => i.status === "active");
  const closed = data.items.filter((i) => i.status !== "active");
  return (
    <main className="mx-auto max-w-4xl px-4 py-6 space-y-4">
      <header className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold">{data.clinic.name}</h1>
          <p className="text-sm text-stone-500">
            ข้อมูลล่าสุดเมื่อ {new Date(data.data_as_of).toLocaleTimeString("th-TH")}
            {data.memory_store && " · โหมดทดลอง (ข้อมูลไม่ถูกบันทึกถาวร)"}
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <Link href="/clinic/new" className="btn">
            + สร้างแผน
          </Link>
          <Link href="/clinic/settings" className="btn-ghost">
            ตั้งค่ากฎ
          </Link>
          <button
            className="btn-ghost"
            onClick={async () => {
              await api("/api/clinic/logout", { body: {} });
              setNeedLogin(true);
            }}
          >
            ออก
          </button>
        </div>
      </header>
      {offline && <p className="text-orange-700">เชื่อมต่อไม่ได้ แสดงข้อมูลล่าสุดที่โหลดไว้</p>}
      <ul className="space-y-3">
        {active.map((i) => (
          <Row key={i.code} item={i} reload={load} onUnauthorized={() => setNeedLogin(true)} />
        ))}
        {active.length === 0 && <li className="card text-stone-500">ยังไม่มีแผน กด “สร้างแผน” เพื่อเริ่ม</li>}
      </ul>
      {closed.length > 0 && (
        <details>
          <summary className="cursor-pointer text-stone-600">แผนที่ปิดแล้ว ({closed.length})</summary>
          <ul className="space-y-3 mt-3">
            {closed.map((i) => (
              <Row key={i.code} item={i} reload={load} onUnauthorized={() => setNeedLogin(true)} />
            ))}
          </ul>
        </details>
      )}
    </main>
  );
}
