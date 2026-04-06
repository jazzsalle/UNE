// ref: CLAUDE.md §9.1, §21 — API 연결상태 바 (반응형)
'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const PROVIDERS = [
  { key: 'kogas', label: 'KOGAS', color: '#3b82f6' },
  { key: 'kgs', label: 'KGS', color: '#8b5cf6' },
  { key: 'keti', label: 'KETI', color: '#06b6d4' },
  { key: 'safetia', label: '세이프티아', color: '#10b981' },
];

export function ApiStatusBar() {
  const [statuses, setStatuses] = useState<Record<string, 'ok' | 'error' | 'loading'>>({});

  useEffect(() => {
    const check = async () => {
      for (const p of PROVIDERS) {
        try {
          await api.getProviderHealth(p.key);
          setStatuses((s) => ({ ...s, [p.key]: 'ok' }));
        } catch {
          setStatuses((s) => ({ ...s, [p.key]: 'error' }));
        }
      }
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-7 bg-[#060a13]/80 border-b border-white/[0.04] flex items-center px-2 sm:px-4 gap-3 sm:gap-5 text-[11px] sm:text-[12px] overflow-x-auto">
      <span className="text-gray-600 font-medium hidden sm:inline shrink-0">외부기관</span>
      {PROVIDERS.map((p) => {
        const status = statuses[p.key] || 'loading';
        return (
          <div key={p.key} className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <div className={`w-1.5 h-1.5 rounded-full ${
              status === 'ok' ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' :
              status === 'error' ? 'bg-red-500 animate-pulse' :
              'bg-gray-600'
            }`} />
            <span className={status === 'ok' ? 'text-gray-400' : status === 'error' ? 'text-red-400' : 'text-gray-600'}>
              {p.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
