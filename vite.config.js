import { defineConfig } from 'vite'

export default defineConfig({
  base: "/Gr-fica-Master-Print/",
  build: {
    target: 'esnext'     // ← Essencial para suportar #
  }
})