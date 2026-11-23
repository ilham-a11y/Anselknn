import express from 'express'
import bcrypt from 'bcryptjs'
import { query } from './db.js'
import { signToken, requireAuth, requireAdmin, requirePetugas } from './auth.js'
import { classify, K, MODEL_INFO } from './knn.js'

const app = express()
app.use(express.json({ limit: '100kb' }))

const router = express.Router()

/* ---------- Helper ---------- */

const ROLES = ['admin', 'petugas']
const GENDERS = ['Perempuan', 'Laki-laki']

function todayLocal() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function validateChild(body = {}) {
  const errors = {}
  const name = String(body.name ?? '').trim()
  if (!name || name.length > 120) errors.name = 'Nama anak wajib diisi (maks. 120 karakter).'

  const age = Number(body.age)
  if (!Number.isInteger(age) || age < 0 || age > 72) errors.age = 'Usia harus berupa bilangan bulat 0–72 bulan.'

  if (!GENDERS.includes(body.gender)) errors.gender = 'Pilih jenis kelamin.'

  const weight = Number(body.weight)
  if (!(weight >= 1 && weight <= 30)) errors.weight = 'Berat badan harus 1–30 kg.'

  const height = Number(body.height)
  if (!(height >= 30 && height <= 150)) errors.height = 'Tinggi badan harus 30–150 cm.'

  const head = Number(body.head)
  if (!(head >= 25 && head <= 65)) errors.head = 'Lingkar kepala harus 25–65 cm.'

  const motor = Number(body.motor)
  if (![1, 2, 3].includes(motor)) errors.motor = 'Pilih penilaian kemampuan motorik.'

  const speech = Number(body.speech)
  if (![1, 2, 3].includes(speech)) errors.speech = 'Pilih penilaian kemampuan bicara.'

  return { errors, value: { name, age, gender: body.gender, weight, height, head, motor, speech } }
}

// Dipakai untuk buat akun (partial = false) dan ubah akun (partial = true: hanya field yang dikirim).
function validateUserInput(body = {}, { partial = false } = {}) {
  const errors = {}
  const value = {}
  const has = (k) => body[k] !== undefined

  if (!partial || has('name')) {
    const name = String(body.name ?? '').trim()
    if (!name) errors.name = 'Nama lengkap wajib diisi.'
    else value.name = name
  }
  if (!partial || has('username')) {
    const username = String(body.username ?? '').trim()
    if (!/^[a-zA-Z0-9_.]{3,30}$/.test(username)) {
      errors.username = 'Username 3–30 karakter (huruf, angka, titik, atau garis bawah).'
    } else value.username = username
  }
  if (has('email')) {
    const email = String(body.email ?? '').trim()
    if (email && !/^\S+@\S+\.\S+$/.test(email)) errors.email = 'Format email tidak valid.'
    else value.email = email || null
  }
  if (!partial || has('role')) {
    const role = body.role ?? 'petugas'
    if (!ROLES.includes(role)) errors.role = 'Peran tidak valid.'
    else value.role = role
  }
  // Saat ubah akun, kata sandi kosong berarti tidak diganti.
  if (!partial || (has('password') && String(body.password) !== '')) {
    const password = String(body.password ?? '')
    if (password.length < 6) errors.password = 'Kata sandi minimal 6 karakter.'
    else value.password = password
  }
  return { errors, value }
}

const toChild = (r) => ({
  id: Number(r.id),
  name: r.name,
  age: Number(r.age),
  gender: r.gender,
  weight: Number(r.weight),
  height: Number(r.height),
  head: Number(r.head),
  motor: Number(r.motor),
  speech: Number(r.speech),
  lastCategory: r.lastCategory ?? null,
  lastDate: r.lastDate ?? null,
})

const toResult = (r) => ({
  id: Number(r.id),
  childId: Number(r.childId),
  childName: r.childName,
  age: Number(r.age),
  gender: r.gender,
  weight: Number(r.weight),
  height: Number(r.height),
  head: Number(r.head),
  motor: Number(r.motor),
  speech: Number(r.speech),
  date: r.date,
  category: r.category,
  k: Number(r.k),
  votes: typeof r.votes === 'string' ? JSON.parse(r.votes) : r.votes,
  neighbors: typeof r.neighbors === 'string' ? JSON.parse(r.neighbors) : r.neighbors,
})

