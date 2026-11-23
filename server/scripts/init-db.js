// Membuat database, tabel, dan data awal dari database/schema.sql.
// PERHATIAN: schema.sql akan menghapus tabel lama (data lama ikut hilang).
import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'
import { dbConfig } from '../db.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const schemaPath = path.join(here, '..', '..', 'database', 'schema.sql')

const sql = fs.readFileSync(schemaPath, 'utf8')
const conn = await mysql.createConnection({ ...dbConfig(), multipleStatements: true })
try {
  await conn.query(sql)
  console.log('[TumbuhRuang] Database berhasil dibuat / di-reset.')
  console.log('[TumbuhRuang] Akun admin: admin / admin123   |   Akun petugas: user / user123')
} catch (err) {
  console.error('[TumbuhRuang] Gagal membuat database:', err.message)
  process.exitCode = 1
} finally {
  await conn.end()
}
