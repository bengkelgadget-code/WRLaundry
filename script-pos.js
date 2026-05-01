/**
 * ZETTBOT - SCRIPT POS & TRANSAKSI
 * Berisi Logika Kasir, Form Transaksi Dinamis, Generator Struk Thermal, dan Cetak Bluetooth/WA
 */

window.toggleDateFilter = function(isActive) {
    var wrapper = document.getElementById('staff-filter-date-wrapper');
    var input = document.getElementById('staff-filter-date');
    var btn = document.getElementById('staff-filter-date-btn');
    var text = document.getElementById('staff-filter-date-text');
    
    if (isActive) {
        if (wrapper) wrapper.classList.remove('opacity-40', 'grayscale', 'pointer-events-none');
        if (input) input.disabled = false;
        if (btn) { btn.classList.add('bg-teal-50', 'text-teal-600', 'border-teal-200'); btn.classList.remove('bg-slate-50', 'text-slate-500', 'border-transparent'); }
        if (text) { text.classList.add('text-teal-700'); text.classList.remove('text-slate-600'); }
        
        if (input && !input.value) {
            var d = new Date();
            var month = '' + (d.getMonth() + 1);
            var day = '' + d.getDate();
            var year = d.getFullYear();
            if (month.length < 2) month = '0' + month;
            if (day.length < 2) day = '0' + day;
            input.value = [year, month, day].join('-');
        }
    } else {
        if (wrapper) wrapper.classList.add('opacity-40', 'grayscale', 'pointer-events-none');
        if (input) input.disabled = true;
        if (btn) { btn.classList.remove('bg-teal-50', 'text-teal-600', 'border-teal-200'); btn.classList.add('bg-slate-50', 'text-slate-500', 'border-transparent'); }
        if (text) { text.classList.remove('text-teal-700'); text.classList.add('text-slate-600'); }
    }
    renderStaffTable(false);
};

function renderStaffTable(keepPage) {
    if (!keepPage) { pageConfig['Staff'].page = 1; }

    var listEl = document.getElementById('staff-transaction-list'); var countEl = document.getElementById('staff-total-cucian'); if(!listEl) return;
    var data = appData.produksi || []; var todayStr = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
    if(countEl) { countEl.innerText = data.filter(function(d) { return String(d['Waktu Masuk']).includes(todayStr); }).length; }

    var searchInput = document.getElementById('staff-search'); var searchVal = searchInput ? (searchInput.value || '').toLowerCase() : '';
    var filterInput = document.getElementById('staff-filter-status'); var statusFilter = filterInput ? filterInput.value : '';
    
    var dateToggle = document.getElementById('staff-filter-date-toggle');
    var isDateFilterActive = dateToggle ? dateToggle.checked : false;
    
    var dateFilterInput = document.getElementById('staff-filter-date');
    var dateFilterVal = dateFilterInput ? dateFilterInput.value : '';
    var formattedDateFilter = '';
    var parts = [];
    var dateText = document.getElementById('staff-filter-date-text');
    
    if (dateFilterVal) {
        parts = dateFilterVal.split('-');
        if (parts.length === 3) {
            formattedDateFilter = parts[2] + '/' + parts[1] + '/' + parts[0]; 
            if (dateText) dateText.innerText = parts[2]; 
        }
    } else {
        if (dateText) dateText.innerText = '';
    }

    var prodCopy = []; 
    for (var m = 0; m < data.length; m++) { 
        if (data[m]) prodCopy.push(data[m]); 
    }
    
    // ZETTBOT PRO FIX: Algoritma Sorting Eksplisit (Garansi Transaksi Terbaru Selalu di Atas)
    prodCopy.sort(function(a, b) {
        var idA = parseInt(String(a['ID'] || '').replace(/[^0-9]/g, '')) || 0;
        var idB = parseInt(String(b['ID'] || '').replace(/[^0-9]/g, '')) || 0;
        return idB - idA; // Pengurutan Descending
    });

    var displayData = prodCopy.filter(function(row) {
        var cust = resolvePelanggan(row['ID Pelanggan']); var combined = row['No Nota'] + ' ' + cust.nama + ' ' + cust.hp + ' ' + resolveLayananNameForProduksi(row['Layanan']); combined = combined.toLowerCase();
        
        var matchSearch = !searchVal || combined.includes(searchVal); 
        var matchStatus = !statusFilter || row['Status'] === statusFilter; 
        
        var matchDate = true;
        if (isDateFilterActive && dateFilterVal) {
            var rowDateStr = row['Waktu Masuk'] ? String(row['Waktu Masuk']) : '';
            var dParts = dateFilterVal.split('-');
            if (dParts.length === 3) {
                var formatSlash = dParts[2] + '/' + dParts[1] + '/' + dParts[0];
                var formatDash = dParts[2] + '-' + dParts[1] + '-' + dParts[0];
                matchDate = rowDateStr.includes(formatSlash) || rowDateStr.includes(formatDash) || rowDateStr.includes(dateFilterVal);
            }
        }

        return matchSearch && matchStatus && matchDate;
    });

    var totalItems = displayData.length;
    var limit = pageConfig['Staff'].limit;
    var totalPages = Math.ceil(totalItems / limit);
    
    if (pageConfig['Staff'].page > totalPages && totalPages > 0) pageConfig['Staff'].page = 1;
    var startIdx = (pageConfig['Staff'].page - 1) * limit;
    var paginatedData = displayData.slice(startIdx, startIdx + limit);

    listEl.innerHTML = '';
    var paginationWrapperId = 'pagination-Staff';
    var paginationEl = document.getElementById(paginationWrapperId);

    if(paginatedData.length === 0) { 
        listEl.innerHTML = '<div class="bg-white rounded-3xl p-8 text-center border border-slate-100"><i class="ph-duotone ph-receipt text-5xl text-slate-300 mb-3"></i><p class="text-sm font-bold text-slate-400">Tidak ada transaksi ditemukan.</p></div>'; 
        if (paginationEl) paginationEl.innerHTML = '';
        return; 
    }

    var htmlBatch = '';
    paginatedData.forEach(function(row, index) {
        var cust = resolvePelanggan(row['ID Pelanggan']); var estSelesaiTeks = '+1 Hari'; 
        var subtotalAll = 0; var diskonTx = 0;
        try { 
            var parsed = JSON.parse(row['Detail Layanan JSON'] || '{}'); 
            var items = Array.isArray(parsed) ? parsed : (parsed.items || []); 
            subtotalAll = parsed.subtotal || 0; diskonTx = parsed.diskon || 0;
            if (items.length > 0) { 
                estSelesaiTeks = items[0].estimasiSelesai ? String(items[0].estimasiSelesai).split(' - ')[0].split(' ')[0] : '+1 Hari'; 
                for(var i=1; i<items.length; i++){ 
                    var currEst = items[i].estimasiSelesai ? String(items[i].estimasiSelesai).split(' - ')[0].split(' ')[0] : '+1 Hari';
                    if(currEst !== estSelesaiTeks){ estSelesaiTeks = "Bervariasi"; break; } 
                } 
            } 
        } catch(e) {}

        var sBg = ''; if (row['Status'] === 'Proses') sBg = 'bg-purple-100 text-purple-700'; else if (row['Status'] === 'Selesai') sBg = 'bg-emerald-100 text-emerald-700'; else sBg = 'bg-blue-100 text-blue-700';
        var pmbStatusVal = row['Pembayaran'] || 'Belum Lunas';
        var totalHarga = Number(row['Total Harga'] || 0);
        var kgTerpakai = parseFloat(row['Kg Terpakai']) || 0;

        if (totalHarga === 0 && subtotalAll > 0 && diskonTx === 0) { pmbStatusVal = 'Potong Kuota'; }
        else if (totalHarga === 0 && (pmbStatusVal === 'Potong Kuota' || kgTerpakai > 0)) { pmbStatusVal = 'Potong Kuota'; }

        var pBg = ''; if (pmbStatusVal === 'Lunas') pBg = 'bg-emerald-50 text-emerald-600 border-emerald-200'; else if (pmbStatusVal === 'DP') pBg = 'bg-amber-50 text-amber-600 border-amber-200'; else if (pmbStatusVal === 'Potong Kuota') pBg = 'bg-indigo-50 text-indigo-600 border-indigo-200'; else pBg = 'bg-red-50 text-red-500 border-red-200';

        var delay = Math.min(index * 0.05, 0.5); 
        var htmlRow = '<div class="bg-white px-4 py-3 border border-slate-100 rounded-2xl active:bg-slate-50 transition-colors cursor-pointer relative slide-up-fade shadow-sm" style="animation-delay: ' + delay + 's;" onclick="openTxDetail(\'' + row['ID'] + '\')">';
        htmlRow += '<div class="flex justify-between items-center mb-1"><h3 class="text-[13px] font-black text-slate-800 uppercase tracking-tight truncate">' + cust.nama + '</h3><span class="text-[10px] font-bold text-slate-500 font-mono tracking-widest">' + (row['No Nota'] || row['ID']) + '</span></div>';
        htmlRow += '<div class="flex justify-between items-start mb-1.5"><p class="text-[11px] font-semibold text-slate-500 leading-snug w-2/3 pr-2 truncate">' + resolveLayananNameForProduksi(row['Layanan']).replace(/\+/g, ', ') + '</p><p class="text-[12px] font-black text-slate-700 whitespace-nowrap w-1/3 text-right">Rp ' + Number(row['Total Harga'] || 0).toLocaleString('id-ID') + '</p></div>';
        htmlRow += '<div class="flex justify-between items-center"><p class="text-[10px] font-medium text-slate-400"><i class="ph-fill ph-calendar-check"></i> Est: ' + estSelesaiTeks + '</p><div class="flex gap-1.5 items-center"><span class="px-2 py-0.5 rounded-md border text-[9px] font-bold uppercase ' + pBg + '">' + pmbStatusVal + '</span><span class="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ' + sBg + '">' + row['Status'] + '</span></div></div></div>';
        htmlBatch += htmlRow;
    });
    listEl.innerHTML = htmlBatch;

    if (!paginationEl) {
        paginationEl = document.createElement('div');
        paginationEl.id = paginationWrapperId;
        paginationEl.className = 'w-full pt-4 pb-8 flex justify-center'; 
        listEl.parentNode.insertBefore(paginationEl, listEl.nextSibling);
    }
    if (paginationEl) {
        paginationEl.innerHTML = generatePaginationHTML('Staff', totalItems);
    }
}

