-- ============================================================
-- TumbuhRuang — skema database (MySQL / MariaDB, termasuk XAMPP)
--
-- Data latih TIDAK disimpan di database. Model K-NN berada di
-- server/model/knn_model.json dan dilatih lewat model/train_model.py.
--
-- Cara pakai:
--   1. Nyalakan MySQL di XAMPP Control Panel.
--   2. phpMyAdmin (http://localhost/phpmyadmin) > Import > pilih file ini > Go.
--   atau dari terminal:  npm run db:init
--
-- PERHATIAN: file ini menghapus tabel lama (termasuk data anak dan hasil).
-- ============================================================

CREATE DATABASE IF NOT EXISTS tumbuhruang CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE tumbuhruang;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS results;
DROP TABLE IF EXISTS children;
DROP TABLE IF EXISTS training_data;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

-- Akun pengguna (admin & petugas posyandu)
CREATE TABLE users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  username VARCHAR(30) NOT NULL UNIQUE,
  email VARCHAR(120) NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  role ENUM('admin', 'petugas') NOT NULL DEFAULT 'petugas',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Data anak
CREATE TABLE children (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  age INT UNSIGNED NOT NULL,
  gender ENUM('Perempuan', 'Laki-laki') NOT NULL,
  weight DECIMAL(5,2) NOT NULL,
  height DECIMAL(5,1) NOT NULL,
  head DECIMAL(4,1) NOT NULL,
  motor TINYINT UNSIGNED NOT NULL,
  speech TINYINT UNSIGNED NOT NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_children_name (name),
  CONSTRAINT fk_children_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Riwayat hasil klasifikasi (data anak disalin agar laporan tetap akurat)
CREATE TABLE results (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  child_id INT UNSIGNED NOT NULL,
  child_name VARCHAR(120) NOT NULL,
  age INT UNSIGNED NOT NULL,
  gender ENUM('Perempuan', 'Laki-laki') NOT NULL,
  weight DECIMAL(5,2) NOT NULL,
  height DECIMAL(5,1) NOT NULL,
  head DECIMAL(4,1) NOT NULL,
  motor TINYINT UNSIGNED NOT NULL,
  speech TINYINT UNSIGNED NOT NULL,
  exam_date DATE NOT NULL,
  category ENUM('Normal', 'Risiko Sedang', 'Risiko Berat') NOT NULL,
  k TINYINT UNSIGNED NOT NULL DEFAULT 7,
  votes LONGTEXT NOT NULL,
  neighbors LONGTEXT NOT NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_results_child (child_id),
  CONSTRAINT fk_results_child FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
  CONSTRAINT fk_results_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------- DATA AWAL ----------------

-- Akun awal. Ganti kata sandi setelah aplikasi dijalankan.
INSERT INTO users (id, name, username, email, password_hash, role) VALUES
  (1, 'Administrator', 'admin', 'admin@tumbuhruang.local', '$2b$10$HF/EQB2Kjv15io59N6k16u7/hj6/I6UcHerJLsoTwRueXhEARu8cm', 'admin'),
  (2, 'Nadia Sari', 'user', 'nadia@tumbuhruang.local', '$2b$10$9AwdOdbq75aWY.GwY26eM.EM0jU6R7rgJj5hGq8htIJWQFsgcxk.W', 'petugas');

INSERT INTO children (id, name, age, gender, weight, height, head, motor, speech, created_by) VALUES
  (1, 'Alya Putri', 28, 'Perempuan', 12.1, 88, 49, 3, 3, 1),
  (2, 'Bima Pratama', 36, 'Laki-laki', 12.4, 91, 49.5, 2, 2, 1),
  (3, 'Citra Lestari', 42, 'Perempuan', 12, 92, 48, 2, 1, 1),
  (4, 'Damar Aji', 24, 'Laki-laki', 11.3, 84, 48.5, 3, 3, 1),
  (5, 'Elina Maharani', 31, 'Perempuan', 10.2, 86, 47, 1, 2, 1);

INSERT INTO results (child_id, child_name, age, gender, weight, height, head, motor, speech, exam_date, category, k, votes, neighbors, created_by) VALUES (1, 'Alya Putri', 28, 'Perempuan', 12.1, 88, 49, 3, 3, '2025-06-18', 'Normal', 9, '{"Normal":9,"Risiko Sedang":0,"Risiko Berat":0}', '[{"rank":1,"distance":0.19305797449181616,"category":"Normal"},{"rank":2,"distance":0.23260183752603952,"category":"Normal"},{"rank":3,"distance":0.27763545450082167,"category":"Normal"},{"rank":4,"distance":0.27778714296035834,"category":"Normal"},{"rank":5,"distance":0.28430516297390923,"category":"Normal"},{"rank":6,"distance":0.2912315851246499,"category":"Normal"},{"rank":7,"distance":0.29294971876999143,"category":"Normal"},{"rank":8,"distance":0.29976553555047697,"category":"Normal"},{"rank":9,"distance":0.3187275856957857,"category":"Normal"}]', 1);
INSERT INTO results (child_id, child_name, age, gender, weight, height, head, motor, speech, exam_date, category, k, votes, neighbors, created_by) VALUES (2, 'Bima Pratama', 36, 'Laki-laki', 12.4, 91, 49.5, 2, 2, '2025-06-17', 'Risiko Sedang', 9, '{"Normal":1,"Risiko Sedang":8,"Risiko Berat":0}', '[{"rank":1,"distance":0.24912176133002767,"category":"Risiko Sedang"},{"rank":2,"distance":0.276752022348929,"category":"Risiko Sedang"},{"rank":3,"distance":0.28294493724675457,"category":"Risiko Sedang"},{"rank":4,"distance":0.2887122875904539,"category":"Risiko Sedang"},{"rank":5,"distance":0.34556797060362493,"category":"Risiko Sedang"},{"rank":6,"distance":0.3752810402727637,"category":"Risiko Sedang"},{"rank":7,"distance":0.39080858438586535,"category":"Risiko Sedang"},{"rank":8,"distance":0.40211911253797383,"category":"Risiko Sedang"},{"rank":9,"distance":0.5119810725496118,"category":"Normal"}]', 1);
INSERT INTO results (child_id, child_name, age, gender, weight, height, head, motor, speech, exam_date, category, k, votes, neighbors, created_by) VALUES (3, 'Citra Lestari', 42, 'Perempuan', 12, 92, 48, 2, 1, '2025-06-16', 'Risiko Berat', 9, '{"Normal":0,"Risiko Sedang":3,"Risiko Berat":6}', '[{"rank":1,"distance":0.2198962337262054,"category":"Risiko Berat"},{"rank":2,"distance":0.24175886569618377,"category":"Risiko Berat"},{"rank":3,"distance":0.4655603517115015,"category":"Risiko Berat"},{"rank":4,"distance":0.505453969443679,"category":"Risiko Berat"},{"rank":5,"distance":0.5074770345575302,"category":"Risiko Berat"},{"rank":6,"distance":0.5174590450733924,"category":"Risiko Sedang"},{"rank":7,"distance":0.5182200986319186,"category":"Risiko Sedang"},{"rank":8,"distance":0.5323690691012049,"category":"Risiko Berat"},{"rank":9,"distance":0.5384974284052211,"category":"Risiko Sedang"}]', 1);
INSERT INTO results (child_id, child_name, age, gender, weight, height, head, motor, speech, exam_date, category, k, votes, neighbors, created_by) VALUES (4, 'Damar Aji', 24, 'Laki-laki', 11.3, 84, 48.5, 3, 3, '2025-06-14', 'Normal', 9, '{"Normal":9,"Risiko Sedang":0,"Risiko Berat":0}', '[{"rank":1,"distance":0.20717835866881545,"category":"Normal"},{"rank":2,"distance":0.30244659970097815,"category":"Normal"},{"rank":3,"distance":0.3198936017973098,"category":"Normal"},{"rank":4,"distance":0.3244984021607604,"category":"Normal"},{"rank":5,"distance":0.32479811439426104,"category":"Normal"},{"rank":6,"distance":0.3269030726825336,"category":"Normal"},{"rank":7,"distance":0.34894007466699783,"category":"Normal"},{"rank":8,"distance":0.39089716572471656,"category":"Normal"},{"rank":9,"distance":0.3991453683599327,"category":"Normal"}]', 1);
