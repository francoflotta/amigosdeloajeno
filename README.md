This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Configuración (Amigos de lo Ajeno)

Variables de entorno (ver `.env.local` para más detalle de cada una):

- `AI_PROVIDER` — `groq` (por defecto, funciona en Vercel) o `lmstudio` (local).
- `GROQ_API_KEY` — obtenela gratis en [console.groq.com/keys](https://console.groq.com/keys), sin tarjeta.
- `GROQ_MODEL` — modelo con visión de Groq (por defecto `qwen/qwen3.6-27b`).
- `DISCOGS_TOKEN` — opcional, para consultar precios reales del mercado de Discogs.
- `APP_USERNAME` / `APP_PASSWORD` — credenciales para el login que protege la app.
- `SESSION_SECRET` — secreto interno para la cookie de sesión.

Al desplegar en Vercel, cargá estas variables en **Project Settings → Environment Variables** (no se suben solas desde `.env.local`, que está en `.gitignore`).

