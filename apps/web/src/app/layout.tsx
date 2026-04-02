// ref: CLAUDE.md §9.1 — 공통 레이아웃
import type { Metadata } from 'next';
import './globals.css';
import { GNB } from '@/components/layout/GNB';
import { ApiStatusBar } from '@/components/layout/ApiStatusBar';
import { EmulatorBar } from '@/components/layout/EmulatorBar';
import { SSEProvider } from '@/components/layout/SSEProvider';
import { AmbientProvider } from '@/components/layout/AmbientProvider';
import { SopPopupOverlay } from '@/components/layout/SopPopupOverlay';

export const metadata: Metadata = {
  title: 'LH2 디지털트윈 - 자율안전관리 플랫폼',
  description: '액화수소 인수기지 디지털 트윈 자율안전관리 플랫폼 POC',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="dark">
      <body className="h-screen flex flex-col overflow-hidden">
        <SSEProvider />
        <AmbientProvider />
        <GNB />
        <ApiStatusBar />
        <main className="flex-1 overflow-hidden">{children}</main>
        <SopPopupOverlay />
        <EmulatorBar />
      </body>
    </html>
  );
}
