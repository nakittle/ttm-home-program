import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 space-y-6">
      <h1 className="text-3xl font-bold text-brand">การบ้านหลังนวด</h1>
      <p>
        แพทย์แผนไทยสั่งท่าฤๅษีดัดตนของกรมการแพทย์แผนไทยฯ ให้ผู้ป่วยรายคนผ่าน QR → ผู้ป่วยทำที่บ้านตามเสียง
        และกล้องมือถือช่วยนับเวลาค้างท่า → ผลและธงแดงกลับถึงคลินิกก่อนนัดครั้งถัดไป → กรมฯ เห็นภาพรวม
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/clinic" className="card hover:border-brand">
          <div className="text-xl font-semibold">สำหรับคลินิก</div>
          <div className="text-stone-600">สร้างแผน ออกใบนัดพร้อม QR ดูผลและธงแดง</div>
        </Link>
        <Link href="/dtam" className="card hover:border-brand">
          <div className="text-xl font-semibold">สำหรับกรมฯ</div>
          <div className="text-stone-600">ภาพรวมการทำตามแผน (ยอดรวม ไม่มีข้อมูลรายคน)</div>
        </Link>
      </div>
      <p className="text-sm text-stone-500">
        ผู้ป่วยไม่ต้องเข้าหน้านี้ ให้สแกน QR บนใบนัดที่ได้จากคลินิก · เนื้อหาท่าจากแผ่น
        &ldquo;ยืดเหยียด...ดัดตน...พ้นโรค ด้วยท่าฤๅษีดัดตน&rdquo; กรมการแพทย์แผนไทยและการแพทย์ทางเลือก 2569 · ต้นแบบสำหรับการแข่งขัน
        ไม่ใช่เครื่องมือวินิจฉัย
      </p>
    </main>
  );
}
