<script>
/**
 * ZETTBOT - FULL POS SCRIPT (KASIR WAROENK LAUNDRY)
 * Version: 3.5 (Hybrid Engine & TomSelect Fix)
 */

// ==========================================
// 1. INISIALISASI & KONFIGURASI FORM PELANGGAN
// ==========================================
function initCustomerAutocomplete() {
    var elNama = document.getElementById('staff-input-nama');
    var elHp = document.getElementById('staff-input-hp');
    if (!elNama || !elHp) return;

    var pelangganOptions = (appData.pelanggan || []).map(function(p) {
        return { 
            value: p['Nama Pelanggan'], 
            text: p['Nama Pelanggan'], 
            hp: p['No Telpon'], 
            isMember: p['Status'] === 'Member', 
            data: p 
        };
    });

    if (tsInstances['staff-input-nama']) tsInstances['staff-input-nama'].destroy();
    tsInstances['staff-input-nama'] = new TomSelect(elNama, {
        options: pelangganOptions,
        valueField: 'value',
        labelField: 'text',
        searchField: 'text',
        create: true,        // ZETTBOT FIX: Mengizinkan input data pelanggan baru
        createOnBlur: true,  // ZETTBOT FIX: Menyimpan input saat di-tab/enter
        placeholder: 'Ketik Nama Pelanggan...',
        onChange: function(val) {
            var match = pelangganOptions.find(function(p) { return p.value === val; });
            var infoBox = document.getElementById('staff-member-info');
            if (match) {
                if (tsInstances['staff-input-hp'] && match.hp) tsInstances['staff-input-hp'].setValue(match.hp);
                if (match.isMember && infoBox) {
                    infoBox.innerHTML = '<i class="ph-fill ph-diamond"></i> Member (Sisa Kuota: ' + (match.data['Sisa Kuota (Kg)'] || 0) + ' Kg)';
                    infoBox.classList.remove('hidden'); infoBox.classList.add('flex');
                } else if (infoBox) { 
                    infoBox.classList.add('hidden'); infoBox.classList.remove('flex'); 
                }
            } else {
                if (infoBox) { infoBox.classList.add('hidden'); infoBox.classList.remove('flex'); }
            }
        }
    });

    var hpOptions = (appData.pelanggan || []).map(function(p) {
        return { value: p['No Telpon'], text: p['No Telpon'], nama: p['Nama Pelanggan'] };
    });

    if (tsInstances['staff-input-hp']) tsInstances['staff-input-hp'].destroy();
    tsInstances['staff-input-hp'] = new TomSelect(elHp, {
        options: hpOptions,
        valueField: 'value',
        labelField: 'text',
        searchField: 'text',
        create: true,        // ZETTBOT FIX: Mengizinkan input WA baru
        createOnBlur: true,  // ZETTBOT FIX: Menyimpan input saat di-tab/enter
        placeholder: 'Contoh: 08123...',
        onChange: function(val) {
            var match = hpOptions.find(function(p) { return p.value === val; });
            if (match && tsInstances['staff-input-nama']) {
                tsInstances['staff-input-nama'].setValue(match.nama);
            }
        }
    });
}

