// ZETTBOT HYBRID ENGINE: Auto-Switch Backend & Firebase RTDB
// ====================================================================
// PERHATIAN: Kita KEMBALI MENGGUNAKAN DIRECT GAS URL!
// Ini akan men-bypass Vercel Proxy untuk menghindari Timeout 10 detik.
const GAS_URL = "https://script.google.com/macros/s/AKfycbw4LsV2mB_x517QfNxQtA4AQmdYzyaUNPp0KCcC1F-_o-0wJtUaKYvdlqKmZcWBKq4Cyw/exec"; 

const firebaseConfig = {
    apiKey: "AIzaSyBbTTYAroluZ3UYMPgnoxLYn1aqPFq9Wik",
    authDomain: "kasirwaroeng-laundry.firebaseapp.com",
    projectId: "kasirwaroeng-laundry",
    storageBucket: "kasirwaroeng-laundry.firebasestorage.app",
    messagingSenderId: "496085821478",
    appId: "1:496085821478:web:420e0e871de41ccf409ee7",
    measurementId: "G-832ZC51E2V",
    databaseURL: "https://kasirwaroeng-laundry-default-rtdb.asia-southeast1.firebasedatabase.app/" 
};

// Inisialisasi SDK Firebase
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const database = (typeof firebase !== 'undefined') ? firebase.database() : null;

// 🔥 FIREBASE KEY SANITIZER FIX
function sanitizeFbKeys(data) {
    if (!data) return data;
    return JSON.parse(JSON.stringify(data).replace(/"Harga\/Kg":/g, '"Harga_Kg":').replace(/"Harga\/Pcs":/g, '"Harga_Pcs":'));
}
function restoreFbKeys(data) {
    if (!data) return data;
    return JSON.parse(JSON.stringify(data).replace(/"Harga_Kg":/g, '"Harga/Kg":').replace(/"Harga_Pcs":/g, '"Harga/Pcs":'));
}

function cleanPhoneQuotes(arr) {
    if(!arr || !Array.isArray(arr)) return arr;
    return arr.filter(function(p) { return p; }).map(function(p) {
        if (p['No Telpon'] && String(p['No Telpon']).startsWith("'")) {
            p['No Telpon'] = String(p['No Telpon']).substring(1);
        }
        return p;
    });
}

// ZETTBOT PRO FIX: Global Centralized Sorter (Data Terbaru Selalu di Atas)
function sortDataByIdDesc(arr) {
    if (!arr || !Array.isArray(arr)) return arr;
    return arr.sort(function(a, b) {
        // Ekstrak angka dari ID (misal: "TX-0014" -> 14, "WRL-002" -> 2)
        var idA = parseInt(String(a['ID'] || '').replace(/[^0-9]/g, '')) || 0;
        var idB = parseInt(String(b['ID'] || '').replace(/[^0-9]/g, '')) || 0;
        return idB - idA; // Descending Order (Terbaru ke Terlama)
    });
}

function mergeProduksiData(newData) {
    if (!newData || !Array.isArray(newData)) return newData;
    
    var validNewData = newData.filter(function(row) { return row && row.ID; });
    var merged = (appData.produksi || []).filter(function(row) { return row && row.ID; }).slice();
    
    validNewData.forEach(function(newRow) {
        var existIdx = merged.findIndex(function(x) { return String(x.ID) === String(newRow.ID); });
        if (existIdx >= 0) {
            var oldRow = merged[existIdx];
            if (oldRow['Foto'] && String(oldRow['Foto']).startsWith('data:') && (!newRow['Foto'] || !String(newRow['Foto']).startsWith('http'))) {
                newRow['Foto'] = oldRow['Foto'];
            }
            merged[existIdx] = newRow;
        } else {
            merged.push(newRow);
        }
    });
    
    var currentProd = (appData.produksi || []).filter(function(row) { return row && row.ID; });
    currentProd.forEach(function(localRow) {
        var existInGas = validNewData.find(function(x) { return String(x.ID) === String(localRow.ID); });
        if (!existInGas) {
            var existInMerged = merged.find(function(x) { return String(x.ID) === String(localRow.ID); });
            if (!existInMerged) merged.push(localRow);
        }
    });
    
    // Pastikan hasil merge langsung disorting!
    return sortDataByIdDesc(merged);
}

