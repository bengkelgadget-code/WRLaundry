/**
 * ZETTBOT - SCRIPT ADMIN
 * Berisi Logika Dashboard, Generator View Dinamis, dan Operasi CRUD Master Data
 */

// ZETTBOT FIX: Mengamankan Helper Pelanggan & Layanan agar Dashboard tidak crash
function resolvePelanggan(id, fallbackData) {
    var idStr = String(id || '').trim();
    var rowObj = fallbackData;
    
    // 1. ZETTBOT FIX: Auto-Detect jika argumen 'id' adalah objek row itu sendiri
    if (id !== null && typeof id === 'object') {
        rowObj = id;
        idStr = String(rowObj['ID Pelanggan'] || '').trim();
    }

    // 2. Prioritas Tertinggi: Ambil dari fallbackData / baris transaksi (Sangat Ampuh Anti-Delay Firebase)
    if (rowObj && rowObj['Nama Pelanggan'] && String(rowObj['Nama Pelanggan']).trim() !== '' && String(rowObj['Nama Pelanggan']).trim() !== 'undefined') {
        return { 
            nama: rowObj['Nama Pelanggan'], 
            hp: rowObj['No Telpon'] || '-' 
        };
    }

    if (idStr !== '' && idStr !== 'undefined' && idStr !== 'null') {
        // 3. Cari di Master Data Pelanggan
        var cust = (appData.pelanggan || []).find(function(c) { return c && String(c['ID']).trim() === idStr; });
        if (cust && cust['Nama Pelanggan'] && String(cust['Nama Pelanggan']).trim() !== '') {
            return { nama: cust['Nama Pelanggan'], hp: cust['No Telpon'] || '-' };
        }
        
        // 4. ZETTBOT SUPER FALLBACK: Cari di riwayat Produksi yang punya ID Pelanggan sama
        var prodFallback = (appData.produksi || []).find(function(tx) { return tx && String(tx['ID Pelanggan']).trim() === idStr && tx['Nama Pelanggan'] && String(tx['Nama Pelanggan']).trim() !== '' && String(tx['Nama Pelanggan']).trim() !== 'undefined'; });
        if (prodFallback) {
            return { nama: prodFallback['Nama Pelanggan'], hp: prodFallback['No Telpon'] || '-' };
        }
        
        // 5. Jika ID tersimpan sebagai Nama secara tidak sengaja
        var checkDirectName = (appData.pelanggan || []).find(function(c) { return c && String(c['Nama Pelanggan']).trim().toUpperCase() === idStr.toUpperCase(); });
        if (checkDirectName && checkDirectName['Nama Pelanggan']) {
            return { nama: checkDirectName['Nama Pelanggan'], hp: checkDirectName['No Telpon'] || '-' };
        }
        
        // 6. Jika tidak ditemukan di mana pun, tampilkan ID agar tidak sekedar 'Unknown'
        return { nama: 'Pelanggan (' + idStr + ')', hp: '-' };
    }

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

function generateDynamicViews() {
    var container = document.getElementById('dynamic-view-container'); 
    var modalContainer = document.getElementById('dynamic-modal-container'); 
    
    if(!container || !modalContainer) return;
    
    var viewsHtml = ''; 
    var modalsHtml = '';

    for (var sheetName in masterConfig) {
        var config = masterConfig[sheetName]; 
        var formFields = '';
        
        config.fields.forEach(function(f) {
            var selectId = 'select-' + sheetName + '-' + f.name.replace(/\s+/g, ''); 
            var wrapperId = 'wrapper-' + sheetName + '-' + f.name.replace(/\s+/g, '');
            var hiddenClass = (sheetName === 'Pelanggan' && (f.name === 'Paket Member' || f.name === 'Sisa Kuota (Kg)')) ? 'hidden' : ''; 
            var reqAttr = (sheetName === 'Pelanggan' && (f.name === 'Paket Member' || f.name === 'Sisa Kuota (Kg)')) ? '' : 'required';
            
            if (f.type === 'select') {
                var extraAttr = ''; 
                if (sheetName === 'Pelanggan' && f.name === 'Status') { 
                    extraAttr = 'onchange="handlePelangganStatusChange(this.value)"'; 
                }
                var opts = ''; 
                f.options.forEach(function(o) { 
                    opts += '<option value="' + o + '">' + o + '</option>'; 
                });
                formFields += '<div class="' + hiddenClass + ' mb-4" id="' + wrapperId + '">' +
                                '<label class="block text-[11px] font-extrabold text-slate-500 mb-1.5 uppercase">' + f.name + '</label>' +
                                '<select name="' + f.name + '" id="' + selectId + '" ' + reqAttr + ' ' + extraAttr + ' class="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 outline-none text-sm font-medium text-slate-700">' + opts + '</select>' +
                              '</div>';
            } else if (f.type === 'dynamic-select') { 
                formFields += '<div class="' + hiddenClass + ' mb-4" id="' + wrapperId + '">' +
                                '<label class="block text-[11px] font-extrabold text-slate-500 mb-1.5 uppercase">' + f.name + '</label>' +
                                '<select name="' + f.name + '" id="' + selectId + '" ' + reqAttr + ' placeholder="🔍 Cari / Pilih ' + f.name + '..." class="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 outline-none text-sm font-medium text-slate-700"><option value=""></option></select>' +
                              '</div>'; 
            } else if (f.type === 'number' && f.name.includes('Harga')) { 
                formFields += '<div class="' + hiddenClass + ' mb-4" id="' + wrapperId + '">' +
                                '<label class="block text-[11px] font-extrabold text-slate-500 mb-1.5 uppercase">' + f.name + '</label>' +
                                '<input type="text" name="' + f.name + '" oninput="formatRupiah(this)" ' + reqAttr + ' autocomplete="off" class="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-teal-400 focus:ring-2 focus:ring-teal-50 outline-none transition-all text-sm font-medium text-slate-700">' +
                              '</div>'; 
            } else { 
                formFields += '<div class="' + hiddenClass + ' mb-4" id="' + wrapperId + '">' +
                                '<label class="block text-[11px] font-extrabold text-slate-500 mb-1.5 uppercase">' + f.name + '</label>' +
                                '<input type="' + f.type + '" name="' + f.name + '" ' + reqAttr + ' autocomplete="off" class="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-teal-400 focus:ring-2 focus:ring-teal-50 outline-none transition-all text-sm font-medium text-slate-700">' +
                              '</div>'; 
            }
        });

        var tableHeadersArr = ['ID']; 
        config.fields.forEach(function(f) { tableHeadersArr.push(f.name); }); 
        tableHeadersArr.push('Aksi'); 
        
        var tableHeaders = '';
        tableHeadersArr.forEach(function(h) { 
            if (h === 'Aksi') { 
                tableHeaders += '<th class="text-right w-36">' + h + '</th>'; 
            } else { 
                var iconId = 'icon-sort-' + sheetName + '-' + h.replace(/\s+/g, ''); 
                tableHeaders += '<th onclick="handleSort(\'' + sheetName + '\', \'' + h + '\')" class="cursor-pointer hover:bg-slate-200 transition-colors select-none group"><div class="flex items-center justify-between"><span>' + h + '</span><i class="ph-bold ph-caret-up-down text-slate-300 group-hover:text-slate-500 sort-icon-' + sheetName + '" id="' + iconId + '"></i></div></th>'; 
            } 
        });
        
        var modalId = 'modal-' + config.id;
        
        viewsHtml += '<div id="view-' + config.id + '" class="view-section hidden fade-in p-4 sm:p-6 w-full">' +
                        '<div class="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col flex-1 overflow-hidden min-h-0">' +
                            '<div class="p-4 sm:p-5 border-b border-slate-100 flex justify-between items-center bg-white z-10 shadow-sm shrink-0">' +
                                '<h2 class="text-md font-bold text-slate-800 hidden sm:block">' + config.title + '</h2>' +
                                '<div class="flex items-center gap-3 ml-auto w-full sm:w-auto">' +
                                    '<div class="relative w-full sm:w-56">' +
                                        '<i class="ph-bold ph-magnifying-glass absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"></i>' +
                                        '<input type="text" id="search-' + sheetName + '" oninput="renderTable(\'' + sheetName + '\', false)" placeholder="Cari data..." class="w-full pl-9 pr-3 py-2 text-sm font-medium border border-slate-200 rounded-xl focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-50 transition-all bg-slate-50">' +
                                    '</div>' +
                                    '<button onclick="openModal(\'' + modalId + '\')" class="bg-gradient-to-r from-teal-400 to-teal-500 hover:from-teal-500 hover:to-teal-600 text-white text-sm font-bold py-2.5 px-4 rounded-xl shadow-md shadow-teal-500/30 transition-all flex items-center whitespace-nowrap active:scale-95"><i class="ph-bold ph-plus mr-2 text-lg"></i> Tambah</button>' +
                                '</div>' +
                            '</div>' +
                            '<div class="overflow-auto flex-1 relative bg-slate-50/50 px-4 pt-0 pb-0 min-h-0">' +
                                '<table class="table-modern min-w-max">' +
                                    '<thead class="sticky top-0 z-20 shadow-sm border-b border-slate-200"><tr>' + tableHeaders + '</tr></thead>' +
                                    '<tbody id="table-' + sheetName + '"></tbody>' +
                                '</table>' +
                            '</div>' +
                            '<div id="pagination-' + sheetName + '" class="w-full shrink-0 border-t border-slate-100 bg-white"></div>' +
                        '</div>' +
                    '</div>';
        
        modalsHtml += '<div id="' + modalId + '" class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[55] hidden items-center justify-center p-4">' +
                        '<div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden relative modal-enter">' +
                            '<button type="button" onclick="closeModal(\'' + modalId + '\')" class="absolute top-4 right-4 w-8 h-8 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center hover:bg-red-100 hover:text-red-600 transition-colors z-10"><i class="ph-bold ph-x"></i></button>' +
                            '<div class="px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">' +
                                '<h3 class="text-lg font-extrabold text-slate-800">Tambah Data ' + config.title + '</h3>' +
                            '</div>' +
                            '<div class="p-6">' +
                                '<form onsubmit="handleFormSubmit(event, \'' + sheetName + '\', \'' + modalId + '\')">' + 
                                    formFields + 
                                    '<div class="mt-6 flex justify-end"><button type="submit" class="bg-gradient-to-r from-teal-400 to-teal-500 hover:from-teal-500 hover:to-teal-600 text-white font-bold py-2.5 px-6 rounded-xl shadow-lg shadow-teal-500/30 transition-all flex items-center w-full sm:w-auto justify-center"><i class="ph-bold ph-floppy-disk mr-2"></i> Simpan Data</button></div>' +
                                '</form>' +
                            '</div>' +
                        '</div>' +
                    '</div>';
    }

    // ZETTBOT FIX: Modifikasi Filter di History Modal untuk lebih ringkas dan tambahkan tombol export sejajar & melayang
    var historyModalHtml = '<div id="modal-history-pelanggan" style="z-index: 9998;" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden items-center justify-center p-4">' +
                            '<div class="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg flex flex-col relative modal-enter overflow-hidden max-h-[90vh]">' +
                                '<div class="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-white z-20 shrink-0">' +
                                    '<h3 class="text-lg font-black text-slate-800 tracking-tight flex items-center truncate"><i class="ph-bold ph-clock-counter-clockwise mr-2 text-teal-600"></i> History: <span id="history-cust-name" class="ml-2 text-teal-600 truncate max-w-[150px]"></span></h3>' +
                                    '<button type="button" onclick="closeModal(\'modal-history-pelanggan\')" class="w-8 h-8 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center hover:bg-red-100 hover:text-red-600 transition-colors shrink-0"><i class="ph-bold ph-x"></i></button>' +
                                '</div>' +
                                '<div class="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-3 z-10 shrink-0 flex-wrap">' +
                                    '<div class="flex gap-1 items-center flex-1 min-w-[200px]">' +
                                        '<select id="filter-history-type" onchange="renderHistoryPelanggan()" class="w-1/3 px-2 py-2 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-teal-300"><option value="all">Semua</option><option value="month">Per Bulan</option><option value="date">Tanggal</option></select>' +
                                        '<input type="month" id="filter-history-month" onchange="renderHistoryPelanggan()" class="hidden w-2/3 px-2 py-2 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-teal-300">' +
                                        '<input type="date" id="filter-history-date" onchange="renderHistoryPelanggan()" class="hidden w-2/3 px-2 py-2 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-teal-300">' +
                                    '</div>' +
                                    '<div class="flex gap-2 shrink-0">' +
                                        '<button type="button" onclick="exportHistory(\'pdf\')" class="flex items-center justify-center bg-white text-rose-500 border border-rose-100 shadow-[0_4px_10px_rgba(244,63,94,0.15)] hover:shadow-[0_6px_15px_rgba(244,63,94,0.2)] hover:-translate-y-0.5 rounded-xl px-4 py-2 text-[11px] font-black transition-all active:scale-95"><i class="ph-bold ph-file-pdf text-sm mr-1.5"></i> PDF</button>' +
                                        '<button type="button" onclick="exportHistory(\'wa\')" class="flex items-center justify-center bg-gradient-to-r from-emerald-400 to-emerald-500 text-white shadow-[0_4px_10px_rgba(16,185,129,0.3)] hover:shadow-[0_6px_15px_rgba(16,185,129,0.4)] hover:-translate-y-0.5 rounded-xl px-4 py-2 text-[11px] font-black transition-all active:scale-95"><i class="ph-bold ph-whatsapp-logo text-sm mr-1.5"></i> WA</button>' +
                                    '</div>' +
                                '</div>' +
                                '<div class="overflow-y-auto flex-1 p-4 bg-slate-50 w-full relative" id="history-list-container"></div>' +
                                '<div class="p-4 bg-white border-t border-slate-100 shrink-0 grid grid-cols-3 gap-2 text-center shadow-[0_-5px_15px_rgba(0,0,0,0.02)] z-20">' +
                                    '<div class="bg-slate-50 rounded-xl p-2 border border-slate-100"><p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Berat Kiloan</p><p class="text-sm font-black text-slate-800" id="history-total-kg">0 Kg</p></div>' +
                                    '<div class="bg-slate-50 rounded-xl p-2 border border-slate-100"><p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Satuan</p><p class="text-sm font-black text-slate-800" id="history-total-pcs">0 Pcs</p></div>' +
                                    '<div class="bg-teal-50 rounded-xl p-2 border border-teal-100"><p class="text-[9px] font-black text-teal-500 uppercase tracking-widest mb-0.5">Total Biaya</p><p class="text-sm font-black text-teal-700 truncate" id="history-total-rp">Rp 0</p></div>' +
                                '</div>' +
                            '</div>' +
                          '</div>';
    
    container.innerHTML = viewsHtml; 
    modalContainer.innerHTML = modalsHtml + historyModalHtml;
}

function renderAllTables() { 
    renderTable('Produksi', true); 
    for (var key in masterConfig) { renderTable(key, true); } 
}

function renderTable(sheetName, keepPage) {
    if (!keepPage) { pageConfig[sheetName].page = 1; }

    var data = [];
    if (sheetName === 'Produksi') data = appData.produksi; 
    else if (sheetName === 'Users') data = appData.users; 
    else data = appData[sheetName.toLowerCase().replace('layanan', '')];
    
    if (!data) data = [];
    
    var tbody = document.getElementById('table-' + sheetName); 
    if(!tbody) return;
    
    document.querySelectorAll('.sort-icon-' + sheetName).forEach(function(el) { 
        el.className = 'ph-bold ph-caret-up-down text-slate-300 group-hover:text-slate-500 sort-icon-' + sheetName; 
    });
    
    var sort = sortConfig[sheetName];
    if (sort && sort.key) { 
        var safeKey = sort.key.replace(/\s+/g, ''); 
        var iconEl = document.getElementById('icon-sort-' + sheetName + '-' + safeKey); 
        if (iconEl) { 
            iconEl.className = sort.dir === 'asc' ? 'ph-bold ph-caret-up text-slate-800 sort-icon-' + sheetName : 'ph-bold ph-caret-down text-slate-800 sort-icon-' + sheetName; 
        } 
    }

    var displayData = []; 
    for (var d = 0; d < data.length; d++) { 
        displayData.push(data[d]); 
    }
    
    var searchInput = document.getElementById('search-' + sheetName); 
    var searchTerm = searchInput ? (searchInput.value || '').toLowerCase() : '';
    
    if (searchTerm) {
        displayData = displayData.filter(function(row) {
            var text = Object.values(row).map(function(v) { return String(v).toLowerCase(); }).join(' ');
            if(sheetName === 'Produksi') { 
                var c = resolvePelanggan(row['ID Pelanggan'], row); 
                text += ' ' + c.nama.toLowerCase() + ' ' + c.hp.toLowerCase() + ' ' + resolveLayananNameForProduksi(row['Layanan']).toLowerCase(); 
            }
            return text.includes(searchTerm);
        });
    }

    if (sort && sort.key) {
        displayData.sort(function(a, b) {
            var valA = a[sort.key]; 
            var valB = b[sort.key]; 
            var numA = parseFloat(String(valA).replace(/[^0-9.-]+/g,"")); 
            var numB = parseFloat(String(valB).replace(/[^0-9.-]+/g,""));
            
            if (!isNaN(numA) && !isNaN(numB) && String(valA).match(/\d/) && String(valB).match(/\d/)) { 
                valA = numA; 
                valB = numB; 
            } else { 
                valA = String(valA).toLowerCase(); 
                valB = String(valB).toLowerCase(); 
            }
            
            if (valA < valB) return sort.dir === 'asc' ? -1 : 1; 
            if (valA > valB) return sort.dir === 'asc' ? 1 : -1; 
            return 0;
        });
    }

    var totalItems = displayData.length;
    var limit = pageConfig[sheetName].limit;
    var totalPages = Math.ceil(totalItems / limit);
    
    if (pageConfig[sheetName].page > totalPages && totalPages > 0) pageConfig[sheetName].page = 1;
    var startIdx = (pageConfig[sheetName].page - 1) * limit;
    var paginatedData = displayData.slice(startIdx, startIdx + limit);

    tbody.innerHTML = '';
    var paginationWrapperId = 'pagination-' + sheetName;
    var paginationEl = document.getElementById(paginationWrapperId);

    if (!paginationEl) {
        var tableWrapper = tbody.closest('.overflow-auto');
        if (tableWrapper) {
            paginationEl = document.createElement('div');
            paginationEl.id = paginationWrapperId;
            paginationEl.className = 'w-full shrink-0 border-t border-slate-200 bg-white rounded-b-2xl relative z-30';
            tableWrapper.parentNode.insertBefore(paginationEl, tableWrapper.nextSibling);
        }
    }

    if (paginatedData.length === 0) {
        var colSpan = sheetName === 'Produksi' ? 6 : (masterConfig[sheetName] ? masterConfig[sheetName].fields.length + 2 : 5);
        tbody.innerHTML = '<tr><td colspan="' + colSpan + '" class="text-center text-slate-400 italic font-normal border-0 py-8 bg-transparent">Tidak ada data ditemukan.</td></tr>';
        if (paginationEl) paginationEl.innerHTML = ''; 
        return;
    }

    var htmlBatch = '';
    paginatedData.forEach(function(row) {
        var htmlTr = '<tr>';
        if (sheetName === 'Produksi') {
            var cust = resolvePelanggan(row['ID Pelanggan'], row);
            var statusBadge = '';
            if(row['Status'] === 'Proses') { 
                statusBadge = '<span class="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-200 shadow-sm"><i class="ph-bold ph-spinner-gap animate-spin inline-block mr-1"></i>Proses</span>'; 
            } else if(row['Status'] === 'Selesai') { 
                statusBadge = '<span class="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 border border-emerald-200 shadow-sm"><i class="ph-bold ph-check-circle inline-block mr-1"></i>Selesai</span>'; 
            } else if(row['Status'] === 'Diambil') { 
                statusBadge = '<span class="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-700 border border-blue-200 shadow-sm"><i class="ph-bold ph-hand-pointing inline-block mr-1"></i>Diambil</span>'; 
            } else { 
                statusBadge = '<span class="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200 shadow-sm">' + row['Status'] + '</span>'; 
            }
            
            htmlTr += '<td><div class="font-bold text-slate-800">' + (row['Waktu Masuk'] ? String(row['Waktu Masuk']).split(' ')[0] : '-') + '</div><div class="bg-slate-100 text-slate-500 px-2 py-1 rounded-lg text-[10px] font-bold border border-slate-200 inline-block mt-1">' + row['ID'] + '</div></td>';
            htmlTr += '<td><div class="font-bold text-slate-800">' + cust.nama + '</div><div class="font-mono text-[10px] font-bold text-indigo-500 mt-0.5">' + (row['No Nota'] || '-') + '</div></td>';
            
            var layananStr = resolveLayananNameForProduksi(row['Layanan']);
            htmlTr += '<td><div class="text-slate-600 font-bold text-[12px] truncate max-w-[200px]" title="' + layananStr + '">' + layananStr + '</div></td>';
            htmlTr += '<td class="font-mono font-black text-slate-800 text-[14px]">Rp ' + Number(row['Total Harga'] || 0).toLocaleString('id-ID') + '</td>';
            htmlTr += '<td>' + statusBadge + '</td>';
            htmlTr += '<td class="text-right whitespace-nowrap"><button onclick="viewProduksiDetail(\'' + row['ID'] + '\')" class="text-indigo-600 hover:text-white bg-indigo-50 hover:bg-indigo-500 p-2 rounded-xl transition-all mr-1.5 inline-flex items-center justify-center shadow-sm active:scale-95" title="Lihat Detail Lengkap"><i class="ph-bold ph-eye text-[16px]"></i></button><button onclick="openTxDetail(\'' + row['ID'] + '\')" class="text-amber-500 hover:text-white bg-amber-50 hover:bg-amber-500 p-2 rounded-xl transition-all mr-1.5 inline-flex items-center justify-center shadow-sm active:scale-95" title="Edit / Update Status"><i class="ph-bold ph-pencil-simple text-[16px]"></i></button><button onclick="deleteRecord(\'Produksi\', \'' + row['ID'] + '\')" class="text-red-500 hover:text-white bg-rose-50 hover:bg-rose-500 p-2 rounded-xl transition-all inline-flex items-center justify-center shadow-sm active:scale-95" title="Hapus"><i class="ph-bold ph-trash text-[16px]"></i></button></td>';
        } else {
            htmlTr += '<td><span class="bg-slate-100 text-slate-500 px-2 py-1 rounded-lg text-[10px] font-bold border border-slate-200 inline-block">' + row['ID'] + '</span></td>';
            
            masterConfig[sheetName].fields.forEach(function(f) {
                var val = row[f.name] || '-'; 
                if (f.name === 'Status') {
                    if (val === 'Member') { 
                        val = '<span class="px-2.5 py-1 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg font-black text-[10px] uppercase tracking-wider shadow-sm"><i class="ph-fill ph-diamond"></i> Member</span>'; 
                    } else { 
                        val = '<span class="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg font-bold text-[10px] uppercase tracking-wider border border-slate-200">Umum</span>'; 
                    }
                } else if (f.name === 'Paket Member') { 
                    var p = (appData.member || []).find(function(x) { return x['ID'] === val; }); 
                    val = p ? '<span class="font-bold text-slate-700">' + p['Nama Paket'] + '</span>' : '<span class="text-slate-400">-</span>'; 
                } else if (f.type === 'dynamic-select' && val !== '-') { 
                    var w = (appData.waktu || []).find(function(x) { return x['ID'] === val; }); 
                    if (w) { 
                        val = '<span class="px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-md text-[10px] font-bold whitespace-nowrap tracking-wide"><i class="ph-bold ph-clock mr-1"></i>' + w['Nama Layanan'] + ' (' + w['Waktu (Jam)'] + 'J)</span>'; 
                    } else { 
                        val = '<span class="text-red-400 text-[12px] italic">Data Terhapus</span>'; 
                    } 
                } else if (f.name.includes('Harga')) { 
                    val = '<span class="font-mono text-emerald-600 font-black">Rp ' + Number(val).toLocaleString('id-ID') + '</span>'; 
                } else if (f.name === 'Sisa Kuota (Kg)') { 
                    var numVal = parseFloat(val); 
                    var finalVal = !isNaN(numVal) ? (Math.round(numVal * 100) / 100) : val; 
                    val = '<span class="font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 shadow-sm">' + finalVal + ' Kg</span>'; 
                } else if (f.name === 'Password') { 
                    val = '<span class="text-slate-300 font-mono">••••••••</span>'; 
                }
                htmlTr += '<td>' + val + '</td>';
            });
            htmlTr += '<td class="text-right whitespace-nowrap"><button onclick="viewRecord(\'' + sheetName + '\', \'' + row['ID'] + '\')" class="text-indigo-600 hover:text-white bg-indigo-50 hover:bg-indigo-500 p-2 rounded-xl transition-all mr-1.5 inline-flex items-center justify-center shadow-sm active:scale-95" title="Lihat Detail"><i class="ph-bold ph-eye text-[16px]"></i></button><button onclick="editRecord(\'' + sheetName + '\', \'' + row['ID'] + '\')" class="text-amber-500 hover:text-white bg-amber-50 hover:bg-amber-500 p-2 rounded-xl transition-all mr-1.5 inline-flex items-center justify-center shadow-sm active:scale-95" title="Edit"><i class="ph-bold ph-pencil-simple text-[16px]"></i></button><button onclick="deleteRecord(\'' + sheetName + '\', \'' + row['ID'] + '\')" class="text-red-500 hover:text-white bg-rose-50 hover:bg-rose-500 p-2 rounded-xl transition-all inline-flex items-center justify-center shadow-sm active:scale-95" title="Hapus"><i class="ph-bold ph-trash text-[16px]"></i></button></td>';
        }
        htmlTr += '</tr>'; 
        htmlBatch += htmlTr;
    });
    tbody.innerHTML = htmlBatch;

    if (paginationEl) {
        paginationEl.innerHTML = generatePaginationHTML(sheetName, totalItems);
    }
}

function handleSort(sheetName, colName) {
    if (!sortConfig[sheetName]) { 
        sortConfig[sheetName] = { key: null, dir: null }; 
    }
    if (sortConfig[sheetName].key === colName) { 
        sortConfig[sheetName].dir = sortConfig[sheetName].dir === 'asc' ? 'desc' : 'asc'; 
    } else { 
        sortConfig[sheetName].key = colName; 
        sortConfig[sheetName].dir = 'asc'; 
    }
    renderTable(sheetName, false); 
}

function updateDashboard() {
    var masuk = appData.produksi.length; 
    var proses = appData.produksi.filter(function(d) { return d['Status'] === 'Proses'; }).length; 
    var selesai = appData.produksi.filter(function(d) { return d['Status'] === 'Selesai'; }).length;
    var todayStr = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date()); 
    var pendapatanHariIni = 0;
    
    appData.produksi.forEach(function(d) { 
        if (String(d['Waktu Masuk']).includes(todayStr)) { 
            var pmb = d['Pembayaran']; 
            if (pmb === 'Lunas' || pmb === 'Potong Kuota') { 
                pendapatanHariIni += Number(d['Total Harga']) || 0; 
            } else if (pmb === 'DP') { 
                pendapatanHariIni += Number(d['DP']) || 0; 
            } 
        } 
    });

    if (document.getElementById('dash-masuk')) document.getElementById('dash-masuk').innerText = masuk;
    if (document.getElementById('dash-proses')) document.getElementById('dash-proses').innerText = proses;
    if (document.getElementById('dash-selesai')) document.getElementById('dash-selesai').innerText = selesai;
    if (document.getElementById('dash-pendapatan')) document.getElementById('dash-pendapatan').innerText = 'Rp ' + new Intl.NumberFormat('id-ID').format(pendapatanHariIni);

    var tbody = document.getElementById('dash-table-body'); 
    if (!tbody) return; 
    
    tbody.innerHTML = '';
    var prodCopy = []; 
    for (var m = 0; m < appData.produksi.length; m++) { 
        prodCopy.push(appData.produksi[m]); 
    } 
    
    var last5 = prodCopy.slice(0, 5);
    
    if (last5.length === 0) { 
        tbody.innerHTML = '<tr><td colspan="4" class="py-6 px-3 text-center text-slate-400 italic font-normal border-0">Belum ada transaksi terakhir.</td></tr>'; 
    } else {
        last5.forEach(function(row) {
            var cust = resolvePelanggan(row['ID Pelanggan'], row); 
            var stColor = '';
            
            if(row['Status'] === 'Proses') { 
                stColor = 'text-amber-700 bg-amber-100 border border-amber-200'; 
            } else if(row['Status'] === 'Selesai') { 
                stColor = 'text-emerald-700 bg-emerald-100 border border-emerald-200'; 
            } else if(row['Status'] === 'Diambil') { 
                stColor = 'text-blue-700 bg-blue-100 border border-blue-200'; 
            } else { 
                stColor = 'text-slate-700 bg-slate-100 border border-slate-200'; 
            }
            
            var layananStr = resolveLayananNameForProduksi(row['Layanan']);
            var htmlTr = '<tr>'; 
            htmlTr += '<td class="font-mono text-[11px] font-bold text-slate-500">' + row['ID'] + '</td>'; 
            htmlTr += '<td><div class="font-bold text-slate-800 text-[13px]">' + cust.nama + '</div><div class="font-mono text-[10px] text-slate-400">' + (row['No Nota'] || '-') + '</div></td>'; 
            htmlTr += '<td><div class="text-slate-600 font-semibold text-[12px] truncate max-w-[150px]" title="' + layananStr + '">' + layananStr + '</div><div class="text-slate-500 font-black text-[11px]">Rp ' + Number(row['Total Harga'] || 0).toLocaleString('id-ID') + '</div></td>'; 
            htmlTr += '<td class="text-right"><span class="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm ' + stColor + '">' + row['Status'] + '</span></td>'; 
            htmlTr += '</tr>'; 
            tbody.innerHTML += htmlTr;
        });
    }
}