// ==========================================
// 2. LOGIKA LAYANAN (SERVICES) & KALKULASI
// ==========================================
function openStaffModal() {
    isFormPopulating = true;
    var modal = document.getElementById('modal-staff-tx');
    if (!modal) return;
    
    // Reset Form
    var form = document.getElementById('form-staff-tx');
    if (form) form.reset();
    
    // Reset Dropdowns
    if (tsInstances['staff-input-nama']) tsInstances['staff-input-nama'].clear(true);
    if (tsInstances['staff-input-hp']) tsInstances['staff-input-hp'].clear(true);
    
    document.getElementById('staff-member-info').classList.add('hidden');
    document.getElementById('staff-input-foto').value = '';
    document.getElementById('staff-foto-label').innerHTML = '<i class="ph-bold ph-camera text-3xl"></i>';
    document.getElementById('staff-input-pembayaran').value = 'Belum Lunas';
    handlePembayaranChange();
    
    // Generate No Nota Auto
    var d = new Date();
    var datePrefix = ('0' + d.getDate()).slice(-2) + ('0' + (d.getMonth() + 1)).slice(-2) + String(d.getFullYear()).slice(-2);
    var maxNota = 0;
    (appData.produksi || []).forEach(function(tx) {
        if (tx['No Nota'] && tx['No Nota'].includes('WRL.' + datePrefix)) {
            var num = parseInt(tx['No Nota'].split('.').pop());
            if (!isNaN(num) && num > maxNota) maxNota = num;
        }
    });
    document.getElementById('staff-input-nota').value = 'WRL.' + datePrefix + '.' + String(maxNota + 1).padStart(3, '0');

    // Reset Service Rows
    document.getElementById('staff-services-container').innerHTML = '';
    staffServicesCount = 0;
    staffServicesData = {};
    addStaffServiceRow(false);
    calcStaffTotalAll();

    modal.classList.remove('hidden'); 
    modal.classList.add('flex');
    document.getElementById('staff-footer-action').classList.remove('hidden');
    document.getElementById('staff-footer-action').classList.add('flex');
    setTimeout(function() { isFormPopulating = false; }, 200);
}

function addStaffServiceRow(isClick) {
    staffServicesCount++;
    var rowId = staffServicesCount;
    var container = document.getElementById('staff-services-container');
    
    var div = document.createElement('div');
    div.id = 'staff-srv-row-' + rowId;
    div.className = 'p-4 bg-slate-50 border border-slate-200 rounded-2xl relative group slide-up-fade';
    div.style.animationDelay = '0.05s';
    
    // Tombol Hapus (Jangan tampilkan di baris pertama jika sendirian)
    var btnRemove = (rowId > 1 || isClick) ? 
        `<button type="button" onclick="removeStaffServiceRow(${rowId})" class="absolute -top-2 -right-2 w-7 h-7 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center shadow-sm hover:bg-rose-500 hover:text-white transition-colors"><i class="ph-bold ph-x text-sm"></i></button>` 
        : '';

    div.innerHTML = `
        ${btnRemove}
        <div class="mb-3">
            <label class="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase">Pilih Layanan</label>
            <select id="staff-srv-sel-${rowId}" class="w-full" onchange="handleStaffServiceChange(${rowId})"></select>
        </div>
        <div class="grid grid-cols-2 gap-3">
            <div>
                <label class="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase">Harga</label>
                <input type="text" id="staff-srv-harga-${rowId}" readonly class="w-full px-3 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-sm font-bold text-slate-500 cursor-not-allowed">
            </div>
            <div>
                <label class="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase" id="staff-srv-qty-lbl-${rowId}">Qty</label>
                <input type="number" id="staff-srv-qty-${rowId}" value="1" step="0.1" min="0.1" oninput="calcStaffTotalAll()" class="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-teal-300 transition-all">
            </div>
        </div>
    `;
    container.appendChild(div);

    // Populate TomSelect untuk Layanan
    var selEl = document.getElementById(`staff-srv-sel-${rowId}`);
    var optGroups = `<option value="">-- Cari Layanan --</option>`;
    
    optGroups += `<optgroup label="Layanan Kiloan">`;
    (appData.kiloan || []).forEach(function(k) {
        var w = (appData.waktu || []).find(x => x['ID'] === k['Jenis Waktu']);
        var wStr = w ? ` [${w['Nama Layanan']}]` : '';
        optGroups += `<option value="KIL_${k['ID']}" data-harga="${k['Harga/Kg']}" data-satuan="Kg" data-nama="${k['Nama Layanan']}${wStr}">${k['Nama Layanan']}${wStr} - Rp ${Number(k['Harga/Kg']).toLocaleString('id-ID')}/Kg</option>`;
    });
    optGroups += `</optgroup><optgroup label="Layanan Satuan">`;
    (appData.satuan || []).forEach(function(s) {
        var w = (appData.waktu || []).find(x => x['ID'] === s['Jenis Waktu']);
        var wStr = w ? ` [${w['Nama Layanan']}]` : '';
        optGroups += `<option value="SAT_${s['ID']}" data-harga="${s['Harga/Pcs']}" data-satuan="Pcs" data-nama="${s['Nama Layanan']}${wStr}">${s['Nama Layanan']}${wStr} - Rp ${Number(s['Harga/Pcs']).toLocaleString('id-ID')}/Pcs</option>`;
    });
    optGroups += `</optgroup>`;
    
    selEl.innerHTML = optGroups;
    tsInstances[`staff-srv-sel-${rowId}`] = new TomSelect(selEl, {
        create: false,
        placeholder: 'Pilih / Ketik Layanan...',
        onChange: function(val) { handleStaffServiceChange(rowId); }
    });
}

