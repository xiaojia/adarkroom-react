import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 相对路径 base：构建产物资源引用为 ./assets/...（而非 /assets/...），
  // 配合 nginx 子路径部署（如 /adr-react）时无需硬编码路径即可正确加载。
  base: './',
})
