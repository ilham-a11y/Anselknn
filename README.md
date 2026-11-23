# TumbuhRuang v3 — Pemantauan Tumbuh Kembang Anak

Aplikasi untuk petugas posyandu dan admin:

- **Petugas posyandu**: input data anak (tambah, ubah, hapus), menjalankan klasifikasi K-NN, menyimpan dan mencetak hasil.
- **Admin**: mengelola akun (tambah, ubah termasuk reset kata sandi, hapus), melihat data anak dan hasil klasifikasi, serta menghapus data. Admin tidak dapat menambah atau mengubah data anak dan tidak dapat menjalankan klasifikasi.

Stack: React + TypeScript + Tailwind (frontend), Express (API), MySQL/MariaDB (database), Python + scikit-learn (pelatihan model, dijalankan terpisah).

## Akun awal

| Username | Kata sandi | Peran            |
|----------|------------|------------------|
| admin    | admin123   | Administrator    |
| user     | user123    | Petugas Posyandu |

Ganti kata sandi setelah pertama kali dijalankan (menu Kelola Akun).

## Model K-NN dan data latih

Data latih **tidak disimpan di database** dan **tidak ditampilkan atau bisa diubah dari aplikasi**. Model dilatih di luar aplikasi, lalu hasilnya disimpan di `server/model/knn_model.json`. Server membaca file ini saat berjalan. Tidak ada endpoint yang mengembalikan isi data latih, dan file ini tidak ikut dikirim ke browser.

Alur pelatihan (`model/train_model.py`) mengikuti kaidah yang benar:

1. Data dibaca dan divalidasi (kolom, kategori, dan kode motorik/bicara 1–3).
2. Data dibagi menjadi **80% latih dan 20% uji**, berstrata sehingga proporsi setiap kategori terjaga.
3. **Normalisasi min-max** dihitung **hanya dari data latih**, sehingga data uji tidak ikut memengaruhi pelatihan.
4. Nilai **K dipilih dengan validasi silang 5-fold** pada data latih saja. Normalisasi dihitung ulang di setiap fold agar tidak ada kebocoran data.
5. Model final dilatih dengan K terpilih.
6. Model dievaluasi **sekali** pada data uji: akurasi, presisi, recall, F1, dan matriks kebingungan, dibandingkan dengan baseline (selalu menebak kategori terbanyak).

### Data dummy

Data yang disertakan adalah **data dummy (sintetis)**, 150 baris dengan 50 baris per kategori, dibuat oleh `model/buat_data_dummy.py`. Data ini hanya untuk uji coba dan bukan data pasien nyata.

Untuk memakai data asli, buat CSV dengan kolom berikut (nama kolom harus persis sama):

```
age,weight,height,head,motor,speech,category
```

- `age`: usia dalam bulan
- `weight`: berat badan (kg), `height`: tinggi badan (cm), `head`: lingkar kepala (cm)
- `motor`, `speech`: kode 1, 2, atau 3
- `category`: `Normal`, `Risiko Sedang`, atau `Risiko Berat`

Lalu jalankan:

```
pip install numpy scikit-learn
python model/train_model.py --data model/data/data_saya.csv
```

Setelah model dilatih ulang, restart server agar model baru dimuat.

### Verifikasi

Untuk memastikan klasifikasi di server identik dengan hasil pelatihan Python:

```
npm run model:verify
```

Harus menampilkan `OK: JavaScript identik dengan Python.`

> Catatan: versi prototipe sebelumnya menghitung jarak tanpa normalisasi. Versi ini menormalisasi fitur, sehingga hasil klasifikasi bisa berbeda dari versi sebelumnya. Ini disengaja agar sesuai kaidah K-NN.

## Menjalankan di lokal dengan XAMPP

1. Nyalakan **MySQL** di XAMPP Control Panel.
2. Siapkan konfigurasi:
   ```
   copy .env.example .env
   ```
   (Di Linux/Mac gunakan `cp`.) Untuk XAMPP biasanya cukup `DB_USER=root` dan `DB_PASSWORD=` kosong. Isi `JWT_SECRET` dengan string acak.
3. Buat database dan tabel:
   - **phpMyAdmin** (http://localhost/phpmyadmin): tab *Import*, pilih `database/schema.sql`, lalu *Go*.
   - **Terminal**: `npm run db:init`

   > Peringatan: `schema.sql` menghapus tabel lama. Jika Anda sudah punya data dari versi sebelumnya, impor ulang akan menghapusnya.
4. Install, build, dan jalankan:
   ```
   npm install
   npm run build
   npm start
   ```
5. Buka http://localhost:3001 dan masuk.

Cek koneksi database: http://localhost:3001/api/health

### Mode pengembangan
```
npm run server   # API di port 3001
npm run dev      # frontend di http://localhost:5173
```

## Deploy ke Vercel (lanjutan)

XAMPP tidak bisa dihubungi dari Vercel. Gunakan database MySQL/MariaDB online (misalnya TiDB Cloud atau Aiven), impor `database/schema.sql` ke sana, lalu isi Environment Variables di Vercel: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL=true`, dan `JWT_SECRET`. Konfigurasi `vercel.json` belum diuji di Vercel.

## Struktur

```
api/index.js                  entry point Vercel
server/app.js                 rute API dan pembatasan peran
server/knn.js                 klasifikasi K-NN (membaca model)
server/model/knn_model.json   model terlatih (dibuat train_model.py)
server/auth.js                JWT, admin, dan petugas
server/index.js               server lokal (API + file dist)
database/schema.sql           tabel dan data awal (tanpa data latih)
model/buat_data_dummy.py      pembuat data dummy
model/train_model.py          pelatihan model dengan validasi silang
model/verifikasi_js.mjs       verifikasi JavaScript vs Python
model/data/                   data latih (CSV) dan berkas verifikasi
src/                          frontend React
```

## Catatan
- Hasil klasifikasi merupakan pendukung skrining awal dan bukan diagnosis medis.
- Pada halaman hasil, tetangga terdekat hanya ditampilkan sebagai peringkat, jarak, dan kategori. Nilai fitur data latih tidak ditampilkan.
- Data dummy tidak mewakili populasi nyata. Akurasi pada data dummy hanya menunjukkan bahwa pipeline berjalan dengan benar.