function initCustomerAutocomplete() {
    if (typeof TomSelect === 'undefined') return;
    
    var validCustomers = (appData.pelanggan || []).filter(function(p) {
        return p && String(p['Nama Pelanggan'] || '').trim() !== '' && String(p['No Telpon'] || '').trim() !== '';
    });

    var custOptions = validCustomers.map(function(p) { 
        return { 
            id: p['ID'], 
            nama: String(p['Nama Pelanggan'] || '').trim(), 
            hp: String(p['No Telpon'] || '').trim() 
        }; 
    });

    ['staff-input-nama', 'staff-input-hp'].forEach(function(idStr) {
        var el = document.getElementById(idStr);
        if(el) {
            if(tsInstances[idStr]) { tsInstances[idStr].destroy(); }
            var isNama = idStr.includes('nama');
            
            tsInstances[idStr] = new TomSelect(el, {
                valueField: isNama ? 'nama' : 'hp', 
                labelField: isNama ? 'nama' : 'hp', 
                searchField: ['nama', 'hp'], 
                options: JSON.parse(JSON.stringify(custOptions)), 
                maxItems: 1, 
                create: function(input) {
                    var upInput = input.toUpperCase();
                    var newOpt = { id: 'AUTO' };
                    newOpt[isNama ? 'nama' : 'hp'] = upInput;
                    newOpt[!isNama ? 'nama' : 'hp'] = upInput;
                    return newOpt;
                }, 
                createOnBlur: false, 
                persist: false, 
                selectOnTab: true, 
                openOnFocus: true,
                shouldLoad: function(query) { return true; }, 
                placeholder: isNama ? 'Ketik nama pelanggan...' : 'Ketik no HP...',
                
                sortField: [{field: '$score', direction: 'desc'}],
                score: function(search) {
                    return function(item) {
                        var term = search.toLowerCase().trim();
                        if (!term) return 1; 
                        
                        var n = String(item.nama || '').toLowerCase().trim();
                        var h = String(item.hp || '').toLowerCase().trim();
                        
                        if (n.indexOf(term) === -1 && h.indexOf(term) === -1) return 0;
                        if (n === term || h === term) return 100;
                        if (n.startsWith(term) || h.startsWith(term)) return 50;
                        return 10;
                    };
                },

                onBlur: function() {
                    var currentInput = this.control_input.value.trim().toUpperCase();
                    if (currentInput && this.items.length === 0) {
                        var visibleOpts = Array.from(this.dropdown_content.querySelectorAll('.option:not(.create)')).filter(function(el) { return el.style.display !== 'none'; });
                        if (visibleOpts.length > 0) {
                            var val = visibleOpts[0].getAttribute('data-value');
                            if (val) { this.setValue(val); return; }
                        }
                        this.createItem(currentInput);
                    }
                },

                onKeyDown: function(e) {
                    if(e.key === 'Tab' || e.key === 'Enter' || e.keyCode === 13) {
                        e.preventDefault();
                        var currentInput = this.control_input.value.trim().toUpperCase();

                        if(this.isOpen) {
                            var targetOpt = this.activeOption;
                            if (!targetOpt || !targetOpt.classList.contains('active')) { 
                                var visibleOpts = Array.from(this.dropdown_content.querySelectorAll('.option:not(.create)')).filter(function(el) { return el.style.display !== 'none'; });
                                if (visibleOpts.length > 0) { 
                                    targetOpt = visibleOpts[0]; 
                                } else { 
                                    targetOpt = this.dropdown_content.querySelector('.create'); 
                                } 
                            }
                            
                            if (targetOpt) {
                                var val = targetOpt.getAttribute('data-value');
                                if (targetOpt.classList.contains('create')) { 
                                    if(currentInput) { this.createItem(currentInput); } 
                                } else if (val) { 
                                    this.setValue(val); 
                                }
                            }
                        } else if (currentInput && this.items.length === 0) {
                            this.createItem(currentInput);
                        }
                        this.close(); this.blur(); 
                    }
                },
                render: { 
                    option: function(item, escape) { 
                        var isNew = (item.id === undefined || item.id === 'AUTO' || !item.hp || !item.nama);
                        if (isNew) { 
                            var val = escape(isNama ? item.nama : item.hp); 
                            return '<div class="py-2 px-3 border-b border-slate-50 text-sm">Tambah baru: <strong class="text-teal-600">' + val + '</strong></div>'; 
                        } else { 
                            var mainText = escape(isNama ? item.nama : item.hp); 
                            var subText = escape(isNama ? item.hp : item.nama); 
                            var icon = isNama ? 'phone' : 'user';
                            return '<div class="py-2 px-3 border-b border-slate-50 cursor-pointer hover:bg-slate-50"><span class="font-bold block text-slate-800 text-[13px] mb-0.5 pointer-events-none">' + mainText + '</span><span class="text-[11px] font-mono text-slate-500 pointer-events-none"><i class="ph-fill ph-' + icon + ' text-teal-500 mr-1 pointer-events-none"></i> ' + subText + '</span></div>'; 
                        } 
                    },
                    option_create: function(data, escape) { 
                        return '<div class="create py-2 px-3 text-sm border-b border-slate-50">Tambah baru: <strong class="text-teal-600">' + escape(data.input) + '</strong></div>'; 
                    }
                },
                onChange: function(value) {
                    try {
                        validateStaffForm(); 
                        
                        var targetId = isNama ? 'staff-input-hp' : 'staff-input-nama';
                        var companionTs = tsInstances[targetId];

                        if(!value) { 
                            if(companionTs) {
                                companionTs.enable();
                                companionTs.clear(true);
                            }
                            document.getElementById('staff-member-info').classList.add('hidden'); 
                            document.getElementById('staff-member-info').classList.remove('flex'); 
                            togglePotongKuotaOption(false, false);
                            return; 
                        }
                        
                        var match = isNama ? custOptions.find(function(c) { return c.nama === value; }) : custOptions.find(function(c) { return c.hp === value; });
                        
                        if (match) {
                            if (companionTs) { 
                                companionTs.addOption({id: match.id, hp: match.hp, nama: match.nama}); 
                                var valToSet = isNama ? match.hp : match.nama; 
                                companionTs.setValue(valToSet, true); 
                                companionTs.disable();
                            }
                            
                            var realCust = (appData.pelanggan || []).find(function(p) { return p['ID'] === match.id; }); 
                            var infoEl = document.getElementById('staff-member-info'); 
                            var pmbInput = document.getElementById('staff-input-pembayaran');
                            
                            if (realCust && realCust && realCust['Status'] === 'Member') {
                                togglePotongKuotaOption(true, false);
                                
                                var sisaKuota = parseFloat(realCust['Sisa Kuota (Kg)'] || 0); var paketName = '-';
                                if (realCust['Paket Member']) {
                                    var paketObj = (appData.member || []).find(function(m) { return m['ID'] === realCust['Paket Member']; });
                                    if (paketObj) {
                                        paketName = paketObj['Nama Paket']; var pNameStr = paketName.toLowerCase(); var matchedKiloan = null; var maxScore = 0;
                                        (appData.kiloan || []).forEach(function(k) {
                                            var kNameStr = k['Nama Layanan'].toLowerCase(); var score = 0; if (pNameStr.includes(kNameStr)) score += 10;
                                            var kWords = kNameStr.split(/\s+/); kWords.forEach(function(kw) { if (kw.length > 2 && pNameStr.includes(kw)) score += 1; });
                                            if (score > maxScore) { maxScore = score; matchedKiloan = k; }
                                        });
                                        if (matchedKiloan) { var firstRowId = Object.keys(staffServicesData)[0]; if (firstRowId) { var tsSelect = tsInstances['staff-srv-select-' + firstRowId]; if (tsSelect) { var targetVal = 'K-' + matchedKiloan['ID']; tsSelect.setValue(targetVal); handleStaffServiceSelect(firstRowId, targetVal); } } }
                                    }
                                }
                                infoEl.innerHTML = '<i class="ph-fill ph-diamond text-lg"></i> <span>Paket <b>' + paketName + '</b> | Sisa Kuota <b>' + sisaKuota + ' Kg</b></span>'; infoEl.classList.remove('hidden'); infoEl.classList.add('flex');
                                if (pmbInput) { pmbInput.value = 'Potong Kuota'; handlePembayaranChange(); }
                            } else {
                                togglePotongKuotaOption(false, false);
                                infoEl.classList.add('hidden'); infoEl.classList.remove('flex');
                            }
                            calcStaffTotalAll(); 

                            this.close();
                            setTimeout(function() { 
                                if(tsInstances['staff-srv-select-1']) { tsInstances['staff-srv-select-1'].focus(); } 
                            }, 150);

                        } else {
                            if (companionTs) { companionTs.enable(); }
                            document.getElementById('staff-member-info').classList.add('hidden'); 
                            document.getElementById('staff-member-info').classList.remove('flex'); 
                            togglePotongKuotaOption(false, false);
                            
                            this.close();
                            
                            setTimeout(function() { 
                                if (isNama) {
                                    if(companionTs) { companionTs.focus(); } 
                                } else {
                                    if(tsInstances['staff-srv-select-1']) { 
                                        tsInstances['staff-srv-select-1'].focus(); 
                                    } else {
                                        var fbEl = document.getElementById('staff-srv-select-1');
                                        if (fbEl) fbEl.focus();
                                    }
                                }
                            }, 150);
                        }

                    } catch(e) { console.error("Autocomplete Error: ", e); }
                }
            });
        }
    });
}

function attachPaymentScroll(inputId) {
    var el = document.getElementById(inputId);
    if (el && !el.dataset.scrollAttached) {
        el.dataset.scrollAttached = 'true';
        el.addEventListener('focus', function() {
            var scrollArea = document.getElementById('staff-modal-scroll-area');
            var footer = document.getElementById('staff-footer-action');
            if (scrollArea && footer) {
                scrollArea.style.paddingBottom = '75vh'; 
                var executeScroll = function() {
                    footer.scrollIntoView({ behavior: 'smooth', block: 'end' });
                };
                setTimeout(executeScroll, 100); 
                setTimeout(executeScroll, 350);
                setTimeout(executeScroll, 600);
            }
        }, true);

        el.addEventListener('blur', function() {
            setTimeout(function() {
                var act = document.activeElement;
                if (!act || (act.id !== 'staff-input-diskon' && act.id !== 'staff-input-pembayaran' && act.id !== 'staff-input-dp')) {
                    var scrollArea = document.getElementById('staff-modal-scroll-area');
                    if (scrollArea) scrollArea.style.paddingBottom = ''; 
                }
            }, 150);
        }, true);
    }
}

