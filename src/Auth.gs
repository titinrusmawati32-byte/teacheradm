/**
 * ADMINISTRASI GURU SD - Authentication & Security Module
 * Menangani login berbasis username & password (SHA-256 + Salt), session token via CacheService,
 * verifikasi hak akses peran (Role-Based Access Control), dan pembatasan percobaan login (Rate Limiting).
 */

/**
 * Memproses autentikasi pengguna.
 * @param {string} username
 * @param {string} password
 * @returns {object} Response status, token, dan data profil pengguna (tanpa password/salt)
 */
function login(username, password) {
  var cleanUsername = sanitizeString(username).toLowerCase();
  var cleanPassword = sanitizeString(password);

  if (!cleanUsername || !cleanPassword) {
    return createResponse(false, 'Username dan password wajib diisi.');
  }

  // 1. Cek Rate Limiting (Maksimal 5 percobaan gagal per 15 menit)
  var rateLimitCheck = checkRateLimit(cleanUsername);
  if (!rateLimitCheck.allowed) {
    logActivity('-', cleanUsername, '-', 'LOGIN_LOCKED', 'AuthService', 'Percobaan login melebihi batas.');
    return createResponse(false, 'Akun terkunci sementara karena terlalu banyak percobaan login yang gagal. Silakan coba lagi dalam 15 menit.');
  }

  // 2. Cari data pengguna di sheet USERS
  var user = findRecordByField(CONFIG.SHEETS.USERS, 'username', cleanUsername);

  // Jika username tidak ditemukan
  if (!user) {
    recordFailedAttempt(cleanUsername);
    logActivity('-', cleanUsername, '-', 'LOGIN_FAILED', 'AuthService', 'Username tidak ditemukan.');
    // Pesan dibuat generik untuk mencegah user enumeration
    return createResponse(false, 'Username atau password tidak valid.');
  }

  // 3. Cek Status Akun
  if (user.status !== CONFIG.USER_STATUS.ACTIVE) {
    logActivity(user.id_user, cleanUsername, user.role, 'LOGIN_BLOCKED', 'AuthService', 'Akun tidak berstatus ACTIVE: ' + user.status);
    return createResponse(false, 'Akun Anda berstatus ' + user.status + '. Silakan hubungi Administrator sekolah.');
  }

  // 4. Verifikasi Password dengan Salt dan SHA-256
  var computedHash = hashPassword(cleanPassword, user.salt);
  if (computedHash !== user.password_hash) {
    recordFailedAttempt(cleanUsername);
    logActivity(user.id_user, cleanUsername, user.role, 'LOGIN_FAILED', 'AuthService', 'Password salah.');
    return createResponse(false, 'Username atau password tidak valid.');
  }

  // 5. Berhasil! Reset counter percobaan gagal
  resetFailedAttempts(cleanUsername);

  // 6. Buat Session Token aman dan simpan di CacheService
  var sessionToken = generateSessionToken();
  var sessionPayload = {
    userId: user.id_user,
    username: user.username,
    fullName: user.full_name,
    email: user.email,
    role: user.role,
    createdAt: new Date().getTime()
  };

  var cache = CacheService.getScriptCache();
  // Simpan token dengan masa aktif 6 jam (21600 detik)
  cache.put('sess_' + sessionToken, JSON.stringify(sessionPayload), CONFIG.SECURITY.SESSION_DURATION_SECONDS);

  // 7. Perbarui timestamp last_login di database
  try {
    updateRecordByRowIndex(CONFIG.SHEETS.USERS, user._rowIndex, {
      last_login: formatDateTime(new Date()),
      updated_at: formatDateTime(new Date())
    });
  } catch (err) {
    Logger.log('Gagal memperbarui last_login: ' + err.toString());
  }

  // 8. Catat log login berhasil
  logActivity(user.id_user, user.username, user.role, 'LOGIN_SUCCESS', 'AuthService', 'Login berhasil ke sistem.');

  // 9. Kembalikan data ke frontend. PERINGATAN: password_hash dan salt TIDAK PERNAH dikirim ke client!
  return createResponse(true, {
    token: sessionToken,
    user: {
      userId: user.id_user,
      username: user.username,
      fullName: user.full_name,
      email: user.email,
      role: user.role
    }
  });
}

