/**
 * ADMINISTRASI GURU SD - Configuration Module
 * Menyimpan konstanta, konfigurasi nama sheet, dan pembacaan Script Properties.
 */

var CONFIG = {
  APP: {
    NAME: 'ADMINISTRASI GURU SD',
    VERSION: '1.0.0-phase1',
    TIMEZONE: 'Asia/Jakarta',
    DEFAULT_ACTIVE_TP: '2026/2027 Ganjil'
  },

  PROPERTY_KEYS: {
    SPREADSHEET_ID: 'SPREADSHEET_ID',
    DRIVE_FOLDER_ID: 'DRIVE_FOLDER_ID',
    APP_SECRET: 'APP_SECRET'
  },

  ROLES: {
    ADMIN: 'ADMIN',
    GURU: 'GURU'
  },

  USER_STATUS: {
    ACTIVE: 'ACTIVE',
    INACTIVE: 'INACTIVE',
    SUSPENDED: 'SUSPENDED'
  },

  SECURITY: {
    SESSION_DURATION_SECONDS: 21600, // 6 jam (batas maksimal CacheService Apps Script)
    MAX_LOGIN_ATTEMPTS: 5,
    LOCKOUT_DURATION_SECONDS: 900 // 15 menit
  },

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

/**
 * Mengambil ID Spreadsheet Database dari Script Properties.
 * @returns {string}
 */
function getSpreadsheetId() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(CONFIG.PROPERTY_KEYS.SPREADSHEET_ID);
  return id || '';
}

/**
 * Menyimpan ID Spreadsheet Database ke Script Properties.
 * @param {string} id
 */
function setSpreadsheetId(id) {
  if (!id || typeof id !== 'string') {
    throw new Error('ID Spreadsheet tidak valid.');
  }
  PropertiesService.getScriptProperties().setProperty(CONFIG.PROPERTY_KEYS.SPREADSHEET_ID, id.trim());
}

/**
 * Mengambil ID Folder Google Drive dari Script Properties.
 * @returns {string}
 */
function getDriveFolderId() {
  var props = PropertiesService.getScriptProperties();
  return props.getProperty(CONFIG.PROPERTY_KEYS.DRIVE_FOLDER_ID) || '';
}

/**
 * Menyimpan ID Folder Google Drive ke Script Properties.
 * @param {string} id
 */
function setDriveFolderId(id) {
  if (!id || typeof id !== 'string') {
    throw new Error('ID Folder Drive tidak valid.');
  }
  PropertiesService.getScriptProperties().setProperty(CONFIG.PROPERTY_KEYS.DRIVE_FOLDER_ID, id.trim());
}