function openStaffModal() {
    var modal = document.getElementById('modal-staff-tx'); if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
    
    var footer = document.getElementById('staff-footer-action');
    var form = document.getElementById('form-staff-tx');
    if (footer && form && footer.parentNode !== form) {
        footer.classList.remove('absolute', 'bottom-0', 'left-0', 'fixed');
        footer.classList.add('relative', 'rounded-2xl', 'mt-4', 'mb-6', 'border', 'border-slate-200', 'bg-white');
        footer.style.boxShadow = '0 -4px 15px rgba(0,0,0,0.03)';
        form.appendChild(footer);
        form.classList.remove('pb-12');
    }

    if(form) {
        var allInputs = form.querySelectorAll('input, select, textarea');
        allInputs.forEach(function(el) {
            try {
                var t = (el.type || '').toLowerCase();
                if (t === 'file') {
                    var clone = el.cloneNode(false);
                    el.parentNode.replaceChild(clone, el);
                    clone.addEventListener('change', function() { previewFileName(clone); });
                } else if (t === 'checkbox' || t === 'radio') {
                    el.checked = false;
                } else if (el.tagName === 'SELECT') {
                    el.selectedIndex = 0;
                } else {
                    el.value = '';
                }
            } catch(e) {}
        });
    }
    document.getElementById('staff-foto-label').innerHTML = '<i class="ph-bold ph-camera text-3xl"></i>'; 
    document.getElementById('staff-total-biaya-label').innerText = 'Total Biaya'; 
    document.getElementById('staff-total-biaya').innerText = 'Rp 0';
    var pmbInput = document.getElementById('staff-input-pembayaran'); if (pmbInput) pmbInput.value = 'Belum Lunas';
    
    togglePotongKuotaOption(false, false);

    var diskonInput = document.getElementById('staff-input-diskon'); if (diskonInput) diskonInput.value = '';
    var dpContainer = document.getElementById('staff-dp-container'); if (dpContainer) dpContainer.classList.add('hidden');
    var memberInfo = document.getElementById('staff-member-info'); if (memberInfo) { memberInfo.classList.add('hidden'); memberInfo.classList.remove('flex'); }
    var maxNum = 0; var d = new Date(); var day = ('0' + d.getDate()).slice(-2); var month = ('0' + (d.getMonth() + 1)).slice(-2); var year = String(d.getFullYear()).slice(-2); var prefix = 'WRL.' + day + month + year + '.';
    (appData.produksi||[]).forEach(function(row) { if(row['No Nota'] && row['No Nota'].startsWith(prefix)) { var parts = row['No Nota'].split('.'); if (parts.length > 2) { var n = parseInt(parts[2]); if(!isNaN(n) && n > maxNum) maxNum = n; } } });
    var notaInput = document.getElementById('staff-input-nota'); if (notaInput) { notaInput.value = prefix + String(maxNum+1).padStart(3,'0'); }
    
    attachPaymentScroll('staff-input-diskon');
    attachPaymentScroll('staff-input-pembayaran');
    attachPaymentScroll('staff-input-dp');

    try { initCustomerAutocomplete(); } catch(e) {}
    document.getElementById('staff-services-container').innerHTML = ''; staffServicesCount = 0; staffServicesData = {};
    addStaffServiceRow(false); validateStaffForm(); setTimeout(function() { if(tsInstances['staff-input-nama']) { tsInstances['staff-input-nama'].focus(); } }, 300);
}

function handlePembayaranChange() {
    var val = document.getElementById('staff-input-pembayaran').value; var dpContainer = document.getElementById('staff-dp-container');
    if(val === 'DP') { dpContainer.classList.remove('hidden'); setTimeout(function() { var dpInput = document.getElementById('staff-input-dp'); if (dpInput) { dpInput.focus(); } }, 150); } else { dpContainer.classList.add('hidden'); var dpInput = document.getElementById('staff-input-dp'); if (dpInput) dpInput.value = ''; }
    calcStaffTotalAll();
}

function togglePotongKuotaOption(isMember, isEditModal) {
    var selectId = isEditModal ? 'tx-detail-pembayaran' : 'staff-input-pembayaran';
    var optId = isEditModal ? 'opt-tx-potong-kuota' : 'opt-potong-kuota';
    
    var selectEl = document.getElementById(selectId);
    if (!selectEl) return;
    
    var existingOption = document.getElementById(optId);
    
    if (isMember) {
        if (!existingOption) {
            var opt = document.createElement('option');
            opt.value = "Potong Kuota";
            opt.id = optId;
            opt.className = "font-bold text-indigo-600";
            opt.innerHTML = "💎 Potong Kuota (Member)";
            selectEl.appendChild(opt);
        }
    } else {
        if (existingOption) {
            if (selectEl.value === 'Potong Kuota') {
                selectEl.value = 'Belum Lunas';
                if (!isEditModal) handlePembayaranChange();
            }
            existingOption.remove();
        }
    }
}

function addStaffServiceRow(autoFocus) {
    if (typeof autoFocus === 'undefined') autoFocus = true;
    staffServicesCount++; var rowId = staffServicesCount; staffServicesData[rowId] = { id: '', type: '', price: 0, qty: 1, subtotal: 0 };
    var container = document.getElementById('staff-services-container'); var rowDiv = document.createElement('div'); rowDiv.className = 'bg-slate-50 p-4 rounded-2xl border border-slate-100 relative slide-up-fade'; rowDiv.id = 'staff-srv-row-' + rowId;
    var delBtn = ''; if (Object.keys(staffServicesData).length > 1) { delBtn = '<button type="button" onclick="removeStaffServiceRow(' + rowId + ')" class="absolute -top-2 -right-2 w-7 h-7 bg-white border border-slate-200 text-red-500 rounded-full flex items-center justify-center shadow-sm hover:bg-red-50"><i class="ph-bold ph-minus"></i></button>'; }
    var htmlRow = delBtn;
    htmlRow += '<div class="mb-3"><select id="staff-srv-select-' + rowId + '" required class="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 outline-none text-sm font-bold"></select></div>';
    
    htmlRow += '<div class="flex gap-3 items-end"><div class="w-1/3"><label class="block text-[10px] font-black text-slate-400 mb-1.5 uppercase" id="staff-srv-qty-lbl-' + rowId + '">Qty</label><input type="number" step="any" min="0.1" id="staff-srv-qty-' + rowId + '" value="1" onfocus="var el=this; setTimeout(function(){ el.select(); try{ el.setSelectionRange(0, 9999); }catch(e){} }, 50);" oninput="calcStaffServiceRow(' + rowId + ')" onkeydown="if(event.key===\'Tab\' || event.key===\'Enter\' || event.keyCode===13){event.preventDefault(); document.getElementById(\'staff-input-diskon\').focus();}" class="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-teal-400 outline-none text-sm font-black text-slate-700 text-center"></div><div class="w-2/3"><label class="block text-[10px] font-black text-slate-400 mb-1.5 uppercase text-right">Subtotal</label><div class="w-full px-3 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-sm font-black text-slate-800 text-right tracking-tight" id="staff-srv-subtotal-' + rowId + '">Rp 0</div></div></div>';
    
    rowDiv.innerHTML = htmlRow; container.appendChild(rowDiv);
    
    var opts = '<option value=""></option>';
    (appData.kiloan || []).forEach(function(k) { opts += '<option value="K-' + k['ID'] + '">' + k['Nama Layanan'] + ' - Rp ' + Number(k['Harga/Kg']).toLocaleString('id-ID') + '</option>'; });
    (appData.satuan || []).forEach(function(s) { opts += '<option value="S-' + s['ID'] + '">' + s['Nama Layanan'] + ' - Rp ' + Number(s['Harga/Pcs']).toLocaleString('id-ID') + '</option>'; });
    
    var selectEl = document.getElementById('staff-srv-select-' + rowId); selectEl.innerHTML = opts;
    if(typeof TomSelect !== 'undefined') {
        tsInstances['staff-srv-select-' + rowId] = new TomSelect(selectEl, {
            create: false, placeholder: "🔍 Cari layanan...", selectOnTab: true, maxItems: 1, openOnFocus: false,
            shouldLoad: function(query) { return query.length > 0; },
            
            onBlur: function() {
                var currentInput = this.control_input.value.trim();
                if (currentInput && this.items.length === 0) {
                    var visibleOpts = Array.from(this.dropdown_content.querySelectorAll('.option')).filter(function(el) { return el.style.display !== 'none'; });
                    if (visibleOpts.length > 0) {
                        var val = visibleOpts[0].getAttribute('data-value');
                        if (val) this.setValue(val);
                    }
                }
            },

            onKeyDown: function(e) {
                if(e.key === 'Tab' || e.key === 'Enter' || e.keyCode === 13) {
                    e.preventDefault();
                    if(this.isOpen) {
                        var targetOpt = this.activeOption;
                        if (!targetOpt || !targetOpt.classList.contains('active')) { 
                            var visibleOpts = Array.from(this.dropdown_content.querySelectorAll('.option')).filter(function(el) { return el.style.display !== 'none'; });
                            if (visibleOpts.length > 0) targetOpt = visibleOpts[0]; 
                        }
                        
                        if (targetOpt) { var val = targetOpt.getAttribute('data-value'); if (val) { this.setValue(val); } }
                    }
                    this.close(); this.blur(); setTimeout(function() { var qtyEl = document.getElementById('staff-srv-qty-' + rowId); if(qtyEl) { qtyEl.focus(); } }, 100);
                }
            },
            
            onChange: function(val) { 
                handleStaffServiceSelect(rowId, val); 
                validateStaffForm(); 
                if(val) { 
                    this.blur(); 
                    setTimeout(function() { 
                        var qtyEl = document.getElementById('staff-srv-qty-' + rowId); 
                        if(qtyEl) { qtyEl.focus(); } 
                    }, 150); 
                } 
            }
        });
    }
    
    if (autoFocus) { 
        setTimeout(function() { 
            if(tsInstances['staff-srv-select-' + rowId]) { 
                var srvRow = document.getElementById('staff-srv-row-' + rowId); 
                if (srvRow) { 
                    srvRow.scrollIntoView({ behavior: 'smooth', block: 'center' }); 
                } 
                tsInstances['staff-srv-select-' + rowId].focus(); 
            } 
        }, 300); 
    }
}

function removeStaffServiceRow(id) { delete staffServicesData[id]; var rowEl = document.getElementById('staff-srv-row-' + id); if (rowEl) rowEl.remove(); calcStaffTotalAll(); validateStaffForm(); }

function handleStaffServiceSelect(rowId, compoundId) {
    var data = staffServicesData[rowId];
    if(!compoundId) { data.price = 0; data.type = ''; calcStaffServiceRow(rowId); return; }
    var isKiloan = compoundId.startsWith('K-'); var realId = compoundId.substring(2); var item;
    if(isKiloan) { item = appData.kiloan.find(function(x) { return x['ID'] === realId; }); if (item) { data.price = parseFloat(item['Harga/Kg']); data.type = 'Kiloan'; document.getElementById('staff-srv-qty-lbl-' + rowId).innerText = 'Bobot (Kg)'; } } 
    else { item = appData.satuan.find(function(x) { return x['ID'] === realId; }); if (item) { data.price = parseFloat(item['Harga/Pcs']); data.type = 'Satuan'; document.getElementById('staff-srv-qty-lbl-' + rowId).innerText = 'Jml (Pcs)'; var qtyEl = document.getElementById('staff-srv-qty-' + rowId); if (qtyEl) { qtyEl.value = Math.ceil(qtyEl.value); qtyEl.step = "1"; } } }
    data.id = realId; calcStaffServiceRow(rowId);
}

