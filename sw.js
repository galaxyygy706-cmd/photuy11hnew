/* ============================================================================
   SERVICE WORKER - PHỞ TÚY POS PRO
   ----------------------------------------------------------------------------
   ⚠️ QUAN TRỌNG: MỖI LẦN SỬA index.html HOẶC app.js RỒI DEPLOY,
      PHẢI TĂNG SỐ VERSION Ở DÒNG DƯỚI (v1 -> v2 -> v3...).
      Nếu quên, máy nhân viên sẽ tiếp tục chạy bản cũ đã lưu trong bộ nhớ.

   Nguyên tắc: CHỈ cache "vỏ" app (HTML, JS, icon, thư viện CDN).
   TUYỆT ĐỐI KHÔNG cache dữ liệu bán hàng của Firebase — nếu cache nhầm,
   nhân viên sẽ nhìn thấy sơ đồ bàn / đơn hàng cũ.
   ========================================================================== */

const VERSION = 'v1';
const SHELL_CACHE = 'photuy-shell-' + VERSION;   // File của chính app
const LIB_CACHE = 'photuy-lib-' + VERSION;       // Thư viện tải từ CDN

/* Danh sách file cốt lõi, tải sẵn ngay khi cài đặt */
const SHELL_FILES = [
    './',
    './index.html',
    './app.js',
    './manifest.webmanifest',
    './icons/icon.svg',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-maskable-512.png'
];

/* Các CDN chứa thư viện tĩnh (Firebase SDK, Chart.js, XLSX, FontAwesome).
   Đây là ~700KB tải lại mỗi lần mở app nếu không cache. */
const LIB_HOSTS = [
    'www.gstatic.com',
    'cdn.jsdelivr.net',
    'cdnjs.cloudflare.com'
];

/* Các host phải ĐI THẲNG RA MẠNG, không bao giờ đụng tới cache.
   Đây là đường truyền dữ liệu realtime của quán. */
const BYPASS_HOSTS = [
    'firebasedatabase.app',
    'firebaseio.com',
    'googleapis.com',
    'google-analytics.com',
    'googletagmanager.com'
];

/* ---------------------------------------------------------------- INSTALL */
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(SHELL_CACHE)
            .then((cache) => cache.addAll(SHELL_FILES))
            // Không dùng skipWaiting() ở đây: bản mới chỉ được kích hoạt khi
            // nhân viên bấm "Tải lại" trên thông báo, tránh reload giữa lúc
            // đang ghi dở một đơn hàng.
            .catch((err) => console.warn('[SW] Precache lỗi:', err))
    );
});

/* --------------------------------------------------------------- ACTIVATE */
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((names) => Promise.all(
                names
                    .filter((n) => n.startsWith('photuy-') && n !== SHELL_CACHE && n !== LIB_CACHE)
                    .map((n) => caches.delete(n))
            ))
            .then(() => self.clients.claim())
    );
});

/* --------------------------------------------------- NHẬN LỆNH TỪ TRANG WEB */
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

/* ------------------------------------------------------------------ FETCH */
self.addEventListener('fetch', (event) => {
    const req = event.request;

    // 1. Chỉ xử lý GET. POST/PUT/DELETE (ghi đơn, ghi kho...) đi thẳng ra mạng.
    if (req.method !== 'GET') return;

    let url;
    try {
        url = new URL(req.url);
    } catch (e) {
        return;
    }

    // 2. Bỏ qua giao thức lạ (chrome-extension://, data:...)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

    // 3. DỮ LIỆU FIREBASE -> luôn đi thẳng ra mạng
    if (BYPASS_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith('.' + h))) return;

    // 4. TRANG HTML -> ưu tiên mạng, mất mạng thì lấy bản đã lưu
    if (req.mode === 'navigate') {
        event.respondWith(
            fetch(req)
                .then((res) => {
                    const copy = res.clone();
                    caches.open(SHELL_CACHE).then((c) => c.put('./index.html', copy));
                    return res;
                })
                .catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
        );
        return;
    }

    // 5. THƯ VIỆN CDN -> ưu tiên cache (bản đã tải chạy ngay, không chờ mạng)
    if (LIB_HOSTS.includes(url.hostname)) {
        event.respondWith(
            caches.match(req).then((hit) => {
                if (hit) return hit;
                return fetch(req).then((res) => {
                    // Chỉ lưu response hợp lệ (bỏ qua lỗi 4xx/5xx)
                    if (res && res.status === 200) {
                        const copy = res.clone();
                        caches.open(LIB_CACHE).then((c) => c.put(req, copy));
                    }
                    return res;
                });
            })
        );
        return;
    }

    // 6. FILE CÙNG GỐC (app.js, icon...) -> trả bản cache ngay, âm thầm cập nhật nền
    if (url.origin === self.location.origin) {
        event.respondWith(
            caches.match(req).then((hit) => {
                const network = fetch(req)
                    .then((res) => {
                        if (res && res.status === 200 && res.type === 'basic') {
                            const copy = res.clone();
                            caches.open(SHELL_CACHE).then((c) => c.put(req, copy));
                        }
                        return res;
                    })
                    .catch(() => hit);
                return hit || network;
            })
        );
    }

    // 7. Còn lại (ảnh món ăn từ nguồn ngoài...) -> để trình duyệt tự xử lý
});