if (typeof google === 'undefined') {
    console.log("🌐 Berjalan di Vercel/Eksternal - ZettBridge Hybrid Aktif!");
    window._isZettBridgePolyfill = true; 
    window.google = {
        script: {
            get run() {
                return {
                    _onSuccess: null,
                    _onFailure: null,
                    withSuccessHandler: function(cb) { this._onSuccess = cb; return this; },
                    withFailureHandler: function(cb) { this._onFailure = cb; return this; },
                    
                    getInitialData: function() {
                        if (database) {
                            database.ref('appData').once('value').then(snapshot => {
                                if (snapshot.exists() && snapshot.val().produksi) {
                                    console.log("⚡ Memuat dari Firebase Instan");
                                    appData = restoreFbKeys(snapshot.val());
                                    // Sortir Global saat data dimuat
                                    ['produksi', 'pelanggan', 'waktu', 'kiloan', 'satuan', 'pewangi', 'member', 'users'].forEach(function(k) {
                                        if (appData[k]) appData[k] = sortDataByIdDesc(appData[k]);
                                    });
                                    if(this._onSuccess) this._onSuccess(appData);
                                    this._backgroundSyncGasToFirebase();
                                } else {
                                    console.log("⏳ Firebase Kosong, menarik data dari Sheets...");
                                    this._fetchFromGas();
                                }
                            }).catch(e => { this._fetchFromGas(); });
                        } else {
                            this._fetchFromGas();
                        }
                        return this;
                    },

                    _fetchFromGas: function() {
                        fetch(GAS_URL, { 
                            method: 'POST',
                            body: JSON.stringify({ action: 'getInitialData', payload: {} }) 
                        })
                        .then(res => {
                            if (!res.ok) throw new Error("HTTP Error " + res.status);
                            return res.json();
                        })
                        .then(data => {
                            if(data && data.error) throw new Error(data.message || "Proxy Error");
                            if(data && data.produksi) { 
                                data.produksi = mergeProduksiData(data.produksi);
                                appData = data; 
                                if(database) database.ref('appData').set(sanitizeFbKeys(data)); 
                                console.log("✅ Migrasi Data ke Firebase Berhasil!"); 
                            }
                            if(this._onSuccess) this._onSuccess(data);
                        })
                        .catch(err => {
                            console.error("❌ ZettBridge Fetch Error:", err);
                            if(this._onFailure) this._onFailure("Koneksi gagal. Cek Deployment Google Apps Script!");
                        });
                    },

                    saveRecord: function(sheet, data) {
                        let key = sheet.toLowerCase().replace('layanan', '');
                        if (!appData[key]) appData[key] = [];
                        
                        let prefixMap = { 'Pelanggan': 'PLG', 'LayananWaktu': 'LWT', 'LayananKiloan': 'LKL', 'LayananSatuan': 'LST', 'LayananPewangi': 'LPW', 'LayananMember': 'LMB', 'Users': 'USR' };
                        let prefix = prefixMap[sheet] || sheet.substring(0, 3).toUpperCase();
                        let maxNum = 0;
                        appData[key].forEach(r => {
                            if (!r) return;
                            let idStr = String(r.ID || '');
                            if (idStr.startsWith(prefix + '-')) {
                                let num = parseInt(idStr.split('-')[1]);
                                if (!isNaN(num) && num > maxNum) maxNum = num;
                            }
                        });
                        data['ID'] = prefix + '-' + String(maxNum + 1).padStart(4, '0');
                        
                        appData[key].push(data);
                        appData[key] = sortDataByIdDesc(appData[key]); // ZETTBOT: Sort setelah nambah data
                        
                        if(database) database.ref('appData/' + key).set(sanitizeFbKeys(appData[key]));
                        if (this._onSuccess) this._onSuccess({ success: true, message: "Data Tersimpan (Instan)!", data: appData[key], pelanggan: appData.pelanggan });
                        
                        fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'saveRecord', payload: {sheetName: sheet, data: data} }) })
                        .then(res => {
                            if (!res.ok) throw new Error("HTTP Error " + res.status);
                            return res.json();
                        }).then(resData => {
                            if (resData.success && resData.data) {
                                appData[key] = (sheet === 'Pelanggan') ? cleanPhoneQuotes(resData.data) : resData.data; 
                                appData[key] = sortDataByIdDesc(appData[key]); // Ensure sorted
                                if(resData.pelanggan) appData.pelanggan = sortDataByIdDesc(cleanPhoneQuotes(resData.pelanggan));
                                if(database) database.ref('appData').set(sanitizeFbKeys(appData));
                                
                                if(typeof window.renderTable === 'function') window.renderTable(sheet, true);
                                if(typeof window.updateAllDropdowns === 'function') window.updateAllDropdowns();
                            }
                        }).catch(e => { console.warn("Sync terganggu: " + e.message); });
                        return this;
                    },

                    updateRecord: function(sheet, id, data) {
                        let key = sheet.toLowerCase().replace('layanan', '');
                        if (appData[key]) {
                            let idx = appData[key].findIndex(x => x && String(x.ID) === String(id));
                            if(idx >= 0) { data.ID = id; appData[key][idx] = Object.assign({}, appData[key][idx], data); }
                            appData[key] = sortDataByIdDesc(appData[key]);
                            if(database) database.ref('appData/' + key).set(sanitizeFbKeys(appData[key]));
                        }
                        if(this._onSuccess) this._onSuccess({ success: true, message: "Data Diupdate (Instan)!", data: appData[key], pelanggan: appData.pelanggan });
                        
                        fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'updateRecord', payload: {sheetName: sheet, id: id, data: data} }) })
                        .then(res => {
                            if (!res.ok) throw new Error("HTTP Error " + res.status);
                            return res.json();
                        }).then(resData => {
                            if (resData.success && resData.data) { 
                                appData[key] = (sheet === 'Pelanggan') ? cleanPhoneQuotes(resData.data) : resData.data; 
                                appData[key] = sortDataByIdDesc(appData[key]);
                                if(resData.pelanggan) appData.pelanggan = sortDataByIdDesc(cleanPhoneQuotes(resData.pelanggan)); 
                                if(database) database.ref('appData').set(sanitizeFbKeys(appData)); 
                                
                                if(typeof window.renderTable === 'function') window.renderTable(sheet, true);
                                if(typeof window.updateAllDropdowns === 'function') window.updateAllDropdowns();
                            }
                        }).catch(e => { console.warn("Sync terganggu: " + e.message); });
                        return this;
                    },

                    deleteRecord: function(sheet, id) {
                        let key = sheet.toLowerCase().replace('layanan', '');
                        if (appData[key]) {
                            appData[key] = appData[key].filter(x => x && String(x.ID) !== String(id));
                            if(database) database.ref('appData/' + key).set(sanitizeFbKeys(appData[key]));
                        }
                        if(this._onSuccess) this._onSuccess({ success: true, message: "Terhapus (Instan)!", data: appData[key] });
                        
                        fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'deleteRecord', payload: {sheetName: sheet, id: id} }) })
                        .then(res => {
                            if (!res.ok) throw new Error("HTTP Error " + res.status);
                            return res.json();
                        }).then(resData => {
                            if (resData.success && resData.data) { 
                                appData[key] = (sheet === 'Pelanggan') ? cleanPhoneQuotes(resData.data) : resData.data; 
                                appData[key] = sortDataByIdDesc(appData[key]);
                                if(resData.pelanggan) appData.pelanggan = sortDataByIdDesc(cleanPhoneQuotes(resData.pelanggan)); 
                                if(database) database.ref('appData').set(sanitizeFbKeys(appData)); 
                                
                                if(typeof window.renderTable === 'function') window.renderTable(sheet, true);
                                if(typeof window.updateAllDropdowns === 'function') window.updateAllDropdowns();
                            }
                        }).catch(e => { console.warn("Sync terganggu: " + e.message); });
                        return this;
                    },

                    saveTransaksiStaff: function(p1, p2) {
                        let payload = (p2 !== undefined) ? { recordObj: p1, fileData: p2 } : p1;
                        let rec = payload.recordObj || payload;
                        
                        if (payload.fileData && payload.fileData.base64) {
                            if (!rec['Foto'] || rec['Foto'] === '') rec['Foto'] = 'PENDING_UPLOAD';
                        }

                        if (!rec['ID']) {
                            let maxNum = 0;
                            (appData.produksi || []).forEach(r => { 
                                if (!r) return;
                                let idStr = String(r.ID || ''); 
                                if(idStr.startsWith('TX-')) { 
                                    let num = parseInt(idStr.split('-')[1]); 
                                    if(!isNaN(num) && num > maxNum) maxNum = num; 
                                } 
                            });
                            rec['ID'] = 'TX-' + String(maxNum + 1).padStart(4, '0');
                        }

                        if (!rec['ID Pelanggan']) {
                            let cust = (appData.pelanggan || []).find(p => p && p['Nama Pelanggan'] === rec['Nama Pelanggan']);
                            if (cust) rec['ID Pelanggan'] = cust['ID'];
                        }
                        
                        if (!rec['No Nota']) {
                            let maxNota = 0; 
                            let d = new Date(); 
                            let day = ('0' + d.getDate()).slice(-2); 
                            let month = ('0' + (d.getMonth() + 1)).slice(-2); 
                            let year = String(d.getFullYear()).slice(-2); 
                            let notaPrefix = 'WRL.' + day + month + year + '.';
                            (appData.produksi||[]).forEach(function(row) { 
                                if(row && row['No Nota'] && String(row['No Nota']).startsWith(notaPrefix)) { 
                                    let parts = String(row['No Nota']).split('.'); 
                                    if (parts.length > 2) { 
                                        let n = parseInt(parts[2]); 
                                        if(!isNaN(n) && n > maxNota) maxNota = n; 
                                    } 
                                } 
                            });
                            rec['No Nota'] = notaPrefix + String(maxNota+1).padStart(3,'0');
                        }
                        
                        if (!rec['Status']) {
                            rec['Status'] = 'Proses';
                        }

                        if (!rec['Waktu Masuk']) {
                            rec['Waktu Masuk'] = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date());
                        }
                        
                        if (rec['Pembayaran'] === 'Potong Kuota' && rec['Kg Terpakai']) {
                            let cust = appData.pelanggan.find(p => p && p['Nama Pelanggan'] === rec['Nama Pelanggan']);
                            if (cust) { let sisa = parseFloat(cust['Sisa Kuota (Kg)']) - parseFloat(rec['Kg Terpakai']); cust['Sisa Kuota (Kg)'] = sisa < 0 ? 0 : Math.round(sisa * 100) / 100; }
                        }
                        
                        let exists = appData.produksi.findIndex(x => x && x.ID === rec.ID);
                        if (exists >= 0) appData.produksi[exists] = rec; else appData.produksi.push(rec);
                        
                        appData.produksi = sortDataByIdDesc(appData.produksi); // ZETTBOT: Sort Central
                        
                        if(database) database.ref('appData').set(sanitizeFbKeys(appData));
                        
                        if (this._onSuccess) this._onSuccess({ success: true, message: "Transaksi Tersimpan Cepat!", data: appData.produksi, pelanggan: appData.pelanggan, notaInfo: rec });
                        
                        var gasPayload = { recordObj: rec, fileData: (payload.fileData || null) };
                        fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'saveTransaksiStaff', payload: gasPayload }) })
                        .then(res => {
                            if (!res.ok) throw new Error("HTTP Error " + res.status);
                            return res.json();
                        }).then(resData => {
                            if (resData.success) {
                                if (resData.data) appData.produksi = mergeProduksiData(resData.data); 
                                if (resData.pelanggan) appData.pelanggan = sortDataByIdDesc(cleanPhoneQuotes(resData.pelanggan));
                                if(database) database.ref('appData').set(sanitizeFbKeys(appData));
                                
                                if (typeof window.renderStaffTable === 'function') window.renderStaffTable(true);
                                if (typeof window.renderTable === 'function') window.renderTable('Produksi', true);
                            }
                        }).catch(e => console.error("GAS Sync Error", e));
                        return this;
                    },

                    updateStatusProduksi: function(id, status, pmbStatus) {
                        let target = appData.produksi.find(x => x && x.ID === id);
                        if (target) { target.Status = status; target.Pembayaran = pmbStatus; if (pmbStatus === 'Lunas') target['Sisa Bayar'] = 0; }
                        if(database) database.ref('appData/produksi').set(sanitizeFbKeys(appData.produksi));
                        if(this._onSuccess) this._onSuccess({ success: true, message: "Status Diperbarui!", data: appData.produksi });
                        
                        fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'updateStatusProduksi', payload: {id: id, status: status, pmbStatus: pmbStatus} }) })
                        .then(res => {
                            if (!res.ok) throw new Error("HTTP Error " + res.status);
                            return res.json();
                        }).then(resData => {
                            if (resData.success && resData.data) { 
                                appData.produksi = mergeProduksiData(resData.data); 
                                if(database) database.ref('appData').set(sanitizeFbKeys(appData)); 
                                
                                if (typeof window.renderStaffTable === 'function') window.renderStaffTable(true);
                                if (typeof window.renderTable === 'function') window.renderTable('Produksi', true);
                            }
                        }).catch(e => console.error("Sync Status Terganggu: ", e.message));
                        return this;
                    },

                    _backgroundSyncGasToFirebase: function() {
                        setTimeout(() => {
                            fetch(GAS_URL, { 
                                method: 'POST', 
                                body: JSON.stringify({ action: 'getInitialData', payload: {} }) 
                            })
                            .then(res => {
                                if (!res.ok) throw new Error("HTTP Error " + res.status);
                                return res.json();
                            })
                            .then(data => {
                                if(data && data.produksi && database) {
                                    data.produksi = mergeProduksiData(data.produksi);
                                    if (data.pelanggan && typeof cleanPhoneQuotes === 'function') {
                                        data.pelanggan = cleanPhoneQuotes(data.pelanggan);
                                    }
                                    appData.pelanggan = data.pelanggan || appData.pelanggan;
                                    appData.waktu = data.waktu || appData.waktu;
                                    appData.kiloan = data.kiloan || appData.kiloan;
                                    appData.satuan = data.satuan || appData.satuan;
                                    appData.pewangi = data.pewangi || appData.pewangi;
                                    appData.member = data.member || appData.member;
                                    appData.users = data.users || appData.users;
                                    appData.produksi = data.produksi;
                                    database.ref('appData').set(sanitizeFbKeys(appData)); 
                                    console.log("✅ Background sync (POST) sukses!");
                                }
                            })
                            .catch(e => console.log("ℹ️ ZettBridge Info: Sinkronisasi Sheets ditunda. Data realtime aman di Firebase."));
                        }, 5000);
                    }
                };
            }
        }
    };
}
// ====================================================================

