// ================== LOGIKA APLIKASI ==================
        const DB_NAME = "DixzMegaDB";
        const DB_VERSION = 1;
        let db;

        // --- MOTIVATION LIST ---
        const dailyMotivations = [
            "Percaya pada diri sendiri adalah rahasia pertama sukses.",
            "Jangan berhenti saat lelah, berhentilah saat selesai.",
            "Kesalahan adalah bukti bahwa kamu sedang mencoba.",
            "Setiap hari adalah kesempatan baru untuk menjadi lebih baik.",
            "Mimpi besar dimulai dari langkah kecil.",
            "Fokus pada proses, hasil akan mengikuti.",
            "Hari ini adalah hari yang baik untuk memulai hal hebat.",
            "Jangan takut gagal, takutlah jika tidak pernah mencoba.",
            "Usaha tidak akan pernah mengkhianati hasil.",
            "Jadilah versi terbaik dari dirimu sendiri.",
            "Kesuksesan adalah jumlah dari upaya kecil yang diulang hari demi hari.",
            "Waktu terbaik untuk memulai adalah sekarang.",
            "Disiplin adalah jembatan antara tujuan dan pencapaian.",
            "Tetap semangat, badai pasti berlalu."
        ];

        function initDB() {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(DB_NAME, DB_VERSION);
                request.onupgradeneeded = (e) => {
                    db = e.target.result;
                    if (!db.objectStoreNames.contains("media")) {
                        const store = db.createObjectStore("media", { keyPath: "id", autoIncrement: true });
                        store.createIndex("user", "user", { unique: false });
                    }
                };
                request.onsuccess = (e) => { db = e.target.result; resolve(db); };
                request.onerror = (e) => reject("DB Error");
            });
        }

        async function saveMediaToDB(user, type, fileBlob, name, albumNameOrUrl) {
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(["media"], "readwrite");
                const store = transaction.objectStore("media");
                const item = { user: user, type: type, blob: fileBlob, name: name, created: new Date() };
                if(type === 'web_app') item.url = albumNameOrUrl; else item.album = albumNameOrUrl;
                store.add(item);
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject();
            });
        }

        async function getMediaFromDB(user) {
            return new Promise((resolve) => {
                const transaction = db.transaction(["media"], "readonly");
                const store = transaction.objectStore("media");
                const index = store.index("user");
                const request = index.getAll(user);
                request.onsuccess = () => resolve(request.result);
            });
        }

        async function deleteMediaFromDB(id) {
            return new Promise((resolve) => {
                const transaction = db.transaction(["media"], "readwrite");
                const store = transaction.objectStore("media");
                store.delete(id);
                transaction.oncomplete = () => resolve();
            });
        }

        async function updateMediaNameInDB(id, newName) {
            return new Promise((resolve) => {
                const transaction = db.transaction(["media"], "readwrite");
                const store = transaction.objectStore("media");
                const request = store.get(id);
                request.onsuccess = () => {
                    const item = request.result;
                    if(item) {
                        item.name = newName;
                        store.put(item);
                    }
                };
                transaction.oncomplete = () => resolve();
            });
        }

        async function migrateMediaUser(oldUser, newUser) {
             const items = await getMediaFromDB(oldUser);
             const transaction = db.transaction(["media"], "readwrite");
             const store = transaction.objectStore("media");
             for (const item of items) { item.user = newUser; store.put(item); }
        }

        async function updateMediaAlbum(user, oldAlbum, newAlbum) {
            const items = await getMediaFromDB(user);
            const transaction = db.transaction(["media"], "readwrite");
            const store = transaction.objectStore("media");
            for (const item of items) { if((item.album || user) === oldAlbum) { item.album = newAlbum; store.put(item); } }
        }

        let allAppsList = [];
        let dragSrcEl = null;
        let appToRename = null;

        function previewAppIcon(e) {
            const file = e.target.files[0];
            if(file) {
                const url = URL.createObjectURL(file);
                const img = document.getElementById('appIconPreview');
                img.src = url; img.style.display = 'block';
                document.getElementById('appIconPlaceholder').style.display = 'none';
            }
        }

        async function processAddApp() {
            if(!currentUser) return;
            const iconInput = document.getElementById('appIconInput').files[0];
            const name = document.getElementById('appNameInput').value;
            const url = document.getElementById('appLinkInput').value;
            if(!iconInput || !name || !url) return alert("Isi semua data (Ikon, Nama, Link)!");
            await saveMediaToDB(currentUser, 'web_app', iconInput, name, url);
            closeModal(); setTimeout(() => { loadApps(); }, 100);
        }

        async function loadApps() {
            if(!currentUser) return;
            const items = await getMediaFromDB(currentUser);
            let rawApps = items.filter(i => i.type === 'web_app');
            let order = JSON.parse(localStorage.getItem(`app_order_${currentUser}`) || "[]");
            if(order.length > 0) {
                rawApps.sort((a, b) => {
                    let idxA = order.indexOf(a.id);
                    let idxB = order.indexOf(b.id);
                    if(idxA === -1) idxA = 9999; 
                    if(idxB === -1) idxB = 9999;
                    return idxA - idxB;
                });
            }
            allAppsList = rawApps;
            renderApps(allAppsList);
        }

        function renderApps(apps) {
            const appList = document.getElementById('appList');
            appList.innerHTML = '';
            if(apps.length === 0) {
                appList.innerHTML = '<p style="grid-column:span 4; text-align:center; padding:20px;">Aplikasi tidak ditemukan.</p>';
                return;
            }
            apps.forEach(app => {
                const iconUrl = URL.createObjectURL(app.blob);
                const div = document.createElement('div');
                div.className = 'app-item';
                div.draggable = true; 
                div.setAttribute('data-id', app.id);
                div.onclick = (e) => { if(!div.classList.contains('dragging-mode')) openWebApp(app.url); };
                div.innerHTML = `<div class="app-icon-box"><img src="${iconUrl}" draggable="false"></div><div class="app-name">${app.name}</div>`;
                div.addEventListener('dragstart', handleDragStart);
                div.addEventListener('dragover', handleDragOver);
                div.addEventListener('drop', handleDrop);
                div.addEventListener('dragend', handleDragEnd);
                div.addEventListener('touchstart', handleTouchStart, {passive: false});
                div.addEventListener('touchmove', handleTouchMove, {passive: false});
                div.addEventListener('touchend', handleTouchEnd);
                appList.appendChild(div);
            });
        }

        function handleDragStart(e) {
            this.style.opacity = '0.4';
            dragSrcEl = this;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', this.getAttribute('data-id'));
        }
        function handleDragOver(e) { if (e.preventDefault) e.preventDefault(); e.dataTransfer.dropEffect = 'move'; return false; }
        function handleDrop(e) {
            if (e.stopPropagation) e.stopPropagation();
            if (dragSrcEl !== this) {
                const srcId = parseInt(dragSrcEl.getAttribute('data-id'));
                const targetId = parseInt(this.getAttribute('data-id'));
                const srcIdx = allAppsList.findIndex(a => a.id === srcId);
                const targetIdx = allAppsList.findIndex(a => a.id === targetId);
                if(srcIdx > -1 && targetIdx > -1) {
                    const temp = allAppsList[srcIdx];
                    allAppsList.splice(srcIdx, 1);
                    allAppsList.splice(targetIdx, 0, temp);
                    const newOrder = allAppsList.map(a => a.id);
                    localStorage.setItem(`app_order_${currentUser}`, JSON.stringify(newOrder));
                    renderApps(allAppsList);
                }
            }
            return false;
        }
        function handleDragEnd(e) { this.style.opacity = '1'; }

        let touchTimer = null;
        let touchStartY = 0;
        
        function handleTouchStart(e) {
            const touch = e.touches[0];
            this.startX = touch.clientX;
            this.startY = touch.clientY;
            touchStartY = touch.clientY;
            touchTimer = setTimeout(() => {
                this.classList.add('dragging');
                this.classList.add('dragging-mode');
                if(navigator.vibrate) navigator.vibrate(50);
            }, 500);
        }
        
        function handleTouchMove(e) {
            const touch = e.touches[0];
            const deltaY = Math.abs(touch.clientY - touchStartY);
            
            // Jika pergerakan vertikal cukup signifikan, ini adalah scroll, bukan drag untuk reorder
            if(deltaY > 10) {
                clearTimeout(touchTimer);
                this.classList.remove('dragging-mode');
            }
            
            if(this.classList.contains('dragging')) {
                e.preventDefault();
                this.style.position = 'absolute';
                this.style.left = (touch.clientX - 40) + 'px';
                this.style.top = (touch.clientY - 40) + 'px';
                this.style.zIndex = '1000';
            }
        }
        
        function handleTouchEnd(e) {
            clearTimeout(touchTimer);
            // Jika elemen tidak dalam mode dragging, ini adalah klik normal
            if(!this.classList.contains('dragging-mode')) {
                return; // Biarkan click handler alami menangani ini
            }
            
            if(this.classList.contains('dragging')) {
                this.classList.remove('dragging');
                this.style.position = '';
                this.style.left = '';
                this.style.top = '';
                this.style.zIndex = '';
                const touch = e.changedTouches[0];
                const target = document.elementFromPoint(touch.clientX, touch.clientY);
                const targetApp = target ? target.closest('.app-item') : null;
                if(targetApp && targetApp !== this) {
                     const srcId = parseInt(this.getAttribute('data-id'));
                     const targetId = parseInt(targetApp.getAttribute('data-id'));
                     const srcIdx = allAppsList.findIndex(a => a.id === srcId);
                     const targetIdx = allAppsList.findIndex(a => a.id === targetId);
                     if(srcIdx > -1 && targetIdx > -1) {
                        const temp = allAppsList[srcIdx];
                        allAppsList.splice(srcIdx, 1);
                        allAppsList.splice(targetIdx, 0, temp);
                        const newOrder = allAppsList.map(a => a.id);
                        localStorage.setItem(`app_order_${currentUser}`, JSON.stringify(newOrder));
                     }
                }
                renderApps(allAppsList);
                setTimeout(() => { this.classList.remove('dragging-mode'); }, 100);
            }
        }

        let deleteAppData = [];

        async function loadDeleteAppList() {
             if(!currentUser) return;
             const items = await getMediaFromDB(currentUser);
             const apps = items.filter(i => i.type === 'web_app');
             deleteAppData = apps;
             const container = document.getElementById('deleteAppList');
             container.innerHTML = '';
             if(apps.length === 0) { container.innerHTML = '<p style="grid-column:span 3; text-align:center;">Tidak ada aplikasi.</p>'; return; }
             renderDeleteAppList(apps);
        }

        function renderDeleteAppList(apps) {
            const container = document.getElementById('deleteAppList');
            container.innerHTML = '';
            if(apps.length === 0) { container.innerHTML = '<p style="grid-column:span 3; text-align:center;">Aplikasi tidak ditemukan.</p>'; return; }
            apps.forEach(app => {
                const iconUrl = URL.createObjectURL(app.blob);
                const div = document.createElement('div');
                div.className = 'app-item';
                div.onclick = () => confirmDeleteApp(app.id, app.name);
                div.innerHTML = `<div class="app-icon-box" style="border-color:red;"><img src="${iconUrl}"></div><div class="app-name">${app.name}</div>`;
                container.appendChild(div);
            });
        }

        function filterDeleteApps() {
            const query = document.getElementById('deleteAppSearch').value.toLowerCase();
            const filtered = deleteAppData.filter(app => app.name.toLowerCase().includes(query));
            renderDeleteAppList(filtered);
        }

        async function confirmDeleteApp(id, name) {
            if(confirm(`Hapus aplikasi "${name}"?`)) {
                await deleteMediaFromDB(id);
                loadDeleteAppList(); loadApps();
            }
        }

        // --- FITUR GANTI NAMA APK ---
        let renameAppData = [];

        async function loadRenameAppList() {
             if(!currentUser) return;
             const items = await getMediaFromDB(currentUser);
             const apps = items.filter(i => i.type === 'web_app');
             renameAppData = apps;
             const container = document.getElementById('renameAppList');
             container.innerHTML = '';
             if(apps.length === 0) { container.innerHTML = '<p style="grid-column:span 3; text-align:center;">Tidak ada aplikasi.</p>'; return; }
             renderRenameAppList(apps);
        }

        function renderRenameAppList(apps) {
            const container = document.getElementById('renameAppList');
            container.innerHTML = '';
            if(apps.length === 0) { container.innerHTML = '<p style="grid-column:span 3; text-align:center;">Aplikasi tidak ditemukan.</p>'; return; }
            apps.forEach(app => {
                const iconUrl = URL.createObjectURL(app.blob);
                const div = document.createElement('div');
                div.className = 'app-item';
                div.onclick = () => showEditAppNameModal(app.id, app.name);
                div.innerHTML = `<div class="app-icon-box"><img src="${iconUrl}"></div><div class="app-name">${app.name}</div>`;
                container.appendChild(div);
            });
        }

        function filterRenameApps() {
            const query = document.getElementById('renameAppSearch').value.toLowerCase();
            const filtered = renameAppData.filter(app => app.name.toLowerCase().includes(query));
            renderRenameAppList(filtered);
        }

        function showEditAppNameModal(appId, currentName) {
            appToRename = appId;
            document.getElementById('editAppNameInput').value = currentName;
            showModal('modalEditAppName');
        }

        async function processEditAppName() {
            const newName = document.getElementById('editAppNameInput').value.trim();
            if(newName && appToRename) {
                await updateMediaNameInDB(appToRename, newName);
                closeModal();
                loadRenameAppList();
                loadApps();
            }
        }

        function filterApps() {
            const query = document.getElementById('appSearchInput').value.toLowerCase();
            const filtered = allAppsList.filter(app => app.name.toLowerCase().includes(query));
            renderApps(filtered);
        }

        let isAppOpen = false;
        function openWebApp(url) {
            const container = document.getElementById('appViewContainer');
            const frame = document.getElementById('appFrame');
            frame.src = url;
            container.style.display = 'flex';
            isAppOpen = true;
        }
        function closeWebApp() {
            const container = document.getElementById('appViewContainer');
            const frame = document.getElementById('appFrame');
            frame.src = ''; 
            container.style.display = 'none';
            isAppOpen = false;
        }

        let currentUser = null;
        let accounts = {};
        let currentAlbum = ""; 
        let userAlbums = []; 
        let musicAlbums = {};
        let currentMusicAlbum = null;

        const defaultUser = {
            saldo: 0, history: [],
            schedule: { "Senin": ["-","-"], "Selasa": ["-","-"], "Rabu": ["-","-"], "Kamis": ["-","-"], "Jumat": ["-","-"] },
            targets: [], bio: "Halo dunia!", profilePic: "https://via.placeholder.com/100"
        };

        document.addEventListener('DOMContentLoaded', async function() {
            const progress = document.getElementById('splashProgress');
            progress.style.width = "100%";
            await initDB();
            loadTextData();
            checkSession();
            renderCalendar(currentMonth, currentYear);
            renderUI();
            loadApps();
            
            setTimeout(() => {
                const splash = document.getElementById('splash-screen');
                splash.style.opacity = '0';
                setTimeout(() => { splash.style.visibility = 'hidden'; }, 800);
            }, 1500);
            document.querySelector('.sidebar').addEventListener('click', (e) => e.stopPropagation());
            
            const audio = document.getElementById('globalAudio');
            const slider = document.getElementById('audioSlider');
            audio.addEventListener('timeupdate', () => {
                if(!audio.duration) return;
                const curr = audio.currentTime;
                const dur = audio.duration;
                slider.max = Math.floor(dur);
                slider.value = Math.floor(curr);
                document.getElementById('currTime').innerText = formatTime(curr);
                document.getElementById('totalTime').innerText = formatTime(dur);
            });
            slider.addEventListener('input', () => { audio.currentTime = slider.value; });
        });

        function formatTime(s) {
            if(isNaN(s)) return "0:00";
            const m = Math.floor(s / 60);
            const sec = Math.floor(s % 60);
            return `${m}:${sec < 10 ? '0' : ''}${sec}`;
        }

        function loadTextData() { 
            const data = localStorage.getItem('dixz_accounts_text'); 
            accounts = data ? JSON.parse(data) : {}; 
        }
        function saveTextData() { 
            localStorage.setItem('dixz_accounts_text', JSON.stringify(accounts)); 
            // Sync saldo ke localStorage terpisah agar bisa dibaca halaman profil
            if(currentUser && accounts[currentUser]) {
                localStorage.setItem(`dixz_saldo_${currentUser}`, accounts[currentUser].saldo || '0');
            }
            renderUI(); 
        }
        function checkSession() { 
            const sess = localStorage.getItem('dixz_session'); 
            if(sess && accounts[sess]) {
                currentUser = sess;
                initAlbums();
                initMusicAlbums();
            }
        }

        function initAlbums() {
            const storedAlbums = localStorage.getItem(`dixz_albums_${currentUser}`);
            if(storedAlbums) userAlbums = JSON.parse(storedAlbums);
            else { userAlbums = [currentUser]; localStorage.setItem(`dixz_albums_${currentUser}`, JSON.stringify(userAlbums)); }
            currentAlbum = userAlbums[0];
        }

        function initMusicAlbums() {
            const stored = localStorage.getItem(`dixz_music_albums_${currentUser}`);
            musicAlbums = stored ? JSON.parse(stored) : {};
        }

        function saveMusicAlbums() {
            localStorage.setItem(`dixz_music_albums_${currentUser}`, JSON.stringify(musicAlbums));
            renderMusicAlbums();
            // Also refresh page view if open
            if (document.getElementById('musicPageOverlay').style.display === 'flex') {
                renderMusicAlbumsOnPage();
            }
        }

        function renderAlbumTabs() {
            const container = document.getElementById('albumHeader');
            container.innerHTML = '';
            userAlbums.forEach(album => {
                const span = document.createElement('span');
                span.className = `album-tab ${album === currentAlbum ? 'active' : ''}`;
                span.innerText = album;
                let pressTimer;
                const startPress = () => { pressTimer = setTimeout(() => showRenameAlbumModal(album), 1000); };
                const cancelPress = () => clearTimeout(pressTimer);
                span.onmousedown = startPress; span.onmouseup = cancelPress; span.onmouseleave = cancelPress;
                span.ontouchstart = startPress; span.ontouchend = cancelPress;
                span.onclick = () => switchAlbum(album);
                container.appendChild(span);
            });
            const addBtn = document.createElement('span');
            addBtn.className = 'album-tab album-add-btn';
            addBtn.innerText = '+ Tambah Album';
            addBtn.onclick = () => { document.getElementById('newAlbumNameInput').value = ""; showModal('modalCreateAlbum'); };
            container.appendChild(addBtn);
        }

        function switchAlbum(albumName) { currentAlbum = albumName; renderAlbumTabs(); loadMedia(); }

        function processCreateAlbum() {
            const name = document.getElementById('newAlbumNameInput').value.trim();
            if(name) {
                if(userAlbums.includes(name)) return alert("Nama album sudah ada!");
                userAlbums.push(name);
                localStorage.setItem(`dixz_albums_${currentUser}`, JSON.stringify(userAlbums));
                switchAlbum(name); closeModal();
            }
        
            if (document.getElementById('galleryPageOverlay').style.display === 'flex') {
                renderAlbumTabsOnPage();
            }
        }

        let albumToRename = "";
        function showRenameAlbumModal(albumName) {
            albumToRename = albumName;
            document.getElementById('renameAlbumInput').value = albumName;
            showModal('modalRenameAlbum');
        }

        async function processRenameAlbum() {
            const newName = document.getElementById('renameAlbumInput').value.trim();
            if(newName && newName !== albumToRename) {
                if(userAlbums.includes(newName)) return alert("Nama album sudah digunakan!");
                const index = userAlbums.indexOf(albumToRename);
                if(index !== -1) userAlbums[index] = newName;
                localStorage.setItem(`dixz_albums_${currentUser}`, JSON.stringify(userAlbums));
                await updateMediaAlbum(currentUser, albumToRename, newName);
                if(currentAlbum === albumToRename) currentAlbum = newName;
                if(currentAlbumPage === albumToRename) currentAlbumPage = newName;
                closeModal();
                // Refresh langsung di halaman galeri jika terbuka
                if (document.getElementById('galleryPageOverlay').style.display === 'flex') {
                    renderAlbumTabsOnPage();
                    loadMediaOnPage();
                }
                renderAlbumTabs(); loadMedia();
            } else closeModal();
        }

        async function confirmDeleteAlbum() {
            if(confirm(`Hapus album "${albumToRename}" beserta semua foto/video di dalamnya?`)) {
                userAlbums = userAlbums.filter(a => a !== albumToRename);
                if(userAlbums.length === 0) userAlbums.push(currentUser);
                localStorage.setItem(`dixz_albums_${currentUser}`, JSON.stringify(userAlbums));
                const items = await getMediaFromDB(currentUser);
                const transaction = db.transaction(["media"], "readwrite");
                const store = transaction.objectStore("media");
                items.forEach(item => { if((item.album || currentUser) === albumToRename) store.delete(item.id); });
                if(currentAlbum === albumToRename) currentAlbum = userAlbums[0];
                if(currentAlbumPage === albumToRename) currentAlbumPage = userAlbums[0];
                closeModal();
                // Refresh langsung
                if (document.getElementById('galleryPageOverlay').style.display === 'flex') {
                    renderAlbumTabsOnPage();
                    loadMediaOnPage();
                }
                renderAlbumTabs(); loadMedia();
            }
        }

        function register() {
            const u = document.getElementById('regUser').value.trim();
            const p = document.getElementById('regPass').value;
            if(!u || !p) return alert("Isi semua!");
            // REVISI: Mengizinkan username apapun (menimpa jika ada)
            accounts[u] = { password: p, ...JSON.parse(JSON.stringify(defaultUser)) };
            saveTextData(); alert("Berhasil! Silakan Login"); switchModal('modalLogin');
        }

        function login() {
            const u = document.getElementById('loginUser').value.trim();
            const p = document.getElementById('loginPass').value;
            if(accounts[u] && accounts[u].password === p) {
                currentUser = u; localStorage.setItem('dixz_session', u);
                closeModal(); location.reload(); 
            } else alert("Salah username/password");
        }

        function doLogout() {
            if(confirm("Yakin ingin keluar?")) {
                currentUser = null; localStorage.removeItem('dixz_session');
                stopMusicManual(); location.reload();
            }
        }

        function checkAuth(modalId, cb) {
            if(!currentUser) showModal('modalLogin');
            else {
                if(modalId === 'modalWithdraw') showWithdrawModal();
                else if(modalId) showModal(modalId);
                if(cb) cb();
            }
        }

        let currentMonth = new Date().getMonth();
        let currentYear = new Date().getFullYear();
        const holidays2026 = { "1-1": "Tahun Baru 2026", "17-2": "Tahun Baru Imlek 2577", "19-3": "Hari Raya Nyepi 1948", "20-3": "Idul Fitri 1447H", "21-3": "Cuti Bersama Idul Fitri", "3-4": "Wafat Isa Al Masih", "1-5": "Hari Buruh Internasional", "14-5": "Kenaikan Isa Al Masih", "27-5": "Idul Adha 1447H", "31-5": "Hari Raya Waisak 2570", "1-6": "Hari Lahir Pancasila", "16-6": "Tahun Baru Islam 1448H", "17-8": "HUT RI ke-81", "25-8": "Maulid Nabi Muhammad SAW", "25-12": "Hari Raya Natal" };
        const fixedHolidays = { "1-1": "Tahun Baru", "1-5": "Hari Buruh", "1-6": "Pancasila", "17-8": "Kemerdekaan", "25-12": "Natal" };

        function changeMonth(dir) {
            currentMonth += dir;
            if (currentMonth > 11) { currentMonth = 0; currentYear++; }
            if (currentMonth < 0) { currentMonth = 11; currentYear--; }
            renderCalendar(currentMonth, currentYear);
        }

        // --- REVISI KALENDER (MOTIVASI) ---
        function renderCalendar(month, year) {
            const monthNames = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
            document.getElementById('calMonthYear').innerText = `${monthNames[month]} ${year}`;
            const firstDay = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const grid = document.getElementById('calGrid');
            const desc = document.getElementById('holidayDesc');
            grid.innerHTML = ''; desc.innerText = '';
            
            for(let i=0; i<firstDay; i++) grid.innerHTML += `<div></div>`;
            
            for(let i=1; i<=daysInMonth; i++) {
                const dateKey = `${i}-${month+1}`;
                let holidayName = "";
                if(year === 2026 && holidays2026[dateKey]) holidayName = holidays2026[dateKey];
                else if(fixedHolidays[dateKey]) holidayName = fixedHolidays[dateKey];
                
                const checkDate = new Date(year, month, i);
                const isSunday = checkDate.getDay() === 0;
                let classes = "cal-date";
                const today = new Date();
                const isToday = i === today.getDate() && month === today.getMonth() && year === today.getFullYear();
                
                if(isToday) classes += " today";
                if(isSunday || holidayName) classes += " holiday";
                
                // Determine description text
                let descriptionText = "";
                if(holidayName) descriptionText = `Libur: ${holidayName}`;
                else if(isSunday) descriptionText = "Hari Minggu";
                else {
                    // Logic Motivasi Harian (Hash sederhana berdasarkan tanggal agar konsisten seharian)
                    const quoteIndex = (i + month + year) % dailyMotivations.length;
                    descriptionText = dailyMotivations[quoteIndex];
                }

                if(isToday) desc.innerText = descriptionText;
                
                // Pass the specific description to onclick
                // Escape single quotes in description for the onclick string
                const safeDesc = descriptionText.replace(/'/g, "\\'");
                grid.innerHTML += `<div class="${classes}" onclick="document.getElementById('holidayDesc').innerText = '${safeDesc}'">${i}</div>`;
            }
        }

        function renderUI() {
            if(currentUser) {
                const data = accounts[currentUser];
                // welcomeText sudah disembunyikan (display:none)
                document.getElementById('displaySaldo').innerText = data.saldo.toLocaleString();
                let percent = data.saldo > 0 ? `+${((data.saldo / 1000) * 1).toFixed(0)}%` : "0%";
                document.getElementById('walletPercent').innerText = percent;
                document.getElementById('loggedInBlock').classList.remove('hidden'); setTimeout(updateProfileStats, 100);
                document.getElementById('notLoggedInBlock').classList.add('hidden');
                document.getElementById('profileName').innerText = currentUser;
                document.getElementById('profileBio').innerText = data.bio;
                document.getElementById('profileImg').src = data.profilePic;
                const tList = document.getElementById('targetList');
                tList.innerHTML = data.targets.length ? data.targets.map((t,i) => `<div style="display:flex;justify-content:space-between;border-bottom:1px dashed #ccc;padding:5px;"><span>${t}</span><span style="color:red;cursor:pointer" onclick="delTarget(${i})">X</span></div>`).join('') : '<p style="text-align:center;">Kosong</p>';
                renderSchedule(data.schedule);
                renderAlbumTabs(); 
                loadMedia(); 
            } else {
                document.getElementById('loggedInBlock').classList.add('hidden');
                document.getElementById('notLoggedInBlock').classList.remove('hidden');
                renderSchedule(defaultUser.schedule);
            }
        }

        function renderSchedule(s) {
            const grid = document.getElementById('scheduleGrid');
            grid.innerHTML = '';
            ["Senin","Selasa","Rabu","Kamis","Jumat"].forEach(d=>grid.innerHTML+=`<div class="schedule-header">${d}</div>`);
            let max = 2;
            for(let k in s) if(s[k].length > max) max = s[k].length;
            for(let i=0; i<max; i++) { ["Senin","Selasa","Rabu","Kamis","Jumat"].forEach(d => { grid.innerHTML += `<div class="schedule-cell">${s[d][i] || ""}</div>`; }); }
        }

        async function processUpload(e, type) {
            if(!currentUser) return;
            const files = e.target.files;
            if(files.length === 0) return;
            const file = files[0];
            const name = type === 'music' ? (prompt("Judul Lagu:", file.name) || file.name) : file.name;
            await saveMediaToDB(currentUser, type, file, name, currentAlbum);
            alert("Sukses! Media berhasil diupload.");
            closeModal();
            loadMedia();
        }

        let selectedMediaId = null;
        let selectedMediaUrl = null;
        let selectedMediaType = null;
        
        let allMusicList = [];
        let currentPlaylist = [];
        let currentTrackIndex = -1;
        let allGalleryItems = [];

        async function loadMedia() {
            if(!currentUser) return;
            const items = await getMediaFromDB(currentUser);
            const galleryDiv = document.getElementById('mediaGallery');
            galleryDiv.innerHTML = '';
            
            allMusicList = [];
            currentPlaylist = [];
            allGalleryItems = [];

            items.forEach(item => {
                const url = URL.createObjectURL(item.blob);
                if(item.type === 'music') {
                    allMusicList.push({ name: item.name, url: url, id: item.id });
                } 
                else if (item.type === 'photo' || item.type === 'video') {
                    const itemAlbum = item.album || currentUser;
                    if(itemAlbum === currentAlbum) {
                        allGalleryItems.push({ ...item, url: url });
                    }
                }
            });

            currentPlaylist = allMusicList;
            renderMusicList(allMusicList);

            if(allGalleryItems.length === 0) galleryDiv.innerHTML = '<p style="grid-column:span 2; text-align:center; padding:20px;">Album ini kosong.</p>';

            allGalleryItems.forEach(item => {
                const div = document.createElement('div');
                div.className = 'media-box';
                
                // Variabel untuk membedakan scroll dan klik
                let touchStartY = 0;
                let isScrolling = false;
                let pressTimer = null;
                
                const startPress = (e) => { 
                    touchStartY = e.touches ? e.touches[0].clientY : e.clientY;
                    isScrolling = false;
                    // Timer untuk menu (long press)
                    pressTimer = setTimeout(() => { 
                        if(!isScrolling) showMediaMenu(item.id, item.type, item.url); 
                    }, 800); 
                };
                
                const handleMove = (e) => {
                    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
                    if(Math.abs(clientY - touchStartY) > 10) {
                        isScrolling = true;
                        clearTimeout(pressTimer);
                    }
                };
                
                const handleRelease = (e) => {
                    clearTimeout(pressTimer);
                    // Jika bukan scrolling dan bukan long press menu, ini adalah klik untuk pratinjau
                    if(!isScrolling) {
                        viewMedia(item.id);
                    }
                    isScrolling = false;
                };

                div.addEventListener('mousedown', startPress);
                div.addEventListener('mousemove', handleMove);
                div.addEventListener('mouseup', handleRelease);
                div.addEventListener('mouseleave', () => { clearTimeout(pressTimer); isScrolling = false; });
                
                div.addEventListener('touchstart', startPress, {passive:true});
                div.addEventListener('touchmove', handleMove, {passive:true});
                div.addEventListener('touchend', handleRelease);
                
                if (item.type === 'photo') {
                    div.innerHTML = `<img src="${item.url}">`;
                } else if (item.type === 'video') {
                    const vidId = `vid_preview_${item.id}`;
                    div.innerHTML = `
                        <video id="${vidId}" src="${item.url}#t=0.1" preload="metadata" playsinline muted></video>
                        <div class="video-overlay-bar">
                            <svg class="vid-icon" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                            <div class="vid-progress"><div class="vid-progress-fill"></div></div>
                            <span class="vid-time" id="dur_${vidId}">--:--</span>
                        </div>`;
                    
                    setTimeout(() => {
                        const vidEl = document.getElementById(vidId);
                        if(vidEl) {
                            vidEl.onloadedmetadata = () => {
                                document.getElementById(`dur_${vidId}`).innerText = formatTime(vidEl.duration);
                            };
                        }
                    }, 100);
                }
                galleryDiv.appendChild(div);
            });
        }

        function renderMusicList(playlist, containerId = 'musicList') {
            const musicDiv = document.getElementById(containerId);
            musicDiv.innerHTML = '';
            if(playlist.length === 0) musicDiv.innerHTML = "<p>Tidak ada musik</p>";
            playlist.forEach((track, index) => {
                 const audTemp = new Audio(track.url);
                 const durId = `aud_dur_${track.id}`;
                 audTemp.onloadedmetadata = () => {
                     const el = document.getElementById(durId);
                     if(el) el.innerText = formatTime(audTemp.duration);
                 };

                 musicDiv.innerHTML += `
                    <div class="music-item">
                        <button class="btn-play-stylish" onclick="playTrack(${index}, '${containerId}')"><svg style="width:18px;height:18px;fill:var(--text-color);" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg></button>
                        <div class="music-info-box">${track.name}</div>
                        <span class="music-duration-text" id="${durId}">...</span>
                        <button class="btn-options" onclick="confirmDeleteMusic(${track.id})"><svg style="width:18px;height:18px;stroke:var(--text-color);fill:none;stroke-width:2.5;" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg></button>
                    </div>`;
            });
        }

        function toggleMusicView(forceView) {
            const main = document.getElementById('musicMainView');
            const album = document.getElementById('musicAlbumView');
            const btn = document.querySelector('.btn-album');
            
            if(forceView === 'albums' || !album.classList.contains('hidden')) {
                if (!forceView) {
                   album.classList.add('hidden');
                   main.classList.remove('hidden');
                   btn.innerText = "ALBUM";
                   currentPlaylist = allMusicList; 
                } else {
                   album.classList.remove('hidden');
                   main.classList.add('hidden');
                   btn.innerText = "LIST LAGU";
                   renderMusicAlbums();
                }
            } else {
                main.classList.add('hidden');
                album.classList.remove('hidden');
                btn.innerText = "LIST LAGU";
                renderMusicAlbums();
            }
        }

        function renderMusicAlbums() {
            const container = document.getElementById('musicAlbumListContainer');
            container.innerHTML = '';
            
            const createBtn = document.createElement('div');
            createBtn.className = 'music-album-card create-album-card';
            createBtn.innerHTML = '<span style="font-size:2rem;">+</span><span style="font-size:0.7rem; font-weight:bold;">Buat Baru</span>';
            createBtn.onclick = () => { document.getElementById('newMusicAlbumNameInput').value = ""; showModal('modalCreateMusicAlbum'); };
            container.appendChild(createBtn);

            for (let albumName in musicAlbums) {
                const div = document.createElement('div');
                div.className = 'music-album-card';
                const albumCoverKey = `dixz_music_album_cover_${currentUser}_${albumName}`;
                const albumCover = localStorage.getItem(albumCoverKey);
                if(albumCover) {
                    div.style.backgroundImage = `url('${albumCover}')`;
                    div.style.backgroundSize = 'cover';
                    div.style.backgroundPosition = 'center';
                    div.innerHTML = `<div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(to top,rgba(0,0,0,0.75) 0%,transparent 100%);border-radius:0 0 13px 13px;padding:6px 6px 8px 6px;"><span style="font-size:0.78rem;font-weight:bold;text-align:center;color:#fff;display:block;text-shadow:0 1px 3px rgba(0,0,0,0.8);">${albumName}</span></div>`;
                } else {
                    div.innerHTML = `<svg class="icon-comic" style="width:40px;height:40px;margin-bottom:5px;"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg><span style="font-size:0.8rem; font-weight:bold; text-align:center;">${albumName}</span>`;
                }
                
                let pressTimer;
                const albumNameCopy = albumName;
                const startPress = () => { pressTimer = setTimeout(() => showMusicAlbumOptions(albumNameCopy), 700); };
                const cancelPress = () => clearTimeout(pressTimer);
                
                div.onmousedown = startPress; div.onmouseup = cancelPress; div.onmouseleave = cancelPress;
                div.ontouchstart = startPress; div.ontouchend = cancelPress;
                div.onclick = () => openMusicAlbum(albumNameCopy);

                container.appendChild(div);
            }
        }

        function processCreateMusicAlbum() {
            const name = document.getElementById('newMusicAlbumNameInput').value.trim();
            if(name) {
                if(musicAlbums[name]) return alert("Nama album sudah ada!");
                musicAlbums[name] = [];
                saveMusicAlbums(); closeModal(); renderMusicAlbums();
                if (document.getElementById('musicPageOverlay').style.display === 'flex') {
                    renderMusicAlbumsOnPage();
                }
            }
        }

        function confirmDeleteMusicAlbum(name) {
            document.getElementById('delGenericTitle').innerText = "Hapus Album Musik?";
            document.getElementById('delGenericDesc').innerText = `Hapus "${name}" dan isinya?`;
            document.getElementById('btnConfirmDelGeneric').onclick = () => {
                delete musicAlbums[name];
                saveMusicAlbums();
                closeModal();
                renderMusicAlbums();
                // Refresh halaman musik jika sedang terbuka
                if (document.getElementById('musicPageOverlay').style.display === 'flex') {
                    renderMusicAlbumsOnPage();
                    document.getElementById('selectedAlbumContentPage').classList.add('hidden');
                }
                const sc = document.getElementById('selectedAlbumContent');
                if(sc) sc.classList.add('hidden');
            };
            showModal('modalDeleteGeneric');
        }

        function openMusicAlbum(name) {
            currentMusicAlbum = name;
            document.getElementById('currentMusicAlbumName').innerText = name;
            document.getElementById('selectedAlbumContent').classList.remove('hidden');
            
            const trackIds = musicAlbums[name];
            const albumTracks = allMusicList.filter(m => trackIds.includes(m.id));
            
            currentPlaylist = albumTracks;
            renderMusicList(albumTracks, 'musicAlbumTracks');
        }

        function openSelectMusicModal() {
            const list = document.getElementById('selectMusicList');
            list.innerHTML = '';
            allMusicList.forEach(m => {
                const isAdded = musicAlbums[currentMusicAlbum].includes(m.id);
                list.innerHTML += `
                    <div style="display:flex; align-items:center; padding:5px; border-bottom:1px solid #eee;">
                        <input type="checkbox" class="music-select-cb" value="${m.id}" ${isAdded ? 'checked disabled' : ''}>
                        <span style="margin-left:10px; font-size:0.9rem;">${m.name}</span>
                        <span style="margin-left:auto; cursor:pointer; color:blue;" onclick="new Audio('${m.url}').play()"><svg style="width:14px;height:14px;fill:blue;" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg></span>
                    </div>
                `;
            });
            showModal('modalSelectMusic');
        }

        function addSelectedMusicToAlbum() {
            const checkboxes = document.querySelectorAll('.music-select-cb:checked:not([disabled])');
            checkboxes.forEach(cb => {
                musicAlbums[currentMusicAlbum].push(parseInt(cb.value));
            });
            saveMusicAlbums();
            closeModal();
            openMusicAlbum(currentMusicAlbum);
        }

        function confirmDeleteMusic(id) {
            document.getElementById('delGenericTitle').innerText = "Hapus Musik?";
            document.getElementById('delGenericDesc').innerText = "Hapus lagu ini dari daftar?";
            document.getElementById('btnConfirmDelGeneric').onclick = () => {
                 if(document.getElementById('musicAlbumView').classList.contains('hidden')) {
                     deleteMediaFromDB(id).then(() => {
                         for(let k in musicAlbums) { musicAlbums[k] = musicAlbums[k].filter(x => x !== id); }
                         saveMusicAlbums();
                         loadMedia();
                         closeModal();
                     });
                } else {
                    musicAlbums[currentMusicAlbum] = musicAlbums[currentMusicAlbum].filter(x => x !== id);
                    saveMusicAlbums();
                    openMusicAlbum(currentMusicAlbum);
                    closeModal();
                }
            };
            showModal('modalDeleteGeneric');
        }

        function filterMusic() {
            const query = document.getElementById('musicSearchInput').value.toLowerCase();
            const filtered = currentPlaylist.filter(track => track.name.toLowerCase().includes(query));
            renderMusicList(filtered, document.getElementById('musicAlbumView').classList.contains('hidden') ? 'musicList' : 'musicAlbumTracks');
        }

        function showMediaMenu(id, type, url) {
            selectedMediaId = id;
            selectedMediaType = type;
            selectedMediaUrl = url;
            showModal('modalMediaOptions');
        }

        async function deleteCurrentMedia() {
            await deleteMediaFromDB(selectedMediaId);
            closeModal();
            loadMedia();
        }

        const audio = document.getElementById('globalAudio');

        function updateMediaSessionMetadata() {
            if ('mediaSession' in navigator) {
                const track = currentPlaylist[currentTrackIndex];
                if (!track) return;
                navigator.mediaSession.metadata = new MediaMetadata({
                    title: track.name,
                    artist: 'dixzAPK',
                    album: currentMusicAlbum || 'Playlist Musik',
                });
                navigator.mediaSession.setActionHandler('play', () => { audio.play(); updatePlayIcon(); });
                navigator.mediaSession.setActionHandler('pause', () => { audio.pause(); updatePlayIcon(); });
                navigator.mediaSession.setActionHandler('previoustrack', () => {
                    let prev = currentTrackIndex - 1;
                    if (prev < 0) prev = currentPlaylist.length - 1;
                    playTrackDirect(prev);
                });
                navigator.mediaSession.setActionHandler('nexttrack', () => {
                    let next = currentTrackIndex + 1;
                    if (next >= currentPlaylist.length) next = 0;
                    playTrackDirect(next);
                });
                navigator.mediaSession.setActionHandler('stop', () => { audio.pause(); updatePlayIcon(); });
            }
        }

        function playTrackDirect(index) {
            if(index >= currentPlaylist.length) index = 0;
            if(index < 0) return;
            currentTrackIndex = index;
            const track = currentPlaylist[index];
            audio.src = track.url;
            audio.play();
            document.getElementById('audioBar').style.display = 'flex';
            document.getElementById('audioTitle').innerText = track.name;
            updatePlayIcon();
            updateMediaSessionMetadata();
        }

        function playTrack(index, containerId) {
            // Jika dari list semua musik, set playlist ke allMusicList
            if(containerId === 'musicList' || containerId === 'musicListPage') {
                currentPlaylist = allMusicList;
            }
            // Jika dari album tracks, currentPlaylist sudah diset ke albumTracks saat openMusicAlbumOnPage
            // Jadi tidak perlu diubah
            
            if(index >= currentPlaylist.length) index = 0;
            if(index < 0) return;
            currentTrackIndex = index;
            const track = currentPlaylist[index];
            audio.src = track.url;
            audio.play();
            document.getElementById('audioBar').style.display = 'flex';
            document.getElementById('audioTitle').innerText = track.name;
            updatePlayIcon();
            updateMediaSessionMetadata();
        }
        audio.onended = function() {
            if(currentPlaylist.length > 0) {
                let nextIndex = currentTrackIndex + 1;
                if(nextIndex >= currentPlaylist.length) nextIndex = 0;
                const track = currentPlaylist[nextIndex];
                if(track) {
                    currentTrackIndex = nextIndex;
                    audio.src = track.url;
                    audio.play().catch(() => {});
                    document.getElementById('audioTitle').innerText = track.name;
                    updateMediaSessionMetadata();
                    // TIDAK menampilkan audioBar saat auto-next
                }
            }
        };
        audio.addEventListener('play', () => { if('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing'; updatePlayIcon(); });
        audio.addEventListener('pause', () => { if('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused'; updatePlayIcon(); });
        function togglePlay() { if(audio.paused) audio.play(); else audio.pause(); updatePlayIcon(); }
        function stopMusicManual() { audio.pause(); document.getElementById('audioBar').style.display = 'none'; }
        function hideAudioBar() { document.getElementById('audioBar').style.display = 'none'; }
        function updatePlayIcon() { document.getElementById('playIcon').innerHTML = audio.paused ? '<polygon points="5 3 19 12 5 21 5 3"></polygon>' : '<rect x="6" y="6" width="4" height="12"/><rect x="14" y="6" width="4" height="12"/>'; }

        function viewMedia(startId) {
            const overlay = document.getElementById('previewOverlay');
            const carousel = document.getElementById('previewCarousel');
            carousel.innerHTML = '';
            let startIndex = 0;
            allGalleryItems.forEach((item, index) => {
                if(item.id === startId) startIndex = index;
                const div = document.createElement('div');
                div.className = 'preview-item';
                if(item.type === 'photo') div.innerHTML = `<img src="${item.url}">`;
                else div.innerHTML = `<video src="${item.url}#t=0.1" preload="metadata" playsinline controls></video>`;
                carousel.appendChild(div);
            });
            overlay.style.display = 'flex';
            setTimeout(() => {
                const items = document.querySelectorAll('.preview-item');
                if(items[startIndex]) items[startIndex].scrollIntoView();
                initScrollObserver();
            }, 100);
        }

        function initScrollObserver() {
            const options = { root: document.getElementById('previewCarousel'), threshold: 0.7 };
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    const vid = entry.target.querySelector('video');
                    if(vid) { if(entry.isIntersecting) vid.play(); else { vid.pause(); vid.currentTime = 0; } }
                });
            }, options);
            document.querySelectorAll('.preview-item').forEach(item => observer.observe(item));
        }

        function closePreview() {
            document.querySelectorAll('.preview-item video').forEach(v => v.pause());
            document.getElementById('previewOverlay').style.display = 'none';
            document.getElementById('previewCarousel').innerHTML = '';
        }

        function showWithdrawModal() {
            if(!currentUser) return showModal('modalLogin');
            document.getElementById('withdrawBalance').innerText = "Rp " + accounts[currentUser].saldo.toLocaleString();
            showModal('modalWithdraw');
        }

        function processWithdraw() {
            const amount = parseInt(document.getElementById('withdrawAmount').value);
            const currentSaldo = accounts[currentUser].saldo;
            if(!amount || amount <= 0) return alert("Masukkan jumlah yang valid!");
            if(amount > currentSaldo) return alert("Saldo tidak cukup!");
            accounts[currentUser].saldo -= amount;
            const date = new Date();
            const dateStr = date.toLocaleDateString() + " " + date.toLocaleTimeString();
            accounts[currentUser].history.unshift(`- Rp ${amount.toLocaleString()} (Tarik Tunai) - ${dateStr}`);
            saveTextData();
            const strukHTML = `<div class="receipt-box"><h3>STRUK PENARIKAN</h3><p>-------------------------</p><p style="font-weight:bold;">Rp ${amount.toLocaleString()}</p><p>-------------------------</p><p style="font-size:0.8rem;">Tanggal: ${dateStr}</p><p style="font-size:0.8rem;">Sisa Saldo: Rp ${accounts[currentUser].saldo.toLocaleString()}</p><br><p style="font-size:0.7rem; font-style:italic;">Transaksi Berhasil</p></div>`;
            document.getElementById('receiptContent').innerHTML = strukHTML;
            closeModal();
            setTimeout(() => { document.getElementById('modalReceipt').style.display = 'block'; document.getElementById('overlay').style.display = 'block'; }, 300);
        }

        function addMoney() { const v = parseInt(document.getElementById('inputAmount').value); if(v) { accounts[currentUser].saldo += v; accounts[currentUser].history.unshift(`+ Rp ${v.toLocaleString()} (${new Date().toLocaleDateString()})`); saveTextData(); closeModal(); } }
        function saveMapel() { const d = document.getElementById('daySelect').value; const v = document.getElementById('mapelInput').value; if(v) { accounts[currentUser].schedule[d] = v.split(','); saveTextData(); closeModal(); } }
        function addTarget() { const v = document.getElementById('targetInput').value; if(v) { accounts[currentUser].targets.push(v); saveTextData(); closeModal(); } }
        function delTarget(i) { accounts[currentUser].targets.splice(i,1); saveTextData(); }

        let tempImg = null;
        function openEditProfileModal() {
            if(!currentUser) return;
            const d = accounts[currentUser];
            document.getElementById('editUsernameInput').value = currentUser;
            document.getElementById('editBioInput').value = d.bio;
            document.getElementById('previewEditImg').src = d.profilePic;
            tempImg = d.profilePic;
            showModal('modalEditProfile');
        }
        function previewProfilePic(e) { const r = new FileReader(); r.onload = (ev) => { tempImg = ev.target.result; document.getElementById('previewEditImg').src = tempImg; }; if(e.target.files[0]) r.readAsDataURL(e.target.files[0]); }
        
        // --- REVISI SAVE PROFILE (NO RELOAD + MIGRASI DATA) ---
        async function saveProfileChanges() {
            const newName = document.getElementById('editUsernameInput').value.trim();
            if(!newName) return;
            
            // Simpan Bio & Gambar dulu ke object currentUser sebelum di-clone
            accounts[currentUser].bio = document.getElementById('editBioInput').value;
            accounts[currentUser].profilePic = tempImg;

            if(newName !== currentUser) {
                // REVISI: Hapus cek "Username sudah dipakai". Langsung timpa.
                // 1. Pindahkan data akun ke key baru
                accounts[newName] = accounts[currentUser];
                
                // 2. Migrasi data di IndexedDB (Media)
                await migrateMediaUser(currentUser, newName);
                
                // 3. Hapus data akun lama
                delete accounts[currentUser];
                
                // 4. Update session storage
                localStorage.setItem('dixz_session', newName);
                
                // 5. Update Variable Global
                currentUser = newName;
                
                // 6. Update UI Tanpa Reload
                document.getElementById('profileName').innerText = currentUser;
                
                // Update Album references if needed (userAlbums logic)
                // (Assuming userAlbums tracks currentUser string)
                userAlbums = userAlbums.map(a => a === currentUser ? newName : a); // This logic needs initAlbums check
                initAlbums(); // Re-init albums with new user
            }

            saveTextData(); 
            closeModal();
            // alert("Profil diperbarui!"); // Optional feedback
        
            setTimeout(updateProfileStats, 100);
        }

        // ===== BACKUP DATA SYSTEM =====
        let pendingBackupType = null;

        function openBackupModal() {
            if(!currentUser) return;
            closeAll();
            showModal('modalBackupOptions');
        }

        function confirmBackup(type) {
            pendingBackupType = type;
            const labels = { musik: 'musik', galeri: 'galeri', semua: 'semua data (termasuk streak, saldo, jadwal, dll)' };
            document.getElementById('backupConfirmText').innerText = 'Apakah kamu ingin mendownload ' + labels[type] + '?';
            closeAll();
            showModal('modalBackupConfirm');
        }

        async function doBackupDownload() {
            closeModal();
            if(!currentUser || !pendingBackupType) return;
            const type = pendingBackupType;
            pendingBackupType = null;
            const mediaItems = await getMediaFromDB(currentUser);
            const mediaExport = [];

            for (const item of mediaItems) {
                const includeMusik = (type === 'musik' && item.type === 'music');
                const includeGaleri = (type === 'galeri' && (item.type === 'photo' || item.type === 'video'));
                const includeSemua = (type === 'semua');
                if(includeMusik || includeGaleri || includeSemua) {
                    const base64 = await blobToBase64(item.blob);
                    mediaExport.push({ type: item.type, name: item.name, data: base64, mime: item.blob.type, url: item.url || '', album: item.album || '' });
                }
            }

            let exportObj = { media: mediaExport };
            if(type === 'semua') exportObj.user = accounts[currentUser];

            const blob = new Blob([JSON.stringify(exportObj)], {type: "application/json"});
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'Backup_' + type + '_' + currentUser + '.json';
            a.click();
        }

        async function exportData() {
            openBackupModal();
        }

        function blobToBase64(blob) { return new Promise((resolve) => { const reader = new FileReader(); reader.onloadend = () => resolve(reader.result); reader.readAsDataURL(blob); }); }
        function base64ToBlob(base64) { const arr = base64.split(','), mime = arr[0].match(/:(.*?);/)[1], bstr = atob(arr[1]); let n = bstr.length, u8arr = new Uint8Array(n); while(n--) u8arr[n] = bstr.charCodeAt(n); return new Blob([u8arr], {type: mime}); }

        async function importData() {
            const file = document.getElementById('importFile').files[0];
            if(!file) return;
            document.getElementById('btnRestore').innerText = "Sedang Memproses...";
            const reader = new FileReader();
            reader.onload = async function(e) {
                try {
                    const json = JSON.parse(e.target.result);
                    if(!currentUser) currentUser = "RestoredUser";

                    // Gabungkan data user (jangan timpa, merge)
                    if(json.user) {
                        if(!accounts[currentUser]) accounts[currentUser] = json.user;
                        else {
                            // Merge saldo (ambil terbesar)
                            if(json.user.saldo > (accounts[currentUser].saldo || 0))
                                accounts[currentUser].saldo = json.user.saldo;
                            // Merge history (gabungkan, buang duplikat)
                            const existHist = new Set(accounts[currentUser].history || []);
                            (json.user.history || []).forEach(h => existHist.add(h));
                            accounts[currentUser].history = Array.from(existHist);
                            // Merge targets
                            const existTargets = new Set(accounts[currentUser].targets || []);
                            (json.user.targets || []).forEach(t => existTargets.add(t));
                            accounts[currentUser].targets = Array.from(existTargets);
                            // Merge jadwal (jika ada jadwal di backup, gabungkan)
                            if(json.user.schedule) {
                                for(let day in json.user.schedule) {
                                    if(!accounts[currentUser].schedule) accounts[currentUser].schedule = {};
                                    if(!accounts[currentUser].schedule[day] || accounts[currentUser].schedule[day].join('') === '--')
                                        accounts[currentUser].schedule[day] = json.user.schedule[day];
                                }
                            }
                        }
                        saveTextData();
                        localStorage.setItem('dixz_session', currentUser);
                    }

                    if(json.media && json.media.length > 0) {
                        const existingItems = await getMediaFromDB(currentUser);
                        const existingNames = new Set(existingItems.map(i => i.type + '::' + i.name));
                        const duplicates = [];

                        for(const m of json.media) {
                            const key = m.type + '::' + m.name;
                            if(existingNames.has(key)) {
                                duplicates.push(m.name);
                            } else {
                                const blob = base64ToBlob(m.data);
                                if(m.type === 'web_app') {
                                    const transaction = db.transaction(["media"], "readwrite");
                                    const store = transaction.objectStore("media");
                                    store.add({ user: currentUser, type: m.type, blob: blob, name: m.name, url: m.url, created: new Date() });
                                } else {
                                    await saveMediaToDB(currentUser, m.type, blob, m.name, m.album || currentUser);
                                }
                                existingNames.add(key);
                            }
                        }

                        document.getElementById('btnRestore').innerText = "Proses Data";
                        closeModal();
                        await loadMedia();

                        if(duplicates.length > 0) {
                            // Tampilkan notifikasi duplikat
                            showDuplicateNotification(duplicates);
                        } else {
                            alert("Data Berhasil Dimasukkan!");
                        }
                        renderUI();
                    } else {
                        document.getElementById('btnRestore').innerText = "Proses Data";
                        closeModal();
                        alert("Data Berhasil Dimasukkan!");
                        renderUI();
                    }
                } catch(err) { document.getElementById('btnRestore').innerText = "Proses Data"; alert("Gagal memproses file: " + err.message); }
            };
            reader.readAsText(file);
        }

        function showDuplicateNotification(duplicateNames) {
            // Hapus notifikasi lama jika ada
            const oldNotif = document.getElementById('dupNotif');
            if(oldNotif) oldNotif.remove();

            const notif = document.createElement('div');
            notif.id = 'dupNotif';
            notif.style.cssText = 'position:fixed;top:70px;left:50%;transform:translateX(-50%);z-index:9999;background:var(--warning-soft);border:1px solid var(--warning-color);border-radius:14px;padding:12px 18px;box-shadow:var(--shadow-md);font-family:var(--font-body);font-weight:600;font-size:0.9rem;color:var(--warning-color);cursor:pointer;max-width:90%;text-align:center;';
            notif.innerHTML = '<svg style="width:16px;height:16px;stroke:var(--warning-color);fill:none;stroke-width:2;display:inline;vertical-align:middle;margin-right:5px;" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg> Ada file duplikat, klik disini';
            notif.onclick = () => {
                notif.remove();
                openGalleryPage();
            };
            document.body.appendChild(notif);
            // Auto hilang setelah 15 detik
            setTimeout(() => { if(notif.parentNode) notif.remove(); }, 15000);
        }

        function toggleSidebar() { const sb = document.getElementById('sidebar'); sb.classList.contains('active') ? (sb.classList.remove('active'), document.getElementById('overlay').style.display='none') : (sb.classList.add('active'), document.getElementById('overlay').style.display='block'); }
        function closeAll() { document.getElementById('sidebar').classList.remove('active'); document.querySelectorAll('.modal').forEach(m=>m.style.display='none'); document.getElementById('overlay').style.display='none'; const mb=document.getElementById('modalBackdrop'); if(mb) mb.style.display='none'; }
        function showModal(id) { closeAll(); document.getElementById('modalBackdrop').style.display='block'; document.getElementById(id).style.display='block'; if(id === 'modalWalletDetail' && currentUser) { const h = accounts[currentUser].history; document.getElementById('historyList').innerHTML = h.length ? h.map(x=>`<div>${x}</div>`).join('') : 'Kosong'; } }
        function switchModal(id) { closeAll(); showModal(id); }
        function closeModal() { closeAll(); }
        function toggleDarkMode() { document.body.classList.toggle('dark-mode'); localStorage.setItem('dixz_theme', document.body.classList.contains('dark-mode')?'dark':'light'); closeAll(); }
        if(localStorage.getItem('dixz_theme')==='dark') document.body.classList.add('dark-mode');
        

        // ===== MUSIK & GALERI PAGE FUNCTIONS =====
        let currentAlbumPage = "";

        async function openMusicPage() {
            if (!currentUser) return;
            document.getElementById('musicPageOverlay').style.display = 'flex';
            const main = document.getElementById('musicMainViewPage');
            if(main) main.style.display = 'block';
            document.getElementById('musicAlbumViewPage').classList.add('hidden');
            document.getElementById('selectedAlbumContentPage').classList.add('hidden');
            const btn = document.querySelector('#musicPageOverlay .btn-album');
            if(btn) btn.innerText = "ALBUM";
            // Ensure media is loaded
            if (allMusicList.length === 0) await loadMedia();
            currentPlaylist = allMusicList;
            renderMusicListOnPage();
            renderMusicAlbumsOnPage();
        }
        function closeMusicPage() {
            document.getElementById('musicPageOverlay').style.display = 'none';
        }
        function openGalleryPage() {
            if (!currentUser) return;
            currentAlbumPage = currentAlbum;
            document.getElementById('galleryPageOverlay').style.display = 'flex';
            renderAlbumTabsOnPage();
            loadMediaOnPage();
        }
        function closeGalleryPage() {
            document.getElementById('galleryPageOverlay').style.display = 'none';
        }

        // --- MUSIC PAGE ---
        function renderMusicListOnPage(playlist) {
            const musicDiv = document.getElementById('musicListPage');
            if (!musicDiv) return;
            const list = playlist || allMusicList;
            musicDiv.innerHTML = '';
            if(list.length === 0) { musicDiv.innerHTML = "<p style='padding:10px; text-align:center;'>Tidak ada musik</p>"; return; }
            list.forEach((track, index) => {
                const audTemp = new Audio(track.url);
                const durId = `aud_dur_page_${track.id}`;
                audTemp.onloadedmetadata = () => {
                    const el = document.getElementById(durId);
                    if(el) el.innerText = formatTime(audTemp.duration);
                };
                const div = document.createElement('div');
                div.className = 'music-item';
                div.innerHTML = `
                    <button class="btn-play-stylish" onclick="playTrack(${index}, 'musicListPage')"><svg style="width:18px;height:18px;fill:var(--text-color);" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg></button>
                    <div class="music-info-box">${track.name}</div>
                    <span class="music-duration-text" id="${durId}">...</span>
                    <button class="btn-options" onclick="showMusicOptionsPage(event, ${track.id}, '${track.name.replace(/'/g,"\\'")}')"><svg style="width:18px;height:18px;stroke:var(--text-color);fill:none;stroke-width:2.5;" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg></button>`;
                musicDiv.appendChild(div);
            });
        }

        function confirmDeleteMusicFromPage(id) {
            const isAlbumView = !document.getElementById('musicAlbumViewPage').classList.contains('hidden');
            document.getElementById('delGenericTitle').innerText = isAlbumView ? "Hapus dari Album?" : "Hapus Musik?";
            document.getElementById('delGenericDesc').innerText = isAlbumView ? "Hapus lagu ini dari album ini saja?" : "Hapus lagu ini dari semua daftar?";
            document.getElementById('btnConfirmDelGeneric').onclick = () => {
                if (!isAlbumView) {
                    deleteMediaFromDB(id).then(async () => {
                        for(let k in musicAlbums) { musicAlbums[k] = musicAlbums[k].filter(x => x !== id); }
                        // Hapus dari allMusicList langsung
                        allMusicList = allMusicList.filter(m => m.id !== id);
                        currentPlaylist = currentPlaylist.filter(m => m.id !== id);
                        saveMusicAlbums();
                        closeModal();
                        renderMusicListOnPage(currentPlaylist);
                    });
                } else {
                    // Hapus dari album saja, musik tetap ada di list
                    musicAlbums[currentMusicAlbum] = musicAlbums[currentMusicAlbum].filter(x => x !== id);
                    currentPlaylist = currentPlaylist.filter(m => m.id !== id);
                    saveMusicAlbums();
                    renderMusicAlbumTracksOnPage(currentPlaylist);
                    closeModal();
                }
            };
            showModal('modalDeleteGeneric');
        }

        function renderMusicAlbumsOnPage() {
            const container = document.getElementById('musicAlbumListPage');
            if (!container) return;
            container.innerHTML = '';
            const createBtn = document.createElement('div');
            createBtn.className = 'music-album-card create-album-card';
            createBtn.innerHTML = '<span style="font-size:2rem;">+</span><span style="font-size:0.7rem;font-weight:bold;">Buat Baru</span>';
            createBtn.onclick = () => { document.getElementById('newMusicAlbumNameInput').value = ""; showModal('modalCreateMusicAlbum'); };
            container.appendChild(createBtn);
            for (let albumName in musicAlbums) {
                const div = document.createElement('div');
                div.className = 'music-album-card';
                // Foto album jika ada
                const albumCoverKey = `dixz_music_album_cover_${currentUser}_${albumName}`;
                const albumCover = localStorage.getItem(albumCoverKey);
                if(albumCover) {
                    div.style.backgroundImage = `url('${albumCover}')`;
                    div.style.backgroundSize = 'cover';
                    div.style.backgroundPosition = 'center';
                    div.innerHTML = `<div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(to top,rgba(0,0,0,0.75) 0%,transparent 100%);border-radius:0 0 13px 13px;padding:6px 6px 8px 6px;"><span style="font-size:0.78rem;font-weight:bold;text-align:center;color:#fff;display:block;text-shadow:0 1px 3px rgba(0,0,0,0.8);">${albumName}</span></div>`;
                } else {
                    div.innerHTML = `<svg class="icon-comic" style="width:40px;height:40px;margin-bottom:5px;"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg><span style="font-size:0.8rem;font-weight:bold;text-align:center;">${albumName}</span>`;
                }
                let pressTimer;
                const albumNameCopy = albumName;
                const startPress = () => { pressTimer = setTimeout(() => showMusicAlbumOptions(albumNameCopy), 700); };
                const cancelPress = () => clearTimeout(pressTimer);
                div.onmousedown = startPress; div.onmouseup = cancelPress; div.onmouseleave = cancelPress;
                div.ontouchstart = startPress; div.ontouchend = cancelPress;
                div.onclick = () => openMusicAlbumOnPage(albumNameCopy);
                container.appendChild(div);
            }
        }

        // Opsi album musik (hapus & ganti nama & tambah foto)
        function showMusicAlbumOptions(albumName) {
            renameMusicAlbumTarget = albumName;
            document.getElementById('musicAlbumOptionsTitle').innerText = albumName;
            showModal('modalMusicAlbumOptions');
        }

        let renameMusicAlbumTarget = '';
        function processMusicAlbumRename() {
            const newName = document.getElementById('renameMusicAlbumInput').value.trim();
            if(!newName || newName === renameMusicAlbumTarget) { closeModal(); return; }
            if(musicAlbums[newName]) return alert("Nama album sudah ada!");
            musicAlbums[newName] = musicAlbums[renameMusicAlbumTarget];
            delete musicAlbums[renameMusicAlbumTarget];
            // Pindah cover foto jika ada
            const coverKey = `dixz_music_album_cover_${currentUser}_${renameMusicAlbumTarget}`;
            const cover = localStorage.getItem(coverKey);
            if(cover) {
                localStorage.setItem(`dixz_music_album_cover_${currentUser}_${newName}`, cover);
                localStorage.removeItem(coverKey);
            }
            if(currentMusicAlbum === renameMusicAlbumTarget) currentMusicAlbum = newName;
            saveMusicAlbums();
            closeModal();
            renderMusicAlbumsOnPage();
            if(document.getElementById('selectedAlbumContentPage') && !document.getElementById('selectedAlbumContentPage').classList.contains('hidden')) {
                document.getElementById('currentMusicAlbumNamePage').innerText = newName;
            }
        }

        function pickMusicAlbumCover() {
            document.getElementById('musicAlbumCoverInput').click();
        }
        function processMusicAlbumCover(event) {
            const file = event.target.files[0];
            if(!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                localStorage.setItem(`dixz_music_album_cover_${currentUser}_${renameMusicAlbumTarget}`, e.target.result);
                closeModal();
                renderMusicAlbumsOnPage();
                renderMusicAlbums();
            };
            reader.readAsDataURL(file);
        }

        function openMusicAlbumOnPage(name) {
            currentMusicAlbum = name;
            document.getElementById('currentMusicAlbumNamePage').innerText = name;
            document.getElementById('selectedAlbumContentPage').classList.remove('hidden');
            document.getElementById('musicMainViewPage').style.display = 'none';
            const trackIds = musicAlbums[name];
            const albumTracks = allMusicList.filter(m => trackIds.includes(m.id));
            currentPlaylist = albumTracks;
            renderMusicAlbumTracksOnPage(albumTracks);
        }

        function renderMusicAlbumTracksOnPage(list) {
            const div = document.getElementById('musicAlbumTracksPage');
            if (!div) return;
            div.innerHTML = '';
            if(list.length === 0) { div.innerHTML = "<p>Album kosong</p>"; return; }
            list.forEach((track, index) => {
                const audTemp = new Audio(track.url);
                const durId = `aud_dur_alb_${track.id}`;
                audTemp.onloadedmetadata = () => {
                    const el = document.getElementById(durId);
                    if(el) el.innerText = formatTime(audTemp.duration);
                };
                const item = document.createElement('div');
                item.className = 'music-item';
                item.innerHTML = `
                    <button class="btn-play-stylish" onclick="playTrackInAlbum(${index})"><svg style="width:18px;height:18px;fill:var(--text-color);" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg></button>
                    <div class="music-info-box">${track.name}</div>
                    <span class="music-duration-text" id="${durId}">...</span>
                    <button class="btn-options" onclick="showMusicOptionsPage(event, ${track.id}, '${track.name.replace(/'/g,"\\'")}')"><svg style="width:18px;height:18px;stroke:var(--text-color);fill:none;stroke-width:2.5;" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg></button>`;
                div.appendChild(item);
            });
        }

        function filterMusicPage() {
            const q = document.getElementById('musicSearchInputPage').value.toLowerCase();
            const isAlbum = !document.getElementById('musicAlbumViewPage').classList.contains('hidden');
            const filtered = currentPlaylist.filter(t => t.name.toLowerCase().includes(q));
            if (!isAlbum) renderMusicListOnPage(filtered);
            else renderMusicAlbumTracksOnPage(filtered);
        }

        // Fungsi untuk play track dari album (playlist tetap album itu)
        function playTrackInAlbum(index) {
            // currentPlaylist sudah diset ke albumTracks saat openMusicAlbumOnPage
            if(index >= currentPlaylist.length) index = 0;
            currentTrackIndex = index;
            const track = currentPlaylist[index];
            audio.src = track.url;
            audio.play();
            document.getElementById('audioBar').style.display = 'flex';
            document.getElementById('audioTitle').innerText = track.name;
            updatePlayIcon();
            updateMediaSessionMetadata();
        }

        // Context menu untuk musik (2 pilihan: ganti nama & hapus)
        let musicOptionsId = null;
        let musicOptionsName = '';
        function showMusicOptionsPage(event, id, name) {
            event.stopPropagation();
            musicOptionsId = id;
            musicOptionsName = name;
            // Hapus popup lama jika ada
            const old = document.getElementById('musicContextMenu');
            if(old) old.remove();
            const menu = document.createElement('div');
            menu.id = 'musicContextMenu';
            menu.style.cssText = `position:fixed; background:var(--card-bg); border:1px solid var(--border-color); border-radius:14px; box-shadow:var(--shadow-md); z-index:9999; overflow:hidden; min-width:160px;`;
            // Posisi menu dekat tombol
            const rect = event.target.getBoundingClientRect();
            menu.style.top = (rect.bottom + 4) + 'px';
            menu.style.right = (window.innerWidth - rect.right) + 'px';
            menu.innerHTML = `
                <div onclick="renameMusicTrack(${id}, '${name.replace(/'/g,"\\'")}'); document.getElementById('musicContextMenu').remove();" style="padding:12px 18px; cursor:pointer; font-weight:600; font-family:var(--font-body); font-size:0.9rem; border-bottom:1px solid var(--border-color); display:flex; align-items:center; gap:8px; color:var(--text-color);">
                    <svg style="width:16px;height:16px;stroke:var(--primary-color);fill:none;stroke-width:2;" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    Ganti Nama
                </div>
                <div onclick="confirmDeleteMusicFromPage(${id}); document.getElementById('musicContextMenu').remove();" style="padding:12px 18px; cursor:pointer; font-weight:600; font-family:var(--font-body); font-size:0.9rem; color:var(--danger-color); display:flex; align-items:center; gap:8px;">
                    <svg style="width:16px;height:16px;stroke:#e53935;fill:none;stroke-width:2;" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    Hapus
                </div>`;
            document.body.appendChild(menu);
            // Tutup jika klik di luar
            setTimeout(() => {
                document.addEventListener('click', function closeMusicMenu() {
                    const m = document.getElementById('musicContextMenu');
                    if(m) m.remove();
                    document.removeEventListener('click', closeMusicMenu);
                });
            }, 50);
        }

        function renameMusicTrack(id, currentName) {
            document.getElementById('renameMusicInput').value = currentName;
            renameMusicId = id;
            showModal('modalRenameMusic');
        }

        let renameMusicId = null;
        async function processRenameMusic() {
            const newName = document.getElementById('renameMusicInput').value.trim();
            if(!newName || !renameMusicId) return;
            await updateMediaNameInDB(renameMusicId, newName);
            // Update di allMusicList
            const idx = allMusicList.findIndex(m => m.id === renameMusicId);
            if(idx !== -1) allMusicList[idx].name = newName;
            currentPlaylist = currentPlaylist.map(m => m.id === renameMusicId ? {...m, name: newName} : m);
            closeModal();
            const isAlbumView = !document.getElementById('musicAlbumViewPage').classList.contains('hidden');
            if(isAlbumView) renderMusicAlbumTracksOnPage(currentPlaylist);
            else renderMusicListOnPage(currentPlaylist);
        }

        function toggleMusicViewPage() {
            const main = document.getElementById('musicMainViewPage');
            const album = document.getElementById('musicAlbumViewPage');
            const btn = document.querySelector('#musicPageOverlay .btn-album');
            if (album.classList.contains('hidden')) {
                if(main) main.style.display = 'none';
                album.classList.remove('hidden');
                if(btn) btn.innerText = "LIST LAGU";
                renderMusicAlbumsOnPage();
            } else {
                album.classList.add('hidden');
                document.getElementById('selectedAlbumContentPage').classList.add('hidden');
                if(main) main.style.display = 'block';
                if(btn) btn.innerText = "ALBUM";
                currentPlaylist = allMusicList;
                renderMusicListOnPage();
            }
        }

        // --- GALLERY PAGE ---
        let albumCoverTarget = '';

        function showGalleryAlbumOptions(albumName) {
            albumCoverTarget = albumName;
            albumToRename = albumName;
            document.getElementById('renameAlbumInput').value = albumName;
            // Tambahkan tombol pilih foto cover di modal rename album
            const modal = document.getElementById('modalRenameAlbum');
            let coverBtn = document.getElementById('btnPickGalleryCover');
            if (!coverBtn) {
                coverBtn = document.createElement('button');
                coverBtn.id = 'btnPickGalleryCover';
                coverBtn.className = 'btn-comic';
                coverBtn.style = 'background:var(--secondary-color);color:var(--text-color);margin-top:6px;';
                coverBtn.innerHTML = '<svg style="width:16px;height:16px;stroke:var(--text-color);fill:none;stroke-width:2;display:inline;vertical-align:middle;margin-right:4px;" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg> Tambahkan Foto Album';
                coverBtn.onclick = () => document.getElementById('galleryAlbumCoverInput').click();
                // Sisipkan sebelum tombol Batal
                const batalBtn = modal.querySelector('button[onclick="closeModal()"]');
                if (batalBtn) modal.insertBefore(coverBtn, batalBtn);
                else modal.appendChild(coverBtn);
            }
            showModal('modalRenameAlbum');
        }

        function processGalleryAlbumCover(event) {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                localStorage.setItem('dixz_gallery_album_cover_' + currentUser + '_' + albumCoverTarget, e.target.result);
                closeModal();
                renderAlbumTabsOnPage();
            };
            reader.readAsDataURL(file);
        }

        function renderAlbumTabsOnPage() {
            const container = document.getElementById('albumHeaderPage');
            if (!container) return;
            container.innerHTML = '';

            // Album list dulu
            userAlbums.forEach(album => {
                const div = document.createElement('div');
                div.className = 'gallery-album-card' + (album === currentAlbumPage ? ' gallery-album-active' : '');

                // Cek cover album galeri
                const coverKey = 'dixz_gallery_album_cover_' + currentUser + '_' + album;
                const albumCover = localStorage.getItem(coverKey);
                if (albumCover) {
                    div.style.backgroundImage = "url('" + albumCover + "')";
                    div.style.backgroundSize = 'cover';
                    div.style.backgroundPosition = 'center';
                    div.innerHTML = '<div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(to top,rgba(0,0,0,0.75) 0%,transparent 100%);border-radius:0 0 14px 14px;padding:4px 4px 6px 4px;"><span style="font-size:0.7rem;font-weight:bold;text-align:center;color:#fff;display:block;text-shadow:0 1px 3px rgba(0,0,0,0.8);">' + album + '</span></div>';
                } else {
                    div.innerHTML = '<svg style="width:34px;height:34px;stroke:var(--primary-color);fill:none;stroke-width:2;margin-bottom:4px;" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg><span style="font-size:0.7rem;font-weight:bold;text-align:center;display:block;word-break:break-word;">' + album + '</span>';
                }

                let pressTimer;
                const startPress = () => { pressTimer = setTimeout(() => showGalleryAlbumOptions(album), 1000); };
                const cancelPress = () => clearTimeout(pressTimer);
                div.onmousedown = startPress; div.onmouseup = cancelPress; div.onmouseleave = cancelPress;
                div.ontouchstart = startPress; div.ontouchend = cancelPress;
                div.onclick = () => { currentAlbumPage = album; currentAlbum = album; loadMediaOnPage(); renderAlbumTabsOnPage(); };
                container.appendChild(div);
            });

            // Tombol tambah album di AKHIR (kanan)
            const addBtn = document.createElement('div');
            addBtn.className = 'gallery-album-card gallery-album-add-card';
            addBtn.innerHTML = '<svg style="width:30px;height:30px;stroke:var(--text-color);fill:none;stroke-width:2.5;" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg><span style="font-size:0.7rem;font-weight:bold;text-align:center;">Buat Album</span>';
            addBtn.onclick = () => { document.getElementById('newAlbumNameInput').value = ""; showModal('modalCreateAlbum'); };
            container.appendChild(addBtn);
        }

        async function loadMediaOnPage() {
            if (!currentUser) return;
            const galleryDiv = document.getElementById('mediaGalleryPage');
            if (!galleryDiv) return;
            galleryDiv.innerHTML = '';
            const items = await getMediaFromDB(currentUser);
            let pageGalleryItems = [];
            items.forEach(item => {
                if (item.type === 'photo' || item.type === 'video') {
                    const itemAlbum = item.album || currentUser;
                    if (itemAlbum === currentAlbumPage) {
                        pageGalleryItems.push({ ...item, url: URL.createObjectURL(item.blob) });
                    }
                }
            });
            if (pageGalleryItems.length === 0) {
                galleryDiv.innerHTML = '<p style="grid-column:span 2;text-align:center;padding:20px;">Album ini kosong.</p>';
                return;
            }
            pageGalleryItems.forEach(item => {
                const div = document.createElement('div');
                div.className = 'media-box';
                let touchStartY = 0, isScrolling = false, pressTimer = null;
                const startPress = (e) => {
                    touchStartY = e.touches ? e.touches[0].clientY : e.clientY;
                    isScrolling = false;
                    pressTimer = setTimeout(() => { if (!isScrolling) showMediaMenuPage(item.id, item.type, item.url); }, 800);
                };
                const handleMove = (e) => {
                    const cy = e.touches ? e.touches[0].clientY : e.clientY;
                    if (Math.abs(cy - touchStartY) > 10) { isScrolling = true; clearTimeout(pressTimer); }
                };
                const handleRelease = (e) => {
                    clearTimeout(pressTimer);
                    if (!isScrolling) viewMediaFromPage(item.id, pageGalleryItems);
                    isScrolling = false;
                };
                div.addEventListener('mousedown', startPress);
                div.addEventListener('mousemove', handleMove);
                div.addEventListener('mouseup', handleRelease);
                div.addEventListener('mouseleave', () => { clearTimeout(pressTimer); isScrolling = false; });
                div.addEventListener('touchstart', startPress, { passive: true });
                div.addEventListener('touchmove', handleMove, { passive: true });
                div.addEventListener('touchend', handleRelease);
                if (item.type === 'photo') {
                    div.innerHTML = `<img src="${item.url}">`;
                } else {
                    const vidId = `vid_page_${item.id}`;
                    div.innerHTML = `<video id="${vidId}" src="${item.url}#t=0.1" preload="metadata" playsinline muted style="width:100%;height:100%;object-fit:cover;"></video>
                        <div class="video-overlay-bar">
                            <svg class="vid-icon" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                            <div class="vid-progress"><div class="vid-progress-fill"></div></div>
                            <span class="vid-time" id="dur_${vidId}">--:--</span>
                        </div>`;
                    setTimeout(() => {
                        const v = document.getElementById(vidId);
                        if (v) v.onloadedmetadata = () => {
                            const el = document.getElementById('dur_' + vidId);
                            if (el) el.innerText = formatTime(v.duration);
                        };
                    }, 100);
                }
                galleryDiv.appendChild(div);
            });
        }

        let selectedPageMediaId = null, selectedPageMediaType = null, selectedPageMediaUrl = null;
        function showMediaMenuPage(id, type, url) {
            selectedPageMediaId = id; selectedPageMediaType = type; selectedPageMediaUrl = url;
            document.getElementById('delGenericTitle').innerText = "Hapus Media?";
            document.getElementById('delGenericDesc').innerText = "File ini akan dihapus permanen.";
            document.getElementById('btnConfirmDelGeneric').onclick = async () => {
                await deleteMediaFromDB(selectedPageMediaId);
                closeModal();
                loadMediaOnPage();
            };
            showModal('modalDeleteGeneric');
        }

        function viewMediaFromPage(startId, items) {
            const overlay = document.getElementById('previewOverlay');
            const carousel = document.getElementById('previewCarousel');
            carousel.innerHTML = '';
            let startIndex = 0;
            items.forEach((item, index) => {
                if (item.id === startId) startIndex = index;
                const div = document.createElement('div');
                div.className = 'preview-item';
                if (item.type === 'photo') div.innerHTML = `<img src="${item.url}">`;
                else div.innerHTML = `<video src="${item.url}#t=0.1" preload="metadata" playsinline controls></video>`;
                carousel.appendChild(div);
            });
            overlay.style.display = 'flex';
            setTimeout(() => {
                const its = document.querySelectorAll('.preview-item');
                if (its[startIndex]) its[startIndex].scrollIntoView();
                initScrollObserver();
            }, 100);
        }

        // ===== PROFILE CARD BARU =====
        let profileBgDataUrl = null;
        let profilePicDataUrlNew = null;

        function openEditProfilePage() {
            if (!currentUser) return;
            closeAll();
            const page = document.getElementById('editProfilePage');
            page.style.display = 'flex';
            // Isi data saat ini
            document.getElementById('editUsernameNew').value = document.getElementById('profileName').innerText || '';
            document.getElementById('editBioNew').value = document.getElementById('profileBio').innerText || '';
            const tahun = localStorage.getItem(`dixz_tahun_${currentUser}`) || '';
            document.getElementById('editTahunNew').value = tahun;
            // Streak
            const streak = getStreak();
            document.getElementById('editStreakDisplay').innerHTML = streak + ' <svg style="width:16px;height:16px;display:inline;vertical-align:middle;" viewBox="0 0 32 40" fill="none"><path d="M16 2C16 2 8 10 8 18C8 22.4 11.6 26 16 26C20.4 26 24 22.4 24 18C24 14 20.5 10 20.5 10C20.5 10 19.5 15 16 15C12.5 15 11.5 11 11.5 11C11.5 11 8 13.5 8 18" fill="#FF6D00"/><path d="M16 8C16 8 12 13 12 18C12 20.2 13.8 22 16 22C18.2 22 20 20.2 20 18" fill="#FF9800"/></svg> (otomatis)';
            // Saldo - baca langsung dari accounts
            const saldoVal = (accounts[currentUser] ? accounts[currentUser].saldo : 0) || parseInt(localStorage.getItem(`dixz_saldo_${currentUser}`) || '0');
            document.getElementById('editSaldoDisplay').innerText = 'Rp ' + saldoVal.toLocaleString('id-ID') + ' (dari halaman 1)';
            // Preview foto profil saat ini
            const savedPic = localStorage.getItem(`dixz_profilepic_${currentUser}`);
            if (savedPic) document.getElementById('editProfilePreview').src = savedPic;
            // Preview bg saat ini
            const savedBg = localStorage.getItem(`dixz_profilebg_${currentUser}`);
            if (savedBg) {
                document.getElementById('editBgPreview').src = savedBg;
                document.getElementById('profileBgImg').src = savedBg;
            }
        }

        function closeEditProfilePage() {
            document.getElementById('editProfilePage').style.display = 'none';
        }

        function previewBgImage(event) {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                profileBgDataUrl = e.target.result;
                document.getElementById('editBgPreview').src = profileBgDataUrl;
            };
            reader.readAsDataURL(file);
        }

        function previewProfilePicEdit(event) {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                profilePicDataUrlNew = e.target.result;
                document.getElementById('editProfilePreview').src = profilePicDataUrlNew;
            };
            reader.readAsDataURL(file);
        }

        function saveProfileNew() {
            if (!currentUser) return;
            const name = document.getElementById('editUsernameNew').value.trim();
            const bio = document.getElementById('editBioNew').value.trim();
            const tahun = document.getElementById('editTahunNew').value.trim();
            if (name) {
                localStorage.setItem(`dixz_username_${currentUser}`, name);
                document.getElementById('profileName').innerText = name;
            }
            if (bio) {
                localStorage.setItem(`dixz_bio_${currentUser}`, bio);
                document.getElementById('profileBio').innerText = bio;
            }
            if (tahun) {
                localStorage.setItem(`dixz_tahun_${currentUser}`, tahun);
                updateUsiaDisplay();
            }
            if (profilePicDataUrlNew) {
                localStorage.setItem(`dixz_profilepic_${currentUser}`, profilePicDataUrlNew);
                document.getElementById('profileImg').src = profilePicDataUrlNew;
                profilePicDataUrlNew = null;
            }
            if (profileBgDataUrl) {
                localStorage.setItem(`dixz_profilebg_${currentUser}`, profileBgDataUrl);
                document.getElementById('profileBgImg').src = profileBgDataUrl;
                profileBgDataUrl = null;
            }
            closeEditProfilePage();
        }

        // ===== STREAK SYSTEM =====
        function getStreak() {
            if (!currentUser) return 0;
            const key = `dixz_streak_${currentUser}`;
            const lastKey = `dixz_streak_last_${currentUser}`;
            const today = new Date().toDateString();
            const last = localStorage.getItem(lastKey);
            let streak = parseInt(localStorage.getItem(key) || '0');
            if (last !== today) {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                if (last === yesterday.toDateString()) {
                    streak += 1;
                } else if (!last) {
                    streak = 1;
                } else {
                    streak = 1; // reset jika skip hari
                }
                localStorage.setItem(key, streak);
                localStorage.setItem(lastKey, today);
            }
            return streak;
        }

        function updateUsiaDisplay() {
            if (!currentUser) return;
            const tahun = parseInt(localStorage.getItem(`dixz_tahun_${currentUser}`));
            const el = document.getElementById('statUsia');
            if (el && tahun) {
                const usia = new Date().getFullYear() - tahun;
                el.innerText = usia;
            } else if (el) {
                el.innerText = '—';
            }
        }

        function updateProfileStats() {
            if (!currentUser) return;
            // Streak
            const streak = getStreak();
            const selStreak = document.getElementById('statStreak');
            if (selStreak) selStreak.innerText = streak;
            // Saldo - langsung dari accounts
            const saldo = (accounts[currentUser] ? accounts[currentUser].saldo : 0) || parseInt(localStorage.getItem(`dixz_saldo_${currentUser}`) || '0');
            const selSaldo = document.getElementById('statSaldo');
            if (selSaldo) {
                if(saldo >= 1000000) selSaldo.innerText = (saldo/1000000).toFixed(1).replace('.0','') + 'jt';
                else if(saldo >= 1000) selSaldo.innerText = (saldo/1000).toFixed(1).replace('.0','') + 'k';
                else selSaldo.innerText = saldo;
            }
            // Usia
            updateUsiaDisplay();
            // Foto profil
            const savedPic = localStorage.getItem(`dixz_profilepic_${currentUser}`);
            if (savedPic) document.getElementById('profileImg').src = savedPic;
            // Foto bg
            const savedBg = localStorage.getItem(`dixz_profilebg_${currentUser}`);
            if (savedBg) document.getElementById('profileBgImg').src = savedBg;
            // Nama & bio
            const savedName = localStorage.getItem(`dixz_username_${currentUser}`);
            if (savedName) document.getElementById('profileName').innerText = savedName;
            const savedBio = localStorage.getItem(`dixz_bio_${currentUser}`);
            if (savedBio) document.getElementById('profileBio').innerText = savedBio;
        }

        function switchPage(p) {
            document.getElementById('homePage').classList.add('hidden');
            document.getElementById('profilePage').classList.add('hidden');
            document.getElementById('allAppsPage').classList.add('hidden');
            document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active-nav'));

            const appView = document.getElementById('appViewContainer');
            if (isAppOpen && p !== 'apps') {
                appView.style.display = 'none'; 
            } else if (isAppOpen && p === 'apps') {
                appView.style.display = 'flex'; 
            }

            if(p==='home') {
                document.getElementById('homePage').classList.remove('hidden');
                document.querySelectorAll('.nav-item')[0].classList.add('active-nav');
            } else if (p==='apps') {
                document.getElementById('allAppsPage').classList.remove('hidden');
                document.querySelectorAll('.nav-item')[1].classList.add('active-nav');
            } else {
                document.getElementById('profilePage').classList.remove('hidden');
                document.querySelectorAll('.nav-item')[2].classList.add('active-nav');
                setTimeout(updateProfileStats, 50);
            }
        }
