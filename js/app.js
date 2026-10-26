/**
 * ADMINISTRASI GURU SD - Main Application Logic & SPA Router
 * Menjalankan antarmuka klien statis untuk deployment di GitHub Pages.
 */

const App = {
  state: {
    token: null,
    user: null,
    role: null
  },

  init: function() {
    this.updateApiStatusIndicator();

    // Periksa apakah ada token yang tersimpan di sessionStorage saat refresh
    const savedToken = sessionStorage.getItem('ag_token');
    const apiUrl = APP_CONFIG.getApiUrl();

    if (!apiUrl) {
      this.showView('loginView');
      this.openApiConfigModal();
      return;
    }

    if (savedToken) {
      this.showLoading(true, 'Memverifikasi sesi Anda...');
      ApiClient.request('verifySession', { token: savedToken })
        .then((res) => {
          this.showLoading(false);
          if (res && res.success && res.data) {
            this.state.token = savedToken;
            this.state.user = res.data;
            this.state.role = res.data.role;
            this.renderAppView();
          } else {
            sessionStorage.removeItem('ag_token');
            this.showView('loginView');
          }
        })
        .catch((err) => {
          this.showLoading(false);
          sessionStorage.removeItem('ag_token');
          this.showView('loginView');
        });
    } else {
      this.showView('loginView');
    }
  },

  // Update status indikator koneksi API di top banner
  updateApiStatusIndicator: function() {
    const url = APP_CONFIG.getApiUrl();
    const statusText = document.getElementById('apiStatusText');
    if (statusText) {
      if (url) {
        statusText.innerHTML = '🟢 Terhubung ke Apps Script: <code style="color:#93c5fd;">' + url.substring(0, 35) + '...</code>';
      } else {
        statusText.innerHTML = '🔴 Backend Apps Script belum terhubung.';
      }
    }
  },

  // SPA View Router
  showView: function(viewId) {
    document.getElementById('loginView').classList.add('hidden');
    document.getElementById('adminView').classList.add('hidden');
    document.getElementById('guruView').classList.add('hidden');

    const target = document.getElementById(viewId);
    if (target) {
      target.classList.remove('hidden');
    }
  },

  renderAppView: function() {
    if (this.state.role === 'ADMIN') {
      this.showView('adminView');
      this.initAdminDashboard();
    } else if (this.state.role === 'GURU') {
      this.showView('guruView');
      this.initGuruDashboard();
    } else {
      this.showToast('Peran pengguna tidak dikenali.', 'error');
      this.handleLogout();
    }
  },

  // ==========================================
  // AUTENTIKASI
  // ==========================================
  handleLogin: async function(e) {
    e.preventDefault();
    const usernameInput = document.getElementById('loginUsername');
    const passwordInput = document.getElementById('loginPassword');
    const submitBtn = document.getElementById('loginSubmitBtn');

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
      this.showToast('Harap masukkan username dan password.', 'warning');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerText = 'Memverifikasi...';
    this.showLoading(true, 'Memproses autentikasi ke server Apps Script...');

    try {
      const res = await ApiClient.request('login', {
        username: username,
        password: password
      });

      submitBtn.disabled = false;
      submitBtn.innerText = 'Masuk ke Aplikasi';
      this.showLoading(false);

      if (res && res.success) {
        this.state.token = res.data.token;
        this.state.user = res.data.user;
        this.state.role = res.data.user.role;
        sessionStorage.setItem('ag_token', res.data.token);

        this.showToast('Login berhasil. Selamat datang, ' + res.data.user.fullName + '!', 'success');
        usernameInput.value = '';
        passwordInput.value = '';
        this.renderAppView();
      } else {
        this.showToast(res.message || 'Login gagal.', 'error');
      }
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.innerText = 'Masuk ke Aplikasi';
      this.showLoading(false);
      this.showToast(err.message, 'error');
    }
  },

  handleLogout: async function() {
    const currentToken = this.state.token;
    this.showLoading(true, 'Mengakhiri sesi...');

    try {
      if (currentToken) {
        await ApiClient.request('logout', { token: currentToken });
      }
    } catch (e) {
      // Abaikan error jaringan saat logout
    } finally {
      this.state.token = null;
      this.state.user = null;
      this.state.role = null;
      sessionStorage.removeItem('ag_token');
      this.showLoading(false);
      this.showView('loginView');
      this.showToast('Anda telah berhasil keluar.', 'info');
    }
  },

  // ==========================================
  // NOTIFIKASI & MODAL
  // ==========================================
  showToast: function(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';

    toast.innerHTML = '<span>' + icon + '</span><span style="flex:1;">' + message + '</span>';
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  showLoading: function(show, message) {
    const overlay = document.getElementById('loadingOverlay');
    const msgEl = document.getElementById('loadingMessage');
    if (show) {
      msgEl.innerText = message || 'Memuat data...';
      overlay.classList.remove('hidden');
    } else {
      overlay.classList.add('hidden');
    }
  },

  openInDevelopmentModal: function(featureName) {
    document.getElementById('devFeatureName').innerText = featureName;
    document.getElementById('inDevelopmentModal').classList.add('active');
  },

  closeInDevelopmentModal: function() {
    document.getElementById('inDevelopmentModal').classList.remove('active');
  },

  openApiConfigModal: function() {
    const currentUrl = APP_CONFIG.getApiUrl();
    document.getElementById('apiConfigUrl').value = currentUrl;
    document.getElementById('apiConfigModal').classList.add('active');
  },

  closeApiConfigModal: function() {
    document.getElementById('apiConfigModal').classList.remove('active');
  },

  saveApiConfig: async function(e) {
    e.preventDefault();
    const url = document.getElementById('apiConfigUrl').value.trim();
    if (!url) {
      this.showToast('URL Web App tidak boleh kosong.', 'warning');
      return;
    }
    APP_CONFIG.setApiUrl(url);
    this.updateApiStatusIndicator();

    this.showLoading(true, 'Menguji koneksi ke backend Apps Script...');
    try {
      const res = await ApiClient.ping();
      this.showLoading(false);
      if (res && res.success) {
        this.showToast('Koneksi berhasil terhubung ke ' + (res.data.appName || 'Apps Script') + '!', 'success');
        this.closeApiConfigModal();
      } else {
        this.showToast('Terhubung, namun respons backend tidak standar.', 'warning');
      }
    } catch (err) {
      this.showLoading(false);
      this.showToast('Gagal terhubung: ' + err.message, 'error');
    }
  },

  toggleSidebar: function(sidebarId) {
    const el = document.getElementById(sidebarId);
    if (el) el.classList.toggle('open');
  },

  // ==========================================
  // LOGIKA ADMIN PORTAL
  // ==========================================
  initAdminDashboard: function() {
    document.getElementById('adminCurrentUserName').innerText = this.state.user.fullName;
    this.switchAdminTab('dashboard');
    this.loadAdminStats();
  },

  switchAdminTab: function(tabName) {
    document.querySelectorAll('#adminSidebar .nav-item').forEach(el => el.classList.remove('active'));
    const activeNav = document.getElementById('adminNav-' + tabName);
    if (activeNav) activeNav.classList.add('active');

    document.getElementById('adminSection-dashboard').classList.add('hidden');
    document.getElementById('adminSection-users').classList.add('hidden');

    if (tabName === 'dashboard') {
      document.getElementById('adminSection-dashboard').classList.remove('hidden');
      this.loadAdminStats();
    } else if (tabName === 'users') {
      document.getElementById('adminSection-users').classList.remove('hidden');
      this.loadUsersTable();
    }

    const sb = document.getElementById('adminSidebar');
    if (sb) sb.classList.remove('open');
  },

  loadAdminStats: async function() {
    this.showLoading(true, 'Mengambil data statistik...');
    try {
      const res = await ApiClient.request('getAdminDashboard', { token: this.state.token });
      this.showLoading(false);

      if (res && res.success) {
        const data = res.data;
        document.getElementById('adminStatGuru').innerText = data.stats.totalGuru;
        document.getElementById('adminStatSiswa').innerText = data.stats.totalSiswa;
        document.getElementById('adminStatKelas').innerText = data.stats.totalKelas;
        document.getElementById('adminStatMapel').innerText = data.stats.totalMapel;
        document.getElementById('adminInfoSekolah').innerText = data.sekolah.nama;
        document.getElementById('adminInfoTP').innerText = data.tahunPelajaran;

        const logTbody = document.getElementById('adminRecentLogsBody');
        if (data.recentLogs && data.recentLogs.length > 0) {
          logTbody.innerHTML = data.recentLogs.map(l => `
            <tr>
              <td><span class="text-xs text-muted">${l.timestamp}</span></td>
              <td><strong>${l.username}</strong> <span class="badge ${l.role === 'ADMIN' ? 'badge-admin' : 'badge-guru'} text-xs">${l.role}</span></td>
              <td><code>${l.action}</code></td>
              <td><span class="text-sm">${l.detail}</span></td>
            </tr>
          `).join('');
        } else {
          logTbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted" style="padding:2rem;">Belum ada aktivitas tercatat.</td></tr>';
        }
      } else {
        this.showToast(res.message || 'Gagal memuat statistik admin.', 'error');
      }
    } catch (err) {
      this.showLoading(false);
      this.showToast('Gagal memuat dashboard: ' + err.message, 'error');
    }
  },

  loadUsersTable: async function() {
    this.showLoading(true, 'Memuat daftar pengguna...');
    try {
      const res = await ApiClient.request('getUsersList', { token: this.state.token });
      this.showLoading(false);

      if (res && res.success) {
        const tbody = document.getElementById('usersTableBody');
        if (res.data && res.data.length > 0) {
          tbody.innerHTML = res.data.map(u => `
            <tr>
              <td><strong>${u.username}</strong></td>
              <td>${u.full_name}</td>
              <td>${u.email || '-'}</td>
              <td><span class="badge ${u.role === 'ADMIN' ? 'badge-admin' : 'badge-guru'}">${u.role}</span></td>
              <td><span class="badge ${u.status === 'ACTIVE' ? 'badge-active' : 'badge-inactive'}">${u.status}</span></td>
              <td class="text-xs text-muted">${u.last_login || '-'}</td>
              <td>
                ${u.id_user === this.state.user.userId ?
                  '<span class="text-xs text-muted">(Akun Anda)</span>' :
                  `<button class="btn btn-sm ${u.status === 'ACTIVE' ? 'btn-outline' : 'btn-primary'}"
                    onclick="App.handleToggleUserStatus('${u.id_user}', '${u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'}')">
                    ${u.status === 'ACTIVE' ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>`
                }
              </td>
            </tr>
          `).join('');
        } else {
          tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Belum ada pengguna.</td></tr>';
        }
      } else {
        this.showToast(res.message || 'Gagal memuat daftar pengguna.', 'error');
      }
    } catch (err) {
      this.showLoading(false);
      this.showToast('Error: ' + err.message, 'error');
    }
  },

  openAddUserModal: function() {
    document.getElementById('addUserForm').reset();
    document.getElementById('addUserModal').classList.add('active');
  },

  closeAddUserModal: function() {
    document.getElementById('addUserModal').classList.remove('active');
  },

  submitAddUser: async function(e) {
    e.preventDefault();
    const payload = {
      username: document.getElementById('newUsername').value.trim(),
      password: document.getElementById('newPassword').value,
      full_name: document.getElementById('newFullName').value.trim(),
      email: document.getElementById('newEmail').value.trim(),
      role: document.getElementById('newRole').value,
      nip: document.getElementById('newNip').value.trim(),
      nuptk: document.getElementById('newNuptk').value.trim(),
      no_hp: document.getElementById('newNoHp').value.trim()
    };

    this.showLoading(true, 'Menyimpan akun baru ke Google Sheets...');
    try {
      const res = await ApiClient.request('createUser', {
        token: this.state.token,
        userData: payload
      });
      this.showLoading(false);

      if (res && res.success) {
        this.showToast('Pengguna berhasil ditambahkan!', 'success');
        this.closeAddUserModal();
        this.loadUsersTable();
      } else {
        this.showToast(res.message || 'Gagal membuat pengguna.', 'error');
      }
    } catch (err) {
      this.showLoading(false);
      this.showToast('Error server: ' + err.message, 'error');
    }
  },

  handleToggleUserStatus: async function(userId, newStatus) {
    if (!confirm('Yakin ingin mengubah status pengguna ini menjadi ' + newStatus + '?')) {
      return;
    }
    this.showLoading(true, 'Memperbarui status...');
    try {
      const res = await ApiClient.request('updateUserStatus', {
        token: this.state.token,
        userId: userId,
        status: newStatus
      });
      this.showLoading(false);

      if (res && res.success) {
        this.showToast('Status berhasil diperbarui.', 'success');
        this.loadUsersTable();
      } else {
        this.showToast(res.message || 'Gagal memperbarui status.', 'error');
      }
    } catch (err) {
      this.showLoading(false);
      this.showToast('Error: ' + err.message, 'error');
    }
  },

  // ==========================================
  // LOGIKA GURU PORTAL
  // ==========================================
  initGuruDashboard: function() {
    document.getElementById('guruCurrentUserName').innerText = this.state.user.fullName;
    this.switchGuruTab('dashboard');
    this.loadGuruDashboardData();
  },

  switchGuruTab: function(tabName) {
    document.querySelectorAll('#guruSidebar .nav-item').forEach(el => el.classList.remove('active'));
    const activeNav = document.getElementById('guruNav-' + tabName);
    if (activeNav) activeNav.classList.add('active');

    document.getElementById('guruSection-dashboard').classList.add('hidden');
    document.getElementById('guruSection-classes').classList.add('hidden');

    if (tabName === 'dashboard') {
      document.getElementById('guruSection-dashboard').classList.remove('hidden');
      this.loadGuruDashboardData();
    } else if (tabName === 'classes') {
      document.getElementById('guruSection-classes').classList.remove('hidden');
      this.loadGuruClassesList();
    }

    const sb = document.getElementById('guruSidebar');
    if (sb) sb.classList.remove('open');
  },

  loadGuruDashboardData: async function() {
    this.showLoading(true, 'Memuat dashboard guru...');
    try {
      const res = await ApiClient.request('getGuruDashboard', { token: this.state.token });
      this.showLoading(false);

      if (res && res.success) {
        const data = res.data;
        document.getElementById('guruProfileName').innerText = data.profile.namaLengkap;
        document.getElementById('guruProfileNip').innerText = data.profile.nip;
        document.getElementById('guruStatKelas').innerText = data.stats.totalKelasAjar;
        document.getElementById('guruStatJadwalHariIni').innerText = data.stats.jadwalHariIniCount;
        document.getElementById('guruTodayName').innerText = data.todayName;

        const scheduleTbody = document.getElementById('guruTodayScheduleBody');
        if (data.todaySchedule && data.todaySchedule.length > 0) {
          scheduleTbody.innerHTML = data.todaySchedule.map(s => `
            <tr>
              <td><strong>${s.waktu}</strong></td>
              <td>${s.nama_mapel}</td>
              <td><span class="badge badge-guru">${s.nama_kelas}</span></td>
              <td>${s.ruangan}</td>
            </tr>
          `).join('');
        } else {
          scheduleTbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted" style="padding:2rem;">Tidak ada jadwal mengajar pada hari ' + data.todayName + '.</td></tr>';
        }

        const classesContainer = document.getElementById('guruAssignedClassesList');
        if (data.assignedClasses && data.assignedClasses.length > 0) {
          classesContainer.innerHTML = data.assignedClasses.map(c => `
            <div class="card" style="margin-bottom:0.75rem;">
              <div class="card-body flex items-center justify-between" style="padding:1rem;">
                <div>
                  <h4 class="font-bold">${c.nama_kelas}</h4>
                  <p class="text-xs text-muted">Tingkat Kelas: ${c.tingkat}</p>
                </div>
                <span class="badge badge-guru">${c.peran}</span>
              </div>
            </div>
          `).join('');
        } else {
          classesContainer.innerHTML = '<p class="text-sm text-muted">Belum ada kelas yang ditugaskan oleh Administrator.</p>';
        }
      } else {
        this.showToast(res.message || 'Gagal memuat dashboard guru.', 'error');
      }
    } catch (err) {
      this.showLoading(false);
      this.showToast('Error server: ' + err.message, 'error');
    }
  },

  loadGuruClassesList: async function() {
    this.showLoading(true, 'Mengambil data kelas...');
    try {
      const res = await ApiClient.request('getGuruClasses', { token: this.state.token });
      this.showLoading(false);

      if (res && res.success) {
        const tbody = document.getElementById('guruClassesTableBody');
        if (res.data && res.data.length > 0) {
          tbody.innerHTML = res.data.map(c => `
            <tr>
              <td><strong>${c.nama_kelas}</strong></td>
              <td>Tingkat ${c.tingkat}</td>
              <td>${c.kapasitas || 0} Siswa</td>
              <td>
                <button class="btn btn-sm btn-outline" onclick="App.openInDevelopmentModal('Data Siswa di ' + '${c.nama_kelas}')">
                  Lihat Siswa (Fase 2)
                </button>
              </td>
            </tr>
          `).join('');
        } else {
          tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Belum ada kelas binaan.</td></tr>';
        }
      } else {
        this.showToast(res.message || 'Gagal mengambil kelas.', 'error');
      }
    } catch (err) {
      this.showLoading(false);
      this.showToast('Error: ' + err.message, 'error');
    }
  }
};

document.addEventListener('DOMContentLoaded', function() {
  App.init();
});
