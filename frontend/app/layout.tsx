import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "졸업시뮬레이터",
  description: "졸업 요건을 시뮬레이션하고 관리하는 플랫폼",
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