const toPublicUser = (u) => ({
  id: Number(u.id),
  name: u.name,
  username: u.username,
  email: u.email ?? null,
  role: u.role,
})

const CHILD_SELECT = `
  SELECT c.id, c.name, c.age, c.gender, c.weight, c.height, c.head, c.motor, c.speech,
    (SELECT r.category FROM results r WHERE r.child_id = c.id ORDER BY r.created_at DESC, r.id DESC LIMIT 1) AS lastCategory,
    (SELECT DATE_FORMAT(r.exam_date, '%Y-%m-%d') FROM results r WHERE r.child_id = c.id ORDER BY r.created_at DESC, r.id DESC LIMIT 1) AS lastDate
  FROM children c`

async function fetchChild(id) {
  const rows = await query(`${CHILD_SELECT} WHERE c.id = ?`, [id])
  return rows[0] ? toChild(rows[0]) : null
}

// Menjalankan K-NN untuk satu anak memakai model terlatih (tidak ada data latih di database).
async function buildResult(childId) {
  const rows = await query(
    'SELECT id, name, age, gender, weight, height, head, motor, speech FROM children WHERE id = ?',
    [childId],
  )
  if (!rows[0]) return null
  const child = toChild(rows[0])
  const computed = classify(child, K)
  return {
    childId: child.id,
    childName: child.name,
    age: child.age,
    gender: child.gender,
    weight: child.weight,
    height: child.height,
    head: child.head,
    motor: child.motor,
    speech: child.speech,
    date: todayLocal(),
    category: computed.category,
    k: computed.k,
    votes: computed.votes,
    neighbors: computed.neighbors,
  }
}

const parseId = (value) => {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

// Ringkasan model untuk ditampilkan. Data latih tidak pernah disertakan.
function publicModelInfo() {
  const { data_latih_ternormalisasi: train, normalisasi, ...rest } = MODEL_INFO
  return {
    ...rest,
    normalisasi: { metode: normalisasi.metode },
    jumlah_data_latih: train.y.length,
  }
}

/* ---------- Publik ---------- */

// Cek koneksi database, berguna saat pengujian awal.
router.get('/health', async (req, res) => {
  await query('SELECT 1 AS ok')
  res.json({ status: 'ok', database: 'terhubung' })
})

router.post('/auth/login', async (req, res) => {
  const username = String(req.body?.username ?? '').trim()
  const password = String(req.body?.password ?? '')
  if (!username || !password) {
    return res.status(400).json({ message: 'Username dan kata sandi wajib diisi.' })
  }
  const rows = await query(
    'SELECT id, name, username, email, role, password_hash FROM users WHERE username = ?',
    [username],
  )
  const user = rows[0]
  const valid = user && (await bcrypt.compare(password, user.password_hash))
  if (!valid) return res.status(401).json({ message: 'Username atau kata sandi tidak sesuai.' })
  res.json({ token: signToken(user), user: toPublicUser(user) })
})

router.post('/auth/register', async (req, res) => {
  // Pendaftaran publik selalu membuat akun petugas.
  const { errors, value } = validateUserInput({ ...req.body, role: 'petugas' })
  if (Object.keys(errors).length) return res.status(400).json({ message: 'Data belum valid.', errors })
  try {
    const hash = await bcrypt.hash(value.password, 10)
    await query(
      'INSERT INTO users (name, username, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
      [value.name, value.username, value.email ?? null, hash, 'petugas'],
    )
    res.status(201).json({ message: 'Akun berhasil dibuat. Silakan masuk.' })
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Username atau email sudah terdaftar.' })
    }
    throw err
  }
})

/* ---------- Wajib login ---------- */

router.use(requireAuth)

router.get('/auth/me', async (req, res) => {
  const rows = await query('SELECT id, name, username, email, role FROM users WHERE id = ?', [req.user.id])
  if (!rows[0]) return res.status(401).json({ message: 'Akun tidak ditemukan. Silakan masuk kembali.' })
  res.json({ user: toPublicUser(rows[0]) })
})

