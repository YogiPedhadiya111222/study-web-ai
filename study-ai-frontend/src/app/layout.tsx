import type { Metadata } from 'next';
import { Manrope, Space_Grotesk } from 'next/font/google';
import SettingsProvider from '@/components/SettingsProvider';
import SettingsThemeScript from '@/components/SettingsThemeScript';
import './globals.css';

const bodyFont = Manrope({
  variable: '--font-body',
  subsets: ['latin'],
});

const displayFont = Space_Grotesk({
  variable: '--font-display',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'StudyAI - Intelligent Study Tracker',
  description: 'Track your study sessions, analyze productivity, and improve learning habits with AI-powered insights.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${bodyFont.variable} ${displayFont.variable} h-full antialiased`}
    >
      <head>
        <SettingsThemeScript />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)]">
        <SettingsProvider>{children}</SettingsProvider>
      </body>
    </html>
  );
}
