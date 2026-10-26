/**
 * ADMINISTRASI GURU SD - Database Module
 * Skema, inisialisasi sheet, pemeliharaan data, dan fungsi CRUD berbasis Google Sheets.
 */

var DB_SCHEMA = {
  USERS: {
    name: 'USERS',
    headers: ['id_user', 'username', 'password_hash', 'salt', 'full_name', 'email', 'role', 'status', 'last_login', 'created_at', 'updated_at']
  },
  SEKOLAH: {
    name: 'SEKOLAH',
    headers: ['id_sekolah', 'npsn', 'nama_sekolah', 'alamat', 'desa_kelurahan', 'kecamatan', 'kabupaten_kota', 'provinsi', 'kode_pos', 'telepon', 'email', 'website', 'kepala_sekolah', 'nip_kepala_sekolah', 'updated_at']
  },
  TAHUN_PELAJARAN: {
    name: 'TAHUN_PELAJARAN',
    headers: ['id_tp', 'kode_tp', 'nama_tp', 'semester', 'is_active', 'tgl_mulai', 'tgl_selesai', 'created_at']
  },
  GURU: {
    name: 'GURU',
    headers: ['id_guru', 'id_user', 'nip', 'nuptk', 'nama_lengkap', 'gelar_depan', 'gelar_belakang', 'jenis_kelamin', 'tempat_lahir', 'tgl_lahir', 'no_hp', 'email', 'alamat', 'status_kepegawaian', 'jabatan', 'created_at', 'updated_at']
  },
  KELAS: {
    name: 'KELAS',
    headers: ['id_kelas', 'id_tp', 'tingkat', 'nama_kelas', 'id_guru_wali', 'kapasitas', 'status', 'created_at']
  },
  SISWA: {
    name: 'SISWA',
    headers: ['id_siswa', 'nis', 'nisn', 'nama_lengkap', 'jenis_kelamin', 'tempat_lahir', 'tgl_lahir', 'agama', 'nama_ayah', 'nama_ibu', 'no_hp_ortu', 'alamat', 'status', 'created_at', 'updated_at']
  },
  ANGGOTA_KELAS: {
    name: 'ANGGOTA_KELAS',
    headers: ['id_anggota', 'id_kelas', 'id_siswa', 'id_tp', 'nomor_absen', 'status', 'created_at']
  },
  MATA_PELAJARAN: {
    name: 'MATA_PELAJARAN',
    headers: ['id_mapel', 'kode_mapel', 'nama_mapel', 'kelompok', 'tingkat', 'kkm', 'status', 'created_at']
  },
  PENUGASAN_GURU: {
    name: 'PENUGASAN_GURU',
    headers: ['id_penugasan', 'id_tp', 'id_guru', 'id_kelas', 'id_mapel', 'peran_guru', 'status', 'created_at']
  },
  JADWAL: {
    name: 'JADWAL',
    headers: ['id_jadwal', 'id_tp', 'id_kelas', 'id_mapel', 'id_guru', 'hari', 'jam_ke_mulai', 'jam_ke_selesai', 'waktu_mulai', 'waktu_selesai', 'ruangan', 'status']
  },
  SESI_ABSENSI: {
    name: 'SESI_ABSENSI',
    headers: ['id_sesi', 'id_tp', 'id_kelas', 'tanggal', 'id_guru', 'waktu_buka', 'status', 'catatan']
  },
  ABSENSI: {
    name: 'ABSENSI',
    headers: ['id_absensi', 'id_sesi', 'id_anggota', 'id_siswa', 'status_kehadiran', 'waktu_catat', 'keterangan', 'id_pencatat']
  },
  PENILAIAN: {
    name: 'PENILAIAN',
    headers: ['id_penilaian', 'id_tp', 'id_kelas', 'id_mapel', 'id_guru', 'jenis_penilaian', 'kode_kd_tp', 'nama_penilaian', 'bobot', 'tgl_penilaian', 'status']
  },
  NILAI: {
    name: 'NILAI',
    headers: ['id_nilai', 'id_penilaian', 'id_siswa', 'skor', 'predikat', 'catatan', 'updated_at']
  },
  JURNAL_MENGAJAR: {
    name: 'JURNAL_MENGAJAR',
    headers: ['id_jurnal', 'id_tp', 'id_kelas', 'id_mapel', 'id_guru', 'tanggal', 'jam_ke', 'materi_kegiatan', 'hambatan', 'solusi', 'status_kehadiran_kelas', 'created_at']
  },
  DOKUMEN_GURU: {
    name: 'DOKUMEN_GURU',
    headers: ['id_dokumen', 'id_tp', 'id_guru', 'id_mapel', 'jenis_dokumen', 'judul', 'file_drive_id', 'file_url', 'status_verifikasi', 'created_at']
  },
  LOG_AKTIVITAS: {
    name: 'LOG_AKTIVITAS',
    headers: ['id_log', 'timestamp', 'id_user', 'username', 'role', 'action', 'ip_or_client', 'detail']
  }
};

