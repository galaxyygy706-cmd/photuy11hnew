# Phở POS — Order trên điện thoại (PWA + Firebase)

## Cấu trúc file
```
pho-pos-pwa/
├── index.html        # khung app + top bar + bottom nav
├── style.css          # toàn bộ giao diện
├── app.js             # logic app + kết nối Firebase Firestore
├── manifest.json       # cấu hình PWA (tên, icon, theme)
├── sw.js               # service worker — cache app shell, chạy offline
├── firestore.rules      # rules bảo mật gợi ý cho Firestore
└── icons/
    ├── icon-192.png
    ├── icon-512.png
    └── apple-touch-icon.png
```

## 1. Tạo project Firebase
1. Vào https://console.firebase.google.com → **Add project**.
2. Trong project, vào **Build → Firestore Database → Create database** (chọn chế độ Production, khu vực gần VN, ví dụ `asia-southeast1`).
3. Vào **Project settings → General → Your apps → Web (</>)** để tạo 1 Web App, Firebase sẽ cho bạn đoạn `firebaseConfig`.
4. Copy đoạn đó vào đầu file `app.js`, thay cho khối `firebaseConfig` hiện tại (đang để giá trị mẫu `YOUR_API_KEY`...).

## 2. Áp dụng Firestore rules
Cài Firebase CLI rồi deploy rules có sẵn trong `firestore.rules`:
```bash
npm install -g firebase-tools
firebase login
firebase init firestore   # trỏ tới project vừa tạo, dùng file firestore.rules có sẵn
firebase deploy --only firestore:rules
```
Rules mẫu hiện yêu cầu `request.auth != null` (đã đăng nhập) mới được đọc/ghi — nếu bạn **chưa** gắn Firebase Authentication vào app, tạm thời có thể đổi thành `allow read, write: if true;` để test nhanh, nhưng nhớ khóa lại trước khi dùng thật (ai có link cũng ghi được dữ liệu).

## 3. Chạy thử local
Vì app dùng ES module (`type="module"`) nên phải chạy qua HTTP server, không mở trực tiếp file `index.html`:
```bash
cd pho-pos-pwa
npx serve .
# hoặc: python3 -m http.server 8080
```
Mở `http://localhost:8080` trên điện thoại (cùng wifi) hoặc trình duyệt máy tính.

## 4. Cài lên màn hình chính điện thoại (PWA)
- **Android/Chrome**: mở link → menu (⋮) → "Thêm vào Màn hình chính".
- **iPhone/Safari**: mở link → nút Share → "Thêm vào MH chính".
- App phải chạy qua **HTTPS** (hoặc `localhost`) thì Service Worker (`sw.js`) mới hoạt động — khi deploy thật (Firebase Hosting, Vercel, Netlify...) sẽ tự có HTTPS.

## 5. Deploy lên Firebase Hosting (tùy chọn, dễ nhất vì cùng hệ Firebase)
```bash
firebase init hosting     # chọn thư mục pho-pos-pwa làm public dir
firebase deploy --only hosting
```

## Quy trình phục vụ

| # | Nhân viên làm gì | Trạng thái bàn | Phiếu in ra |
|---|---|---|---|
| 1 | Chọn bàn, thêm món vào giỏ | `dang_goi` — Đang gọi | — |
| 2 | Bấm **Gửi bếp** | `dang_phuc_vu` — Đang phục vụ | **Phiếu bếp lượt #1** (không có giá) |
| 3 | Bưng món ra → chạm chip món, hoặc **Hoàn thành tất cả** | *(giữ nguyên)* | — |
| 3b | Khách gọi thêm → **Thêm món** → **Gửi bếp** | *(giữ nguyên)* | **Phiếu bếp lượt #2** — chỉ in món mới |
| 4 | Bấm **Yêu cầu thanh toán** | `thanh_toan` — Thanh toán | **Phiếu tạm tính** (có giá, đưa khách xem) |
| 5 | Bấm **Xác nhận đã thu tiền** | `cho_don` — Chờ dọn | **Hóa đơn** (tùy chọn, bấm *In hóa đơn*) |
| 6 | Dọn xong → chạm thẳng ô bàn ở sơ đồ | `trong` — Trống | — |