function calcStaffServiceRow(rowId) {
    var data = staffServicesData[rowId]; var qtyEl = document.getElementById('staff-srv-qty-' + rowId); var qty = parseFloat(qtyEl.value) || 0;
    if(data.type === 'Satuan') { qty = Math.ceil(qty); qtyEl.value = qty; } 
    data.qty = qty; data.subtotal = data.price * qty; document.getElementById('staff-srv-subtotal-' + rowId).innerText = 'Rp ' + new Intl.NumberFormat('id-ID').format(data.subtotal);
    calcStaffTotalAll();
}

function calcStaffTotalAll() {
    var subtotalAll = 0; Object.values(staffServicesData).forEach(function(d) { subtotalAll += d.subtotal; });
    var pmbEl = document.getElementById('staff-input-pembayaran'); var dpEl = document.getElementById('staff-input-dp'); var pmb = pmbEl ? pmbEl.value : 'Belum Lunas'; 
    var totalPotonganMember = 0; var kgTerpakai = 0; var sisaKuota = 0;
    
    if (pmb === 'Potong Kuota') {
        var namaVal = tsInstances['staff-input-nama'] ? tsInstances['staff-input-nama'].getValue() : null;
        if (namaVal) { var cust = (appData.pelanggan || []).find(function(p) { return p['Nama Pelanggan'] === namaVal; }); sisaKuota = cust ? parseFloat(cust['Sisa Kuota (Kg)'] || 0) : 0; }
        if (sisaKuota > 0) {
            var currentKuota = sisaKuota;
            Object.values(staffServicesData).forEach(function(d) {
                if (d.type === 'Kiloan' && currentKuota > 0) { var kgDipotong = Math.min(d.qty, currentKuota); currentKuota -= kgDipotong; kgTerpakai += kgDipotong; totalPotonganMember += (kgDipotong * d.price); }
            });
        }
    }
    
    var diskonEl = document.getElementById('staff-input-diskon'); var diskonRaw = diskonEl ? diskonEl.value.replace(/[^0-9]/g, '') : '0'; var diskon = diskonRaw ? parseFloat(diskonRaw) : 0;
    var total = subtotalAll - diskon - totalPotonganMember; if (total < 0) total = 0;
    var dpRaw = dpEl ? dpEl.value.replace(/[^0-9]/g, '') : '0'; var dp = dpRaw ? parseFloat(dpRaw) : 0; var sisa = total;
    var textDisplay = 'Rp ' + new Intl.NumberFormat('id-ID').format(total); var labelDisplay = 'TOTAL BIAYA';
    
    if (pmb === 'DP') { sisa = total - dp; textDisplay = 'Rp ' + new Intl.NumberFormat('id-ID').format(sisa); labelDisplay = 'SISA BAYAR'; } 
    else if (pmb === 'Lunas' || pmb === 'Potong Kuota') { sisa = (pmb === 'Potong Kuota' && total > 0) ? total : 0; }
    
    var totalBiayaEl = document.getElementById('staff-total-biaya');
    if (totalBiayaEl) {
        if (pmb === 'Potong Kuota' && totalPotonganMember > 0) { totalBiayaEl.innerHTML = '<span class="text-[12px] text-indigo-400 line-through mr-1.5 font-bold tracking-normal">Rp ' + new Intl.NumberFormat('id-ID').format(subtotalAll - diskon) + '</span><br>' + textDisplay; } else { totalBiayaEl.innerText = textDisplay; }
    }
    var totalBiayaLblEl = document.getElementById('staff-total-biaya-label'); if (totalBiayaLblEl) { totalBiayaLblEl.innerText = labelDisplay; }
    validateStaffForm(); 
    return { total: total, subtotalAll: subtotalAll, diskon: diskon, pmb: pmb, dp: dp, sisa: sisa, kgTerpakai: kgTerpakai, potonganMember: totalPotonganMember };
}

function previewFileName(input) {
    if(input.files && input.files[0]) {
        var reader = new FileReader();
        reader.onload = function(e) { var labelEl = document.getElementById('staff-foto-label'); if (labelEl) { labelEl.innerHTML = '<img src="' + e.target.result + '" class="absolute inset-0 w-full h-full object-cover z-0"><div class="absolute inset-0 bg-slate-900/30 flex items-center justify-center z-0"><i class="ph-fill ph-check-circle text-white drop-shadow-md text-4xl shadow-slate-900"></i></div>'; } };
        reader.readAsDataURL(input.files[0]);
    } else { var labelEl = document.getElementById('staff-foto-label'); if (labelEl) { labelEl.innerHTML = '<i class="ph-bold ph-camera text-3xl"></i>'; } }
    validateStaffForm(); setTimeout(function() { var btn = document.getElementById('btn-submit-staff'); var footer = document.getElementById('staff-footer-action'); if (btn && footer && !footer.classList.contains('hidden')) { btn.focus(); } }, 300);
}

function validateStaffForm() {
    var footer = document.getElementById('staff-footer-action');
    var form = document.getElementById('form-staff-tx');
    if(footer) { 
        footer.classList.remove('hidden'); 
        footer.classList.add('flex'); 
        
        if (form && footer.parentNode !== form) {
            footer.classList.remove('absolute', 'bottom-0', 'left-0', 'fixed');
            footer.classList.add('relative', 'rounded-2xl', 'mt-4', 'mb-6', 'border', 'border-slate-200', 'bg-white');
            footer.style.boxShadow = '0 -4px 15px rgba(0,0,0,0.03)';
            form.appendChild(footer);
            form.classList.remove('pb-12'); 
        }
    }
}

function submitStaffTransaction() {
    try {
        var inputNama = tsInstances['staff-input-nama']; var inputHp = tsInstances['staff-input-hp'];
        var nama = inputNama ? String(inputNama.getValue()||'').trim() : ''; var hp = inputHp ? String(inputHp.getValue()||'').trim() : '';
        if(!nama || !hp) { showToast('Nama dan No Telp Wajib diisi!', 'error'); return; }
        var calcRes = calcStaffTotalAll(); var total = calcRes.total;
        if(total <= 0 && calcRes.subtotalAll <= 0) { showToast('Pilih minimal 1 layanan!', 'error'); return; }
        if (calcRes.pmb === 'Potong Kuota' && calcRes.potonganMember <= 0) { showToast('Pelanggan ini tidak memiliki Sisa Kuota Member Kiloan!', 'error'); return; }

        var btn = document.getElementById('btn-submit-staff');
        if (calcRes.pmb === 'Potong Kuota' && calcRes.total > 0 && !window.isQuotaConfirmed) {
            var modalConfirm = document.getElementById('modal-confirm-quota');
            if (modalConfirm) {
                document.getElementById('confirm-quota-amount').innerText = 'Rp ' + new Intl.NumberFormat('id-ID').format(calcRes.total);
                document.getElementById('btn-confirm-quota-ok').onclick = function() { closeModal('modal-confirm-quota'); window.isQuotaConfirmed = true; submitStaffTransaction(); };
                modalConfirm.classList.remove('hidden'); modalConfirm.classList.add('flex');
            }
            return; 
        }
        window.isQuotaConfirmed = false; 

        var detailArr = []; var detailJSON = []; var isValid = true; var waktuMasukDate = new Date();
        Object.values(staffServicesData).forEach(function(d) {
            if(!d.id || d.qty <= 0) isValid = false; var namaLay = ''; var waktuJam = 0; var srcObj = d.type === 'Kiloan' ? appData.kiloan : appData.satuan;
            var obj = srcObj.find(function(x) { return x['ID']===d.id; });
            if (obj) { namaLay = obj['Nama Layanan']; var wObj = appData.waktu.find(function(x) { return x['ID'] === obj['Jenis Waktu']; }); if (wObj) waktuJam = parseInt(wObj['Waktu (Jam)']) || 0; }
            var satuan = d.type === 'Kiloan' ? 'Kg' : 'Pcs'; detailArr.push(namaLay + ' x ' + d.qty + satuan);
            var estSelesaiDate = new Date(waktuMasukDate.getTime() + (waktuJam * 60 * 60 * 1000)); var day = ('0' + estSelesaiDate.getDate()).slice(-2); var month = ('0' + (estSelesaiDate.getMonth() + 1)).slice(-2); var year = estSelesaiDate.getFullYear();
            detailJSON.push({ nama: namaLay, qty: d.qty, satuan: satuan, subtotal: d.subtotal, estimasiSelesai: day + '/' + month + '/' + year });
        });
        
        if(!isValid) { showToast('Pastikan Qty layanan terisi benar!', 'error'); return; }
        var finalHp = hp; if (finalHp.startsWith('0')) finalHp = "'" + finalHp;
        var finalJSON = { items: detailJSON, subtotal: calcRes.subtotalAll, diskon: calcRes.diskon, potonganMember: calcRes.potonganMember, kgTerpakai: calcRes.kgTerpakai };
        
        let maxNum = 0;
        (appData.produksi || []).forEach(r => { 
            let idStr = String(r.ID || ''); 
            if(idStr.startsWith('TX-')) { 
                let num = parseInt(idStr.split('-')[1]); 
                if(!isNaN(num) && num > maxNum) maxNum = num; 
            } 
        });
        let txId = 'TX-' + String(maxNum + 1).padStart(4, '0');

        let maxNota = 0; 
        let dDate = new Date(); 
        let dayStr = ('0' + dDate.getDate()).slice(-2); 
        let monthStr = ('0' + (dDate.getMonth() + 1)).slice(-2); 
        let yearStr = String(dDate.getFullYear()).slice(-2); 
        let notaPrefix = 'WRL.' + dayStr + monthStr + yearStr + '.';
        (appData.produksi||[]).forEach(function(row) { 
            if(row['No Nota'] && String(row['No Nota']).startsWith(notaPrefix)) { 
                let parts = String(row['No Nota']).split('.'); 
                if (parts.length > 2) { 
                    let n = parseInt(parts[2]); 
                    if(!isNaN(n) && n > maxNota) maxNota = n; 
                } 
            } 
        });
        let noNota = notaPrefix + String(maxNota+1).padStart(3,'0');
        let waktuMasuk = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date());

        let idPelanggan = '';
        let cust = (appData.pelanggan || []).find(p => p['Nama Pelanggan'] === nama);
        if (cust) idPelanggan = cust['ID'];
        
        var recordObj = { 
            'ID': txId,
            'Waktu Masuk': waktuMasuk,
            'ID Pelanggan': idPelanggan,
            'Nama Pelanggan': nama, 
            'No Telpon': finalHp, 
            'Layanan': detailArr.join(' + '), 
            'Status': 'Proses',
            'Total Harga': total, 
            'No Nota': noNota,
            'Pembayaran': calcRes.pmb, 
            'DP': calcRes.dp, 
            'Sisa Bayar': calcRes.sisa, 
            'Detail Layanan JSON': JSON.stringify(finalJSON), 
            'Kg Terpakai': calcRes.kgTerpakai 
        };

        if (btn) { btn.innerHTML = '<i class="ph-bold ph-spinner animate-spin mr-2 text-xl"></i> SIMPAN...'; btn.disabled = true; }

        var txPhotoInput = document.getElementById('staff-input-foto');
        if (txPhotoInput && txPhotoInput.files && txPhotoInput.files[0]) {
            var file = txPhotoInput.files[0]; var reader = new FileReader();
            reader.onload = function(e) { 
                try {
                    var img = new Image();
                    img.onload = function() {
                        var canvas = document.createElement('canvas'); var width = img.width; var height = img.height; var maxSize = 800; 
                        if (width > height) { if (width > maxSize) { height = Math.round(height * (maxSize / width)); width = maxSize; } } else { if (height > maxSize) { width = Math.round(width * (maxSize / height)); height = maxSize; } }
                        canvas.width = width; canvas.height = height; var ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height);
                        var compressedBase64 = canvas.toDataURL('image/jpeg', 0.7); var newFilename = file.name.replace(/\.[^/.]+$/, "") + ".jpg"; var pureBase64 = compressedBase64.split(',')[1];
                        execSaveStaff(recordObj, { filename: newFilename, mimeType: 'image/jpeg', base64: pureBase64 }, btn); 
                    };
                    img.onerror = function() { var pureBase64 = e.target.result.split(',')[1]; execSaveStaff(recordObj, { filename: file.name, mimeType: file.type, base64: pureBase64 }, btn); };
                    img.src = e.target.result;
                } catch(err) { var pureBase64 = e.target.result.split(',')[1]; execSaveStaff(recordObj, { filename: file.name, mimeType: file.type, base64: pureBase64 }, btn); }
            };
            reader.readAsDataURL(file);
        } else { execSaveStaff(recordObj, null, btn); }
    } catch (error) { console.error(error); showToast("Error sistem: " + error.message, "error"); var btn = document.getElementById('btn-submit-staff'); if (btn) { btn.innerHTML = '<i class="ph-bold ph-paper-plane-tilt mr-2 text-lg"></i> SIMPAN'; btn.disabled = false; } }
}

