/**
 * ADMINISTRASI GURU SD - Main Application Logic & SPA Router
 * Mengontrol fungsionalitas seluruh 11 Menu Admin & Fitur Guru.
 */

const App = {
  state: {
    token: null,
    user: null,
    role: null
  },

  init: function() {
    const savedToken = sessionStorage.getItem('ag_token');
    const apiUrl = APP_CONFIG.getApiUrl();

    if (savedToken && (apiUrl || (typeof google !== 'undefined' && google.script))) {
      this.showLoading(true, 'Memverifikasi sesi...');
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
        this.showToast(res.message || 'Login gagal. Periksa username dan password Anda.', 'error');
      }
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.innerText = 'Masuk ke Aplikasi';
      this.showLoading(false);
      this.showToast('Gagal menghubungi server database: ' + err.message, 'error');
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
      this.cleanupLogout();
    }
  },

  cleanupLogout: function() {
    this.showLoading(false);
    this.state.token = null;
    this.state.user = null;
    this.state.role = null;
    sessionStorage.removeItem('ag_token');
    this.showView('loginView');
    this.showToast('Anda telah keluar dari aplikasi.', 'info');
  },

  // ==========================================
  // NOTIFIKASI TOAST & UI OVERLAY
  // ==========================================
  showToast: function(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

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

  toggleSidebar: function(sidebarId) {
    const el = document.getElementById(sidebarId);
    const overlay = document.getElementById(sidebarId + 'Overlay') || document.getElementById('adminSidebarOverlay') || document.getElementById('sidebarOverlay');
    if (el) {
      const isOpen = el.classList.toggle('open');
      if (overlay) {
        if (isOpen) overlay.classList.add('active');
        else overlay.classList.remove('active');
      }
    }
  },

  closeSidebar: function(sidebarId) {
    const el = document.getElementById(sidebarId);
    const overlay = document.getElementById(sidebarId + 'Overlay') || document.getElementById('adminSidebarOverlay') || document.getElementById('sidebarOverlay');
    if (el) el.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
  },

  // ==========================================
  // LOGIKA ADMIN PORTAL (11 MODUL PENUH)
  // ==========================================
  initAdminDashboard: function() {
    const fullName = this.state.user ? this.state.user.fullName : 'Administrator';
    const curUserEl = document.getElementById('adminCurrentUserName');
    if (curUserEl) curUserEl.innerText = fullName;
    const sbUserEl = document.getElementById('adminSidebarUserName');
    if (sbUserEl) sbUserEl.innerText = fullName;
    this.switchAdminTab('dashboard');
  },

  switchAdminTab: function(tabName) {
    document.querySelectorAll('#adminSidebar .nav-item').forEach(el => el.classList.remove('active'));
    const activeNav = document.getElementById('adminNav-' + tabName);
    if (activeNav) activeNav.classList.add('active');

    // Dynamic Hero Heading update
    const heroHeadings = {
      dashboard: 'Your Stats',
      sekolah: 'Data Sekolah',
      kelas: 'Manajemen Kelas',
      siswa: 'Data Siswa',
      guru: 'Data Pendidik',
      mapel: 'Mata Pelajaran',
      jadwal: 'Kelola Jadwal',
      users: 'Manajemen Pengguna',
      absensi: 'Monitoring Absensi',
      nilai: 'Monitoring Nilai',
      pengaturan: 'Pengaturan Sistem'
    };
    const heroTitleEl = document.getElementById('adminHeroHeading');
    if (heroTitleEl && heroHeadings[tabName]) {
      heroTitleEl.innerText = heroHeadings[tabName];
    }

    const adminSections = [
      'dashboard', 'sekolah', 'kelas', 'siswa', 'guru',
      'mapel', 'jadwal', 'users', 'absensi', 'nilai', 'pengaturan'
    ];
    adminSections.forEach(s => {
      const secEl = document.getElementById('adminSection-' + s);
      if (secEl) secEl.classList.add('hidden');
    });

    const targetSection = document.getElementById('adminSection-' + tabName);
    if (targetSection) {
      targetSection.classList.remove('hidden');
    }

    // Panggil loader data untuk masing-masing modul
    if (tabName === 'dashboard') this.loadAdminStats();
    else if (tabName === 'sekolah') this.loadSekolahForm();
    else if (tabName === 'kelas') this.loadKelasTable();
    else if (tabName === 'siswa') this.loadSiswaTable();
    else if (tabName === 'guru') this.loadGuruTable();
    else if (tabName === 'mapel') this.loadMapelTable();
    else if (tabName === 'jadwal') this.loadJadwalTable();
    else if (tabName === 'users') this.loadUsersTable();
    else if (tabName === 'absensi') this.loadAbsensiMonitoring();
    else if (tabName === 'nilai') this.loadNilaiMonitoring();
    else if (tabName === 'pengaturan') this.loadSettings();

    this.closeSidebar('adminSidebar');
  },

  // [1] Dashboard Admin
  loadAdminStats: async function() {
    this.showLoading(true, 'Mengambil statistik database...');
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
        document.getElementById('adminInfoTP').innerText = 'Tahun Pelajaran: ' + data.tahunPelajaran;

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

  // [2] Data Sekolah
  loadSekolahForm: async function() {
    this.showLoading(true, 'Memuat profil sekolah...');
    try {
      const res = await ApiClient.request('getSekolah', { token: this.state.token });
      this.showLoading(false);
      if (res && res.success && res.data) {
        const d = res.data;
        document.getElementById('sekNpsn').value = d.npsn || '';
        document.getElementById('sekNama').value = d.nama_sekolah || '';
        document.getElementById('sekKepsek').value = d.kepala_sekolah || '';
        document.getElementById('sekNipKepsek').value = d.nip_kepala_sekolah || '';
        document.getElementById('sekAlamat').value = d.alamat || '';
        document.getElementById('sekDesa').value = d.desa_kelurahan || '';
        document.getElementById('sekKecamatan').value = d.kecamatan || '';
        document.getElementById('sekKabupaten').value = d.kabupaten_kota || '';
        document.getElementById('sekProvinsi').value = d.provinsi || '';
        document.getElementById('sekKodePos').value = d.kode_pos || '';
        document.getElementById('sekTelepon').value = d.telepon || '';
        document.getElementById('sekEmail').value = d.email || '';
        document.getElementById('sekWebsite').value = d.website || '';
      }
    } catch (err) {
      this.showLoading(false);
      this.showToast('Gagal memuat profil sekolah: ' + err.message, 'error');
    }
  },

  saveSekolahForm: async function(e) {
    e.preventDefault();
    const payload = {
      npsn: document.getElementById('sekNpsn').value.trim(),
      nama_sekolah: document.getElementById('sekNama').value.trim(),
      kepala_sekolah: document.getElementById('sekKepsek').value.trim(),
      nip_kepala_sekolah: document.getElementById('sekNipKepsek').value.trim(),
      alamat: document.getElementById('sekAlamat').value.trim(),
      desa_kelurahan: document.getElementById('sekDesa').value.trim(),
      kecamatan: document.getElementById('sekKecamatan').value.trim(),
      kabupaten_kota: document.getElementById('sekKabupaten').value.trim(),
      provinsi: document.getElementById('sekProvinsi').value.trim(),
      kode_pos: document.getElementById('sekKodePos').value.trim(),
      telepon: document.getElementById('sekTelepon').value.trim(),
      email: document.getElementById('sekEmail').value.trim(),
      website: document.getElementById('sekWebsite').value.trim()
    };
    this.showLoading(true, 'Menyimpan profil sekolah ke Google Sheets...');
    try {
      const res = await ApiClient.request('updateSekolah', { token: this.state.token, sekolahData: payload });
      this.showLoading(false);
      if (res && res.success) {
        this.showToast('Profil sekolah berhasil disimpan!', 'success');
        document.getElementById('adminInfoSekolah').innerText = payload.nama_sekolah;
      } else {
        this.showToast(res.message || 'Gagal menyimpan data.', 'error');
      }
    } catch (err) {
      this.showLoading(false);
      this.showToast('Error: ' + err.message, 'error');
    }
  },

  // [3] Manajemen Kelas
  loadKelasTable: async function() {
    this.showLoading(true, 'Memuat daftar rombel kelas...');
    try {
      const res = await ApiClient.request('getKelasList', { token: this.state.token });
      this.showLoading(false);
      if (res && res.success) {
        const tbody = document.getElementById('kelasListTableBody');
        if (res.data && res.data.length > 0) {
          tbody.innerHTML = res.data.map(k => `
            <tr>
              <td><code>${k.id_kelas}</code></td>
              <td><strong>${k.nama_kelas}</strong></td>
              <td>Tingkat ${k.tingkat}</td>
              <td>${k.wali_kelas_nama}</td>
              <td>${k.kapasitas} Siswa</td>
              <td><span class="badge badge-guru">${k.jumlah_siswa} Siswa</span></td>
              <td><span class="badge ${k.status === 'ACTIVE' ? 'badge-active' : 'badge-inactive'}">${k.status}</span></td>
              <td>
                <button class="btn btn-outline btn-sm text-xs" style="color:var(--danger); border-color:#fca5a5;" onclick="App.deleteKelas('${k.id_kelas}')">Hapus</button>
              </td>
            </tr>
          `).join('');
        } else {
          tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted" style="padding:2rem;">Belum ada rombel kelas terdaftar.</td></tr>';
        }
      }
    } catch (err) {
      this.showLoading(false);
      this.showToast('Gagal memuat rombel: ' + err.message, 'error');
    }
  },

  openAddKelasModal: async function() {
    document.getElementById('addKelasForm').reset();
    const waliSelect = document.getElementById('kelasWali');
    waliSelect.innerHTML = '<option value="-">-- Pilih Wali Kelas (Opsional) --</option>';
    try {
      const res = await ApiClient.request('getGuruList', { token: this.state.token });
      if (res && res.success && res.data) {
        res.data.forEach(g => {
          const opt = document.createElement('option');
          opt.value = g.id_guru;
          opt.textContent = g.nama_lengkap;
          waliSelect.appendChild(opt);
        });
      }
    } catch (e) {}
    document.getElementById('addKelasModal').classList.add('active');
  },

  closeAddKelasModal: function() {
    document.getElementById('addKelasModal').classList.remove('active');
  },

  submitAddKelas: async function(e) {
    e.preventDefault();
    const payload = {
      nama_kelas: document.getElementById('kelasNama').value.trim(),
      tingkat: document.getElementById('kelasTingkat').value,
      id_guru_wali: document.getElementById('kelasWali').value,
      kapasitas: parseInt(document.getElementById('kelasKapasitas').value) || 28
    };
    this.showLoading(true, 'Menyimpan rombel kelas...');
    try {
      const res = await ApiClient.request('createKelas', { token: this.state.token, kelasData: payload });
      this.showLoading(false);
      if (res && res.success) {
        this.showToast('Rombel kelas berhasil ditambahkan!', 'success');
        this.closeAddKelasModal();
        this.loadKelasTable();
      } else {
        this.showToast(res.message || 'Gagal menyimpan kelas.', 'error');
      }
    } catch (err) {
      this.showLoading(false);
      this.showToast('Error: ' + err.message, 'error');
    }
  },

  deleteKelas: async function(idKelas) {
    if (!confirm('Yakin ingin menghapus rombel kelas ini? Data terkait rombel akan ikut terhapus.')) return;
    this.showLoading(true, 'Menghapus kelas...');
    try {
      const res = await ApiClient.request('deleteKelas', { token: this.state.token, id_kelas: idKelas });
      this.showLoading(false);
      if (res && res.success) {
        this.showToast('Kelas berhasil dihapus.', 'success');
        this.loadKelasTable();
      } else {
        this.showToast(res.message || 'Gagal menghapus kelas.', 'error');
      }
    } catch (err) {
      this.showLoading(false);
      this.showToast('Error: ' + err.message, 'error');
    }
  },

  // [4] Data Siswa
  loadSiswaTable: async function() {
    this.showLoading(true, 'Memuat direktori siswa...');
    try {
      const res = await ApiClient.request('getSiswaList', { token: this.state.token });
      this.showLoading(false);
      if (res && res.success) {
        const tbody = document.getElementById('siswaListTableBody');
        if (res.data && res.data.length > 0) {
          tbody.innerHTML = res.data.map(s => `
            <tr>
              <td><code>${s.nis} / ${s.nisn}</code></td>
              <td><strong>${s.nama_lengkap}</strong></td>
              <td>${s.jenis_kelamin}</td>
              <td><span class="badge badge-guru">${s.nama_kelas}</span></td>
              <td>${s.nama_ayah || s.nama_ibu || '-'}</td>
              <td>${s.no_hp_ortu || '-'}</td>
              <td><span class="badge ${s.status === 'ACTIVE' ? 'badge-active' : 'badge-inactive'}">${s.status}</span></td>
              <td>
                <button class="btn btn-outline btn-sm text-xs" style="color:var(--danger); border-color:#fca5a5;" onclick="App.deleteSiswa('${s.id_siswa}')">Hapus</button>
              </td>
            </tr>
          `).join('');
        } else {
          tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted" style="padding:2rem;">Belum ada siswa terdaftar.</td></tr>';
        }
      }
    } catch (err) {
      this.showLoading(false);
      this.showToast('Gagal memuat siswa: ' + err.message, 'error');
    }
  },

  openAddSiswaModal: async function() {
    document.getElementById('addSiswaForm').reset();
    const kSelect = document.getElementById('siswaKelas');
    kSelect.innerHTML = '<option value="-">-- Pilih Kelas --</option>';
    try {
      const res = await ApiClient.request('getKelasList', { token: this.state.token });
      if (res && res.success && res.data) {
        res.data.forEach(k => {
          const opt = document.createElement('option');
          opt.value = k.id_kelas;
          opt.textContent = k.nama_kelas;
          kSelect.appendChild(opt);
        });
      }
    } catch (e) {}
    document.getElementById('addSiswaModal').classList.add('active');
  },

  closeAddSiswaModal: function() {
    document.getElementById('addSiswaModal').classList.remove('active');
  },

  submitAddSiswa: async function(e) {
    e.preventDefault();
    const payload = {
      nis: document.getElementById('siswaNis').value.trim(),
      nisn: document.getElementById('siswaNisn').value.trim(),
      nama_lengkap: document.getElementById('siswaNama').value.trim(),
      jenis_kelamin: document.getElementById('siswaJk').value,
      id_kelas: document.getElementById('siswaKelas').value,
      tempat_lahir: document.getElementById('siswaTempatLahir').value.trim(),
      tgl_lahir: document.getElementById('siswaTglLahir').value,
      agama: document.getElementById('siswaAgama').value,
      no_hp_ortu: document.getElementById('siswaHpOrtu').value.trim(),
      nama_ayah: document.getElementById('siswaNamaAyah').value.trim(),
      nama_ibu: document.getElementById('siswaNamaIbu').value.trim(),
      alamat: document.getElementById('siswaAlamat').value.trim()
    };
    this.showLoading(true, 'Menyimpan data siswa ke database...');
    try {
      const res = await ApiClient.request('createSiswa', { token: this.state.token, siswaData: payload });
      this.showLoading(false);
      if (res && res.success) {
        this.showToast('Siswa berhasil didaftarkan!', 'success');
        this.closeAddSiswaModal();
        this.loadSiswaTable();
      } else {
        this.showToast(res.message || 'Gagal mendaftarkan siswa.', 'error');
      }
    } catch (err) {
      this.showLoading(false);
      this.showToast('Error: ' + err.message, 'error');
    }
  },

  deleteSiswa: async function(idSiswa) {
    if (!confirm('Yakin ingin menghapus data siswa ini dari database?')) return;
    this.showLoading(true, 'Menghapus data siswa...');
    try {
      const res = await ApiClient.request('deleteSiswa', { token: this.state.token, id_siswa: idSiswa });
      this.showLoading(false);
      if (res && res.success) {
        this.showToast('Data siswa berhasil dihapus.', 'success');
        this.loadSiswaTable();
      } else {
        this.showToast(res.message || 'Gagal menghapus siswa.', 'error');
      }
    } catch (err) {
      this.showLoading(false);
      this.showToast('Error: ' + err.message, 'error');
    }
  },

  // [5] Data Guru
  loadGuruTable: async function() {
    this.showLoading(true, 'Memuat data tenaga pendidik...');
    try {
      const res = await ApiClient.request('getGuruList', { token: this.state.token });
      this.showLoading(false);
      if (res && res.success) {
        const tbody = document.getElementById('guruListTableBody');
        if (res.data && res.data.length > 0) {
          tbody.innerHTML = res.data.map(g => {
            const safeObj = encodeURIComponent(JSON.stringify(g));
            return `
              <tr>
                <td><code>${g.nip || '-'} / ${g.nuptk || '-'}</code></td>
                <td><strong>${g.nama_lengkap}${g.gelar_belakang ? ', ' + g.gelar_belakang : ''}</strong></td>
                <td>${g.jenis_kelamin}</td>
                <td>${g.jabatan || 'Guru Kelas'}</td>
                <td><span class="badge badge-guru">${g.status_kepegawaian || 'Guru'}</span></td>
                <td>${g.no_hp || '-'}</td>
                <td><span class="badge ${g.status === 'ACTIVE' ? 'badge-active' : 'badge-inactive'}">${g.status}</span></td>
                <td>
                  <button class="btn btn-outline btn-sm text-xs" onclick="App.openEditGuruModal('${safeObj}')">Edit</button>
                </td>
              </tr>
            `;
          }).join('');
        } else {
          tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted" style="padding:2rem;">Belum ada guru terdaftar.</td></tr>';
        }
      }
    } catch (err) {
      this.showLoading(false);
      this.showToast('Gagal memuat data guru: ' + err.message, 'error');
    }
  },

  openEditGuruModal: function(encodedGuruObj) {
    const g = JSON.parse(decodeURIComponent(encodedGuruObj));
    document.getElementById('editGuruId').value = g.id_guru;
    document.getElementById('editGuruNama').value = g.nama_lengkap || '';
    document.getElementById('editGuruGelarDepan').value = g.gelar_depan || '';
    document.getElementById('editGuruGelarBelakang').value = g.gelar_belakang || '';
    document.getElementById('editGuruNip').value = g.nip || '';
    document.getElementById('editGuruNuptk').value = g.nuptk || '';
    document.getElementById('editGuruJk').value = g.jenis_kelamin || 'L';
    document.getElementById('editGuruHp').value = g.no_hp || '';
    document.getElementById('editGuruEmail').value = g.email || '';
    document.getElementById('editGuruStatusPegawai').value = g.status_kepegawaian || 'PNS';
    document.getElementById('editGuruJabatan').value = g.jabatan || 'Guru Kelas';
    document.getElementById('editGuruAlamat').value = g.alamat || '';
    document.getElementById('editGuruModal').classList.add('active');
  },

  closeEditGuruModal: function() {
    document.getElementById('editGuruModal').classList.remove('active');
  },

  submitEditGuru: async function(e) {
    e.preventDefault();
    const payload = {
      id_guru: document.getElementById('editGuruId').value,
      nama_lengkap: document.getElementById('editGuruNama').value.trim(),
      gelar_depan: document.getElementById('editGuruGelarDepan').value.trim(),
      gelar_belakang: document.getElementById('editGuruGelarBelakang').value.trim(),
      nip: document.getElementById('editGuruNip').value.trim(),
      nuptk: document.getElementById('editGuruNuptk').value.trim(),
      jenis_kelamin: document.getElementById('editGuruJk').value,
      no_hp: document.getElementById('editGuruHp').value.trim(),
      email: document.getElementById('editGuruEmail').value.trim(),
      status_kepegawaian: document.getElementById('editGuruStatusPegawai').value,
      jabatan: document.getElementById('editGuruJabatan').value.trim(),
      alamat: document.getElementById('editGuruAlamat').value.trim()
    };
    this.showLoading(true, 'Menyimpan profil guru ke Google Sheets...');
    try {
      const res = await ApiClient.request('updateGuru', { token: this.state.token, guruData: payload });
      this.showLoading(false);
      if (res && res.success) {
        this.showToast('Profil guru berhasil diperbarui!', 'success');
        this.closeEditGuruModal();
        this.loadGuruTable();
      } else {
        this.showToast(res.message || 'Gagal memperbarui profil guru.', 'error');
      }
    } catch (err) {
      this.showLoading(false);
      this.showToast('Error: ' + err.message, 'error');
    }
  },

  // [6] Mata Pelajaran
  loadMapelTable: async function() {
    this.showLoading(true, 'Memuat mata pelajaran...');
    try {
      const res = await ApiClient.request('getMapelList', { token: this.state.token });
      this.showLoading(false);
      if (res && res.success) {
        const tbody = document.getElementById('mapelListTableBody');
        if (res.data && res.data.length > 0) {
          tbody.innerHTML = res.data.map(m => `
            <tr>
              <td><code>${m.kode_mapel}</code></td>
              <td><strong>${m.nama_mapel}</strong></td>
              <td><span class="badge badge-admin">${m.kelompok || 'Wajib'}</span></td>
              <td>${m.tingkat || 'Fase A, B, C'}</td>
              <td><strong>${m.kkm || 75}</strong></td>
              <td><span class="badge ${m.status === 'ACTIVE' ? 'badge-active' : 'badge-inactive'}">${m.status || 'ACTIVE'}</span></td>
              <td>
                <button class="btn btn-outline btn-sm text-xs" style="color:var(--danger); border-color:#fca5a5;" onclick="App.deleteMapel('${m.id_mapel}')">Hapus</button>
              </td>
            </tr>
          `).join('');
        } else {
          tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted" style="padding:2rem;">Belum ada mata pelajaran terdaftar.</td></tr>';
        }
      }
    } catch (err) {
      this.showLoading(false);
      this.showToast('Gagal memuat mapel: ' + err.message, 'error');
    }
  },

  openAddMapelModal: function() {
    document.getElementById('addMapelForm').reset();
    document.getElementById('addMapelModal').classList.add('active');
  },

  closeAddMapelModal: function() {
    document.getElementById('addMapelModal').classList.remove('active');
  },

  submitAddMapel: async function(e) {
    e.preventDefault();
    const payload = {
      kode_mapel: document.getElementById('mapelKode').value.trim().toUpperCase(),
      nama_mapel: document.getElementById('mapelNama').value.trim(),
      kelompok: document.getElementById('mapelKelompok').value,
      tingkat: document.getElementById('mapelTingkat').value.trim(),
      kkm: parseInt(document.getElementById('mapelKkm').value) || 75
    };
    this.showLoading(true, 'Menyimpan mata pelajaran...');
    try {
      const res = await ApiClient.request('createMapel', { token: this.state.token, mapelData: payload });
      this.showLoading(false);
      if (res && res.success) {
        this.showToast('Mata pelajaran berhasil ditambahkan!', 'success');
        this.closeAddMapelModal();
        this.loadMapelTable();
      } else {
        this.showToast(res.message || 'Gagal menyimpan mapel.', 'error');
      }
    } catch (err) {
      this.showLoading(false);
      this.showToast('Error: ' + err.message, 'error');
    }
  },

  deleteMapel: async function(idMapel) {
    if (!confirm('Yakin ingin menghapus mata pelajaran ini?')) return;
    this.showLoading(true, 'Menghapus mata pelajaran...');
    try {
      const res = await ApiClient.request('deleteMapel', { token: this.state.token, id_mapel: idMapel });
      this.showLoading(false);
      if (res && res.success) {
        this.showToast('Mata pelajaran berhasil dihapus.', 'success');
        this.loadMapelTable();
      } else {
        this.showToast(res.message || 'Gagal menghapus mapel.', 'error');
      }
    } catch (err) {
      this.showLoading(false);
      this.showToast('Error: ' + err.message, 'error');
    }
  },

  // [7] Kelola Jadwal
  loadJadwalTable: async function() {
    this.showLoading(true, 'Memuat jadwal pembelajaran...');
    try {
      const res = await ApiClient.request('getJadwalList', { token: this.state.token });
      this.showLoading(false);
      if (res && res.success) {
        const tbody = document.getElementById('jadwalListTableBody');
        if (res.data && res.data.length > 0) {
          tbody.innerHTML = res.data.map(j => `
            <tr>
              <td><span class="badge badge-guru"><strong>${j.hari}</strong></span></td>
              <td>Jam Ke ${j.jam_ke_mulai} - ${j.jam_ke_selesai}</td>
              <td>${j.waktu_mulai} - ${j.waktu_selesai}</td>
              <td><strong>${j.nama_kelas}</strong></td>
              <td>${j.nama_mapel}</td>
              <td>${j.nama_guru}</td>
              <td>${j.ruangan}</td>
              <td>
                <button class="btn btn-outline btn-sm text-xs" style="color:var(--danger); border-color:#fca5a5;" onclick="App.deleteJadwal('${j.id_jadwal}')">Hapus</button>
              </td>
            </tr>
          `).join('');
        } else {
          tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted" style="padding:2rem;">Belum ada jadwal pembelajaran.</td></tr>';
        }
      }
    } catch (err) {
      this.showLoading(false);
      this.showToast('Gagal memuat jadwal: ' + err.message, 'error');
    }
  },

  openAddJadwalModal: async function() {
    document.getElementById('addJadwalForm').reset();
    const kSelect = document.getElementById('jadwalKelas');
    const mSelect = document.getElementById('jadwalMapel');
    const gSelect = document.getElementById('jadwalGuru');

    kSelect.innerHTML = '<option value="">-- Pilih Rombel --</option>';
    mSelect.innerHTML = '<option value="">-- Pilih Mata Pelajaran --</option>';
    gSelect.innerHTML = '<option value="">-- Pilih Guru --</option>';

    try {
      const [kRes, mRes, gRes] = await Promise.all([
        ApiClient.request('getKelasList', { token: this.state.token }),
        ApiClient.request('getMapelList', { token: this.state.token }),
        ApiClient.request('getGuruList', { token: this.state.token })
      ]);
      if (kRes && kRes.success && kRes.data) kRes.data.forEach(k => kSelect.innerHTML += `<option value="${k.id_kelas}">${k.nama_kelas}</option>`);
      if (mRes && mRes.success && mRes.data) mRes.data.forEach(m => mSelect.innerHTML += `<option value="${m.id_mapel}">${m.nama_mapel}</option>`);
      if (gRes && gRes.success && gRes.data) gRes.data.forEach(g => gSelect.innerHTML += `<option value="${g.id_guru}">${g.nama_lengkap}</option>`);
    } catch (e) {}

    document.getElementById('addJadwalModal').classList.add('active');
  },

  closeAddJadwalModal: function() {
    document.getElementById('addJadwalModal').classList.remove('active');
  },

  submitAddJadwal: async function(e) {
    e.preventDefault();
    const payload = {
      hari: document.getElementById('jadwalHari').value,
      id_kelas: document.getElementById('jadwalKelas').value,
      id_mapel: document.getElementById('jadwalMapel').value,
      id_guru: document.getElementById('jadwalGuru').value,
      jam_ke_mulai: document.getElementById('jadwalJamMulai').value,
      jam_ke_selesai: document.getElementById('jadwalJamSelesai').value,
      waktu_mulai: document.getElementById('jadwalWaktuMulai').value.trim(),
      waktu_selesai: document.getElementById('jadwalWaktuSelesai').value.trim(),
      ruangan: document.getElementById('jadwalRuang').value.trim()
    };
    this.showLoading(true, 'Menyimpan jadwal ke Google Sheets...');
    try {
      const res = await ApiClient.request('createJadwal', { token: this.state.token, jadwalData: payload });
      this.showLoading(false);
      if (res && res.success) {
        this.showToast('Jadwal pelajaran berhasil ditambahkan!', 'success');
        this.closeAddJadwalModal();
        this.loadJadwalTable();
      } else {
        this.showToast(res.message || 'Gagal menyimpan jadwal.', 'error');
      }
    } catch (err) {
      this.showLoading(false);
      this.showToast('Error: ' + err.message, 'error');
    }
  },

  deleteJadwal: async function(idJadwal) {
    if (!confirm('Yakin ingin menghapus jadwal ini?')) return;
    this.showLoading(true, 'Menghapus jadwal...');
    try {
      const res = await ApiClient.request('deleteJadwal', { token: this.state.token, id_jadwal: idJadwal });
      this.showLoading(false);
      if (res && res.success) {
        this.showToast('Jadwal berhasil dihapus.', 'success');
        this.loadJadwalTable();
      } else {
        this.showToast(res.message || 'Gagal menghapus jadwal.', 'error');
      }
    } catch (err) {
      this.showLoading(false);
      this.showToast('Error: ' + err.message, 'error');
    }
  },

  // [8] Manajemen Pengguna
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

  // [9] Monitoring Absensi
  loadAbsensiMonitoring: async function() {
    this.showLoading(true, 'Mengambil rekapitulasi absensi...');
    try {
      const res = await ApiClient.request('getMonitoringAbsensi', { token: this.state.token });
      this.showLoading(false);
      if (res && res.success && res.data) {
        const sum = res.data.summary;
        document.getElementById('absensiSummaryTotal').innerText = sum.totalSiswa;
        document.getElementById('absensiSummaryHadir').innerText = sum.totalHadir;
        document.getElementById('absensiSummarySakit').innerText = (sum.totalSakit + sum.totalIzin);
        document.getElementById('absensiSummaryPersen').innerText = sum.persentase;

        const tbody = document.getElementById('monitoringAbsensiTableBody');
        if (res.data.rekap && res.data.rekap.length > 0) {
          tbody.innerHTML = res.data.rekap.map(r => `
            <tr>
              <td><strong>${r.nama_kelas}</strong></td>
              <td>Tingkat ${r.tingkat}</td>
              <td>${r.total_siswa}</td>
              <td style="color:#059669; font-weight:600;">${r.hadir}</td>
              <td>${r.sakit}</td>
              <td>${r.izin}</td>
              <td>${r.alpa}</td>
              <td><strong>${r.persen}</strong></td>
              <td><span class="badge badge-active">${r.status}</span></td>
            </tr>
          `).join('');
        }
      }
    } catch (err) {
      this.showLoading(false);
      this.showToast('Gagal memuat absensi: ' + err.message, 'error');
    }
  },

  openQuickAbsensiModal: async function() {
    document.getElementById('quickAbsensiForm').reset();
    const kSelect = document.getElementById('absensiKelasSelect');
    kSelect.innerHTML = '<option value="">-- Pilih Kelas --</option>';
    try {
      const res = await ApiClient.request('getKelasList', { token: this.state.token });
      if (res && res.success && res.data) {
        res.data.forEach(k => kSelect.innerHTML += `<option value="${k.id_kelas}">${k.nama_kelas}</option>`);
      }
    } catch (e) {}
    document.getElementById('quickAbsensiModal').classList.add('active');
  },

  closeQuickAbsensiModal: function() {
    document.getElementById('quickAbsensiModal').classList.remove('active');
  },

  submitQuickAbsensi: async function(e) {
    e.preventDefault();
    const payload = {
      id_kelas: document.getElementById('absensiKelasSelect').value,
      catatan: document.getElementById('absensiCatatan').value.trim()
    };
    this.showLoading(true, 'Menyimpan sesi presensi...');
    try {
      const res = await ApiClient.request('recordQuickAbsensi', { token: this.state.token, absensiData: payload });
      this.showLoading(false);
      if (res && res.success) {
        this.showToast('Presensi kelas berhasil dicatat!', 'success');
        this.closeQuickAbsensiModal();
        this.loadAbsensiMonitoring();
      } else {
        this.showToast(res.message || 'Gagal menyimpan presensi.', 'error');
      }
    } catch (err) {
      this.showLoading(false);
      this.showToast('Error: ' + err.message, 'error');
    }
  },

  // [10] Monitoring Nilai
  loadNilaiMonitoring: async function() {
    this.showLoading(true, 'Memuat capaian nilai siswa...');
    try {
      const res = await ApiClient.request('getMonitoringNilai', { token: this.state.token });
      this.showLoading(false);
      if (res && res.success && res.data) {
        const sum = res.data.summary;
        document.getElementById('nilaiSummaryTotalSiswa').innerText = sum.totalSiswaDinilai;
        document.getElementById('nilaiSummaryRataRata').innerText = sum.rataRataSekolah;
        document.getElementById('nilaiSummaryKetuntasan').innerText = sum.ketuntasanPersen;

        const tbody = document.getElementById('monitoringNilaiTableBody');
        if (res.data.leger && res.data.leger.length > 0) {
          tbody.innerHTML = res.data.leger.map(n => `
            <tr>
              <td><code>${n.nis || '-'}</code></td>
              <td><strong>${n.nama_siswa}</strong></td>
              <td><span class="badge badge-guru">${n.nama_kelas}</span></td>
              <td>${n.formatif}</td>
              <td>${n.sumatif}</td>
              <td><strong>${n.nilai_akhir}</strong></td>
              <td><span class="badge badge-admin">Predikat ${n.predikat}</span></td>
              <td><span class="badge ${n.status === 'Tuntas' ? 'badge-active' : 'badge-dev'}">${n.status}</span></td>
            </tr>
          `).join('');
        }
      }
    } catch (err) {
      this.showLoading(false);
      this.showToast('Gagal memuat nilai: ' + err.message, 'error');
    }
  },

  openInputNilaiModal: async function() {
    document.getElementById('inputNilaiForm').reset();
    const sSelect = document.getElementById('nilaiSiswaSelect');
    sSelect.innerHTML = '<option value="">-- Pilih Siswa --</option>';
    try {
      const res = await ApiClient.request('getSiswaList', { token: this.state.token });
      if (res && res.success && res.data) {
        res.data.forEach(s => sSelect.innerHTML += `<option value="${s.id_siswa}">${s.nama_lengkap} (${s.nama_kelas})</option>`);
      }
    } catch (e) {}
    document.getElementById('inputNilaiModal').classList.add('active');
  },

  closeInputNilaiModal: function() {
    document.getElementById('inputNilaiModal').classList.remove('active');
  },

  submitInputNilai: async function(e) {
    e.preventDefault();
    const payload = {
      id_siswa: document.getElementById('nilaiSiswaSelect').value,
      skor: parseInt(document.getElementById('nilaiSkor').value) || 80,
      catatan: document.getElementById('nilaiCatatan').value.trim()
    };
    this.showLoading(true, 'Menyimpan nilai ke Google Sheets...');
    try {
      const res = await ApiClient.request('recordNilai', { token: this.state.token, nilaiData: payload });
      this.showLoading(false);
      if (res && res.success) {
        this.showToast('Nilai siswa berhasil disimpan!', 'success');
        this.closeInputNilaiModal();
        this.loadNilaiMonitoring();
      } else {
        this.showToast(res.message || 'Gagal menyimpan nilai.', 'error');
      }
    } catch (err) {
      this.showLoading(false);
      this.showToast('Error: ' + err.message, 'error');
    }
  },

  // [11] Pengaturan Sistem
  loadSettings: async function() {
    this.showLoading(true, 'Memeriksa kesehatan database...');
    try {
      const res = await ApiClient.request('getSystemSettings', { token: this.state.token });
      this.showLoading(false);
      if (res && res.success && res.data) {
        const d = res.data;
        document.getElementById('settingsSpreadsheetId').innerText = d.spreadsheetId;
        const link = document.getElementById('settingsSpreadsheetUrlLink');
        if (link) link.href = d.spreadsheetUrl || '#';
        document.getElementById('settingNamaTp').value = d.tahunPelajaran;
        document.getElementById('settingSemester').value = d.semester;

        const tbody = document.getElementById('settingsTableListBody');
        if (d.tables && d.tables.length > 0) {
          tbody.innerHTML = d.tables.map(t => `
            <tr>
              <td><code>${t.nama_tabel}</code></td>
              <td><strong>${t.jumlah_baris}</strong> baris data</td>
              <td><span class="badge badge-active">${t.status}</span></td>
            </tr>
          `).join('');
        }
      }
    } catch (err) {
      this.showLoading(false);
      this.showToast('Gagal memuat pengaturan: ' + err.message, 'error');
    }
  },

  submitSettings: async function(e) {
    e.preventDefault();
    const payload = {
      nama_tp: document.getElementById('settingNamaTp').value.trim(),
      semester: document.getElementById('settingSemester').value
    };
    this.showLoading(true, 'Menyimpan pengaturan tahun pelajaran...');
    try {
      const res = await ApiClient.request('updateAcademicYear', { token: this.state.token, tpData: payload });
      this.showLoading(false);
      if (res && res.success) {
        this.showToast('Tahun Pelajaran & Semester berhasil diperbarui!', 'success');
        document.getElementById('adminInfoTP').innerText = 'Tahun Pelajaran: ' + payload.nama_tp + ' ' + payload.semester;
      } else {
        this.showToast(res.message || 'Gagal memperbarui pengaturan.', 'error');
      }
    } catch (err) {
      this.showLoading(false);
      this.showToast('Error: ' + err.message, 'error');
    }
  },

  syncDatabaseAction: async function() {
    this.showLoading(true, 'Memverifikasi seluruh 17 tabel database...');
    try {
      const res = await ApiClient.request('syncDatabase', { token: this.state.token });
      this.showLoading(false);
      if (res && res.success) {
        this.showToast('Struktur 17 tabel database berhasil diverifikasi!', 'success');
        this.loadSettings();
      } else {
        this.showToast(res.message || 'Sinkronisasi gagal.', 'error');
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
    const fullName = this.state.user ? this.state.user.fullName : 'Guru SD';
    const curUserEl = document.getElementById('guruCurrentUserName');
    if (curUserEl) curUserEl.innerText = fullName;
    const sbUserEl = document.getElementById('guruSidebarUserName');
    if (sbUserEl) sbUserEl.innerText = fullName;
    this.switchGuruTab('dashboard');
    this.loadGuruDashboardData();
  },

  switchGuruTab: function(tabName) {
    document.querySelectorAll('#guruSidebar .nav-item').forEach(el => el.classList.remove('active'));
    const activeNav = document.getElementById('guruNav-' + tabName);
    if (activeNav) activeNav.classList.add('active');

    const heroTitleEl = document.getElementById('guruHeroHeading');
    if (heroTitleEl) {
      heroTitleEl.innerText = tabName === 'dashboard' ? 'Dashboard Pembelajaran' : 'Data Kelas Binaan';
    }

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
                <span class="badge badge-guru">${c.peran || 'Wali Kelas'}</span>
              </div>
            </div>
          `).join('');
        } else {
          classesContainer.innerHTML = '<p class="text-sm text-muted">Belum ada penugasan kelas.</p>';
        }
      }
    } catch (err) {
      this.showLoading(false);
      this.showToast('Gagal memuat dashboard guru: ' + err.message, 'error');
    }
  },

  loadGuruClassesList: async function() {
    this.showLoading(true, 'Memuat kelas binaan...');
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
              <td>${c.kapasitas || 28} Siswa</td>
              <td>
                <button class="btn btn-primary btn-sm text-xs" onclick="App.openInDevelopmentModal('Kelola Siswa ${c.nama_kelas}')">
                  Buka Rombel
                </button>
              </td>
            </tr>
          `).join('');
        } else {
          tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Belum ada kelas yang ditugaskan.</td></tr>';
        }
      }
    } catch (err) {
      this.showLoading(false);
      this.showToast('Error: ' + err.message, 'error');
    }
  }
};

// Inisialisasi Aplikasi Saat Halaman Selesai Dimuat
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
