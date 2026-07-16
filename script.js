// --- 1. INISIALISASI DATABASE DEXIE.JS ---
const db = new Dexie("ScrapingDatabase");
db.version(2).stores({
    files_table: '++id, fileName, date, url, platform'
});
db.version(3).stores({
    files_table: '++id, fileName, date, url, platform',
    platforms_table: '++id, name'
});

let currentLoadedData = null;

const DEFAULT_PLATFORMS = [
    { name: 'Tokopedia', icon: 'fa-solid fa-store' },
    { name: 'Shopee', icon: 'fa-solid fa-bag-shopping' },
    { name: 'Facebook Marketplace', icon: 'fa-brands fa-facebook' },
    { name: 'Content Creator', icon: 'fa-solid fa-video' }
];

// Fungsi pembantu untuk mengetahui menu apa yang sedang aktif
function getActivePlatform() {
    const activeMenu = document.querySelector('.menu-item.active');
    return activeMenu ? activeMenu.getAttribute('data-platform') : null;
}

window.addEventListener('DOMContentLoaded', async () => {
    const platforms = await initPlatforms();
    setupSidebarNavigation();
    setupAddPlatformForm();
    await loadDatabaseHistory();

    // Isi kolom kategori dengan menu yang sedang aktif sebagai default
    const catInput = document.getElementById('category-input');
    if (catInput) catInput.value = getActivePlatform() || '';
});

// --- 2. INISIALISASI & RENDER DAFTAR MENU (PLATFORM) ---
async function initPlatforms() {
    let platforms = await db.platforms_table.toArray();
    if (platforms.length === 0) {
        await db.platforms_table.bulkAdd(DEFAULT_PLATFORMS);
        platforms = await db.platforms_table.toArray();
    }
    await renderMenuList(platforms, platforms[0] ? platforms[0].name : null);
    return platforms;
}

// Hitung jumlah data tersimpan per kategori (gaya kartu statistik)
async function getFileCountsByPlatform() {
    const allFiles = await db.files_table.toArray();
    const counts = {};
    allFiles.forEach(f => {
        const key = f.platform || '-';
        counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
}

async function renderMenuList(platforms, activeName) {
    const menuList = document.getElementById('menu-list');
    const counts = await getFileCountsByPlatform();
    menuList.innerHTML = '';

    platforms.forEach(p => {
        const li = document.createElement('li');
        li.className = 'menu-item' + (p.name === activeName ? ' active' : '');
        li.setAttribute('data-platform', p.name);
        li.setAttribute('data-id', p.id);

        const icon = p.icon || 'fa-solid fa-layer-group';
        const jumlah = counts[p.name] || 0;
        li.innerHTML = `
            <i class="${icon}"></i>
            <span class="menu-item-label">${p.name}</span>
            <span class="menu-count">${jumlah}</span>
            <i class="fa-solid fa-xmark menu-delete-btn" title="Hapus menu ini" onclick="deletePlatform(event, ${p.id})"></i>
        `;
        menuList.appendChild(li);
    });

    const menuTitle = document.getElementById('active-menu-title');
    if (menuTitle) {
        menuTitle.innerText = activeName ? activeName : "Belum ada menu";
    }

    updatePlatformDatalist(platforms);

    if (platforms.length === 0) {
        const historySection = document.getElementById('history-section');
        if (historySection) historySection.style.display = 'none';
        resetWorkspaceView('');
    }
}

// Isi datalist supaya saat mengetik kategori di form upload, nama yang sudah
// ada muncul sebagai saran (mempermudah upload ke kategori yang sama)
function updatePlatformDatalist(platforms) {
    const datalist = document.getElementById('platform-suggestions');
    if (!datalist) return;
    datalist.innerHTML = '';
    platforms.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.name;
        datalist.appendChild(opt);
    });
}

// --- 3. LOGIKA SIDEBAR MENU INTERAKTIF (EVENT DELEGATION, KARENA MENU DINAMIS) ---
function setupSidebarNavigation() {
    const menuList = document.getElementById('menu-list');

    menuList.addEventListener('click', function(e) {
        const item = e.target.closest('.menu-item');
        if (!item) return;
        if (e.target.classList.contains('menu-delete-btn')) return;

        activateMenuItem(item);
    });
}

