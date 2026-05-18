import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

// fs.rmSync({ recursive: true }) crashes on Node.js v24 when the project path
// contains non-ASCII characters (Korean). Use per-entry unlinkSync/rmdirSync instead.
function safeDeleteDir(dir) {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (fs.statSync(full).isDirectory()) {
      safeDeleteDir(full)
      fs.rmdirSync(full)
    } else {
      fs.unlinkSync(full)
    }
  }
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'safe-empty-outdir',
      apply: 'build',
      buildStart() {
        safeDeleteDir(path.resolve('dist'))
      },
    },
  ],
  build: {
    // Disable Vite's built-in emptyOutDir (uses fs.rmSync recursive which crashes
    // on Node.js v24 when the project path contains Korean characters).
    emptyOutDir: false,
  },
})
