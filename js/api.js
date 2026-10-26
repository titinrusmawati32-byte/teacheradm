/**
 * ADMINISTRASI GURU SD - API Client Module
 * Berkomunikasi dengan Google Apps Script Web App menggunakan fetch().
 * 
 * CATATAN PENTING ARSITEKTUR CORS:
 * Google Apps Script Web App tidak mendukung CORS preflight 'OPTIONS'.
 * Untuk mencegah browser mengirimkan request OPTIONS, payload dikirim dengan
 * Content-Type: 'text/plain;charset=utf-8'. Server Apps Script akan tetap membaca
 * isi e.postData.contents secara sempurna sebagai JSON dan mengembalikan respons dengan
 * header Access-Control-Allow-Origin: * via redirect 302.
 */

const ApiClient = {
  /**
   * Mengirim request ke backend Google Apps Script.
   * @param {string} action - Nama aksi (contoh: 'login', 'getAdminDashboard')
   * @param {object} [payload] - Parameter data tambahan
   * @returns {Promise<object>} Response objek { success: boolean, data?: any, message?: string }
   */
  request: async function(action, payload = {}) {
    const apiUrl = APP_CONFIG.getApiUrl();

    if (!apiUrl || apiUrl.trim() === '') {
      throw new Error('URL backend database Google Apps Script belum diisi di js/config.js.');
    }

    const requestBody = JSON.stringify({
      action: action,
      ...payload
    });

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8' // Trik bypass CORS Preflight OPTIONS
        },
        body: requestBody,
        redirect: 'follow'
      });

      if (!response.ok) {
        throw new Error('Server merespons dengan status HTTP: ' + response.status);
      }

      const result = await response.json();
      return result;
    } catch (err) {
      console.error('API Client Error [' + action + ']:', err);
      // Deteksi kegagalan koneksi umum / URL salah
      if (err.message && err.message.includes('Failed to fetch')) {
        throw new Error('Gagal menghubungi backend Google Apps Script. Pastikan URL Web App benar dan deployment diset "Who has access: Anyone".');
      }
      throw err;
    }
  },

  /**
   * Tes konektivitas ke Google Apps Script backend
   */
  ping: async function() {
    return this.request('ping');
  }
};