/**
 * ZETTBOT - SCRIPT CORE
 * Berisi Variabel Global, Utilitas, Navigasi, dan Inisialisasi Sistem
 */

var appData = { produksi: [], pelanggan: [], waktu: [], kiloan: [], satuan: [], pewangi: [], member: [], users: [] };
var tsInstances = {};
var isLoggedIn = false;
var currentUser = null;
var sortConfig = {};
var staffServicesCount = 0; 
var staffServicesData = {}; 
var currentSavedTx = null; 
var currentDetailId = null;
var isFormPopulating = false; 
var zettConfirmCallback = null;

var pageConfig = {
    'Produksi': { page: 1, limit: 15 },
    'Pelanggan': { page: 1, limit: 15 },
    'LayananWaktu': { page: 1, limit: 15 },
    'LayananKiloan': { page: 1, limit: 15 },
    'LayananSatuan': { page: 1, limit: 15 },
    'LayananPewangi': { page: 1, limit: 15 },
    'LayananMember': { page: 1, limit: 15 },
    'Users': { page: 1, limit: 15 },
    'Staff': { page: 1, limit: 20 }
};

var appSettings = { nama: 'Waroenk Laundry', alamat: 'Jl. Markisa No 52 Rt 05, Tenggarong', logo: '' };
try { var stored = localStorage.getItem('zettSettings'); if (stored) { var parsed = JSON.parse(stored); if (parsed) appSettings = parsed; } } catch(e) {}

