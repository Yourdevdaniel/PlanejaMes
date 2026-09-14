import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// porta fora do padrão pra não brigar com o ConverteAqui (5173)
export default defineConfig({
  plugins: [react()],
  server: { port: 5180 },
})