Ghi chú:
- **Lượt gửi (batch)**: mỗi món mang số `batch`. Món `batch: null` là món còn trong giỏ, chưa từng in phiếu bếp — nhờ đó gọi thêm món không làm bếp nấu lại món cũ. Nút **In lại phiếu** ở mỗi lượt dùng khi máy in kẹt giấy.
- **Hủy món đã gửi**: nút *Hủy món* ở màn theo dõi → chọn lý do → in **phiếu hủy** cho bếp. Món bị gạch ngang, giữ lại để đối soát, không tính vào hóa đơn.
- **Trạng thái món chỉ có 2 mức** (`da_gui` → `hoan_thanh`). Dữ liệu cũ 4 mức (`bep_nhan`, `dang_lam`) được tự động quy về `da_gui` khi đọc lên.
- **Chờ dọn tự hết hạn**: bàn ở `cho_don` quá 5 phút (`AUTO_CLEAN_MS`) tự về `trong`, để một lần quên bấm không làm sơ đồ bàn sai.
- Món chưa gửi bếp **không được tính tiền** — màn theo dõi và màn thanh toán đều cảnh báo nếu còn sót.

## Cấu trúc dữ liệu Firestore
| Collection | Doc ID | Nội dung |
|---|---|---|
| `tables` | id bàn, vd `ban-01` | `{ label, zone, status, paidAt }` |
| `orders` | id bàn (trùng `tables`) | `{ items: [...], status, sentBatches, updatedAt }` |
| `history` | tự sinh | `{ tableLabel, date, time, total, method, itemCount, voidedCount, batches, paymentStatus, createdAt }` |

`orders.status`: `draft` (chưa gửi bếp) → `sent` (đã gửi) → `paying` (đang thanh toán). Một dòng trong `items`:
```js
{ menuItemId, name, size, toppings, note, quantity, unitPrice, subtotal,
  batch,          // null = còn trong giỏ; 1,2,3... = lượt đã gửi bếp
  sentAt,         // ms, để in giờ trên phiếu
  kitchenStatus,  // "da_gui" | "hoan_thanh"
  voided, voidReason, voidedAt }
```

Danh sách món (`MENU_ITEMS`) hiện đang để cứng trong `app.js` cho gọn ở bản MVP. Khi cần cho phép sửa menu mà không phải deploy lại code, tách nó thành collection `menu` trong Firestore rồi đọc bằng `onSnapshot` giống các collection còn lại.

## In ấn
Phiếu được dựng trong một `<iframe>` ẩn rồi gọi `window.print()`, khổ giấy `80mm` (`@page` trong `PRINT_CSS` ở `app.js`). Cách này chạy được với **mọi máy in đã cài trên máy/điện thoại**, kể cả máy in nhiệt USB/LAN qua driver hệ điều hành, mà không cần thư viện ngoài.

- Sửa tên/địa chỉ/SĐT quán ở hằng số `SHOP` đầu file `app.js`.
- Đổi khổ giấy 58mm: sửa `@page { size: 80mm auto }` và `body { width: 74mm }` trong `PRINT_CSS`.
- Muốn in thẳng không hiện hộp thoại: bật *Kiosk printing* của Chrome/Edge, hoặc thay `printHtml()` bằng lệnh ESC/POS qua Web Bluetooth.

## Việc còn thiếu để dùng thật
- **Đăng nhập nhân viên** (Firebase Authentication) — hiện ai mở link cũng thao tác được.
- **Màn hình bếp riêng** — hiện nhân viên order tự bấm "Hoàn thành" thay cho bếp.
- **VietQR thật** — hiện chỉ là 1 lựa chọn phương thức thanh toán, chưa sinh mã QR động.
- **Chuyển bàn / tách - gộp bill** — chưa có.
- **In ESC/POS trực tiếp** — hiện đi qua hộp thoại in của hệ điều hành.
