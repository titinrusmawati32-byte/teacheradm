/**
 * ADMINISTRASI GURU SD - Frontend Configuration
 * Mengatur URL endpoint Google Apps Script Web App.
 */

const APP_CONFIG = {
  APP_NAME: 'ADMINISTRASI GURU SD',
  VERSION: '1.0.0-frontend',

  // Masukkan URL Google Apps Script Web App Deployment Anda di sini
  // Contoh: 'https://script.google.com/macros/s/AKfycbx.../exec'
  DEFAULT_API_URL: '',

  /**
   * Mengambil URL Web App aktif (memprioritaskan yang tersimpan di localStorage browser)
   */
  getApiUrl: function() {
    const saved = localStorage.getItem('gas_api_url');
    if (saved && saved.trim() !== '') {
      return saved.trim();
    }
    return this.DEFAULT_API_URL;
  },

  /**
   * Menyimpan URL Web App baru ke localStorage browser
   */
  setApiUrl: function(url) {
    if (url && url.trim() !== '') {
      localStorage.setItem('gas_api_url', url.trim());
    } else {
      localStorage.removeItem('gas_api_url');
    }
  }
};