// CRUD & FORMS
function handleFormSubmit(event, sheetName, modalId) {
    event.preventDefault(); 
    var form = event.target; 
    var formData = new FormData(form); 
    var recordObj = {};
    
    formData.forEach(function(value, key) { 
        var finalVal = value; 
        if (key.includes('Harga')) { finalVal = value.replace(/\./g, ''); } 
        if (key === 'No Telpon' && finalVal !== '') { finalVal = "'" + finalVal.replace(/^'+/, ''); } 
        recordObj[key] = finalVal; 
    });
    
    var btn = form.querySelector('button[type="submit"]'); 
    var originalText = btn.innerHTML; 
    btn.innerHTML = '<i class="ph-bold ph-spinner animate-spin mr-2"></i> Menyimpan...'; 
    btn.disabled = true;

    var successHandler = function(result) {
        btn.innerHTML = originalText; 
        btn.disabled = false;
        
        try {
            if (result.success) {
                form.reset(); 
                closeModal(modalId); 
                showToast(result.message);
                
                var newData = result.data;
                if (sheetName === 'Pelanggan') { 
                    newData = newData.map(function(p) { 
                        if (p['No Telpon']) { 
                            var hpStr = String(p['No Telpon']); 
                            if (hpStr.startsWith("'")) { hpStr = hpStr.substring(1); } 
                            p['No Telpon'] = hpStr; 
                        } 
                        return p; 
                    }); 
                }
                
                if (typeof sortDataByIdDesc === 'function') {
                    newData = sortDataByIdDesc(newData);
                }
                
                var objKey = sheetName.toLowerCase().replace('layanan', ''); 
                appData[objKey] = newData; 
                
                if(sheetName === 'Produksi') appData.produksi = newData; 
                if(sheetName === 'Users') appData.users = newData;
                
                if(result.pelanggan) { 
                    var cleanPlg = result.pelanggan.map(function(p) { 
                        if (p['No Telpon']) { 
                            var hpStr = String(p['No Telpon']); 
                            if (hpStr.startsWith("'")) { hpStr = hpStr.substring(1); } 
                            p['No Telpon'] = hpStr; 
                        } 
                        return p; 
                    }); 
                    appData.pelanggan = typeof sortDataByIdDesc === 'function' ? sortDataByIdDesc(cleanPlg) : cleanPlg;
                }
                
                updateDashboard(); 
                updateAllDropdowns(); 
                renderTable(sheetName, true); 
                if(sheetName !== 'Produksi') { renderTable('Produksi', true); } 
                renderStaffTable(true); 
            } else { 
                showToast(result.message, "error"); 
            }
        } catch(err) { 
            console.error(err); 
            showToast("Sistem error saat render tabel.", "error"); 
        }
    };
    
    var errorHandler = function(err) { 
        btn.innerHTML = originalText; 
        btn.disabled = false; 
        console.error(err); 
        showToast("Error komunikasi server!", "error"); 
    };

    if (typeof google === 'undefined' || !google.script) { 
        btn.innerHTML = originalText; 
        btn.disabled = false; 
        closeModal(modalId); 
        return; 
    }
    
    if (isEditMode && currentEditId) { 
        google.script.run.withSuccessHandler(successHandler).withFailureHandler(errorHandler).updateRecord(sheetName, currentEditId, recordObj); 
    } else { 
        google.script.run.withSuccessHandler(successHandler).withFailureHandler(errorHandler).saveRecord(sheetName, recordObj); 
    }
}

function viewRecord(sheetName, id) {
    if (sheetName === 'Pelanggan') {
        openHistoryPelanggan(id);
        return;
    }

    editRecord(sheetName, id);
    
    setTimeout(function() {
        var modalId = sheetName === 'Produksi' ? 'modal-produksi' : 'modal-' + masterConfig[sheetName].id;
        var modal = document.getElementById(modalId); 
        if (!modal) return;
        
        var titleEl = modal.querySelector('h3'); 
        if(titleEl) { 
            titleEl.innerText = titleEl.innerText.replace('Edit', 'Detail Lengkap'); 
        }
        
        var form = modal.querySelector('form');
        if(form) {
            form.querySelectorAll('input, select').forEach(function(el) { 
                el.disabled = true; 
                el.classList.add('bg-slate-100', 'cursor-not-allowed', 'opacity-70'); 
            });
            form.querySelectorAll('select').forEach(function(el) { 
                if(tsInstances[el.id]) { 
                    tsInstances[el.id].disable(); 
                } 
            });
            var btnSubmit = form.querySelector('button[type="submit"]'); 
            if(btnSubmit) { 
                btnSubmit.style.display = 'none'; 
            }
        }
    }, 100);
}

function editRecord(sheetName, id) {
    isFormPopulating = true; 
    isEditMode = true; 
    currentEditId = id;
    
    var data = []; 
    if (sheetName === 'Produksi') data = appData.produksi; 
    else if (sheetName === 'Users') data = appData.users; 
    else if (sheetName === 'Pelanggan') data = appData.pelanggan; 
    else data = appData[sheetName.toLowerCase().replace('layanan', '')];
    
    var record = (data||[]).find(function(r) { return r['ID'] === id; }); 
    if (!record) { showToast("Data gagal dimuat!", "error"); return; }
    
    var modalId = sheetName === 'Produksi' ? 'modal-produksi' : 'modal-' + masterConfig[sheetName].id; 
    var modal = document.getElementById(modalId); 
    if (!modal) return;
    
    modal.classList.remove('hidden'); 
    modal.classList.add('flex'); 
    
    var form = modal.querySelector('form');
    if(form) {
        form.reset();
        form.querySelectorAll('input, select').forEach(function(el) { 
            el.disabled = false; 
            el.classList.remove('bg-slate-100', 'cursor-not-allowed', 'opacity-70'); 
        });
        form.querySelectorAll('select').forEach(function(el) { 
            if(tsInstances[el.id]) { tsInstances[el.id].enable(); } 
        });
        
        var btnSubmit = form.querySelector('button[type="submit"]'); 
        if(btnSubmit) { btnSubmit.style.display = ''; }
        
        var titleEl = modal.querySelector('h3'); 
        if(titleEl) { titleEl.innerText = titleEl.innerText.replace('Tambah', 'Edit').replace('Detail Lengkap', 'Edit'); }
        
        Object.keys(record).forEach(function(key) {
            var input = form.querySelector('[name="' + key + '"]');
            if (input) {
                var displayVal = record[key]; 
                if (key === 'No Telpon' && String(displayVal).startsWith("'")) { 
                    displayVal = String(displayVal).substring(1); 
                }
                if (key.includes('Harga') && displayVal) { 
                    input.value = new Intl.NumberFormat('id-ID').format(displayVal); 
                } else { 
                    input.value = displayVal; 
                }
                if (input.tagName === 'SELECT' && tsInstances[input.id]) { 
                    tsInstances[input.id].setValue(displayVal); 
                }
            }
        });
        
        if (sheetName === 'Pelanggan') { 
            var statusVal = record['Status'] || 'Umum'; 
            var statusEl = document.getElementById('select-Pelanggan-Status'); 
            if(statusEl) { 
                statusEl.value = statusVal; 
                handlePelangganStatusChange(statusVal); 
            } 
        }
    }
    
    setTimeout(function() { 
        isFormPopulating = false; 
        var modal = document.getElementById(modalId);
        if(modal) {
            var firstInput = modal.querySelector('input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])');
            if(firstInput) {
                if(firstInput.tagName === 'SELECT' && tsInstances[firstInput.id]) { 
                    tsInstances[firstInput.id].focus(); 
                } else { 
                    firstInput.focus(); 
                }
            }
        }
    }, 100);
}

function deleteRecord(sheetName, id) {
    zettConfirm("Konfirmasi Hapus", "Yakin ingin menghapus data ini? Tindakan ini akan menghapus data permanen dari database.", "danger", function() {
        showLoading(true);
        if (typeof google === 'undefined' || !google.script) { 
            showToast("Mock delete", "success"); 
            showLoading(false); 
            return; 
        }
        google.script.run.withSuccessHandler(function(res) {
            try {
                if(res.success) {
                    var newData = res.data;
                    if (sheetName === 'Pelanggan') { 
                        newData = newData.map(function(p) { 
                            if (p['No Telpon']) { 
                                var hpStr = String(p['No Telpon']); 
                                if (hpStr.startsWith("'")) { hpStr = hpStr.substring(1); } 
                                p['No Telpon'] = hpStr; 
                            } 
                            return p; 
                        }); 
                    }
                    
                    if (typeof sortDataByIdDesc === 'function') {
                        newData = sortDataByIdDesc(newData);
                    }
                    
                    if (res.pelanggan) {
                         var cleanPlg = res.pelanggan.map(function(p) { 
                             if (p['No Telpon']) { 
                                 var hpStr = String(p['No Telpon']); 
                                 if (hpStr.startsWith("'")) { hpStr = hpStr.substring(1); } 
                                 p['No Telpon'] = hpStr; 
                             } 
                             return p; 
                         });
                         appData.pelanggan = typeof sortDataByIdDesc === 'function' ? sortDataByIdDesc(cleanPlg) : cleanPlg;
                    }
                    
                    var objKey = sheetName.toLowerCase().replace('layanan', ''); 
                    appData[objKey] = newData;
                    
                    if(sheetName === 'Produksi') appData.produksi = newData; 
                    if(sheetName === 'Users') appData.users = newData; 
                    if(sheetName === 'Pelanggan') appData.pelanggan = newData;
                    
                    updateDashboard(); 
                    updateAllDropdowns(); 
                    renderTable(sheetName, true); 
                    if(typeof renderStaffTable === 'function') renderStaffTable(true);
                    
                    showLoading(false); 
                    showToast(res.message);
                } else { 
                    showLoading(false); 
                    showToast(res.message, "error"); 
                }
            } catch(err) { 
                console.error(err); 
                showLoading(false); 
                showToast("JS Error Update UI", "error"); 
            }
        }).withFailureHandler(function(err) { 
            console.error(err); 
            showLoading(false); 
            showToast("Sistem error saat menghapus data", "error"); 
        }).deleteRecord(sheetName, id);
    });
}

function handlePelangganStatusChange(val) {
    var wrapPaket = document.getElementById('wrapper-Pelanggan-PaketMember'); 
    var wrapKuota = document.getElementById('wrapper-Pelanggan-SisaKuota(Kg)'); 
    var elPaket = document.getElementById('select-Pelanggan-PaketMember'); 
    var elKuota = document.querySelector('input[name="Sisa Kuota (Kg)"]');
    
    if (val === 'Member') {
        if(wrapPaket) wrapPaket.classList.remove('hidden'); 
        if(wrapKuota) wrapKuota.classList.remove('hidden'); 
        if(elPaket) elPaket.setAttribute('required', 'true'); 
        if(elKuota) elKuota.setAttribute('required', 'true');
    } else {
        if(wrapPaket) wrapPaket.classList.add('hidden'); 
        if(wrapKuota) wrapKuota.classList.add('hidden'); 
        if(elPaket) elPaket.removeAttribute('required'); 
        if(elKuota) elKuota.removeAttribute('required');
        
        if (!isFormPopulating) { 
            if(tsInstances['select-Pelanggan-PaketMember']) tsInstances['select-Pelanggan-PaketMember'].setValue(''); 
            if (elKuota) elKuota.value = 0; 
        }
    }
}

function updateAllDropdowns() {
    try { initCustomerAutocomplete(); } catch(e) {}
    try {
        var commonOnKeyDown = function(e) {
            if(e.key === 'Tab' || e.key === 'Enter') {
                if(this.isOpen) { 
                    e.preventDefault(); 
                    var targetOpt = this.activeOption; 
                    if (!targetOpt) { 
                        var opts = this.dropdown_content.querySelectorAll('.option'); 
                        if (opts.length > 0) targetOpt = opts[0]; 
                    } 
                    if (targetOpt) { 
                        var val = targetOpt.getAttribute('data-value'); 
                        if (val) this.setValue(val); 
                    } 
                    this.close(); 
                    this.blur(); 
                }
            }
        };

        var paketPelangganEl = document.getElementById('select-Pelanggan-PaketMember');
        if (paketPelangganEl) {
            var optionsHtml = '<option value=""></option>';
            (appData.member || []).forEach(function(m) { 
                optionsHtml += '<option value="' + m['ID'] + '">' + m['Nama Paket'] + ' (' + m['Kuota (Kg)'] + ' Kg)</option>'; 
            });
            if(tsInstances['select-Pelanggan-PaketMember']) { 
                tsInstances['select-Pelanggan-PaketMember'].destroy(); 
            }
            paketPelangganEl.innerHTML = optionsHtml;
            tsInstances['select-Pelanggan-PaketMember'] = new TomSelect(paketPelangganEl, { 
                create: false, 
                placeholder: "🔍 Cari / Pilih Paket...", 
                selectOnTab: true, 
                openOnFocus: true, 
                shouldLoad: function(query) { return true; }, 
                onKeyDown: commonOnKeyDown, 
                onChange: function(val) { 
                    if (val && !isFormPopulating) { 
                        var selectedMember = (appData.member || []).find(function(m) { return m['ID'] === val; }); 
                        if(selectedMember) { 
                            var sisaEl = document.querySelector('input[name="Sisa Kuota (Kg)"]'); 
                            if(sisaEl) { 
                                sisaEl.value = selectedMember['Kuota (Kg)']; 
                                sisaEl.classList.add('transition-all', 'ring-2', 'ring-indigo-500', 'bg-indigo-50'); 
                                setTimeout(function() { 
                                    sisaEl.classList.remove('ring-2', 'ring-indigo-500', 'bg-indigo-50'); 
                                }, 500); 
                            } 
                        } 
                    } 
                } 
            });
        }

        var selectProduksi = document.getElementById('select-layanan-produksi');
        if (selectProduksi) {
            var optionsHtmlProd = '<option value="">-- Cari Layanan --</option>';
            (appData.kiloan || []).forEach(function(k) { 
                var w = (appData.waktu || []).find(function(x) { return x['ID'] === k['Jenis Waktu']; }); 
                var wStr = w ? ' [' + w['Nama Layanan'] + ']' : ''; 
                optionsHtmlProd += '<option value="' + k['ID'] + '">' + k['Nama Layanan'] + wStr + ' - Rp ' + Number(k['Harga/Kg']).toLocaleString('id-ID') + '/Kg</option>'; 
            });
            (appData.satuan || []).forEach(function(s) { 
                var w = (appData.waktu || []).find(function(x) { return x['ID'] === s['Jenis Waktu']; }); 
                var wStr = w ? ' [' + w['Nama Layanan'] + ']' : ''; 
                optionsHtmlProd += '<option value="' + s['ID'] + '">' + s['Nama Layanan'] + wStr + ' - Rp ' + Number(s['Harga/Pcs']).toLocaleString('id-ID') + '/Pcs</option>'; 
            });
            if(tsInstances['select-layanan-produksi']) { 
                tsInstances['select-layanan-produksi'].destroy(); 
            }
            selectProduksi.innerHTML = optionsHtmlProd;
            tsInstances['select-layanan-produksi'] = new TomSelect(selectProduksi, { 
                create: false, 
                placeholder: "🔍 Cari Layanan...", 
                selectOnTab: true, 
                openOnFocus: false, 
                shouldLoad: function(query) { return query.length > 0; }, 
                onKeyDown: commonOnKeyDown 
            });
        }
        
        var dbWaktuOptions = '<option value="">-- Cari Jenis Waktu --</option>';
        (appData.waktu || []).forEach(function(w) { 
            dbWaktuOptions += '<option value="' + w['ID'] + '">' + w['Nama Layanan'] + ' (' + w['Waktu (Jam)'] + ' Jam)</option>'; 
        });
        
        ['select-LayananKiloan-JenisWaktu', 'select-LayananSatuan-JenisWaktu'].forEach(function(id) { 
            var el = document.getElementById(id); 
            if(!el) return; 
            if(tsInstances[id]) { tsInstances[id].destroy(); } 
            el.innerHTML = dbWaktuOptions; 
            tsInstances[id] = new TomSelect(el, { 
                create: false, 
                placeholder: "🔍 Cari Waktu Layanan...", 
                selectOnTab: true, 
                openOnFocus: false, 
                shouldLoad: function(query) { return query.length > 0; }, 
                onKeyDown: commonOnKeyDown 
            }); 
        });
        
        var elRole = document.getElementById('select-Users-Role'); 
        if(elRole) { 
            if(tsInstances['select-Users-Role']) { 
                tsInstances['select-Users-Role'].destroy(); 
            } 
            tsInstances['select-Users-Role'] = new TomSelect(elRole, { 
                create: false, 
                selectOnTab: true, 
                openOnFocus: false, 
                shouldLoad: function(query) { return query.length > 0; }, 
                onKeyDown: commonOnKeyDown 
            }); 
        }
    } catch(e) {}
}

var currentHistoryCustId = null;

function openHistoryPelanggan(id) {
    currentHistoryCustId = id;
    
    var custName = 'Unknown';
    var cust = (appData.pelanggan || []).find(function(c) { return String(c['ID']) === String(id); });
    if (cust) {
        custName = cust['Nama Pelanggan'];
    } else {
        var prodFallback = (appData.produksi || []).find(function(tx) { return String(tx['ID Pelanggan']) === String(id); });
        if (prodFallback) custName = prodFallback['Nama Pelanggan'];
    }
    
    document.getElementById('history-cust-name').innerText = custName;
    
    document.getElementById('filter-history-type').value = 'all';
    document.getElementById('filter-history-month').value = '';
    document.getElementById('filter-history-date').value = '';
    document.getElementById('filter-history-month').classList.add('hidden');
    document.getElementById('filter-history-date').classList.add('hidden');
    
    renderHistoryPelanggan();
    
    var modal = document.getElementById('modal-history-pelanggan');
    if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
}

function renderHistoryPelanggan() {
    if (!currentHistoryCustId) return;
    
    var filterType = document.getElementById('filter-history-type').value;
    var filterMonth = document.getElementById('filter-history-month').value; 
    var filterDate = document.getElementById('filter-history-date').value; 
    
    if (filterType === 'month') {
        document.getElementById('filter-history-month').classList.remove('hidden');
        document.getElementById('filter-history-date').classList.add('hidden');
        if(!filterMonth) {
            var d = new Date(); var m = '' + (d.getMonth() + 1); var y = d.getFullYear();
            if(m.length<2) m='0'+m;
            document.getElementById('filter-history-month').value = y+'-'+m;
            filterMonth = y+'-'+m;
        }
    } else if (filterType === 'date') {
        document.getElementById('filter-history-month').classList.add('hidden');
        document.getElementById('filter-history-date').classList.remove('hidden');
        if(!filterDate) {
            var d = new Date(); var m = '' + (d.getMonth() + 1); var dy = '' + d.getDate(); var y = d.getFullYear();
            if(m.length<2) m='0'+m; if(dy.length<2) dy='0'+dy;
            document.getElementById('filter-history-date').value = y+'-'+m+'-'+dy;
            filterDate = y+'-'+m+'-'+dy;
        }
    } else {
        document.getElementById('filter-history-month').classList.add('hidden');
        document.getElementById('filter-history-date').classList.add('hidden');
    }

    var txData = (appData.produksi || []).filter(function(tx) { return String(tx['ID Pelanggan']) === String(currentHistoryCustId); });
    
    var filteredTx = txData.filter(function(tx) {
        if (filterType === 'all') return true;
        
        var wktMasuk = tx['Waktu Masuk'] ? String(tx['Waktu Masuk']) : ''; 
        
        if (filterType === 'month' && filterMonth) {
            var fParts = filterMonth.split('-');
            if (fParts.length === 2) {
                var formatSlash = '/' + fParts[1] + '/' + fParts[0];
                var formatDash = '-' + fParts[1] + '-' + fParts[0];
                return wktMasuk.includes(formatSlash) || wktMasuk.includes(formatDash) || wktMasuk.includes(filterMonth);
            }
        } else if (filterType === 'date' && filterDate) {
            var fParts = filterDate.split('-');
            if (fParts.length === 3) {
                var formatSlash = fParts[2] + '/' + fParts[1] + '/' + fParts[0];
                var formatDash = fParts[2] + '-' + fParts[1] + '-' + fParts[0];
                return wktMasuk.includes(formatSlash) || wktMasuk.includes(formatDash) || wktMasuk.includes(filterDate);
            }
        }
        return true; 
    });
    
    window.currentHistoryFilteredTx = filteredTx;
    
    var totalKg = 0;
    var totalPcs = 0;
    var totalRp = 0;
    
    var html = '';
    
    if (filteredTx.length === 0) {
        html = '<div class="flex flex-col items-center justify-center py-12 opacity-50"><i class="ph-duotone ph-receipt text-6xl mb-3 text-slate-400"></i><p class="text-sm font-bold text-slate-500">Tidak ada transaksi ditemukan.</p></div>';
    } else {
        filteredTx.forEach(function(tx) {
            totalRp += Number(tx['Total Harga']) || 0;
            
            var items = [];
            try { 
                var parsed = JSON.parse(tx['Detail Layanan JSON'] || '{}'); 
                items = Array.isArray(parsed) ? parsed : (parsed.items || []); 
            } catch(e) {}
            
            items.forEach(function(item) {
                if (item.satuan === 'Kg') totalKg += Number(item.qty) || 0;
                else if (item.satuan === 'Pcs') totalPcs += Number(item.qty) || 0;
            });
            
            var sBg = ''; 
            if (tx['Status'] === 'Proses') sBg = 'bg-amber-100 text-amber-700 border border-amber-200'; 
            else if (tx['Status'] === 'Selesai') sBg = 'bg-emerald-100 text-emerald-700 border border-emerald-200'; 
            else sBg = 'bg-blue-100 text-blue-700 border border-blue-200';
            
            var pmbStatusVal = tx['Pembayaran'] || 'Belum Lunas';
            var pBg = ''; 
            if (pmbStatusVal === 'Lunas') pBg = 'bg-emerald-50 text-emerald-600 border border-emerald-200'; 
            else if (pmbStatusVal === 'DP') pBg = 'bg-amber-50 text-amber-600 border border-amber-200'; 
            else if (pmbStatusVal === 'Potong Kuota') pBg = 'bg-indigo-50 text-indigo-600 border border-indigo-200'; 
            else pBg = 'bg-red-50 text-red-500 border border-red-200';
            
            var layananStr = resolveLayananNameForProduksi(tx['Layanan']).replace(/\+/g, ', ');
            var notaStr = tx['No Nota'] || tx['ID'];
            var dateStr = tx['Waktu Masuk'] ? String(tx['Waktu Masuk']).split(' ')[0] : '-';
            
            html += '<div class="bg-white p-3 border border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-100 hover:border-teal-300 transition-all mb-3 shadow-sm active:scale-95 group" onclick="viewProduksiDetail(\'' + tx['ID'] + '\')">';
            html += '<div class="flex justify-between items-center mb-1.5"><span class="text-[10px] font-bold text-slate-500 font-mono tracking-widest">' + notaStr + '</span><span class="text-[10px] font-bold text-slate-400 group-hover:text-teal-600 transition-colors"><i class="ph-bold ph-calendar-blank mr-1"></i>' + dateStr + '</span></div>';
            html += '<div class="flex justify-between items-start mb-2"><p class="text-[12px] font-bold text-slate-700 leading-snug w-2/3 pr-2 truncate">' + layananStr + '</p><p class="text-[13px] font-black text-slate-800 whitespace-nowrap w-1/3 text-right">Rp ' + Number(tx['Total Harga'] || 0).toLocaleString('id-ID') + '</p></div>';
            html += '<div class="flex justify-between items-center"><div class="flex gap-1.5 items-center"><span class="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wide ' + pBg + '">' + pmbStatusVal + '</span><span class="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wide ' + sBg + '">' + tx['Status'] + '</span></div><i class="ph-bold ph-caret-right text-slate-300 group-hover:text-teal-500 transition-colors"></i></div>';
            html += '</div>';
        });
    }
    
    document.getElementById('history-list-container').innerHTML = html;
    
    document.getElementById('history-total-kg').innerText = (Math.round(totalKg * 100) / 100) + ' Kg';
    document.getElementById('history-total-pcs').innerText = totalPcs + ' Pcs';
    document.getElementById('history-total-rp').innerText = 'Rp ' + totalRp.toLocaleString('id-ID');
}

function exportHistory(exportType) {
    var custName = document.getElementById('history-cust-name').innerText;
    var cust = (appData.pelanggan || []).find(function(c) { return String(c['ID']) === String(currentHistoryCustId); });
    var custPhone = cust ? cust['No Telpon'] : '';
    
    var txData = window.currentHistoryFilteredTx || [];
    if (txData.length === 0) return showToast("Tidak ada data transaksi untuk diexport", "error");

    showToast("Memproses laporan...", "success");

    var container = document.getElementById('report-export-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'report-export-container';
        container.style.position = 'absolute';
        container.style.left = '-9999px';
        container.style.top = '-9999px';
        container.style.width = '700px';
        container.style.backgroundColor = '#ffffff';
        container.style.padding = '20px';
        container.style.fontFamily = 'Arial, sans-serif';
        container.style.color = '#000000';
        document.body.appendChild(container);
    }

    var filterType = document.getElementById('filter-history-type').value;
    var periode = "SEMUA WAKTU";
    if (filterType === 'month') {
        var val = document.getElementById('filter-history-month').value;
        if(val) {
            var d = new Date(val + '-01');
            var monthName = d.toLocaleString('id-ID', { month: 'long' });
            periode = (monthName + ' ' + d.getFullYear()).toUpperCase();
        }
    } else if (filterType === 'date') {
        var val = document.getElementById('filter-history-date').value;
        if (val) {
            var d = new Date(val);
            periode = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();
        }
    }

    var html = '<table style="width: 100%; border: none; font-size: 13px; margin-bottom: 12px; font-weight: bold; text-align: left;">';
    html += '<tr><td style="width: 120px; padding: 2px 0;">Nama</td><td>: ' + custName.toUpperCase() + '</td></tr>';
    html += '<tr><td style="padding: 2px 0;">ID Cust</td><td>: ' + (currentHistoryCustId || '-') + '</td></tr>';
    html += '<tr><td style="padding: 2px 0;">Bulan/Periode</td><td>: ' + periode + '</td></tr>';
    html += '</table>';

    html += '<table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: center;">';
    html += '<thead><tr style="background-color: #203864; color: white;">';
    html += '<th style="border: 1px solid #000; padding: 4px 6px;">TANGGAL</th>';
    html += '<th style="border: 1px solid #000; padding: 4px 6px;">LAYANAN</th>';
    html += '<th style="border: 1px solid #000; padding: 4px 6px;">KG/PCS</th>';
    html += '<th style="border: 1px solid #000; padding: 4px 6px;">NOMINAL</th>';
    html += '</tr></thead><tbody>';

    var totalQty = 0;
    var totalRp = 0;

    txData.forEach(function(tx) {
        var items = [];
        try { 
            var parsed = JSON.parse(tx['Detail Layanan JSON'] || '{}'); 
            items = Array.isArray(parsed) ? parsed : (parsed.items || []); 
        } catch(e) {}
        
        var tglRaw = tx['Waktu Masuk'] ? String(tx['Waktu Masuk']).split(' ')[0] : '-';
        var tglStr = tglRaw;
        var tp = tglRaw.split('/');
        if(tp.length === 3) tglStr = tp[0] + '/' + tp[1] + '/' + tp[2];

        if (items.length > 0) {
            items.forEach(function(item, index) {
                var qty = parseFloat(item.qty) || 0;
                var subtotal = parseFloat(item.subtotal) || 0;
                
                totalQty += qty;
                totalRp += subtotal;

                html += '<tr>';
                if (index === 0) {
                    html += '<td style="border: 1px solid #000; padding: 4px 6px;" rowspan="' + items.length + '">' + tglStr + '</td>';
                }
                html += '<td style="border: 1px solid #000; padding: 4px 6px; text-align: left;">' + item.nama.toUpperCase() + '</td>';
                html += '<td style="border: 1px solid #000; padding: 4px 6px;">' + qty + '</td>';
                html += '<td style="border: 1px solid #000; padding: 4px 6px; text-align: right;">' + subtotal.toLocaleString('id-ID').replace(/\./g, ',') + '</td>';
                html += '</tr>';
            });
        } else {
            var subtotal = parseFloat(tx['Total Harga']) || 0;
            totalRp += subtotal;
            html += '<tr>';
            html += '<td style="border: 1px solid #000; padding: 4px 6px;">' + tglStr + '</td>';
            html += '<td style="border: 1px solid #000; padding: 4px 6px; text-align: left;">' + (tx['Layanan'] || '-').toUpperCase() + '</td>';
            html += '<td style="border: 1px solid #000; padding: 4px 6px;">-</td>';
            html += '<td style="border: 1px solid #000; padding: 4px 6px; text-align: right;">' + subtotal.toLocaleString('id-ID').replace(/\./g, ',') + '</td>';
            html += '</tr>';
        }
    });

    html += '</tbody><tfoot><tr>';
    html += '<td colspan="2" style="border: 1px solid #000; padding: 4px 6px; border-right: none;"></td>';
    html += '<td style="border: 1px solid #000; padding: 4px 6px; font-weight: bold;">' + (Math.round(totalQty*100)/100) + '</td>';
    html += '<td style="border: 1px solid #000; padding: 4px 6px; font-weight: bold; text-align: right;">' + totalRp.toLocaleString('id-ID').replace(/\./g, ',') + '</td>';
    html += '</tr></tfoot></table>';

    container.innerHTML = html;

    function loadScript(src, checkVar, callback) {
        if (window[checkVar]) { callback(); return; }
        var s = document.createElement('script');
        s.src = src;
        s.onload = callback;
        document.head.appendChild(s);
    }

    loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', 'html2canvas', function() {
        html2canvas(container, { scale: 2, useCORS: true, backgroundColor: '#ffffff' }).then(function(canvas) {
            var imgData = canvas.toDataURL('image/jpeg', 0.85);
            
            if (exportType === 'wa') {
                var fileName = 'Laporan_' + custName.replace(/ /g, '_') + '.jpg';
                var phone = custPhone || '';
                phone = phone.replace(/\D/g, ''); 
                if (phone.startsWith('0')) phone = '62' + phone.substring(1);
                
                var waMsg = "Halo Kak *" + custName + "*,\nBerikut adalah lampiran laporan/rekap transaksi Anda. Mohon konfirmasi laporan yang telah kami bagikan ya. Terima kasih! 🙏";
                
                canvas.toBlob(function(blobJpeg) {
                    var file = new File([blobJpeg], fileName, { type: 'image/jpeg' });
                    
                    if (navigator.canShare && navigator.canShare({ files: [file] })) {
                        // NATIVE SHARE API (UNTUK HP)
                        navigator.share({
                            title: 'Laporan Transaksi',
                            text: waMsg,
                            files: [file]
                        }).then(function() {
                            showToast("Laporan berhasil dibagikan!", "success");
                        }).catch(function(err) {
                            console.log('Share canceled/failed:', err);
                        });
                    } else {
                        // FALLBACK AUTO-DOWNLOAD & COPY (UNTUK LAPTOP ATAU BROWSER LAMA)
                        var a = document.createElement('a');
                        a.href = imgData;
                        a.download = fileName;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        
                        var waUrl = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(waMsg);
                        
                        try {
                            canvas.toBlob(function(blobPng) {
                                if (navigator.clipboard && navigator.clipboard.write) {
                                    navigator.clipboard.write([
                                        new ClipboardItem({ 'image/png': blobPng })
                                    ]).then(function() {
                                        showToast("Gambar disalin! Tekan Paste (Ctrl+V) di WhatsApp.", "success");
                                    }).catch(function(e) { console.log(e); });
                                }
                            }, 'image/png');
                        } catch(e) {}
                        
                        setTimeout(function() { window.open(waUrl, '_blank'); }, 800);
                    }
                }, 'image/jpeg', 0.85);

            } else if (exportType === 'pdf') {
                loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', 'jspdf', function() {
                    var jsPDF = window.jspdf.jsPDF;
                    var pdf = new jsPDF('p', 'mm', 'a4');
                    var pdfWidth = pdf.internal.pageSize.getWidth();
                    var pdfHeight = (canvas.height * pdfWidth) / canvas.width;
                    
                    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
                    pdf.save('Laporan_' + custName.replace(/ /g, '_') + '.pdf');
                    showToast("PDF berhasil diunduh!", "success");
                });
            }
        });
    });
}
