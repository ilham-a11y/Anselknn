// Entry point untuk menjalankan aplikasi secara lokal (XAMPP / Node.js).
// Melayani API di /api dan file hasil build frontend (folder dist).
import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import app from './app.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const dist = path.join(here, '..', 'dist')
const port = Number(process.env.PORT || 3001)

if (fs.existsSync(dist)) {
  app.use(express.static(dist))
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next()
    res.sendFile(path.join(dist, 'index.html'))
  })
} else {
  console.log('[TumbuhRuang] Folder dist belum ada. Jalankan "npm run build" atau gunakan "npm run dev".')
}

app.listen(port, () => {
  console.log(`[TumbuhRuang] Server berjalan di http://localhost:${port}`)
})
