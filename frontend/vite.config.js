import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // portas fora do padrão pra não brigar com o ConverteAqui (8000/5173)
  server: { port: 5180, strictPort: true, proxy: { '/api': 'http://127.0.0.1:8010' } },
})
