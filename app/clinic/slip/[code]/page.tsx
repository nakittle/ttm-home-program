"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
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
    const url = `${window.location.origin}/p/${code}#${secret}`;
    QRCode.toDataURL(url, { margin: 1, width: 360, errorCorrectionLevel: "M" }).then(setQr)
      .catch(() => setErr("สร้าง QR ไม่สำเร็จ ลองใหม่อีกครั้ง"));
    api<PlanView>(`/api/p/${code}/plan`, { body: { secret } }).then((r) => (r.ok ? setPlan(r.data) : setErr(r.message_th ?? "โหลดแผนไม่ได้")));
  }, [code]);

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <div className="no-print flex gap-2 mb-4">
        <Link href="/clinic" className="btn-ghost">
          ← คลินิก
        </Link>
        <button className="btn" onClick={() => window.print()}>
          พิมพ์ใบนัด
        </button>
      </div>
      {err && <p className="text-red-700">{err}</p>}
      <section className="card space-y-2 print:shadow-none print:border-black" style={{ width: "105mm", minHeight: "148mm" }}>
        <h1 className="text-lg font-bold">การบ้านหลังนวด · {plan?.clinic.name}</h1>
        <div className="flex items-center gap-3">
          {qr && <img src={qr} alt="QR เปิดแผนการบ้าน" className="w-36 h-36" />}
          <div>
            <div className="text-sm text-stone-600">รหัสแผน</div>
            <div className="font-mono text-3xl font-bold">{code}</div>
            {plan && (
              <div className="text-sm">
                {plan.days_per_week === 7 ? "ทุกวัน" : `สัปดาห์ละ ${plan.days_per_week} วัน`} เวลา {plan.remind_time}
                <br />
                นัดครั้งถัดไป {thaiDate(plan.next_visit_date)}
              </div>
            )}
          </div>
        </div>
        {plan && (
          <ol className="list-decimal pl-5 text-sm">
            {plan.posture_ids.map((id) => (
              <li key={id}>{getPosture(id).name_th}</li>
            ))}
          </ol>
        )}
        <p className="text-xs">สแกน QR ด้วยกล้องมือถือ (ให้ลูกหลานช่วยได้) ไม่ต้องติดตั้งแอป · มีอาการผิดปกติ{plan?.clinic.phone ? `โทรคลินิก ${plan.clinic.phone} · ` : " · "}ฉุกเฉินโทร 1669</p>
        <p className="text-[10px] text-stone-500">
          ท่าจาก “{groupsFile.series_title_th}” {groupsFile.publisher_th} {groupsFile.year_be}
        </p>
      </section>
    </main>
  );
}