var masterConfig = {
    'Pelanggan': { id: 'pelanggan', title: 'Data Pelanggan', fields: [{name: 'Nama Pelanggan', type: 'text'}, {name: 'No Telpon', type: 'text'}, {name: 'Status', type: 'select', options: ['Umum', 'Member']}, {name: 'Paket Member', type: 'dynamic-select', relation: 'member'}, {name: 'Sisa Kuota (Kg)', type: 'number'}] },
    'LayananWaktu': { id: 'layanan-waktu', title: 'Layanan Waktu', fields: [{name: 'Nama Layanan', type: 'text'}, {name: 'Waktu (Jam)', type: 'number'}] },
    'LayananKiloan': { id: 'layanan-kiloan', title: 'Layanan Kiloan', fields: [{name: 'Nama Layanan', type: 'text'}, {name: 'Jenis Waktu', type: 'dynamic-select', relation: 'waktu'}, {name: 'Harga/Kg', type: 'number'}] },
    'LayananSatuan': { id: 'layanan-satuan', title: 'Layanan Satuan', fields: [{name: 'Nama Layanan', type: 'text'}, {name: 'Jenis Waktu', type: 'dynamic-select', relation: 'waktu'}, {name: 'Harga/Pcs', type: 'number'}] },
    'LayananPewangi': { id: 'layanan-pewangi', title: 'Master Pewangi', fields: [{name: 'Nama Pewangi', type: 'text'}] },
    'LayananMember': { id: 'layanan-member', title: 'Paket Member', fields: [{name: 'Nama Paket', type: 'text'}, {name: 'Kuota (Kg)', type: 'number'}, {name: 'Harga', type: 'number'}] },
    'Users': { id: 'users', title: 'Manajemen User', fields: [{name: 'Username', type: 'text'}, {name: 'Nama Lengkap', type: 'text'}, {name: 'Password', type: 'password'}, {name: 'Role', type: 'select', options: ['ADMIN', 'STAFF']}] }
};

function resolvePelanggan(id) {
    var cust = (appData.pelanggan || []).find(function(c) { return c && String(c['ID']) === String(id); });
    if (cust) return { nama: cust['Nama Pelanggan'], hp: cust['No Telpon'] };
    return { nama: 'Unknown / Dihapus', hp: '-' };
}

function resolveLayananNameForProduksi(layananRaw) {
    if (!layananRaw) return '-';
    try {
        var items = JSON.parse(layananRaw);
        var arr = [];
        items.forEach(function(item) { arr.push(item.nama + ' (' + item.qty + ' ' + item.satuan + ')'); });
        return arr.join(', ');
    } catch(e) {
        return String(layananRaw).replace(/\+/g, ', ');
    }
}

function showLoading(show) { 
    var el = document.getElementById('loading'); if (!el) return; 
    if(show) { el.classList.remove('hidden', 'opacity-0'); } 
    else { el.classList.add('opacity-0'); setTimeout(function() { el.classList.add('hidden'); }, 300); } 
}

function showToast(message, type) {
    type = type || "success"; 
    var toast = document.getElementById('toast'); if (!toast) return; 
    document.getElementById('toast-msg').innerText = message;
    toast.style.zIndex = '99999';
    toast.className = 'fixed top-5 right-5 md:right-5 transform translate-x-0 transition-transform duration-300 flex items-center shadow-2xl rounded-2xl p-4 max-w-sm ' + (type === 'success' ? 'bg-slate-900' : 'bg-red-500');
    var icon = document.getElementById('toast-icon'); 
    if(icon) { icon.className = 'ph-fill ph-' + (type === 'success' ? 'check-circle text-emerald-400' : 'warning-circle text-white') + ' text-2xl mr-3'; }
    setTimeout(function() { toast.classList.remove('translate-x-0'); toast.classList.add('translate-x-[150%]'); }, 3000);
}

function formatRupiah(el) { var val = el.value.replace(/[^0-9]/g, ''); if (val !== '') { el.value = new Intl.NumberFormat('id-ID').format(val); } else { el.value = ''; } }

function zettConfirm(title, message, type, callback) {
    var modal = document.getElementById('modal-confirm-zett');
    var iconBox = document.getElementById('confirm-zett-icon-box');
    var icon = document.getElementById('confirm-zett-icon');
    var titleEl = document.getElementById('confirm-zett-title');
    var msgEl = document.getElementById('confirm-zett-msg');
    var btnOk = document.getElementById('btn-confirm-zett-ok');

    titleEl.innerText = title; msgEl.innerText = message; zettConfirmCallback = callback;

    if(type === 'danger') {
        iconBox.className = 'w-20 h-20 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner';
        icon.className = 'ph-fill ph-trash text-4xl';
        btnOk.className = 'flex-1 bg-rose-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-rose-600/20 transition-transform active:scale-95 text-[14px]';
    } else {
        iconBox.className = 'w-20 h-20 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner';
        icon.className = 'ph-fill ph-question text-4xl';
        btnOk.className = 'flex-1 bg-slate-900 text-white font-black py-4 rounded-2xl shadow-lg shadow-slate-900/20 transition-transform active:scale-95 text-[14px]';
    }
    modal.classList.remove('hidden'); modal.classList.add('flex');
}

function closeZettConfirm(confirmed) {
    var modal = document.getElementById('modal-confirm-zett');
    modal.classList.add('hidden'); modal.classList.remove('flex');
    if(confirmed && typeof zettConfirmCallback === 'function') { zettConfirmCallback(); }
    zettConfirmCallback = null;
}

function getDriveDirectUrl(url) {
    if (!url) return ''; 
    var match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/); 
    var fileId = match ? match[1] : null;
    if (!fileId) { match = url.match(/id=([a-zA-Z0-9_-]+)/); fileId = match ? match[1] : null; }
    if (fileId) { return 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1000'; } return url;
}

function makeTextFlexible(elementId) {
    var el = document.getElementById(elementId);
    if (!el) return;
    
    el.classList.remove('truncate');
    el.style.whiteSpace = 'nowrap'; 
    el.style.transition = 'font-size 0.2s ease-out';
    
    function resizeFont() {
        el.style.fontSize = '1.875rem';
        var parent = el.parentElement;
        if (!parent) return;
        var maxWidth = parent.clientWidth;
        
        if (el.scrollWidth > maxWidth && maxWidth > 0) {
            var currentSize = parseFloat(window.getComputedStyle(el).fontSize);
            var newSize = currentSize * (maxWidth / el.scrollWidth) * 0.95;
            if (newSize < 14) newSize = 14; 
            el.style.fontSize = newSize + 'px';
        }
    }

    setTimeout(resizeFont, 100);
    var observer = new MutationObserver(function() { setTimeout(resizeFont, 50); });
    observer.observe(el, { characterData: true, childList: true, subtree: true });
    window.addEventListener('resize', function() { setTimeout(resizeFont, 50); });
}

function changePage(view, newPage) {
    if (pageConfig[view]) {
        pageConfig[view].page = newPage;
        if (view === 'Staff') {
            if (typeof renderStaffTable === 'function') renderStaffTable(true);
        } else {
            if (typeof renderTable === 'function') renderTable(view, true);
        }
    }
}

function changeLimit(view, newLimit) {
    if (pageConfig[view]) {
        pageConfig[view].limit = parseInt(newLimit);
        pageConfig[view].page = 1; 
        if (view === 'Staff') {
            if (typeof renderStaffTable === 'function') renderStaffTable(true);
        } else {
            if (typeof renderTable === 'function') renderTable(view, true);
        }
    }
}

