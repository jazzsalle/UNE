// ref: CLAUDE.md §9.1, §21.2 — GNB (반응형)
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { MODE_TABS, PHASE_KR } from '@/lib/constants';
import { useAppStore } from '@/stores/appStore';
import { useEmulatorStore } from '@/stores/emulatorStore';

// 모드탭 축약 (태블릿)
const MODE_SHORT: Record<string, string> = {
  '전주기 운전 모니터링': '모니터링',
  '설비 상태감시': '상태감시',
  '상호영향 위험예측': '위험예측',
  '시뮬레이션': '시뮬레이션',
  '이력관리': '이력관리',
  '디지털 SOP': 'SOP',
};

export function GNB() {
  const pathname = usePathname();
  const alarms = useAppStore((s) => s.alarms);
  const [showAlarmPanel, setShowAlarmPanel] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const scenarioId = useEmulatorStore((s) => s.scenario_id);
  const running = useEmulatorStore((s) => s.running);
  const activeAlarms = alarms.filter((a) => a.label === 'ANOMALY' || a.label === 'WARNING');

  return (
    <>
      <nav className="h-12 bg-[#0c1220]/90 backdrop-blur-xl border-b border-white/[0.06] flex items-center px-2 sm:px-4 gap-1 relative z-30">
        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden p-2 rounded-lg hover:bg-white/[0.05] text-gray-400 mr-1"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {mobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>

        {/* Logo */}
        <Link href="/monitoring" className="flex items-center gap-2 mr-2 sm:mr-5" onClick={() => setMobileMenuOpen(false)}>
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-[12px] font-black text-white shadow-lg shadow-cyan-500/20">
            H2
          </div>
          <span className="text-[13px] font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent hidden sm:block">
            디지털트윈
          </span>
        </Link>

        {/* Mode Tabs — desktop: 전체표시, tablet: 축약, mobile: 숨김 (drawer) */}
        <div className="hidden lg:flex gap-0.5 bg-white/[0.03] rounded-lg p-0.5">
          {MODE_TABS.map((tab) => {
            const isActive = pathname?.startsWith(tab.path);
            return (
              <Link
                key={tab.code}
                href={tab.path}
                className={`mode-tab ${isActive ? 'mode-tab-active' : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.05]'}`}
              >
                <span className="hidden xl:inline">{tab.label}</span>
                <span className="xl:hidden">{MODE_SHORT[tab.label] || tab.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="flex-1" />

        {/* Status indicator */}
        {running && (
          <div className="hidden sm:flex items-center gap-1.5 mr-3 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[12px] text-emerald-400 font-medium">{scenarioId} 실행중</span>
          </div>
        )}

        {/* Alarm */}
        <button
          onClick={() => setShowAlarmPanel(!showAlarmPanel)}
          className="relative p-2 rounded-lg hover:bg-white/[0.05] transition-colors"
        >
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {activeAlarms.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 animate-pulse">
              {activeAlarms.length}
            </span>
          )}
        </button>

        {/* Settings / Reports */}
        <Link href="/settings" className={`p-2 rounded-lg hover:bg-white/[0.05] transition-colors ${pathname === '/settings' ? 'text-white' : 'text-gray-500'}`}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573-1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </Link>
        <Link href="/reports" className={`p-2 rounded-lg hover:bg-white/[0.05] transition-colors ${pathname === '/reports' ? 'text-white' : 'text-gray-500'}`}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </Link>
      </nav>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed left-0 top-12 bottom-0 w-64 bg-[#0c1220] border-r border-white/[0.08] z-50 lg:hidden animate-slideIn overflow-y-auto">
            <div className="p-3 space-y-1">
              <div className="text-[11px] text-gray-600 uppercase tracking-wider px-3 py-2">운영 모드</div>
              {MODE_TABS.map((tab) => {
                const isActive = pathname?.startsWith(tab.path);
                return (
                  <Link
                    key={tab.code}
                    href={tab.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`block px-3 py-2.5 rounded-lg text-[13px] transition-colors ${
                      isActive
                        ? 'bg-cyan-500/10 text-cyan-400 font-medium'
                        : 'text-gray-400 hover:text-white hover:bg-white/[0.05]'
                    }`}
                  >
                    {tab.label}
                  </Link>
                );
              })}
              <div className="border-t border-white/[0.06] my-2" />
              <div className="text-[11px] text-gray-600 uppercase tracking-wider px-3 py-2">보조</div>
              <Link href="/settings" onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2.5 rounded-lg text-[13px] ${pathname === '/settings' ? 'text-cyan-400 bg-cyan-500/10' : 'text-gray-400 hover:text-white hover:bg-white/[0.05]'}`}>
                설정
              </Link>
              <Link href="/reports" onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2.5 rounded-lg text-[13px] ${pathname === '/reports' ? 'text-cyan-400 bg-cyan-500/10' : 'text-gray-400 hover:text-white hover:bg-white/[0.05]'}`}>
                보고서
              </Link>
            </div>
            {running && (
              <div className="px-3 py-2 border-t border-white/[0.06]">
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/10">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[12px] text-emerald-400">{scenarioId} 실행중</span>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Alarm Panel Dropdown */}
      {showAlarmPanel && (
        <div className="absolute right-2 sm:right-4 top-12 z-50 w-72 sm:w-80 glass animate-fadeIn">
          <div className="p-3 border-b border-white/[0.06]">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium">알람 ({activeAlarms.length}건)</span>
              <button onClick={() => setShowAlarmPanel(false)} className="text-gray-500 hover:text-white text-xs">✕</button>
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto scrollbar-thin">
            {activeAlarms.length === 0 ? (
              <div className="p-4 text-center text-gray-600 text-xs">활성 알람 없음</div>
            ) : (
              activeAlarms.slice(0, 20).map((alarm, i) => (
                <div key={i} className="px-3 py-2 border-b border-white/[0.03] hover:bg-white/[0.03] text-[13px]">
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${alarm.label === 'ANOMALY' ? 'bg-red-500' : 'bg-amber-500'}`} />
                    <span className="text-white font-medium truncate">{alarm.sensor_id}</span>
                    <span className="text-gray-500 ml-auto shrink-0">{PHASE_KR[alarm.phase] || alarm.phase}</span>
                  </div>
                  <div className="text-gray-400 mt-0.5 pl-3.5">값: {alarm.value?.toFixed(2)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
