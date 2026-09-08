// app/api/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, SESSION_SECRET } from '@/middleware';

// Usuario y contraseña por defecto. En Vercel conviene sobreescribirlos con
// las variables de entorno APP_USERNAME / APP_PASSWORD (Project Settings > Environment Variables).
const APP_USERNAME = process.env.APP_USERNAME || 'francoflotta';
const APP_PASSWORD = process.env.APP_PASSWORD || 'fran123gfx';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (username === APP_USERNAME && password === APP_PASSWORD) {
      const res = NextResponse.json({ ok: true });
      res.cookies.set(SESSION_COOKIE, SESSION_SECRET, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30, // 30 dias
      });
      return res;
    }

    return NextResponse.json({ error: 'Usuario o contraseña incorrectos.' }, { status: 401 });
  } catch {
    return NextResponse.json({ error: 'Solicitud invalida.' }, { status: 400 });
  }
}