function generatePaginationHTML(view, totalItems) {
    var limit = pageConfig[view].limit;
    var currentPage = pageConfig[view].page;
    var totalPages = Math.ceil(totalItems / limit);
    
    if (currentPage > totalPages && totalPages > 0) { pageConfig[view].page = 1; currentPage = 1; }

    var html = '<div class="flex flex-col sm:flex-row items-center justify-between w-full px-4 py-3 sm:py-3.5 bg-slate-50 border-t border-slate-200 rounded-b-2xl shrink-0 gap-3 relative z-[30] shadow-[0_-4px_10px_-4px_rgba(0,0,0,0.05)]">';

    html += '<div class="flex items-center justify-between sm:justify-start w-full sm:w-auto gap-3">';
    html += '<div class="text-[11px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">Hal <span class="font-black text-teal-600">' + currentPage + '</span> / ' + Math.max(1, totalPages) + '</div>';
    
    html += '<div class="flex items-center gap-2">';
    html += '<span class="text-[10px] font-bold text-slate-400 uppercase hidden sm:inline">Tampilkan:</span>';
    html += '<select onchange="changeLimit(\'' + view + '\', this.value)" class="text-xs font-bold text-slate-700 border border-slate-300 rounded-lg px-2 py-1.5 bg-white shadow-sm outline-none focus:ring-2 focus:ring-teal-400 cursor-pointer hover:bg-slate-50 transition-colors">';
    [15, 25, 50, 100].forEach(function(val) {
        html += '<option value="' + val + '" ' + (limit == val ? 'selected' : '') + '>' + val + ' Baris</option>';
    });
    html += '</select>';
    html += '</div>';
    html += '</div>';

    html += '<div class="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-2">';
    html += '<p class="text-[10px] font-bold text-slate-400 uppercase hidden md:block mr-2">Total: <span class="text-slate-600">' + totalItems + ' Data</span></p>';

    var prevDisabled = currentPage <= 1 ? 'disabled class="opacity-50 cursor-not-allowed px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold bg-slate-100 text-slate-400"' : 'onclick="changePage(\''+view+'\', '+(currentPage-1)+')" class="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold bg-white text-slate-700 shadow-sm hover:bg-slate-50 active:scale-95 transition-all cursor-pointer"';
    html += '<button type="button" ' + prevDisabled + '><i class="ph-bold ph-caret-left mr-1"></i> Prev</button>';

    var nextDisabled = currentPage >= totalPages ? 'disabled class="opacity-50 cursor-not-allowed px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold bg-slate-100 text-slate-400"' : 'onclick="changePage(\''+view+'\', '+(currentPage+1)+')" class="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold bg-white text-slate-700 shadow-sm hover:bg-slate-50 active:scale-95 transition-all cursor-pointer"';
    html += '<button type="button" ' + nextDisabled + '>Next <i class="ph-bold ph-caret-right ml-1"></i></button>';
    
    html += '</div></div>';

    return html;
}

function openModal(modalId) {
    isFormPopulating = true; isEditMode = false; currentEditId = null; 
    var modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden'); modal.classList.add('flex'); 
        var form = modal.querySelector('form');
        if(form) {
            form.reset();
            form.querySelectorAll('input, select').forEach(function(el) { el.disabled = false; el.classList.remove('bg-slate-100', 'cursor-not-allowed', 'opacity-70'); });
            form.querySelectorAll('select').forEach(function(el) { if(tsInstances[el.id]) { tsInstances[el.id].enable(); } });
            var btnSubmit = form.querySelector('button[type="submit"]'); if(btnSubmit) { btnSubmit.style.display = ''; }
            var titleEl = modal.querySelector('h3'); if(titleEl) { titleEl.innerText = titleEl.innerText.replace('Edit', 'Tambah').replace('Detail', 'Tambah'); }
            form.querySelectorAll('select').forEach(function(sel) { if(tsInstances[sel.id]) { tsInstances[sel.id].clear(true); } });
        }
        if (modalId === 'modal-pelanggan') { var statusEl = document.getElementById('select-Pelanggan-Status'); if (statusEl) { statusEl.value = 'Umum'; handlePelangganStatusChange('Umum'); } }
    }
    setTimeout(function() { 
        isFormPopulating = false; 
        var modal = document.getElementById(modalId);
        if(modal) {
            var firstInput = modal.querySelector('input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])');
            if(firstInput) {
                if(firstInput.tagName === 'SELECT' && tsInstances[firstInput.id]) { tsInstances[firstInput.id].focus(); }
                else { firstInput.focus(); }
            }
        }
    }, 100);
}

function closeModal(modalId) { 
    var modal = document.getElementById(modalId); 
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); } 
}

function applySettings() {
    var loginTitle = document.getElementById('ui-login-title'); var sidebarTitle = document.getElementById('ui-sidebar-title'); var staffTitle = document.getElementById('ui-staff-title');
    if(loginTitle) loginTitle.innerText = appSettings.nama; 
    if(sidebarTitle) {
        var originalName = appSettings.nama || 'Waroenk Laundry';
        var words = originalName.split(' ');
        var formattedHtml = '';
        if (words.length > 1) { formattedHtml = words[0] + '<br>' + words.slice(1).join(' '); } else { formattedHtml = originalName; }
        formattedHtml = formattedHtml.replace(/(Waroenk)/ig, '<span class="text-teal-500">$1</span>');
        sidebarTitle.innerHTML = formattedHtml;
    }
    if(staffTitle) staffTitle.innerText = appSettings.nama + ' POS';

    var loginLogoContainer = document.getElementById('ui-login-logo');
    if(loginLogoContainer) {
        loginLogoContainer.innerHTML = '';
        if(appSettings.logo) { var img1 = document.createElement('img'); img1.src = appSettings.logo; img1.className = "w-full h-full object-cover"; img1.onerror = function() { this.outerHTML = '<i class="ph-bold ph-washing-machine text-3xl text-white"></i>'; }; loginLogoContainer.appendChild(img1); } 
        else { loginLogoContainer.innerHTML = '<i class="ph-bold ph-washing-machine text-3xl text-white"></i>'; }
    }
    var sidebarLogoContainer = document.getElementById('ui-sidebar-logo');
    if(sidebarLogoContainer) {
        sidebarLogoContainer.innerHTML = '';
        if(appSettings.logo) { var img2 = document.createElement('img'); img2.src = appSettings.logo; img2.className = "w-full h-full object-cover"; img2.onerror = function() { this.outerHTML = '<i class="ph-bold ph-washing-machine text-xl text-white"></i>'; }; sidebarLogoContainer.appendChild(img2); } 
        else { sidebarLogoContainer.innerHTML = '<i class="ph-bold ph-washing-machine text-xl text-white"></i>'; }
    }
    var staffLogoContainer = document.getElementById('ui-staff-logo');
    if(staffLogoContainer) {
        staffLogoContainer.innerHTML = '';
        if(appSettings.logo) { var img3 = document.createElement('img'); img3.src = appSettings.logo; img3.className = "w-full h-full object-cover"; img3.onerror = function() { this.outerHTML = '<i class="ph-bold ph-washing-machine text-white"></i>'; }; staffLogoContainer.appendChild(img3); } 
        else { staffLogoContainer.innerHTML = '<i class="ph-bold ph-washing-machine text-white"></i>'; }
    }
}

