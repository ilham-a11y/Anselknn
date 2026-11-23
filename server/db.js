import 'dotenv/config'
import mysql from 'mysql2/promise'

// Konfigurasi koneksi dibaca dari file .env (lokal) atau Environment Variables (Vercel).
export function dbConfig() {
  return {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
  }
}

let pool = null

export function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      ...dbConfig(),
      database: process.env.DB_NAME || 'tumbuhruang',
      waitForConnections: true,
      connectionLimit: 5,
      charset: 'utf8mb4',
    })
  }
  return pool
}

export async function query(sql, params = []) {
  const [rows] = await getPool().query(sql, params)
  return rows
}
