/**
 * ADMINISTRASI GURU SD - Utility Module
 * Fungsi pembantu: hashing, formatting, template inclusion, logging, dan responses.
 */

/**
 * Menyertakan file HTML parsial ke dalam file HTML utama.
 * Mendukung pencarian nama file langsung maupun dengan awalan 'views/' atau 'src/'.
 * @param {string} filename
 * @returns {string}
 */
function include(filename) {
  var cleanName = filename.replace(/\.html$/i, '');
  var candidates = [
    cleanName,
    'views/' + cleanName,
    'src/' + cleanName,
    cleanName + '.html',
    'views/' + cleanName + '.html'
  ];

  for (var i = 0; i < candidates.length; i++) {
    try {
      return HtmlService.createHtmlOutputFromFile(candidates[i]).getContent();
    } catch (e) {
      // Coba kandidat berikutnya
    }
  }

  throw new Error('Gagal memuat template HTML: File "' + filename + '" tidak ditemukan.');
}

/**
 * Melakukan hashing kata sandi dengan SHA-256 dan salt.
 * @param {string} password
 * @param {string} salt
 * @returns {string} Hexadecimal hash string
 */
function hashPassword(password, salt) {
  if (!password || !salt) {
    throw new Error('Password dan salt wajib diisi untuk hashing.');
  }
  var rawBytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    password + salt,
    Utilities.Charset.UTF_8
  );
  var hex = '';
  for (var i = 0; i < rawBytes.length; i++) {
    var byteVal = rawBytes[i];
    if (byteVal < 0) byteVal += 256;
    var byteHex = byteVal.toString(16);
    if (byteHex.length === 1) byteHex = '0' + byteHex;
    hex += byteHex;
  }
  return hex;
}

/**
 * Membuat salt acak berbasis UUID.
 * @returns {string}
 */
function generateSalt() {
  return Utilities.getUuid();
}

/**
 * Membuat token sesi acak.
 * @returns {string}
 */
function generateSessionToken() {
  return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
}

/**
 * Memformat objek Date ke string waktu Indonesia.
 * @param {Date} date
 * @param {string} format
 * @returns {string}
 */
function formatDateTime(date, format) {
  var d = date || new Date();
  var fmt = format || 'yyyy-MM-dd HH:mm:ss';
  return Utilities.formatDate(d, CONFIG.APP.TIMEZONE, fmt);
}

/**
 * Standard format response untuk dikembalikan ke frontend.
 * @param {boolean} success
 * @param {string|object} dataOrMessage
 * @param {string} [code]
 * @returns {object}
 */
function createResponse(success, dataOrMessage, code) {
  if (success) {
    return {
      success: true,
      data: dataOrMessage,
      code: code || 'SUCCESS'
    };
  } else {
    return {
      success: false,
      message: typeof dataOrMessage === 'string' ? dataOrMessage : (dataOrMessage.message || 'Terjadi kesalahan sistem.'),
      code: code || 'ERROR'
    };
  }
}

/**
 * Mencatat log aktivitas ke sheet LOG_AKTIVITAS.
 * @param {string} userId
 * @param {string} username
 * @param {string} role
 * @param {string} action
 * @param {string} clientInfo
 * @param {string} detail
 */
function logActivity(userId, username, role, action, clientInfo, detail) {
  try {
    var ssId = getSpreadsheetId();
    if (!ssId) return;

    var ss = SpreadsheetApp.openById(ssId);
    var sheet = ss.getSheetByName(CONFIG.SHEETS.LOG_AKTIVITAS);
    if (!sheet) return;

    var logId = 'LOG-' + Utilities.getUuid().substring(0, 8);
    var timestamp = formatDateTime(new Date());

    sheet.appendRow([
      logId,
      timestamp,
      userId || '-',
      username || 'ANONYMOUS',
      role || '-',
      action || '-',
      clientInfo || 'WebApp',
      typeof detail === 'object' ? JSON.stringify(detail) : (detail || '-')
    ]);
  } catch (err) {
    // Logging tidak boleh menghentikan transaksi utama
    Logger.log('Gagal mencatat log aktivitas: ' + err.toString());
  }
}

/**
 * Membersihkan string masukan.
 * @param {string} val
 * @returns {string}
 */
function sanitizeString(val) {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}