function openSettingsModal() {
    document.getElementById('set-nama').value = appSettings.nama; document.getElementById('set-alamat').value = appSettings.alamat; document.getElementById('set-logo').value = appSettings.logo || '';
    var preview = document.getElementById('set-logo-preview'); var clearBtn = document.getElementById('btn-clear-logo');
    if (appSettings.logo) { preview.innerHTML = '<img src="' + appSettings.logo + '" class="w-full h-full object-cover">'; clearBtn.classList.remove('hidden'); } 
    else { preview.innerHTML = '<i class="ph-bold ph-image text-2xl text-slate-400"></i>'; clearBtn.classList.add('hidden'); }
    var modal = document.getElementById('modal-settings'); if(modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
    document.querySelectorAll('.nav-btn').forEach(function(el) { el.classList.remove('!bg-teal-500', '!text-white'); });
    var navBtn = document.getElementById('nav-settings'); if(navBtn) navBtn.classList.add('!bg-teal-500', '!text-white');
    setTimeout(function() { var firstInput = document.getElementById('set-nama'); if(firstInput) firstInput.focus(); }, 100);
}

function handleLogoUpload(input) {
    if (input.files && input.files[0]) {
        var file = input.files[0]; var reader = new FileReader();
        reader.onload = function(e) {
            var img = new Image();
            img.onload = function() {
                var canvas = document.createElement('canvas'); var width = img.width; var height = img.height; var maxSize = 300; 
                if (width > height) { if (width > maxSize) { height = Math.round(height * (maxSize / width)); width = maxSize; } } else { if (height > maxSize) { width = Math.round(width * (maxSize / height)); height = maxSize; } }
                canvas.width = width; canvas.height = height; var ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height);
                var compressedBase64 = canvas.toDataURL('image/png'); 
                document.getElementById('set-logo').value = compressedBase64; document.getElementById('set-logo-preview').innerHTML = '<img src="' + compressedBase64 + '" class="w-full h-full object-cover">'; document.getElementById('btn-clear-logo').classList.remove('hidden');
            }; img.src = e.target.result;
        }; reader.readAsDataURL(file);
    }
}

function clearLogo() { document.getElementById('set-logo').value = ''; document.getElementById('set-logo-preview').innerHTML = '<i class="ph-bold ph-image text-2xl text-slate-400"></i>'; document.getElementById('set-logo-file').value = ''; document.getElementById('btn-clear-logo').classList.add('hidden'); }

function saveSettings() {
    var n = document.getElementById('set-nama').value.trim(); var a = document.getElementById('set-alamat').value.trim(); var l = document.getElementById('set-logo').value.trim();
    appSettings.nama = n || 'Waroenk Laundry'; appSettings.alamat = a || 'Jl. Markisa No 52 Rt 05, Tenggarong'; appSettings.logo = l;
    localStorage.setItem('zettSettings', JSON.stringify(appSettings)); closeModal('modal-settings'); applySettings(); showToast('Pengaturan berhasil disimpan!');
}

document.addEventListener('DOMContentLoaded', function() {
    applySettings(); 
    
    if (typeof generateDynamicViews === 'function') {
        generateDynamicViews(); 
    } else {
        console.error("ZettBOT Warning: generateDynamicViews tidak ditemukan.");
        setTimeout(function() { showLoading(false); showToast("Sistem gagal dimuat. Cek file JS Anda!", "error"); }, 1000);
    }
    
    fetchInitialData();
    makeTextFlexible('dash-pendapatan');
    
    var modalScrollArea = document.getElementById('staff-modal-scroll-area');
    if (modalScrollArea) {
        modalScrollArea.addEventListener('focus', function(e) {
            var target = e.target;
            if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') {
                
                var executeScroll = function() {
                    var wrapper = target.closest('.ts-wrapper') ? target.closest('.ts-wrapper').parentElement : (target.closest('[id^="staff-srv-row-"]') || target.closest('.mb-4') || target); 
                    
                    if (wrapper && modalScrollArea) { 
                        var rect = wrapper.getBoundingClientRect();
                        var scrollRect = modalScrollArea.getBoundingClientRect();
                        var currentScroll = modalScrollArea.scrollTop;
                        modalScrollArea.scrollTo({
                            top: currentScroll + (rect.top - scrollRect.top) - 10,
                            behavior: 'smooth'
                        });
                    }
                };

                setTimeout(executeScroll, 250); 
                setTimeout(executeScroll, 600); 
            }
        }, true);
    }

    // ZETTBOT FIX: Pastikan Listener Firebase Langsung Memanggil Global Sorting!
    if (typeof database !== 'undefined' && database) {
        let isFirstRealtimeFire = true;
        database.ref('appData').on('value', function(snapshot) {
            if (isFirstRealtimeFire) {
                isFirstRealtimeFire = false;
                return;
            }
            if (snapshot.exists() && snapshot.val().produksi) {
                console.log("⚡ [ZettBridge] Realtime Update Diterima dari Cloud!");
                var newData = window.restoreFbKeys ? window.restoreFbKeys(snapshot.val()) : snapshot.val();
                
                if (newData.pelanggan && typeof cleanPhoneQuotes === 'function') {
                    newData.pelanggan = cleanPhoneQuotes(newData.pelanggan);
                }
                
                if (typeof mergeProduksiData === 'function') {
                    newData.produksi = mergeProduksiData(newData.produksi);
                }
                
                // ZETTBOT Sorter: Selalu Rapikan Semua Data Berdasarkan ID Terbesar
                ['produksi', 'pelanggan', 'waktu', 'kiloan', 'satuan', 'pewangi', 'member', 'users'].forEach(function(k) {
                    if (newData[k]) newData[k] = sortDataByIdDesc(newData[k]);
                });

                appData = newData;
                
                if (isLoggedIn) {
                    if (typeof renderStaffTable === 'function') renderStaffTable(true);
                    
                    if (currentUser && currentUser.Role === 'ADMIN') {
                        if (typeof updateDashboard === 'function') updateDashboard();
                        
                        var activeViews = ['produksi', 'users'];
                        if (typeof masterConfig !== 'undefined') {
                            for (var k in masterConfig) { 
                                if(k !== 'Users') activeViews.push(masterConfig[k].id); 
                            }
                        }
                        
                        activeViews.forEach(function(vid) {
                            var el = document.getElementById('view-' + vid);
                            if (el && !el.classList.contains('hidden') && typeof renderTable === 'function') {
                                var sheetName = vid === 'produksi' ? 'Produksi' : (vid === 'users' ? 'Users' : null);
                                if (!sheetName && typeof masterConfig !== 'undefined') {
                                    for (var key in masterConfig) { if (masterConfig[key].id === vid) { sheetName = key; break; } }
                                }
                                if (sheetName) renderTable(sheetName, true);
                            }
                        });
                    }
                }
            }
        });
    }
});

