"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { ArrowLeft, CalendarCheck, Clock, Phone, Printer, ScanLine, Siren } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { api, thaiDate } from "@/lib/client";
import { getPosture, groupsFile } from "@/lib/content";

interface PlanView {
  code: string;
  posture_ids: string[];
  days_per_week: number;
  remind_time: string;
  start_date: string;
  next_visit_date: string;
  clinic: { name: string; phone: string | null };
}

/** A6 appointment slip with the QR. The secret only lives in this page's URL fragment and in the QR. */
export default function SlipPage() {
  const { code } = useParams<{ code: string }>();
  const [qr, setQr] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanView | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const secret = window.location.hash.slice(1);
    if (!secret) {
      Promise.resolve().then(() => setErr("ไม่มีรหัสลับในลิงก์ ให้กด “ออกใบนัดใหม่” จากหน้าคลินิก"));
      return;
    }
    api<PlanView>(`/api/p/${code}/plan`, { body: { secret } }).then((r) => {
      if (!r.ok) return setErr(r.message_th ?? "โหลดแผนไม่ได้");
      setPlan(r.data);
      // QR only after the secret checks out, so an old slip link never prints a dead QR.
      const url = `${window.location.origin}/p/${code}#${secret}`;
      return QRCode.toDataURL(url, { margin: 0, width: 480, errorCorrectionLevel: "M", color: { dark: "#1f2f25", light: "#ffffff" } })
        .then(setQr)
        .catch(() => setErr("สร้าง QR ไม่สำเร็จ ลองใหม่อีกครั้ง"));
    });
  }, [code]);

  // One group has at most 5 postures. 6–13 (2–3 groups) get a compact two-column list, and a smaller QR past 10,
  // so the 1669 box, the clinic phone and the credit stay on the A6 page.
  const count = plan?.posture_ids.length ?? 0;
  const many = count > 5;
  const qrSize = count > 10 ? "h-[30mm] w-[30mm]" : "h-[38mm] w-[38mm]";

  return (
    <main className="slip-page flex flex-1 flex-col items-center gap-5 px-4 py-6">
      <div className="no-print flex w-full max-w-[105mm] items-center justify-between gap-3">
        <Link href="/clinic" className="btn-ghost min-h-12 px-4 text-base">
          <ArrowLeft aria-hidden className="h-5 w-5" strokeWidth={2} />
          คลินิก
        </Link>
        <button className="btn min-h-12 px-5 text-base" disabled={!plan || !qr} onClick={() => window.print()}>
          <Printer aria-hidden className="h-5 w-5" strokeWidth={2} />
          พิมพ์ใบนัด (A6)
        </button>
      </div>
      {err && <p className="no-print font-semibold text-emergency">{err}</p>}

      <article className="slip relative flex flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-soft">
        {/* Corner sun, as on the patient's home screen, kept beside the header only. */}
        <svg aria-hidden viewBox="0 0 120 80" className="pointer-events-none absolute top-0 right-0 h-[22mm] w-[32mm]">
          <circle cx="92" cy="22" r="30" fill="#f2c14e" opacity="0.22" />
          <circle cx="92" cy="22" r="17" fill="#f2c14e" opacity="0.3" />
          <path d="M70 80 C72 62 80 50 94 42" fill="none" stroke="#9cb59a" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
          <path d="M80 62 c-12 -3 -18 -11 -19 -18 c9 1 17 6 19 18z" fill="#9cb59a" opacity="0.45" />
        </svg>

        <header className="relative flex items-center gap-[2.5mm]">
          <LogoMark className="h-[9mm] w-[9mm]" />
          <div className="min-w-0 leading-tight">
            <p className="text-[15px] font-bold text-brand">การบ้านหลังนวด</p>
            <p className="truncate text-[11px] text-muted">{plan?.clinic.name ?? " "}</p>
          </div>
        </header>

        <section className="mt-[3.5mm] flex items-stretch gap-[3.5mm]">
          <div className="flex shrink-0 flex-col items-center gap-[1.5mm] rounded-[4mm] border border-line bg-white p-[2.5mm]">
            {qr ? <img src={qr} alt="QR เปิดแผนการบ้าน" className={qrSize} /> : <span className={`${qrSize} rounded-[2mm] bg-sage-tint`} />}
            <span className="flex items-center gap-1 text-[11px] font-semibold text-brand">
              <ScanLine aria-hidden className="h-[3.5mm] w-[3.5mm]" strokeWidth={2.25} />
              สแกนด้วยกล้องมือถือ
            </span>
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-between gap-[2mm]">
            <div>
              <p className="text-[11px] text-muted">รหัสแผน</p>
              <p className="font-display text-[26px] font-bold leading-none tracking-wide text-brand">{code}</p>
            </div>
            <div className="rounded-[3mm] bg-brand px-[2.5mm] py-[2mm] text-white">
              <p className="flex items-center gap-1 text-[10.5px] opacity-90">
                <CalendarCheck aria-hidden className="h-[3.5mm] w-[3.5mm]" strokeWidth={2} />
                นัดครั้งถัดไป
              </p>
              <p className="text-[16px] font-bold leading-snug">{plan ? thaiDate(plan.next_visit_date) : " "}</p>
            </div>
            {plan && (
              <p className="flex items-center gap-1 rounded-full bg-sage-tint px-[2.5mm] py-[1mm] text-[11px] font-semibold text-brand">
                <Clock aria-hidden className="h-[3.5mm] w-[3.5mm] shrink-0" strokeWidth={2} />
                {plan.days_per_week === 7 ? "ทุกวัน" : `สัปดาห์ละ ${plan.days_per_week} วัน`} เวลา {plan.remind_time}
              </p>
            )}
          </div>
        </section>

        {plan && (
          <section className="mt-[3.5mm]">
            <h2 className="text-[13px] font-semibold text-foreground">ท่าที่แพทย์แผนไทยสั่ง</h2>
            <ol className={`mt-[1.5mm] grid ${many ? "grid-cols-2 gap-x-[3mm] gap-y-[1mm]" : "gap-[1.2mm]"}`}>
              {plan.posture_ids.map((id, i) => (
                <li key={id} className={`flex items-center gap-[2mm] leading-snug ${many ? "text-[11.5px]" : "text-[12.5px]"}`}>
                  <span
                    aria-hidden
                    className={`flex shrink-0 items-center justify-center rounded-[1.5mm] bg-sage-tint font-bold text-brand ${
                      many ? "h-[4.5mm] w-[4.5mm] text-[10px]" : "h-[5mm] w-[5mm] text-[11px]"
                    }`}
                  >
                    {i + 1}
                  </span>
                  {getPosture(id).name_th}
                </li>
              ))}
            </ol>
          </section>
        )}

        <section className="mt-auto space-y-[2mm] pt-[3mm]">
          <p className="text-[11px] leading-snug text-muted">สแกน QR ด้วยกล้องมือถือ (ให้ลูกหลานช่วยได้) ไม่ต้องติดตั้งแอป</p>
          <div className="flex items-center gap-[2mm] rounded-[3mm] border border-emergency/50 bg-emergency-tint px-[2.5mm] py-[1.5mm] text-[11px] leading-snug text-emergency">
            <Siren aria-hidden className="h-[4mm] w-[4mm] shrink-0" strokeWidth={2.25} />
            <p>
              มีอาการผิดปกติ
              {plan?.clinic.phone ? (
                <>
                  {" "}
                  <span className="whitespace-nowrap font-semibold">
                    <Phone aria-hidden className="inline h-[3mm] w-[3mm] align-[-1px]" strokeWidth={2.25} /> โทรคลินิก {plan.clinic.phone}
                  </span>
                </>
              ) : null}{" "}
              · <span className="whitespace-nowrap font-bold">ฉุกเฉินโทร 1669</span>
            </p>
          </div>
          <p className="text-[9px] leading-snug text-muted">
            ท่าจาก “{groupsFile.series_title_th}” {groupsFile.publisher_th} {groupsFile.year_be}
          </p>
        </section>
      </article>
    </main>
  );
}
