// by Stenly
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Chat Web',
  description: 'AI Chat via Overchat API',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body suppressHydrationWarning className="bg-gray-50 text-gray-900 font-sans antialiased min-h-screen selection:bg-blue-200">
        <main className="w-full max-w-md mx-auto bg-white min-h-screen shadow-xl overflow-hidden flex flex-col relative">
          {children}
        </main>
      </body>
    </html>
  );
}