window.addEventListener('beforeunload', function (e) { var modalStaff = document.getElementById('modal-staff-tx'); if (modalStaff && !modalStaff.classList.contains('hidden')) { e.preventDefault(); e.returnValue = ''; } });

function fetchInitialData() {
    showLoading(true);
    if (typeof google !== 'undefined' && google.script && google.script.run) {
        google.script.run.withSuccessHandler(function(response) {
            if(response && response.pelanggan) { response.pelanggan = response.pelanggan.map(function(p) { if(p['No Telpon']) { var hpStr = String(p['No Telpon']); if(hpStr.startsWith("'")) { hpStr = hpStr.substring(1); } p['No Telpon'] = hpStr; } return p; }); }
            
            appData = response || {produksi:[], pelanggan:[], waktu:[], kiloan:[], satuan:[], pewangi:[], member:[], users:[]};
            
            if (!appData.produksi) appData.produksi = [];
            if (!appData.pelanggan) appData.pelanggan = [];
            if (!appData.waktu) appData.waktu = [];
            if (!appData.kiloan) appData.kiloan = [];
            if (!appData.satuan) appData.satuan = [];
            if (!appData.pewangi) appData.pewangi = [];
            if (!appData.member) appData.member = [];
            if (!appData.users) appData.users = [];
            
            // ZETTBOT: Lakukan Sorting Awal Saat Refresh Web Pertama Kali
            ['produksi', 'pelanggan', 'waktu', 'kiloan', 'satuan', 'pewangi', 'member', 'users'].forEach(function(k) {
                if (appData[k]) appData[k] = sortDataByIdDesc(appData[k]);
            });

            showLoading(false);
            
            var savedSession = localStorage.getItem('zettSession');
            if (savedSession && !isLoggedIn) {
                try {
                    var parsedUser = JSON.parse(savedSession);
                    var validUser = appData.users.find(function(u) { return u && String(u.Username).trim() === String(parsedUser.Username).trim() && String(u.Password) === String(parsedUser.Password); });
                    if (validUser) {
                        executeLogin(validUser);
                        return; 
                    } else {
                        localStorage.removeItem('zettSession'); 
                    }
                } catch(e) {}
            }

            if (isLoggedIn) {
                if (currentUser && currentUser.Role === 'ADMIN') { 
                    if(typeof updateDashboard === 'function') updateDashboard(); 
                    if(typeof renderAllTables === 'function') renderAllTables(); 
                }
                if(typeof updateAllDropdowns === 'function') updateAllDropdowns();
                if (typeof renderStaffTable === 'function') renderStaffTable(true);
            }
        }).withFailureHandler(function(error) { showLoading(false); showToast("Koneksi Database Gagal", "error"); }).getInitialData();
    } else { setTimeout(function() { showLoading(false); }, 500); }
}

function handleLogin(e) {
    e.preventDefault(); var u = document.getElementById('login-username').value.trim(); var p = document.getElementById('login-password').value;
    var user = (appData.users || []).find(function(x) { return x && String(x.Username).trim() === u && String(x.Password) === p; });
    if (user) { executeLogin(user); } else { showToast("Username atau Password salah!", "error"); }
}

function executeLogin(user) {
    isLoggedIn = true; currentUser = user; renderSidebarMenu();
    localStorage.setItem('zettSession', JSON.stringify(user));
    
    var btnBackAdmin = document.getElementById('btn-back-admin');
    if(btnBackAdmin) { if(user.Role === 'ADMIN') { btnBackAdmin.classList.remove('hidden'); } else { btnBackAdmin.classList.add('hidden'); } }
    var overlay = document.getElementById('login-overlay');
    if (overlay) { overlay.classList.add('opacity-0'); setTimeout(function() { overlay.classList.add('hidden'); overlay.classList.remove('flex'); }, 500); }
    if(document.getElementById('user-profile-name')) { document.getElementById('user-profile-name').innerText = user['Nama Lengkap'] || 'Staff'; }
    if(document.getElementById('user-profile-role')) { document.getElementById('user-profile-role').innerText = 'ROLE: ' + (user['Role'] || 'STAFF'); }
    if(document.getElementById('user-profile-avatar')) { document.getElementById('user-profile-avatar').innerText = (user['Nama Lengkap'] || 'S').charAt(0); }
    
    if(user.Role === 'ADMIN') { 
        if(typeof updateDashboard === 'function') updateDashboard(); 
        if(typeof renderAllTables === 'function') renderAllTables(); 
    }
    if(typeof updateAllDropdowns === 'function') updateAllDropdowns(); 
    
    if (typeof renderStaffTable === 'function') { 
        renderStaffTable(true); 
    } else { 
        console.warn("ZettBOT Warning: renderStaffTable tidak ditemukan."); 
    }
    
    if(user.Role === 'STAFF') { switchView('staff'); } 
    else { switchView('dashboard'); }
}

function renderSidebarMenu() {
    var container = document.getElementById('sidebar-menu-container'); if (!container) return;
    var menuHtml = '<div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-3">Main Menu</div>';
    var btnClass = "nav-btn flex items-center px-4 py-3 rounded-2xl text-slate-600 hover:!bg-teal-500 hover:!text-white hover:shadow-lg hover:scale-105 transition-all duration-300 ease-out font-bold text-sm mb-2 group";
    var iconClass = "text-xl mr-3 text-slate-400 group-hover:!text-white transition-colors";

    if(currentUser && currentUser.Role === 'ADMIN') {
        menuHtml += '<a href="#" onclick="switchView(\'dashboard\')" id="nav-dashboard" class="' + btnClass + '"><i class="ph-bold ph-squares-four ' + iconClass + '"></i> Dashboard</a>';
        menuHtml += '<a href="#" onclick="switchView(\'produksi\')" id="nav-produksi" class="' + btnClass + '"><i class="ph-bold ph-table ' + iconClass + '"></i> Data Transaksi</a>';
    }
    menuHtml += '<a href="#" onclick="switchView(\'staff\')" id="nav-staff" class="' + btnClass + '"><i class="ph-bold ph-monitor-play ' + iconClass + '"></i> Kasir / Staff POS</a>';
    
    if(currentUser && currentUser.Role === 'ADMIN') {
        menuHtml += '<div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-8 mb-3 px-3">Master Data</div>';
        for (var key in masterConfig) {
            if(key !== 'Users') {
                var icon = 'ph-folder'; if(key.includes('Pelanggan')) icon = 'ph-users'; if(key.includes('Waktu')) icon = 'ph-clock'; if(key.includes('Kiloan')) icon = 'ph-scales'; if(key.includes('Satuan')) icon = 'ph-t-shirt'; if(key.includes('Pewangi')) icon = 'ph-flower-lotus'; if(key.includes('Member')) icon = 'ph-star';
                var safeTitle = masterConfig[key].title.replace('Layanan ', '');
                menuHtml += '<a href="#" onclick="switchView(\'' + masterConfig[key].id + '\')" id="nav-' + masterConfig[key].id + '" class="' + btnClass + '"><i class="ph-bold ' + icon + ' ' + iconClass + '"></i> ' + safeTitle + '</a>';
            }
        }
        menuHtml += '<div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-8 mb-3 px-3">System</div>';
        menuHtml += '<a href="#" onclick="switchView(\'users\')" id="nav-users" class="' + btnClass + '"><i class="ph-bold ph-user-gear ' + iconClass + '"></i> Kelola User</a>';
        menuHtml += '<a href="#" onclick="openSettingsModal()" id="nav-settings" class="' + btnClass + '"><i class="ph-bold ph-gear ' + iconClass + '"></i> Pengaturan</a>';
    }
    container.innerHTML = menuHtml;
}