function execSaveStaff(recordObj, fileData, btn) {
    if (btn) { btn.innerHTML = '<i class="ph-bold ph-paper-plane-tilt mr-2 text-lg"></i> SIMPAN'; btn.disabled = false; }
    if(String(recordObj['No Telpon']).startsWith("'")) { recordObj['No Telpon'] = recordObj['No Telpon'].substring(1); }
    
    console.log("=== DEBUG execSaveStaff ===");
    console.log("GAS_URL:", typeof GAS_URL !== 'undefined' ? GAS_URL.substring(0, 60) + '...' : 'TIDAK DITEMUKAN');
    console.log("_isZettBridgePolyfill:", window._isZettBridgePolyfill);
    console.log("typeof google:", typeof google);
    console.log("recordObj.ID:", recordObj['ID']);
    console.log("recordObj.Nama:", recordObj['Nama Pelanggan']);
    console.log("fileData:", fileData ? 'ADA (foto)' : 'NULL (tidak ada foto)');

    // 1. ZETTBOT: Pemutusan Total (Decoupling) UI ke Firebase secara Langsung
    var existsIdx = appData.produksi.findIndex(function(tx) { return String(tx['ID']) === String(recordObj['ID']); });
    if (existsIdx >= 0) { appData.produksi[existsIdx] = recordObj; } else { appData.produksi.push(recordObj); }

    // Pemotongan Kuota Optimistic
    if (recordObj['Pembayaran'] === 'Potong Kuota' && recordObj['Kg Terpakai']) {
        var custIdx = appData.pelanggan.findIndex(p => p['Nama Pelanggan'] === recordObj['Nama Pelanggan']);
        if (custIdx >= 0) {
            var sisa = parseFloat(appData.pelanggan[custIdx]['Sisa Kuota (Kg)']) - parseFloat(recordObj['Kg Terpakai']);
            appData.pelanggan[custIdx]['Sisa Kuota (Kg)'] = sisa < 0 ? 0 : Math.round(sisa * 100) / 100;
        }
    }

    // 2. Suntik Firebase! Mulai detik ini, Firebase adalah Penguasa Mutlak Data Layar
    if (typeof database !== 'undefined' && database) {
        database.ref('appData').set(typeof sanitizeFbKeys === 'function' ? sanitizeFbKeys(appData) : appData);
    }

    // Render layar 0-Delay
    if(typeof renderStaffTable === 'function') renderStaffTable(true);
    if(typeof renderTable === 'function') renderTable('Produksi', true);
    if(typeof updateDashboard === 'function') updateDashboard();

    closeModal('modal-staff-tx');
    var soundEl = document.getElementById('sound-success'); if (soundEl) { soundEl.play().catch(function(e){}); }
    currentSavedTx = recordObj;
    document.getElementById('receipt-preview-content').innerHTML = generateReceiptHTML(currentSavedTx);
    showSuccessModal();

    // 3. FIX: Deteksi mode GAS native vs Vercel/ZettBridge
    var isGasNative = (typeof google !== 'undefined' && 
                       google.script && 
                       typeof google.script.run === 'object' &&
                       google.script.run !== null &&
                       typeof google.script.run.withSuccessHandler === 'function' &&
                       !window._isZettBridgePolyfill);

    if (isGasNative) {
        // Mode GAS native murni
        google.script.run
            .withSuccessHandler(function(res) {
                console.log("ZettBOT: Transaksi sukses di-backup (GAS native).");
            })
            .withFailureHandler(function(error) { 
                console.error("ZettBOT: Gagal backup ke Sheets (GAS native):", error); 
            })
            .saveTransaksiStaff(recordObj, fileData);
    } else {
        // Mode Vercel/Eksternal: gunakan fetch POST murni TANPA Headers (Simple Request bypass CORS)
        console.log("ZettBOT: Mengirim ke Sheets via ZettBridge fetch...");
        var payload = (fileData) ? { recordObj: recordObj, fileData: fileData } : { recordObj: recordObj };
        
        fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'saveTransaksiStaff', payload: payload })
        })
        .then(function(res) { 
            console.log("DEBUG fetch response status:", res.status, res.ok);
            return res.json(); 
        })
        .then(function(resData) {
            console.log("DEBUG GAS response:", JSON.stringify(resData).substring(0, 200));
            if (resData && resData.success) {
                console.log("ZettBOT: Transaksi sukses di-backup ke Sheets via fetch.");
                if (resData.data && typeof mergeProduksiData === 'function') appData.produksi = mergeProduksiData(resData.data);
                if (resData.pelanggan && typeof cleanPhoneQuotes === 'function') appData.pelanggan = cleanPhoneQuotes(resData.pelanggan);
                if (typeof database !== 'undefined' && database) database.ref('appData').set(typeof sanitizeFbKeys === 'function' ? sanitizeFbKeys(appData) : appData);
                if (typeof renderStaffTable === 'function') renderStaffTable(true);
                if (typeof renderTable === 'function') renderTable('Produksi', true);
            } else {
                console.error("ZettBOT: GAS response error:", resData);
            }
        })
        .catch(function(e) {
            console.error("ZettBOT: Gagal backup ke Sheets via ZettBridge:", e);
        });
    }
}