/**
 * Membuka koneksi Spreadsheet database yang valid.
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet}
 */
function getDatabase() {
  var ssId = getSpreadsheetId();
  if (!ssId) {
    throw new Error('ID Spreadsheet belum dikonfigurasi. Silakan jalankan setupDatabase() atau simpan Script Property "SPREADSHEET_ID".');
  }
  try {
    return SpreadsheetApp.openById(ssId);
  } catch (err) {
    throw new Error('Gagal membuka spreadsheet dengan ID "' + ssId + '": ' + err.message);
  }
}

/**
 * Menyiapkan struktur database.
 * TIDAK membuat spreadsheet baru jika ID sudah dikonfigurasi.
 * TIDAK menghapus data yang sudah ada di sheet.
 * @param {string} [explicitSpreadsheetId] - ID spreadsheet jika ingin diarahkan ke file tertentu
 * @returns {object} Hasil inisialisasi
 */
function setupDatabase(explicitSpreadsheetId) {
  var ss;
  var ssId = explicitSpreadsheetId || getSpreadsheetId();

  if (ssId) {
    try {
      ss = SpreadsheetApp.openById(ssId);
      setSpreadsheetId(ssId);
    } catch (e) {
      Logger.log('Spreadsheet ID lama tidak dapat dibuka. Membuat baru...');
      ss = null;
    }
  }

  // Jika belum ada atau tidak valid, buat spreadsheet baru
  if (!ss) {
    ss = SpreadsheetApp.create('DB_ADMINISTRASI_GURU_SD');
    ssId = ss.getId();
    setSpreadsheetId(ssId);
  }

  var createdSheets = [];
  var existingSheets = [];

  // Iterasi semua tabel skema
  for (var key in DB_SCHEMA) {
    var def = DB_SCHEMA[key];
    var sheet = ss.getSheetByName(def.name);

    if (!sheet) {
      sheet = ss.insertSheet(def.name);
      // Tulis baris header
      sheet.getRange(1, 1, 1, def.headers.length).setValues([def.headers]);
      formatSheetHeader(sheet, def.headers.length);
      createdSheets.push(def.name);
    } else {
      existingSheets.push(def.name);
      // Pastikan header tetap ada tanpa menghapus data
      if (sheet.getLastRow() === 0) {
        sheet.getRange(1, 1, 1, def.headers.length).setValues([def.headers]);
        formatSheetHeader(sheet, def.headers.length);
      }
    }
  }

  // Hapus sheet default "Sheet1" atau "Sheet 1" jika sheet tabel sudah ada
  var defaultSheet1 = ss.getSheetByName('Sheet1') || ss.getSheetByName('Sheet 1');
  if (defaultSheet1 && ss.getSheets().length > 1) {
    try {
      ss.deleteSheet(defaultSheet1);
    } catch (e) {
      // Abaikan jika tidak diizinkan
    }
  }

  // Inisialisasi Akun Admin Default jika tabel USERS masih kosong (hanya header)
  var userSheet = ss.getSheetByName(CONFIG.SHEETS.USERS);
  if (userSheet && userSheet.getLastRow() <= 1) {
    var defaultAdminSalt = generateSalt();
    var defaultAdminPassword = 'AdminPassword123!';
    var defaultAdminHash = hashPassword(defaultAdminPassword, defaultAdminSalt);
    var nowStr = formatDateTime(new Date());

    userSheet.appendRow([
      'USR-' + Utilities.getUuid().substring(0, 8),
      'admin',
      defaultAdminHash,
      defaultAdminSalt,
      'Administrator Sekolah',
      'admin@sekolah.sch.id',
      CONFIG.ROLES.ADMIN,
      CONFIG.USER_STATUS.ACTIVE,
      '-',
      nowStr,
      nowStr
    ]);
  }

  // Inisialisasi profil SEKOLAH default jika masih kosong
  var sekolahSheet = ss.getSheetByName(CONFIG.SHEETS.SEKOLAH);
  if (sekolahSheet && sekolahSheet.getLastRow() <= 1) {
    sekolahSheet.appendRow([
      'SCH-001',
      '20100001',
      'SD NEGERI CONTOH 01',
      'Jl. Pendidikan No. 10',
      'Maju Jaya',
      'Cerdas',
      'Kota Pendidikan',
      'Jawa Barat',
      '40123',
      '021-1234567',
      'info@sdncontoh01.sch.id',
      'https://sdncontoh01.sch.id',
      'Budi Santoso, S.Pd., M.M.',
      '197501012000031001',
      formatDateTime(new Date())
    ]);
  }

  // Inisialisasi TAHUN_PELAJARAN aktif default jika kosong
  var tpSheet = ss.getSheetByName(CONFIG.SHEETS.TAHUN_PELAJARAN);
  if (tpSheet && tpSheet.getLastRow() <= 1) {
    tpSheet.appendRow([
      'TP-20261',
      '2026/2027-1',
      '2026/2027',
      'Ganjil',
      'TRUE',
      '2026-07-15',
      '2026-12-20',
      formatDateTime(new Date())
    ]);
  }

  // Catat inisialisasi di LOG_AKTIVITAS
  logActivity('SYSTEM', 'SETUP', 'SYSTEM', 'SETUP_DATABASE', 'Server', 'Inisialisasi database berhasil.');

  return {
    success: true,
    spreadsheetId: ssId,
    spreadsheetUrl: ss.getUrl(),
    createdSheets: createdSheets,
    existingSheets: existingSheets,
    message: 'Struktur database berhasil disiapkan tanpa menghapus data yang telah ada.'
  };
}

