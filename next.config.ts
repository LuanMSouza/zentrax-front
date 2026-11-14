import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Content-Security-Policy "sem nonce" (guia do Next: node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md).
// 'unsafe-inline' em script/style porque o Next põe scripts inline no HTML e o SweetAlert/framer-motion usam estilo
// inline; com nonce toda página teria que virar dinâmica. Mesmo assim fecha bastante: nada de script, imagem,
// fonte ou conexão de outro domínio, nada de <object>, <base> trocado nem o app dentro de iframe de outro site.
// connect-src: o /demo manda um beacon de visita pro leads (api.leads.dvls.com.br).
const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.leads.dvls.com.br",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
    // NEXT_DIST_DIR=.next-qa npm run build: build de teste numa pasta separada, sem encostar na .next que está no ar
    distDir: process.env.NEXT_DIST_DIR || ".next",
    // não anuncia "x-powered-by: Next.js" (só ajuda robô a escolher exploit)
    poweredByHeader: false,
    async headers() {
        return [
            {
                source: "/:path*",
                headers: [
                    { key: "Content-Security-Policy", value: csp },
                    // HTTPS por 1 ano (o navegador ignora em http, então não atrapalha o teste local)
                    { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
                    // clickjacking: ninguém embute o app num iframe pra enganar clique em "pagar"/"excluir"
                    { key: "X-Frame-Options", value: "DENY" },
                    { key: "X-Content-Type-Options", value: "nosniff" },
                    // o link do extrato tem token na URL: não vaza pra outro site no Referer
                    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
                ],
            },
        ];
    },
};

export default nextConfig;