function removeStaffServiceRow(rowId) {
    var row = document.getElementById('staff-srv-row-' + rowId);
    if (row) {
        if(tsInstances[`staff-srv-sel-${rowId}`]) tsInstances[`staff-srv-sel-${rowId}`].destroy();
        row.remove();
        calcStaffTotalAll();
    }
}

function handleStaffServiceChange(rowId) {
    var sel = document.getElementById(`staff-srv-sel-${rowId}`);
    if (!sel || !sel.options[sel.selectedIndex]) return;
    
    var opt = sel.options[sel.selectedIndex];
    var harga = opt.getAttribute('data-harga') || 0;
    var satuan = opt.getAttribute('data-satuan') || 'Qty';
    
    document.getElementById(`staff-srv-harga-${rowId}`).value = 'Rp ' + Number(harga).toLocaleString('id-ID');
    document.getElementById(`staff-srv-qty-lbl-${rowId}`).innerText = 'Qty (' + satuan + ')';
    
    calcStaffTotalAll();
}

function calcStaffTotalAll() {
    var total = 0;
    var container = document.getElementById('staff-services-container');
    var rows = container.querySelectorAll('select[id^="staff-srv-sel-"]');
    
    rows.forEach(function(sel) {
        if(sel.value) {
            var rowId = sel.id.replace('staff-srv-sel-', '');
            var opt = sel.options[sel.selectedIndex];
            var harga = parseFloat(opt.getAttribute('data-harga')) || 0;
            var qty = parseFloat(document.getElementById(`staff-srv-qty-${rowId}`).value) || 0;
            total += (harga * qty);
        }
    });

    var diskonRaw = document.getElementById('staff-input-diskon').value.replace(/[^0-9]/g, '');
    var diskon = parseFloat(diskonRaw) || 0;
    var grandTotal = total - diskon;
    if (grandTotal < 0) grandTotal = 0;

    document.getElementById('staff-total-biaya').innerText = 'Rp ' + grandTotal.toLocaleString('id-ID');
    document.getElementById('staff-total-biaya').setAttribute('data-val', grandTotal);
}

function handlePembayaranChange() {
    var val = document.getElementById('staff-input-pembayaran').value;
    var dpWrap = document.getElementById('staff-dp-container');
    var dpInput = document.getElementById('staff-input-dp');
    if (val === 'DP') {
        dpWrap.classList.remove('hidden');
        dpInput.setAttribute('required', 'true');
    } else {
        dpWrap.classList.add('hidden');
        dpInput.removeAttribute('required');
        dpInput.value = '';
    }
}

function previewFileName(input) {
    var label = document.getElementById('staff-foto-label');
    if (input.files && input.files[0]) {
        label.innerHTML = '<i class="ph-fill ph-check-circle text-emerald-500 text-3xl mb-1"></i><span class="text-[10px] font-bold text-slate-600">Foto Siap</span>';
    } else {
        label.innerHTML = '<i class="ph-bold ph-camera text-3xl"></i>';
    }
}

