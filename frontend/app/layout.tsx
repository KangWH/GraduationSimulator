import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "졸업로그 — KAIST 졸업시뮬레이터",
  description: "KAIST 학부 재학생의 졸업요건을 확인하고 예비 졸업사정을 진행합니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