function openTxDetail(id) {
    var px = appData.produksi.find(function(x) { return String(x['ID']) === String(id); }); if(!px) { showToast("Data transaksi tidak ditemukan", "error"); return; }
    currentDetailId = id; var cust = resolvePelanggan(px['ID Pelanggan']); currentSavedTx = {...px, 'Nama Pelanggan': cust.nama, 'No Telpon': cust.hp};
    document.getElementById('tx-detail-preview').innerHTML = generateReceiptHTML(currentSavedTx);
    var statusEl = document.getElementById('tx-detail-status'); if (statusEl) statusEl.value = px['Status'] || 'Proses';
    var pmbEl = document.getElementById('tx-detail-pembayaran');
    if (pmbEl) {
        var totalHarga = Number(px['Total Harga'] || 0); 
        var kgTerpakai = parseFloat(px['Kg Terpakai']) || 0;
        var pmbStatus = px['Pembayaran'] || 'Belum Lunas'; 
        var subtotalTx = 0; var diskonTx = 0;
        try { var parsed = JSON.parse(px['Detail Layanan JSON'] || '{}'); subtotalTx = parsed.subtotal || 0; diskonTx = parsed.diskon || 0; } catch(e){}
        if (totalHarga === 0 && subtotalTx > 0 && diskonTx === 0) { pmbStatus = 'Potong Kuota'; px['Pembayaran'] = 'Potong Kuota'; }
        else if (totalHarga === 0 && (pmbStatus === 'Potong Kuota' || kgTerpakai > 0)) { pmbStatus = 'Potong Kuota'; px['Pembayaran'] = 'Potong Kuota'; }
        
        var custDataForEdit = (appData.pelanggan || []).find(function(p) { return p['ID'] === px['ID Pelanggan']; });
        togglePotongKuotaOption(custDataForEdit && custDataForEdit['Status'] === 'Member', true);
        
        pmbEl.value = pmbStatus;
        var pmbContainer = document.getElementById('tx-detail-pembayaran-container');
        
        if (pmbStatus === 'Potong Kuota' && totalHarga === 0) { pmbContainer.classList.add('hidden'); } else { pmbContainer.classList.remove('hidden'); pmbEl.disabled = false; pmbEl.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-slate-200'); }
    }
    var isLocked = false; if (currentUser && currentUser.Role !== 'ADMIN') { if (px['Status'] === 'Diambil' || px['Pembayaran'] === 'Lunas') { isLocked = true; } }
    var lockMsg = document.getElementById('tx-lock-msg'); var editCtrls = document.getElementById('tx-edit-controls');
    if (isLocked) { if(lockMsg) lockMsg.classList.remove('hidden'); if(editCtrls) editCtrls.classList.add('hidden'); } else { if(lockMsg) lockMsg.classList.add('hidden'); if(editCtrls) editCtrls.classList.remove('hidden'); }
    var modal = document.getElementById('modal-tx-detail'); if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
}

function saveTxDetailStatus() {
    if(!currentDetailId) return;
    var newStatus = document.getElementById('tx-detail-status').value; var newPembayaran = document.getElementById('tx-detail-pembayaran').value; var btn = document.getElementById('btn-save-tx-detail'); 
    var origText = ''; if (btn) { origText = btn.innerHTML; btn.innerHTML = '<i class="ph-bold ph-spinner animate-spin mr-2"></i> MENYIMPAN...'; btn.disabled = true; }
    
    var updateMemory = function() {
        currentSavedTx['Status'] = newStatus; currentSavedTx['Pembayaran'] = newPembayaran; if (newPembayaran === 'Lunas') { currentSavedTx['Sisa Bayar'] = 0; }
        var idx = appData.produksi.findIndex(x => String(x.ID) === String(currentDetailId));
        if(idx >= 0) {
            appData.produksi[idx]['Status'] = newStatus;
            appData.produksi[idx]['Pembayaran'] = newPembayaran;
            if (newPembayaran === 'Lunas') appData.produksi[idx]['Sisa Bayar'] = 0;
        }

        // FIREBASE PENGUASA UI
        if (typeof database !== 'undefined' && database) {
            database.ref('appData/produksi').set(typeof sanitizeFbKeys === 'function' ? sanitizeFbKeys(appData.produksi) : appData.produksi);
        }

        if (typeof renderStaffTable === 'function') renderStaffTable(true);
        if (typeof renderTable === 'function') renderTable('Produksi', true);
    };

    if (typeof google === 'undefined' || !google.script) {
         if (btn) { btn.innerHTML = origText; btn.disabled = false; }
         updateMemory();
         closeModal('modal-tx-detail'); document.getElementById('receipt-preview-content').innerHTML = generateReceiptHTML(currentSavedTx); showSuccessModal(); return;
    }
    
    // UI Eksekusi Seketika
    updateMemory();
    if (btn) { btn.innerHTML = origText; btn.disabled = false; }
    closeModal('modal-tx-detail'); 
    document.getElementById('receipt-preview-content').innerHTML = generateReceiptHTML(currentSavedTx); 
    showSuccessModal();

    // Fire and Forget Backup
    google.script.run
        .withSuccessHandler(function(res) {
            console.log("ZettBOT: Update status sukses di-backup ke Sheets.");
        })
        .withFailureHandler(function(error) { 
            console.error("ZettBOT: Gagal backup update status ke Sheets, namun data aman di Firebase."); 
        })
        .updateStatusProduksi(currentDetailId, newStatus, newPembayaran);
}

function viewProduksiDetail(id) {
    var px = appData.produksi.find(function(x) { return String(x['ID']) === String(id); }); if(!px) { showToast("Data tidak ditemukan", "error"); return; }
    var cust = resolvePelanggan(px['ID Pelanggan']); var layananHTML = ''; 
    var subtotalTx = Number(px['Total Harga'] || 0); var diskonTx = 0; var potonganMemberTx = 0; var kgTerpakaiTx = parseFloat(px['Kg Terpakai']) || 0;
    var items = [];
    if (px['Detail Layanan JSON']) { try { var parsed = JSON.parse(px['Detail Layanan JSON']); if(!Array.isArray(parsed)) { items = parsed.items || []; diskonTx = parsed.diskon || 0; potonganMemberTx = parsed.potonganMember || 0; subtotalTx = parsed.subtotal || subtotalTx; } else { items = parsed; } } catch(e) {} }
    var totalHarga = Number(px['Total Harga'] || 0); var pmbStatusVal = px['Pembayaran'] || 'Belum Lunas';
    if (totalHarga === 0 && subtotalTx > 0 && diskonTx === 0) { pmbStatusVal = 'Potong Kuota'; }
    var isPureMember = (totalHarga === 0 && pmbStatusVal === 'Potong Kuota');
    if (pmbStatusVal === 'Potong Kuota' && kgTerpakaiTx === 0) { items.forEach(function(i) { if(i.satuan === 'Kg') kgTerpakaiTx += i.qty; }); }
    var custDataForView = appData.pelanggan.find(function(p) { return p['ID'] === px['ID Pelanggan'] || p['Nama Pelanggan'] === px['Nama Pelanggan']; });
    var currentSisaKuotaView = custDataForView ? (parseFloat(custDataForView['Sisa Kuota (Kg)']) || 0) : 0;
    currentSisaKuotaView = Math.round(currentSisaKuotaView * 100) / 100;
    var trackingSisaKuota = currentSisaKuotaView + kgTerpakaiTx; var remainingKg = kgTerpakaiTx;

    if(items.length > 0) {
        items.forEach(function(item) { 
            var isCoveredByQuota = false; var kgDeducted = 0;
            if (pmbStatusVal === 'Potong Kuota' && item.satuan === 'Kg' && remainingKg > 0) { isCoveredByQuota = true; kgDeducted = Math.min(item.qty, remainingKg); remainingKg -= kgDeducted; }
            if (isCoveredByQuota) {
                layananHTML += '<div class="flex justify-between items-center py-2 border-b border-slate-100 last:border-0"><div><p class="text-sm font-bold text-slate-700">' + item.nama + '</p><p class="text-[11px] font-bold text-slate-400 mt-0.5">' + (Math.round(trackingSisaKuota*100)/100) + ' Kg - ' + item.qty + ' Kg = ' + (Math.round((trackingSisaKuota - item.qty)*100)/100) + ' Kg</p></div><p class="text-sm font-black text-slate-800">-</p></div>';
                trackingSisaKuota -= item.qty;
            } else {
                layananHTML += '<div class="flex justify-between items-center py-2 border-b border-slate-100 last:border-0"><div><p class="text-sm font-bold text-slate-700">' + item.nama + '</p><p class="text-[11px] font-bold text-slate-400 mt-0.5">' + item.qty + ' ' + item.satuan + ' x Rp ' + Number(item.subtotal/item.qty).toLocaleString('id-ID') + '</p></div><p class="text-sm font-black text-slate-800">Rp ' + Number(item.subtotal).toLocaleString('id-ID') + '</p></div>';
            }
        });
    } else { layananHTML = (px['Layanan'] || '').replace(/\+/g, '<br>'); }

    var directImgUrl = px['Foto'] ? getDriveDirectUrl(px['Foto']) : ''; var fallbackUrl = 'https://placehold.co/400x400/f8fafc/94a3b8?text=Gagal+Memuat+Foto';
    var fotoHTML = '';
    if (px['Foto'] && (String(px['Foto']).startsWith('http') || String(px['Foto']).startsWith('data:'))) { 
        fotoHTML += '<a href="' + px['Foto'] + '" target="_blank" class="block w-full rounded-2xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative group"><img src="' + directImgUrl + '" class="w-full h-auto object-cover" alt="Foto Transaksi" onerror="this.onerror=null; this.src=\'' + fallbackUrl + '\';"><div class="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><i class="ph-bold ph-arrows-out text-3xl text-white drop-shadow-md"></i></div></a>'; 
    } 
    else { fotoHTML += '<div class="w-full py-10 bg-slate-100/50 rounded-2xl border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400"><i class="ph-duotone ph-image-broken text-4xl mb-2"></i><span class="text-[10px] font-black uppercase tracking-widest text-slate-400">Tidak Ada Foto</span></div>'; }

    var html = '<div class="grid grid-cols-1 md:grid-cols-2 gap-6"><div class="space-y-4">';
    html += '<div class="bg-white p-5 rounded-3xl shadow-sm border border-slate-100"><h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-100 pb-3 flex items-center"><i class="ph-bold ph-info mr-2"></i> Informasi Umum</h4><div class="grid grid-cols-2 gap-y-4 gap-x-2 text-sm"><div class="text-slate-500 font-medium text-[12px]">ID Transaksi</div><div class="font-bold text-slate-800 text-right">' + px['ID'] + '</div><div class="text-slate-500 font-medium text-[12px]">No Nota</div><div class="font-mono font-bold text-indigo-600 text-right">' + (px['No Nota'] || '-') + '</div><div class="text-slate-500 font-medium text-[12px]">Waktu Masuk</div><div class="font-semibold text-slate-800 text-right text-[12px]">' + (px['Waktu Masuk'] ? String(px['Waktu Masuk']).split(' ')[0] : '-') + '</div><div class="text-slate-500 font-medium text-[12px]">Status</div><div class="text-right"><span class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider ' + (px['Status'] === 'Proses' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700') + '">' + px['Status'] + '</span></div></div></div>';
    html += '<div class="bg-white p-5 rounded-3xl shadow-sm border border-slate-100"><h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-100 pb-3 flex items-center"><i class="ph-bold ph-user mr-2"></i> Pelanggan</h4><div class="flex items-center"><div class="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-xl mr-4 uppercase">' + cust.nama.charAt(0) + '</div><div><p class="font-bold text-slate-800 text-sm mb-0.5">' + cust.nama + '</p><p class="text-xs text-slate-500 font-mono font-semibold">' + cust.hp + '</p></div></div></div>';
    html += '<div class="bg-white p-5 rounded-3xl shadow-sm border border-slate-100"><h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-100 pb-3 flex items-center"><i class="ph-bold ph-wallet mr-2"></i> Pembayaran</h4><div class="grid grid-cols-2 gap-y-4 gap-x-2 text-sm">';
    
    var usedQuota = (pmbStatusVal === 'Potong Kuota' || kgTerpakaiTx > 0);
    if (usedQuota) {
        html += '<div class="text-slate-500 font-medium text-[12px]">Sisa Kuota</div><div class="font-bold text-indigo-600 text-right">' + currentSisaKuotaView + ' Kg</div>';
        html += '<div class="text-slate-500 font-medium text-[12px]">Status Bayar</div><div class="font-bold text-indigo-600 text-right">Potong Kuota</div>';
    }
    if (!isPureMember) {
        if (usedQuota) { html += '<div class="col-span-2 border-b border-dashed border-slate-200 my-1"></div>'; }
        if (diskonTx > 0) { html += '<div class="text-slate-500 font-medium text-[12px]">Diskon</div><div class="font-bold text-emerald-600 text-right">- Rp ' + diskonTx.toLocaleString('id-ID') + '</div>'; }
        html += '<div class="text-slate-500 font-medium text-[12px]">Total Bayar</div><div class="font-black text-slate-800 text-right text-[15px]">Rp ' + totalHarga.toLocaleString('id-ID') + '</div>';
        var statusTagihan = pmbStatusVal; if (statusTagihan === 'Potong Kuota' && totalHarga > 0) statusTagihan = 'Belum Lunas';
        html += '<div class="text-slate-500 font-medium text-[12px]">Status Bayar</div><div class="font-bold text-slate-800 text-right">' + statusTagihan + '</div>';
        if (statusTagihan === 'DP') {
            html += '<div class="text-slate-500 font-medium text-[12px]">DP</div><div class="font-semibold text-slate-800 text-right">Rp ' + Number(px['DP']||0).toLocaleString('id-ID') + '</div>';
            var sisaByr = px['Sisa Bayar'] !== undefined ? px['Sisa Bayar'] : totalHarga;
            html += '<div class="text-slate-500 font-medium text-[12px]">Sisa Bayar</div><div class="font-black text-red-500 text-right text-[15px]">Rp ' + Number(sisaByr).toLocaleString('id-ID') + '</div>';
        }
    }
    html += '</div></div></div>';
    html += '<div class="space-y-4"><div class="bg-white p-5 rounded-3xl shadow-sm border border-slate-100"><h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-100 pb-3 flex items-center"><i class="ph-bold ph-t-shirt mr-2"></i> Detail Layanan</h4><div class="mb-2">' + layananHTML + '</div></div><div class="bg-white p-5 rounded-3xl shadow-sm border border-slate-100"><h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-100 pb-3 flex items-center justify-between"><span class="flex items-center"><i class="ph-bold ph-camera mr-2"></i> Lampiran Foto</span>';
    if (px['Foto'] && String(px['Foto']).startsWith('http')) { html += '<a href="' + px['Foto'] + '" target="_blank" class="text-indigo-500 hover:text-indigo-700 transition-colors capitalize font-bold text-[11px]"><i class="ph-bold ph-arrow-square-out"></i> Buka Penuh</a>'; }
    html += '</h4>' + fotoHTML + '</div></div></div>';

    document.getElementById('view-produksi-content').innerHTML = html;
    var modal = document.getElementById('modal-view-produksi'); if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
}

function generateReceiptHTML(px) {
    var layananHTML = ''; var estimasiGlobalHTML = ''; var items = []; var diskonTx = 0; var potonganMemberTx = 0; var subtotalTx = Number(px['Total Harga'] || 0); var kgTerpakaiTx = parseFloat(px['Kg Terpakai']) || 0;
    var custData = appData.pelanggan.find(function(p) { return p['Nama Pelanggan'] === px['Nama Pelanggan']; }); var currentSisaKuota = custData ? (parseFloat(custData['Sisa Kuota (Kg)']) || 0) : 0; 
    currentSisaKuota = Math.round(currentSisaKuota * 100) / 100;
    if (px['Detail Layanan JSON']) { try { var parsed = JSON.parse(px['Detail Layanan JSON']); if(!Array.isArray(parsed)) { items = parsed.items || []; diskonTx = parsed.diskon || 0; potonganMemberTx = parsed.potonganMember || 0; subtotalTx = parsed.subtotal || subtotalTx; } else { items = parsed; } } catch(e) {} }
    var totalHarga = Number(px['Total Harga'] || 0);
    var pmbStatusVal = px['Pembayaran'] || 'Belum Lunas';
    if (totalHarga === 0 && subtotalTx > 0 && diskonTx === 0) { pmbStatusVal = 'Potong Kuota'; }
    else if (totalHarga === 0 && (pmbStatusVal === 'Potong Kuota' || kgTerpakaiTx > 0)) { pmbStatusVal = 'Potong Kuota'; }
    var isPureMember = (totalHarga === 0 && pmbStatusVal === 'Potong Kuota');
    if (pmbStatusVal === 'Potong Kuota' && kgTerpakaiTx === 0 && items.length > 0) { items.forEach(function(i) { if(i.satuan === 'Kg') kgTerpakaiTx += i.qty; }); }
    var trackingSisaKuota = currentSisaKuota + kgTerpakaiTx;
    var remainingKg = kgTerpakaiTx;
    var allSameDate = true; var firstDate = items.length > 0 ? (items[0].estimasiSelesai ? String(items[0].estimasiSelesai).split(' - ')[0].split(' ')[0] : '') : '';
    for(var i=1; i<items.length; i++){ var currEst = items[i].estimasiSelesai ? String(items[i].estimasiSelesai).split(' - ')[0].split(' ')[0] : ''; if(currEst !== firstDate){ allSameDate = false; break; } }
    if (allSameDate && firstDate) { estimasiGlobalHTML = '<p style="margin:0; font-size:11px; font-weight:bold; color:black;">Selesai: ' + firstDate + '</p>'; }
    
    if (items.length > 0) {
        var arrHtml = [];
        items.forEach(function(item, index) {
            var isCoveredByQuota = false; var kgDeducted = 0;
            if (pmbStatusVal === 'Potong Kuota' && item.satuan === 'Kg' && remainingKg > 0) { isCoveredByQuota = true; kgDeducted = Math.min(item.qty, remainingKg); remainingKg -= kgDeducted; }
            var itemEst = item.estimasiSelesai ? String(item.estimasiSelesai).split(' - ')[0].split(' ')[0] : '';
            var estHtml = (!allSameDate && itemEst) ? ('<br><span style="color:black;">Selesai: ' + itemEst + '</span>') : '';
            var mb = (index < items.length - 1) ? '12px' : '6px';
            
            if (isCoveredByQuota) { arrHtml.push('<div style="margin-bottom:' + mb + ';"><div style="display:flex; justify-content:space-between; font-weight:bold; color:black;"><span>' + item.nama + '</span><span>-</span></div><div style="font-size:10px; color:black;">' + (Math.round(trackingSisaKuota*100)/100) + ' Kg - ' + item.qty + ' Kg = ' + (Math.round((trackingSisaKuota - item.qty)*100)/100) + ' Kg' + estHtml + '</div></div>'); trackingSisaKuota -= item.qty; } 
            else { arrHtml.push('<div style="margin-bottom:' + mb + ';"><div style="display:flex; justify-content:space-between; font-weight:bold; color:black;"><span>' + item.nama + '</span><span>Rp ' + Number(item.subtotal).toLocaleString('id-ID') + '</span></div><div style="font-size:10px; color:black;">' + item.qty + ' ' + item.satuan + ' x Rp ' + Number(item.subtotal/item.qty).toLocaleString('id-ID') + estHtml + '</div></div>'); }
        });
        layananHTML = arrHtml.join(''); 
    } else { layananHTML = (px['Layanan'] || '').replace(/\+/g, '<br>'); }
    
    var dpAmount = Number(px['DP'] || 0); var sisaAmount = Number(px['Sisa Bayar'] !== undefined ? px['Sisa Bayar'] : totalHarga);
    if (pmbStatusVal === 'Lunas' || pmbStatusVal === 'Potong Kuota') { sisaAmount = 0; }
    
    var paymentHTML = '<div style="border-bottom: 1px dashed black; margin: 8px 0;"></div><table width="100%" style="font-size: 11px; border-collapse: collapse; color: black;">';
    var usedQuota = (pmbStatusVal === 'Potong Kuota' || kgTerpakaiTx > 0);
    if (usedQuota) {
        paymentHTML += '<tr><td style="text-align:left; padding:2px 0;">Sisa Kuota:</td><td style="text-align:right; font-weight:bold; padding:2px 0;">' + currentSisaKuota + ' Kg</td></tr>';
        paymentHTML += '<tr><td style="text-align:left; padding:2px 0;">Status Bayar:</td><td style="text-align:right; font-weight:bold; padding:2px 0;">Potong Kuota</td></tr>';
    }
    if (!isPureMember) {
        if (usedQuota) { paymentHTML += '<tr><td colspan="2"><div style="border-bottom: 1px dashed black; margin: 4px 0;"></div></td></tr>'; }
        if (diskonTx > 0) { paymentHTML += '<tr><td style="text-align:left; padding:2px 0;">DISKON:</td><td style="text-align:right; padding:2px 0;">- Rp ' + diskonTx.toLocaleString('id-ID') + '</td></tr>'; }
        paymentHTML += '<tr><td style="text-align:left; font-weight:900; font-size:13px; padding-top:6px; color:black;">TOTAL:</td><td style="text-align:right; font-weight:900; font-size:13px; padding-top:6px; color:black;">Rp ' + totalHarga.toLocaleString('id-ID') + '</td></tr>';
        
        var statusTagihan = pmbStatusVal; if (statusTagihan === 'Potong Kuota' && totalHarga > 0) statusTagihan = 'Belum Lunas';
        paymentHTML += '<tr><td style="text-align:left; padding:2px 0; padding-top:4px;">Status Bayar:</td><td style="text-align:right; font-weight:bold; padding:2px 0; padding-top:4px;">' + statusTagihan + '</td></tr>';
        if(statusTagihan === 'DP') {
            paymentHTML += '<tr><td style="text-align:left; padding:2px 0;">DP:</td><td style="text-align:right; padding:2px 0;">Rp ' + dpAmount.toLocaleString('id-ID') + '</td></tr>';
            paymentHTML += '<tr><td style="text-align:left; font-weight:900; font-size:13px; padding-top:4px; color:black;">SISA:</td><td style="text-align:right; font-weight:900; font-size:13px; padding-top:4px; color:black;">Rp ' + sisaAmount.toLocaleString('id-ID') + '</td></tr>';
        }
    }
    paymentHTML += '</table>';
    
    var kasirName = (currentUser && currentUser['Nama Lengkap']) ? currentUser['Nama Lengkap'] : 'Admin';
    var tglMasuk = (px['Waktu Masuk'] ? String(px['Waktu Masuk']).split(' ')[0] : '-'); 
    var nameCust = px['Nama Pelanggan'] || '-';
    var nameFontSize = nameCust.length > 15 ? '16px' : '22px'; 

    var finalHtml = '<div style="font-family: monospace; color: black; font-size: 11px; width: 100%;">';
    finalHtml += '<div style="text-align: center; margin: 18px 0 8px 0;">';
    finalHtml += '<h2 style="margin:0 0 4px 0; font-size:16px; font-weight:900; letter-spacing:1px; color:black;">' + (appSettings.nama.toUpperCase()) + '</h2>';
    finalHtml += '<p style="margin:0; font-size:10px; color:black; line-height:1.3;">' + (appSettings.alamat) + '</p>';
    finalHtml += '</div>';
    finalHtml += '<div style="border-top: 1px dashed black; border-bottom: 1px dashed black; height: 2px; margin: 6px 0;"></div>';
    finalHtml += '<table width="100%" style="font-size:11px; color:black; margin-bottom:6px; font-weight:bold;">';
    finalHtml += '<tr><td width="25%">Tgl</td><td width="5%">:</td><td>' + tglMasuk + '</td></tr>';
    finalHtml += '<tr><td>Kasir</td><td>:</td><td>' + kasirName + '</td></tr>';
    finalHtml += '<tr><td>No. Nota</td><td>:</td><td>' + (px['No Nota'] || '-') + '</td></tr>';
    finalHtml += '</table>';
    finalHtml += '<div style="text-align: center; margin: 18px 0 8px 0;">';
    finalHtml += '<h1 style="margin:0; font-size:' + nameFontSize + '; font-weight:900; color:black; line-height:1.1; word-wrap:break-word;">' + nameCust + '</h1>';
    finalHtml += '</div>';
    finalHtml += '<div style="border-bottom: 1px dashed black; margin: 6px 0;"></div>';
    finalHtml += estimasiGlobalHTML;
    finalHtml += '<div style="font-size:11px; line-height:1.6; color:black;">' + layananHTML + '</div>';
    finalHtml += paymentHTML;
    finalHtml += '<div style="border-bottom: 1px dashed black; margin: 12px 0;"></div>';
    finalHtml += '<div style="text-align: left; margin-top: 10px; font-size: 10px; color: black; line-height: 1.5;">';
    finalHtml += '<p style="margin:0; text-align: center; font-weight: bold; padding-bottom: 6px; font-size:12px;">Terima Kasih</p>';
    finalHtml += '<ol style="margin:0; padding-left:14px;">';
    finalHtml += '<li style="padding-bottom:2px;">Pakaian luntur bukan tanggung jawab laundry.</li>';
    finalHtml += '<li style="padding-bottom:2px;">Minimum perhitungan laundry kiloan (1 Kg).</li>';
    finalHtml += '<li style="padding-bottom:2px;">Tidak menerima laundry dalaman.</li>';
    finalHtml += '<li style="padding-bottom:2px;">Cucian tidak diambil 1 bulan bukan tanggung jawab kami.</li>';
    finalHtml += '</ol>';
    finalHtml += '<div style="height: 60px;"></div>';
    finalHtml += '</div>';

    return finalHtml;
}

function generateRawTextReceipt(px) {
    var str = "";
    var ESC = "\x1B"; var GS = "\x1D";
    var init = ESC + "@"; var center = ESC + "a\x01"; var left = ESC + "a\x00";
    var sizeNormal = GS + "!\x00"; var sizeDoubleHeight = GS + "!\x01"; var sizeDouble = GS + "!\x11";

    var splitKV = function(k, v) { var space = Math.max(1, 32 - k.length - String(v).length); return k + " ".repeat(space) + v + "\n"; };

    str += init;
    str += center;
    str += sizeDoubleHeight + appSettings.nama.toUpperCase() + "\n";
    str += sizeNormal;
    str += (appSettings.alamat||'') + "\n";
    str += left;
    str += "================================\n";

    var tglMasuk = (px['Waktu Masuk'] ? String(px['Waktu Masuk']).split(' ')[0] : '-');
    var kasirName = (currentUser && currentUser['Nama Lengkap']) ? currentUser['Nama Lengkap'] : 'Admin';
    str += "Tgl      : " + tglMasuk + "\n";
    str += "Kasir    : " + kasirName + "\n";
    str += "No. Nota : " + (px['No Nota'] || '-') + "\n";
    str += "\n";
    str += center;
    var nameCust = (px['Nama Pelanggan'] || '-');
    if (nameCust.length > 15) { str += sizeDoubleHeight + nameCust + "\n"; } else { str += sizeDouble + nameCust + "\n"; }
    str += sizeNormal;
    str += left;
    str += "--------------------------------\n";

    var items = []; var subtotalTx = Number(px['Total Harga'] || 0); var diskonTx = 0;
    if (px['Detail Layanan JSON']) { try { var parsed = JSON.parse(px['Detail Layanan JSON']); items = Array.isArray(parsed) ? parsed : (parsed.items || []); diskonTx = parsed.diskon || 0; } catch(e) {} }

    if (items.length > 0) {
        items.forEach(function(item, index) {
            str += item.nama + "\n";
            var line2 = item.qty + " " + item.satuan + " x " + Number(item.subtotal/item.qty).toLocaleString('id-ID');
            var val2 = "Rp " + Number(item.subtotal).toLocaleString('id-ID');
            str += splitKV(line2, val2);
            if (index < items.length - 1) { str += "\n"; }
        });
    } else { str += (px['Layanan'] || '').replace(/\+/g, '\n\n') + "\n"; } 

    str += "--------------------------------\n";
    var totalHarga = Number(px['Total Harga'] || 0);
    if(diskonTx > 0) str += splitKV("DISKON", "-Rp " + diskonTx.toLocaleString('id-ID'));
    str += splitKV("TOTAL", "Rp " + totalHarga.toLocaleString('id-ID'));

    var pmbStatusVal = px['Pembayaran'] || 'Belum Lunas';
    if (totalHarga === 0 && pmbStatusVal !== 'Lunas') pmbStatusVal = 'Potong Kuota';
    str += splitKV("STATUS", pmbStatusVal);

    if(pmbStatusVal === 'DP') {
        str += splitKV("DP", "Rp " + Number(px['DP'] || 0).toLocaleString('id-ID'));
        str += splitKV("SISA", "Rp " + Number(px['Sisa Bayar'] || 0).toLocaleString('id-ID'));
    }

    str += "--------------------------------\n";
    str += center;
    str += "Terima Kasih\n";
    str += left;
    str += "1. Pakaian luntur bukan tanggung jawab laundry.\n";
    str += "2. Minimum laundry kiloan (1Kg).\n";
    str += "3. Tdk menerima lndry dalaman.\n";
    str += "4. Cucian tdk diambil 1 bln \n   bukan tanggung jawab kami.\n";
    str += "\n\n\n\n\n";
    return str;
}

function showSuccessModal() { var modal = document.getElementById('modal-success-print'); if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); } }