// ==========================================
// 3. RENDER TABLE POS & FILTERING
// ==========================================
window.toggleDateFilter = function(checked) {
    var wrapper = document.getElementById('staff-filter-date-wrapper');
    var input = document.getElementById('staff-filter-date');
    if(checked) {
        wrapper.classList.remove('opacity-40', 'grayscale', 'pointer-events-none');
        input.disabled = false;
        if(!input.value) {
            var d = new Date(); var m = '' + (d.getMonth() + 1); var dy = '' + d.getDate();
            if(m.length<2) m='0'+m; if(dy.length<2) dy='0'+dy;
            input.value = d.getFullYear() + '-' + m + '-' + dy;
        }
        document.getElementById('staff-filter-date-text').innerText = input.value;
    } else {
        wrapper.classList.add('opacity-40', 'grayscale', 'pointer-events-none');
        input.disabled = true;
        document.getElementById('staff-filter-date-text').innerText = '';
        input.value = '';
    }
    renderStaffTable();
};

function renderStaffTable(forcePageOne) {
    var container = document.getElementById('staff-transaction-list');
    if (!container) return;

    if (forcePageOne) pageConfig['Staff'].page = 1;

    var searchVal = (document.getElementById('staff-search') ? document.getElementById('staff-search').value.toLowerCase() : '');
    var statusVal = (document.getElementById('staff-filter-status') ? document.getElementById('staff-filter-status').value : '');
    var dateVal = (document.getElementById('staff-filter-date') && !document.getElementById('staff-filter-date').disabled) ? document.getElementById('staff-filter-date').value : '';

    var totalHariIni = 0;
    var todayStr = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());

    var filtered = (appData.produksi || []).filter(function(tx) {
        if (!tx) return false;
        
        // Count Hari Ini
        if (String(tx['Waktu Masuk']).includes(todayStr)) totalHariIni++;

        // Status Filter
        if (statusVal && tx['Status'] !== statusVal) return false;
        
        // Date Filter
        if (dateVal) {
            var txDateStr = tx['Waktu Masuk'] ? String(tx['Waktu Masuk']).split(' ')[0] : '';
            var dp = txDateStr.split('/');
            if (dp.length === 3) {
                var dFmt = dp[2] + '-' + dp[1] + '-' + dp[0];
                if (dFmt !== dateVal) return false;
            } else { return false; }
        }

        // Search Filter
        if (searchVal) {
            var cust = resolvePelanggan(tx['ID Pelanggan']);
            var textToSearch = (tx['ID'] + ' ' + (tx['No Nota']||'') + ' ' + cust.nama + ' ' + cust.hp).toLowerCase();
            if (!textToSearch.includes(searchVal)) return false;
        }
        return true;
    });

    if (document.getElementById('staff-total-cucian')) document.getElementById('staff-total-cucian').innerText = totalHariIni;

    var limit = pageConfig['Staff'].limit;
    var page = pageConfig['Staff'].page;
    var totalItems = filtered.length;
    var totalPages = Math.ceil(totalItems / limit);
    if (page > totalPages && totalPages > 0) pageConfig['Staff'].page = 1;
    var start = (pageConfig['Staff'].page - 1) * limit;
    var displayData = filtered.slice(start, start + limit);

    var html = '';
    if (displayData.length === 0) {
        html = '<div class="text-center py-10 opacity-50"><i class="ph-duotone ph-receipt text-6xl text-slate-400 mb-3"></i><p class="text-slate-500 font-bold">Tidak ada transaksi ditemukan.</p></div>';
    } else {
        displayData.forEach(function(tx) {
            var cust = resolvePelanggan(tx['ID Pelanggan']);
            var lStr = resolveLayananNameForProduksi(tx['Layanan']).replace(/\+/g, ', ');
            var sBg = '';
            if (tx['Status'] === 'Proses') sBg = 'bg-amber-100 text-amber-700 border-amber-200';
            else if (tx['Status'] === 'Selesai') sBg = 'bg-emerald-100 text-emerald-700 border-emerald-200';
            else sBg = 'bg-blue-100 text-blue-700 border-blue-200';

            html += `
            <div class="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all relative group mb-3">
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <div class="flex items-center gap-2 mb-1">
                            <span class="text-[10px] font-black font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-500">${tx['No Nota'] || tx['ID']}</span>
                            <span class="text-[10px] font-bold text-slate-400"><i class="ph-bold ph-clock mr-1"></i>${tx['Waktu Masuk'] ? tx['Waktu Masuk'].split(' ')[0] : '-'}</span>
                        </div>
                        <h4 class="font-black text-slate-800 text-[14px] leading-tight">${cust.nama}</h4>
                    </div>
                    <span class="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border shadow-sm ${sBg}">${tx['Status']}</span>
                </div>
                <div class="text-[11px] font-bold text-slate-500 mb-3 truncate max-w-[85%]">${lStr}</div>
                <div class="flex items-center justify-between pt-3 border-t border-slate-100">
                    <div>
                        <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Total Tagihan</p>
                        <p class="text-[14px] font-black text-teal-600 leading-none">Rp ${Number(tx['Total Harga'] || 0).toLocaleString('id-ID')}</p>
                    </div>
                    <div class="flex items-center gap-2">
                        <button onclick="actionPrintReceipt('${tx['ID']}')" class="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200 active:scale-95 transition-all"><i class="ph-bold ph-printer text-lg"></i></button>
                        <button onclick="openTxDetail('${tx['ID']}')" class="px-3 h-8 rounded-xl bg-gradient-to-r from-teal-400 to-teal-500 text-white flex items-center justify-center font-bold text-[11px] shadow-sm shadow-teal-500/30 active:scale-95 transition-all">UPDATE <i class="ph-bold ph-caret-right ml-1"></i></button>
                    </div>
                </div>
            </div>`;
        });
        
        // Add Pagination
        html += generatePaginationHTML('Staff', totalItems);
    }
    container.innerHTML = html;
}

