<script>
    /**
     * ZETTBOT - SCRIPT ADMIN
     * Berisi Logika Dashboard, Generator View Dinamis, dan Operasi CRUD Master Data
     */

    function generateDynamicViews() {
        var container = document.getElementById('dynamic-view-container'); var modalContainer = document.getElementById('dynamic-modal-container'); if(!container || !modalContainer) return;
        var viewsHtml = ''; var modalsHtml = '';

        for (var sheetName in masterConfig) {
            var config = masterConfig[sheetName]; var formFields = '';
            config.fields.forEach(function(f) {
                var selectId = 'select-' + sheetName + '-' + f.name.replace(/\s+/g, ''); var wrapperId = 'wrapper-' + sheetName + '-' + f.name.replace(/\s+/g, '');
                var hiddenClass = (sheetName === 'Pelanggan' && (f.name === 'Paket Member' || f.name === 'Sisa Kuota (Kg)')) ? 'hidden' : ''; var reqAttr = (sheetName === 'Pelanggan' && (f.name === 'Paket Member' || f.name === 'Sisa Kuota (Kg)')) ? '' : 'required';
                if (f.type === 'select') {
                    var extraAttr = ''; if (sheetName === 'Pelanggan' && f.name === 'Status') { extraAttr = 'onchange="handlePelangganStatusChange(this.value)"'; }
                    var opts = ''; f.options.forEach(function(o) { opts += '<option value="' + o + '">' + o + '</option>'; });
                    formFields += '<div class="' + hiddenClass + ' mb-4" id="' + wrapperId + '"><label class="block text-[11px] font-extrabold text-slate-500 mb-1.5 uppercase">' + f.name + '</label><select name="' + f.name + '" id="' + selectId + '" ' + reqAttr + ' ' + extraAttr + ' class="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 outline-none text-sm font-medium text-slate-700">' + opts + '</select></div>';
                } else if (f.type === 'dynamic-select') { formFields += '<div class="' + hiddenClass + ' mb-4" id="' + wrapperId + '"><label class="block text-[11px] font-extrabold text-slate-500 mb-1.5 uppercase">' + f.name + '</label><select name="' + f.name + '" id="' + selectId + '" ' + reqAttr + ' placeholder="🔍 Cari / Pilih ' + f.name + '..." class="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 outline-none text-sm font-medium text-slate-700"><option value=""></option></select></div>'; } 
                else if (f.type === 'number' && f.name.includes('Harga')) { formFields += '<div class="' + hiddenClass + ' mb-4" id="' + wrapperId + '"><label class="block text-[11px] font-extrabold text-slate-500 mb-1.5 uppercase">' + f.name + '</label><input type="text" name="' + f.name + '" oninput="formatRupiah(this)" ' + reqAttr + ' autocomplete="off" class="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-teal-400 focus:ring-2 focus:ring-teal-50 outline-none transition-all text-sm font-medium text-slate-700"></div>'; } 
                else { formFields += '<div class="' + hiddenClass + ' mb-4" id="' + wrapperId + '"><label class="block text-[11px] font-extrabold text-slate-500 mb-1.5 uppercase">' + f.name + '</label><input type="' + f.type + '" name="' + f.name + '" ' + reqAttr + ' autocomplete="off" class="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-teal-400 focus:ring-2 focus:ring-teal-50 outline-none transition-all text-sm font-medium text-slate-700"></div>'; }
            });

            var tableHeadersArr = ['ID']; config.fields.forEach(function(f) { tableHeadersArr.push(f.name); }); tableHeadersArr.push('Aksi'); var tableHeaders = '';
            tableHeadersArr.forEach(function(h) { if (h === 'Aksi') { tableHeaders += '<th class="text-right w-36">' + h + '</th>'; } else { var iconId = 'icon-sort-' + sheetName + '-' + h.replace(/\s+/g, ''); tableHeaders += '<th onclick="handleSort(\'' + sheetName + '\', \'' + h + '\')" class="cursor-pointer hover:bg-slate-200 transition-colors select-none group"><div class="flex items-center justify-between"><span>' + h + '</span><i class="ph-bold ph-caret-up-down text-slate-300 group-hover:text-slate-500 sort-icon-' + sheetName + '" id="' + iconId + '"></i></div></th>'; } });
            var modalId = 'modal-' + config.id;
            
            // ZETTBOT FIX: Memindahkan wadah Paginasi ke luar area overflow agar tidak tertelan CSS layar
            viewsHtml += '<div id="view-' + config.id + '" class="view-section hidden fade-in p-4 sm:p-6 w-full"><div class="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col flex-1 overflow-hidden min-h-0"><div class="p-4 sm:p-5 border-b border-slate-100 flex justify-between items-center bg-white z-10 shadow-sm shrink-0"><h2 class="text-md font-bold text-slate-800 hidden sm:block">' + config.title + '</h2><div class="flex items-center gap-3 ml-auto w-full sm:w-auto"><div class="relative w-full sm:w-56"><i class="ph-bold ph-magnifying-glass absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"></i><input type="text" id="search-' + sheetName + '" oninput="renderTable(\'' + sheetName + '\', false)" placeholder="Cari data..." class="w-full pl-9 pr-3 py-2 text-sm font-medium border border-slate-200 rounded-xl focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-50 transition-all bg-slate-50"></div><button onclick="openModal(\'' + modalId + '\')" class="bg-gradient-to-r from-teal-400 to-teal-500 hover:from-teal-500 hover:to-teal-600 text-white text-sm font-bold py-2.5 px-4 rounded-xl shadow-md shadow-teal-500/30 transition-all flex items-center whitespace-nowrap active:scale-95"><i class="ph-bold ph-plus mr-2 text-lg"></i> Tambah</button></div></div><div class="overflow-auto flex-1 relative bg-slate-50/50 px-4 pt-0 pb-0 min-h-0"><table class="table-modern min-w-max"><thead class="sticky top-0 z-20 shadow-sm border-b border-slate-200"><tr>' + tableHeaders + '</tr></thead><tbody id="table-' + sheetName + '"></tbody></table></div><div id="pagination-' + sheetName + '" class="w-full shrink-0 border-t border-slate-100 bg-white"></div></div></div>';
            
            modalsHtml += '<div id="' + modalId + '" class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[55] hidden items-center justify-center p-4"><div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden relative modal-enter"><button type="button" onclick="closeModal(\'' + modalId + '\')" class="absolute top-4 right-4 w-8 h-8 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center hover:bg-red-100 hover:text-red-600 transition-colors z-10"><i class="ph-bold ph-x"></i></button><div class="px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0"><h3 class="text-lg font-extrabold text-slate-800">Tambah Data ' + config.title + '</h3></div><div class="p-6"><form onsubmit="handleFormSubmit(event, \'' + sheetName + '\', \'' + modalId + '\')">' + formFields + '<div class="mt-6 flex justify-end"><button type="submit" class="bg-gradient-to-r from-teal-400 to-teal-500 hover:from-teal-500 hover:to-teal-600 text-white font-bold py-2.5 px-6 rounded-xl shadow-lg shadow-teal-500/30 transition-all flex items-center w-full sm:w-auto justify-center"><i class="ph-bold ph-floppy-disk mr-2"></i> Simpan Data</button></div></form></div></div></div>';
        }
        container.innerHTML = viewsHtml; modalContainer.innerHTML = modalsHtml;
    }

    function renderAllTables() { 
        renderTable('Produksi', true); 
        for (var key in masterConfig) { renderTable(key, true); } 
    }

    function renderTable(sheetName, keepPage) {
        if (!keepPage) { pageConfig[sheetName].page = 1; }

        var data = [];
        if (sheetName === 'Produksi') data = appData.produksi; else if (sheetName === 'Users') data = appData.users; else data = appData[sheetName.toLowerCase().replace('layanan', '')];
        if (!data) data = [];
        var tbody = document.getElementById('table-' + sheetName); if(!tbody) return;
        document.querySelectorAll('.sort-icon-' + sheetName).forEach(function(el) { el.className = 'ph-bold ph-caret-up-down text-slate-300 group-hover:text-slate-500 sort-icon-' + sheetName; });
        var sort = sortConfig[sheetName];
        if (sort && sort.key) { var safeKey = sort.key.replace(/\s+/g, ''); var iconEl = document.getElementById('icon-sort-' + sheetName + '-' + safeKey); if (iconEl) { iconEl.className = sort.dir === 'asc' ? 'ph-bold ph-caret-up text-slate-800 sort-icon-' + sheetName : 'ph-bold ph-caret-down text-slate-800 sort-icon-' + sheetName; } }

        var displayData = []; for (var d = 0; d < data.length; d++) { displayData.push(data[d]); }
        var searchInput = document.getElementById('search-' + sheetName); var searchTerm = searchInput ? (searchInput.value || '').toLowerCase() : '';
        if (searchTerm) {
            displayData = displayData.filter(function(row) {
                var text = Object.values(row).map(function(v) { return String(v).toLowerCase(); }).join(' ');
                if(sheetName === 'Produksi') { var c = resolvePelanggan(row['ID Pelanggan']); text += ' ' + c.nama.toLowerCase() + ' ' + c.hp.toLowerCase() + ' ' + resolveLayananNameForProduksi(row['Layanan']).toLowerCase(); }
                return text.includes(searchTerm);
            });
        }

        if (sort && sort.key) {
            displayData.sort(function(a, b) {
                var valA = a[sort.key]; var valB = b[sort.key]; var numA = parseFloat(String(valA).replace(/[^0-9.-]+/g,"")); var numB = parseFloat(String(valB).replace(/[^0-9.-]+/g,""));
                if (!isNaN(numA) && !isNaN(numB) && String(valA).match(/\d/) && String(valB).match(/\d/)) { valA = numA; valB = numB; } 
                else { valA = String(valA).toLowerCase(); valB = String(valB).toLowerCase(); }
                if (valA < valB) return sort.dir === 'asc' ? -1 : 1; if (valA > valB) return sort.dir === 'asc' ? 1 : -1; return 0;
            });
        } else { displayData.reverse(); }

        var totalItems = displayData.length;
        var limit = pageConfig[sheetName].limit;
        var totalPages = Math.ceil(totalItems / limit);
        
        if (pageConfig[sheetName].page > totalPages && totalPages > 0) pageConfig[sheetName].page = 1;
        var startIdx = (pageConfig[sheetName].page - 1) * limit;
        var paginatedData = displayData.slice(startIdx, startIdx + limit);

        tbody.innerHTML = '';
        var paginationWrapperId = 'pagination-' + sheetName;
        var paginationEl = document.getElementById(paginationWrapperId);

        // Fallback untuk berjaga-jaga jika DOM gagal dirender oleh fungsi di atas
        if (!paginationEl) {
            var tableWrapper = tbody.closest('.overflow-auto');
            if (tableWrapper) {
                paginationEl = document.createElement('div');
                paginationEl.id = paginationWrapperId;
                // ZETTBOT FIX: Tambahkan z-index dan posisi relative agar tidak tersembunyi di bawah container
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
                var cust = resolvePelanggan(row['ID Pelanggan']);
                var statusBadge = '';
                if(row['Status'] === 'Proses') { statusBadge = '<span class="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-200 shadow-sm"><i class="ph-bold ph-spinner-gap animate-spin inline-block mr-1"></i>Proses</span>'; } 
                else if(row['Status'] === 'Selesai') { statusBadge = '<span class="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 border border-emerald-200 shadow-sm"><i class="ph-bold ph-check-circle inline-block mr-1"></i>Selesai</span>'; } 
                else if(row['Status'] === 'Diambil') { statusBadge = '<span class="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-700 border border-blue-200 shadow-sm"><i class="ph-bold ph-hand-pointing inline-block mr-1"></i>Diambil</span>'; } 
                else { statusBadge = '<span class="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200 shadow-sm">' + row['Status'] + '</span>'; }
                
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
                        if (val === 'Member') { val = '<span class="px-2.5 py-1 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg font-black text-[10px] uppercase tracking-wider shadow-sm"><i class="ph-fill ph-diamond"></i> Member</span>'; } 
                        else { val = '<span class="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg font-bold text-[10px] uppercase tracking-wider border border-slate-200">Umum</span>'; }
                    }
                    else if (f.name === 'Paket Member') { var p = (appData.member || []).find(function(x) { return x['ID'] === val; }); val = p ? '<span class="font-bold text-slate-700">' + p['Nama Paket'] + '</span>' : '<span class="text-slate-400">-</span>'; }
                    else if (f.type === 'dynamic-select' && val !== '-') { var w = (appData.waktu || []).find(function(x) { return x['ID'] === val; }); if (w) { val = '<span class="px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-md text-[10px] font-bold whitespace-nowrap tracking-wide"><i class="ph-bold ph-clock mr-1"></i>' + w['Nama Layanan'] + ' (' + w['Waktu (Jam)'] + 'J)</span>'; } else { val = '<span class="text-red-400 text-[12px] italic">Data Terhapus</span>'; } } 
                    else if (f.name.includes('Harga')) { val = '<span class="font-mono text-emerald-600 font-black">Rp ' + Number(val).toLocaleString('id-ID') + '</span>'; }
                    else if (f.name === 'Sisa Kuota (Kg)') { var numVal = parseFloat(val); var finalVal = !isNaN(numVal) ? (Math.round(numVal * 100) / 100) : val; val = '<span class="font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 shadow-sm">' + finalVal + ' Kg</span>'; }
                    else if (f.name === 'Password') { val = '<span class="text-slate-300 font-mono">••••••••</span>'; }
                    htmlTr += '<td>' + val + '</td>';
                });
                htmlTr += '<td class="text-right whitespace-nowrap"><button onclick="viewRecord(\'' + sheetName + '\', \'' + row['ID'] + '\')" class="text-indigo-600 hover:text-white bg-indigo-50 hover:bg-indigo-500 p-2 rounded-xl transition-all mr-1.5 inline-flex items-center justify-center shadow-sm active:scale-95" title="Lihat Detail"><i class="ph-bold ph-eye text-[16px]"></i></button><button onclick="editRecord(\'' + sheetName + '\', \'' + row['ID'] + '\')" class="text-amber-500 hover:text-white bg-amber-50 hover:bg-amber-500 p-2 rounded-xl transition-all mr-1.5 inline-flex items-center justify-center shadow-sm active:scale-95" title="Edit"><i class="ph-bold ph-pencil-simple text-[16px]"></i></button><button onclick="deleteRecord(\'' + sheetName + '\', \'' + row['ID'] + '\')" class="text-red-500 hover:text-white bg-rose-50 hover:bg-rose-500 p-2 rounded-xl transition-all inline-flex items-center justify-center shadow-sm active:scale-95" title="Hapus"><i class="ph-bold ph-trash text-[16px]"></i></button></td>';
            }
            htmlTr += '</tr>'; htmlBatch += htmlTr;
        });
        tbody.innerHTML = htmlBatch;

        if (paginationEl) {
            paginationEl.innerHTML = generatePaginationHTML(sheetName, totalItems);
        }
    }

    function handleSort(sheetName, colName) {
        if (!sortConfig[sheetName]) { sortConfig[sheetName] = { key: null, dir: null }; }
        if (sortConfig[sheetName].key === colName) { sortConfig[sheetName].dir = sortConfig[sheetName].dir === 'asc' ? 'desc' : 'asc'; } 
        else { sortConfig[sheetName].key = colName; sortConfig[sheetName].dir = 'asc'; }
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
                if (pmb === 'Lunas' || pmb === 'Potong Kuota') { pendapatanHariIni += Number(d['Total Harga']) || 0; } 
                else if (pmb === 'DP') { pendapatanHariIni += Number(d['DP']) || 0; } 
            } 
        });

        if (document.getElementById('dash-masuk')) document.getElementById('dash-masuk').innerText = masuk;
        if (document.getElementById('dash-proses')) document.getElementById('dash-proses').innerText = proses;
        if (document.getElementById('dash-selesai')) document.getElementById('dash-selesai').innerText = selesai;
        if (document.getElementById('dash-pendapatan')) document.getElementById('dash-pendapatan').innerText = 'Rp ' + new Intl.NumberFormat('id-ID').format(pendapatanHariIni);

        var tbody = document.getElementById('dash-table-body'); if (!tbody) return; tbody.innerHTML = '';
        var prodCopy = []; for (var m = 0; m < appData.produksi.length; m++) { prodCopy.push(appData.produksi[m]); } 
        var last5 = prodCopy.reverse().slice(0, 5);
        
        if (last5.length === 0) { tbody.innerHTML = '<tr><td colspan="4" class="py-6 px-3 text-center text-slate-400 italic font-normal border-0">Belum ada transaksi terakhir.</td></tr>'; } else {
            last5.forEach(function(row) {
                var cust = resolvePelanggan(row['ID Pelanggan']); var stColor = '';
                if(row['Status'] === 'Proses') { stColor = 'text-amber-700 bg-amber-100 border border-amber-200'; } else if(row['Status'] === 'Selesai') { stColor = 'text-emerald-700 bg-emerald-100 border border-emerald-200'; } else if(row['Status'] === 'Diambil') { stColor = 'text-blue-700 bg-blue-100 border border-blue-200'; } else { stColor = 'text-slate-700 bg-slate-100 border border-slate-200'; }
                var layananStr = resolveLayananNameForProduksi(row['Layanan']);
                var htmlTr = '<tr>'; htmlTr += '<td class="font-mono text-[11px] font-bold text-slate-500">' + row['ID'] + '</td>'; htmlTr += '<td><div class="font-bold text-slate-800 text-[13px]">' + cust.nama + '</div><div class="font-mono text-[10px] text-slate-400">' + (row['No Nota'] || '-') + '</div></td>'; htmlTr += '<td><div class="text-slate-600 font-semibold text-[12px] truncate max-w-[150px]" title="' + layananStr + '">' + layananStr + '</div><div class="text-slate-500 font-black text-[11px]">Rp ' + Number(row['Total Harga'] || 0).toLocaleString('id-ID') + '</div></td>'; htmlTr += '<td class="text-right"><span class="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm ' + stColor + '">' + row['Status'] + '</span></td>'; htmlTr += '</tr>'; tbody.innerHTML += htmlTr;
            });
        }
    }

    // CRUD & FORMS
    function handleFormSubmit(event, sheetName, modalId) {
        event.preventDefault(); var form = event.target; var formData = new FormData(form); var recordObj = {};
        formData.forEach(function(value, key) { var finalVal = value; if (key.includes('Harga')) { finalVal = value.replace(/\./g, ''); } if (key === 'No Telpon' && finalVal !== '') { finalVal = "'" + finalVal.replace(/^'+/, ''); } recordObj[key] = finalVal; });
        var btn = form.querySelector('button[type="submit"]'); var originalText = btn.innerHTML; btn.innerHTML = '<i class="ph-bold ph-spinner animate-spin mr-2"></i> Menyimpan...'; btn.disabled = true;

        var successHandler = function(result) {
            btn.innerHTML = originalText; btn.disabled = false;
            try {
                if (result.success) {
                    form.reset(); closeModal(modalId); showToast(result.message);
                    var newData = result.data;
                    if (sheetName === 'Pelanggan') { newData = newData.map(function(p) { if (p['No Telpon']) { var hpStr = String(p['No Telpon']); if (hpStr.startsWith("'")) { hpStr = hpStr.substring(1); } p['No Telpon'] = hpStr; } return p; }); }
                    var objKey = sheetName.toLowerCase().replace('layanan', ''); appData[objKey] = newData; 
                    if(sheetName === 'Produksi') appData.produksi = newData; if(sheetName === 'Users') appData.users = newData;
                    if(result.pelanggan) { appData.pelanggan = result.pelanggan.map(function(p) { if (p['No Telpon']) { var hpStr = String(p['No Telpon']); if (hpStr.startsWith("'")) { hpStr = hpStr.substring(1); } p['No Telpon'] = hpStr; } return p; }); }
                    updateDashboard(); updateAllDropdowns(); renderTable(sheetName, true); if(sheetName !== 'Produksi') { renderTable('Produksi', true); } renderStaffTable(true); 
                } else { showToast(result.message, "error"); }
            } catch(err) { console.error(err); showToast("Sistem error saat render tabel.", "error"); }
        };
        
        var errorHandler = function(err) { btn.innerHTML = originalText; btn.disabled = false; console.error(err); showToast("Error komunikasi server!", "error"); };

        if (typeof google === 'undefined' || !google.script) { btn.innerHTML = originalText; btn.disabled = false; closeModal(modalId); return; }
        if (isEditMode && currentEditId) { google.script.run.withSuccessHandler(successHandler).withFailureHandler(errorHandler).updateRecord(sheetName, currentEditId, recordObj); } 
        else { google.script.run.withSuccessHandler(successHandler).withFailureHandler(errorHandler).saveRecord(sheetName, recordObj); }
    }

    function viewRecord(sheetName, id) {
        editRecord(sheetName, id);
        setTimeout(function() {
            var modalId = sheetName === 'Produksi' ? 'modal-produksi' : 'modal-' + masterConfig[sheetName].id;
            var modal = document.getElementById(modalId); if (!modal) return;
            var titleEl = modal.querySelector('h3'); if(titleEl) { titleEl.innerText = titleEl.innerText.replace('Edit', 'Detail Lengkap'); }
            var form = modal.querySelector('form');
            if(form) {
                form.querySelectorAll('input, select').forEach(function(el) { el.disabled = true; el.classList.add('bg-slate-100', 'cursor-not-allowed', 'opacity-70'); });
                form.querySelectorAll('select').forEach(function(el) { if(tsInstances[el.id]) { tsInstances[el.id].disable(); } });
                var btnSubmit = form.querySelector('button[type="submit"]'); if(btnSubmit) { btnSubmit.style.display = 'none'; }
            }
        }, 100);
    }

    function editRecord(sheetName, id) {
        isFormPopulating = true; isEditMode = true; currentEditId = id;
        var data = []; if (sheetName === 'Produksi') data = appData.produksi; else if (sheetName === 'Users') data = appData.users; else if (sheetName === 'Pelanggan') data = appData.pelanggan; else data = appData[sheetName.toLowerCase().replace('layanan', '')];
        var record = (data||[]).find(function(r) { return r['ID'] === id; }); if (!record) { showToast("Data gagal dimuat!", "error"); return; }
        var modalId = sheetName === 'Produksi' ? 'modal-produksi' : 'modal-' + masterConfig[sheetName].id; var modal = document.getElementById(modalId); if (!modal) return;
        modal.classList.remove('hidden'); modal.classList.add('flex'); var form = modal.querySelector('form');
        if(form) {
            form.reset();
            form.querySelectorAll('input, select').forEach(function(el) { el.disabled = false; el.classList.remove('bg-slate-100', 'cursor-not-allowed', 'opacity-70'); });
            form.querySelectorAll('select').forEach(function(el) { if(tsInstances[el.id]) { tsInstances[el.id].enable(); } });
            var btnSubmit = form.querySelector('button[type="submit"]'); if(btnSubmit) { btnSubmit.style.display = ''; }
            var titleEl = modal.querySelector('h3'); if(titleEl) { titleEl.innerText = titleEl.innerText.replace('Tambah', 'Edit').replace('Detail Lengkap', 'Edit'); }
            Object.keys(record).forEach(function(key) {
                var input = form.querySelector('[name="' + key + '"]');
                if (input) {
                    var displayVal = record[key]; if (key === 'No Telpon' && String(displayVal).startsWith("'")) { displayVal = String(displayVal).substring(1); }
                    if (key.includes('Harga') && displayVal) { input.value = new Intl.NumberFormat('id-ID').format(displayVal); } else { input.value = displayVal; }
                    if (input.tagName === 'SELECT' && tsInstances[input.id]) { tsInstances[input.id].setValue(displayVal); }
                }
            });
            if (sheetName === 'Pelanggan') { var statusVal = record['Status'] || 'Umum'; var statusEl = document.getElementById('select-Pelanggan-Status'); if(statusEl) { statusEl.value = statusVal; handlePelangganStatusChange(statusVal); } }
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

    function deleteRecord(sheetName, id) {
        zettConfirm("Konfirmasi Hapus", "Yakin ingin menghapus data ini? Tindakan ini akan menghapus data permanen dari database.", "danger", function() {
            showLoading(true);
            if (typeof google === 'undefined' || !google.script) { showToast("Mock delete", "success"); showLoading(false); return; }
            google.script.run.withSuccessHandler(function(res) {
                try {
                    if(res.success) {
                        var newData = res.data;
                        if (sheetName === 'Pelanggan') { newData = newData.map(function(p) { if (p['No Telpon']) { var hpStr = String(p['No Telpon']); if (hpStr.startsWith("'")) { hpStr = hpStr.substring(1); } p['No Telpon'] = hpStr; } return p; }); }
                        
                        // ZETTBOT PRO FIX: Sinkronisasi data pelanggan jika kuota dikembalikan saat hapus produksi
                        if (res.pelanggan) {
                             appData.pelanggan = res.pelanggan.map(function(p) { if (p['No Telpon']) { var hpStr = String(p['No Telpon']); if (hpStr.startsWith("'")) { hpStr = hpStr.substring(1); } p['No Telpon'] = hpStr; } return p; });
                        }
                        
                        var objKey = sheetName.toLowerCase().replace('layanan', ''); appData[objKey] = newData;
                        if(sheetName === 'Produksi') appData.produksi = newData; 
                        if(sheetName === 'Users') appData.users = newData; 
                        if(sheetName === 'Pelanggan') appData.pelanggan = newData;
                        
                        updateDashboard(); updateAllDropdowns(); renderTable(sheetName, true); 
                        if(typeof renderStaffTable === 'function') renderStaffTable(true);
                        showLoading(false); showToast(res.message);
                    } else { showLoading(false); showToast(res.message, "error"); }
                } catch(err) { console.error(err); showLoading(false); showToast("JS Error Update UI", "error"); }
            }).withFailureHandler(function(err) { console.error(err); showLoading(false); showToast("Sistem error saat menghapus data", "error"); }).deleteRecord(sheetName, id);
        });
    }

    function handlePelangganStatusChange(val) {
        var wrapPaket = document.getElementById('wrapper-Pelanggan-PaketMember'); var wrapKuota = document.getElementById('wrapper-Pelanggan-SisaKuota(Kg)'); var elPaket = document.getElementById('select-Pelanggan-PaketMember'); var elKuota = document.querySelector('input[name="Sisa Kuota (Kg)"]');
        if (val === 'Member') {
            if(wrapPaket) wrapPaket.classList.remove('hidden'); if(wrapKuota) wrapKuota.classList.remove('hidden'); if(elPaket) elPaket.setAttribute('required', 'true'); if(elKuota) elKuota.setAttribute('required', 'true');
        } else {
            if(wrapPaket) wrapPaket.classList.add('hidden'); if(wrapKuota) wrapKuota.classList.add('hidden'); if(elPaket) elPaket.removeAttribute('required'); if(elKuota) elKuota.removeAttribute('required');
            if (!isFormPopulating) { if(tsInstances['select-Pelanggan-PaketMember']) tsInstances['select-Pelanggan-PaketMember'].setValue(''); if (elKuota) elKuota.value = 0; }
        }
    }

    function updateAllDropdowns() {
        try { initCustomerAutocomplete(); } catch(e) {}
        try {
            var commonOnKeyDown = function(e) {
                if(e.key === 'Tab' || e.key === 'Enter') {
                    if(this.isOpen) { e.preventDefault(); var targetOpt = this.activeOption; if (!targetOpt) { var opts = this.dropdown_content.querySelectorAll('.option'); if (opts.length > 0) targetOpt = opts[0]; } if (targetOpt) { var val = targetOpt.getAttribute('data-value'); if (val) this.setValue(val); } this.close(); this.blur(); }
                }
            };

            var paketPelangganEl = document.getElementById('select-Pelanggan-PaketMember');
            if (paketPelangganEl) {
                var optionsHtml = '<option value=""></option>';
                (appData.member || []).forEach(function(m) { optionsHtml += '<option value="' + m['ID'] + '">' + m['Nama Paket'] + ' (' + m['Kuota (Kg)'] + ' Kg)</option>'; });
                if(tsInstances['select-Pelanggan-PaketMember']) { tsInstances['select-Pelanggan-PaketMember'].destroy(); }
                paketPelangganEl.innerHTML = optionsHtml;
                tsInstances['select-Pelanggan-PaketMember'] = new TomSelect(paketPelangganEl, { create: false, placeholder: "🔍 Cari / Pilih Paket...", selectOnTab: true, openOnFocus: true, shouldLoad: function(query) { return true; }, onKeyDown: commonOnKeyDown, onChange: function(val) { if (val && !isFormPopulating) { var selectedMember = (appData.member || []).find(function(m) { return m['ID'] === val; }); if(selectedMember) { var sisaEl = document.querySelector('input[name="Sisa Kuota (Kg)"]'); if(sisaEl) { sisaEl.value = selectedMember['Kuota (Kg)']; sisaEl.classList.add('transition-all', 'ring-2', 'ring-indigo-500', 'bg-indigo-50'); setTimeout(function() { sisaEl.classList.remove('ring-2', 'ring-indigo-500', 'bg-indigo-50'); }, 500); } } } } });
            }

            var selectProduksi = document.getElementById('select-layanan-produksi');
            if (selectProduksi) {
                var optionsHtmlProd = '<option value="">-- Cari Layanan --</option>';
                (appData.kiloan || []).forEach(function(k) { var w = (appData.waktu || []).find(function(x) { return x['ID'] === k['Jenis Waktu']; }); var wStr = w ? ' [' + w['Nama Layanan'] + ']' : ''; optionsHtmlProd += '<option value="' + k['ID'] + '">' + k['Nama Layanan'] + wStr + ' - Rp ' + Number(k['Harga/Kg']).toLocaleString('id-ID') + '/Kg</option>'; });
                (appData.satuan || []).forEach(function(s) { var w = (appData.waktu || []).find(function(x) { return x['ID'] === s['Jenis Waktu']; }); var wStr = w ? ' [' + w['Nama Layanan'] + ']' : ''; optionsHtmlProd += '<option value="' + s['ID'] + '">' + s['Nama Layanan'] + wStr + ' - Rp ' + Number(s['Harga/Pcs']).toLocaleString('id-ID') + '/Pcs</option>'; });
                if(tsInstances['select-layanan-produksi']) { tsInstances['select-layanan-produksi'].destroy(); }
                selectProduksi.innerHTML = optionsHtmlProd;
                tsInstances['select-layanan-produksi'] = new TomSelect(selectProduksi, { create: false, placeholder: "🔍 Cari Layanan...", selectOnTab: true, openOnFocus: false, shouldLoad: function(query) { return query.length > 0; }, onKeyDown: commonOnKeyDown });
            }
            
            var dbWaktuOptions = '<option value="">-- Cari Jenis Waktu --</option>';
            (appData.waktu || []).forEach(function(w) { dbWaktuOptions += '<option value="' + w['ID'] + '">' + w['Nama Layanan'] + ' (' + w['Waktu (Jam)'] + ' Jam)</option>'; });
            ['select-LayananKiloan-JenisWaktu', 'select-LayananSatuan-JenisWaktu'].forEach(function(id) { var el = document.getElementById(id); if(!el) return; if(tsInstances[id]) { tsInstances[id].destroy(); } el.innerHTML = dbWaktuOptions; tsInstances[id] = new TomSelect(el, { create: false, placeholder: "🔍 Cari Waktu Layanan...", selectOnTab: true, openOnFocus: false, shouldLoad: function(query) { return query.length > 0; }, onKeyDown: commonOnKeyDown }); });
            var elRole = document.getElementById('select-Users-Role'); if(elRole) { if(tsInstances['select-Users-Role']) { tsInstances['select-Users-Role'].destroy(); } tsInstances['select-Users-Role'] = new TomSelect(elRole, { create: false, selectOnTab: true, openOnFocus: false, shouldLoad: function(query) { return query.length > 0; }, onKeyDown: commonOnKeyDown }); }
        } catch(e) {}
    }
</script>