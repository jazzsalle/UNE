// ref: CLAUDE.md §9.1 — API 연결상태 바
'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const PROVIDERS = [
  { key: 'kogas', label: 'KOGAS' },
  { key: 'kgs', label: 'KGS' },
  { key: 'keti', label: 'KETI' },
  { key: 'safetia', label: '세이프티아' },
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

  const icon = (status: string) => {
    if (status === 'ok') return '🟢';
    if (status === 'error') return '🔴';
    return '⚪';
  };

  return (
    <div className="h-7 bg-bg-tertiary border-b border-gray-700 flex items-center px-4 gap-4 text-[11px] text-gray-400">
      {PROVIDERS.map((p) => (
        <span key={p.key}>
          {icon(statuses[p.key] || 'loading')} {p.label}
        </span>
      ))}
    </div>
  );
}