// ==========================================
// 4. SUBMIT TRANSAKSI BARU (STAFF)
// ==========================================
function submitStaffTransaction() {
    var nama = document.getElementById('staff-input-nama').value;
    var hp = document.getElementById('staff-input-hp').value;
    if (!nama || !hp) { showToast("Nama & No WA Wajib Diisi!", "error"); return; }

    var items = [];
    var totalHarga = 0;
    var totalKg = 0;
    
    var selects = document.querySelectorAll('select[id^="staff-srv-sel-"]');
    var isValid = true;
    selects.forEach(function(sel) {
        if (!sel.value) { isValid = false; return; }
        var opt = sel.options[sel.selectedIndex];
        var rowId = sel.id.replace('staff-srv-sel-', '');
        var qty = parseFloat(document.getElementById(`staff-srv-qty-${rowId}`).value) || 0;
        
        items.push({
            id: sel.value,
            nama: opt.getAttribute('data-nama'),
            satuan: opt.getAttribute('data-satuan'),
            harga: parseFloat(opt.getAttribute('data-harga')),
            qty: qty,
            subtotal: parseFloat(opt.getAttribute('data-harga')) * qty
        });
        totalHarga += (parseFloat(opt.getAttribute('data-harga')) * qty);
        if (opt.getAttribute('data-satuan') === 'Kg') totalKg += qty;
    });

    if (!isValid || items.length === 0) { showToast("Pilih minimal 1 Layanan!", "error"); return; }

    var diskonRaw = document.getElementById('staff-input-diskon').value.replace(/[^0-9]/g, '');
    var diskon = parseFloat(diskonRaw) || 0;
    var grandTotal = totalHarga - diskon; if(grandTotal < 0) grandTotal = 0;

    var pembayaran = document.getElementById('staff-input-pembayaran').value;
    var dpRaw = document.getElementById('staff-input-dp').value.replace(/[^0-9]/g, '');
    var dp = parseFloat(dpRaw) || 0;
    var sisaBayar = grandTotal;

    if (pembayaran === 'Lunas') { dp = grandTotal; sisaBayar = 0; }
    else if (pembayaran === 'DP') { sisaBayar = grandTotal - dp; if (sisaBayar < 0) sisaBayar = 0; }

    // Logic Cek Kuota Jika Member
    var matchedCust = (appData.pelanggan || []).find(function(p) { return p['Nama Pelanggan'] === nama; });
    var pmbStatus = pembayaran;
    
    if (matchedCust && matchedCust['Status'] === 'Member') {
        var sisaKuota = parseFloat(matchedCust['Sisa Kuota (Kg)']) || 0;
        if (totalKg > 0 && sisaKuota > 0) {
            pmbStatus = 'Potong Kuota';
            sisaBayar = grandTotal; 
            dp = 0;
        }
    }

    var recordObj = {
        'No Nota': document.getElementById('staff-input-nota').value,
        'Nama Pelanggan': nama,
        'Layanan': JSON.stringify(items),
        'Detail Layanan JSON': JSON.stringify(items),
        'Total Harga': grandTotal,
        'Diskon': diskon,
        'DP': dp,
        'Sisa Bayar': sisaBayar,
        'Pembayaran': pmbStatus,
        'Status': 'Proses',
        'Kg Terpakai': totalKg > 0 ? totalKg : 0
    };

    // Eksekusi Simpan
    var finalizeSave = function() {
        var btn = document.getElementById('btn-submit-staff');
        var originalBtnHtml = btn.innerHTML;
        btn.innerHTML = '<i class="ph-bold ph-spinner animate-spin mr-2"></i> LOADING...';
        btn.disabled = true;

        var fileInput = document.getElementById('staff-input-foto');
        if (fileInput.files && fileInput.files[0]) {
            var reader = new FileReader();
            reader.onload = function(e) {
                var fileData = {
                    filename: fileInput.files[0].name,
                    mimeType: fileInput.files[0].type,
                    base64: e.target.result.split(',')[1]
                };
                google.script.run.withSuccessHandler(onStaffSuccess).withFailureHandler(onStaffError).saveTransaksiStaff(recordObj, fileData);
            };
            reader.readAsDataURL(fileInput.files[0]);
        } else {
            google.script.run.withSuccessHandler(onStaffSuccess).withFailureHandler(onStaffError).saveTransaksiStaff(recordObj);
        }

        function onStaffSuccess(res) {
            btn.innerHTML = originalBtnHtml; btn.disabled = false;
            if (res.success) {
                closeModal('modal-staff-tx');
                currentSavedTx = res.notaInfo || recordObj;
                
                // Audio notif
                var audio = document.getElementById('sound-success');
                if (audio) { audio.currentTime = 0; audio.play().catch(function(){}); }
                
                // Show Print Modal
                var printModal = document.getElementById('modal-success-print');
                if (printModal) {
                    printModal.classList.remove('hidden'); printModal.classList.add('flex');
                    document.getElementById('receipt-preview-content').innerHTML = generateThermalReceiptHTML(currentSavedTx);
                }
            } else { showToast(res.message, "error"); }
        }

        function onStaffError(err) {
            btn.innerHTML = originalBtnHtml; btn.disabled = false;
            showToast("Gagal tersambung ke server", "error");
        }
    };

    // Tampilkan Peringatan jika Member tapi kuota kurang / ada barang satuan
    if (pmbStatus === 'Potong Kuota' && grandTotal > 0) {
        document.getElementById('confirm-quota-amount').innerText = 'Rp ' + grandTotal.toLocaleString('id-ID');
        var qModal = document.getElementById('modal-confirm-quota');
        qModal.classList.remove('hidden'); qModal.classList.add('flex');
        
        var okBtn = document.getElementById('btn-confirm-quota-ok');
        okBtn.onclick = function() {
            closeModal('modal-confirm-quota');
            recordObj['Sisa Bayar'] = 0; // Anggap kasir sudah terima cash tambahannya
            finalizeSave();
        };
    } else {
        finalizeSave();
    }
}