/**
 * Mengakhiri sesi (Logout).
 * @param {string} token
 * @returns {object}
 */
function logout(token) {
  if (!token) {
    return createResponse(true, 'Sesi telah berakhir.');
  }

  var cache = CacheService.getScriptCache();
  var sessionRaw = cache.get('sess_' + token);

  if (sessionRaw) {
    try {
      var session = JSON.parse(sessionRaw);
      logActivity(session.userId, session.username, session.role, 'LOGOUT', 'AuthService', 'Pengguna keluar.');
    } catch (e) {
      // Abaikan parse error saat logging
    }
    cache.remove('sess_' + token);
  }

  return createResponse(true, 'Logout berhasil.');
}

/**
 * Memverifikasi validitas token sesi dan hak akses peran di backend.
 * Fungsi ini harus dipanggil di awal setiap pemanggilan fungsi sensitif backend.
 * @param {string} token
 * @param {string} [requiredRole] - Peran yang dibutuhkan ('ADMIN', 'GURU', atau kosong jika hanya butuh login)
 * @returns {object} { valid: boolean, session?: object, error?: string }
 */
function verifySession(token, requiredRole) {
  if (!token || typeof token !== 'string') {
    return {
      valid: false,
      error: 'Token sesi tidak ditemukan. Silakan login kembali.'
    };
  }

  var cache = CacheService.getScriptCache();
  var sessionRaw = cache.get('sess_' + token);

  if (!sessionRaw) {
    return {
      valid: false,
      error: 'Sesi Anda telah kedaluwarsa atau tidak valid. Silakan login kembali.'
    };
  }

  var session;
  try {
    session = JSON.parse(sessionRaw);
  } catch (e) {
    cache.remove('sess_' + token);
    return {
      valid: false,
      error: 'Data sesi rusak. Silakan login kembali.'
    };
  }

  // Jika ada verifikasi peran spesifik
  if (requiredRole) {
    // Admin memiliki hak akses penuh ke operasi umum, tetapi peran lain harus sesuai
    if (session.role !== requiredRole && session.role !== CONFIG.ROLES.ADMIN) {
      logActivity(session.userId, session.username, session.role, 'UNAUTHORIZED_ACCESS', 'SecurityCheck', 'Mencoba akses fitur peran: ' + requiredRole);
      return {
        valid: false,
        error: 'Akses ditolak. Anda tidak memiliki izin untuk melakukan tindakan ini.'
      };
    }
  }

  return {
    valid: true,
    session: session
  };
}

/**
 * Mengambil profil pengguna yang sedang aktif berdasarkan token.
 * @param {string} token
 * @returns {object}
 */
function getCurrentUser(token) {
  var auth = verifySession(token);
  if (!auth.valid) {
    return createResponse(false, auth.error);
  }
  return createResponse(true, auth.session);
}

/**
 * Memeriksa apakah suatu username sedang terkena rate limit login.
 * @param {string} username
 * @returns {object} { allowed: boolean, attempts: number }
 */
function checkRateLimit(username) {
  var cache = CacheService.getScriptCache();
  var key = 'ratelimit_' + username;
  var count = parseInt(cache.get(key) || '0', 10);

  if (count >= CONFIG.SECURITY.MAX_LOGIN_ATTEMPTS) {
    return { allowed: false, attempts: count };
  }
  return { allowed: true, attempts: count };
}

/**
 * Menambahkan catatan percobaan login yang gagal.
 * @param {string} username
 */
function recordFailedAttempt(username) {
  var cache = CacheService.getScriptCache();
  var key = 'ratelimit_' + username;
  var count = parseInt(cache.get(key) || '0', 10) + 1;
  cache.put(key, String(count), CONFIG.SECURITY.LOCKOUT_DURATION_SECONDS);
}

/**
 * Mengatur ulang catatan percobaan login yang gagal setelah berhasil.
 * @param {string} username
 */
function resetFailedAttempts(username) {
  var cache = CacheService.getScriptCache();
  var key = 'ratelimit_' + username;
  cache.remove(key);
}