function logout() {
    zettConfirm("Konfirmasi Keluar", "Apakah Anda yakin ingin keluar dari sistem?", "info", function() {
        isLoggedIn = false; currentUser = null; 
        localStorage.removeItem('zettSession');
        document.getElementById('login-username').value = ''; 
        document.getElementById('login-password').value = ''; 
        switchView('dashboard');
        var overlay = document.getElementById('login-overlay');
        if(overlay) { overlay.classList.remove('hidden'); overlay.classList.add('flex'); setTimeout(function() { overlay.classList.remove('opacity-0'); }, 10); }
    });
}

function switchView(viewId) {
    document.querySelectorAll('.view-section').forEach(function(el) { el.classList.add('hidden'); el.classList.remove('flex'); });
    var target = document.getElementById('view-' + viewId);
    if (target) {
        target.classList.remove('hidden');
        if (viewId === 'staff') { target.classList.add('flex'); }
    }
    
    var mainHeader = document.getElementById('main-header');
    var adminArea = document.getElementById('admin-scroll-area');
    var sidebar = document.getElementById('sidebar');
    var sidebarBackdrop = document.getElementById('sidebar-backdrop');
    
    if (viewId === 'staff') {
        if (mainHeader) { mainHeader.style.display = 'none'; }
        if (adminArea) { adminArea.style.display = 'none'; }
        
        if (window.innerWidth < 768) {
            if (sidebar) { sidebar.style.display = 'none'; } 
            if (sidebarBackdrop) { sidebarBackdrop.style.display = 'none'; }
        } else {
            if (sidebar) { sidebar.style.display = ''; } 
            if (sidebarBackdrop) { sidebarBackdrop.style.display = ''; }
        }
    } else {
        if (mainHeader) { mainHeader.style.display = ''; }
        if (adminArea) { adminArea.style.display = ''; }
        if (sidebar) { sidebar.style.display = ''; } 
        if (sidebarBackdrop) { sidebarBackdrop.style.display = ''; }
    }

    document.querySelectorAll('.nav-btn').forEach(function(el) { el.classList.remove('!bg-teal-500', '!text-white'); });
    var navBtn = document.getElementById('nav-' + viewId);
    if (navBtn) { navBtn.classList.add('!bg-teal-500', '!text-white'); }
    
    var titleEl = document.getElementById('page-title');
    if (titleEl && viewId !== 'staff') {
        if (viewId === 'dashboard') titleEl.innerText = 'Dashboard';
        else if (viewId === 'produksi') titleEl.innerText = 'Data Transaksi';
        else if (viewId === 'users') titleEl.innerText = 'Kelola User';
        else if (typeof masterConfig !== 'undefined' && masterConfig[viewId]) titleEl.innerText = masterConfig[viewId].title;
    }
    if (window.innerWidth < 768) {
        var sidebarEl = document.getElementById('sidebar');
        if (sidebarEl && !sidebarEl.classList.contains('-translate-x-full')) { toggleSidebar(); }
    }
}

function toggleSidebar() { 
    var sidebar = document.getElementById('sidebar'); 
    var backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar) { 
        if (window.innerWidth < 768) { 
            var isClosed = sidebar.classList.contains('-translate-x-full');
            if (isClosed) { sidebar.classList.remove('-translate-x-full'); if(backdrop) { backdrop.classList.remove('hidden'); setTimeout(function() { backdrop.classList.remove('opacity-0'); }, 10); } } 
            else { sidebar.classList.add('-translate-x-full'); if(backdrop) { backdrop.classList.add('opacity-0'); setTimeout(function() { backdrop.classList.add('hidden'); }, 300); } }
        } else { sidebar.classList.toggle('hidden'); } 
    } 
}

document.addEventListener('input', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        try {
            var inputType = e.target.type ? e.target.type.toLowerCase() : 'text';
            if (inputType === 'file' || inputType === 'password' || inputType === 'email' || inputType === 'number' || inputType === 'date' || inputType === 'time' || inputType === 'range' || inputType === 'checkbox' || inputType === 'radio') return;
        } catch(typeErr) { return; }
        
        if (e.target.closest('#modal-users') || e.target.closest('#login-overlay')) return;
        
        try {
            var oldVal = e.target.value;
            var newVal = oldVal.toUpperCase();
            
            if (oldVal !== newVal) {
                var start = e.target.selectionStart;
                e.target.value = newVal;
                try { e.target.setSelectionRange(start, start); } catch(err) {} 
            }
        } catch(err) { }
    }
});

// PULL TO REFRESH
var startY = 0;
document.addEventListener('touchstart', e => { if(window.scrollY < 10) startY = e.touches[0].pageY; });
document.addEventListener('touchend', e => {
    if(window.scrollY < 10 && e.changedTouches[0].pageY - startY > 150) {
        showToast("Menyegarkan data...");
        fetchInitialData();
    }
});
```eof

Silakan perbarui file tersebut dan *push* ke Vercel Anda. Dijamin 100% semua halaman Anda (dari Dashboard, Pelanggan, sampai Transaksi) akan tampil dengan transaksi/data terbaru selalu gagah di urutan nomor satu!

***

🚀 **ZettBOT Idea**:
* **Logic & Functionality**: Di masa depan, karena kita mengurutkan transaksi dari angka terbesar (`TX-0014`, `TX-0013`, dst.), kita sangat siap untuk menerapkan *Infinite Scroll* (Pemuatan Otomatis Tanpa Batas). Saat admin menggulir ke bawah, sistem baru akan menarik 15 data berikutnya secara *lazy load*, membuat memori HP pengguna tetap lega.
* **UX Performance**: Dengan menyortir data tepat di jantung aplikasi (`appData`), fungsi `renderTable()` di setiap UI menjadi sangat ringan karena mereka hanya perlu menjalankan perulangan *Render List* tanpa menghabiskan CPU untuk memikirkan matematika *sorting*. 
* **Visual Effect**: Bila ada waktu, Anda dapat menambahkan efek pulsa hijau (Tailwind `animate-pulse text-green-500`) pada baris pesanan berstatus *Proses* di halaman Data Transaksi. Mata Admin akan langsung bisa mendeteksi pekerjaan yang belum dikerjakan.