// ==========================================
// 5. UPDATE & VIEW TRANSAKSI KASIR
// ==========================================
function openTxDetail(id) {
    currentDetailId = id;
    var tx = (appData.produksi || []).find(function(x) { return String(x['ID']) === String(id); });
    if (!tx) return;

    var modal = document.getElementById('modal-tx-detail');
    document.getElementById('tx-detail-preview').innerHTML = generateThermalReceiptHTML(tx);
    
    var stEl = document.getElementById('tx-detail-status');
    var pbEl = document.getElementById('tx-detail-pembayaran');
    stEl.value = tx['Status'] || 'Proses';
    pbEl.value = tx['Pembayaran'] || 'Belum Lunas';

    // Lock System ZettBOT (Admin Override allowed)
    var isLocked = (tx['Status'] === 'Diambil' || tx['Pembayaran'] === 'Lunas' || tx['Pembayaran'] === 'Potong Kuota');
    var isAdmin = currentUser && currentUser.Role === 'ADMIN';

    if (isLocked && !isAdmin) {
        stEl.disabled = true; pbEl.disabled = true;
        document.getElementById('tx-lock-msg').classList.remove('hidden');
        document.getElementById('btn-save-tx-detail').classList.add('hidden');
    } else {
        stEl.disabled = false; pbEl.disabled = false;
        document.getElementById('tx-lock-msg').classList.add('hidden');
        document.getElementById('btn-save-tx-detail').classList.remove('hidden');
    }

    modal.classList.remove('hidden'); modal.classList.add('flex');
}

