"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ClipboardList, LogOut, Plus, ShieldAlert } from "lucide-react";
import { LogoMark } from "@/components/Logo";

const NAV = [
  { href: "/clinic", label: "แผนผู้ป่วย", icon: ClipboardList },
  { href: "/clinic/new", label: "สร้างแผน", icon: Plus },
  { href: "/clinic/settings", label: "กฎธงแดง", icon: ShieldAlert },
] as const;

/** Clinic pages share one top bar: brand, clinic name, pill navigation, and an optional logout. */
export function ClinicShell({ clinicName, onLogout, children }: { clinicName?: string; onLogout?: () => void; children: ReactNode }) {
  const path = usePathname();
  return (
    <div className="flex-1">
      <header className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-3 px-5 pt-6 pb-2">
        <Link href="/clinic" className="flex min-w-0 items-center gap-3">
          <LogoMark className="h-11 w-11" />
          <span className="min-w-0 leading-tight">
            <span className="block text-lg font-bold text-brand">การบ้านหลังนวด · คลินิก</span>
            {clinicName && <span className="block truncate text-base text-muted">{clinicName}</span>}
          </span>
        </Link>
        <nav aria-label="เมนูคลินิก" className="ml-auto flex flex-wrap items-center gap-1 rounded-full border border-line bg-brand-tint p-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const on = path === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={on ? "page" : undefined}
                className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-base font-semibold transition ${
                  on ? "bg-surface text-brand shadow-soft" : "text-muted hover:text-brand"
                }`}
              >
                <Icon aria-hidden className="h-[18px] w-[18px]" strokeWidth={2} />
                {label}
              </Link>
            );
          })}
        </nav>
        {onLogout && (
          <button className="btn-ghost min-h-11 px-4 text-base" onClick={onLogout}>
            <LogOut aria-hidden className="h-[18px] w-[18px]" strokeWidth={2} />
            ออก
          </button>
        )}
      </header>
      <main className="mx-auto max-w-5xl px-5 pt-4 pb-12">{children}</main>
    </div>
  );
}
