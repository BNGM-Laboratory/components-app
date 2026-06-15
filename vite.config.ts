import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    base: '/', // Важно для правильной работы на хостинге
    server: {
        host: true, // Для доступа с телефона при разработке
        port: 5173
    }
})