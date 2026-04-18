import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Zentrax - Seu app de Gestão de Faturamento',
        short_name: 'ZentraX',
        description: 'Sistema inteligente para gestão de faturamento e controle financeiro.',
        start_url: '/',
        display: 'standalone',
        background_color: '#084d6e',
        theme_color: '#7c86ff',
        
        icons: [
            {
                src: '/android-chrome-192x192.png', // Mudei para o nome exato da imagem
                sizes: '192x192',
                type: 'image/png',
            },
            {
                src: '/android-chrome-512x512.png', // Mudei para o nome exato da imagem
                sizes: '512x512',
                type: 'image/png',
            },
        ],
    }
}