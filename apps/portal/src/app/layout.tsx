import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Conecte-se ao Wi-Fi',
  description: 'Portal de acesso Wi-Fi',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
