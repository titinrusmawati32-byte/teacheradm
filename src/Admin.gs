/**
 * ADMINISTRASI GURU SD - Admin Module
 * Operasi khusus Administrator: Dashboard statistik, manajemen akun pengguna,
 * dan placeholder fitur lanjutan yang sedang dikembangkan (Fase 2).
 */

/**
 * Mengambil data ringkasan untuk Dashboard Admin.
 * @param {string} token
 * @returns {object}
 */
function getAdminDashboardSummary(token) {
  var auth = verifySession(token, CONFIG.ROLES.ADMIN);
  if (!auth.valid) {
    return createResponse(false, auth.error);
  }

  try {
    var totalGuru = countRecords(CONFIG.SHEETS.GURU);
    var totalSiswa = countRecords(CONFIG.SHEETS.SISWA);
    var totalKelas = countRecords(CONFIG.SHEETS.KELAS);
    var totalMapel = countRecords(CONFIG.SHEETS.MATA_PELAJARAN);
    var totalUser = countRecords(CONFIG.SHEETS.USERS);

    // Ambil info sekolah
    var sekolahData = getSheetDataAsObjects(CONFIG.SHEETS.SEKOLAH);
    var sekolahInfo = sekolahData.length > 0 ? sekolahData[0] : { nama_sekolah: 'Belum diatur' };

    // Ambil tahun pelajaran aktif
    var tpData = getSheetDataAsObjects(CONFIG.SHEETS.TAHUN_PELAJARAN);
    var activeTp = null;
    for (var i = 0; i < tpData.length; i++) {
      if (String(tpData[i].is_active).toUpperCase() === 'TRUE') {
        activeTp = tpData[i];
        break;
      }
    }

    // Ambil 5 aktivitas terakhir
    var logs = getSheetDataAsObjects(CONFIG.SHEETS.LOG_AKTIVITAS);
    var recentLogs = [];
    var startIndex = Math.max(0, logs.length - 6);
    for (var j = logs.length - 1; j >= startIndex; j--) {
      recentLogs.push({
        timestamp: logs[j].timestamp,
        username: logs[j].username,
        role: logs[j].role,
        action: logs[j].action,
        detail: logs[j].detail
      });
    }

    return createResponse(true, {
      stats: {
        totalGuru: totalGuru,
        totalSiswa: totalSiswa,
        totalKelas: totalKelas,
        totalMapel: totalMapel,
        totalUser: totalUser
      },
      sekolah: {
        nama: sekolahInfo.nama_sekolah,
        npsn: sekolahInfo.npsn,
        kepalaSekolah: sekolahInfo.kepala_sekolah
      },
      tahunPelajaran: activeTp ? (activeTp.nama_tp + ' - ' + activeTp.semester) : CONFIG.APP.DEFAULT_ACTIVE_TP,
      recentLogs: recentLogs
    });
  } catch (err) {
    return createResponse(false, 'Gagal mengambil data dashboard admin: ' + err.message);
  }
}

/**
 * Mengambil daftar seluruh pengguna (tanpa field password_hash atau salt).
 * @param {string} token
 * @returns {object}
 */
function getUsersList(token) {
  var auth = verifySession(token, CONFIG.ROLES.ADMIN);
  if (!auth.valid) {
    return createResponse(false, auth.error);
  }

  try {
    var rawUsers = getSheetDataAsObjects(CONFIG.SHEETS.USERS);
    var sanitizedUsers = [];

    for (var i = 0; i < rawUsers.length; i++) {
      var u = rawUsers[i];
      sanitizedUsers.push({
        id_user: u.id_user,
        username: u.username,
        full_name: u.full_name,
        email: u.email,
        role: u.role,
        status: u.status,
        last_login: u.last_login,
        created_at: u.created_at
      });
    }

    return createResponse(true, sanitizedUsers);
  } catch (err) {
    return createResponse(false, 'Gagal memuat daftar pengguna: ' + err.message);
  }
}

/**
 * Membuat pengguna baru oleh Administrator.
 * @param {string} token
 * @param {object} userData
 * @returns {object}
 */
