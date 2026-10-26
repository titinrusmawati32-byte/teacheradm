/**
 * ============================================================================
 * ADMINISTRASI GURU SD - ALL-IN-ONE BACKEND (Code.gs)
 * ============================================================================
 * File tunggal untuk Google Apps Script yang menangani:
 * 1. Auto-generate Database Google Sheets (17 Sheet) secara otomatis
 * 2. Autentikasi Pengguna (SHA-256 + Salt, Token Sesi di CacheService, Rate Limit)
 * 3. API REST / JSON untuk dihubungkan dengan Frontend di GitHub Pages
 * ============================================================================
 */

// --- 1. KONFIGURASI SISTEM ---
var CONFIG = {
  APP_NAME: 'ADMINISTRASI GURU SD',
  VERSION: '1.0.0-standalone',
  TIMEZONE: 'Asia/Jakarta',
  SESSION_DURATION: 21600, // 6 jam (maksimal CacheService Apps Script)
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION: 900, // 15 menit
  ROLES: { ADMIN: 'ADMIN', GURU: 'GURU' },
  STATUS: { ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE' },
  SHEETS: {
    USERS: 'USERS',
    SEKOLAH: 'SEKOLAH',
    TAHUN_PELAJARAN: 'TAHUN_PELAJARAN',
    GURU: 'GURU',
    KELAS: 'KELAS',
    SISWA: 'SISWA',
    ANGGOTA_KELAS: 'ANGGOTA_KELAS',
    MATA_PELAJARAN: 'MATA_PELAJARAN',
    PENUGASAN_GURU: 'PENUGASAN_GURU',
    JADWAL: 'JADWAL',
    SESI_ABSENSI: 'SESI_ABSENSI',
    ABSENSI: 'ABSENSI',
    PENILAIAN: 'PENILAIAN',
    NILAI: 'NILAI',
    JURNAL_MENGAJAR: 'JURNAL_MENGAJAR',
    DOKUMEN_GURU: 'DOKUMEN_GURU',
    LOG_AKTIVITAS: 'LOG_AKTIVITAS'
  }
};

// Skema 17 Tabel Relasional Database
var DB_SCHEMA = {
  USERS: ['id_user', 'username', 'password_hash', 'salt', 'full_name', 'email', 'role', 'status', 'last_login', 'created_at', 'updated_at'],
  SEKOLAH: ['id_sekolah', 'npsn', 'nama_sekolah', 'alamat', 'desa_kelurahan', 'kecamatan', 'kabupaten_kota', 'provinsi', 'kode_pos', 'telepon', 'email', 'website', 'kepala_sekolah', 'nip_kepala_sekolah', 'updated_at'],
  TAHUN_PELAJARAN: ['id_tp', 'kode_tp', 'nama_tp', 'semester', 'is_active', 'tgl_mulai', 'tgl_selesai', 'created_at'],
  GURU: ['id_guru', 'id_user', 'nip', 'nuptk', 'nama_lengkap', 'gelar_depan', 'gelar_belakang', 'jenis_kelamin', 'tempat_lahir', 'tgl_lahir', 'no_hp', 'email', 'alamat', 'status_kepegawaian', 'jabatan', 'created_at', 'updated_at'],
  KELAS: ['id_kelas', 'id_tp', 'tingkat', 'nama_kelas', 'id_guru_wali', 'kapasitas', 'status', 'created_at'],
  SISWA: ['id_siswa', 'nis', 'nisn', 'nama_lengkap', 'jenis_kelamin', 'tempat_lahir', 'tgl_lahir', 'agama', 'nama_ayah', 'nama_ibu', 'no_hp_ortu', 'alamat', 'status', 'created_at', 'updated_at'],
  ANGGOTA_KELAS: ['id_anggota', 'id_kelas', 'id_siswa', 'id_tp', 'nomor_absen', 'status', 'created_at'],
  MATA_PELAJARAN: ['id_mapel', 'kode_mapel', 'nama_mapel', 'kelompok', 'tingkat', 'kkm', 'status', 'created_at'],
  PENUGASAN_GURU: ['id_penugasan', 'id_tp', 'id_guru', 'id_kelas', 'id_mapel', 'peran_guru', 'status', 'created_at'],
  JADWAL: ['id_jadwal', 'id_tp', 'id_kelas', 'id_mapel', 'id_guru', 'hari', 'jam_ke_mulai', 'jam_ke_selesai', 'waktu_mulai', 'waktu_selesai', 'ruangan', 'status'],
  SESI_ABSENSI: ['id_sesi', 'id_tp', 'id_kelas', 'tanggal', 'id_guru', 'waktu_buka', 'status', 'catatan'],
  ABSENSI: ['id_absensi', 'id_sesi', 'id_anggota', 'id_siswa', 'status_kehadiran', 'waktu_catat', 'keterangan', 'id_pencatat'],
  PENILAIAN: ['id_penilaian', 'id_tp', 'id_kelas', 'id_mapel', 'id_guru', 'jenis_penilaian', 'kode_kd_tp', 'nama_penilaian', 'bobot', 'tgl_penilaian', 'status'],
  NILAI: ['id_nilai', 'id_penilaian', 'id_siswa', 'skor', 'predikat', 'catatan', 'updated_at'],
  JURNAL_MENGAJAR: ['id_jurnal', 'id_tp', 'id_kelas', 'id_mapel', 'id_guru', 'tanggal', 'jam_ke', 'materi_kegiatan', 'hambatan', 'solusi', 'status_kehadiran_kelas', 'created_at'],
  DOKUMEN_GURU: ['id_dokumen', 'id_tp', 'id_guru', 'id_mapel', 'jenis_dokumen', 'judul', 'file_drive_id', 'file_url', 'status_verifikasi', 'created_at'],
  LOG_AKTIVITAS: ['id_log', 'timestamp', 'id_user', 'username', 'role', 'action', 'ip_or_client', 'detail']
};

// --- 2. AUTO-PROVISIONING DATABASE GOOGLE SHEETS ---

/**
 * Mengambil atau OTOMATIS MEMBUAT Spreadsheet Database jika belum ada.
 * Mendukung Container-Bound Script (Ekstensi > Apps Script) maupun Standalone Script.
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet}
 */
function getOrCreateDatabase() {
  // 1. Jika dijalankan langsung dari Spreadsheet (Ekstensi > Apps Script)
  try {
    var activeSs = SpreadsheetApp.getActiveSpreadsheet();
    if (activeSs) {
      var props = PropertiesService.getScriptProperties();
      if (!props.getProperty('SPREADSHEET_ID')) {
        props.setProperty('SPREADSHEET_ID', activeSs.getId());
      }
      return activeSs;
    }
  } catch (e) {}

  // 2. Jika Standalone: Ambil dari Script Properties
  var props = PropertiesService.getScriptProperties();
  var ssId = props.getProperty('SPREADSHEET_ID');
  var ss = null;

  if (ssId) {
    try {
      ss = SpreadsheetApp.openById(ssId);
    } catch (e) {
      ss = null; // ID tidak valid / terhapus
    }
  }

  // 3. Jika belum ada, BUAT OTOMATIS spreadsheet baru di Google Drive!
  if (!ss) {
    ss = SpreadsheetApp.create('DB_ADMINISTRASI_GURU_SD');
    ssId = ss.getId();
    props.setProperty('SPREADSHEET_ID', ssId);
    setupDatabaseStructure(ss);
  }

  return ss;
}

/**
 * Menyiapkan 17 sheet tabel dan data awal tanpa menghapus data yang ada.
 */
function setupDatabaseStructure(ss) {
  for (var sheetName in DB_SCHEMA) {
    var headers = DB_SCHEMA[sheetName];
    var sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      formatSheetHeader(sheet, headers.length);
    } else if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      formatSheetHeader(sheet, headers.length);
    }
  }

  // Hapus Sheet1 default jika sheet lain sudah ada
  var defaultSheet = ss.getSheetByName('Sheet1') || ss.getSheetByName('Sheet 1');
  if (defaultSheet && ss.getSheets().length > 1) {
    try { ss.deleteSheet(defaultSheet); } catch (e) {}
  }

  // Buat akun Administrator awal jika USERS masih kosong
  var userSheet = ss.getSheetByName(CONFIG.SHEETS.USERS);
  if (userSheet && userSheet.getLastRow() <= 1) {
    var adminSalt = Utilities.getUuid();
    var adminHash = hashPassword('AdminPassword123!', adminSalt);
    var nowStr = formatDateTime(new Date());

    userSheet.appendRow([
      'USR-' + Utilities.getUuid().substring(0, 8),
      'admin',
      adminHash,
      adminSalt,
      'Administrator Sekolah',
      'admin@sekolah.sch.id',
      CONFIG.ROLES.ADMIN,
      CONFIG.STATUS.ACTIVE,
      '-',
      nowStr,
      nowStr
    ]);
  }

  // Buat data Profil Sekolah default jika kosong
  var sekolahSheet = ss.getSheetByName(CONFIG.SHEETS.SEKOLAH);
  if (sekolahSheet && sekolahSheet.getLastRow() <= 1) {
    sekolahSheet.appendRow([
      'SCH-001', '20100001', 'SD NEGERI CONTOH 01', 'Jl. Pendidikan No. 10',
      'Maju Jaya', 'Cerdas', 'Kota Pendidikan', 'Jawa Barat', '40123',
      '021-1234567', 'info@sdncontoh01.sch.id', 'https://sdncontoh01.sch.id',
      'Budi Santoso, S.Pd., M.M.', '197501012000031001', formatDateTime(new Date())
    ]);
  }

  // Buat Tahun Pelajaran aktif default jika kosong
  var tpSheet = ss.getSheetByName(CONFIG.SHEETS.TAHUN_PELAJARAN);
  if (tpSheet && tpSheet.getLastRow() <= 1) {
    tpSheet.appendRow([
      'TP-20261', '2026/2027-1', '2026/2027', 'Ganjil', 'TRUE',
      '2026-07-15', '2026-12-20', formatDateTime(new Date())
    ]);
  }
}