function activateMenuItem(item) {
    document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
    item.classList.add('active');

    const platformName = item.getAttribute('data-platform');
    const menuTitle = document.getElementById('active-menu-title');
    if (menuTitle) menuTitle.innerText = platformName;

    resetWorkspaceView(platformName);
    loadDatabaseHistory();
}

function resetWorkspaceView(prefillCategory) {
    document.getElementById('table-section').style.display = 'none';
    document.getElementById('dashboard-cards').style.display = 'none';
    document.getElementById('target-url').value = '';
    document.getElementById('excel-file').value = '';
    document.getElementById('upload-text').innerHTML = 'Tarik & lepas berkas Excel di sini<br>atau klik untuk memilih (bisa lebih dari satu berkas)';
    currentLoadedData = null;

    const catInput = document.getElementById('category-input');
    if (catInput) catInput.value = prefillCategory || '';
}

// --- 4. TAMBAH & HAPUS MENU (PLATFORM) SECARA MANUAL DARI SIDEBAR ---
function setupAddPlatformForm() {
    const btnAdd = document.getElementById('btn-add-platform');
    const inputNew = document.getElementById('new-platform-input');
    if (!btnAdd || !inputNew) return;

    const handleAdd = async () => {
        const name = inputNew.value.trim();
        if (name === "") {
            alert("⚠️ Masukkan nama menu terlebih dahulu!");
            return;
        }

        const existing = await db.platforms_table.where('name').equalsIgnoreCase(name).first();
        if (existing) {
            alert("⚠️ Menu dengan nama ini sudah ada!");
            return;
        }

        await db.platforms_table.add({ name: name, icon: 'fa-solid fa-layer-group' });
        inputNew.value = '';

        const platforms = await db.platforms_table.toArray();
        await renderMenuList(platforms, name);

        resetWorkspaceView(name);
        loadDatabaseHistory();

        const menuList = document.getElementById('menu-list');
        menuList.scrollTop = menuList.scrollHeight;
    };

    btnAdd.addEventListener('click', handleAdd);
    inputNew.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleAdd();
    });
}

window.deletePlatform = async function(event, id) {
    event.stopPropagation();
    if (!confirm("Hapus menu ini? Data yang sudah tersimpan di kategori ini TIDAK akan ikut terhapus dari database.")) return;

    await db.platforms_table.delete(id);
    const platforms = await db.platforms_table.toArray();
    const fallback = platforms[0] ? platforms[0].name : null;
    await renderMenuList(platforms, fallback);
    resetWorkspaceView(fallback);
    loadDatabaseHistory();
}

// --- 5. MEMUAT RIWAYAT DATABASE (GLOBAL, SEMUA KATEGORI) ---
async function loadDatabaseHistory() {
    const allFiles = await db.files_table
        .reverse()
        .toArray();

    const historySection = document.getElementById('history-section');
    const historyList = document.getElementById('history-list');

    if (allFiles.length > 0) {
        historySection.style.display = 'block';
        historyList.innerHTML = '';
        allFiles.forEach(file => {
            const item = document.createElement('div');
            item.className = 'history-item';
            item.innerHTML = `
                <div class="file-info">
                    <i class="fa-solid fa-file-excel file-icon"></i>
                    <div>
                        <div class="file-title">${file.fileName}</div>
                        <div class="file-date">
                            <i class="fa-regular fa-clock"></i> ${file.date}
                            ${file.platform ? `<span class="file-platform-badge"> &middot; ${file.platform}</span>` : ''}
                        </div>
                    </div>
                </div>
                <div class="file-actions">
                    <button class="btn-open" onclick="openFileFromDB(${file.id})"><i class="fa-solid fa-folder-open"></i> Buka</button>
                    <button class="btn-delete" onclick="deleteFileFromDB(${file.id})"><i class="fa-solid fa-trash-can"></i> Hapus</button>
                </div>
            `;
            historyList.appendChild(item);
        });
    } else {
        historySection.style.display = 'none';
    }
}