// Informasi model (akurasi, K, jumlah data latih). Tanpa isi data latih.
router.get('/model/info', (req, res) => {
  res.json(publicModelInfo())
})

/* ----- Data anak ----- */

// Admin & petugas dapat melihat data.
router.get('/children', async (req, res) => {
  const rows = await query(`${CHILD_SELECT} ORDER BY c.name ASC, c.id ASC`)
  res.json(rows.map(toChild))
})

// Hanya petugas dapat menambah data.
router.post('/children', requirePetugas, async (req, res) => {
  const { errors, value } = validateChild(req.body)
  if (Object.keys(errors).length) return res.status(400).json({ message: 'Periksa kembali data yang diisi.', errors })
  const ins = await query(
    'INSERT INTO children (name, age, gender, weight, height, head, motor, speech, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [value.name, value.age, value.gender, value.weight, value.height, value.head, value.motor, value.speech, req.user.id],
  )
  res.status(201).json(await fetchChild(ins.insertId))
})

// Hanya petugas dapat mengubah data.
router.put('/children/:id', requirePetugas, async (req, res) => {
  const id = parseId(req.params.id)
  if (!id || !(await fetchChild(id))) return res.status(404).json({ message: 'Data anak tidak ditemukan.' })
  const { errors, value } = validateChild(req.body)
  if (Object.keys(errors).length) return res.status(400).json({ message: 'Periksa kembali data yang diisi.', errors })
  await query(
    'UPDATE children SET name = ?, age = ?, gender = ?, weight = ?, height = ?, head = ?, motor = ?, speech = ? WHERE id = ?',
    [value.name, value.age, value.gender, value.weight, value.height, value.head, value.motor, value.speech, id],
  )
  res.json(await fetchChild(id))
})

// Admin & petugas dapat menghapus data.
router.delete('/children/:id', async (req, res) => {
  const id = parseId(req.params.id)
  if (!id || !(await fetchChild(id))) return res.status(404).json({ message: 'Data anak tidak ditemukan.' })
  // Riwayat pemeriksaan ikut terhapus karena ON DELETE CASCADE.
  await query('DELETE FROM children WHERE id = ?', [id])
  res.json({ message: 'Data anak dan riwayat pemeriksaannya berhasil dihapus.' })
})

/* ----- Klasifikasi & hasil ----- */

// Hanya petugas: pratinjau klasifikasi (belum disimpan).
router.post('/classify', requirePetugas, async (req, res) => {
  const childId = parseId(req.body?.childId)
  if (!childId) return res.status(400).json({ message: 'Pilih data anak terlebih dahulu.' })
  const result = await buildResult(childId)
  if (!result) return res.status(404).json({ message: 'Data anak tidak ditemukan.' })
  res.json({ id: null, ...result })
})

// Admin & petugas dapat melihat hasil klasifikasi.
router.get('/results', async (req, res) => {
  const rows = await query(`
    SELECT id, child_id AS childId, child_name AS childName, age, gender, weight, height, head, motor, speech,
      DATE_FORMAT(exam_date, '%Y-%m-%d') AS date, category, k, votes, neighbors
    FROM results ORDER BY exam_date DESC, id DESC`)
  res.json(rows.map(toResult))
})

