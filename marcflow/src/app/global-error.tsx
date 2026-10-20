'use client';

import React from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';

// Inline styles on purpose: importing globals.css here creates a second CSS chunk that the page never
// loads, and Turbopack's dev HMR then fails with "No link element found for chunk ...globals.css".
const red = '#dc2626';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body suppressHydrationWarning style={{ margin: 0, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#f8faf9', color: '#111827', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
        <div style={{ width: '100%', maxWidth: 512, background: '#fff', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 24, padding: 48, textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(220,38,38,0.08)' }}>
          <div style={{ width: 96, height: 96, margin: '0 auto 32px', borderRadius: '50%', background: 'rgba(220,38,38,0.1)', color: red, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertOctagon size={48} />
          </div>
          <h1 style={{ fontSize: 44, fontWeight: 900, color: red, margin: '0 0 12px' }}>Erro fatal</h1>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 16px' }}>O sistema encontrou um problema crítico</h2>
          <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6, margin: '0 auto 40px', maxWidth: 384 }}>
            O aplicativo encontrou um erro na configuração básica. Recarregue o sistema.
          </p>
          <button onClick={() => reset()} style={{ width: '100%', height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: red, color: '#fff', border: 0, borderRadius: 12, fontSize: 15, fontWeight: 500, cursor: 'pointer' }}>
            <RotateCcw size={16} />
            <span>Recarregar aplicativo</span>
          </button>
          {error.digest && (
            <div style={{ marginTop: 32, fontSize: 11, color: '#6b7280', fontFamily: 'ui-monospace, monospace', background: 'rgba(0,0,0,0.04)', padding: 12, borderRadius: 8, wordBreak: 'break-all' }}>
              Digest ID: {error.digest}
            </div>
          )}
        </div>
      </body>
    </html>
  );
}
