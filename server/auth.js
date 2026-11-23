import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET || 'tumbuhruang-dev-secret'
if (!process.env.JWT_SECRET) {
  console.warn('[TumbuhRuang] JWT_SECRET belum diatur. Gunakan nilai acak yang panjang di file .env.')
}

export function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, name: user.name, username: user.username },
    SECRET,
    { expiresIn: '12h' },
  )
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ message: 'Silakan masuk terlebih dahulu.' })
  try {
    req.user = jwt.verify(token, SECRET)
    next()
  } catch {
    res.status(401).json({ message: 'Sesi telah berakhir. Silakan masuk kembali.' })
  }
}

// Hanya admin: mengelola akun pengguna.
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Hanya admin yang dapat mengakses fitur ini.' })
  }
  next()
}

// Hanya petugas posyandu: menambah & mengubah data anak, serta menjalankan klasifikasi.
export function requirePetugas(req, res, next) {
  if (req.user?.role !== 'petugas') {
    return res.status(403).json({ message: 'Fitur ini hanya untuk petugas posyandu. Admin hanya dapat melihat dan menghapus data.' })
  }
  next()
}
