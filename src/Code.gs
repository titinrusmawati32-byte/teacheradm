/**
 * ADMINISTRASI GURU SD - Backend REST / JSON API Gateway
 * Menangani permintaan HTTP GET dan POST dari Frontend (yang di-hosting di GitHub / GitHub Pages)
 * dan mengembalikan respon berformat JSON standar melalui ContentService.
 */

/**
 * Handler HTTP POST utama untuk komunikasi API dari Frontend GitHub.
 * @param {object} e - Event parameter dari Google Apps Script
 * @returns {GoogleAppsScript.Content.TextOutput}
 */
function doPost(e) {
  return handleApiRequest(e);
}

/**
 * Handler HTTP GET untuk verifikasi, ping, atau pembacaan ringan.
 * @param {object} e
 * @returns {GoogleAppsScript.Content.TextOutput}
 */
function doGet(e) {
  return handleApiRequest(e);
}

/**
 * Pengurai dan Router Utama API.
 * Mendukung pembacaan payload dari POST body (JSON string) maupun GET query parameters.
 * @param {object} e
 * @returns {GoogleAppsScript.Content.TextOutput}
 */
function handleApiRequest(e) {
  var response;

  try {
    var params = {};

    // 1. Ekstraksi parameter dari POST body
    if (e && e.postData && e.postData.contents) {
      try {
        params = JSON.parse(e.postData.contents);
      } catch (errJson) {
        // Fallback jika dikirim sebagai URL-encoded
        params = e.parameter || {};
      }
    } else if (e && e.parameter) {
      // 2. Ekstraksi dari GET query string (?action=...&token=...)
      params = e.parameter;
    }

    var action = params.action || (e && e.parameter && e.parameter.action) || 'ping';

    // 3. Router Berdasarkan 'action'
    switch (action) {
      case 'ping':
        response = createResponse(true, {
          status: 'online',
          appName: CONFIG.APP.NAME,
          version: CONFIG.APP.VERSION,
          serverTime: formatDateTime(new Date())
        });
        break;

      // --- AUTENTIKASI ---
      case 'login':
        response = login(params.username, params.password);
        break;

      case 'logout':
        response = logout(params.token);
        break;

      case 'verifySession':
        response = verifySession(params.token);
        if (response.valid) {
          response = createResponse(true, response.session);
        } else {
          response = createResponse(false, response.error);
        }
        break;

      case 'getCurrentUser':
        response = getCurrentUser(params.token);
        break;

      // --- ADMINISTRATOR ---
      case 'getAdminDashboard':
        response = getAdminDashboardSummary(params.token);
        break;

      case 'getUsersList':
        response = getUsersList(params.token);
        break;

      case 'createUser':
        response = createUser(params.token, params.userData || params);
        break;

      case 'updateUserStatus':
        response = updateUserStatus(params.token, params.userId, params.status);
        break;

      // --- GURU ---
      case 'getGuruDashboard':
        response = getGuruDashboardSummary(params.token);
        break;

      case 'getGuruClasses':
        response = getGuruClasses(params.token);
        break;

      // --- FITUR FASE 2 ---
      case 'triggerPhase2Feature':
        response = apiTriggerPhase2Feature(params.token, params.role, params.featureName);
        break;

      // --- SETUP SISTEM ---
      case 'setupDatabase':
        response = setupDatabase(params.spreadsheetId);
        break;

      default:
        response = createResponse(false, 'Aksi API tidak valid atau tidak dikenali: ' + action, 'INVALID_ACTION');
    }
  } catch (errGlobal) {
    response = createResponse(false, 'Kesalahan internal server: ' + errGlobal.message, 'INTERNAL_ERROR');
  }

  // 4. Mengembalikan output JSON dengan MIME Type JSON
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handler pembantu fitur Fase 2
 */
function apiTriggerPhase2Feature(token, role, featureName) {
  if (role === CONFIG.ROLES.ADMIN) {
    return handleAdminPhase2Feature(token, featureName);
  } else {
    return handleGuruPhase2Feature(token, featureName);
  }
}

/**
 * Fungsi runner langsung dari editor Apps Script untuk inisialisasi awal database
 */
function initSystem(optionalSpreadsheetId) {
  var res = setupDatabase(optionalSpreadsheetId);
  Logger.log(JSON.stringify(res, null, 2));
  return res;
}
