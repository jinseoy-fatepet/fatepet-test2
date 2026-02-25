import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '반려견 사주 분석 - AI 명리학',
  description: '우리 아이의 타고난 운명을 AI 명리학자가 분석해드립니다.',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
