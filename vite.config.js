import { defineConfig } from 'vite'

export default defineConfig({
  // For https://USERNAME.github.io/REPOSITORY/
  // change REPOSITORY to your GitHub repository name.
  // For https://USERNAME.github.io/ use '/'.
  base: '/wallet-address-exporter/',
  build: {
    outDir: 'dist',
    sourcemap: false
  }
})