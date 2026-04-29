// ZETTBOT BRIDGE: Auto-Switch Backend (GAS / Vercel)
// ====================================================================
// PERHATIAN: Masukkan URL Web App (hasil deploy GAS terbaru) Anda di sini!
const GAS_URL = "https://script.google.com/macros/s/AKfycbxB7xCVFJKX28NuPYASvlrWoDgcWM4cR6-101vfJ2x1pyjVaFMGaFfpvHE5SlKpuH4ULQ/exec"; 

if (typeof google === 'undefined') {
    console.log("🌐 Berjalan di Vercel/Eksternal - ZettBridge Aktif!");
    window.google = {
        script: {
            // ZETTBOT PRO FIX: Menggunakan getter agar setiap pemanggilan adalah sesi baru yang independen
            get run() {
                return {
                    _onSuccess: null,
                    _onFailure: null,
                    withSuccessHandler: function(cb) { this._onSuccess = cb; return this; },
                    withFailureHandler: function(cb) { this._onFailure = cb; return this; },
                    getInitialData: function() { this._doFetch('getInitialData', {}); return this; },
                    saveRecord: function(sheet, data) { this._doFetch('saveRecord', {sheetName: sheet, data: data}); return this; },
                    updateRecord: function(sheet, id, data) { this._doFetch('updateRecord', {sheetName: sheet, id: id, data: data}); return this; },
                    deleteRecord: function(sheet, id) { this._doFetch('deleteRecord', {sheetName: sheet, id: id}); return this; },
                    
                    // ZETTBOT FIX: Menyelaraskan pengiriman nama action ke Google menjadi saveTransaksiStaff
                    saveTransAksiStaff: function(p1, p2) {
                        var payload = (p2 !== undefined) ? { recordObj: p1, fileData: p2 } : p1;
                        this._doFetch('saveTransaksiStaff', payload);
                        return this;
                    },
                    saveTransaksiStaff: function(p1, p2) {
                        var payload = (p2 !== undefined) ? { recordObj: p1, fileData: p2 } : p1;
                        this._doFetch('saveTransaksiStaff', payload);
                        return this;
                    },
                    updateTransaksiStaffStatus: function(id, status, pmbStatus, sisaBayar) {
                        this._doFetch('updateStatusProduksi', {id: id, status: status, pmbStatus: pmbStatus, sisaBayar: sisaBayar});
                        return this;
                    },
                    updateStatusProduksi: function(id, status, pmbStatus, sisaBayar) {
                        this._doFetch('updateStatusProduksi', {id: id, status: status, pmbStatus: pmbStatus, sisaBayar: sisaBayar});
                        return this;
                    },
                    
                    _doFetch: function(action, payload) {
                        var onSuccess = this._onSuccess;
                        var onFailure = this._onFailure;
                        
                        if(!GAS_URL) { 
                            console.error("GAS_URL KOSONG!"); 
                            if(onFailure) setTimeout(function() { onFailure("GAS_URL belum diisi. Hubungi Developer."); }, 0); 
                            return; 
                        }
                        
                        var controller = null;
                        var timeoutId = null;
                        var fetchOptions = { 
                            method: 'POST', 
                            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                            body: JSON.stringify({ action: action, payload: payload })
                        };

                        if (window.AbortController) {
                            controller = new AbortController();
                            fetchOptions.signal = controller.signal;
                            timeoutId = setTimeout(function() { controller.abort(); }, 45000); 
                        }
                        
                        fetch(GAS_URL, fetchOptions)
                        .then(function(res) { 
                            if (timeoutId) clearTimeout(timeoutId);
                            if(!res.ok) throw new Error("Gagal terhubung ke Server (HTTP " + res.status + ")");
                            return res.text(); 
                        })
                        .then(function(text) {
                            var data;
                            try {
                                data = JSON.parse(text);
                            } catch(e) {
                                console.error("ZettBridge Parse Error:", text);
                                if(onFailure) setTimeout(function() { onFailure("Respon dari server gagal dibaca. Coba lagi."); }, 0);
                                return;
                            }
                            if(onSuccess) setTimeout(function() { onSuccess(data); }, 0);
                        })
                        .catch(function(err) { 
                            if (timeoutId) clearTimeout(timeoutId);
                            console.error("ZettBridge Fetch Error:", err);
                            if (err.name === 'AbortError') {
                                if(onFailure) setTimeout(function() { onFailure("Koneksi lambat (Timeout). Silakan coba lagi."); }, 0);
                            } else {
                                if(onFailure) setTimeout(function() { onFailure(err.message || "Gagal menghubungi server."); }, 0);
                            }
                        });
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

// GLOBAL STATE VARIABLES
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

// GLOBAL PAGINATION STATE
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

// UTILITIES
function resolvePelanggan(id) {
    var cust = (appData.pelanggan || []).find(function(c) { return String(c['ID']) === String(id); });
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

// MODAL CONTROLS & AUTO-FOCUS
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

// SETTINGS
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

// INITIALIZATION & RENDER
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
                setTimeout(function() { 
                    var wrapper = target.closest('[id^="staff-srv-row-"]') || target.closest('.mb-4') || target; 
                    if (wrapper) { wrapper.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
                }, 400); 
            }
        }, true);
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
            
            showLoading(false);
            
            if (isLoggedIn) {
                if (currentUser && currentUser.Role === 'ADMIN') { updateDashboard(); renderAllTables(); }
                updateAllDropdowns();
                if (typeof renderStaffTable === 'function') renderStaffTable(true);
            }
        }).withFailureHandler(function(error) { showLoading(false); showToast("Koneksi Database Gagal", "error"); }).getInitialData();
    } else { setTimeout(function() { showLoading(false); }, 500); }
}

// NAVIGATION & AUTH
function handleLogin(e) {
    e.preventDefault(); var u = document.getElementById('login-username').value.trim(); var p = document.getElementById('login-password').value;
    var user = (appData.users || []).find(function(x) { return String(x.Username).trim() === u && String(x.Password) === p; });
    if (user) { executeLogin(user); } else { showToast("Username atau Password salah!", "error"); }
}

function executeLogin(user) {
    isLoggedIn = true; currentUser = user; renderSidebarMenu();
    var btnBackAdmin = document.getElementById('btn-back-admin');
    if(btnBackAdmin) { if(user.Role === 'ADMIN') { btnBackAdmin.classList.remove('hidden'); } else { btnBackAdmin.classList.add('hidden'); } }
    var overlay = document.getElementById('login-overlay');
    if (overlay) { overlay.classList.add('opacity-0'); setTimeout(function() { overlay.classList.add('hidden'); overlay.classList.remove('flex'); }, 500); }
    if(document.getElementById('user-profile-name')) { document.getElementById('user-profile-name').innerText = user['Nama Lengkap'] || 'Staff'; }
    if(document.getElementById('user-profile-role')) { document.getElementById('user-profile-role').innerText = 'ROLE: ' + (user['Role'] || 'STAFF'); }
    if(document.getElementById('user-profile-avatar')) { document.getElementById('user-profile-avatar').innerText = (user['Nama Lengkap'] || 'S').charAt(0); }
    if(user.Role === 'ADMIN') { updateDashboard(); renderAllTables(); }
    updateAllDropdowns(); 
    
    if (typeof renderStaffTable === 'function') { 
        renderStaffTable(); 
    } else { 
        console.warn("ZettBOT Warning: renderStaffTable tidak ditemukan. Cek isi file script-pos.js Anda!"); 
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
        
        // ZETTBOT FIX: Sidebar tetap muncul di Desktop saat mode Kasir
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