window.zettConnectedPrinter = window.zettConnectedPrinter || null;

async function connectPrinterManually() {
    if (navigator.bluetooth) {
        try {
            showToast("Mencari printer Bluetooth...", "success");
            var btDevice = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2']
            });
            window.zettConnectedPrinter = btDevice;
            showToast("Printer terhubung: " + btDevice.name, "success");
            updatePrinterStatusUI();
        } catch(e) {
            console.error("Bluetooth Error:", e);
            if (e.name === 'NotFoundError') {
                showToast("Dibatalkan atau printer tidak ditemukan.", "error");
            } else {
                showToast("Error Bluetooth: " + e.message, "error");
            }
        }
    } else {
        showToast("Perangkat ini tidak mendukung Web Bluetooth!", "error");
    }
}

function updatePrinterStatusUI() {
    var btn = document.getElementById('btn-printer-status');
    if (!btn) return;
    if (window.zettConnectedPrinter) {
        btn.className = "w-9 h-9 bg-cyan-500 text-white rounded-xl flex items-center justify-center transition-all duration-300 active:scale-95 shadow-[0_0_12px_rgba(6,182,212,0.6)] border border-cyan-400";
        btn.innerHTML = '<i class="ph-bold ph-printer text-lg drop-shadow-md"></i>';
        btn.title = "Printer Terhubung: " + window.zettConnectedPrinter.name;
    } else {
        btn.className = "w-9 h-9 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center hover:bg-slate-200 transition-all duration-300 active:scale-95 shadow-sm";
        btn.innerHTML = '<i class="ph-bold ph-printer text-lg"></i>';
        btn.title = "Hubungkan Printer Bluetooth";
    }
}

