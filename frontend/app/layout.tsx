import Script from 'next/script';
import { Vazirmatn } from 'next/font/google';
import './globals.css';
import { TelegramProvider } from '@/components/TelegramProvider';

const vazirmatn = Vazirmatn({
  subsets: ['arabic'],
  display: 'swap',
  variable: '--font-vazirmatn',
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className={vazirmatn.variable}>
        <Script src="https://telegram.org/js/telegram-web-app.js?59" strategy="beforeInteractive" />
        <TelegramProvider>{children}</TelegramProvider>
      </body>
    </html>
  );
}
