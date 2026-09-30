import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 45553,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:45554',
      '/uploads': 'http://localhost:45554',
    },
  },
})