function createUser(token, userData) {
  var auth = verifySession(token, CONFIG.ROLES.ADMIN);
  if (!auth.valid) {
    return createResponse(false, auth.error);
  }

  if (!userData) {
    return createResponse(false, 'Data pengguna tidak boleh kosong.');
  }

  var username = sanitizeString(userData.username).toLowerCase();
  var password = sanitizeString(userData.password);
  var fullName = sanitizeString(userData.full_name);
  var email = sanitizeString(userData.email);
  var role = sanitizeString(userData.role).toUpperCase();

  // Validasi input
  if (!username || username.length < 3) {
    return createResponse(false, 'Username minimal terdiri dari 3 karakter.');
  }
  if (!/^[a-z0-9_.-]+$/.test(username)) {
    return createResponse(false, 'Username hanya boleh berisi huruf kecil, angka, garis bawah, titik, atau tanda hubung.');
  }
  if (!password || password.length < 8) {
    return createResponse(false, 'Password minimal terdiri dari 8 karakter.');
  }
  if (!fullName) {
    return createResponse(false, 'Nama lengkap wajib diisi.');
  }
  if (role !== CONFIG.ROLES.ADMIN && role !== CONFIG.ROLES.GURU) {
    return createResponse(false, 'Peran harus ADMIN atau GURU.');
  }

  // Cek apakah username sudah ada
  var existing = findRecordByField(CONFIG.SHEETS.USERS, 'username', username);
  if (existing) {
    return createResponse(false, 'Username "' + username + '" sudah digunakan. Silakan pilih username lain.');
  }

  // Generate salt dan hash password
  var salt = generateSalt();
  var passwordHash = hashPassword(password, salt);
  var newUserId = 'USR-' + Utilities.getUuid().substring(0, 8);
  var nowStr = formatDateTime(new Date());

  var newUserRecord = {
    id_user: newUserId,
    username: username,
    password_hash: passwordHash,
    salt: salt,
    full_name: fullName,
    email: email || '-',
    role: role,
    status: CONFIG.USER_STATUS.ACTIVE,
    last_login: '-',
    created_at: nowStr,
    updated_at: nowStr
  };

  try {
    appendRecord(CONFIG.SHEETS.USERS, newUserRecord);

    // Jika pengguna yang dibuat adalah GURU, buatkan juga data awal di sheet GURU
    if (role === CONFIG.ROLES.GURU) {
      var newGuruId = 'GRU-' + Utilities.getUuid().substring(0, 8);
      appendRecord(CONFIG.SHEETS.GURU, {
        id_guru: newGuruId,
        id_user: newUserId,
        nip: sanitizeString(userData.nip) || '-',
        nuptk: sanitizeString(userData.nuptk) || '-',
        nama_lengkap: fullName,
        gelar_depan: sanitizeString(userData.gelar_depan) || '',
        gelar_belakang: sanitizeString(userData.gelar_belakang) || '',
        jenis_kelamin: sanitizeString(userData.jenis_kelamin) || 'L',
        tempat_lahir: '-',
        tgl_lahir: '-',
        no_hp: sanitizeString(userData.no_hp) || '-',
        email: email || '-',
        alamat: '-',
        status_kepegawaian: 'Guru Kelas / Mata Pelajaran',
        jabatan: 'Guru',
        created_at: nowStr,
        updated_at: nowStr
      });
    }

    logActivity(auth.session.userId, auth.session.username, auth.session.role, 'CREATE_USER', 'AdminPanel', 'Membuat pengguna baru: ' + username + ' (' + role + ')');

    return createResponse(true, {
      message: 'Pengguna "' + username + '" berhasil dibuat.',
      userId: newUserId
    });
  } catch (err) {
    return createResponse(false, 'Gagal menyimpan pengguna baru: ' + err.message);
  }
}

/**
 * Mengubah status aktif/nonaktif akun pengguna.
 * @param {string} token
 * @param {string} targetUserId
 * @param {string} newStatus
 * @returns {object}
 */
function updateUserStatus(token, targetUserId, newStatus) {
  var auth = verifySession(token, CONFIG.ROLES.ADMIN);
  if (!auth.valid) {
    return createResponse(false, auth.error);
  }

  if (auth.session.userId === targetUserId) {
    return createResponse(false, 'Anda tidak dapat mengubah status akun Anda sendiri.');
  }

  var validStatuses = [CONFIG.USER_STATUS.ACTIVE, CONFIG.USER_STATUS.INACTIVE, CONFIG.USER_STATUS.SUSPENDED];
  if (validStatuses.indexOf(newStatus) === -1) {
    return createResponse(false, 'Status tidak valid.');
  }

  var user = findRecordByField(CONFIG.SHEETS.USERS, 'id_user', targetUserId);
  if (!user) {
    return createResponse(false, 'Pengguna tidak ditemukan.');
  }

  try {
    updateRecordByRowIndex(CONFIG.SHEETS.USERS, user._rowIndex, {
      status: newStatus,
      updated_at: formatDateTime(new Date())
    });

    logActivity(auth.session.userId, auth.session.username, auth.session.role, 'UPDATE_STATUS', 'AdminPanel', 'Ubah status user ' + user.username + ' -> ' + newStatus);

    return createResponse(true, 'Status pengguna berhasil diperbarui menjadi ' + newStatus + '.');
  } catch (err) {
    return createResponse(false, 'Gagal memperbarui status: ' + err.message);
  }
}

/**
 * Placeholder fungsi Fase 2 untuk admin.
 * Menjamin backend memberikan respon standar bahwa fitur sedang dikembangkan, bukan disimulasikan.
 * @param {string} token
 * @param {string} featureName
 * @returns {object}
 */
function handleAdminPhase2Feature(token, featureName) {
  var auth = verifySession(token, CONFIG.ROLES.ADMIN);
  if (!auth.valid) {
    return createResponse(false, auth.error);
  }
  return {
    success: false,
    inDevelopment: true,
    feature: featureName,
    message: 'Fitur ' + featureName + ' sedang dalam tahap pengembangan (Fase 2).'
  };
}
