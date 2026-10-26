/**
 * ADMINISTRASI GURU SD - Background Database Configuration
 * Konfigurasi koneksi backend Google Apps Script di belakang layar.
 */

const APP_CONFIG = {
  APP_NAME: 'ADMINISTRASI GURU SD',
  VERSION: '1.0.0-frontend',

  // =========================================================================
  // TEMPELKAN URL WEB APP GOOGLE APPS SCRIPT ANDA DI SINI
  // (Didapat dari: Deploy > New deployment / Manage deployments > Web app URL)
  // Contoh: 'https://script.google.com/macros/s/AKfycbx.../exec'
  // =========================================================================
  DEFAULT_API_URL: '',

  /**
   * Mengambil URL Web App yang berjalan di belakang layar
   */
  getApiUrl: function() {
    return this.DEFAULT_API_URL;
  }
};
