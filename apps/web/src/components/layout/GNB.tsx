// ref: CLAUDE.md §9.1 — GNB (Global Navigation Bar)
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MODE_TABS } from '@/lib/constants';
import { useAppStore } from '@/stores/appStore';

export function GNB() {
  const pathname = usePathname();
  const alarms = useAppStore((s) => s.alarms);
  const activeAlarms = alarms.filter((a) => a.label === 'ANOMALY' || a.label === 'WARNING');

  return (
    <nav className="h-12 bg-bg-secondary border-b border-gray-700 flex items-center px-4 gap-2">
      <Link href="/monitoring" className="text-accent-cyan font-bold text-sm mr-4 whitespace-nowrap">
        LH2 디지털트윈
      </Link>

      <div className="flex gap-1">
        {MODE_TABS.map((tab) => {
          const isActive = pathname?.startsWith(tab.path);
          return (
            <Link
              key={tab.code}
              href={tab.path}
              className={`px-3 py-1.5 text-xs rounded transition-colors ${
                isActive ? 'bg-accent-blue text-white' : 'text-gray-400 hover:bg-bg-tertiary hover:text-white'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-3 text-xs">
        <button className="relative text-gray-400 hover:text-white">
          🔔
          {activeAlarms.length > 0 && (
            <span className="absolute -top-1 -right-2 bg-accent-red text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
              {activeAlarms.length}
            </span>
          )}
        </button>
        <Link href="/settings" className={`text-gray-400 hover:text-white ${pathname === '/settings' ? 'text-white' : ''}`}>⚙ 설정</Link>
        <Link href="/reports" className={`text-gray-400 hover:text-white ${pathname === '/reports' ? 'text-white' : ''}`}>📋 보고서</Link>
      </div>
    </nav>
  );
}
