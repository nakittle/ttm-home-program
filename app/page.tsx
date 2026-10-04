import Link from "next/link";
import { ArrowRight, Building2, ChartColumn, ClipboardList, Home as HomeIcon, QrCode, ShieldCheck, Sprout, Stethoscope } from "lucide-react";

const LOOP = [
  { icon: Stethoscope, title: "แพทย์แผนไทยสั่งท่า", text: "เลือกท่าฤๅษีดัดตนจากแผ่นของกรมฯ ให้ผู้ป่วยรายคน ออกใบนัดพร้อม QR" },
  { icon: HomeIcon, title: "ผู้ป่วยทำที่บ้าน", text: "สแกน QR ไม่ต้องติดตั้งแอป ทำตามเสียงไทย กล้องมือถือช่วยนับเวลาค้างท่า" },
  { icon: ClipboardList, title: "ผลกลับถึงคลินิก", text: "การทำตามแผน ระดับปวด และธงแดง ถึงคลินิกก่อนนัดครั้งถัดไป" },
  { icon: ChartColumn, title: "กรมฯ เห็นภาพรวม", text: "ยอดรวมการทำตามแผนรายศูนย์ ไม่มีข้อมูลรายคน" },
] as const;

export default function Home() {
  return (
    <main className="flex-1">
      <header className="mx-auto flex max-w-6xl items-center gap-3 px-5 pt-6">
        <span aria-hidden className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sage-tint text-brand">
          <Sprout className="h-6 w-6" strokeWidth={2} />
        </span>
        <span className="text-lg font-bold text-brand">การบ้านหลังนวด</span>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pt-10 pb-14 md:grid-cols-[1fr_auto]">
        <div className="rise space-y-6">
          <h1 className="font-display text-[38px] font-bold leading-[1.2] text-brand sm:text-[56px]">
            นวดเสร็จแล้ว
            <br />
            <span className="text-clay-ink">
              <span className="whitespace-nowrap">การบ้าน</span><wbr />
              <span className="whitespace-nowrap">ไม่หายไปไหน</span>
            </span>
          </h1>
          <p className="max-w-xl text-xl text-muted">
            แพทย์แผนไทยสั่งท่าฤๅษีดัดตนของกรมการแพทย์แผนไทยฯ ให้ผู้ป่วยรายคนผ่าน QR ผู้ป่วยทำที่บ้านตามเสียง
            แล้วผลและธงแดงกลับถึงคลินิกก่อนนัดครั้งถัดไป
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/clinic" className="btn min-h-14 px-7 text-lg">
              <Building2 aria-hidden className="h-5 w-5" strokeWidth={2} />
              สำหรับคลินิก
            </Link>
            <Link href="/dtam" className="btn-ghost min-h-14 px-7 text-lg">
              <ChartColumn aria-hidden className="h-5 w-5" strokeWidth={2} />
              สำหรับกรมฯ
            </Link>
          </div>
          <p className="flex items-center gap-2 text-base text-muted">
            <QrCode aria-hidden className="h-5 w-5 shrink-0" strokeWidth={2} />
            ผู้ป่วยไม่ต้องเข้าหน้านี้ ให้สแกน QR บนใบนัดที่ได้จากคลินิก
          </p>
        </div>

        {/* The real patient home screen (synthetic demo clinic), framed as a phone. */}
        <figure className="rise relative mx-auto w-[260px] sm:w-[300px]" style={{ ["--i" as string]: 2 }}>
          <span aria-hidden className="absolute -inset-10 -z-10 rounded-full bg-[radial-gradient(circle,rgb(242_193_78/0.28),transparent_65%)]" />
          <div className="rounded-[44px] border border-line bg-foreground p-2.5 shadow-[0_40px_80px_-40px_rgb(35_61_44/0.6)]">
            <img
              src="/landing/patient-home.webp"
              alt="หน้าวันนี้ของผู้ป่วย: คำทักทาย ปุ่มเริ่มทำการบ้าน แถบสัปดาห์นี้ และท่าที่แพทย์สั่ง"
              width={600}
              height={1200}
              className="block w-full rounded-[36px]"
            />
          </div>
          <figcaption className="mt-3 text-center text-base text-muted">หน้าจอผู้ป่วยจริง (คลินิกข้อมูลจำลอง)</figcaption>
        </figure>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-14">
        <h2 className="rise pb-5 text-[25px] font-semibold">ข้อมูลเดินครบวง</h2>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {LOOP.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="card rise relative space-y-3 p-6" style={{ ["--i" as string]: i + 1 }}>
              <span className="flex items-center justify-between">
                <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sage-tint text-brand">
                  <Icon className="h-6 w-6" strokeWidth={2} />
                </span>
                <span className="font-display text-[28px] font-bold text-sage">{i + 1}</span>
              </span>
              <h3 className="text-xl font-semibold">{title}</h3>
              <p className="text-base text-muted">{text}</p>
              {i < LOOP.length - 1 && (
                <ArrowRight aria-hidden className="absolute top-1/2 -right-3.5 hidden h-7 w-7 -translate-y-1/2 rounded-full bg-surface p-1 text-brand shadow-soft lg:block" strokeWidth={2.25} />
              )}
            </li>
          ))}
        </ol>
      </section>

      <footer className="mx-auto max-w-6xl px-5 pb-12">
        <p className="flex gap-2 rounded-3xl border border-line bg-surface/70 p-5 text-base text-muted">
          <ShieldCheck aria-hidden className="mt-1 h-5 w-5 shrink-0 text-brand" strokeWidth={2} />
          <span>
            เนื้อหาท่าจากแผ่น &ldquo;ยืดเหยียด...ดัดตน...พ้นโรค ด้วยท่าฤๅษีดัดตน&rdquo; กรมการแพทย์แผนไทยและการแพทย์ทางเลือก 2569 ·
            ภาพจากกล้องประมวลผลในมือถือเท่านั้น · ต้นแบบสำหรับการแข่งขัน ไม่ใช่เครื่องมือวินิจฉัย
          </span>
        </p>
      </footer>
    </main>
  );
}