function formatSheetHeader(sheet, colCount) {
  sheet.getRange(1, 1, 1, colCount)
    .setBackground('#1e3a8a')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setFontFamily('Arial')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sheet.setRowHeight(1, 35);
  sheet.setFrozenRows(1);
}

// --- 3. API GATEWAY UTAMA (doGet & doPost) ---

function doGet(e) {
  return handleApiRequest(e);
}

function doPost(e) {
  return handleApiRequest(e);
}

function handleApiRequest(e) {
  var response;

  try {
    // Pastikan database siap digunakan secara otomatis
    var db = getOrCreateDatabase();

    var params = {};
    if (e && e.postData && e.postData.contents) {
      try {
        params = JSON.parse(e.postData.contents);
      } catch (errJson) {
        params = e.parameter || {};
      }
    } else if (e && e.parameter) {
      params = e.parameter;
    }

    var action = params.action || (e && e.parameter && e.parameter.action) || 'ping';

    switch (action) {
      case 'ping':
        response = createResponse(true, {
          status: 'online',
          appName: CONFIG.APP.NAME,
          version: CONFIG.APP.VERSION,
          databaseId: db.getId(),
          databaseUrl: db.getUrl(),
          serverTime: formatDateTime(new Date())
        });
        break;

      case 'setupDatabase':
        setupDatabaseStructure(db);
        response = createResponse(true, {
          message: 'Database berhasil diverifikasi dan disiapkan.',
          databaseUrl: db.getUrl(),
          databaseId: db.getId()
        });
        break;

      case 'login':
        response = handleLogin(params.username, params.password);
        break;

      case 'logout':
        response = handleLogout(params.token);
        break;

      case 'verifySession':
        var authCheck = verifySession(params.token);
        response = authCheck.valid ? createResponse(true, authCheck.session) : createResponse(false, authCheck.error);
        break;

      case 'getAdminDashboard':
        response = handleGetAdminDashboard(params.token);
        break;

      case 'getUsersList':
        response = handleGetUsersList(params.token);
        break;

      case 'createUser':
        response = handleCreateUser(params.token, params.userData || params);
        break;

      case 'updateUserStatus':
        response = handleUpdateUserStatus(params.token, params.userId, params.status);
        break;

      case 'getGuruDashboard':
        response = handleGetGuruDashboard(params.token);
        break;

      case 'getGuruClasses':
        response = handleGetGuruClasses(params.token);
        break;

      case 'triggerPhase2Feature':
        response = { success: false, inDevelopment: true, message: 'Fitur sedang dalam pengembangan (Fase 2).' };
        break;

      default:
        response = createResponse(false, 'Aksi tidak dikenali: ' + action);
    }
  } catch (errGlobal) {
    response = createResponse(false, 'Kesalahan server: ' + errGlobal.message);
  }

  // Mengembalikan JSON standar dengan MIME type JSON
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

// --- 4. LOGIKA AUTENTIKASI (AUTH) ---

function handleLogin(username, password) {
  var cleanUsername = sanitize(username).toLowerCase();
  var cleanPassword = sanitize(password);

  if (!cleanUsername || !cleanPassword) {
    return createResponse(false, 'Username dan kata sandi wajib diisi.');
  }

  // Rate Limiting
  var cache = CacheService.getScriptCache();
  var rateKey = 'ratelimit_' + cleanUsername;
  var attempts = parseInt(cache.get(rateKey) || '0', 10);
  if (attempts >= CONFIG.MAX_LOGIN_ATTEMPTS) {
    return createResponse(false, 'Akun terkunci sementara karena terlalu banyak percobaan gagal. Coba lagi dalam 15 menit.');
  }

  var users = getSheetObjects(CONFIG.SHEETS.USERS);
  var user = null;
  for (var i = 0; i < users.length; i++) {
    if (String(users[i].username).toLowerCase().trim() === cleanUsername) {
      user = users[i];
      break;
    }
  }

  if (!user) {
    cache.put(rateKey, String(attempts + 1), CONFIG.LOCKOUT_DURATION);
    return createResponse(false, 'Username atau kata sandi tidak valid.');
  }

  if (user.status !== CONFIG.STATUS.ACTIVE) {
    return createResponse(false, 'Akun Anda berstatus nonaktif. Silakan hubungi Administrator.');
  }

  // Verifikasi hash SHA-256 + Salt
  var computedHash = hashPassword(cleanPassword, user.salt);
  if (computedHash !== user.password_hash) {
    cache.put(rateKey, String(attempts + 1), CONFIG.LOCKOUT_DURATION);
    return createResponse(false, 'Username atau kata sandi tidak valid.');
  }

  // Login berhasil -> reset counter kegagalan
  cache.remove(rateKey);

  // Buat Session Token aman dan simpan di CacheService (6 jam)
  var token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  var session = {
    userId: user.id_user,
    username: user.username,
    fullName: user.full_name,
    email: user.email,
    role: user.role
  };
  cache.put('sess_' + token, JSON.stringify(session), CONFIG.SESSION_DURATION);

  // Perbarui timestamp login di USERS
  try {
    var ss = getOrCreateDatabase();
    var sheet = ss.getSheetByName(CONFIG.SHEETS.USERS);
    sheet.getRange(user._rowIndex, 9).setValue(formatDateTime(new Date()));
  } catch (e) {}

  logActivity(user.id_user, user.username, user.role, 'LOGIN_SUCCESS', 'Frontend', 'Pengguna berhasil masuk.');

  return createResponse(true, {
    token: token,
    user: session
  });
}

function handleLogout(token) {
  if (token) {
    var cache = CacheService.getScriptCache();
    cache.remove('sess_' + token);
  }
  return createResponse(true, 'Logout berhasil.');
}

function verifySession(token, requiredRole) {
  if (!token) return { valid: false, error: 'Token sesi tidak ditemukan.' };
  var cache = CacheService.getScriptCache();
  var raw = cache.get('sess_' + token);
  if (!raw) return { valid: false, error: 'Sesi Anda telah kedaluwarsa. Silakan login kembali.' };

  var session = JSON.parse(raw);
  if (requiredRole && session.role !== requiredRole && session.role !== CONFIG.ROLES.ADMIN) {
    return { valid: false, error: 'Akses ditolak. Peran tidak sesuai.' };
  }
  return { valid: true, session: session };
}

// --- 5. LOGIKA ADMINISTRATOR ---

function handleGetAdminDashboard(token) {
  var auth = verifySession(token, CONFIG.ROLES.ADMIN);
  if (!auth.valid) return createResponse(false, auth.error);

  var ss = getOrCreateDatabase();
  var countRow = function(name) {
    var s = ss.getSheetByName(name);
    return s ? Math.max(0, s.getLastRow() - 1) : 0;
  };

  var sekolahList = getSheetObjects(CONFIG.SHEETS.SEKOLAH);
  var sekolah = sekolahList.length > 0 ? sekolahList[0] : { nama_sekolah: 'SD Negeri' };

  var tpList = getSheetObjects(CONFIG.SHEETS.TAHUN_PELAJARAN);
  var tpAktif = tpList.length > 0 ? tpList[0].nama_tp + ' - ' + tpList[0].semester : '2026/2027 Ganjil';

  var logs = getSheetObjects(CONFIG.SHEETS.LOG_AKTIVITAS);
  var recentLogs = [];
  var start = Math.max(0, logs.length - 6);
  for (var i = logs.length - 1; i >= start; i--) {
    recentLogs.push({
      timestamp: logs[i].timestamp,
      username: logs[i].username,
      role: logs[i].role,
      action: logs[i].action,
      detail: logs[i].detail
    });
  }

  return createResponse(true, {
    stats: {
      totalGuru: countRow(CONFIG.SHEETS.GURU),
      totalSiswa: countRow(CONFIG.SHEETS.SISWA),
      totalKelas: countRow(CONFIG.SHEETS.KELAS),
      totalMapel: countRow(CONFIG.SHEETS.MATA_PELAJARAN)
    },
    sekolah: { nama: sekolah.nama_sekolah, npsn: sekolah.npsn },
    tahunPelajaran: tpAktif,
    recentLogs: recentLogs
  });
}

function handleGetUsersList(token) {
  var auth = verifySession(token, CONFIG.ROLES.ADMIN);
  if (!auth.valid) return createResponse(false, auth.error);

  var users = getSheetObjects(CONFIG.SHEETS.USERS);
  var sanitized = [];
  for (var i = 0; i < users.length; i++) {
    sanitized.push({
      id_user: users[i].id_user,
      username: users[i].username,
      full_name: users[i].full_name,
      email: users[i].email,
      role: users[i].role,
      status: users[i].status,
      last_login: users[i].last_login
    });
  }
  return createResponse(true, sanitized);
}

function handleCreateUser(token, userData) {
  var auth = verifySession(token, CONFIG.ROLES.ADMIN);
  if (!auth.valid) return createResponse(false, auth.error);

  var username = sanitize(userData.username).toLowerCase();
  var password = sanitize(userData.password);
  var fullName = sanitize(userData.full_name);
  var role = sanitize(userData.role).toUpperCase();

  if (!username || username.length < 3) return createResponse(false, 'Username minimal 3 karakter.');
  if (!password || password.length < 8) return createResponse(false, 'Kata sandi minimal 8 karakter.');
  if (!fullName) return createResponse(false, 'Nama lengkap wajib diisi.');

  var users = getSheetObjects(CONFIG.SHEETS.USERS);
  for (var i = 0; i < users.length; i++) {
    if (String(users[i].username).toLowerCase() === username) {
      return createResponse(false, 'Username "' + username + '" sudah digunakan.');
    }
  }

  var salt = Utilities.getUuid();
  var hash = hashPassword(password, salt);
  var newUserId = 'USR-' + Utilities.getUuid().substring(0, 8);
  var now = formatDateTime(new Date());

  var ss = getOrCreateDatabase();
  var userSheet = ss.getSheetByName(CONFIG.SHEETS.USERS);
  userSheet.appendRow([
    newUserId, username, hash, salt, fullName,
    sanitize(userData.email) || '-', role, CONFIG.STATUS.ACTIVE, '-', now, now
  ]);

  if (role === CONFIG.ROLES.GURU) {
    var guruSheet = ss.getSheetByName(CONFIG.SHEETS.GURU);
    guruSheet.appendRow([
      'GRU-' + Utilities.getUuid().substring(0, 8), newUserId,
      sanitize(userData.nip) || '-', sanitize(userData.nuptk) || '-',
      fullName, '', '', 'L', '-', '-', sanitize(userData.no_hp) || '-',
      sanitize(userData.email) || '-', '-', 'Guru', 'Guru', now, now
    ]);
  }

  logActivity(auth.session.userId, auth.session.username, auth.session.role, 'CREATE_USER', 'AdminPanel', 'Membuat user: ' + username + ' (' + role + ')');
  return createResponse(true, 'Pengguna "' + username + '" berhasil dibuat.');
}

function handleUpdateUserStatus(token, userId, status) {
  var auth = verifySession(token, CONFIG.ROLES.ADMIN);
  if (!auth.valid) return createResponse(false, auth.error);

  if (auth.session.userId === userId) {
    return createResponse(false, 'Anda tidak dapat mengubah status akun sendiri.');
  }

  var users = getSheetObjects(CONFIG.SHEETS.USERS);
  var user = null;
  for (var i = 0; i < users.length; i++) {
    if (users[i].id_user === userId) {
      user = users[i];
      break;
    }
  }
  if (!user) return createResponse(false, 'Pengguna tidak ditemukan.');

  var ss = getOrCreateDatabase();
  var sheet = ss.getSheetByName(CONFIG.SHEETS.USERS);
  sheet.getRange(user._rowIndex, 8).setValue(status);
  return createResponse(true, 'Status berhasil diperbarui.');
}

// --- 6. LOGIKA GURU ---

function handleGetGuruDashboard(token) {
  var auth = verifySession(token, CONFIG.ROLES.GURU);
  if (!auth.valid) return createResponse(false, auth.error);

  var guruList = getSheetObjects(CONFIG.SHEETS.GURU);
  var guru = null;
  for (var i = 0; i < guruList.length; i++) {
    if (guruList[i].id_user === auth.session.userId) {
      guru = guruList[i];
      break;
    }
  }

  var kelasList = getSheetObjects(CONFIG.SHEETS.KELAS);
  var assignedClasses = [];
  if (guru) {
    for (var k = 0; k < kelasList.length; k++) {
      if (kelasList[k].id_guru_wali === guru.id_guru) {
        assignedClasses.push({
          id_kelas: kelasList[k].id_kelas,
          nama_kelas: kelasList[k].nama_kelas,
          tingkat: kelasList[k].tingkat,
          peran: 'Wali Kelas'
        });
      }
    }
  }

  var days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  var todayName = days[new Date().getDay()];

  return createResponse(true, {
    profile: {
      namaLengkap: guru ? guru.nama_lengkap : auth.session.fullName,
      nip: guru ? guru.nip : '-',
      nuptk: guru ? guru.nuptk : '-'
    },
    stats: {
      totalKelasAjar: assignedClasses.length,
      jadwalHariIniCount: 0
    },
    assignedClasses: assignedClasses,
    todaySchedule: [],
    todayName: todayName
  });
}

function handleGetGuruClasses(token) {
  var auth = verifySession(token, CONFIG.ROLES.GURU);
  if (!auth.valid) return createResponse(false, auth.error);

  var guruList = getSheetObjects(CONFIG.SHEETS.GURU);
  var guruId = null;
  for (var i = 0; i < guruList.length; i++) {
    if (guruList[i].id_user === auth.session.userId) {
      guruId = guruList[i].id_guru;
      break;
    }
  }

  var allKelas = getSheetObjects(CONFIG.SHEETS.KELAS);
  var result = [];
  for (var j = 0; j < allKelas.length; j++) {
    if (allKelas[j].id_guru_wali === guruId) {
      result.push({
        id_kelas: allKelas[j].id_kelas,
        nama_kelas: allKelas[j].nama_kelas,
        tingkat: allKelas[j].tingkat,
        kapasitas: allKelas[j].kapasitas || 0
      });
    }
  }
  return createResponse(true, result);
}

// --- 7. FUNGSI PEMBANTU (HELPERS) ---

function getSheetObjects(sheetName) {
  var ss = getOrCreateDatabase();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() <= 1) return [];

  var values = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
  var headers = values[0];
  var result = [];
  for (var i = 1; i < values.length; i++) {
    var obj = { _rowIndex: i + 1 };
    for (var j = 0; j < headers.length; j++) {
      if (headers[j]) obj[headers[j]] = values[i][j];
    }
    result.push(obj);
  }
  return result;
}