/**
 * Memberikan format visual profesional pada baris header sheet.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {number} colCount
 */
function formatSheetHeader(sheet, colCount) {
  var headerRange = sheet.getRange(1, 1, 1, colCount);
  headerRange.setBackground('#1e3a8a') // Deep Blue Navy
             .setFontColor('#ffffff')
             .setFontWeight('bold')
             .setFontFamily('Arial')
             .setHorizontalAlignment('center')
             .setVerticalAlignment('middle');
  sheet.setRowHeight(1, 36);
  sheet.setFrozenRows(1);
}

/**
 * Mengambil semua data dari sebuah sheet sebagai array of objects berdasarkan header.
 * @param {string} sheetName
 * @returns {Array<object>}
 */
function getSheetDataAsObjects(sheetName) {
  var ss = getDatabase();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Sheet "' + sheetName + '" tidak ditemukan.');
  }

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow <= 1 || lastCol === 0) {
    return [];
  }

  var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = values[0];
  var result = [];

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var obj = { _rowIndex: i + 1 };
    for (var j = 0; j < headers.length; j++) {
      var header = headers[j];
      if (header) {
        obj[header] = row[j];
      }
    }
    result.push(obj);
  }

  return result;
}

/**
 * Mencari satu record berdasarkan nama kolom dan nilai yang dicari.
 * @param {string} sheetName
 * @param {string} fieldName
 * @param {any} value
 * @returns {object|null}
 */
function findRecordByField(sheetName, fieldName, value) {
  var data = getSheetDataAsObjects(sheetName);
  var targetVal = String(value).toLowerCase().trim();

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    if (String(row[fieldName]).toLowerCase().trim() === targetVal) {
      return row;
    }
  }
  return null;
}

/**
 * Menambahkan data baru ke sheet.
 * @param {string} sheetName
 * @param {object} record
 * @returns {boolean}
 */
function appendRecord(sheetName, record) {
  var ss = getDatabase();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet "' + sheetName + '" tidak ditemukan.');

  var def = DB_SCHEMA[sheetName];
  if (!def) throw new Error('Definisi skema untuk "' + sheetName + '" tidak ditemukan.');

  var rowValues = [];
  for (var i = 0; i < def.headers.length; i++) {
    var header = def.headers[i];
    rowValues.push(record[header] !== undefined ? record[header] : '');
  }

  sheet.appendRow(rowValues);
  return true;
}

/**
 * Memperbarui record berdasarkan baris dan field yang ditentukan.
 * @param {string} sheetName
 * @param {number} rowIndex
 * @param {object} updatedFields
 * @returns {boolean}
 */
function updateRecordByRowIndex(sheetName, rowIndex, updatedFields) {
  var ss = getDatabase();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet "' + sheetName + '" tidak ditemukan.');

  var def = DB_SCHEMA[sheetName];
  if (!def) throw new Error('Definisi skema untuk "' + sheetName + '" tidak ditemukan.');

  var headers = def.headers;
  for (var key in updatedFields) {
    var colIdx = headers.indexOf(key);
    if (colIdx !== -1) {
      sheet.getRange(rowIndex, colIdx + 1).setValue(updatedFields[key]);
    }
  }
  return true;
}

/**
 * Menghitung jumlah baris data dalam sebuah sheet.
 * @param {string} sheetName
 * @returns {number}
 */
function countRecords(sheetName) {
  var ss = getDatabase();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return 0;
  var lastRow = sheet.getLastRow();
  return lastRow > 1 ? lastRow - 1 : 0;
}
