/**
 * ADMINISTRASI GURU SD - Guru Module
 * Operasi khusus Guru: Dashboard guru, data kelas binaan/ajar,
 * dan placeholder fitur pembelajaran yang sedang dikembangkan (Fase 2).
 */

/**
 * Mengambil ringkasan data untuk Dashboard Guru.
 * Akses dibatasi secara ketat hanya untuk data yang ditugaskan kepada guru yang bersangkutan.
 * @param {string} token
 * @returns {object}
 */
function getGuruDashboardSummary(token) {
  var auth = verifySession(token, CONFIG.ROLES.GURU);
  if (!auth.valid) {
    return createResponse(false, auth.error);
  }

  try {
    var userId = auth.session.userId;

    // 1. Cari data profil guru berdasarkan id_user
    var guruRecord = findRecordByField(CONFIG.SHEETS.GURU, 'id_user', userId);
    var guruId = guruRecord ? guruRecord.id_guru : null;

    // 2. Cari kelas yang ditugaskan kepada guru ini (melalui PENUGASAN_GURU atau wali kelas di KELAS)
    var assignedClasses = [];
    if (guruId) {
      // Periksa sebagai wali kelas
      var allKelas = getSheetDataAsObjects(CONFIG.SHEETS.KELAS);
      for (var k = 0; k < allKelas.length; k++) {
        if (allKelas[k].id_guru_wali === guruId && allKelas[k].status === 'ACTIVE') {
          assignedClasses.push({
            id_kelas: allKelas[k].id_kelas,
            nama_kelas: allKelas[k].nama_kelas,
            tingkat: allKelas[k].tingkat,
            peran: 'Wali Kelas'
          });
        }
      }

      // Periksa penugasan mata pelajaran di kelas
      var penugasanList = getSheetDataAsObjects(CONFIG.SHEETS.PENUGASAN_GURU);
      for (var p = 0; p < penugasanList.length; p++) {
        if (penugasanList[p].id_guru === guruId && penugasanList[p].status === 'ACTIVE') {
          // Cari nama kelas jika belum ada
          var alreadyAdded = false;
          for (var a = 0; a < assignedClasses.length; a++) {
            if (assignedClasses[a].id_kelas === penugasanList[p].id_kelas) {
              alreadyAdded = true;
              break;
            }
          }
          if (!alreadyAdded) {
            var kRow = findRecordByField(CONFIG.SHEETS.KELAS, 'id_kelas', penugasanList[p].id_kelas);
            assignedClasses.push({
              id_kelas: penugasanList[p].id_kelas,
              nama_kelas: kRow ? kRow.nama_kelas : penugasanList[p].id_kelas,
              tingkat: kRow ? kRow.tingkat : '-',
              peran: penugasanList[p].peran_guru || 'Guru Mata Pelajaran'
            });
          }
        }
      }
    }

    // 3. Ambil jadwal mengajar hari ini
    var dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    var todayName = dayNames[new Date().getDay()];
    var todaySchedule = [];

    if (guruId) {
      var allJadwal = getSheetDataAsObjects(CONFIG.SHEETS.JADWAL);
      for (var j = 0; j < allJadwal.length; j++) {
        var item = allJadwal[j];
        if (item.id_guru === guruId && String(item.hari).toLowerCase() === todayName.toLowerCase()) {
          var mapelRow = findRecordByField(CONFIG.SHEETS.MATA_PELAJARAN, 'id_mapel', item.id_mapel);
          var kelasRow = findRecordByField(CONFIG.SHEETS.KELAS, 'id_kelas', item.id_kelas);
          todaySchedule.push({
            id_jadwal: item.id_jadwal,
            hari: item.hari,
            waktu: item.waktu_mulai + ' - ' + item.waktu_selesai,
            nama_mapel: mapelRow ? mapelRow.nama_mapel : item.id_mapel,
            nama_kelas: kelasRow ? kelasRow.nama_kelas : item.id_kelas,
            ruangan: item.ruangan || 'Kelas'
          });
        }
      }
    }

    return createResponse(true, {
      profile: {
        namaLengkap: guruRecord ? guruRecord.nama_lengkap : auth.session.fullName,
        nip: guruRecord ? guruRecord.nip : '-',
        nuptk: guruRecord ? guruRecord.nuptk : '-',
        jabatan: guruRecord ? guruRecord.jabatan : 'Guru'
      },
      stats: {
        totalKelasAjar: assignedClasses.length,
        jadwalHariIniCount: todaySchedule.length
      },
      assignedClasses: assignedClasses,
      todaySchedule: todaySchedule,
      todayName: todayName
    });
  } catch (err) {
    return createResponse(false, 'Gagal memuat dashboard guru: ' + err.message);
  }
}

/**
 * Mengambil daftar kelas dan siswa yang diajar oleh guru ini saja.
 * Memastikan proteksi data privasi siswa (guru lain tidak dapat melihat siswa yang tidak diajar).
 * @param {string} token
 * @returns {object}
 */
function getGuruClasses(token) {
  var auth = verifySession(token, CONFIG.ROLES.GURU);
  if (!auth.valid) {
    return createResponse(false, auth.error);
  }

  try {
    var userId = auth.session.userId;
    var guruRecord = findRecordByField(CONFIG.SHEETS.GURU, 'id_user', userId);
    if (!guruRecord) {
      return createResponse(true, []);
    }

    var guruId = guruRecord.id_guru;
    var assignedClassIds = [];

    // Kumpulkan kelas wali
    var allKelas = getSheetDataAsObjects(CONFIG.SHEETS.KELAS);
    for (var k = 0; k < allKelas.length; k++) {
      if (allKelas[k].id_guru_wali === guruId && allKelas[k].status === 'ACTIVE') {
        assignedClassIds.push(allKelas[k].id_kelas);
      }
    }

    // Kumpulkan kelas mapel
    var penugasanList = getSheetDataAsObjects(CONFIG.SHEETS.PENUGASAN_GURU);
    for (var p = 0; p < penugasanList.length; p++) {
      if (penugasanList[p].id_guru === guruId && penugasanList[p].status === 'ACTIVE') {
        if (assignedClassIds.indexOf(penugasanList[p].id_kelas) === -1) {
          assignedClassIds.push(penugasanList[p].id_kelas);
        }
      }
    }

    // Ambil data detail untuk kelas-kelas tersebut saja
    var result = [];
    for (var i = 0; i < assignedClassIds.length; i++) {
      var cId = assignedClassIds[i];
      var cRow = findRecordByField(CONFIG.SHEETS.KELAS, 'id_kelas', cId);
      if (cRow) {
        result.push({
          id_kelas: cRow.id_kelas,
          tingkat: cRow.tingkat,
          nama_kelas: cRow.nama_kelas,
          kapasitas: cRow.kapasitas
        });
      }
    }

    return createResponse(true, result);
  } catch (err) {
    return createResponse(false, 'Gagal memuat data kelas guru: ' + err.message);
  }
}

/**
 * Placeholder fungsi Fase 2 untuk guru.
 * @param {string} token
 * @param {string} featureName
 * @returns {object}
 */
function handleGuruPhase2Feature(token, featureName) {
  var auth = verifySession(token, CONFIG.ROLES.GURU);
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
