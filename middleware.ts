import { NextRequest, NextResponse } from 'next/server';

export const SESSION_COOKIE = 'ala_session';
// Este valor viaja dentro de una cookie httpOnly (no la puede leer JS del navegador).
// En produccion (Vercel) conviene setear SESSION_SECRET como variable de entorno propia.
export const SESSION_SECRET = process.env.SESSION_SECRET || 'amigos-de-lo-ajeno-secret-2026';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublicPath = pathname === '/login'
    || pathname === '/api/login'
    || pathname.startsWith('/_next')
    || /\.(svg|png|jpg|jpeg|ico|webp)$/.test(pathname);

  if (isPublicPath) return NextResponse.next();

  const authenticated = req.cookies.get(SESSION_COOKIE)?.value === SESSION_SECRET;
  if (authenticated) return NextResponse.next();

  // Las rutas de API devuelven 401 en JSON en vez de redirigir, para no romper
  // los fetch() del frontend con una respuesta HTML inesperada.
  if (pathname.startsWith('/api')) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  const loginUrl = new URL('/login', req.url);
  loginUrl.searchParams.set('from', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