// Hanya petugas: menjalankan ulang klasifikasi di server lalu menyimpannya.
router.post('/results', requirePetugas, async (req, res) => {
  const childId = parseId(req.body?.childId)
  if (!childId) return res.status(400).json({ message: 'Pilih data anak terlebih dahulu.' })
  const r = await buildResult(childId)
  if (!r) return res.status(404).json({ message: 'Data anak tidak ditemukan.' })
  const ins = await query(
    `INSERT INTO results (child_id, child_name, age, gender, weight, height, head, motor, speech, exam_date, category, k, votes, neighbors, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [r.childId, r.childName, r.age, r.gender, r.weight, r.height, r.head, r.motor, r.speech, r.date,
      r.category, r.k, JSON.stringify(r.votes), JSON.stringify(r.neighbors), req.user.id],
  )
  res.status(201).json({ id: ins.insertId, ...r })
})

// Admin & petugas dapat menghapus hasil klasifikasi.
router.delete('/results/:id', async (req, res) => {
  const id = parseId(req.params.id)
  const ins = id ? await query('DELETE FROM results WHERE id = ?', [id]) : { affectedRows: 0 }
  if (!ins.affectedRows) return res.status(404).json({ message: 'Laporan tidak ditemukan.' })
  res.json({ message: 'Laporan berhasil dihapus.' })
})

/* ----- Manajemen akun (hanya admin) ----- */

router.get('/users', requireAdmin, async (req, res) => {
  const rows = await query(
    "SELECT id, name, username, email, role, DATE_FORMAT(created_at, '%Y-%m-%d') AS createdAt FROM users ORDER BY id",
  )
  res.json(rows.map((u) => ({ ...toPublicUser(u), createdAt: u.createdAt })))
})

router.post('/users', requireAdmin, async (req, res) => {
  const { errors, value } = validateUserInput(req.body)
  if (Object.keys(errors).length) return res.status(400).json({ message: 'Data belum valid.', errors })
  try {
    const hash = await bcrypt.hash(value.password, 10)
    const ins = await query(
      'INSERT INTO users (name, username, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
      [value.name, value.username, value.email ?? null, hash, value.role],
    )
    res.status(201).json({ id: ins.insertId, name: value.name, username: value.username, email: value.email ?? null, role: value.role })
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Username atau email sudah terdaftar.' })
    throw err
  }
})

// Ubah akun: nama, username, email, peran, dan/atau kata sandi (untuk user yang lupa).
router.put('/users/:id', requireAdmin, async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(404).json({ message: 'Pengguna tidak ditemukan.' })
  const existing = await query('SELECT id FROM users WHERE id = ?', [id])
  if (!existing[0]) return res.status(404).json({ message: 'Pengguna tidak ditemukan.' })

  const { errors, value } = validateUserInput(req.body, { partial: true })
  if (Object.keys(errors).length) return res.status(400).json({ message: 'Data belum valid.', errors })
  if (id === req.user.id && value.role && value.role !== 'admin') {
    return res.status(400).json({ message: 'Anda tidak dapat menurunkan peran akun sendiri.' })
  }

  const sets = []
  const params = []
  if (value.name !== undefined) { sets.push('name = ?'); params.push(value.name) }
  if (value.username !== undefined) { sets.push('username = ?'); params.push(value.username) }
  if (value.email !== undefined) { sets.push('email = ?'); params.push(value.email) }
  if (value.role !== undefined) { sets.push('role = ?'); params.push(value.role) }
  if (value.password !== undefined) { sets.push('password_hash = ?'); params.push(await bcrypt.hash(value.password, 10)) }

  try {
    if (sets.length) {
      await query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, [...params, id])
    }
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Username atau email sudah dipakai akun lain.' })
    throw err
  }
  const rows = await query('SELECT id, name, username, email, role FROM users WHERE id = ?', [id])
  res.json(toPublicUser(rows[0]))
})

router.delete('/users/:id', requireAdmin, async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(404).json({ message: 'Pengguna tidak ditemukan.' })
  if (id === req.user.id) return res.status(400).json({ message: 'Anda tidak dapat menghapus akun sendiri.' })
  const ins = await query('DELETE FROM users WHERE id = ?', [id])
  if (!ins.affectedRows) return res.status(404).json({ message: 'Pengguna tidak ditemukan.' })
  res.json({ message: 'Akun berhasil dihapus.' })
})

/* ---------- Pemasangan rute ---------- */

app.use('/api', router)

app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Endpoint tidak ditemukan.' })
})

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Format data yang dikirim tidak valid.' })
  }
  const status = err.status || err.statusCode || 500
  if (status >= 500) console.error('[TumbuhRuang] Error:', err)
  res.status(status).json({
    message: status >= 500 ? 'Terjadi kesalahan pada server. Periksa koneksi database di file .env.' : err.message,
  })
})

export default app