function hashPassword(password, salt) {
  var rawBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + salt, Utilities.Charset.UTF_8);
  var hex = '';
  for (var i = 0; i < rawBytes.length; i++) {
    var b = rawBytes[i];
    if (b < 0) b += 256;
    var s = b.toString(16);
    hex += (s.length === 1 ? '0' + s : s);
  }
  return hex;
}

function formatDateTime(date) {
  return Utilities.formatDate(date || new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
}

function sanitize(val) {
  return (val === null || val === undefined) ? '' : String(val).trim();
}

function createResponse(success, dataOrMessage) {
  if (success) {
    return { success: true, data: dataOrMessage };
  } else {
    return { success: false, message: typeof dataOrMessage === 'string' ? dataOrMessage : 'Terjadi kesalahan sistem.' };
  }
}

function logActivity(userId, username, role, action, clientInfo, detail) {
  try {
    var ss = getOrCreateDatabase();
    var sheet = ss.getSheetByName(CONFIG.SHEETS.LOG_AKTIVITAS);
    if (sheet) {
      sheet.appendRow([
        'LOG-' + Utilities.getUuid().substring(0, 8),
        formatDateTime(new Date()),
        userId || '-',
        username || '-',
        role || '-',
        action || '-',
        clientInfo || 'Frontend',
        detail || '-'
      ]);
    }
  } catch (e) {}
}

/**
 * Runner Inisialisasi Database Langsung
 */
function initSystem() {
  var db = getOrCreateDatabase();
  setupDatabaseStructure(db);
  Logger.log('====================================');
  Logger.log('DATABASE BERHASIL DIBUAT!');
  Logger.log('Nama: ' + db.getName());
  Logger.log('URL:  ' + db.getUrl());
  Logger.log('ID:   ' + db.getId());
  Logger.log('====================================');
  return db.getUrl();
}