// --- 6. MEMBUKA & MENGHAPUS FILE DARI DATABASE ---
window.openFileFromDB = async function(id) {
    const file = await db.files_table.get(id);
    if (file) {
        document.getElementById('target-url').value = file.url || '';
        const catInput = document.getElementById('category-input');
        if (catInput) catInput.value = file.platform || '';
        currentLoadedData = file.data;
        document.getElementById('upload-text').innerHTML = `Membaca Database: <strong>${file.fileName}</strong>`;
        renderDashboard(file.data, `Dibuka dari Database (${file.platform || 'Umum'})`);
        handleUrlAction();
        document.getElementById('table-section').scrollIntoView({ behavior: 'smooth' });
    }
}

window.deleteFileFromDB = async function(id) {
    if(confirm("Hapus file ini dari database lokal?")) {
        await db.files_table.delete(id);
        const platforms = await db.platforms_table.toArray();
        await renderMenuList(platforms, getActivePlatform());
        loadDatabaseHistory();
    }
}

// --- 7. LOGIKA UPLOAD EXCEL — DI SINILAH KATEGORI/MENU BARU OTOMATIS DIBUAT ---
function readFileAsync(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(new Uint8Array(e.target.result));
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

document.getElementById('excel-file').addEventListener('change', async function(e) {
    const files = e.target.files;
    if (files.length === 0) return;

    let urlInput = document.getElementById('target-url').value.trim();
    if (urlInput === "") {
        alert("⚠️ HARAP MASUKKAN URL TARGET TERLEBIH DAHULU SEBELUM MENGUNGGAH FILE EXCEL!");
        e.target.value = "";
        return;
    }

    let categoryName = document.getElementById('category-input').value.trim();
    if (categoryName === "") categoryName = getActivePlatform() || "";
    if (categoryName === "") {
        alert("⚠️ Isi nama Kategori Data / Menu terlebih dahulu (kategori baru akan otomatis dibuat sebagai menu)!");
        e.target.value = "";
        return;
    }

    document.getElementById('upload-text').innerHTML = `Memproses ${files.length} file...`;

    let allHeaders = [];
    let allRows = [];
    let savedFileName = files.length === 1 ? files[0].name : `Gabungan_${files.length}_File.xlsx`;

    try {
        for (let i = 0; i < files.length; i++) {
            const data = await readFileAsync(files[i]);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            if (jsonData.length > 0) {
                if (i === 0) allHeaders = jsonData[0];
                const rows = jsonData.slice(1);
                allRows = allRows.concat(rows);
            }
        }

        if (allHeaders.length > 0) {
            const finalData = [allHeaders, ...allRows];
            currentLoadedData = finalData;

            // Cek apakah kategori ini sudah ada sebagai menu; kalau belum, buat otomatis
            let platformRecord = await db.platforms_table.where('name').equalsIgnoreCase(categoryName).first();
            if (!platformRecord) {
                const newId = await db.platforms_table.add({ name: categoryName, icon: 'fa-solid fa-layer-group' });
                platformRecord = { id: newId, name: categoryName };
            }
            const finalPlatformName = platformRecord.name;

            await db.files_table.add({
                fileName: savedFileName,
                data: finalData,
                url: urlInput,
                platform: finalPlatformName,
                date: new Date().toLocaleString('id-ID')
            });

            renderDashboard(finalData, `Data Tersimpan di Kategori ${finalPlatformName}`);
            handleUrlAction();

            // Menu sidebar otomatis ter-update / bertambah sesuai kategori yang baru diupload
            const platforms = await db.platforms_table.toArray();
            await renderMenuList(platforms, finalPlatformName);
            loadDatabaseHistory();

            document.getElementById('upload-text').innerHTML = `Berhasil disimpan ke Kategori <strong>${finalPlatformName}</strong>!`;
        } else {
            alert("Semua file Excel Anda kosong!");
        }
    } catch (error) {
        console.error(error);
        alert("Terjadi kesalahan saat memproses file Excel.");
    } finally {
        e.target.value = "";
    }
});

// --- 8. LOGIKA RENDER TABEL & TOMBOL URL ---
function handleUrlAction() {
    let urlInput = document.getElementById('target-url').value.trim();
    const btnOpenUrl = document.getElementById('action-open-url');

    if (urlInput !== "") {
        if (!urlInput.startsWith('http://') && !urlInput.startsWith('https://')) {
            urlInput = 'https://' + urlInput;
        }
        btnOpenUrl.style.display = 'flex';
        btnOpenUrl.onclick = function() { window.open(urlInput, '_blank'); };
    } else {
        btnOpenUrl.style.display = 'none';
    }
}

document.getElementById('target-url').addEventListener('input', handleUrlAction);

function renderDashboard(data, statusText) {
    const headers = data[0];
    const rows = data.slice(1);

    document.getElementById('total-rows').innerText = rows.length.toLocaleString('id-ID');
    document.getElementById('total-cols').innerText = headers.length.toLocaleString('id-ID');
    document.getElementById('sheet-name').innerText = statusText;

    document.getElementById('dashboard-cards').style.display = 'flex';
    document.getElementById('table-section').style.display = 'block';

    const thead = document.getElementById('table-head');
    thead.innerHTML = '';
    headers.forEach(headerText => {
        const th = document.createElement('th');
        th.innerText = headerText || '-';
        thead.appendChild(th);
    });

    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';

    const fragment = document.createDocumentFragment();

    rows.forEach(row => {
        if (row.length === 0) return;
        const tr = document.createElement('tr');
        headers.forEach((_, index) => {
            const td = document.createElement('td');
            const cellValue = row[index] !== undefined ? row[index] : '';

            if (typeof cellValue === 'string' && (cellValue.startsWith('http://') || cellValue.startsWith('https://'))) {
                td.innerHTML = `<a href="${cellValue}" target="_blank" class="url-link"><i class="fa-solid fa-link"></i> Buka Tautan</a>`;
            } else {
                td.innerText = cellValue;
            }
            tr.appendChild(td);
        });
        fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);
}

// --- 9. FUNGSI DOWNLOAD & EXPORT/IMPORT DATABASE ---
document.getElementById('btn-download-data').addEventListener('click', function() {
    if (currentLoadedData) {
        const ws = XLSX.utils.aoa_to_sheet(currentLoadedData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Data_Scraping");
        XLSX.writeFile(wb, "Data_Scraping_Download.xlsx");
    } else {
        alert("Tidak ada data untuk diunduh.");
    }
});

window.exportDatabase = async function() {
    const allFiles = await db.files_table.toArray();
    const allPlatforms = await db.platforms_table.toArray();
    if (allFiles.length === 0 && allPlatforms.length === 0) {
        alert("Database kosong! Tidak ada data yang bisa diexport.");
        return;
    }
    const dataStr = JSON.stringify({ files: allFiles, platforms: allPlatforms });
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "database_scraping_all.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

const importBtn = document.getElementById('import-db-file');
if(importBtn) {
    importBtn.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async function(event) {
            try {
                const imported = JSON.parse(event.target.result);

                const importedFiles = Array.isArray(imported) ? imported : (imported.files || []);
                const importedPlatforms = Array.isArray(imported) ? [] : (imported.platforms || []);

                await db.files_table.clear();
                await db.files_table.bulkPut(importedFiles);

                if (importedPlatforms.length > 0) {
                    await db.platforms_table.clear();
                    await db.platforms_table.bulkPut(importedPlatforms);
                }

                alert("✅ Database berhasil diimpor!");
                const platforms = await db.platforms_table.toArray();
                await renderMenuList(platforms, platforms[0] ? platforms[0].name : null);
                loadDatabaseHistory();
                e.target.value = "";
            } catch(err) {
                console.error(err);
                alert("❌ File database tidak valid!");
            }
        };
        reader.readAsText(file);
    });
}