function saveTxDetailStatus() {
    if (!currentDetailId) return;
    var st = document.getElementById('tx-detail-status').value;
    var pb = document.getElementById('tx-detail-pembayaran').value;

    var btn = document.getElementById('btn-save-tx-detail');
    var originHtml = btn.innerHTML;
    btn.innerHTML = '<i class="ph-bold ph-spinner animate-spin"></i>';
    btn.disabled = true;

    google.script.run.withSuccessHandler(function(res) {
        btn.innerHTML = originHtml; btn.disabled = false;
        if(res.success) {
            closeModal('modal-tx-detail');
            showToast("Status berhasil diupdate!");
        } else { showToast(res.message, "error"); }
    }).withFailureHandler(function(err) {
        btn.innerHTML = originHtml; btn.disabled = false;
        showToast("Gagal update status", "error");
    }).updateStatusProduksi(currentDetailId, st, pb);
}

function viewProduksiDetail(id) {
    var tx = (appData.produksi || []).find(function(x) { return String(x['ID']) === String(id); });
    if (!tx) return;
    
    var container = document.getElementById('view-produksi-content');
    container.innerHTML = generateThermalReceiptHTML(tx); // Reuse desain receipt untuk preview cepat
    
    var modal = document.getElementById('modal-view-produksi');
    modal.classList.remove('hidden'); modal.classList.add('flex');
}