async function actionPrintReceipt() {
    if(!currentSavedTx) return;

    if (navigator.bluetooth) {
        try {
            var btDevice = window.zettConnectedPrinter;
            
            if (!btDevice) {
                btDevice = await navigator.bluetooth.requestDevice({
                    acceptAllDevices: true,
                    optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2']
                });
                window.zettConnectedPrinter = btDevice; 
                updatePrinterStatusUI(); 
            }

            showToast("Menghubungkan ke " + btDevice.name + "...");
            var server;
            
            try {
                server = await btDevice.gatt.connect();
            } catch (connErr) {
                console.log("Auto-reconnect gagal, meminta ulang device...", connErr);
                btDevice = await navigator.bluetooth.requestDevice({
                    acceptAllDevices: true,
                    optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2']
                });
                window.zettConnectedPrinter = btDevice;
                updatePrinterStatusUI();
                server = await btDevice.gatt.connect();
            }

            var service = null; var characteristic = null;
            var serviceUuids = ['000018f0-0000-1000-8000-00805f9b34fb', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2'];
            var charUuids = ['00002af1-0000-1000-8000-00805f9b34fb', 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f'];

            for (var i=0; i<serviceUuids.length; i++) { try { service = await server.getPrimaryService(serviceUuids[i]); if(service) break; } catch(e) {} }
            if (!service) throw new Error("Service Bluetooth Printer tidak cocok.");

            for (var j=0; j<charUuids.length; j++) { try { characteristic = await service.getCharacteristic(charUuids[j]); if(characteristic) break; } catch(e) {} }
            if (!characteristic) throw new Error("Karakteristik Bluetooth Printer tidak cocok.");

            var str = generateRawTextReceipt(currentSavedTx);
            var encoder = new TextEncoder();
            var bytes = encoder.encode(str);

            var chunkSize = 20; 
            for (var k = 0; k < bytes.length; k += chunkSize) {
                await characteristic.writeValue(bytes.slice(k, k + chunkSize));
            }

            showToast("Nota berhasil dicetak langsung ke Mesin!");
            
            setTimeout(function() { btDevice.gatt.disconnect(); }, 2000);
            return; 

        } catch(e) {
            console.error("Web Bluetooth Error:", e);
            window.zettConnectedPrinter = null; 
            updatePrinterStatusUI(); 
            
            if (e.name === 'NotFoundError') {
                showToast("Cetak dibatalkan pengguna.", "error");
                return;
            } else if (e.name === 'NotSupportedError') {
                showToast("Perangkat ini memblokir cetak langsung. Beralih ke mode Sistem/RawBT.", "warning");
            } else {
                showToast("Gagal Terhubung: " + e.message + ". Beralih ke mode Sistem/RawBT.", "error");
            }
        }
    }

    setTimeout(function() { 
        document.getElementById('print-area').innerHTML = generateReceiptHTML(currentSavedTx); 
        window.print(); 
        
        setTimeout(function() {
            zettConfirm("Informasi Mode Cetak", "Jika di layar Anda malah muncul 'Simpan sebagai PDF', tekan tulisan tersebut lalu pilih 'Semua Printer' dan pilih nama Printer Thermal Anda. \n\n(Catatan: Jika nama printernya tidak ada, Anda wajib menginstal aplikasi 'RawBT' di PlayStore agar Android Anda mengenali printer kasir).", "info", function(){});
        }, 1000);
    }, 500); 
}

// FIX: Hindari Error "InvalidStateError" di Input File & input type khusus!
document.addEventListener('input', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        // FIX: Abaikan semua input yang tidak support .value assignment atau selectionStart
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
                // Cegah error cursor-jump di beberapa HP
                try { e.target.setSelectionRange(start, start); } catch(err) {} 
            }
        } catch(err) { /* Abaikan error pada input type yang tidak support value assignment */ }
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
