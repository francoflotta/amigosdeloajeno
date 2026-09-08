'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Disc3, Lock, Loader2 } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'No se pudo iniciar sesion.');
      }
      const from = searchParams.get('from') || '/';
      router.replace(from);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesion.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-8">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-sm"
      >
        <div className="paper-grain rounded-sm shadow-[0_20px_50px_rgba(0,0,0,0.45)] px-7 py-8 sm:px-9 sm:py-10">
          <div className="flex items-center gap-3 mb-1">
            <Disc3 className="w-7 h-7 shrink-0" style={{ color: 'var(--ink)' }} />
            <h1
              className="text-[22px] leading-tight"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--ink)' }}
            >
              Amigos de lo Ajeno
            </h1>
          </div>
          <p className="text-sm mb-7" style={{ color: 'var(--ink-soft)' }}>
            Ingresa tus credenciales para tasar discos.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--ink-soft)' }}>Usuario</label>
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="field-line w-full py-1.5 text-[15px]"
                required
              />
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--ink-soft)' }}>Contraseña</label>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field-line w-full py-1.5 text-[15px]"
                required
              />
            </div>

            {error && (
              <p className="text-xs" style={{ color: 'var(--stamp-red)' }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 flex items-center justify-center gap-2 text-[15px] font-medium transition-transform active:scale-[0.98] disabled:opacity-60"
              style={{ background: 'var(--mustard)', color: 'var(--mustard-ink)' }}
            >
              {loading ? (
                <>Ingresando <Loader2 className="w-4 h-4 animate-spin" /></>
              ) : (
                <>Ingresar <Lock className="w-4 h-4" /></>
              )}
            </button>
          </form>
        </div>
      </motion.div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