// ==========================================
// 6. PRINTER THERMAL & WHATSAPP
// ==========================================
function generateThermalReceiptHTML(txObj) {
    if (!txObj) return '';
    var cust = resolvePelanggan(txObj['ID Pelanggan']);
    
    var items = [];
    try { 
        var parsed = JSON.parse(txObj['Detail Layanan JSON'] || '{}'); 
        items = Array.isArray(parsed) ? parsed : (parsed.items || []); 
    } catch(e) {}

    var h = `<div style="text-align:center; font-weight:bold; margin-bottom:5px; font-size:16px;">${appSettings.nama.toUpperCase()}</div>`;
    h += `<div style="text-align:center; font-size:10px; margin-bottom:10px;">${appSettings.alamat}</div>`;
    h += `<div style="border-top:1px dashed #000; margin:5px 0;"></div>`;
    h += `<div>Nota: ${txObj['No Nota'] || txObj['ID']}</div>`;
    h += `<div>Tgl: ${txObj['Waktu Masuk'] || '-'}</div>`;
    h += `<div>Plg: ${cust.nama}</div>`;
    if(cust.hp && cust.hp !== '-') h += `<div>WA: ${cust.hp}</div>`;
    h += `<div style="border-top:1px dashed #000; margin:5px 0;"></div>`;
    
    items.forEach(function(it) {
        h += `<div style="display:flex; justify-content:space-between;"><span>${it.nama}</span></div>`;
        h += `<div style="display:flex; justify-content:space-between; font-size:11px;"><span>${it.qty} x ${Number(it.harga).toLocaleString('id-ID')}</span><span>${Number(it.subtotal).toLocaleString('id-ID')}</span></div>`;
    });

    h += `<div style="border-top:1px dashed #000; margin:5px 0;"></div>`;
    h += `<div style="display:flex; justify-content:space-between; font-weight:bold;"><span>TOTAL</span><span>Rp ${Number(txObj['Total Harga'] || 0).toLocaleString('id-ID')}</span></div>`;
    
    if (Number(txObj['Diskon']) > 0) {
        h += `<div style="display:flex; justify-content:space-between; font-size:11px;"><span>Diskon</span><span>- Rp ${Number(txObj['Diskon']).toLocaleString('id-ID')}</span></div>`;
    }
    
    h += `<div style="display:flex; justify-content:space-between; font-size:11px;"><span>Status</span><span>${txObj['Pembayaran'] || 'Belum Lunas'}</span></div>`;
    
    if (Number(txObj['Sisa Bayar']) > 0) {
        h += `<div style="display:flex; justify-content:space-between; font-size:11px; font-weight:bold;"><span>SISA TAGIHAN</span><span>Rp ${Number(txObj['Sisa Bayar']).toLocaleString('id-ID')}</span></div>`;
    }

    h += `<div style="border-top:1px dashed #000; margin:5px 0;"></div>`;
    h += `<div style="text-align:center; font-size:10px; margin-top:10px;">Terima Kasih atas Kunjungan Anda</div>`;
    
    return h;
}

function actionPrintReceipt(idOverride) {
    var id = idOverride || currentDetailId || (currentSavedTx ? currentSavedTx['ID'] : null);
    if (!id) return;
    
    var tx = (appData.produksi || []).find(function(x) { return String(x['ID']) === String(id); });
    if (!tx) tx = currentSavedTx;
    if (!tx) { showToast("Data struk tidak ditemukan", "error"); return; }

    var printArea = document.getElementById('print-area');
    printArea.innerHTML = generateThermalReceiptHTML(tx);
    window.print();
}

function actionSendWA(idOverride) {
    var id = idOverride || currentDetailId || (currentSavedTx ? currentSavedTx['ID'] : null);
    if (!id) return;
    
    var tx = (appData.produksi || []).find(function(x) { return String(x['ID']) === String(id); });
    if (!tx) tx = currentSavedTx;
    if (!tx) return;

    var cust = resolvePelanggan(tx['ID Pelanggan']);
    var phone = cust.hp;
    if (!phone || phone === '-') { showToast("No WA pelanggan tidak tersedia", "error"); return; }
    
    // Normalisasi No HP Indonesia (+62)
    if (phone.startsWith('0')) phone = '62' + phone.substring(1);
    
    var txt = `Halo Kak *${cust.nama}*,\n\n`;
    txt += `Terima kasih telah mencuci di *${appSettings.nama}*.\n`;
    txt += `No Nota: *${tx['No Nota'] || tx['ID']}*\n`;
    txt += `Total Tagihan: *Rp ${Number(tx['Total Harga'] || 0).toLocaleString('id-ID')}*\n`;
    txt += `Status Pembayaran: *${tx['Pembayaran']}*\n\n`;
    txt += `Status cucian saat ini: *${tx['Status']}*\n\n`;
    txt += `Terima kasih atas kepercayaannya!`;

    var url = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(txt);
    window.open(url, '_blank');
}

function connectPrinterManually() {
    showToast("Fitur integrasi WebBluetooth Printer API sedang dalam tahap Beta.", "info");
    // Ruang untuk implementasi WebBluetooth navigator.bluetooth.requestDevice()
}
</script>
