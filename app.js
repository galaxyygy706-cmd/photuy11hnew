// ============================================================
// app.js - Toàn bộ logic JavaScript của Phở Túy POS PRO
// Tách riêng khỏi HTML để dễ bảo trì, cache trình duyệt tốt hơn,
// và trang tải/hiển thị giao diện nhanh hơn.
// ============================================================


// ---- (Phần JS thứ 1, tách từ vị trí gốc trong HTML) ----


let ALL_ORDERS = {};
let currentPage = 1;
const recordsPerPage = 5;

let dangSuaId = null;
let daDangNhap = false; // Biến kiểm soát trạng thái đăng nhập toàn cục

// Tự động khóa app và bắt chọn đại sứ khi vừa mở trang
window.addEventListener('DOMContentLoaded', () => {
    if (!daDangNhap) {
        const wrapper = document.querySelector('.main-wrapper');
        if (wrapper) {
            wrapper.style.pointerEvents = "none";
            wrapper.style.filter = "blur(4px)";
        }
        moModalDoiNgu();
    }
});
/*1.PHÂN QUYỀN*/
const HE_THONG_QUYEN = {
    "ADMIN": ["full_control", "manage_staff", "view_history", "edit_menu", "delete_order"],
    "Đại sứ Minh Bạch": ["payment", "order", "view_history", "print_bill"], // Thu ngân
    "Đại sứ Ngoại Giao": ["order", "print_kitchen", "view_table"],         // Phục vụ
    "Đại sứ Hương Vị": ["view_kitchen", "confirm_done"],                 // Đầu bếp
    "Đại sứ Đón Tiếp": ["view_table", "status_check"],                   // Bảo vệ
    "Đại sứ Sạch Sẽ": ["clear_table_status"]                             // Vệ sinh
};

const BANG_LUONG = {
    "Bếp trưởng": 12000000,
    "Bếp phó": 8000000,
    "Phục vụ 1": 7500000,
    "Phục vụ 2": 7500000,
    "Thu ngân": 7500000,
    "Bảo an": 6500000,
    "Vệ sinh": 6500000
};


/*3.KHAI BÁO KHO*/
let currentDiscountPercent = 0;
// 1. KHAI BÁO DỮ LIỆU KHO MẶC ĐỊNH
const KHO_MASTER = [
    // Nguyên liệu chính
    { id: "thit_bo", ten: "🥩 Thịt bò", ton: 10, limit: 5, dvt: "kg", loai: "chinh" },
    { id: "banh_pho", ten: "🍜 Bánh phở", ton: 20, limit: 5, dvt: "kg", loai: "chinh" },
    { id: "nuoc_dung", ten: "🍲 Nước dùng", ton: 50, limit: 10, dvt: "lít", loai: "chinh" },
    { id: "xuong", ten: "🦴 Xương ống", ton: 30, limit: 10, dvt: "kg", loai: "chinh" },
    { id: "sa_sung", ten: "🦑 Sá sùng", ton: 5, limit: 1, dvt: "kg", loai: "chinh" },

    // Nguyên liệu phụ (Gia vị, rau, đồ dùng)
    { id: "trung", ten: "🥚 Trứng", ton: 100, limit: 20, dvt: "quả", loai: "phu" },
    { id: "quay", ten: "🥖 Quẩy", ton: 200, limit: 30, dvt: "cái", loai: "phu" },
    { id: "giay_an", ten: "🧻 Giấy ăn", ton: 50, limit: 10, dvt: "hộp", loai: "phu" },
    { id: "hanh", ten: "🌱 Hành lá", ton: 5, limit: 2, dvt: "kg", loai: "phu" },
    { id: "toi", ten: "🧄 Tỏi", ton: 3, limit: 1, dvt: "kg", loai: "phu" },
    { id: "chanh", ten: "🍋 Chanh tươi", ton: 5, limit: 2, dvt: "kg", loai: "phu" },
    { id: "ot", ten: "🌶️ Ớt tươi", ton: 2, limit: 0.5, dvt: "kg", loai: "phu" },
    { id: "tuong_ot", ten: "🥫 Tương ớt", ton: 10, limit: 3, dvt: "chai", loai: "phu" },
    { id: "giấm_toi", ten: "🏺 Giấm tỏi", ton: 5, limit: 2, dvt: "lít", loai: "phu" },
    { id: "rau_thom", ten: "🌿 Rau thơm", ton: 3, limit: 1, dvt: "kg", loai: "phu" },
    { id: "gia_do", ten: "🌱 Giá đỗ", ton: 5, limit: 2, dvt: "kg", loai: "phu" },

    // Đồ uống
    { id: "tra_da", ten: "🍵 Trà đá", ton: 20, limit: 5, dvt: "lít", loai: "nuoc" },
    { id: "cocacola", ten: "🥤 Coca-Cola", ton: 48, limit: 12, dvt: "lon", loai: "nuoc" },
    { id: "bia", ten: "🍺 Bia lon", ton: 24, limit: 10, dvt: "lon", loai: "nuoc" }
];




/*4.KHAI BÁO ĐỊNH LƯỢNG MÓN*/
const RECIPES = {
    // --- MÓN ĐƠN ---
    tuy_tam: { banh_pho: 150, thit_bo: 65, nuoc_dung: 350 },
    tuy_thuong: { banh_pho: 200, thit_bo: 65, nuoc_dung: 350 },
    hoa_chau: { trung: 1 },
    tiem_thuy: { trung: 1 },
    quay: { quay: 4 },

    // --- COMBO ---
    combo_thuong_thuy: { 
        banh_pho: 200, thit_bo: 65, nuoc_dung: 350,
        trung: 1 
    },
    combo_tam_chau: { 
        banh_pho: 150, thit_bo: 65, nuoc_dung: 350,
        trung: 1 
    },
    combo_song_long: { 
        banh_pho: 400, thit_bo: 130, nuoc_dung: 700,
        trung: 2, quay: 4 
    }
};

/*5.KHAI BÁO MENU*/
const MENU_MASTER = [
    // --- MENU ĐƠN ---
    { id: "tuy_tam", ten: 'Túy Tâm', gia: 50000, loai: 'don', desc: 'Phở Thường', soldToday: 0, limit: 100, img: "" },
    { id: "tuy_thuong", ten: 'Túy Thượng', gia: 80000, loai: 'don', desc: 'Phở Đặc Biệt', soldToday: 0, limit: 50, img: "" },
    
    // Tôi đã thêm link ảnh vào dòng Hỏa Châu bên dưới:
    { id: "hoa_chau", ten: 'Túy Long Hỏa Châu', gia: 10000, loai: 'don', desc: 'Trứng Chần', soldToday: 0, limit: 30, img: "https://i.postimg.cc/cCGKGGNR/Hoa-chau.png" },
    
    { id: "tiem_thuy", ten: 'Túy Long Tiềm Thủy', gia: 20000, loai: 'don', desc: 'Trứng Hấp', soldToday: 0, limit: 30, img: "" },
    { id: "quay", ten: 'Quẩy', gia: 10000, loai: 'don', desc: '4 chiếc', soldToday: 0, limit: 200, img: "" },

    // --- COMBO ---
    { id: "combo_thuong_thuy", ten: 'Combo Thượng Thủy', gia: 89000, loai: 'combo', desc: 'Túy Thượng + Túy Long Tiềm Thủy', soldToday: 0, limit: 20, img: "" },
    { id: "combo_tam_chau", ten: 'Combo Tâm Châu', gia: 55000, loai: 'combo', desc: 'Túy Tâm + Túy Long Hỏa Châu', soldToday: 0, limit: 25, img: "" },
    { id: "combo_song_long", ten: 'Combo Song Long Hội Tụ', gia: 175000, loai: 'combo', desc: '2 Túy Thượng + 2 Túy Long Tiềm Thủy + quẩy', soldToday: 0, limit: 10, img: "" }
];













/*2.KHAI BÁO THU CHI*/
const THU_CHI_MASTER = [
    { 
        id: "TC001", 
        loai: "thu", 
        noi_dung: "DOANH THU PHỞ NGÀY 25/04", 
        ghi_chu: "Ghi chú: Ca sáng",
        danh_muc: "Doanh thu bán hàng", 
        so_tien: 10000000, 
        phuong_thuc: "Tiền mặt", 
        nguoi_tao: "Nguyễn Kim Anh",
        thoi_gian: "11:37:45 27/04/2026",
        trang_thai: "Đã duyệt"
    },
    { 
        id: "TC002", 
        loai: "chi", 
        noi_dung: "Tiền ga tháng 04", 
        ghi_chu: "Hóa đơn đỏ",
        danh_muc: "Điện nước gas", 
        so_tien: 5000000, 
        phuong_thuc: "Chuyển khoản", 
        nguoi_tao: "Nguyễn Kim Anh",
        thoi_gian: "11:29:30 27/04/2026",
        trang_thai: "Chờ duyệt"
    }
];





const firebaseConfig = {
  apiKey: "YXBpS2V5OiAiQUl6YVN5QXR3cjg3bDRwam5Jbk92TF85VE1rQlJpLXh6a3AyWUdBIiw=",
  authDomain: "pho-tuy.firebaseapp.com",
  databaseURL: "https://pho-tuy-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "pho-tuy",
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();


let TABLES = [], MENU = [], KHO = [], HOIVIEN = [], CHITIEU = [], currentTableId = null;






// 2. Lắng nghe toàn bộ node "orders" để cập nhật số người Real-time [INDEX]
// Lắng nghe toàn bộ đơn hàng đang hoạt động
db.ref("orders").on("value", snapshot => {
    ALL_ORDERS = snapshot.val() || {};
    if (typeof renderTables === "function") renderTables();
});


// 🔥 LẮNG NGHE KHO REALTIME (đã gộp 2 listener trùng lặp trước đây thành 1)
db.ref("kho").on("value", s => {
    const data = s.val();

    // BƯỚC 1: Kiểm tra xem món đầu tiên đã có thuộc tính 'loai' chưa
    const hasCategory = data && data[0] && data[0].hasOwnProperty('loai');

    // BƯỚC 2: Nếu chưa có 'loai' HOẶC số lượng món thay đổi thì mới đẩy lên
    if (!data || data.length !== KHO_MASTER.length || !hasCategory) {
        db.ref("kho").set(KHO_MASTER);
        console.log("📦 Đã cập nhật danh sách KHO_MASTER (có Chính/Phụ) lên Firebase!");
        return;
    }

    KHO = data;
    console.log("⚡ Kho đã đồng bộ!");

    // Chỉ vẽ lại nếu bảng Kho đang thực sự hiển thị trên màn hình
    const modal = document.getElementById('modal-kho-hang');
    if (modal && modal.style.display === 'flex') {
        renderKho();
    }
});


// LOAD REALTIME
// 🔥 SYNC MENU CODE -> FIREBASE
db.ref("menu").once("value").then(s => {
    const firebaseMenu = s.val();
    if (!firebaseMenu) {
        db.ref("menu").set(MENU_MASTER);
        return;
    }

    let updates = {};

    Object.keys(firebaseMenu).forEach(key => {
        let item = firebaseMenu[key];

        // nếu thiếu field thì thêm, KHÔNG reset soldToday
        if (item.limit === undefined) updates[`${key}/limit`] = 100;
        if (item.gia === undefined) updates[`${key}/gia`] = 0;
    });

    if (Object.keys(updates).length > 0) {
        db.ref("menu").update(updates);
    }
});


let DANH_SACH_NV = [];

// (Listener realtime cho NhanSu đã được gộp về 1 chỗ duy nhất phía sau file,
//  tránh chạy song song 2 listener trùng lặp mỗi khi dữ liệu nhân sự thay đổi)

/*6.KHAI BÁO BÀN*/
db.ref("tables").on("value", s => {
    if (!s.val()) {
        const defaultTables = [
            // BÀN (ID 1-8)
            {id:1,name:"Bàn 1",status:"empty",type:"table"},
            {id:2,name:"Bàn 2",status:"empty",type:"table"},
            {id:3,name:"Bàn 3",status:"empty",type:"table"},
            {id:4,name:"Bàn 4",status:"empty",type:"table"},
            {id:5,name:"Bàn 5",status:"empty",type:"table"},
            {id:6,name:"Bàn 6",status:"empty",type:"table"},
            {id:7,name:"Bàn 7",status:"empty",type:"table"},
            {id:8,name:"Bàn 8",status:"empty",type:"table"},

            // BAR (ID 9-13)
            {id:9,name:"Bar 1",status:"empty",type:"bar"},
            {id:10,name:"Bar 2",status:"empty",type:"bar"},
            {id:11,name:"Bar 3",status:"empty",type:"bar"},
            {id:12,name:"Bar 4",status:"empty",type:"bar"},
            {id:13,name:"Bar 5",status:"empty",type:"bar"},
        ];
        db.ref("tables").set(defaultTables);
        TABLES = defaultTables;
    } else {
        TABLES = s.val();
    }

    // 1. Vẽ lại sơ đồ bàn (Để cập nhật màu sắc)
    renderTables();

    // 2. CẬP NHẬT LẠI NÚT BẤM (CỰC KỲ QUAN TRỌNG)
    // Mỗi khi dữ liệu bàn trên Firebase thay đổi, ta phải kiểm tra lại
    // bàn đang chọn để hiện nút đúng với trạng thái mới nhất.
    if (currentTableId) {
        capNhatNut();
    }
});
db.ref("menu").on("value", s => { MENU = s.val() || []; renderMenu(); if (typeof renderStockStatus === "function") renderStockStatus(); });



db.ref("hoivien").on("value", s => { HOIVIEN = []; s.forEach(c => { HOIVIEN.push({id:c.key, ...c.val()}) }); renderHoiVien(); });
db.ref("chitieu").on("value", s => { CHITIEU = []; s.forEach(c => { CHITIEU.push({id:c.key, ...c.val()}) }); renderChiTieu(); });

/*7.CHUYỂN TAB*/
function switchTab(id, btn) {
    // 1. Ẩn tất cả các tab, NHƯNG trừ những tab đang nằm trong Modal
    document.querySelectorAll('.tab-content').forEach(c => {
        // Nếu tab-content không nằm trong modal-hoivien thì mới ẩn
        if (!c.closest('#modal-hoivien')) {
            c.style.display = 'none';
        }
    });

    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

    // 2. Hiển thị tab được chọn
    const targetTab = document.getElementById(id);
    if (targetTab) {
        targetTab.style.display = 'block';
    }
    if (btn) btn.classList.add('active');

    // Logic báo cáo giữ nguyên của bạn
    if (id === 'tab-bao-cao') {
        const today = new Date().toISOString().split('T')[0];
        if (!document.getElementById("report-from").value) {
            document.getElementById("report-from").value = today;
            document.getElementById("report-to").value = today;
        }
        taiBaoCaoDoanhThu();
    }
}

let currentFilter = 'all'; 

/*8.LỌC KHO*/
function filterKho(type, element) {
    // 1. Cập nhật biến lọc toàn cục
    currentFilter = type;

    // 2. Tìm tất cả các nút có class filter-tab
    const tabs = document.querySelectorAll('.filter-tab');
    
    tabs.forEach(btn => {
        btn.classList.remove('active');
        // Ép kiểu CSS thủ công nếu class active chưa có trong file CSS
        btn.style.background = "transparent";
        btn.style.color = "#94a3b8";
    });

    // 3. Kích hoạt nút hiện tại
    if (element) {
        element.classList.add('active');
        element.style.background = "#3b82f6";
        element.style.color = "#fff";
    }

    // 4. Vẽ lại bảng
    renderKho();
}

/*8.VẼ KHO*/
function renderKho() {
    const dataSource = (typeof KHO !== 'undefined') ? KHO : KHO_MASTER;
    const container = document.getElementById("kho-list-body");
    
    // Lấy giá trị tìm kiếm (nếu có ô input tìm kiếm)
    const searchInput = document.getElementById("search-kho");
    const filterText = searchInput ? searchInput.value.toLowerCase() : "";

    if (!container || !dataSource) return;

    let h = "";
    let s = { tong: 0, sapHet: 0, hetHang: 0, duHang: 0 };

    // --- LOGIC LỌC KẾT HỢP (LOẠI + TÌM KIẾM) ---
    const dataToRender = dataSource.filter(item => {
        const matchType = (currentFilter === 'all' || item.loai === currentFilter);
        const matchSearch = item.ten.toLowerCase().includes(filterText);
        return matchType && matchSearch;
    });

    // Thống kê dựa trên toàn bộ dữ liệu
    dataSource.forEach(k => {
        const ton = Number(k.ton) || 0;
        const limit = Number(k.limit) || 0;
        s.tong++;
        if (ton <= 0) s.hetHang++;
        else if (ton <= limit) s.sapHet++;
        else s.duHang++;
    });

    dataToRender.forEach((k) => {
        const trueIndex = dataSource.findIndex(item => item.id === k.id);
        const ton = Number(k.ton) || 0;
        const limit = Number(k.limit) || 0;
        
        // --- TÍNH %: Tồn kho bằng định mức là 100% ---
        const phanTram = limit > 0 ? Math.round((ton / limit) * 100) : 0;
        
        let color = "#10b981"; // Đủ (Xanh)
        let statusText = "Đủ hàng";
        
        if (ton <= 0) { 
            color = "#ef4444"; 
            statusText = "Hết hàng"; 
        } else if (ton <= limit) { 
            color = "#fbbf24"; 
            statusText = "Sắp hết"; 
        }

       h += `
        <tr style="border-bottom:1px solid #0f172a55;">
            <td style="padding:12px 20px;">
                <div style="display:flex; flex-direction:column;">
                    <b style="color:#fff; font-size:14px; display:flex; align-items:center; gap:8px;">${k.ten}</b>
                    <div style="font-size:11px; color:#64748b;">${k.dvt}</div>
                </div>
            </td>

            <!-- Tồn kho & % (Hiển thị % bên dưới thanh bar) -->
            <td style="padding:12px 20px;">
                <div style="color:${color}; font-weight:bold; font-size:15px;">${ton.toFixed(1)} <small>${k.dvt}</small></div>
                <div style="width:120px; height:6px; background:#0f172a; border-radius:10px; margin-top:6px; overflow:hidden;">
                    <div style="width:${Math.min(100, phanTram)}%; height:100%; background:${color}; border-radius:10px; transition:0.5s;"></div>
                </div>
                <div style="font-size:10px; color:#64748b; margin-top:4px;">${phanTram}% so với định mức</div>
            </td>

            <td style="padding:12px 20px;">
                <div style="display:flex; align-items:center; gap:5px; background:#0f172a; padding:5px 10px; border-radius:8px; border:1px solid #334155; width: fit-content;">
                    <input type="number" value="${limit}" onchange="updateLimitKho(${trueIndex}, this.value)"
                           style="width:45px; background:transparent; border:none; color:#fff; text-align:center; outline:none; font-size:13px; font-weight:bold;">
                    <span style="color:#64748b; font-size:11px;">${k.dvt}</span>
                </div>
            </td>

            <td style="padding:12px 20px;">
                <span style="background:${color}22; color:${color}; padding:4px 12px; border-radius:20px; font-size:11px; font-weight:bold; border:1px solid ${color}33;">
                    ${statusText}
                </span>
            </td>

            <td style="padding:12px 20px; text-align:center;">
                <div style="display:flex; justify-content:center; align-items:center; gap:8px;">
                    <button onclick="changeKho(${trueIndex}, -1)" style="background:#0f172a; border:1px solid #334155; color:#fff; width:30px; height:30px; border-radius:8px; cursor:pointer;">-</button>
                    <!-- GIÁ TRỊ MẶC ĐỊNH LÀ 0 -->
                    <input type="number" id="input-kho-${trueIndex}" value="0" style="width:40px; background:transparent; border:none; color:#fff; text-align:center; font-weight:bold; outline:none;">
                    <button onclick="changeKho(${trueIndex}, 1)" style="background:#0f172a; border:1px solid #334155; color:#fff; width:30px; height:30px; border-radius:8px; cursor:pointer;">+</button>
                </div>
            </td>
        </tr>`;
    });

    container.innerHTML = h;
    
    // Cập nhật thống kê
    if(document.getElementById('stat-kho-tong')) document.getElementById('stat-kho-tong').innerText = s.tong;
    if(document.getElementById('stat-kho-saphet')) document.getElementById('stat-kho-saphet').innerText = s.sapHet;
    if(document.getElementById('stat-kho-hethang')) document.getElementById('stat-kho-hethang').innerText = s.hetHang;
    if(document.getElementById('stat-kho-duhang')) document.getElementById('stat-kho-duhang').innerText = s.duHang;
}

/* 9. THAY ĐỔI KHO - CÓ XÁC NHẬN, GHI NHẬT KÝ & CẬP NHẬT REAL-TIME */
async function changeKho(index, direction) {
    const inputElement = document.getElementById(`input-kho-${index}`);
    const amount = parseFloat(inputElement.value);
    const item = KHO[index];

    // 1. Kiểm tra số lượng nhập
    if (isNaN(amount) || amount <= 0) {
        alert("Vui lòng nhập số lượng hợp lệ vào ô trống!");
        return;
    }

    // 2. Hiện thông báo xác nhận chi tiết
    const hanhDong = direction > 0 ? "NHẬP THÊM" : "XUẤT KHO";
    const xacNhan = confirm(`Bạn xác nhận ${hanhDong} ${amount} ${item.dvt} cho món: ${item.ten}?`);
    if (!xacNhan) return;

    // 3. Tính toán tồn mới
    let newTon = parseFloat((item.ton + (amount * direction)).toFixed(1));
    if (newTon < 0) {
        alert("Lỗi: Số lượng tồn kho không đủ để xuất!");
        return;
    }

    // 4. CẬP NHẬT CỤC BỘ TRƯỚC (Giúp giao diện mượt mà và giữ nguyên định mức)
    KHO[index].ton = newTon;

    try {
        // 5. Cập nhật tồn kho lên Firebase (Chỉ update field 'ton')
        await db.ref("kho/" + index).update({ ton: newTon });

        // 6. GHI NHẬT KÝ BIẾN ĐỘNG (Tab Nhật ký)
        await db.ref("lich_su_kho").push({
            thoi_gian: new Date().toLocaleString('vi-VN'),
            ten_sp: item.ten,
            hanh_dong: direction > 0 ? "Nhập kho" : "Xuất kho",
            so_luong: amount,
            dvt: item.dvt,
            ton_moi: newTon,
            nguoi_thuc_hien: "Nguyễn Kim Anh" // Tên cố định
        });

        // 7. Reset giao diện & Render lại
        inputElement.value = 0;
        if (typeof renderKho === "function") {
            renderKho(); // Vẽ lại giao diện với tồn mới và định mức cũ
        }
        alert("Đã cập nhật kho thành công!");
        
    } catch (error) {
        console.error("Lỗi cập nhật:", error);
        alert("Có lỗi xảy ra khi kết nối Firebase!");
    }
}

/*9b. NHẬP NHANH KHO - Bù lỗi thiếu hàm moFormNhapKho() khiến nút "+ Nhập nhanh" không hoạt động */
async function moFormNhapKho() {
    if (!Array.isArray(KHO) || KHO.length === 0) {
        alert("Chưa có dữ liệu kho để nhập!");
        return;
    }

    // 1. Tìm nguyên liệu theo tên
    const tuKhoa = prompt("Nhập tên nguyên liệu cần nhập kho (VD: Thịt bò):");
    if (!tuKhoa || !tuKhoa.trim()) return;

    const index = KHO.findIndex(item => item.ten.toLowerCase().includes(tuKhoa.trim().toLowerCase()));
    if (index === -1) {
        alert("Không tìm thấy nguyên liệu có tên chứa: " + tuKhoa);
        return;
    }
    const item = KHO[index];

    // 2. Nhập số lượng cần thêm
    const slNhap = prompt(`Nhập số lượng ${item.dvt} muốn NHẬP THÊM cho "${item.ten}" (tồn hiện tại: ${item.ton}):`);
    if (slNhap === null) return;
    const amount = parseFloat(slNhap);
    if (isNaN(amount) || amount <= 0) {
        alert("Số lượng không hợp lệ!");
        return;
    }

    if (!confirm(`Xác nhận NHẬP THÊM ${amount} ${item.dvt} cho món: ${item.ten}?`)) return;

    const newTon = parseFloat((item.ton + amount).toFixed(1));
    KHO[index].ton = newTon;

    try {
        await db.ref("kho/" + index).update({ ton: newTon });
        await db.ref("lich_su_kho").push({
            thoi_gian: new Date().toLocaleString('vi-VN'),
            ten_sp: item.ten,
            hanh_dong: "Nhập kho",
            so_luong: amount,
            dvt: item.dvt,
            ton_moi: newTon,
            nguoi_thuc_hien: "Nguyễn Kim Anh"
        });

        if (typeof renderKho === "function") renderKho();
        alert("✅ Đã nhập kho nhanh thành công!");
    } catch (error) {
        console.error("Lỗi nhập kho nhanh:", error);
        alert("Có lỗi xảy ra khi kết nối Firebase!");
    }
}

/*10.HÀM CẬP NHẬT GIỚI HẠN */
function updateLimitKho(index, giaTriMoi) {
    const val = parseFloat(giaTriMoi);
    if (isNaN(val) || val < 0) {
        renderKho();
        return;
    }

    KHO[index].limit = val;

    // PHẢI LƯU LÊN FIREBASE ĐỂ KHÔNG BỊ GHI ĐÈ KHI THAY ĐỔI TỒN KHO
    db.ref("kho/" + index).update({ 
        limit: val 
    }).then(() => {
        console.log("✅ Đã lưu định mức lên server");
        renderKho();
    });
}

/*10.LỊCH SỬ KHO*/
function listenLichSu() {
    db.ref("lich_su_kho").limitToLast(50).on("value", s => {
        const data = s.val();
        const container = document.getElementById("history-list-body");
        if (!container) return;

        let h = "";
        if (data) {
            const list = Object.values(data).reverse();
            list.forEach(log => {
                const isNhap = log.hanh_dong && log.hanh_dong.toLowerCase().includes("nhập");
                
                h += `
                <tr style="border-bottom:1px solid #334155; height: 50px;">
                    <td style="padding:10px 20px; color:#64748b; width: 18%; font-size: 11px;">${log.thoi_gian}</td>
                    <td style="padding:10px 20px; width: 22%;"><b style="color:#fff;">${log.ten_sp}</b></td>
                    <td style="padding:10px 20px; width: 12%;">
                        <span style="color:${isNhap ? '#10b981' : '#ef4444'}; font-weight:bold;">
                            ${isNhap ? '↓ Nhập' : '↑ Xuất'}
                        </span>
                    </td>
                    <td style="padding:10px 20px; width: 15%; text-align: right; font-weight:bold; color:#fff;">
                        ${log.so_luong} <small style="color:#64748b;">${log.dvt || ''}</small>
                    </td>
                    <td style="padding:10px 20px; width: 18%; color:#3b82f6; text-align: center;">
                        ${log.nguoi_thuc_hien || "Admin"}
                    </td>
                    <td style="padding:10px 20px; width: 15%; color:#10b981; font-weight:bold; text-align: right;">
                        ${log.ton_moi || 0}
                    </td>
                </tr>`;
            });
        } else {
            h = `<tr><td colspan="6" style="padding:40px; text-align:center; color:#64748b;">Chưa có hoạt động nào</td></tr>`;
        }
        container.innerHTML = h;
    });
}
// Gọi hàm này 1 lần khi ứng dụng khởi chạy
listenLichSu();

/*10.MỞ LỊCH SỬ KHO*/
function moLichSuKho() {
    const khungLichSu = document.getElementById('khung-lich-su');
    
    if (khungLichSu.style.display === 'none') {
        // Nếu đang ẩn thì hiện lên
        khungLichSu.style.display = 'block';
        // Cuộn xuống để người dùng thấy bảng vừa hiện
        khungLichSu.scrollIntoView({ behavior: 'smooth' });
    } else {
        // Nếu đang hiện thì ẩn đi (bấm lần 2 để đóng)
        khungLichSu.style.display = 'none';
    }
}

/*10.CHUYỂN TAB KHO*/
function switchTabKho(tab, element) {
    const vTon = document.getElementById('view-ton-kho');
    const vLichSu = document.getElementById('view-lich-su-kho');
    
    if(vTon) vTon.style.display = (tab === 'kho' ? 'block' : 'none');
    if(vLichSu) vLichSu.style.display = (tab === 'lichsu' ? 'block' : 'none');

    document.querySelectorAll('.tab-kho-item').forEach(el => {
        el.style.color = '#94a3b8';
        el.style.borderBottom = 'none';
    });
    if(element) {
        element.style.color = '#3b82f6';
        element.style.borderBottom = '2px solid #3b82f6';
    }
}

/*10.XÓA LỊCH SỬ KHO*/
function xoaLichSu() {
    // 1. Thiết lập mật khẩu admin của bạn ở đây
    const ADMIN_PASSWORD = "123"; 

    // 2. Hỏi mật khẩu trước khi cho phép xóa
    const password = prompt("Chức năng này chỉ dành cho Admin. Vui lòng nhập mật khẩu xác nhận:");

    if (password === null) return; // Người dùng bấm Hủy

    if (password === ADMIN_PASSWORD) {
        // Nếu đúng mật khẩu thì mới hỏi xác nhận lần cuối
        if (confirm("XÁC NHẬN QUAN TRỌNG: Bạn có chắc chắn muốn xóa toàn bộ Nhật ký biến động kho không? Hành động này không thể hoàn tác!")) {
            db.ref("lich_su_kho").remove()
                .then(() => {
                    alert("✅ Đã xóa sạch nhật ký kho.");
                })
                .catch((error) => {
                    alert("❌ Lỗi khi xóa: " + error.message);
                });
        }
    } else {
        alert("⚠️ Sai mật khẩu! Bạn không có quyền thực hiện chức năng này.");
    }
}

/*10.XUẤT EXCEL KHO*/
function xuatExcelKho() {
    // Kiểm tra xem thư viện đã load chưa
    if (typeof XLSX === 'undefined') {
        alert("Thư viện Excel chưa được tải. Vui lòng kiểm tra lại kết nối mạng hoặc link script!");
        return;
    }

    const dataSource = (typeof KHO !== 'undefined') ? KHO : KHO_MASTER;
    
    // Tạo bảng dữ liệu
    const dataExcel = dataSource.map((item, i) => ({
        "STT": i + 1,
        "Nguyên liệu": item.ten,
        "Tồn kho": item.ton,
        "Đơn vị": item.dvt,
        "Định mức": item.limit,
        "Tỷ lệ": item.limit > 0 ? Math.round((item.ton / item.limit) * 100) + "%" : "0%"
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataExcel);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Kho");
    
    // Xuất file
    XLSX.writeFile(workbook, "Bao_cao_ton_kho.xlsx");
}


/*11.Vẽ hội viên*/
function renderHoiVien() {
    // Hàm tính tuổi chính xác từ ngày sinh
    const tinhTuoi = (ngaySinhStr) => {
        if (!ngaySinhStr || ngaySinhStr === "---" || ngaySinhStr === "-") return "";
        const birthDate = new Date(ngaySinhStr);
        if (isNaN(birthDate.getTime())) return "";
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return ` (${age} tuổi)`;
    };
// =========================
// CSS HIỆU ỨNG SINH NHẬT
// =========================
if (!document.getElementById('birthday-member-style')) {

    const style = document.createElement('style');

    style.id = 'birthday-member-style';

    style.innerHTML = `

    @keyframes birthdayGlowMember {

        0% {
            box-shadow:
                0 0 0px rgba(251,191,36,0),
                0 0 0px rgba(236,72,153,0);
        }

        50% {
            box-shadow:
                0 0 25px rgba(251,191,36,0.35),
                0 0 40px rgba(236,72,153,0.25);
        }

        100% {
            box-shadow:
                0 0 0px rgba(251,191,36,0),
                0 0 0px rgba(236,72,153,0);
        }
    }

    @keyframes birthdayBorderMember {

        0% {
            border-color:#f59e0b;
        }

        50% {
            border-color:#ec4899;
        }

        100% {
            border-color:#f59e0b;
        }
    }

    @keyframes giftFloatMember {

        0% {
            transform: translateY(0px);
        }

        50% {
            transform: translateY(-3px);
        }

        100% {
            transform: translateY(0px);
        }
    }

    .birthday-member-row {

        position:relative;

        overflow:hidden;

        border-radius:18px !important;

        animation:
            birthdayGlowMember 2.5s infinite ease-in-out,
            birthdayBorderMember 2s infinite linear;

        background:
            linear-gradient(
                135deg,
                #ffffff,
                #fff7ed,
                #fdf2f8
            ) !important;

        border:1px solid #f59e0b !important;
    }

    .birthday-member-row::before {

        content:'';

        position:absolute;

        top:0;
        left:-150%;

        width:120%;
        height:100%;

        background:
            linear-gradient(
                90deg,
                transparent,
                rgba(255,255,255,0.5),
                transparent
            );

        transform:skewX(-25deg);

        animation: birthdayShineMember 4s infinite;
    }

    @keyframes birthdayShineMember {

        0% {
            left:-150%;
        }

        100% {
            left:150%;
        }
    }

    .birthday-gift-btn {

        animation: giftFloatMember 1.5s infinite ease-in-out;
    }

    `;
    
    document.head.appendChild(style);
}

    // 1. Tải dữ liệu đơn hàng trước để làm dữ liệu đối chiếu
    db.ref("history_orders").once("value").then(orderSnap => {
        const orders = orderSnap.val() || {};

        // 2. Tải danh sách hội viên (Dùng .once vì hàm này được gọi lại rất nhiều lần;
        //    nếu dùng .on ở đây, mỗi lần renderHoiVien() chạy sẽ gắn thêm 1 listener mới
        //    và KHÔNG BAO GIỜ được gỡ bỏ -> rò rỉ bộ nhớ, app càng dùng càng nặng/giật.
        //    Việc tự động cập nhật realtime đã có listener riêng ở dưới lo (24/7).
        db.ref("members").once("value", (memberSnap) => {
            const memberData = memberSnap.val();
            tinhKpiHoiVien();
            let h = "";
            
            if (!memberData) {
                const el = document.getElementById("ds-hoi-vien-body");
                if (el) el.innerHTML = "<p style='text-align:center; padding:20px;'>Chưa có hội viên</p>";
                return;
            }
            
            tuDongCapNhatHangKhachHang();

            // 🟢 THỰC HIỆN PHÂN TRANG TẠI ĐÂY
            const memberKeys = Object.keys(memberData);
            const totalMembers = memberKeys.length;

            // Tính toán vị trí cắt mảng lấy 10 phần tử
            const startIndex = (currentPage - 1) * recordsPerPage;
            const endIndex = Math.min(startIndex + recordsPerPage, totalMembers);
            const paginatedKeys = memberKeys.slice(startIndex, endIndex);

            // Duyệt qua danh sách hội viên của trang hiện tại
            paginatedKeys.forEach((id) => {
                const v = memberData[id];
                
                // === BẮT ĐẦU TÍNH TOÁN THỐNG KÊ CHO TỪNG HỘI VIÊN ===
                let tongChiTieu = 0;
                let soLanDen = 0;
                let lastTimestamp = 0;

                // Quét qua các đơn hàng để tổng hợp
                Object.values(orders).forEach(o => {
                    // Kiểm tra nếu đơn hàng đó thuộc về hội viên này
                    if (o.customerId === id) {
                        tongChiTieu += Number(o.total) || 0;
                        soLanDen++;
                        
                        // Cập nhật timestamp lớn nhất (Lần cuối đến)
                        if (o.timestamp > lastTimestamp) {
                            lastTimestamp = o.timestamp;
                        }
                    }
                });

                // Định dạng ngày "Lần cuối" (dd/mm/yyyy)
                let lanCuoiStr = "---";
                if (lastTimestamp > 0) {
                    const d = new Date(lastTimestamp);
                    lanCuoiStr = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
                }

                // === DỮ LIỆU HỘI VIÊN ===
                const tenKhach = v.ten || "Khách hàng";
                const soDT = v.sdt || "---";
                const ngaySinh = v.ngaysinh || "---";
                const ngayThamGia = v.joinedDate || "---";
                const soThich = v.sothich || "Chưa rõ";
                const avatarTxt = tenKhach.split(' ').pop().charAt(0).toUpperCase();
                
                // Tích lũy điểm
                const tam = Number(v.tuy_tam_count) || 0;
                const thuong = Number(v.tuy_thuong_count) || 0;
                const tongDiem = tam + thuong;
                const percent = Math.min((tongDiem / 10) * 100, 100);
                
                // Tính số tuổi hiện tại
                const tuoiStr = tinhTuoi(ngaySinh);
// =========================
// CHECK SINH NHẬT
// =========================
let laSinhNhat = false;

if (ngaySinh && ngaySinh !== "---") {

    try {

        const birth = new Date(ngaySinh);

        if (!isNaN(birth.getTime())) {

            const today = new Date();

            laSinhNhat =
                birth.getDate() === today.getDate()
                &&
                birth.getMonth() === today.getMonth();
        }

    } catch(e) {}
}

                let slogan = "";
                let sloganColor = "";

                if (tongDiem >= 10) {
                    slogan = "100% - Đã đủ quà tặng! 🎁";
                    sloganColor = "#ef4444"; // Đỏ
                } else if (tongDiem >= 8) {
                    slogan = `${percent}% - Sắp nhận thưởng 🎉`;
                    sloganColor = "#f59e0b"; // Cam
                } else if (tongDiem >= 5) {
                    slogan = `${percent}% - Cố lên nhé! 💪`;
                    sloganColor = "#10b981"; // Xanh lá
                } else if (tongDiem >= 1) {
                    slogan = `${percent}% - Thưởng đang chờ bạn ✨`;
                    sloganColor = "#3b82f6"; // Xanh dương
                } else {
                    slogan = "0% - Bắt đầu hành trình thôi! 🚀";
                    sloganColor = "#94a3b8"; // Xám
                }

                const hang = v.rank || "MEMBER";

                // Tạo class đặc biệt cho hàng và avatar nếu là VIP
                const rowVipClass = hang === "VIP" ? "row-vip" : "";
                const avatarVipClass = hang === "VIP" ? "avatar-vip" : "";

                let badgeHTML = "";
                if (hang === "VIP") {
                    badgeHTML = `<span class="badge-vip">👑 VIP</span>`;
                } else if (hang === "NEW") {
                    badgeHTML = `<span style="font-size: 10px; background: #eff6ff; color: #2563eb; border: 1px solid #dbeafe; padding: 2px 6px; border-radius: 4px; font-weight: bold; margin-left: 6px;">🆕 NEW</span>`;
                } else if (hang === "ACTIVE") {
                    badgeHTML = `<span style="font-size: 10px; background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; padding: 2px 6px; border-radius: 4px; font-weight: bold; margin-left: 6px;">🔥 ACTIVE</span>`;
                } else {
                    badgeHTML = `<span style="font-size: 10px; background: #f8fafc; color: #64748b; border: 1px solid #e2e8f0; padding: 2px 6px; border-radius: 4px; font-weight: bold; margin-left: 6px;">MEMBER</span>`;
                }

// Render HTML hàng hội viên
h += `
<div
    id="member-row-${id}"
    class="${rowVipClass} ${laSinhNhat ? 'birthday-member-row' : ''}" style="border-bottom: 1px solid #f1f5f9;">
    <div style="display: grid; grid-template-columns: 2.5fr 2fr 2fr 2.5fr 1.2fr; align-items: center; padding: 15px 25px;">
    
        <!-- CỘT 1: HỘI VIÊN (Đã thêm sự kiện click vào Avatar) -->
<div style="display:flex; align-items:center; gap:12px; min-width: 0;">
    <!-- Thêm onclick và cursor:pointer vào thẻ Avatar bên dưới -->
    <div onclick="moChiTietHoiVien('${id}')" title="Bấm để xem chi tiết" class="${avatarVipClass}" style="min-width: 40px; height: 40px; border-radius: 50%; background: #e2e8f0; display: flex; align-items: center; justify-content: center; font-weight: bold; color: #475569; cursor: pointer; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.08)'" onmouseout="this.style.transform='scale(1)'">
        ${avatarTxt}
    </div>
    <div style="overflow: hidden;">
        <div style="font-weight:700; color:#1e293b; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; display: flex; align-items: center; gap: 5px;">
           ${tenKhach}

${badgeHTML}

${laSinhNhat ? `
<span style="
    font-size:10px;
    background:linear-gradient(135deg,#f59e0b,#ec4899);
    color:#fff;
    padding:3px 8px;
    border-radius:999px;
    font-weight:bold;
    box-shadow:0 0 10px rgba(236,72,153,0.3);
">
    🎂 SINH NHẬT
</span>
` : ''}
        </div>
        <div style="font-size:11px; color:#f59e0b; margin-top: 2px;">⭐ ${soThich}</div>
        <div style="font-size:10px; color:#94a3b8; margin-top: 2px;">📅 Tham gia: ${ngayThamGia}</div>
${laSinhNhat ? `

<div style="margin-top:8px;">

    <button
        class="birthday-gift-btn"
        onclick="
            if(!this.dataset.opened){

                this.dataset.opened='1';

                this.innerHTML='🎉 ĐÃ MỞ QUÀ';

                this.style.background='linear-gradient(135deg,#10b981,#059669)';

                alert(
                    '🎉 Chúc mừng sinh nhật ${tenKhach}!\\n\\n🎁 Phở Túy 11h xin gửi tặng tới quý anh chị 1 món quà bất ngờ nhân ngày sinh thành, cảm ơn quý anh chị đã luôn ủng hộ và nhớ tới Phở Túy.✨'
                );
            }
        "
        style="
            border:none;
            background:linear-gradient(135deg,#7c3aed,#ec4899);
            color:#fff;
            font-size:10px;
            font-weight:bold;
            padding:6px 10px;
            border-radius:10px;
            cursor:pointer;
            box-shadow:0 0 15px rgba(236,72,153,0.3);
        "
    >
        🎁 MỞ QUÀ SINH NHẬT
    </button>

</div>

` : ''}
    </div>
</div>

                        <!-- CỘT 2: LIÊN HỆ -->
                        <div style="padding-left: 10px; font-size:13px; color:#475569;">
                            <div style="font-weight: 600;">📞 ${soDT}</div>
                            <div style="font-size:11px; color:#94a3b8; margin-top: 3px;">🎂 ${ngaySinh}<span style="color:#475569; font-weight:bold;">${tuoiStr}</span></div>
                        </div>

                        <!-- CỘT 3: TÍCH LŨY (Sử dụng slogan và sloganColor ở đây) -->
                        <div>
                            <div style="font-size:12px; font-weight:700; color:#1e293b;">${tongDiem}/10 bát</div>
                            <div style="height:10px; background:#f1f5f9; border-radius:20px; margin-top:6px; width: 120px; overflow:hidden; border: 1px solid #e2e8f0;">
                                <div style="width:${percent}%; height:100%; background:${percent >= 100 ? '#ef4444' : '#10b981'}; border-radius:20px; transition: width 0.5s ease-in-out;"></div>
                            </div>
                            <div style="font-size: 10px; font-weight: 700; color: ${sloganColor}; margin-top: 6px; text-transform: uppercase; letter-spacing: 0.3px;">
                                ${slogan}
                            </div>
                        </div>

                        <!-- CỘT 4: THỐNG KÊ -->
                        <div style="font-size: 11px; color: #64748b;">
                            <div style="display: flex; gap: 8px; align-items: flex-start;">
                                <span style="font-size: 16px;">💵</span>
                                <div style="flex: 1;">
                                    <div style="display: flex; justify-content: space-between;">
                                        <span>Tổng chi tiêu</span>
                                        <span>Số lần đến</span>
                                    </div>
                                    <div style="display: flex; justify-content: space-between; font-weight: 800; color: #1e293b; font-size: 13px; margin-top: 2px;">
                                        <span>${tongChiTieu.toLocaleString()}đ</span>
                                        <span>${soLanDen} lần</span>
                                    </div>
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 6px; margin-top: 5px; padding-left: 2px;">
                                <i class="far fa-clock" style="font-size: 11px;"></i>
                                <span>Lần cuối: <b style="color: #475569;">${lanCuoiStr}</b></span>
                            </div>
                        </div>

                        <!-- CỘT 5: THAO TÁC -->
                        <div style="display:flex; justify-content: flex-end; gap:8px;">
                            <button onclick="xemLichSuKhach('${id}', '${tenKhach}')" style="border:none; background:#eff6ff; color:#3b82f6; width:30px; height:30px; border-radius:8px; cursor:pointer;"><i class="far fa-clock"></i></button>
                            <button onclick="chuanBiSua('${id}')" title="Sửa" style="border:none; background:#f0fdf4; color:#10b981; width:30px; height:30px; border-radius:8px; cursor:pointer;"><i class="far fa-edit"></i></button>
                            <button onclick="xoaHoiVien('${id}')" style="border:none; background:#fef2f2; color:#ef4444; width:30px; height:30px; border-radius:8px; cursor:pointer;"><i class="far fa-trash-alt"></i></button>
                        </div>
                    </div>
                </div>`;
            });
           const el = document.getElementById("ds-hoi-vien-body");
if (el) {
    el.innerHTML = h;
// 🟢 VẼ NÚT PHÂN TRANG RA GIAO DIỆN
            renderPagination(totalMembers);
} else {
    console.error("Không tìm thấy thẻ HTML có id='ds-hoi-vien-body' trên giao diện!");
}
        });
    });
}



/*11.HÀM HỖ TRỢ PHÂN TRANG HỘI VIÊN*/
function renderPagination(totalRecords) {
    const totalPages = Math.ceil(totalRecords / recordsPerPage);
    const paginationInfo = document.getElementById("pagination-info");
    const paginationButtons = document.getElementById("pagination-buttons");

    if (!paginationInfo || !paginationButtons) return;

    const start = totalRecords === 0 ? 0 : (currentPage - 1) * recordsPerPage + 1;
    const end = Math.min(currentPage * recordsPerPage, totalRecords);
    paginationInfo.innerText = `Hiển thị ${start} - ${end} / ${totalRecords} hội viên`;

    let buttonsHTML = "";

    // Nút lùi
    buttonsHTML += `<button onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''} style="padding: 5px 12px; border-radius: 8px; border: 1px solid #e2e8f0; background: ${currentPage === 1 ? '#f1f5f9' : 'white'}; cursor: ${currentPage === 1 ? 'not-allowed' : 'pointer'};">&laquo;</button>`;

    // Các nút số trang
    for (let i = 1; i <= totalPages; i++) {
        const isActive = i === currentPage;
        buttonsHTML += `<button onclick="changePage(${i})" style="padding: 5px 12px; border-radius: 8px; border: ${isActive ? 'none' : '1px solid #e2e8f0'}; background: ${isActive ? '#10b981' : 'white'}; color: ${isActive ? 'white' : '#1e293b'}; cursor: pointer; font-weight: ${isActive ? 'bold' : 'normal'};">${i}</button>`;
    }

    // Nút tiến
    buttonsHTML += `<button onclick="changePage(${currentPage + 1})" ${currentPage === totalPages || totalPages === 0 ? 'disabled' : ''} style="padding: 5px 12px; border-radius: 8px; border: 1px solid #e2e8f0; background: ${currentPage === totalPages || totalPages === 0 ? '#f1f5f9' : 'white'}; cursor: ${currentPage === totalPages || totalPages === 0 ? 'not-allowed' : 'pointer'};">&raquo;</button>`;

    paginationButtons.innerHTML = buttonsHTML;
}

/*11.HÀM CHUYỂN TRANG HỘI VIÊN*/
function changePage(page) {
    currentPage = page;
    renderHoiVien();
}


/*11.KPI HỘI VIÊN*/
function tinhKpiHoiVien() {
    // 1. Tải dữ liệu đơn hàng trước
    db.ref("history_orders").once("value").then(orderSnap => {
        const orders = orderSnap.val() || {};

        // 2. Tải danh sách hội viên
        db.ref("members").once("value").then(snap => {
            const data = snap.val();
            if (!data) return;

            const membersList = Object.keys(data).map(k => ({ ...data[k], id: k }));
            const tongHoiVien = membersList.length;

            // --- THIẾT LẬP THỜI GIAN HIỆN TẠI (Tháng 5/2026) ---
            const now = new Date();
            const currentMonth = now.getMonth() + 1; // Tháng thực tế: 1 - 12
            const currentYear = now.getFullYear();

            // Tính tháng trước để so sánh
            let prevMonth = currentMonth - 1;
            let prevMonthYear = currentYear;
            if (prevMonth === 0) {
                prevMonth = 12;
                prevMonthYear = currentYear - 1;
            }

            // Ngày đầu tuần này (Thứ 2)
            const dayOfWeek = now.getDay() || 7;
            const startOfWeek = new Date(now);
            startOfWeek.setHours(0, 0, 0, 0);
            startOfWeek.setDate(now.getDate() - (dayOfWeek - 1));

            // Ngày đầu tháng này
            const startOfMonth = new Date(currentYear, currentMonth - 1, 1, 0, 0, 0, 0);

            let hoiVienThangNay = 0;
            let hoiVienThangTruoc = 0;
            let soHoiVienTichCuc = 0;
            let soSapDatThuong = 0;
            let tongTichLuyHeThong = 0;

            // Duyệt danh sách hội viên
            membersList.forEach(m => {
                // --- CARD 1: Đếm số hội viên mới tháng này và tháng trước ---
                if (m.joinedDate) {
                    const parts = m.joinedDate.split("/");
                    if (parts.length === 3) {
                        const joinMonth = parseInt(parts[1], 10);
                        const joinYear = parseInt(parts[2], 10);

                        // Đếm tháng này
                        if (joinMonth === currentMonth && joinYear === currentYear) {
                            hoiVienThangNay++;
                        }
                        // Đếm tháng trước
                        if (joinMonth === prevMonth && joinYear === prevMonthYear) {
                            hoiVienThangTruoc++;
                        }
                    }
                }

                // --- CARD 2: Hội viên tích cực (Tuần & Tháng) ---
                let denTrongTuan = 0;
                let denTrongThang = 0;

                Object.values(orders).forEach(o => {
                    if (o.customerId === m.id) {
                        const t = Number(o.timestamp) || 0;
                        if (t >= startOfWeek.getTime()) denTrongTuan++;
                        if (t >= startOfMonth.getTime()) denTrongThang++;
                    }
                });

                if (denTrongTuan >= 2 || denTrongThang >= 8) {
                    soHoiVienTichCuc++;
                }

                // --- CARD 3: Sắp đạt thưởng (8 - 9 điểm) ---
                const tam = Number(m.tuy_tam_count) || 0;
                const thuong = Number(m.tuy_thuong_count) || 0;
                const tongDiem = tam + thuong;

                if (tongDiem >= 8 && tongDiem < 10) {
                    soSapDatThuong++;
                }

                // --- CARD 4: Tổng tích lũy ---
                tongTichLuyHeThong += tongDiem;
            });

            // ==========================================================
            // 🟢 CẬP NHẬT GIAO DIỆN KPI
            // ==========================================================

            // --- CARD 1: Tổng hội viên & Tăng trưởng ---
            // Số hội viên mới tăng thêm/giảm đi so với tháng trước đó
            const growthHoiVien = hoiVienThangNay - hoiVienThangTruoc;
            const growthStr = growthHoiVien >= 0 ? `+${growthHoiVien}` : `${growthHoiVien}`;

            if (document.getElementById("stat-total-members")) {
                document.getElementById("stat-total-members").innerText = tongHoiVien.toLocaleString();
            }
            if (document.getElementById("stat-members-growth")) {
                document.getElementById("stat-members-growth").innerText = growthStr;
                // Đổi màu: Tăng thì màu xanh lá, giảm thì màu đỏ
                document.getElementById("stat-members-growth").style.color = growthHoiVien >= 0 ? "#10b981" : "#ef4444";
            }

            // --- CARD 2: Hội viên tích cực ---
            const pctActive = tongHoiVien > 0 ? ((soHoiVienTichCuc / tongHoiVien) * 100).toFixed(1) : 0;
            if (document.getElementById("stat-active-members")) {
                document.getElementById("stat-active-members").innerText = soHoiVienTichCuc.toLocaleString();
            }
            if (document.getElementById("stat-active-percent")) {
                document.getElementById("stat-active-percent").innerText = pctActive + "%";
            }

            // --- CARD 3: Sắp đạt thưởng ---
            const pctReward = tongHoiVien > 0 ? ((soSapDatThuong / tongHoiVien) * 100).toFixed(1) : 0;
            if (document.getElementById("stat-reward-members")) {
                document.getElementById("stat-reward-members").innerText = soSapDatThuong.toLocaleString();
            }
            if (document.getElementById("stat-reward-percent")) {
                document.getElementById("stat-reward-percent").innerText = pctReward + "%";
            }

            // --- CARD 4: Tổng tích lũy ---
            const MUC_TIEU_HE_THONG = 4500;
            const percentProgress = Math.min((tongTichLuyHeThong / MUC_TIEU_HE_THONG) * 100, 100).toFixed(1);

            if (document.getElementById("stat-progress-text")) {
                document.getElementById("stat-progress-text").innerText = `${tongTichLuyHeThong.toLocaleString()} / ${MUC_TIEU_HE_THONG.toLocaleString()}`;
            }
            if (document.getElementById("stat-progress-bar")) {
                document.getElementById("stat-progress-bar").style.width = percentProgress + "%";
            }

        });
    }).catch(err => console.error("Lỗi khi tính toán KPI hội viên:", err));
}




/*12.xóa hội viên*/
function xoaHoiVien(id) {
    if (!id) return;

    // 1. Lấy tên khách để xác nhận xóa cho chắc chắn
    db.ref("members/" + id).once("value").then(snap => {
        const v = snap.val();
        const tenKhach = v ? v.ten : "hội viên này";

        // 2. Hiện bảng xác nhận trước khi xóa hẳn
        if (confirm(`Bạn có chắc chắn muốn xóa "${tenKhach.toUpperCase()}" khỏi danh sách không?`)) {
            
            // 3. Thực hiện lệnh xóa trên Firebase
            db.ref("members/" + id).remove()
                .then(() => {
                    alert("✅ Đã xóa hội viên thành công!");
                    
                    // Nếu đang lỡ bấm sửa khách này thì reset luôn biến sửa
                    if (dangSuaId === id) {
                        dangSuaId = null;
                        if(typeof resetFormHoiVien === "function") resetFormHoiVien();
                    }
                })
                .catch(err => {
                    console.error("Lỗi xóa:", err);
                    alert("❌ Không thể xóa. Vui lòng kiểm tra lại kết nối!");
                });
        }
    });
}
/*13.cộng điểm hội viên*/
function cộngĐiểmHộiViên(sdtKhach, soBatAn) {
    // 1. Tìm hội viên có số điện thoại tương ứng
    const hv = HOIVIEN.find(h => h.sdt === sdtKhach);
    if (hv) {
        const newDiem = (hv.diem_tich_luy || 0) + soBatAn;
        
        // 2. Cập nhật lên Firebase
        db.ref("members/" + hv.id).update({
            diem_tich_luy: newDiem
        }).then(() => {
            if (newDiem >= 10) {
                alert(`Khách ${hv.ten} đã đủ 10 bát! Hãy tặng khách 1 bát miễn phí nhé.`);
            }
        });
    }
}

/*14.vẽ chi tiêu*/
function renderChiTieu() {
    let h = "", total = 0;
    CHITIEU.sort((a,b)=> new Date(b.ngay) - new Date(a.ngay)).forEach(c => {
        total += parseInt(c.tien.replace(/\D/g,''));
        h += `<tr><td>${c.ngay.split('-').reverse().join('/')}</td><td>${c.ten}</td><td>${c.tien}</td><td><button onclick="xoaChiTieu('${c.id}')">X</button></td></tr>`;
    });
    document.getElementById("ds-chi-tieu-body").innerHTML = h;
    document.getElementById("tong-chi-thang").innerText = total.toLocaleString() + "đ";
}

// LOGIC FUNCTIONS
let orderListener = null;



/*15.Chọn bàn */
function selectTable(id) {

    currentTableId = id;

    const currentTable = TABLES.find(
        t => String(t.id) === String(id)
    );

    if (!currentTable) return;

    // =========================
    // LOAD DISCOUNT
    // =========================

    currentDiscountPercent =
        currentTable.discount || 0;

    const couponSelect =
        document.getElementById("coupon-select");

    if (couponSelect) {
        couponSelect.value =
            currentDiscountPercent.toString();
    }

    // =========================
    // HEADER
    // =========================

    document.getElementById("table-header").innerText =
        currentTable.name;

    capNhatNut();

    // =========================
    // CUSTOMER UI
    // =========================

    const inputBox =
        document.querySelector(".customer-select-box");

    const infoEl =
        document.getElementById("selected-customer-card");

    // =========================
    // CÓ HỘI VIÊN
    // =========================

    if (currentTable.customerId) {

        if (inputBox) {
            inputBox.style.display = "none";
        }

        let cardEl =
            document.getElementById("selected-customer-card");

        if (!cardEl) {

            cardEl = document.createElement("div");

            cardEl.id = "selected-customer-card";

            if (inputBox) {
                inputBox.parentNode.insertBefore(
                    cardEl,
                    inputBox.nextSibling
                );
            }
        }

        // 🔥 CHỈ GỌI RENDER CARD MỚI
        db.ref(`members/${currentTable.customerId}`)
        .on("value", memberSnap => {

            const v = memberSnap.val() || {};

            renderCustomerCard(
                {
                    ...v,

                    points:
                        (Number(v.tuy_tam_count) || 0) +
                        (Number(v.tuy_thuong_count) || 0)
                },

                TABLES.indexOf(currentTable)
            );

        });

    }

    // =========================
    // KHÔNG CÓ HỘI VIÊN
    // =========================

    else {

        if (inputBox) {

            inputBox.style.display = "block";

            const input =
                document.getElementById(
                    "order-customer-input"
                );

            if (input) {
                input.value = "";
            }
        }

        if (infoEl) {
            infoEl.remove();
        }
    }

    // =========================
    // LISTENER ORDER
    // =========================

    if (orderListener) {

        orderListener.off();
    }

    orderListener =
        db.ref("orders/" + id);

    orderListener.on("value", s => {

        renderOrder(s.val() || []);

        capNhatNut();

    });

    // =========================
    // RENDER TABLES
    // =========================

    renderTables();

    // =========================
    // MOBILE AUTO OPEN
    // =========================

    if (window.innerWidth <= 1024) {

        const sheet =
            document.getElementById(
                'order-column'
            );

        if (sheet) {

            sheet.classList.add('mo-ra');
        }
    }
}



/*RENDER CARD HỘI VIÊN CHUNG*/
function renderCustomerCard(hv, tableIdx) {

    const inputBox = document.querySelector(".customer-select-box");

    let infoEl = document.getElementById("selected-customer-card");

    if (!infoEl) {

        infoEl = document.createElement("div");

        infoEl.id = "selected-customer-card";

        if (inputBox) {
            inputBox.parentNode.insertBefore(
                infoEl,
                inputBox.nextSibling
            );
        }
    }

    // =========================
    // BADGE
    // =========================

    let badgeHTML = "";

    if (hv.rank === "VIP") {

        badgeHTML = `
        <span style="
            font-size:10px;
            background:#fff7ed;
            color:#ea580c;
            border:1px solid #fed7aa;
            padding:3px 8px;
            border-radius:999px;
            font-weight:800;
            box-shadow:0 2px 8px rgba(245,158,11,0.15);
        ">
            👑 VIP
        </span>
        `;

    } else if (hv.rank === "ACTIVE") {

        badgeHTML = `
        <span style="
            font-size:10px;
            background:#f0fdf4;
            color:#166534;
            border:1px solid #bbf7d0;
            padding:3px 8px;
            border-radius:999px;
            font-weight:800;
        ">
            🔥 ACTIVE
        </span>
        `;

    } else if (hv.rank === "NEW") {

        badgeHTML = `
        <span style="
            font-size:10px;
            background:#eff6ff;
            color:#2563eb;
            border:1px solid #bfdbfe;
            padding:3px 8px;
            border-radius:999px;
            font-weight:800;
        ">
            🆕 NEW
        </span>
        `;

    } else {

        badgeHTML = `
        <span style="
            font-size:10px;
            background:#f8fafc;
            color:#64748b;
            border:1px solid #e2e8f0;
            padding:3px 8px;
            border-radius:999px;
            font-weight:800;
        ">
            MEMBER
        </span>
        `;
    }

    const ten = hv.ten || "Khách hàng";

    const points =
        (Number(hv.tuy_tam_count) || 0) +
        (Number(hv.tuy_thuong_count) || 0);

    const percent = Math.min((points / 10) * 100, 100);

    // =========================
    // CHECK SINH NHẬT
    // =========================

    let birthdayHTML = "";

    if (hv.ngaysinh) {

        const arr = hv.ngaysinh.split("-");

        if (arr.length === 3) {

            const thang = Number(arr[1]);
            const ngay = Number(arr[2]);

            const today = new Date();

            const isBirthday =
                today.getDate() === ngay &&
                (today.getMonth() + 1) === thang;

            if (isBirthday) {

                birthdayHTML = `
                <div style="
                    margin-top:8px;
                    padding:4px 10px;
                    border-radius:999px;
                    background:linear-gradient(135deg,#fdf2f8,#fce7f3);
                    border:1px solid #f9a8d4;
                    font-size:11px;
                    font-weight:800;
                    color:#be185d;
                    display:flex;
                    align-items:center;
                    gap:6px;
                    width:max-content;
                    box-shadow:0 4px 12px rgba(236,72,153,0.15);
                    animation:pulseBirthday 1.5s infinite;
                ">
                    🎂 Hôm nay là sinh nhật khách
                </div>
                `;
            }
        }
    }

    infoEl.innerHTML = `

    <style>
@keyframes giftPop {
    0% { transform:scale(1); }
    50% { transform:scale(1.12); }
    100% { transform:scale(1); }
}
        @keyframes pulseBirthday {
            0% { transform:scale(1); }
            50% { transform:scale(1.03); }
            100% { transform:scale(1); }
        }
    </style>

    <div style="
        position:relative;
        overflow:hidden;
        background:${hv.rank === 'VIP'
            ? 'linear-gradient(135deg,#fffdf7,#fffbeb)'
            : '#ffffff'};
        border:${hv.rank === 'VIP'
            ? '1px solid rgba(245,158,11,0.35)'
            : '1px solid #edf2f7'};
        border-radius:24px;
        padding:18px;
        margin-bottom:15px;
        box-shadow:
            0 10px 30px rgba(15,23,42,0.08),
            0 2px 10px rgba(15,23,42,0.04);
        transition:all .3s cubic-bezier(.4,0,.2,1);
        backdrop-filter:blur(10px);
    ">

        ${
            hv.rank === 'VIP'
            ? `
            <div style="
                position:absolute;
                top:-40px;
                right:-40px;
                width:120px;
                height:120px;
                background:rgba(245,158,11,0.10);
                filter:blur(40px);
                border-radius:50%;
            "></div>
            `
            : ''
        }

        <div style="
            display:flex;
            justify-content:space-between;
            align-items:flex-start;
            gap:14px;
            position:relative;
            z-index:2;
        ">

            <div style="
                display:flex;
                gap:14px;
                align-items:center;
                flex:1;
            ">

                <div style="
                    width:62px;
                    height:62px;
                    border-radius:20px;
                    background:
                        linear-gradient(
                            135deg,
                            #10b981 0%,
                            #059669 100%
                        );
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    color:white;
                    font-size:24px;
                    font-weight:900;
                    flex-shrink:0;
                    box-shadow:
                        inset 0 1px 1px rgba(255,255,255,0.25),
                        0 10px 24px rgba(16,185,129,0.35);
                ">
                    ${ten.split(' ').pop().charAt(0).toUpperCase()}
                </div>

                <div style="flex:1; min-width:0;">

                    <div style="
                        display:flex;
                        align-items:center;
                        gap:8px;
                        flex-wrap:wrap;
                    ">

                        <div style="
                            font-size:18px;
                            font-weight:900;
                            color:#0f172a;
                            letter-spacing:0.2px;
                        ">
                            ${ten}
                        </div>

                        ${badgeHTML}

                    </div>

<!-- DÒNG THÔNG TIN CHÍNH -->
<div style="
    margin-top:6px;
    display:flex;
    align-items:center;
    gap:8px;
    flex-wrap:wrap;
">

    <!-- SĐT -->
    <div style="
        font-size:12px;
        color:#64748b;
        display:flex;
        align-items:center;
        gap:5px;
        font-weight:600;
    ">
        📞 ${hv.sdt || "---"}
    </div>

    <!-- TỔNG -->
    <span style="
        font-size:11px;
        background:#f8fafc;
        color:#334155;
        padding:4px 10px;
        border-radius:999px;
        font-weight:800;
        border:1px solid #e2e8f0;
        display:flex;
        align-items:center;
        gap:4px;
    ">
        🍜 ${points}/10 bát
    </span>

    <!-- TÚY TÂM -->
    <span style="
        font-size:11px;
        background:#fff7ed;
        color:#ea580c;
        padding:4px 10px;
        border-radius:999px;
        font-weight:800;
        border:1px solid #fed7aa;
        display:flex;
        align-items:center;
        gap:4px;
    ">
        🍜 ${Number(hv.tuy_tam_count) || 0}
    </span>

    <!-- TÚY THƯỢNG -->
    <span style="
        font-size:11px;
        background:#eff6ff;
        color:#2563eb;
        padding:4px 10px;
        border-radius:999px;
        font-weight:800;
        border:1px solid #bfdbfe;
        display:flex;
        align-items:center;
        gap:4px;
    ">
        🍲 ${Number(hv.tuy_thuong_count) || 0}
    </span>



</div>

<!-- SỞ THÍCH + SINH NHẬT -->
<div style="
    margin-top:7px;
    display:flex;
    align-items:center;
    gap:8px;
    flex-wrap:wrap;
">

    <div style="
        font-size:12px;
        color:#f59e0b;
        font-weight:700;
        display:flex;
        align-items:center;
        gap:5px;
    ">
        ⭐ ${hv.sothich || "Chưa rõ"}
    </div>

    ${birthdayHTML}

</div>

                </div>
            </div>

            <div
                onclick="huyChonKhachVaoBan(${tableIdx})"
                style="
                    width:34px;
                    height:34px;
                    border-radius:12px;
                    background:rgba(239,68,68,0.08);
                    backdrop-filter:blur(10px);
                    color:#ef4444;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    cursor:pointer;
                    font-weight:900;
                    transition:0.25s;
                    flex-shrink:0;
                "
                onmouseover="this.style.transform='scale(1.08)'"
                onmouseout="this.style.transform='scale(1)'"
            >
                ✕
            </div>

        </div>

       <div style="
    margin-top:18px;
    position:relative;
    z-index:2;
">

   <div style="
    display:flex;
    justify-content:space-between;
    align-items:center;
    gap:10px;
    margin-bottom:10px;
">

    <!-- LEFT -->
    <div style="
        display:flex;
        align-items:center;
        gap:10px;
        flex-wrap:wrap;
    ">

        <div style="
            font-size:11px;
            color:#64748b;
            font-weight:900;
            letter-spacing:0.5px;
        ">
            TIẾN ĐỘ QUÀ TẶNG
        </div>

        ${
            points < 10
            ? `
            <div style="
                padding:4px 10px;
                border-radius:999px;
                background:linear-gradient(135deg,#fff7ed,#fffbeb);
                border:1px solid #fed7aa;
                font-size:11px;
                font-weight:800;
                color:#ea580c;
                display:flex;
                align-items:center;
                gap:5px;
                box-shadow:0 2px 10px rgba(251,191,36,0.12);
            ">
                🎁 Còn ${10 - points} bát nhận quà
            </div>
            `
            : `
            <div style="
                padding:4px 10px;
                border-radius:999px;
                background:linear-gradient(135deg,#ecfdf5,#f0fdf4);
                border:1px solid #86efac;
                font-size:11px;
                font-weight:900;
                color:#16a34a;
                display:flex;
                align-items:center;
                gap:5px;
                box-shadow:0 2px 10px rgba(34,197,94,0.12);
            ">
                🏆 Đã đạt quà VIP
            </div>
            `
        }

    </div>

    <!-- RIGHT -->
    <div style="
        color:#16a34a;
        font-size:13px;
        font-weight:900;
        flex-shrink:0;
    ">
        ${percent}%
    </div>

</div>

    <!-- THANH BAR -->
    <div style="
        position:relative;
        height:10px;
        background:#e5e7eb;
        border-radius:999px;
        overflow:visible;
    ">

        <!-- PROGRESS -->
        <div style="
            width:${percent}%;
            height:100%;
            background:
                linear-gradient(
                    90deg,
                    #16a34a,
                    #22c55e,
                    #34d399
                );
            border-radius:999px;
            transition:1s;
            box-shadow:
                0 0 12px rgba(34,197,94,0.35);
            position:relative;
        ">

            <!-- SHINE -->
            <div style="
                position:absolute;
                top:0;
                left:0;
                bottom:0;
                width:40%;
                background:
                    linear-gradient(
                        90deg,
                        transparent,
                        rgba(255,255,255,0.45),
                        transparent
                    );
                animation:shineBar 2s linear infinite;
            "></div>

        </div>

        <!-- MỐC 0 -->
        <div style="
            position:absolute;
            left:0%;
            top:50%;
            transform:translate(-50%,-50%);
            width:16px;
            height:16px;
            border-radius:50%;
            background:white;
            border:3px solid #22c55e;
            box-shadow:0 2px 6px rgba(0,0,0,0.08);
        "></div>

     <!-- MỐC 5 -->
<div style="
    position:absolute;
    left:50%;
    top:50%;
    transform:translate(-50%,-50%);
    width:30px;
    height:30px;
    display:flex;
    align-items:center;
    justify-content:center;
">

    <div style="
        width:28px;
        height:28px;
        border-radius:50%;
        background:${points >= 5
            ? 'linear-gradient(135deg,#22c55e,#16a34a)'
            : 'linear-gradient(135deg,#fbbf24,#f59e0b)'};
        display:flex;
        align-items:center;
        justify-content:center;
        color:white;
        font-size:${points >= 5 ? '15px' : '13px'};
        font-weight:900;
        border:3px solid white;
        box-shadow:${points >= 5
            ? '0 6px 18px rgba(34,197,94,0.35)'
            : '0 6px 16px rgba(251,191,36,0.35)'};
        animation:${points >= 5 ? 'giftPop 1.5s infinite' : 'none'};
        transition:all .3s ease;
    ">
        ${points >= 5 ? '🎉' : '🎁'}
    </div>

</div>

        <!-- MỐC 10 -->
        <div style="
            position:absolute;
            left:100%;
            top:50%;
            transform:translate(-50%,-50%);
            width:26px;
            height:26px;
            border-radius:50%;
            background:#16a34a;
            display:flex;
            align-items:center;
            justify-content:center;
            color:white;
            font-size:13px;
            font-weight:900;
            box-shadow:
                0 6px 16px rgba(22,163,74,0.35);
            border:3px solid white;
        ">
            💎
        </div>

    </div>

    <!-- LABEL -->
    <div style="
        margin-top:12px;
        display:flex;
        justify-content:space-between;
        font-size:11px;
        font-weight:800;
        color:#64748b;
        padding:0 2px;
    ">
        <span>Bắt đầu</span>
        <span>5 bát</span>
        <span>10 bát</span>
    </div>

    

            </div>

        </div>

    </div>
    `;
}









/*16.Thêm món - ĐÃ FIX LỖI NHẢY ĐIỂM REAL-TIME*/
function addItem(monId) {
    if (!currentTableId) return alert("Vui lòng chọn bàn!");
    
    if (typeof event !== 'undefined' && typeof playFlyEffect === "function") playFlyEffect(event);

    db.ref("orders/" + currentTableId).once("value").then(s => {
        let items = s.val() || [];
        
        const monDangBam = MENU_MASTER.find(m => m.id === monId);
        if (!monDangBam) return console.error("Không tìm thấy món với ID:", monId);

        // 1. CHECK HẾT HÀNG
        let conLai = (Number(monDangBam.limit) || 0) - (Number(monDangBam.soldToday) || 0);
        if (monDangBam.limit > 0 && conLai <= 0) {
            return alert(`❌ HẾT HÀNG: [${monDangBam.ten.toUpperCase()}]`);
        }

        // 2. 🔥 SỬA LỖI TẠI ĐÂY: Đọc ID khách hàng trực tiếp từ bàn trên Firebase thay vì mảng TABLES
        // (Tôi đang dùng đường dẫn tables/index dựa theo hàm số 34 của bạn)
        const tableIdx = TABLES.findIndex(t => String(t.id) === String(currentTableId));
        
        db.ref(`tables/${tableIdx}`).once('value').then(tableSnap => {
            const tableData = tableSnap.val() || {};
            const customerId = tableData.customerId; // Lấy đúng ID khách hàng đang ngồi bàn

            const addOrUpdateItem = (list, mon) => {
                let itemTonTai = list.find(i => i.id_mon === mon.id && !i.isReward && i.isSent !== true);
                if (itemTonTai) {
                    itemTonTai.sl += 1;
                } else {
                    list.push({ 
                        ...mon, 
                        id_mon: mon.id, 
                        id: Date.now(), 
                        sl: 1, 
                        isSent: false,
                        cooked: false
                    });
                }
            };

            // 👉 TRƯỜNG HỢP 1: KHÔNG CÓ HỘI VIÊN
            if (!customerId) {
                addOrUpdateItem(items, monDangBam);
                return db.ref("orders/" + currentTableId).set(items).then(() => hoanTatAddItem(items));
            }

           // 👉 TRƯỜNG HỢP 2: CÓ HỘI VIÊN (Tính bát và cộng Real-time)
return db.ref(`members/${customerId}`).once('value').then(snap => {
    let kh = snap.val() || { tuy_tam_count: 0, tuy_thuong_count: 0 };
    let plusTam = 0, plusThuong = 0;
    
    // Kiểm tra món ăn vừa bấm có thuộc nhóm tích điểm hay không
    if (monDangBam.id === "tuy_tam" || monDangBam.id === "combo_tam_chau") plusTam = 1;
    else if (monDangBam.id === "tuy_thuong" || monDangBam.id === "combo_thuong_thuy") plusThuong = 1;
    else if (monDangBam.id === "combo_song_long") plusThuong = 2;

    let tongTruoc = (Number(kh.tuy_tam_count) || 0) + (Number(kh.tuy_thuong_count) || 0);

    // Khách đã đủ 10 bát và gọi tiếp bát có tích điểm -> Tặng bát miễn phí
    if (tongTruoc >= 10 && (plusTam > 0 || plusThuong > 0)) {
        let giaUuDai = (kh.tuy_thuong_count >= kh.tuy_tam_count) ? 0 : 50000;
        items.push({
            id_mon: "tuy_thuong",
            ten: "Túy Thượng (Ưu đãi mốc 10)",
            gia: giaUuDai,
            sl: 1,
            id: Date.now(),
            isReward: true,
            isSent: false
        });
        kh.tuy_tam_count = 0; kh.tuy_thuong_count = 0;
        alert(`🎁 Đã áp dụng bát miễn phí / nâng cấp!`);
    } else {
        addOrUpdateItem(items, monDangBam);

        // Chỉ cộng điểm và xét quà tặng mốc 5 nếu món vừa thêm có tích điểm
        if (plusTam > 0 || plusThuong > 0) {
            kh.tuy_tam_count = (Number(kh.tuy_tam_count) || 0) + plusTam;
            kh.tuy_thuong_count = (Number(kh.tuy_thuong_count) || 0) + plusThuong;

            let tongSau = kh.tuy_tam_count + kh.tuy_thuong_count;
            
            // 🔥 SỬA LỖI TẠI ĐÂY: Thêm điều kiện (plusTam > 0 || plusThuong > 0)
            if (tongSau === 5) {
                items.push({ 
                    id_mon: "quay", 
                    ten: "Quẩy (Quà tặng 5 bát)", 
                    gia: 0, 
                    sl: 1, 
                    id: Date.now() + 1, 
                    isReward: true, 
                    isSent: false 
                });
                alert(`🎯 Tặng Quẩy mốc 5 bát!`);
            }
        }
    }

    // Cập nhật điểm ngay lập tức lên Firebase
    db.ref(`members/${customerId}`).update(kh);
    return db.ref("orders/" + currentTableId).set(items);
}).then(() => {
    hoanTatAddItem(items);
});
        });
    });
}

/*17.HOÀN TẤT ADDITEM*/
function hoanTatAddItem(items) {
    updateStatus(currentTableId, "ordering");
    if (typeof renderOrder === "function") renderOrder(items);
    if (typeof renderMembers === "function") renderMembers();
}



// =========================
// MAP ẢNH FULL MENU
// =========================

const MENU_IMAGES = {

    // MÓN CHÍNH
    tuy_tam:
        "https://i.postimg.cc/8cd71X1v/tam.png",

    tuy_thuong:
        "https://i.postimg.cc/Y0NvpDpY/Thuong.png",

    tiem_thuy:
        "https://i.postimg.cc/GtP4cgcv/Tiem-thuy.png",

    hoa_chau:
        "https://i.postimg.cc/cCGKGGNR/Hoa-chau.png",

    quay:
        "https://i.postimg.cc/W4Qz0czM/quay.png",

    // COMBO
    combo_thuong_thuy:
        "https://i.postimg.cc/7h15xtx7/Thuong-thuy.png",

    combo_tam_chau:
        "https://i.postimg.cc/mkWcWWGw/Tam-chau.png",

    combo_song_long:
        "https://i.postimg.cc/SRbXbbpD/Song-long.png"
};


/*18.VẼ ORDER*/
function renderOrder(items) {

    const orderItems = items || [];

    let h = "";
    let sub = 0;

    // =========================
    // DUYỆT MÓN
    // =========================

    orderItems.forEach((item, index) => {

        const sl = item.sl || 1;
        const gia = item.gia || 0;

        sub += gia * sl;

        const isSent = item.isSent === true;

        // =========================
        // FIX ẢNH
        // =========================

        const imageSrc =
            item.img ||
            MENU_IMAGES[item.id_mon] ||
            "https://i.postimg.cc/cCGKGGNR/Hoa-chau.png";

        h += `

        <div style="
            display:flex;
            align-items:center;
            gap:12px;
            padding:14px;
            border-bottom:1px solid #f1f5f9;
            background:white;
        ">

            <!-- ẢNH -->
            <div style="
                width:62px;
                height:62px;
                border-radius:16px;
                overflow:hidden;
                flex-shrink:0;
                background:#f8fafc;
                border:1px solid #e2e8f0;
                box-shadow:
                    0 4px 10px rgba(0,0,0,0.05);
            ">

                <img
                    src="${imageSrc}"
                    onerror="this.src='https://i.postimg.cc/cCGKGGNR/Hoa-chau.png'"
                    style="
                        width:100%;
                        height:100%;
                        object-fit:cover;
                    "
                >

            </div>

            <!-- INFO -->
            <div style="
                flex:1;
                min-width:0;
            ">

                <div style="
                    display:flex;
                    align-items:center;
                    gap:6px;
                    flex-wrap:wrap;
                ">

                    <div style="
                        font-size:15px;
                        font-weight:800;
                        color:#0f172a;
                    ">
                        ${item.ten}
                    </div>

                    <span style="
                        font-size:13px;
                    ">
                        ${isSent ? '✔️' : '🕒'}
                    </span>

                </div>

                <!-- NOTE -->
                <div style="
                    margin-top:6px;
                    display:flex;
                    align-items:center;
                    gap:6px;
                ">

                    <span style="
                        font-size:11px;
                        font-weight:700;
                        color:#8b5cf6;
                        flex-shrink:0;
                    ">
                        Ghi chú:
                    </span>

                    <input
                        type="text"
                        value="${item.note || ''}"
                        onchange="suaNote(${index}, this.value)"
                        placeholder="..."
                        style="
                            border:none;
                            outline:none;
                            background:transparent;
                            width:100%;
                            font-size:11px;
                            color:#64748b;
                            border-bottom:1px dashed #cbd5e1;
                            padding-bottom:2px;
                            font-style:italic;
                        "
                    >

                </div>

            </div>

            <!-- SỐ LƯỢNG -->
            <div style="
                background:#f3f0ff;
                color:#7c3aed;
                min-width:34px;
                height:34px;
                border-radius:12px;
                display:flex;
                align-items:center;
                justify-content:center;
                font-size:12px;
                font-weight:900;
                flex-shrink:0;
            ">
                x${sl}
            </div>

            <!-- GIÁ -->
            <div style="
                width:85px;
                text-align:right;
                flex-shrink:0;
            ">

                <div style="
                    font-size:15px;
                    font-weight:900;
                    color:#0f172a;
                ">
                    ${(gia * sl).toLocaleString()}đ
                </div>

            </div>

            <!-- XÓA -->
            <button
                onclick="xoaMon(${index})"
                style="
                    width:34px;
                    height:34px;
                    border:none;
                    border-radius:12px;
                    background:#fef2f2;
                    color:#ef4444;
                    font-size:16px;
                    cursor:pointer;
                    flex-shrink:0;
                    transition:.2s;
                "
                onmouseover="
                    this.style.transform='scale(1.08)';
                "
                onmouseout="
                    this.style.transform='scale(1)';
                "
            >
                ✕
            </button>

        </div>
        `;
    });

    // =========================
    // HEADER
    // =========================

  const headerHTML = `
    <div style="
        display:flex;
        justify-content:space-between;
        align-items:center;
        padding:16px 18px;
        border-bottom:1px solid #edf2f7;
        background:white;
    ">
        <!-- Khối bên trái: Icon và Tiêu đề -->
        <div style="display:flex; align-items:center; gap:10px;">
            <div style="
                width:34px; height:34px; border-radius:12px;
                background: linear-gradient(135deg, #8b5cf6, #6d28d9);
                display:flex; align-items:center; justify-content:center;
                color:white; font-size:14px;
            ">
                📋
            </div>
            <div>
                <div style="font-size:14px; font-weight:900; color:#0f172a;">
                    DANH SÁCH MÓN
                </div>
                <div style="font-size:11px; color:#94a3b8; margin-top:2px;">
                    ${orderItems.length} món trong order
                </div>
            </div>
        </div>

        <!-- Khối ở giữa: Chữ Số Lượng (Vùng khoanh đỏ) -->
        <div style="
            font-size: 14px;
            font-weight: 700;
            color: #0f172a;
            flex-grow: 1;
            text-align: center; /* Căn giữa trong khoảng trống còn lại */
            margin-right: 20px; /* Tạo khoảng cách với badge tím */
        ">
            Số Lượng
        </div>

        <!-- Khối bên phải: Badge số lượng -->
        <div style="
            background:#f3f0ff;
            color:#7c3aed;
            padding:6px 14px;
            border-radius:999px;
            font-size:12px;
            font-weight:900;
            white-space: nowrap;
        ">
            ${orderItems.length} món
        </div>
    </div>
`;

    // =========================
    // RENDER
    // =========================

    document.getElementById("order-container").innerHTML = `

        <div style="
            background:white;
            border-radius:24px;
            overflow:hidden;
            box-shadow:
                0 10px 30px rgba(15,23,42,0.06),
                0 2px 10px rgba(15,23,42,0.04);
            display:flex;
            flex-direction:column;
            height:100%;
        ">

            ${headerHTML}

            <div style="
                flex:1;
                overflow-y:auto;
                max-height:calc(85vh - 350px);
                min-height:200px;
            ">

                ${
                    h ||
                    `
                    <div style="
                        padding:60px 20px;
                        text-align:center;
                        color:#94a3b8;
                        font-size:14px;
                        font-weight:700;
                    ">
                        🍜 Chưa có món ăn
                    </div>
                    `
                }

            </div>

        </div>
    `;

    // =========================
    // TÍNH TIỀN
    // =========================

    const discountAmount =
        Math.round(sub * (currentDiscountPercent / 100));

    const subAfterDiscount =
        sub - discountAmount;

    const tax =
        Math.round(subAfterDiscount * 0.02);

    const total =
        subAfterDiscount + tax;

    const updateText = (id, val) => {

        const el = document.getElementById(id);

        if (el) {
            el.innerText = val;
        }
    };

    updateText(
        "sub-total",
        sub.toLocaleString() + "đ"
    );

    updateText(
        "discount-val",
        "-" + discountAmount.toLocaleString() + "đ"
    );

    updateText(
        "tax-val",
        tax.toLocaleString() + "đ"
    );

    updateText(
        "total-price",
        total.toLocaleString() + "đ"
    );

    // QR

    if (typeof capNhatQRThanhToan === "function") {

        capNhatQRThanhToan(total);
    }

    // =========================
    // BUTTON
    // =========================

    const btnPrint =
        document.getElementById('step-print');

    const btnPay =
        document.getElementById('step-pay');

    const btnClear =
        document.getElementById('step-clear');

    const extra =
        document.getElementById('extra-actions');

    [btnPrint, btnPay, btnClear, extra]
        .forEach(el => {

            if (el) {
                el.style.display = 'none';
            }
        });

    if (orderItems.length > 0) {

        if (extra) {
            extra.style.display = 'flex';
        }

        const hasUnsent =
            orderItems.some(i => !i.isSent);

        if (hasUnsent) {

            btnPrint.style.display = 'block';

        } else {

            btnPay.style.display = 'block';
        }

    } else {

        const table =
            typeof TABLES !== 'undefined'
                ? TABLES.find(
                    t => t.id === currentTableId
                )
                : null;

        if (table?.status === 'paid') {

            btnClear.style.display = 'block';
        }
    }
}


/*19.SỬA GHI CHÚ MÓN*/
function suaNote(index, value) {
    if (!currentTableId) return;

    db.ref("orders/" + currentTableId).once("value").then(s => {
        let items = s.val() || [];

        if (items[index]) {
            items[index].note = value;
        }

        db.ref("orders/" + currentTableId).set(items);
    });
}
/*20.CHUYỂN BƯỚC TÍNH TOÁN TIỀN*/
function chuyenBuoc(st) {
    if (!currentTableId) return;

    db.ref("orders/" + currentTableId).once("value")
    .then(snapshot => {
        let items = snapshot.val() || [];

        // =====================================================
        // 1. IN BẾP (CHỈ XỬ LÝ MÓN MỚI)
        // =====================================================
        if (st === "printed") {
            // Lọc các món chưa gửi bếp
            const monMoi = items.filter(i => i.isSent === false || i.isSent === undefined);

            if (monMoi.length === 0) {
                return alert("⚠️ Bàn này không có món mới nào để gửi bếp!");
            }

            if (!confirm(`Xác nhận gửi ${monMoi.length} món mới xuống bếp & Trừ kho?`)) return Promise.reject("cancel");

            return db.ref("menu").once("value")
            .then(menuSnap => {
                let menuFromServer = menuSnap.val();
                if (!menuFromServer) throw "Không có menu!";

                const updateSold = (targetId, quantity) => {
                    for (let key in menuFromServer) {
                        if (menuFromServer[key].id === targetId) {
                            let hienTai = Number(menuFromServer[key].soldToday) || 0;
                            menuFromServer[key].soldToday = hienTai + Number(quantity);
                        }
                    }
                };

                // CHỈ TRỪ SUẤT BÁN VÀ TRỪ KHO CHO MÓN MỚI
                monMoi.forEach(item => {
                    const idGoc = item.id_mon || item.id;
                    
                    // A. Trừ suất bán trên Menu (Logic cũ của bạn)
                    if (idGoc === "tuy_tam" || idGoc === "tuy_thuong") updateSold(idGoc, item.sl);
                    if (idGoc === "combo_tam_chau") updateSold("tuy_tam", item.sl);
                    if (idGoc === "combo_thuong_thuy") updateSold("tuy_thuong", item.sl);
                    if (idGoc === "combo_song_long") updateSold("tuy_thuong", item.sl * 2);

                    // B. Trừ kho nguyên liệu ngay khi In bếp
                    if (typeof truKhoMoi === "function") {
                        if (idGoc && !String(idGoc).includes(Date.now().toString().substring(0,6))) {
                            truKhoMoi(idGoc, item.sl);
                        } else if (item.ten.includes("Hỏa Châu")) {
                            truKhoMoi("hoa_chau", item.sl);
                        }
                    }
                });

                // C. Đánh dấu tất cả món trong đơn là ĐÃ GỬI (Để lần sau gọi thêm không bị trùng)
                items.forEach(i => i.isSent = true);

                // --- PUSH MÓN XUỐNG BẾP CÓ KÈM ẢNH ---
const monGuiBep = monMoi.map(item => {

    const imageSrc =
        item.img ||
        MENU_IMAGES?.[item.id_mon] ||
        MENU_IMAGES?.[item.id] ||
        "https://i.postimg.cc/cCGKGGNR/Hoa-chau.png";

    return {
        ...item,
        img: imageSrc
    };
});

const kitchenPush = db.ref("kitchen_orders").push({

    tableId: currentTableId,

    tableName:
        TABLES.find(
            t => String(t.id) === String(currentTableId)
        )?.name || "Bàn " + currentTableId,

    timestamp: Date.now(),

    items: monGuiBep

});


                // D. Cập nhật đồng thời đơn hàng và Menu lên Firebase
               return Promise.all([
    db.ref("orders/" + currentTableId).set(items),
    db.ref("menu").set(menuFromServer),
    kitchenPush // Đợi đẩy lên bếp xong
]);
})
.then(() => updateStatus(currentTableId, "waiting"))
.then(() => {

    // E. Cập nhật mốc thời gian chờ cho màn hình Bếp (F5 không mất)
    const tableIdx = TABLES.findIndex(t => String(t.id) === String(currentTableId));

    if (tableIdx !== -1) {
        db.ref(`tables/${tableIdx}/timeAtBep`).set(Date.now());
    }

    if (typeof renderStockStatus === "function") {
        renderStockStatus();
    }

    capNhatNut();
});
        }

        // =====================================================
        // 2. THANH TOÁN (TÍNH BILL & TÍCH ĐIỂM)
        // =====================================================
        else if (st === "paid") {
            const currentTable = TABLES.find(t => String(t.id) === String(currentTableId));
            if (!currentTable) return;

            let subTotal = items.reduce((s, i) => s + (i.gia * i.sl), 0);
            let vatPercent = 0.02; // VAT 2%
            let discountPercent = currentTable.discount ? Number(currentTable.discount) : 0;

            let tienVAT = Math.round(subTotal * vatPercent);
            let tienGiamGia = Math.round(subTotal * (discountPercent / 100));
            let finalTotal = subTotal + tienVAT - tienGiamGia;

            if (!confirm(`Xác nhận thanh toán: ${finalTotal.toLocaleString()}đ?\n(Gốc: ${subTotal.toLocaleString()} + VAT 2% - Giảm: ${discountPercent}%)`)) {
                return Promise.reject("cancel");
            }

            // A. Tính điểm bát cho hội viên
            let soBat = 0;
            if (currentTable.customerId) {
                soBat = items.reduce((sum, i) => {
                    const idGoc = i.id_mon || i.id;
                    let heSo = (idGoc === 'combo_song_long') ? 2 : (i.isReward ? 0 : 1);
                    return sum + (i.sl * heSo);
                }, 0);
                if (soBat > 0 && typeof cộngĐiểmHộiViên === "function") {
                    cộngĐiểmHộiViên(currentTable.customerId, soBat);
                }
            }

            // B. Lưu lịch sử đơn hàng
            let promiseLaySDT = currentTable.customerId 
                ? db.ref("members/" + currentTable.customerId + "/sdt").once("value").then(s => s.val() || "")
                : Promise.resolve("");

            return promiseLaySDT.then(phoneFound => {
                const historyData = {
                    customerId: currentTable.customerId || null,
                    customerName: currentTable.customerName || "Khách vãng lai",
                    customerPhone: phoneFound,
                    tableName: currentTable.name || "Không rõ",
                    subTotal: subTotal,
                    discount: tienGiamGia,
                    total: finalTotal,
                    totalBowls: soBat,
                    timestamp: Date.now(),
                    items: items 
                };
                return db.ref("history_orders").push(historyData);
            })
            .then(() => {
                // C. Cập nhật trạng thái bàn sang ĐÃ THANH TOÁN (LƯU Ý: Không trừ kho ở đây nữa)
                let input = document.getElementById('order-customer-input');
                if (input) input.value = "";
                return updateStatus(currentTableId, "paid", true);
            })
            .then(() => {
    capNhatNut();
});
        }

       // =====================================================
// 3. DỌN BÀN (Ghi lịch sử & Làm sạch dữ liệu)
// =====================================================
else if (st === "empty") {
    if (!confirm("Xác nhận đã dọn sạch bàn để đón khách mới?")) return Promise.reject("cancel");

    const tableIdx = TABLES.findIndex(t => String(t.id) === String(currentTableId));
    const table = TABLES[tableIdx];

    // Tạo một mảng chứa các yêu cầu xử lý Firebase
    let tasks = [];

    // 🟢 KIỂM TRA ĐIỀU KIỆN LƯU LỊCH SỬ
    if (table && table.timeGiaoMon) {
        const gioKetThuc = Date.now();
        const soPhutAn = Math.floor((gioKetThuc - table.timeGiaoMon) / 60000);

        const lichSu = {
            tableId: table.id,
            tableName: table.name,
            customerName: table.customerName || "Khách vãng lai",
            startTime: table.timeGiaoMon,
            endTime: gioKetThuc,
            duration: soPhutAn >= 0 ? soPhutAn : 0,
            date: new Date().toLocaleDateString('vi-VN')
        };
        
        // Thêm lệnh push vào danh sách chờ xử lý
        tasks.push(db.ref("eating_history").push(lichSu));
    }

    // Lệnh xóa đơn hàng
    tasks.push(db.ref("orders/" + currentTableId).remove());

    // Lệnh cập nhật trạng thái bàn về trống
    if (tableIdx !== -1) {
        tasks.push(db.ref(`tables/${tableIdx}`).update({
            status: "empty",
            discount: 0,
            customerName: "",
            customerId: "",
            timeAtBep: null,    
            timeGiaoMon: null 
        }));
    }

    // Thực hiện tất cả các tác vụ cùng lúc
    return Promise.all(tasks).then(() => {
        console.log("✅ Đã dọn bàn và lưu lịch sử thành công!");
        capNhatNut();
        if (typeof renderTables === "function") renderTables();
    });
}


    })
    .catch(err => {
        if (err !== "cancel") {
            console.error("Lỗi vận hành:", err);
            alert("❌ Lỗi: " + err);
        }
    });
}

/*21.XÓA TÊN KHÁCH TRÊN FIREBASE*/
function updateStatus(id, st, clearCustomer = false) {
    const idx = TABLES.findIndex(t => t.id == id);
    if (idx === -1) return Promise.resolve(); // Nếu không thấy bàn thì thôi

    let updateData = { status: st };
    if (clearCustomer) {
        updateData.customerName = "";
        updateData.customerId = "";
    }

    // Trả về một "lời hứa" (Promise) để hàm chuyenBuoc có thể đợi
    return db.ref("tables/" + idx).update(updateData);
}

/*22.CẬP NHẬT NÚT*/
function capNhatNut() {
    if (!currentTableId) return;

    // Ép cả 2 về String để so sánh chuẩn 100%
    const table = TABLES.find(t => String(t.id) === String(currentTableId));
    
    if (!table) {
        console.log("❌ Không tìm thấy bàn ID:", currentTableId);
        return;
    }

    const st = table.status;

    // Truy cập trực tiếp vào style
    const btnPrint = document.getElementById("step-print");
    const btnPay = document.getElementById("step-pay");
    const btnClear = document.getElementById("step-clear");

    if(!btnPrint || !btnPay || !btnClear) return;

    // Ẩn tất cả trước
    btnPrint.style.display = "none";
    btnPay.style.display = "none";
    btnClear.style.display = "none";

    // Hiện theo trạng thái
   if (st === "ordering") {
    btnPrint.style.display = "block"; 
} else if (st === "eating") {
    btnPay.style.display = "block"; // CHỈ HIỆN KHI ĐANG ĂN
} else if (st === "paid") {
    btnClear.style.display = "block";
}
    
    console.log("🔄 Đã cập nhật nút cho bàn:", currentTableId, "Trạng thái:", st);
}

/*23.PAY*/
function pay() {
    if(!currentTableId) return;
    updateStatus(currentTableId, "clear");
    setTimeout(() => { db.ref("orders/" + currentTableId).remove(); updateStatus(currentTableId, "empty"); alert("Xong!"); }, 1000);
}

/*25.THÊM CHI TIÊU*/
function themChiTieu() {
    const ten = document.getElementById('cp-ten').value;
    const sl = document.getElementById('cp-sl').value;
    const tienRaw = document.getElementById('cp-tien').value;
    const ngay = document.getElementById('cp-ngay').value;

    // Kiểm tra dữ liệu
    if (!ten || !tienRaw) {
        alert("Vui lòng nhập tên hàng và số tiền!");
        return;
    }

    // Chuyển định dạng tiền từ chuỗi "5.000.000" về số 5000000
    const tien = parseInt(tienRaw.replace(/\./g, '')) || 0;

    const data = {
        ten: ten,
        sl: sl || 1,
        tien: tien,
        ngay: ngay || new Date().toISOString().split('T')[0], // Mặc định là ngày hôm nay nếu trống
        timestamp: Date.now()
    };

    // Gửi lên Firebase
    db.ref("expenses").push(data).then(() => {
        // --- BƯỚC QUAN TRỌNG: XÓA DỮ LIỆU CŨ ---
        document.getElementById('cp-ten').value = "";
        document.getElementById('cp-sl').value = "";
        document.getElementById('cp-tien').value = "";
        // Giữ lại ngày để nếu nhập nhiều món cùng lúc không phải chọn lại ngày
        
        console.log("Đã thêm chi phí!");
    }).catch(e => alert("Lỗi: " + e.message));
}

/*26.LOAD LỊCH SỬ CHI TIÊU*/
function loadLichSuChiTieu() {
    // Lắng nghe nhánh 'expenses' trên Firebase
    db.ref("expenses").on("value", (snapshot) => {
        const data = snapshot.val();
        const tbody = document.getElementById("ds-chi-tieu-body");
        if (!tbody) return;

        tbody.innerHTML = ""; // Xóa dữ liệu cũ trước khi vẽ mới
        let tongTien = 0;

        if (data) {
            // Chuyển đối tượng Firebase thành mảng và sắp xếp theo thời gian mới nhất lên đầu
            const list = Object.keys(data).map(key => ({
                id: key,
                ...data[key]
            })).reverse();

            list.forEach((item) => {
    const soTien = Number(item.tien) || 0;
    const soLuong = item.sl || 1;
    const donVi = layDonVi(item.ten); // Gọi hàm lấy đơn vị ở trên

    tbody.innerHTML += `
        <tr style="border-bottom: 1px solid #f9f9f9;">
            <td style="padding:10px; font-size:11px;">${item.ngay.split('-').reverse().join('/')}</td>
            <td style="padding:10px; text-align:left; font-weight:500;">${item.ten}</td>
            
            <!-- Ô SỐ LƯỢNG KÈM ĐƠN VỊ -->
            <td style="padding:10px; color:#555; font-size:13px;">
                ${soLuong} <span style="font-size:10px; color:#999;">${donVi}</span>
            </td>
            
            <td style="padding:10px; font-weight:bold; color:#d32f2f;">${soTien.toLocaleString()}đ</td>
            <td style="padding:10px;">
                <button onclick="xoaChiTieu('${item.id}')" style="..." >❌</button>
            </td>
        </tr>`;
});
        }

        // Cập nhật con số Tổng Chi màu vàng
        const tongChiEl = document.getElementById("tong-chi-thang");
        if (tongChiEl) tongChiEl.innerText = tongTien.toLocaleString() + "đ";
    });
}

// Gọi hàm này ngay khi trang web vừa load xong
loadLichSuChiTieu();


/*27.XÓA CHI TIÊU*/
function xoaChiTieu(id) {
    if (confirm("Bạn có chắc chắn muốn xóa khoản chi này?")) {
        db.ref("expenses/" + id).remove();
    }
}
/*28.LẤY ĐƠN VI CHI TIÊU*/
function layDonVi(tenMon) {
    const ten = tenMon.toLowerCase();
    if (ten.includes("thịt bò") || ten.includes("bánh phở") || ten.includes("sá sùng")) {
        return "kg";
    }
    if (ten.includes("trứng")) {
        return "quả";
    }
    if (ten.includes("quẩy")) {
        return "cái";
    }
    return ""; // Các món khác không có đơn vị thì để trống hoặc "suất"
}




/* 29. SỬA HỘI VIÊN */
window.dangSuaId = null;

window.chuanBiSua = function(id) {
    if (!id) return;
    window.dangSuaId = id;

    // 1. Tải dữ liệu từ Firebase
    db.ref("members/" + id).once("value").then(snap => {
        const hv = snap.val();
        if (!hv) return alert("Không tìm thấy dữ liệu hội viên!");

        const rowEl = document.getElementById(`member-row-${id}`);
        if (!rowEl) return alert("Không tìm thấy hàng hội viên trên giao diện!");

        // Lưu lại HTML hiện tại vào thuộc tính để khôi phục khi cần HỦY
        rowEl.setAttribute("data-old-html", rowEl.innerHTML);

        // Đổi giao diện sang các ô Input nhập liệu trực tiếp
        rowEl.innerHTML = `
        <div style="display: grid; grid-template-columns: 2.5fr 2fr 2fr 2.5fr 1.2fr; align-items: center; padding: 15px 25px; background: #fffdf5; border-bottom: 1px solid #f1f5f9; width:100%;">
            
            <!-- CỘT 1: SỬA THÔNG TIN -->
            <div style="display:flex; align-items:center; gap:12px; min-width: 0;">
                <div style="min-width: 40px; height: 40px; border-radius: 50%; background: #3b82f6; display: flex; align-items: center; justify-content: center; font-weight: bold; color: white;">
                    ${(hv.ten || "K").split(' ').pop().charAt(0).toUpperCase()}
                </div>
                <div style="width: 100%;">
                    <input type="text" id="edit-ten-${id}" value="${hv.ten || ''}" style="width: 90%; padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; font-weight: bold; margin-bottom: 4px; outline: none;">
                    <input type="text" id="edit-sothich-${id}" value="${hv.sothich || ''}" placeholder="Sở thích..." style="width: 90%; padding: 4px 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 11px; outline: none;">
                </div>
            </div>

            <!-- CỘT 2: SỬA LIÊN HỆ -->
            <div style="padding-left: 10px;">
                <input type="tel" id="edit-sdt-${id}" value="${hv.sdt || ''}" style="width: 90%; padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; font-weight: bold; margin-bottom: 4px; outline: none;">
                <input type="date" id="edit-ngaysinh-${id}" value="${hv.ngaysinh || ''}" style="width: 90%; padding: 4px 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 11px; color:#475569; outline: none;">
            </div>

            <!-- CỘT 3: TÍCH LŨY (Chỉ xem) -->
            <div style="font-size: 13px; color:#64748b; font-weight: bold; text-align: center;">
                ${(Number(hv.tuy_tam_count) || 0) + (Number(hv.tuy_thuong_count) || 0)}/10 bát
            </div>

            <!-- CỘT 4: TRẠNG THÁI -->
            <div style="font-size: 11px; color:#94a3b8; padding-left: 10px;">
                Đang chỉnh sửa...
            </div>

            <!-- CỘT 5: THAO TÁC LƯU / HỦY -->
            <div style="display:flex; justify-content: flex-end; gap:8px;">
                <button onclick="luuTrucTiep('${id}')" title="Lưu" style="border:none; background:#f0fdf4; color:#10b981; width:30px; height:30px; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:14px;">
                    ✔
                </button>
                <button onclick="huySua('${id}')" title="Hủy bỏ" style="border:none; background:#fef2f2; color:#ef4444; width:30px; height:30px; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:14px;">
                    ✖
                </button>
            </div>
        </div>`;
    }).catch(err => alert("Lỗi khi tải dữ liệu: " + err.message));
};

/*29.HÀM LƯU DỮ LIỆU ĐÃ SỬA*/
window.luuTrucTiep = function(id) {
    const tenRaw = document.getElementById(`edit-ten-${id}`).value.trim();
    const ten = window.chuanHoaTen ? window.chuanHoaTen(tenRaw) : tenRaw;
    const sdt = document.getElementById(`edit-sdt-${id}`).value.trim();
    const ngaysinh = document.getElementById(`edit-ngaysinh-${id}`).value;
    const sothich = document.getElementById(`edit-sothich-${id}`).value.trim();

    if (!ten || !sdt) {
        alert("⚠️ Không được để trống Tên và Số điện thoại!");
        return;
    }

    const data = { ten, sdt, ngaysinh, sothich };

    db.ref("members/" + id).update(data).then(() => {
        alert("✅ Đã cập nhật thành công!");
        window.dangSuaId = null;
        // Trình lắng nghe Firebase .on("value") sẽ tự vẽ lại giao diện mới
    }).catch(err => alert("Lỗi khi lưu: " + err.message));
};

/*29.HÀM THOÁT CHẾ ĐỘ SỬA (HỦY) */
window.huySua = function(id) {
    if (!id) return;
    window.dangSuaId = null;
    const rowEl = document.getElementById(`member-row-${id}`);
    
    // Khôi phục lại HTML nguyên bản
    if (rowEl && rowEl.getAttribute("data-old-html")) {
        rowEl.innerHTML = rowEl.getAttribute("data-old-html");
    }
};


/*29.TÌM KIẾM HỘI VIÊN*/
window.timKiemHoiVien = function() {
    // 1. Lấy từ khóa tìm kiếm và chuyển sang chữ thường
    const keyWord = document.getElementById("hv-search-input").value.toLowerCase().trim();
    
    // 2. Lấy tất cả các hàng hội viên đang có trong danh sách
    const listRow = document.querySelectorAll("#ds-hoi-vien-body > div");
    
    listRow.forEach(row => {
        // Tìm thẻ chứa Tên và Số điện thoại bên trong hàng đó
        const textContent = row.textContent.toLowerCase();

        // 3. Nếu từ khóa khớp với Tên hoặc SĐT thì HIỆN, ngược lại thì ẨN
        if (textContent.includes(keyWord)) {
            row.style.display = "block";
        } else {
            row.style.display = "none";
        }
    });
};



/*29.TỰ ĐỘNG CẬP NHẬT KHÁCH HÀNG*/
window.tuDongCapNhatHangKhachHang = function() {
    // 1. Tải lịch sử đơn hàng để đối chiếu
    db.ref("history_orders").once("value").then(orderSnap => {
        const orders = orderSnap.val() || {};

        // 2. Tải danh sách hội viên
        db.ref("members").once("value").then(memberSnap => {
            const members = memberSnap.val() || {};

            Object.keys(members).forEach(id => {
                const v = members[id];
                let tongChiTieu = 0;
                let soLanDen = 0;

                // Tính tổng chi tiêu và số lần đến thực tế từ history_orders
                Object.values(orders).forEach(o => {
                    if (o.customerId === id) {
                        tongChiTieu += Number(o.total) || 0;
                        soLanDen++;
                    }
                });

                // Xét hạng theo tiêu chí (Giống ảnh mẫu của bạn)
                let rankMoi = "MEMBER";

                if (tongChiTieu >= 5000000 || soLanDen >= 15) {
                    rankMoi = "VIP";
                } else if (soLanDen >= 2) {
                    rankMoi = "ACTIVE";
                } else {
                    rankMoi = "NEW";
                }

                // 🔥 Cập nhật trực tiếp lên Firebase nếu hạng cũ bị sai
                if (v.rank !== rankMoi) {
                    db.ref(`members/${id}`).update({ rank: rankMoi });
                }
            });
        });
    }).catch(err => console.error("Lỗi tự động xét hạng:", err));
};



/*29.MỞ BẢNG CHI TIẾT HỘI VIÊN*/
window.moChiTietHoiVien = function(id) {
    if (!id) return;

    // 1. Tải thông tin hội viên từ Firebase
    db.ref("members/" + id).once("value").then(snap => {
        const hv = snap.val();
        if (!hv) return alert("Không tìm thấy hội viên này!");

        // --- Đổ thông tin cơ bản ---
        document.getElementById("det-name").innerText = hv.ten || "Khách hàng";
        document.getElementById("det-phone").innerText = "📞 " + (hv.sdt || "---");
        
        let ageStr = "---";
        if (hv.ngaysinh && hv.ngaysinh !== "---" && hv.ngaysinh !== "-") {
            const age = new Date().getFullYear() - new Date(hv.ngaysinh).getFullYear();
            ageStr = `${hv.ngaysinh} (${age} tuổi)`;
        }
        document.getElementById("det-birth-age").innerText = "🎂 " + ageStr;
        document.getElementById("det-join").innerText = "📅 Tham gia: " + (hv.joinedDate || "---");
        document.getElementById("det-avatar").innerText = (hv.ten || "K").split(' ').pop().charAt(0).toUpperCase();

        // --- Tính điểm tích lũy ---
          const points = (Number(hv.tuy_tam_count) || 0) + (Number(hv.tuy_thuong_count) || 0);
        document.getElementById("det-points").innerText = points;
        document.getElementById("det-progress").style.width = Math.min((points / 10) * 100, 100) + "%";

        let sloganColor = "#94a3b8", sloganText = "Bắt đầu hành trình thôi! 🚀";
        if (points >= 10) { sloganColor = "#ef4444"; sloganText = "100% - ĐÃ ĐỦ QUÀ TẶNG! 🎁"; }
        else if (points >= 8) { sloganColor = "#f59e0b"; sloganText = "Sắp nhận thưởng 🎉"; }
        else if (points >= 5) { sloganColor = "#10b981"; sloganText = "Cố lên nhé! 💪"; }
        
        const sloganEl = document.getElementById("det-slogan");
        sloganEl.innerText = sloganText;
        sloganEl.style.color = sloganColor;

        // ==========================================================
        // 🟢 BẠN DÁN ĐOẠN CODE NÀY VÀO ĐÂY
        // ==========================================================
        const giftContainer = document.getElementById("det-gift-container");
        if (giftContainer) {
            if (points >= 10) {
                // Đủ 10 bát: Có hào quang, sao lớn/nhỏ lấp lánh và tự động xoay
                giftContainer.innerHTML = `
                    <div class="gift-glow-container" onclick="moQuaPhaoHoa(this)" title="Bấm để mở quà!">
                        <!-- Hào quang nền -->
                        <div class="gift-glow-bg"></div>
                        
                        <!-- Hệ thống sao xoay xung quanh -->
                        <div class="stars-orbit">
                            <span class="star star-big-1">✦</span>
                            <span class="star star-big-2">✦</span>
                            <span class="star star-small-1">✦</span>
                            <span class="star star-small-2">✦</span>
                        </div>
                        
                        <!-- Hộp quà ở giữa -->
                        <div class="gift-shake-pro">🎁</div>
                    </div>
                `;
            } else {
                // Chưa đủ: Hiện hộp quà tĩnh mờ 40%
                giftContainer.innerHTML = `
                    <div style="font-size:34px; opacity: 0.4; text-align:center; width:80px;">🎁</div>
                `;
            }
        }

        // 2. Tải lịch sử đơn hàng để tính toán Tổng chi tiêu, Số lần đến và Xét hạng chính xác
        db.ref("history_orders").once("value").then(orderSnap => {
            const orders = orderSnap.val() || {};
            let tongChiTieu = 0;
            let soLanDen = 0;
            let lastTimestamp = 0;
            let orderRows = "";

            // Thiết lập mốc thời gian để tính hạng ACTIVE
            const now = new Date();
            const dayOfWeek = now.getDay() || 7;
            const startOfWeek = new Date(now);
            startOfWeek.setHours(0, 0, 0, 0);
            startOfWeek.setDate(now.getDate() - (dayOfWeek - 1));

            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

            let denTrongTuan = 0;
            let denTrongThang = 0;

            const sortedOrders = Object.values(orders)
                .filter(o => o.customerId === id)
                .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

            sortedOrders.forEach((o, idx) => {
                const total = Number(o.total) || 0;
                const t = Number(o.timestamp) || 0;

                tongChiTieu += total;
                soLanDen++;
                
                if (t > lastTimestamp) lastTimestamp = t;
                if (t >= startOfWeek.getTime()) denTrongTuan++;
                if (t >= startOfMonth.getTime()) denTrongThang++;

                // Chỉ hiện 4 đơn hàng giao dịch gần nhất
                if (idx < 4) {
                    const d = new Date(t);
                    const timeStr = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
                    const dateStr = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
                    orderRows += `
                    <div style="display:flex; justify-content:space-between; padding:10px 15px; border-bottom:1px dashed #f1f5f9; align-items:center;">
                        <div>
                            <b>${dateStr}</b> <small style="color:#64748b; margin-left:5px;">${timeStr}</small>
                            <div style="font-size:11px; color:#94a3b8; margin-top:2px;">${o.tableName || 'Bàn'}</div>
                        </div>
                        <b style="color:#1e293b;">${total.toLocaleString()}đ</b>
                    </div>`;
                }
            });

            // =========================================================
            // 🟢 ĐỒNG BỘ LOGIC XÉT HẠNG GIỮA BADGE VÀ CARD THÔNG SỐ
            // =========================================================
            let currentRank = "MEMBER";
            if (tongChiTieu >= 5000000 || soLanDen >= 15) {
                currentRank = "VIP";
            } else if (denTrongTuan >= 2 || denTrongThang >= 8) {
                currentRank = "ACTIVE";
            } else {
                currentRank = "NEW";
            }

            // Gán dữ liệu 4 ô thống kê
            document.getElementById("det-total-spent").innerText = tongChiTieu.toLocaleString() + "đ";
            document.getElementById("det-visit-count").innerText = soLanDen + " lần";
            document.getElementById("det-rank-text").innerText = currentRank; // Đồng bộ ở ô thông số [INDEX]
            
            // Cập nhật lại nhãn badge ở trên đầu cho đồng bộ 100% [INDEX]
            const badgeEl = document.getElementById("det-badge");
            if (badgeEl) {
                if (currentRank === "VIP") {
                    badgeEl.className = "badge-vip";
                    badgeEl.innerHTML = "👑 VIP";
                    badgeEl.style.display = "inline-flex";
                } else if (currentRank === "ACTIVE") {
                    badgeEl.className = "";
                    badgeEl.style.cssText = "font-size:10px; background:#f0fdf4; color:#166534; border:1px solid #bbf7d0; padding:3px 8px; border-radius:6px; font-weight:bold; margin-left:6px;";
                    badgeEl.innerHTML = "🔥 ACTIVE";
                    badgeEl.style.display = "inline-flex";
                } else if (currentRank === "NEW") {
                    badgeEl.className = "";
                    badgeEl.style.cssText = "font-size:10px; background:#eff6ff; color:#2563eb; border:1px solid #dbeafe; padding:3px 8px; border-radius:6px; font-weight:bold; margin-left:6px;";
                    badgeEl.innerHTML = "🆕 NEW";
                    badgeEl.style.display = "inline-flex";
                } else {
                    badgeEl.className = "";
                    badgeEl.style.cssText = "font-size:10px; background:#f8fafc; color:#64748b; border:1px solid #e2e8f0; padding:3px 8px; border-radius:6px; font-weight:bold; margin-left:6px;";
                    badgeEl.innerHTML = "MEMBER";
                    badgeEl.style.display = "inline-flex";
                }
            }

            let lastVisitStr = "---";
            if (lastTimestamp > 0) {
                const ld = new Date(lastTimestamp);
                lastVisitStr = `${ld.getDate()}/${ld.getMonth() + 1}/${ld.getFullYear()}`;
            }
            document.getElementById("det-last-visit").innerText = lastVisitStr;

            // Đổ danh sách đơn hàng
            document.getElementById("det-order-list").innerHTML = orderRows || "<p style='text-align:center; padding:15px; color:#94a3b8; margin:0;'>Chưa có lịch sử giao dịch nào.</p>";
        });

        // Mở Drawer
        document.getElementById("member-detail-drawer").style.display = "flex";
    }).catch(err => console.error(err));
};



/*29.MỞ QUÀ PHÁO HOA*/
window.moQuaPhaoHoa = function(el) {
    // 1. Đổi icon hộp quà thành mở tung
    el.innerHTML = "🎉";
    el.classList.remove("gift-shake"); // Dừng lắc sau khi mở

    // 2. Kích hoạt pháo hoa (Confetti)
    const duration = 2 * 1000; // Thời gian bắn 2 giây
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100001 };


    function randomInRange(min, max) {
        return Math.random() * (max - min) + min;
    }

    const interval = setInterval(function() {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
            return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        
        // Bắn pháo hoa từ 2 góc màn hình
        confetti(Object.assign({}, defaults, { 
            particleCount, 
            origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } 
        }));
        confetti(Object.assign({}, defaults, { 
            particleCount, 
            origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } 
        }));
    }, 250);

    // 3. Sau khi pháo hoa xong, hiện thông báo xác nhận đã trao quà
    setTimeout(() => {
        if(confirm("Bạn đã trao quà (tặng bát miễn phí) cho khách hàng này chưa? \nBấm OK để trừ 10 điểm tích lũy và reset lại hành trình.")){
            // Code trừ điểm tích lũy của bạn sẽ viết ở đây
            alert("Đã reset điểm tích lũy của khách về 0!");
            el.innerHTML = "🎁"; // Trả lại icon cũ
            document.getElementById('member-detail-drawer').style.display = 'none'; // Đóng drawer
        }
    }, 2500);
};



/*29.LỌC NHANH HỘI VIÊN*/
window.locNhanhHoiVien = function(filterType, btnEl) {
    // 1. Đổi màu hiệu ứng nút bấm đang được chọn
    const allButtons = document.querySelectorAll("#quick-filter-container .btn-quick-filter");
    allButtons.forEach(btn => {
        btn.classList.remove("active");
        btn.style.background = "white";
        btn.style.color = "#64748b";
        btn.style.borderColor = "#e2e8f0";
        btn.style.fontWeight = "600";
    });

    btnEl.classList.add("active");

    // 2. Lọc danh sách hội viên đang hiển thị trên giao diện
    const rows = document.querySelectorAll("#ds-hoi-vien-body > div");
    
    rows.forEach(row => {
        // Kiểm tra text bên trong hàng để lọc
        const rowText = row.textContent || "";
        
        if (filterType === "tat-ca") {
            row.style.display = "block";
        } else if (filterType === "sap-dat-thuong") {
            // Lọc các khách hàng có chữ "Sắp nhận thưởng"
            if (rowText.includes("Sắp nhận thưởng")) {
                row.style.display = "block";
            } else {
                row.style.display = "none";
            }
        } else {
            // Lọc theo Rank: VIP, ACTIVE, NEW
            if (rowText.includes(filterType)) {
                row.style.display = "block";
            } else {
                row.style.display = "none";
            }
        }
    });
};




/*31.THÊM HVIEN*/
function themHoiVien() {
    const tenRaw = document.getElementById('hv-ten').value.trim();
    const ten = window.chuanHoaTen ? window.chuanHoaTen(tenRaw) : tenRaw;
    const sdt = document.getElementById('hv-sdt').value.trim();

    if (!ten || !sdt) {
        alert("⚠️ Vui lòng nhập đầy đủ tên và số điện thoại!");
        return;
    }

    const ngaySinh = document.getElementById('hv-ngaysinh').value;
    const soThich = document.getElementById('hv-sothich').value;

    // Dữ liệu chung cho cả Thêm và Sửa
    const data = {
        ten: ten,
        sdt: sdt,
        ngaysinh: ngaySinh,
        sothich: soThich
    };

    db.ref("members").once("value").then(snap => {
        const danhSachHoiVien = snap.val() || {};
        let trung = false;

        // Kiểm tra trùng Số điện thoại
        Object.keys(danhSachHoiVien).forEach(idKey => {
            const sdtDB = String(danhSachHoiVien[idKey].sdt || "").trim();
            const sdtInput = String(sdt).trim();

            if (sdtDB === sdtInput && idKey !== window.dangSuaId) {
                trung = true;
            }
        });

        if (trung) {
            alert(`❌ Số điện thoại ${sdt} đã tồn tại!`);
            return;
        }

        // ==========================================
        // 🟢 TRƯỜNG HỢP CẬP NHẬT HỘI VIÊN CŨ
        // ==========================================
        if (window.dangSuaId) {
            db.ref("members/" + window.dangSuaId).update(data)
                .then(() => {
                    alert("✅ Đã cập nhật thành công!");
                    resetFormHoiVien();
                })
                .catch(e => alert("Lỗi Firebase: " + e.message));
        } 
        // ==========================================
        // 🟢 TRƯỜNG HỢP THÊM HỘI VIÊN MỚI
        // ==========================================
        else {
            // Lấy ngày hiện tại làm ngày tham gia
            const d = new Date();
            const ngay = String(d.getDate()).padStart(2, '0');
            const thang = String(d.getMonth() + 1).padStart(2, '0');
            const nam = d.getFullYear();
            
            // Gán ngày tham gia dạng DD/MM/YYYY
            data.joinedDate = `${ngay}/${thang}/${nam}`; 

            // Khởi tạo các mốc tích lũy ban đầu
            data.tuy_tam_count = 0;
            data.tuy_thuong_count = 0;
            data.diem_tich_luy = 0;

            db.ref("members").push(data)
                .then(() => {
                    alert("✅ Đã thêm hội viên mới!");
                    resetFormHoiVien();
                })
                .catch(e => alert("Lỗi Firebase: " + e.message));
        }
    });
}
/*31.RS FORM HỘI VIÊN KHI LÀM XONG*/
function resetFormHoiVien() {
    document.getElementById('hv-ten').value = "";
    document.getElementById('hv-sdt').value = "";
    document.getElementById('hv-ngaysinh').value = "";
    document.getElementById('hv-sothich').value = "";
    
    dangSuaId = null;
    const btn = document.querySelector('.btn-add-member');
    btn.innerHTML = "+ THÊM HỘI VIÊN MỚI";
    btn.style.backgroundColor = "#2e7d32"; // Trả về màu xanh lá
}
/*32.TÌM KIẾM HV KHI GÕ*/
function searchHoiVien(keyword) {
    const val = keyword.toLowerCase().trim();
    const dropdown = document.getElementById("customer-dropdown");
    if (!dropdown) return;

    // PHẢI LẤY TỪ FIREBASE ĐỂ CÓ SỐ MỚI NHẤT
    db.ref("members").once("value").then(snapshot => {
        const data = snapshot.val();
        if (!data) return;

        let h = "";
        Object.keys(data).forEach(id => {
            const v = data[id];
            const ten = (v.ten || "").toLowerCase();
            const sdt = (v.sdt || "");

            // Lọc theo tên hoặc số điện thoại
            if (val === "" || ten.includes(val) || sdt.includes(val)) {
                
                // --- PHẦN QUAN TRỌNG: GỌI ĐÚNG TÊN BIẾN FIREBASE ---
             const tam = Number(v.tuy_tam_count) || 0; 
const thuong = Number(v.tuy_thuong_count) || 0;
const tong = Number(v.diem_tich_luy) || (tam + thuong);
const rank = v.rank || "MEMBER";
const sothich = v.sothich || "Chưa rõ"; // Bổ sung lấy sở thích [INDEX]

// Đóng gói toàn bộ dữ liệu hội viên thành chuỗi JSON (Đã thêm sothich) [INDEX]
const hvJson = JSON.stringify({
    id: id,
    ten: v.ten,
    sdt: v.sdt || "---",
    points: tong,
    rank: rank,
    sothich: sothich
}).replace(/"/g, '&quot;');

h += `
<div onclick="chonKhachVaoBan('${hvJson}')" 
     style="padding: 12px; border-bottom: 1px solid #f0f0f0; cursor: pointer; display: flex; justify-content: space-between; align-items: center;"
     onmouseover="this.style.background='#fff5f5'" 
     onmouseout="this.style.background='white'">
    <div>
        <b style="color:#333;">${v.ten}</b><br>
        <small style="color:#888;">📱 ${v.sdt || '---'}</small>
        <div style="font-size: 11px; color: #f59e0b; margin-top: 2px;">⭐ ${sothich}</div> <!-- Hiện sở thích ở list gợi ý -->
    </div>
    <div style="text-align: right;">
        <span style="font-size: 13px; color: #10b981; font-weight: bold;">🥣 ${tong} bát</span>
        <div style="font-size: 10px; color: #999; margin-top: 2px;">Hạng: ${rank}</div>
    </div>
</div>`;


            }
        });

        if (h) {
            dropdown.innerHTML = h;
            dropdown.style.display = "block";
        } else {
            dropdown.style.display = "none";
        }
    });
}

// Đóng danh sách khi nhấn ra ngoài
document.addEventListener("click", function(e) {
    const dropdown = document.getElementById("customer-dropdown");
    const input = document.getElementById("order-customer-input");
    if (dropdown && e.target !== input && !dropdown.contains(e.target)) {
        dropdown.style.display = "none";
    }
});


/*33.GỢI Ý TÌM KIẾM HV*/
function goiYTimKhach(val) {
    const resultsDiv = document.getElementById("search-results-dropdown");
    if (!val || val.trim().length === 0) {
        resultsDiv.style.display = "none";
        return;
    }

    db.ref("members").once("value").then(snap => {
        const members = snap.val();
        if (!members) return;

        let h = "";
        const keyword = val.toLowerCase();
        
        Object.keys(members).forEach(id => {
            const m = members[id];
            if (m.ten.toLowerCase().includes(keyword) || m.sdt.includes(keyword)) {
                h += `
                <div onclick="chonKhachVaoBan('${id}', '${m.ten}')" 
                     style="padding:10px; border-bottom:1px solid #eee; cursor:pointer;"
                     onmouseover="this.style.background='#f5f5f5'" 
                     onmouseout="this.style.background='white'">
                    <b>${m.ten}</b> - ${m.sdt}
                </div>`;
            }
        });

        if (h !== "") {
            resultsDiv.innerHTML = h;
            resultsDiv.style.display = "block";
        } else {
            resultsDiv.style.display = "none";
        }
    });
}




/*34.CHỌN HV VÀO BÀN*/
function chonKhachVaoBan(hvJson) {
    if (!currentTableId) return alert("Vui lòng chọn bàn!");

    const hv = JSON.parse(hvJson);
    const id = hv.id;
    const ten = hv.ten;
    const sothich = hv.sothich || "Chưa rõ"; // Bóc tách sở thích [INDEX]

    const tableIdx = TABLES.findIndex(t => String(t.id) === String(currentTableId));
    if (tableIdx !== -1) {
        TABLES[tableIdx].customerId = id;
        TABLES[tableIdx].customerName = ten;

        db.ref(`tables/${tableIdx}`).update({ customerId: id, customerName: ten }).then(() => {
 kichHoatLangNgheDiemKhach(id);
        
        console.log("✅ Đã nhận diện: " + ten);
            
            const inputBox = document.querySelector(".customer-select-box");
            if (inputBox) inputBox.style.display = "none";
            const dropdown = document.getElementById("customer-dropdown");
            if (dropdown) dropdown.style.display = "none";
            document.getElementById("order-customer-input").value = "";

            let infoEl = document.getElementById("selected-customer-card");
            if (!infoEl) {
                infoEl = document.createElement("div");
                infoEl.id = "selected-customer-card";
                if (inputBox) inputBox.parentNode.insertBefore(infoEl, inputBox.nextSibling);
            }
db.ref(`members/${id}`).once("value")
.then(snap => {

    const v = snap.val() || {};

    renderCustomerCard(
        {
            ...v,

            points:
                (Number(v.tuy_tam_count) || 0) +
                (Number(v.tuy_thuong_count) || 0)
        },

        tableIdx
    );

});
    

            if (typeof renderTables === "function") {
                renderTables(); 
            } else if (typeof renderSoDoBan === "function") {
                renderSoDoBan();
            }

            console.log("✅ Đã nhận diện: " + ten);
        }).catch(err => alert("Lỗi Firebase: " + err.message));
    }
}

/*29.HÀM HỦY CHỌN KHÁCH KHỎI BÀN (BỔ SUNG) */
window.huyChonKhachVaoBan = function(tableIdx) {
    if (tableIdx === undefined) return;

    // Xóa dữ liệu khách trên Firebase của bàn [INDEX]
    db.ref(`tables/${tableIdx}`).update({ customerId: null, customerName: null }).then(() => {
        // Cập nhật lại mảng TABLES cục bộ
        if (TABLES[tableIdx]) {
            TABLES[tableIdx].customerId = null;
            TABLES[tableIdx].customerName = null;
        }

        // Hiện lại ô tìm kiếm
        const inputBox = document.querySelector(".customer-select-box");
        if (inputBox) inputBox.style.display = "block";

        // Xóa Profile Card
        const infoEl = document.getElementById("selected-customer-card");
        if (infoEl) infoEl.remove();

        // Vẽ lại sơ đồ bàn để trả về chữ "Trống"
        if (typeof renderTables === "function") renderTables();
        else if (typeof renderSoDoBan === "function") renderSoDoBan();
        
    }).catch(err => alert("Lỗi khi gỡ khách: " + err.message));
};

/*35.XÓA HV*/
function xoaHV(id) { if(confirm("Xóa?")) db.ref("hoivien/"+id).remove(); }

/*36.SƯA KHO*/
function editKho(i, v) { KHO[i].ton += v; db.ref("kho").set(KHO); }


/*37.UPDATE NGÀY THÁNG*/
function updateClock() {
    const now = new Date();
    
    // 1. Cập nhật GIỜ (Giờ:Phút:Giây)
    const timeEl = document.getElementById("clock-time");
    if (timeEl) {
        timeEl.innerText = now.toLocaleTimeString('vi-VN', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
        });
    }

    // 2. Cập nhật THỨ, NGÀY/THÁNG/NĂM
    const dateEl = document.getElementById("clock-date");
    if (dateEl) {
        // Lấy tên Thứ (weekday) và định dạng ngày tháng
        const options = { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' };
        let dateString = now.toLocaleDateString('vi-VN', options);
        
        // Viết hoa chữ cái đầu (Ví dụ: thứ hai -> Thứ Hai)
        dateString = dateString.charAt(0).toUpperCase() + dateString.slice(1);
        
        dateEl.innerText = dateString;
    }
}

// Chạy ngay lập tức khi trang vừa load để không bị trễ 1 giây
updateClock(); 
// Chạy đồng hồ mỗi giây
setInterval(updateClock, 1000);

/*38.VẼ KHO*/
function renderStock(){
    let h = "";
    let warning = "";

    MENU.forEach(m => {
        const con = m.limit - (m.soldToday || 0);

        h += `<div>${m.ten}: ${con}/${m.limit}</div>`;

        if(con <= 5){
            warning += `⚠️ ${m.ten} sắp hết<br>`;
        }
    });

    document.getElementById("stock-display-list").innerHTML = h;
    document.getElementById("stock-warning-box").innerHTML = warning;
}



let currentMenuTab = 'don'; // Mặc định tab đầu tiên

/*39.SWITCH MENU TAB*/
function switchMenuTab(loai) {
    currentMenuTab = loai;

    // Lấy 2 nút bằng ID của bạn
    const btnDon = document.getElementById("btn-don");
    const btnCombo = document.getElementById("btn-combo");

    if (loai === 'don') {
        btnDon.style.background = "#2e7d32"; btnDon.style.color = "#fff";
        btnCombo.style.background = "#eee"; btnCombo.style.color = "#333";
    } else {
        btnCombo.style.background = "#2e7d32"; btnCombo.style.color = "#fff";
        btnDon.style.background = "#eee"; btnDon.style.color = "#333";
    }

    renderMenu(); // Vẽ lại danh sách món
}

/*40.VẼ MENU*/
function renderMenu() {
    const container = document.getElementById('menu-list');
    if (!container) return;

    // Lấy từ khóa tìm kiếm
    const searchInput = document.getElementById('menu-search');
    const filterText = searchInput ? searchInput.value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";

    const fragment = document.createDocumentFragment();

    // LOGIC LỌC MỚI: Nếu đang gõ tìm kiếm thì tìm TRÊN TOÀN BỘ MENU
    const filtered = MENU.filter(mon => {
        const tenMonKhongDau = (mon.ten || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const matchesSearch = tenMonKhongDau.includes(filterText);

        // Nếu ô tìm kiếm TRỐNG: Lọc theo Tab như bình thường
        if (filterText === "") {
            return (mon.loai || 'don') === currentMenuTab;
        }
        
        // Nếu ĐANG GÕ: Hiển thị tất cả các món khớp với tên (bất kể Đơn hay Combo)
        return matchesSearch;
    });

    filtered.forEach((mon, index) => {
        const isHet = (Number(mon.limit || 0) - Number(mon.soldToday || 0)) <= 0;
        const isLastAndOdd = (index === filtered.length - 1) && (filtered.length % 2 !== 0);

        const div = document.createElement("div");
        div.className = `menu-item food-card ${mon.loai === 'combo' ? 'combo-neon-glow' : 'single-neon-glow'} ${isLastAndOdd ? 'full-width-item' : ''}`;
        
        div.style.cssText = `
            position:relative; border-radius:15px;
            background:#fff; box-shadow: 0 2px 8px rgba(0,0,0,0.05);
            ${isHet ? 'opacity:0.5;' : ''}
        `;

        const { moTa, tenLoai } = getMoTa(mon);

        // Nút quà tặng ⭐
        const dsMonDuocTang = ['hoa_chau', 'tiem_thuy', 'quay'];
        const nutQuaTang = (dsMonDuocTang.includes(mon.id) && !isHet)
            ? `<span onclick="event.stopPropagation(); themQuaTangTrucTiep(${index})"
                style="cursor:pointer;font-size:18px;margin-left:8px;" title="Tặng quà">⭐</span>`
            : "";

        const laMauDo = mon.ten.includes('Thượng') || mon.ten.includes('Tiềm Thủy');
        const mauGia = laMauDo ? '#d32f2f' : '#000';

        div.innerHTML = `
            <div class="card-inner-wrapper" style="display:flex; align-items:flex-start; gap:12px; padding:12px;">
                <div class="food-left-zone" style="display:flex; flex-direction:column; align-items:center; gap:8px; flex-shrink:0; width:80px;">
                    <div style="width:80px;height:80px;overflow:hidden;border-radius:12px;background:#f0f0f0;border:1px solid #eee;">
                        <img src="${mon.img || 'https://placeholder.com'}"
                             style="width:100%;height:100%;object-fit:cover;">
                    </div>
                    <span style="background:#ffeb3b; border-radius:8px; font-size:12px; padding:4px 0; color:${mauGia}; font-weight:900; border:1px solid rgba(0,0,0,0.05); width:100%; text-align:center; display:block;">
                        ${(mon.gia || 0).toLocaleString()}đ
                    </span>
                </div>

                <div class="food-right-zone" style="flex:1; min-width:0; display:flex; flex-direction:column; gap:4px; padding-right:25px;">
                    <div style="font-weight:bold; font-size:15px; color:#333; display:flex; align-items:center; flex-wrap:wrap; line-height:1.2;">
                        ${mon.ten}
                        ${nutQuaTang}
                    </div>
                    ${tenLoai ? `<div style="font-size:10px; color:#888; font-weight:normal; background:#f5f5f5; padding:2px 6px; border-radius:4px; width:fit-content;">${tenLoai}</div>` : ''}
                    <div class="food-description" style="font-size:12px; color:#666; line-height:1.4; margin-top:2px;">
                        ${moTa}
                    </div>
                </div>
            </div>

            <button ${isHet ? 'disabled' : ''}
                style="position:absolute; bottom:12px; right:12px; width:35px; height:35px; border-radius:50%; border:none; color:#fff; font-size:22px; font-weight:bold; cursor:pointer; z-index:2;
                ${isHet ? "background:#ccc;" : (mon.loai === 'combo' ? "background:#e65100;" : "background:#2e7d32;")}">
                ${isHet ? "✕" : "+"}
            </button>
        `;

        const btn = div.querySelector("button");
        if (!isHet) {
            btn.addEventListener("click", (event) => {
                event.stopPropagation();
                playFlyEffect(event);
                addItem(mon.id); 
            });
        }

        fragment.appendChild(div);
    });

    container.innerHTML = "";
    container.appendChild(fragment);
}


/*41.MÔ TẢ MÓN*/
function getMoTa(mon) {
    let moTa = "";
    let tenLoai = "";

    // Gán loại tên phụ
    if (mon.ten.includes('Túy Tâm')) tenLoai = "Phở thường";
    else if (mon.ten.includes('Túy Thượng')) tenLoai = "Phở đặc biệt";
    else if (mon.ten.includes('Hỏa Châu')) tenLoai = "Trứng chần";
    else if (mon.ten.includes('Tiềm Thủy')) tenLoai = "Trứng hấp";

    // Logic xử lý mô tả
    if (mon.ten.includes('Túy Tâm')) {
        moTa = `<div class="scroll-container"><div class="scroll-text">Nước dùng thanh ngọt, thịt bò tươi thơm ngon, đậm đà vị truyền thống ✨</div></div>`;
    } else if (mon.ten.includes('Túy Thượng')) {
        moTa = `<div class="scroll-container"><div class="scroll-text">Thưởng thức tinh túy từ phần thịt lõi rùa quý hiếm, mềm tan trong thực quản 💎</div></div>`;
    } else if (mon.ten.includes('Hỏa Châu') || mon.ten.includes('Tiềm Thủy')) {
        let text = mon.ten.includes('Hỏa Châu') ? "Trứng gà tươi chần trong nước dùng thanh ngọt ✨" : "Ngâm trong nước cốt sá sùng quý giá, hấp cách thủy tinh hoa 🥚";
        moTa = `<div class="scroll-container"><div class="scroll-text">${text}</div></div>`;
    } else if (mon.ten.includes('Quẩy')) {
        moTa = `<div style="font-size:11px;color:#666;font-style:italic;">Giòn rụm (4 cái)</div>`;
    } else if (mon.loai === 'combo') {
        let slogan = mon.ten.includes('Thượng')
            ? 'Bậc quân tử thưởng thức tinh hoa ✨'
            : mon.ten.includes('Tâm')
               ? 'Năng lượng cho ngày mới ☀️'
               : 'Chiêu đãi bậc Đế Vương 👑';

        moTa = `
        <div style="font-size:11px;color:#666;margin-bottom:2px;">${mon.desc || ''}</div>
        <div class="scroll-container">
            <div class="scroll-text" style="font-weight:bold; color: inherit;">${slogan}</div>
        </div>`;
    }

    return { moTa, tenLoai };
}


/*42.XÓA MÓN*/
function xoaMon(index) {
    if (!currentTableId) return;

    db.ref("orders/" + currentTableId).once("value").then(s => {
        let items = s.val() || [];
        if (!items[index]) return;

        const itemHienTai = items[index];
        if (!confirm(`Xác nhận giảm/xóa món: ${itemHienTai.ten}?`)) return;

        const currentTable = TABLES.find(t => t.id == currentTableId);
        const customerId = currentTable ? currentTable.customerId : null;

        // TẠO MỘT PROMISE ĐỂ XỬ LÝ ĐIỂM TRƯỚC
        const updatePointsPromise = new Promise((resolve) => {
            if (customerId && !itemHienTai.isReward) {
                let truTam = 0, truThuong = 0;

                if (itemHienTai.id_mon === "tuy_tam" || itemHienTai.id_mon === "combo_tam_chau") truTam = 1;
                else if (itemHienTai.id_mon === "tuy_thuong" || itemHienTai.id_mon === "combo_thuong_thuy") truThuong = 1;
                else if (itemHienTai.id_mon === "combo_song_long") truThuong = 2;

               if (truTam > 0 || truThuong > 0) {
    db.ref(`members/${customerId}`).once('value').then(snap => {
        let kh = snap.val() || {};

        kh.tuy_tam_count = Math.max(0, (Number(kh.tuy_tam_count) || 0) - truTam);
        kh.tuy_thuong_count = Math.max(0, (Number(kh.tuy_thuong_count) || 0) - truThuong);

        db.ref(`members/${customerId}`).update({
            tuy_tam_count: kh.tuy_tam_count,
            tuy_thuong_count: kh.tuy_thuong_count
        }).then(() => resolve());
    });
} else { resolve(); }
            } else { resolve(); }
        });

        // SAU KHI XỬ LÝ ĐIỂM XONG THÌ MỚI XỬ LÝ ĐƠN HÀNG
        updatePointsPromise.then(() => {
            if (itemHienTai.sl > 1) {
                itemHienTai.sl -= 1;
            } else {
                items.splice(index, 1);
            }

            return db.ref("orders/" + currentTableId).set(items);
        }).then(() => {
            // Cập nhật trạng thái bàn nếu đơn trống
            if (items.length === 0) {
                updateStatus(currentTableId, "empty");
                const tableIdx = TABLES.findIndex(t => t.id == currentTableId);
                if (tableIdx !== -1) db.ref(`tables/${tableIdx}/customerName`).remove();
            }
            // Vẽ lại giao diện
            if (typeof renderOrder === "function") renderOrder(items);
            if (typeof renderHoiVien === "function") renderHoiVien();
        });
    });
}


/*43.VẼ BÀN*/
function renderTables() {
    let tH = "", bH = "";

    TABLES.forEach(t => {
        const isActive = t.id === currentTableId ? 'active-table' : '';
        
        // --- 1. LOGIC TÍNH SỐ NGƯỜI (SUẤT ĂN) ---
        let tongSuat = 0;
        // Sửa điều kiện: Chấp nhận mọi trạng thái trừ bàn Trống
if (t.status && t.status !== "empty") {
    // Lấy dữ liệu đơn hàng từ biến Real-time
    const orderOfTable = ALL_ORDERS[t.id]; 
    
    if (orderOfTable) {
        // Chuyển object thành mảng để duyệt (phòng trường hợp Firebase trả về object)
        const itemsArray = Array.isArray(orderOfTable) ? orderOfTable : Object.values(orderOfTable);
        
        itemsArray.forEach(item => {
            const idMon = item.id_mon || item.id;
            const sl = Number(item.sl) || 0;
            if (idMon === 'combo_song_long') {
                tongSuat += (sl * 2); 
            } else if (['tuy_tam', 'tuy_thuong', 'combo_tam_chau', 'combo_thuong_thuy'].includes(idMon)) {
                tongSuat += sl; 
            }
        });
    }
}

        const badgeNguoi = tongSuat > 0 
            ? `<div style="position:absolute; top:8px; left:8px; background:rgba(0,0,0,0.8); color:#fff; font-size:11px; padding:2px 7px; border-radius:12px; font-weight:bold; z-index:10; display:flex; align-items:center; gap:3px;">
                 ${tongSuat}
               </div>` 
            : "";

        // --- 2. THIẾT LẬP TRẠNG THÁI & THỜI GIAN ---
        let statusClass = "empty"; 
        let statusText = "Trống";
        let statusIcon = `<div class="status-circle color-empty"></div>`;
        let confirmBtn = ""; 

        if (t.status === "ordering") {
            statusClass = "ordering"; 
            statusText = "Đang chọn";
            statusIcon = `<div class="status-circle color-ordering"></div>`;
        } 
        else if (t.status === "waiting") {
            statusClass = "waiting"; 
            // Tính phút chờ bếp (Bẫy lỗi nếu số quá lớn)
            let phutCho = 0;
            if (t.timeAtBep) {
                let tinhCho = Math.floor((Date.now() - t.timeAtBep) / 60000);
                phutCho = (tinhCho < 0 || tinhCho > 600) ? 0 : tinhCho;
            }
            statusText = `Đợi: <b style="color:#ff9800;">${phutCho}p</b>`; 
            statusIcon = `<div style="font-size:20px; margin-bottom:5px;">📄</div>`;
            confirmBtn = `
            <div onclick="event.stopPropagation(); xacNhanGiaoMon(${t.id})" 
                 class="btn-confirm-delivery"
                 style="position:absolute; top:-10px; right:-10px; background:#ff9800; color:#fff; 
                        border-radius:50%; width:32px; height:32px; display:flex; 
                        align-items:center; justify-content:center; font-size:18px; 
                        font-weight:bold; box-shadow:0 4px 10px rgba(0,0,0,0.3); 
                        z-index:100; cursor:pointer; border:2px solid #fff;">
                ✓
            </div>`;
        }
        else if (t.status === "eating") {
            statusClass = "eating"; 
            // 🔥 FIX: Tính phút đang ăn (Bẫy lỗi nếu số quá lớn hoặc âm)
            let phutNgoi = 0;
            if (t.timeGiaoMon) {
                let tinhToan = Math.floor((Date.now() - t.timeGiaoMon) / 60000);
                phutNgoi = (tinhToan < 0 || tinhToan > 600) ? 0 : tinhToan;
            }
            statusText = `Đang ăn • <b style="color:#d32f2f;">${phutNgoi}p</b>`;
            statusIcon = `<div style="font-size:24px; margin-bottom:5px;">🍜</div>`;
        }
        else if (t.status === "paid") {
            statusClass = "paid"; 
            statusText = "Chờ dọn";
            statusIcon = `<div style="font-size:24px; margin-bottom:5px;">💰</div>`;
        }

        // --- 3. RENDER HTML ---
        const html = `
        <div class="table-card ${statusClass} ${isActive}" onclick="selectTable(${t.id})" style="position:relative;">
            ${badgeNguoi}
            ${confirmBtn}
            <div class="icon-box">${statusIcon}</div>
            <div class="table-name">${t.name}</div>
            <div class="table-sub">${t.customerName || statusText}</div>
        </div>`;

        if (t.type === 'bar' || t.id > 100) bH += html;
        else tH += html;
    });

    document.getElementById("table-grid").innerHTML = tH;
    document.getElementById("bar-grid").innerHTML = bH;
}

// 🔥 ĐỪNG QUÊN DÒNG NÀY Ở CUỐI FILE JS ĐỂ ĐỒNG HỒ TỰ NHẢY REAL-TIME
setInterval(() => { if (typeof renderTables === "function") renderTables(); }, 60000);



/*44. XÁC NHẬN PHỤ VỤ*/
function xacNhanPhucVu(event, tableId) {
    // Ngăn việc nhấn vào nút ✅ bị tính là nhấn vào chọn bàn
    event.stopPropagation();

    // Tìm bàn trong mảng TABLES hiện tại
    const tableIndex = TABLES.findIndex(t => t.id === tableId);
    
    if (tableIndex !== -1) {
        // Cập nhật trạng thái cục bộ
        TABLES[tableIndex].status = "eating";

        // Lưu lên Firebase để đồng bộ tất cả các máy khác
      db.ref("tables/" + id).update({ status: "eating" }).then(() => {
            console.log("Đã chuyển sang trạng thái Đang ăn 😋");
        });
    }
}

/*45.- KHO*/
function truKhoMoi(itemId, sl) {
    if (typeof RECIPES === 'undefined') return;

    const recipe = RECIPES[itemId];
    if (!recipe) return;

    // Dùng luôn biến KHO đang lắng nghe realtime để tính toán, không dùng .once nữa
    if (!KHO || KHO.length === 0) return;

    let updates = {};
    Object.keys(recipe).forEach(idNL => {
        const dinhMuc = recipe[idNL];
        // Tìm vị trí nguyên liệu trong mảng KHO toàn cục
        const idx = KHO.findIndex(k => k.id === idNL);

        if (idx !== -1) {
            let tonHienTai = parseFloat(KHO[idx].ton) || 0;
            let giaTriTru = (KHO[idx].dvt === "kg" || KHO[idx].dvt === "lít") 
                            ? (dinhMuc * sl) / 1000 
                            : (dinhMuc * sl);

            // Tính số dư mới
            let newTon = parseFloat(Math.max(0, tonHienTai - giaTriTru).toFixed(2));
            updates[`${idx}/ton`] = newTon;
            
            // Cập nhật tạm thời vào biến KHO để các lệnh trừ tiếp theo (trong cùng 1 đơn) lấy số mới nhất
            KHO[idx].ton = newTon; 
        }
    });

    if (Object.keys(updates).length > 0) {
        // Đẩy lên Firebase - Vì bạn đã có lệnh db.ref("kho").on(...) ở ngoài
        // Nên khi update xong, Firebase sẽ tự "hét" lên và hàm renderKho sẽ tự chạy lại
        db.ref("kho").update(updates).then(() => {
            console.log("⚡ Đã trừ kho realtime cho món:", itemId);
        });
    }
}

/*46.GỘP BÀN*/
function moModalGop() {
    if (!currentTableId) return alert("Vui lòng chọn bàn!");
    
    // HẠ LÁ SỚ CHI TIẾT ĐƠN XUỐNG CHO GỌN
    const sheet = document.getElementById('order-column');
    if (sheet) sheet.classList.remove('mo-ra');

    db.ref("orders/" + currentTableId).once("value").then(s => {
        const items = s.val() || [];
        if (items.length === 0) return alert("Bàn này không có món để gộp!");

        document.getElementById('modal-title').innerText = `Gộp bàn ${currentTableId} đi đâu?`;
        const body = document.getElementById('modal-body');
        
        body.innerHTML = TABLES.filter(t => t.id != currentTableId).map(t => {
            let statusClass = t.status || "empty"; 
            return `
                <div class="modal-item-table ${statusClass}" onclick="thucHienGopBan(${t.id})">
                    <span style="font-weight:bold; position:relative; z-index:2;">➡️ Gộp vào ${t.name}</span>
                    <small style="position:relative; z-index:2; opacity:0.8;">(${t.status === 'empty' ? 'Trống' : 'Có khách'})</small>
                </div>`;
        }).join('');
        
        // HIỆN MODAL VÀ ÉP Z-INDEX CAO NHẤT
        const modal = document.getElementById('modal-container');
        modal.style.display = 'flex';
        modal.style.zIndex = '999999'; 
    });
}

/*47.THỰC HIỆN GỘP*/
function thucHienGopBan(targetId) {
    if(!confirm(`Chuyển tất cả món sang bàn ${targetId}?`)) return;

    const refGoc = db.ref("orders/" + currentTableId);
    const refDich = db.ref("orders/" + targetId);

    Promise.all([refGoc.once("value"), refDich.once("value")]).then(results => {
        let iGoc = results[0].val() || [];
        let iDich = results[1].val() || [];

        // Gộp mảng món ăn
        iGoc.forEach(ig => {
            let existing = iDich.find(id => id.id_mon === ig.id_mon && !id.isReward);
            if (existing) existing.sl += ig.sl;
            else iDich.push(ig);
        });

        let updates = {};
        updates[`orders/${targetId}`] = iDich;
        updates[`orders/${currentTableId}`] = null;

        // Cập nhật trạng thái bàn
        const bGoc = TABLES.find(t => t.id == currentTableId);
        const bDich = TABLES.find(t => t.id == targetId);
        if(bGoc) {
            updates[`tables/${TABLES.indexOf(bGoc)}/status`] = "empty";
            updates[`tables/${TABLES.indexOf(bGoc)}/customerName`] = "";
        }
        if(bDich && bDich.status === 'empty') updates[`tables/${TABLES.indexOf(bDich)}/status`] = "ordering";

        db.ref().update(updates).then(() => {
            dongModal();
            selectTable(targetId);
        });
    });
}

/*48.TÁCH MÓN*/
function moModalTachMon() {
    if (!currentTableId) return alert("Vui lòng chọn bàn!");
    
    // HẠ LÁ SỚ CHI TIẾT ĐƠN XUỐNG
    const sheet = document.getElementById('order-column');
    if (sheet) sheet.classList.remove('mo-ra');

    db.ref("orders/" + currentTableId).once("value").then(s => {
        const items = s.val() || [];
        if (items.length === 0) return;

        document.getElementById('modal-title').innerText = `Chọn món muốn tách`;
        const body = document.getElementById('modal-body');
        
        body.innerHTML = items.map((item, index) => `
            <div class="modal-item" onclick="moModalChonBanDichTach(${index})">
                <span>${item.ten} (SL: ${item.sl})</span>
                <button style="padding:2px 8px">Chọn</button>
            </div>`).join('');

        const modal = document.getElementById('modal-container');
        modal.style.display = 'flex';
        modal.style.zIndex = '999999';
    });
}
/*49.CHỌN BÀN ĐÍCH TÁCH*/
function moModalChonBanDichTach(idx) {
    mónĐangTách = idx;
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');

    if (title) title.innerText = `Tách món đến bàn nào?`;

    if (body) {
        body.innerHTML = TABLES.filter(t => t.id != currentTableId).map(t => {
            const statusClass = t.status || "empty";
            const statusText = (t.status === 'empty') ? "Trống" : "Có khách";

            // Thêm hàm xử lý Click để tạo hiệu ứng Active ngay lập tức
            return `
                <div class="modal-item-table ${statusClass}" 
                     onclick="setActiveChoice(this); setTimeout(() => thucHienTach(${t.id}), 200)">
                    <span style="font-weight:bold; position:relative; z-index:2;">
                        ➡️ Chuyển đến ${t.name}
                    </span>
                    <small style="position:relative; z-index:2; opacity:0.8; font-weight:bold;">
                        [${statusText.toUpperCase()}]
                    </small>
                </div>
            `;
        }).join('');
    }
}

/*50.TẠO HIỆU ỨNG NỐI LÊN KHI CHỌN*/
function setActiveChoice(el) {
    // Xóa trạng thái active của các bàn khác trong modal
    document.querySelectorAll('.modal-item-table').forEach(item => item.classList.remove('active-choice'));
    // Thêm class active cho bàn vừa nhấn
    el.classList.add('active-choice');
}
/*51.THỰC HIỆN TÁCH*/
function thucHienTach(targetId) {
    const refGoc = db.ref("orders/" + currentTableId);
    const refDich = db.ref("orders/" + targetId);

    Promise.all([refGoc.once("value"), refDich.once("value")]).then(results => {
        let iGoc = results[0].val() || [];
        let iDich = results[1].val() || [];
        let item = iGoc[mónĐangTách];

        if (item.sl > 1) item.sl -= 1; 
        else iGoc.splice(mónĐangTách, 1);

        let itemChuyen = {...item, sl: 1, id: Date.now()};
        let existing = iDich.find(id => id.id_mon === itemChuyen.id_mon && !id.isReward);
        if (existing) existing.sl += 1;
        else iDich.push(itemChuyen);

        let updates = {};
        updates[`orders/${currentTableId}`] = iGoc;
        updates[`orders/${targetId}`] = iDich;

        // Reset trạng thái nếu bàn gốc hết món
        if(iGoc.length === 0) {
            const bGoc = TABLES.find(t => t.id == currentTableId);
            updates[`tables/${TABLES.indexOf(bGoc)}/status`] = "empty";
        }
        // Đổi màu bàn đích
        const bDich = TABLES.find(t => t.id == targetId);
        if(bDich && bDich.status === 'empty') updates[`tables/${TABLES.indexOf(bDich)}/status`] = "ordering";

        db.ref().update(updates).then(() => {
            dongModal();
        });
    });
}
/*52.ĐÓNG MÓN*/
function dongModal() {
    document.getElementById('modal-container').style.display = 'none';
}

/*53.ÁP DỤNG GIẢM GIÁ*/
function apDungGiamGia() {
    if (!currentTableId) return alert("Vui lòng chọn bàn!");
    
    const select = document.getElementById("coupon-select");
    const percent = parseInt(select.value) || 0;

    const tableIdx = TABLES.findIndex(t => String(t.id) === String(currentTableId));
    if (tableIdx !== -1) {
        // 1. Lưu lên Firebase
        db.ref(`tables/${tableIdx}/discount`).set(percent).then(() => {
            // 2. Cập nhật biến cục bộ ngay lập tức
            currentDiscountPercent = percent;
            
            // 3. Lấy lại items và vẽ lại đơn hàng để nhảy số tiền ngay
            db.ref("orders/" + currentTableId).once("value").then(s => {
                renderOrder(s.val() || []);
                alert(`✅ Đã áp dụng giảm giá ${percent}%`);
            });
        });
    }
}
/*54.XÓA GIẢM GIÁ*/
function xoaGiamGia() {
    currentDiscountPercent = 0;
    document.getElementById("coupon-select").value = "0";
    db.ref("orders/" + currentTableId).once("value").then(s => {
        renderOrder(s.val() || []);
    });
}
	



/*55.RENDER ĐẾM NGƯỢC MÓN*/
function renderStockStatus() {
    const displayList = document.getElementById('stock-display-list');
    const warningBox = document.getElementById('stock-warning-box');
    if (!displayList || typeof MENU === 'undefined') return;

    // 1. Cập nhật ngày tháng
    const dateEl = document.getElementById('current-date-display');
    if (dateEl) {
        const now = new Date();
        dateEl.innerText = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    }
    
    displayList.innerHTML = ''; 
    let alertMsg = ""; 
    
    // Biến để kiểm tra trạng thái của 2 món chính
    let hetTuyTam = false;
    let hetTuyThuong = false;

    MENU.forEach((mon, index) => { 
        const tenMon = (mon.ten || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");

        if (tenMon.includes('tuy tam') || tenMon.includes('tuy thuong')) {
            let limit = Number(mon.limit) || 0;
            let sold = Number(mon.soldToday) || 0;
            let conLai = Math.max(0, limit - sold);

            // Đánh dấu nếu món đã hết
            if (conLai <= 0) {
                if (tenMon.includes('tuy tam')) hetTuyTam = true;
                if (tenMon.includes('tuy thuong')) hetTuyThuong = true;
            }

            // --- Vẽ UI (Giữ nguyên logic của bạn) ---
            let phanTram = limit > 0 ? Math.min(100, Math.max(0, (conLai / limit) * 100)) : 0;
            let bgColor = '#4caf50'; 
            if (conLai <= (tenMon.includes('tuy tam') ? 25 : 15)) bgColor = '#ffa000';
            if (conLai <= 0) bgColor = '#d32f2f';

            displayList.innerHTML += `
                <div class="stock-item-row" style="display:flex; align-items:center; padding:10px 0; border-bottom:1px solid #eee; font-weight:bold; gap: 15px;">
                    <span style="color: #333; min-width: 100px; flex-shrink: 0;">🍜 ${mon.ten}</span>
                    <div style="flex: 1; height: 18px; background: #eee; border-radius: 20px; position: relative; overflow: hidden; margin: 0 auto; min-width: 200px;">
                        <div style="width: ${phanTram}%; height: 100%; background: ${bgColor}; border-radius: 20px; transition: width 0.5s ease;"></div>
                        <span style="color: ${phanTram < 45 ? '#333' : 'white'}; font-size: 11px; white-space: nowrap; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 2; pointer-events: none;">
                            ${conLai} / ${limit}
                        </span>
                    </div>
                    <button onclick="congLaiSuat(${index})" style="width:28px; height:28px; border-radius:50%; border:1px solid #ddd; background:#fff; cursor:pointer; font-weight:bold; flex-shrink: 0;">+</button>
                </div>`;

            // Gom tin nhắn cảnh báo lẻ
            let nguong = tenMon.includes('tuy tam') ? 25 : 15;
            if (conLai <= 0) {
                alertMsg += `🏮 Món ${mon.ten} đã hết! --- `;
            } else if (conLai <= nguong) {
                alertMsg += `✨ Món <span style="color:red; font-weight:bold;">${mon.ten}</span> chỉ còn <span style="color:red; font-weight:bold;">${conLai}</span> suất! --- `;
            }
        }
    });

    // 🔥 LOGIC CẢNH BÁO TỔNG KHI CẢ 2 CÙNG HẾT
    if (hetTuyTam && hetTuyThuong) {
        alertMsg = `<span style="color:red; font-size: 15px;">🏮 🌿 Lời xin lỗi từ Phở Túy: Hiện tại chúng tôi đã hoàn thành phục vụ các suất ăn trong ngày. Rất mong được đón tiếp Quý khách vào sáng mai. 🌿🏮</span>`;
    }

    if (warningBox) {
        if (alertMsg) {
            warningBox.style.display = "block";
            warningBox.innerHTML = `<marquee scrollamount="6" style="color:black; font-weight:bold;">${alertMsg}</marquee>`;
        } else {
            warningBox.style.display = "none";
        }
    }
}
// chạy ngay khi vào app
checkAndResetStockAt5AM();

// chạy mỗi phút (để đảm bảo đúng 08:00)
setInterval(() => {
    checkAndResetStockAt5AM();
}, 60000);

/*55.HÀM KIỂM TRA VÀ RESET LÚC 05:00 SÁNG */
function checkAndResetStockAt5AM() { // Bạn có thể đổi tên hàm thành checkAndResetStockAt8AM nếu muốn
    return new Promise((resolve) => {
        // 1. Lấy mốc thời gian hiện tại
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const currentDate = now.getDate();

        // 2. Tạo mốc 05:00:00 sáng ngày hôm nay (Đã sửa từ 5 thành 8)
        const mốc5hSángHômNay = new Date(currentYear, currentMonth, currentDate, 5, 0, 0, 0).getTime();

        // 3. Đọc ngày reset gần nhất từ Firebase
        db.ref("last_reset_date").once("value").then(snap => {
            const lastResetDate = snap.val(); 
            
            const todayStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(currentDate).padStart(2, '0')}`;
            
            // Nếu đã bước qua mốc 08:00 sáng và ngày hôm nay chưa được reset
            if (now.getTime() >= mốc5hSángHômNay && lastResetDate !== todayStr) {
                
                // Đọc Menu để reset
                db.ref("menu").once("value").then(menuSnap => {
                    const menuData = menuSnap.val();
                    if (!menuData) return resolve();

                    const updates = {};
                   Object.keys(menuData).forEach(key => {
    const mon = menuData[key];

    const tenMon = (mon.ten || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    if (tenMon.includes('tuy tam') || tenMon.includes('tuy thuong')) {
        updates[`menu/${key}/soldToday`] = 0;
    }
});

                    // Cập nhật lại soldToday = 0 và đánh dấu ngày đã reset
                    updates["last_reset_date"] = todayStr;

                    db.ref().update(updates).then(() => {
                        console.log("🔥 Đã reset số lượng bán lúc 08:00 sáng!");
                        resolve();
                    });
                });
            } else {
                resolve(); // Không cần reset
            }
        });
    });
}





/*56.TẶNG QUÀ NGÔI SAO*/
/* Hàm thêm quà tặng 0đ khi nhấn vào ngôi sao - Đã thêm xác nhận */
function themQuaTangTrucTiep(index) {
    if (!currentTableId) return alert("Vui lòng chọn bàn!");

    const monGoc = MENU[index];
    if (!monGoc) return;

    // --- BƯỚC XÁC NHẬN ---
    const check = confirm(`Xác nhận TẶNG MIỄN PHÍ món [${monGoc.ten.toUpperCase()}] cho khách?`);
    if (!check) return; // Nếu nhấn Hủy thì dừng lại

    db.ref("orders/" + currentTableId).once("value").then(s => {
        let items = s.val() || [];

        // Tạo món quà tặng
        const monQua = {
            ...monGoc,
            id: Date.now(),      // ID duy nhất để không bị gộp vào món tính tiền
            id_mon: monGoc.id,
            gia: 0,              // GIÁ VỀ 0
            sl: 1,
            isReward: true,      // Đánh dấu là hàng tặng
            note: "Quà tặng ⭐"
        };

        items.push(monQua);
        return db.ref("orders/" + currentTableId).set(items);
    }).then(() => {
        // Cập nhật lại giao diện đơn hàng
        if (typeof renderOrder === "function") {
             db.ref("orders/" + currentTableId).once("value").then(s => renderOrder(s.val() || []));
        }
        alert(`✅ Đã thêm món tặng: ${monGoc.ten}`);
    });
}

/*57.CỘNG LẠI SUẤT*/
function congLaiSuat(index) {
    if (!MENU || !MENU[index]) return;

    // Tăng số lượng đã bán
    MENU[index].soldToday = (Number(MENU[index].soldToday) || 0) - 1;

    // Không cho âm
    if (MENU[index].soldToday < 0) {
        MENU[index].soldToday = 0;
    }

    // Lưu lại Firebase
    db.ref("menu").set(MENU).then(() => {
        renderStockStatus();
        renderMenu();
    });
}

/*58.XÁC NHẬN GIAO MÓN XONG*/
window.xacNhanGiaoMon = function(tableId) {
    if (!tableId) return;

    // 1. Lấy toàn bộ đơn hàng trong bếp để kiểm tra
    db.ref("kitchen_orders").once("value").then(snapshot => {
        const kOrders = snapshot.val() || {};
        let ticketKey = null;
        let ticketData = null;

        // Tìm ticket tương ứng với tableId
        for (let key in kOrders) {
            if (String(kOrders[key].tableId) === String(tableId)) {
                ticketKey = key;
                ticketData = kOrders[key];
                break;
            }
        }

        // Tìm vị trí bàn trong danh sách tables để update trạng thái màu sắc
        db.ref("tables").once("value").then(tSnap => {
            const tablesArr = tSnap.val() || [];
            const tIdx = tablesArr.findIndex(t => t && String(t.id) === String(tableId));

            // --- TRƯỜNG HỢP 1: BẾP ẤN (Đơn chưa đánh dấu xong) ---
            if (ticketData && !ticketData.isDoneByChef) {
                // Đánh dấu đơn bếp đã xong (để đổi màu nút)
                db.ref(`kitchen_orders/${ticketKey}`).update({ isDoneByChef: true });
                
                // Chuyển màu bàn sang "Đợi giao" (Màu cam)
                if (tIdx !== -1) {
                    db.ref(`tables/${tIdx}`).update({ status: "waiting", timeAtBep: Date.now() });
                }
            } 
            // --- TRƯỜNG HỢP 2: PHỤC VỤ ẤN (Đơn đã đánh dấu xong hoặc ấn từ sơ đồ bàn) ---
            else {
                // Xóa đơn khỏi bếp
                if (ticketKey) db.ref(`kitchen_orders/${ticketKey}`).remove();
                
                // Chuyển màu bàn sang "Đang ăn" (Màu đỏ)
                if (tIdx !== -1) {
                    db.ref(`tables/${tIdx}`).update({ 
                        status: "eating", 
                        timeGiaoMon: Date.now(), 
                        timeAtBep: null 
                    });
                }
            }
        });
    });
};

/*58.TÍNH THỜI GIAN ĂN TRUNG BÌNH*/
function tinhThoiGianAnTrungBinh() {
    db.ref("eating_history").once("value").then(snap => {
        const data = snap.val();
        if (!data) return console.log("Chưa có lịch sử ăn.");

        let stats = {}; // Lưu tổng phút và số lần ăn của từng bàn
        let tongPhutHeThong = 0;
        let tongLuotHeThong = 0;

        Object.values(data).forEach(h => {
            if (!stats[h.tableId]) {
                stats[h.tableId] = { name: h.tableName, totalMin: 0, count: 0 };
            }
            stats[h.tableId].totalMin += h.duration;
            stats[h.tableId].count += 1;
            
            tongPhutHeThong += h.duration;
            tongLuotHeThong += 1;
        });

        // Vẽ bảng hiển thị ra Console hoặc Giao diện
        console.log("--- THỐNG KÊ THỜI GIAN ĂN TRUNG BÌNH ---");
        for (let id in stats) {
            let avg = Math.round(stats[id].totalMin / stats[id].count);
            console.log(`${stats[id].name}: ${avg} phút/lượt (Tổng ${stats[id].count} lượt)`);
        }
        
        let avgTotal = Math.round(tongPhutHeThong / tongLuotHeThong);
        console.log(`=> TRUNG BÌNH TOÀN QUÁN: ${avgTotal} phút`);
    });
}


/*58.HÀM VẼ BẢNG THỐNG KÊ TIME TRUNG BÌNH RA HTML */
function renderEatingStats() {
    db.ref("eating_history").once("value").then(snap => {
        const data = snap.val();
        let html = `
            <table style="width:100%; border-collapse: collapse; font-size:13px;">
                <tr style="background:#f1f5f9; text-align:left;">
                    <th style="padding:10px;">Tên bàn</th>
                    <th style="padding:10px;">Số lượt ăn</th>
                    <th style="padding:10px;">Trung bình</th>
                </tr>`;
        
        // ... (Logic tính stats như Bước 2) ...
        
        for (let id in stats) {
            let avg = Math.round(stats[id].totalMin / stats[id].count);
            html += `
                <tr style="border-bottom:1px solid #eee;">
                    <td style="padding:10px;">${stats[id].name}</td>
                    <td style="padding:10px;">${stats[id].count} lượt</td>
                    <td style="padding:10px; font-weight:bold; color:#d32f2f;">${avg} phút</td>
                </tr>`;
        }
        html += `</table>`;
        
        const container = document.getElementById("vung-thong-ke-gio-an");
        if (container) container.innerHTML = html;
    });
}

let myChart = null;
/*58.RENDER LỊCH SỬ ĂN CHO TIME TRUNG BÌNH*/
window.renderLichSuAn = function() {
    const container = document.getElementById("vung-thong-ke-gio-an");
    if (!container) return;

    db.ref("eating_history").once("value").then(snap => {
        const data = snap.val();
        if (!data) {
            container.innerHTML = "<p style='text-align:center; padding:20px;'>Chưa có lịch sử ăn nào được ghi lại.</p>";
            return;
        }

        let stats = {}; // Gom nhóm theo bàn
        let historyArray = Object.values(data);

        historyArray.forEach(h => {
            if (!stats[h.tableId]) {
                stats[h.tableId] = { name: h.tableName, totalMin: 0, count: 0 };
            }
            stats[h.tableId].totalMin += (h.duration || 0);
            stats[h.tableId].count += 1;
        });

        // Vẽ bảng
        let html = `
            <table style="width:100%; border-collapse: collapse; font-size:13px;">
                <thead style="background:#f8fafc; color:#64748b;">
                    <tr>
                        <th style="padding:12px; text-align:left; border-bottom:1px solid #eee;">Tên bàn</th>
                        <th style="padding:12px; text-align:center; border-bottom:1px solid #eee;">Số lượt khách</th>
                        <th style="padding:12px; text-align:right; border-bottom:1px solid #eee;">Trung bình/lượt</th>
                    </tr>
                </thead>
                <tbody>`;

        for (let id in stats) {
            let row = stats[id];
            let avg = Math.round(row.totalMin / row.count);
            html += `
                <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:12px; font-weight:600; color:#1e293b;">${row.name}</td>
                    <td style="padding:12px; text-align:center; color:#64748b;">${row.count} lượt</td>
                    <td style="padding:12px; text-align:right; font-weight:bold; color:#d32f2f;">${avg} phút</td>
                </tr>`;
        }

        html += `</tbody></table>`;
        container.innerHTML = html;
    });
};


/*58.HÀM MỞ MODAL THỐNG KÊ GIỜ ĂN TRUNG BÌNH */
window.moModalTimeAverage = function() {
    document.getElementById("modal-time-average").style.display = "flex";
    // Gọi hàm render dữ liệu (Hàm renderLichSuAn bạn đã có từ bước trước)
    if (typeof renderLichSuAn === "function") {
        renderLichSuAn();
    }
};

/*58.HÀM ĐÓNG MODAL THỐNG KÊ GIỜ ĂN TRUNG BÌNH*/
window.dongModalTimeAverage = function() {
    document.getElementById("modal-time-average").style.display = "none";
};

/*58.BIỂU ĐỒ GIỜ ĂN*/
window.renderLichSuAn = function() {
    const tableContainer = document.getElementById("eating-stats-table");
    
    db.ref("eating_history").once("value").then(snap => {
        const data = snap.val();
        if (!data) {
            tableContainer.innerHTML = "<p style='text-align:center; padding:20px; color:#94a3b8;'>Chưa có dữ liệu lịch sử</p>";
            return;
        }

        let stats = {}; 
        Object.values(data).forEach(h => {
            if (!stats[h.tableId]) {
                stats[h.tableId] = { name: h.tableName, totalMin: 0, count: 0 };
            }
            stats[h.tableId].totalMin += (h.duration || 0);
            stats[h.tableId].count += 1;
        });

        let labels = [];
        let averageData = [];
        let tableHtml = `
            <table style="width:100%; border-collapse: collapse; font-size:13px;">
                <thead style="color:#94a3b8; font-size:10px; text-transform:uppercase; letter-spacing:1px;">
                    <tr>
                        <th style="padding:10px 5px; text-align:left; border-bottom:2px solid #f1f5f9;">Vị trí</th>
                        <th style="padding:10px 5px; text-align:center; border-bottom:2px solid #f1f5f9;">Lượt</th>
                        <th style="padding:10px 5px; text-align:right; border-bottom:2px solid #f1f5f9;">T.Bình</th>
                    </tr>
                </thead>
                <tbody>`;

        for (let id in stats) {
            let avg = Math.round(stats[id].totalMin / stats[id].count);
            labels.push(stats[id].name);
            averageData.push(avg);
            
            tableHtml += `
                <tr style="border-bottom:1px solid #f8fafc; transition: all 0.2s;" onmouseover="this.style.background='#fcfcfc'" onmouseout="this.style.background='transparent'">
                    <td style="padding:14px 5px; font-weight:600; color:#334155;">${stats[id].name}</td>
                    <td style="padding:14px 5px; text-align:center; color:#64748b;">${stats[id].count}</td>
                    <td style="padding:14px 5px; text-align:right;">
                        <span style="background:#fef2f2; color:#ef4444; padding:4px 8px; border-radius:6px; font-weight:800; font-size:12px;">${avg}p</span>
                    </td>
                </tr>`;
        }
        tableContainer.innerHTML = tableHtml + `</tbody></table>`;

        // --- CẤU HÌNH BIỂU ĐỒ CHUYÊN NGHIỆP ---
        const ctx = document.getElementById('eatingChart').getContext('2d');
        if (myChart) myChart.destroy();

        // Tạo màu Gradient từ Đỏ sang Cam cho hiện đại
        const gradient = ctx.createLinearGradient(0, 0, 400, 0);
        gradient.addColorStop(0, '#f43f5e'); // Rose 500
        gradient.addColorStop(1, '#fb923c'); // Orange 400

        myChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Thời gian ăn (phút)',
                    data: averageData,
                    backgroundColor: gradient,
                    hoverBackgroundColor: '#e11d48',
                    borderRadius: 10, // Bo góc cột cực đẹp
                    borderSkipped: false,
                    barPercentage: 0.5,
                    categoryPercentage: 0.8
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 1500,
                    easing: 'easeOutQuart'
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        padding: 12,
                        titleFont: { size: 14, weight: 'bold' },
                        bodyFont: { size: 13 },
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                return `⏱ Trung bình: ${context.raw} phút`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        grid: { color: '#f1f5f9', drawBorder: false },
                        ticks: { 
                            color: '#94a3b8',
                            font: { size: 11 },
                            callback: v => v + 'p'
                        }
                    },
                    y: {
                        grid: { display: false, drawBorder: false },
                        ticks: { 
                            color: '#475569',
                            font: { size: 12, weight: '600' }
                        }
                    }
                }
            }
        });
    });
};




/*59.HISTORY HVIEN*/
function xemLichSuKhach(cid, name) {
    const modal = document.getElementById("modal-lich-su-khach");
    const content = document.getElementById("content-lich-su-khach");
    document.getElementById("title-lich-su-khach").innerText = "📜 Lịch sử: " + name;
    
    content.innerHTML = "<p style='text-align:center; padding:20px; color:#888;'>Đang tải dữ liệu...</p>";
    modal.style.display = "flex";

    // Lấy dữ liệu từ history_orders
    db.ref("history_orders").once("value").then(snap => {
        const orders = snap.val();
        if (!orders) {
            content.innerHTML = "<p style='text-align:center; color:#999; padding:20px;'>Chưa có lịch sử giao dịch.</p>";
            return;
        }

        // Lọc đơn theo customerId và sắp xếp mới nhất lên đầu
        const list = Object.keys(orders)
            .map(k => orders[k])
            .filter(o => o.customerId === cid)
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        if (list.length === 0) {
            content.innerHTML = "<p style='text-align:center; color:#999; padding:20px;'>Khách chưa có đơn hàng nào.</p>";
            return;
        }

        let html = "";
        list.forEach(o => {
            const d = new Date(o.timestamp);
            const timeStr = `${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')} - ${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;

            // 1. VẼ DANH SÁCH MÓN ĂN CHI TIẾT (Giống Bill)
            let itemsHTML = "";
            if (o.items && Array.isArray(o.items)) {
                o.items.forEach(m => {
                    itemsHTML += `
                    <div style="display:flex; justify-content:space-between; font-size:12px; color:#555; padding:4px 0; border-bottom:1px solid #f9f9f9;">
                        <span>• ${m.ten} <b style="color:#d32f2f;">x${m.sl}</b></span>
                        <span style="color:#333;">${(m.gia * m.sl).toLocaleString()}đ</span>
                    </div>`;
                });
            }

            // 2. VẼ KHUNG CARD (Y hệt hình mẫu bạn gửi)
            html += `
            <div style="background:#fff; border-radius:15px; border:1px solid #eee; margin-bottom:15px; box-shadow:0 4px 12px rgba(0,0,0,0.05); overflow:hidden;">
                <!-- Header: Giờ & Bàn -->
                <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 15px; background:#fcfcfc;">
                    <span style="font-size:12px; font-weight:bold; color:#3f51b5;">🕒 ${timeStr}</span>
                    <span style="background:#fff1f0; color:#cf1322; padding:2px 12px; border-radius:15px; font-size:11px; font-weight:bold; border:1px solid #ffa39e;">${o.tableName}</span>
                </div>

                <!-- Body: Danh sách món -->
                <div style="padding:10px 15px;">
                    ${itemsHTML}
                </div>

                <!-- Footer: Khách & Tổng cộng -->
                <div style="background:#f9f9f9; padding:12px 15px; display:flex; justify-content:space-between; align-items:flex-end; border-top:1px solid #f0f0f0;">
                    <div style="font-size:12px;">
                         <div style="color:#888;">
        👤 Khách: <b style="color:#555;">${o.customerName}</b> 
        ${o.customerPhone ? `<span style="color:#999; font-weight:normal; margin-left:5px;">(${o.customerPhone})</span>` : ""}
    </div>
                        <div style="color:#1e88e5; font-weight:bold; display:flex; align-items:center; gap:4px;">
                            <span style="font-size:14px;">🥣</span> +${o.totalBowls || 0} điểm bát
                        </div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:10px; color:#aaa; font-weight:bold; text-transform:uppercase; letter-spacing:0.5px;">Tổng cộng</div>
                        <div style="font-size:20px; font-weight:900; color:#d32f2f; line-height:1;">${Number(o.total).toLocaleString()}đ</div>
                    </div>
                </div>
            </div>`;
        });
        
        content.innerHTML = `<div style="padding:5px;">${html}</div>`;
    }).catch(err => {
        console.error(err);
        content.innerHTML = "<p style='text-align:center; color:red;'>Lỗi tải dữ liệu!</p>";
    });
}


/*60.MODAL BÁO CÁO*/
function moModalBaoCao() {
    document.getElementById('modal-bao-cao-tong').style.display = 'flex';
    
    // Tự động chọn ngày hôm nay nếu chưa chọn
    const today = new Date().toISOString().split('T')[0];
    if(!document.getElementById("report-from").value) {
        document.getElementById("report-from").value = today;
        document.getElementById("report-to").value = today;
    }
    taiBaoCaoDoanhThu();
}


/* ===============================
   KHAI BÁO BIẾN GLOBAL (FIX OVERLAP CHART)
================================= */
let myChartRatio = null;
let myChartHourly = null;


/*60.TẢI BÁO CÁO DOANH THU (BẢN PRO MAX - FIX SEARCH CHUẨN)*/
function taiBaoCaoDoanhThu() {
    const fromDate = document.getElementById("report-from").value;
    const toDate = document.getElementById("report-to").value;
    const customerFilter = document.getElementById("report-customer-filter").value;

    // ✅ SEARCH
    const searchText = (document.getElementById("report-search")?.value || "").toLowerCase().trim();
    
    const container = document.getElementById("report-body-list");
    const totalEl = document.getElementById("report-total-amount");
    const legendEl = document.getElementById("chart-legend-detail");
    const topFoodEl = document.getElementById("top-food-list");

    if (!container) return;
    
    container.innerHTML = "<p style='text-align:center; padding:30px; color:#64748b;'>Đang tải dữ liệu...</p>";

    db.ref("history_orders").once("value").then(snap => {
        const data = snap.val();
        if (!data) {
            container.innerHTML = "<p style='text-align:center;'>Chưa có dữ liệu.</p>";
            totalEl.innerText = "0đ";
            return;
        }

        let list = Object.keys(data).map(k => data[k]);
        list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        let thuHoiVien = 0;
        let thuVangLai = 0;

        let foodMap = {};
        let hourlyData = new Array(24).fill(0);

        let html = "";
        let displayedCount = 0;
        let tongThucThu = 0;

        const start = fromDate ? new Date(fromDate + "T00:00:00").getTime() : 0;
        const end = toDate ? new Date(toDate + "T23:59:59").getTime() : Infinity;

        list.forEach((o, index) => {
            const time = o.timestamp || 0;
            const total = Number(o.total) || 0;
            const discountAmount = Number(o.discount) || 0;

            let matchDate = (time >= start && time <= end);

            // ✅ KPI + CHART chỉ theo ngày (KHÔNG dính search)
            if (matchDate) {
                if (o.customerId) thuHoiVien += total; else thuVangLai += total;
                hourlyData[new Date(time).getHours()] += total;

                if (o.items) {
                    o.items.forEach(m => {
                        foodMap[m.ten] = (foodMap[m.ten] || 0) + (Number(m.sl) || 0);
                    });
                }
            }

            // ===== FILTER LIST =====
            let matchCustomer = true;
            if (customerFilter === "member") matchCustomer = !!o.customerId;
            else if (customerFilter === "guest") matchCustomer = !o.customerId;

            let matchSearch = true;
            if (searchText) {
                const tableName = (o.tableName || "").toLowerCase();
                const customerName = (o.customerName || "").toLowerCase();
                matchSearch = tableName.includes(searchText) || customerName.includes(searchText);
            }

            // ✅ LIST = date + customer + search
            if (matchDate && matchCustomer && matchSearch) {
                tongThucThu += total;
                displayedCount++;

                const d = new Date(time);
                const timeStr = `${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;
                const dateStr = `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;

                let voucherBadge = discountAmount > 0 ? `<span style="background:#f0fdf4; color:#166534; padding:2px 8px; border-radius:6px; font-size:10px; font-weight:bold; border:1px solid #bbf7d0; margin-left:5px;">🎁 Voucher</span>` : "";

                let discountRowHTML = discountAmount > 0 ? `<div style="display:flex; justify-content:space-between; font-size:12px; padding:6px 0; color:#16a34a; font-weight:bold; border-top:1px solid #f1f5f9;"><span>Giảm giá</span><span>-${discountAmount.toLocaleString()}đ</span></div>` : "";

                let chiTietMonHTML = "";
                if (o.items) {
                    o.items.forEach(m => {
                        chiTietMonHTML += `<div style="display:flex; justify-content:space-between; font-size:12px; padding:4px 0; border-bottom:1px dashed #eee;"><span>• ${m.ten} <small>x${m.sl}</small></span><span>${(m.gia * m.sl).toLocaleString()}đ</span></div>`;
                    });
                }

                html += `
                <div style="border-bottom: 1px solid #f1f5f9;">
                    <div onclick="toggleDetail('report-row-${index}')" style="display: grid; grid-template-columns: 120px 180px 180px 1fr 150px 50px; padding: 15px 25px; align-items: center; cursor: pointer;">
                        <div style="font-size:12px;"><b>${timeStr}</b><br><small style="color:#94a3b8">${dateStr}</small></div>
                        <div><span style="background:#eff6ff; color:#3b82f6; padding:3px 10px; border-radius:6px; font-size:11px; font-weight:700;">${o.tableName}</span>${voucherBadge}</div>
                        <div style="font-size:13px; color:#475569;">${o.customerName || 'Vãng lai'}</div>
                        <div></div>
                        <div style="text-align:right; font-weight:800; color:#10b981;">${total.toLocaleString()}đ</div>
                        <div style="text-align:right; color:#3b82f6;"><i class="far fa-eye"></i></div>
                    </div>

                    <div id="report-row-${index}" style="display:none; background:#fbfcfd; padding:20px 40px; border-top:1px solid #f1f5f9;">
                        <div style="display:grid; grid-template-columns:2fr 1fr; gap:60px;">
                            <div>${chiTietMonHTML}${discountRowHTML}</div>
                            <div style="text-align:right;">
                                <small>Thực thu</small>
                                <div style="font-size:20px; font-weight:900; color:#ef4444;">${total.toLocaleString()}đ</div>
                            </div>
                        </div>
                    </div>
                </div>`;
            }
        });

                     // 1. Cập nhật Tổng doanh thu (Card chính)
        if (totalEl) totalEl.innerText = tongThucThu.toLocaleString() + "đ";

        // --- CHÈN MỤC TIÊU DOANH THU VÀO ĐÂY ---
        const TARGET_REVENUE = 10000000;
        if (document.getElementById("stat-revenue-target")) {
            document.getElementById("stat-revenue-target").innerText = "/ " + (TARGET_REVENUE / 1000000) + "tr";
        }

        // 2. Tính % tỉ lệ Hội viên / Vãng lai và Cập nhật Card Hội viên/Vãng lai
        const pctMember = tongThucThu > 0 ? ((thuHoiVien / tongThucThu) * 100).toFixed(1) : 0;
        const pctGuest = tongThucThu > 0 ? ((thuVangLai / tongThucThu) * 100).toFixed(1) : 0;

        if (document.getElementById("stat-member-total")) 
            document.getElementById("stat-member-total").innerText = thuHoiVien.toLocaleString() + "đ";
        if (document.getElementById("pct-member")) 
            document.getElementById("pct-member").innerText = pctMember + "%";

        if (document.getElementById("stat-guest-total")) 
            document.getElementById("stat-guest-total").innerText = thuVangLai.toLocaleString() + "đ";
        if (document.getElementById("pct-guest")) 
            document.getElementById("pct-guest").innerText = pctGuest + "%";

        // 3. Tính % tăng trưởng so với hôm qua
        const mộtNgàyMs = 24 * 60 * 60 * 1000;
        const startYesterday = start - mộtNgàyMs;
        const endYesterday = start - 1; 

        let thuHômQua = 0, đơnHômQua = 0;
        list.forEach(o => {
            const t = o.timestamp || 0;
            if (t >= startYesterday && t <= endYesterday) {
                thuHômQua += Number(o.total) || 0;
                đơnHômQua++;
            }
        });

        const tinhPhanTram = (hienTai, quaKhu) => {
            if (quaKhu === 0) return hienTai > 0 ? 100 : 0;
            return (((hienTai - quaKhu) / quaKhu) * 100).toFixed(1);
        };

        // ===== KPI DOANH THU (Trend dưới Card 1) =====
        const growthRevenue = tinhPhanTram(tongThucThu, thuHômQua);
        const growthEl = document.getElementById("growth-revenue");
        if (growthEl) {
            growthEl.innerText = (growthRevenue >= 0 ? "▲ " : "▼ ") + Math.abs(growthRevenue) + "% so với hôm qua";
        }

        // ===== KPI SỐ ĐƠN (Card 4) =====
        if (document.getElementById("stat-order-count"))
            document.getElementById("stat-order-count").innerText = displayedCount;

        // --- CHÈN MỤC TIÊU SỐ ĐƠN VÀO ĐÂY ---
        const TARGET_ORDER = 150;
        if (document.getElementById("stat-order-target")) {
            document.getElementById("stat-order-target").innerText = "/ " + TARGET_ORDER;
        }

        const growthOrder = tinhPhanTram(displayedCount, đơnHômQua);
        const growthOrderEl = document.getElementById("growth-orders");
        if (growthOrderEl) {
            growthOrderEl.innerText = (growthOrder >= 0 ? "▲ " : "▼ ") + Math.abs(growthOrder) + "%";
            growthOrderEl.style.color = growthOrder >= 0 ? "#10b981" : "#ef4444";
        }

        // ===== KPI GIÁ TRỊ TRUNG BÌNH (Card 5) =====
        const avgToday = displayedCount > 0 ? tongThucThu / displayedCount : 0;
        const avgYesterday = đơnHômQua > 0 ? thuHômQua / đơnHômQua : 0;

        if (document.getElementById("stat-avg-order"))
            document.getElementById("stat-avg-order").innerText = Math.round(avgToday).toLocaleString() + "đ";

        const growthAvg = tinhPhanTram(avgToday, avgYesterday);
        const growthAvgEl = document.getElementById("growth-avg");
        if (growthAvgEl) {
            growthAvgEl.innerText = (growthAvg >= 0 ? "▲ " : "▼ ") + Math.abs(growthAvg) + "%";
            growthAvgEl.style.color = growthAvg >= 0 ? "#10b981" : "#ef4444";
        }



     // ===== UPDATE UI =====
        container.innerHTML = html || "<p style='text-align:center; padding:40px;'>Không tìm thấy dữ liệu.</p>";
        totalEl.innerText = tongThucThu.toLocaleString() + "đ";

        document.getElementById("stat-member-total").innerText = thuHoiVien.toLocaleString() + "đ";
        document.getElementById("stat-guest-total").innerText = thuVangLai.toLocaleString() + "đ";
        document.getElementById("stat-order-count").innerText = displayedCount;
        document.getElementById("stat-avg-order").innerText = displayedCount > 0 ? Math.round(tongThucThu / displayedCount).toLocaleString() + "đ" : "0đ";

        document.getElementById("footer-count").innerText = displayedCount + " đơn";
        document.getElementById("footer-total").innerText = tongThucThu.toLocaleString() + "đ";
        document.getElementById("footer-avg").innerText = displayedCount > 0 ? Math.round(tongThucThu / displayedCount).toLocaleString() + "đ" : "0đ";

        // Cập nhật Footer thống kê dưới bảng
        if(document.getElementById("footer-count")) document.getElementById("footer-count").innerText = displayedCount + " đơn";
        if(document.getElementById("footer-total")) document.getElementById("footer-total").innerText = tongThucThu.toLocaleString() + "đ";
        if(document.getElementById("footer-avg")) {
            const avg = displayedCount > 0 ? Math.round(tongThucThu / displayedCount) : 0;
            document.getElementById("footer-avg").innerText = avg.toLocaleString() + "đ";
        }

    
/* ========================================================
   RENDER TOP 5 MÓN (SO KHỚP VỚI MENU ĐỂ LẤY ẢNH)
=========================================================== */

// Bước 1: Tải menu về để lấy map ảnh
db.ref("menu").once("value").then(menuSnap => {
    const menuData = menuSnap.val() || [];
    
    // Tạo một từ điển ảnh: { "Túy Tâm": "link_anh_1", "Phở": "link_anh_2" }
    let imageLookup = {};
    Object.values(menuData).forEach(item => {
        if (item.ten && item.img) {
            imageLookup[item.ten] = item.img;
        }
    });

    // Bước 2: Tiến hành render Top 5 từ foodMap đã tính ở trên
    if (topFoodEl) {
        const sortedFood = Object.entries(foodMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        const maxQty = sortedFood.length > 0 ? sortedFood[0][1] : 1;

        topFoodEl.innerHTML = sortedFood.map(([ten, sl], index) => {
            const percent = (sl / maxQty) * 100;
            
            // Lấy link ảnh từ từ điển đã tạo, nếu không có dùng ảnh mặc định
            const imgUrl = imageLookup[ten] || "https://imgur.com";

            return `
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 18px;">
                <span style="font-size: 11px; color: #94a3b8; width: 10px; font-weight: bold;">${index + 1}</span>
                
                <!-- Hiển thị link ảnh từ Firebase của bạn -->
                <img src="${imgUrl}" style="width: 38px; height: 38px; border-radius: 50%; object-fit: cover; border: 1px solid #e2e8f0; background: #fff;">
                
                <div style="flex: 1;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                        <span style="font-size: 12px; font-weight: 600; color: #1e293b;">${ten}</span>
                        <span style="font-size: 12px; font-weight: 700; color: #1e293b;">${sl}</span>
                    </div>
                    <div style="width: 100%; height: 5px; background: #f1f5f9; border-radius: 10px; overflow: hidden;">
                        <div style="width: ${percent}%; height: 100%; background: #2563eb; border-radius: 10px; transition: width 0.8s ease;"></div>
                    </div>
                </div>
            </div>`;
        }).join('');
    }
});


        /* ===============================
           CHART DONUT
        =============================== */
       const centerTotalEl = document.getElementById("center-total-amount");
if (centerTotalEl) centerTotalEl.innerText = (thuHoiVien + thuVangLai).toLocaleString() + "đ";

// 2. Hiện tiền chi tiết ở phần Legend bên dưới
const tongTiLe = thuHoiVien + thuVangLai;
const pctHV = tongTiLe > 0 ? ((thuHoiVien / tongTiLe) * 100).toFixed(1) : 0;
const pctVL = tongTiLe > 0 ? ((thuVangLai / tongTiLe) * 100).toFixed(1) : 0;

if (legendEl) {
    legendEl.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 10px; font-size: 12px; margin-top: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="width: 8px; height: 8px; background: #10b981; border-radius: 50%;"></span>
                    <span style="color: #64748b;">Hội viên ${pctHV}%</span>
                </div>
                <b style="color: #1e293b;">${thuHoiVien.toLocaleString()}đ</b>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="width: 8px; height: 8px; background: #f59e0b; border-radius: 50%;"></span>
                    <span style="color: #64748b;">Vãng lai ${pctVL}%</span>
                </div>
                <b style="color: #1e293b;">${thuVangLai.toLocaleString()}đ</b>
            </div>
        </div>
    `;
}

        const ctxRatio = document.getElementById('revenueRatioChart').getContext('2d');
if (myChartRatio) myChartRatio.destroy();

myChartRatio = new Chart(ctxRatio, {
    type: 'doughnut',
    data: {
        labels: ['Hội viên', 'Vãng lai'],
        datasets: [{
            data: [thuHoiVien, thuVangLai],
            backgroundColor: ['#10b981', '#f59e0b'], // Màu xanh lục và vàng cam chuẩn
            borderWidth: 2,
            borderColor: '#ffffff', // Tạo đường kẻ trắng mảnh giữa các đoạn
            hoverOffset: 4
        }]
    },
    options: {
        cutout: '75%', // Giúp vòng tròn thanh mảnh hơn (giống hình mẫu)
        plugins: {
            legend: { display: false } // Ẩn legend mặc định để dùng legend tự chế bên dưới
        },
        responsive: true,
        maintainAspectRatio: false
    }
});
        /* ===============================
           CHART DOANH THU THEO GIỜ
        =============================== */
        const ctxHourly = document.getElementById('chartGio');
        if (ctxHourly) {
            if (myChartHourly) myChartHourly.destroy();

            myChartHourly = new Chart(ctxHourly, {
                type: 'line',
                data: {
                    labels: Array.from({length:24}, (_,i)=> i+"h"),
                    datasets: [{
                        data: hourlyData,
                        borderColor:'#3b82f6',
                        fill:true,
                        tension:0.4
                    }]
                },
                options: {
                    plugins: { legend: { display:false } }
                }
            });
        
}
// 1. Cột Hội viên
const memberEl = document.getElementById("stat-member-total");
if (memberEl) memberEl.innerText = thuHoiVien.toLocaleString() + "đ";

// 2. Cột Vãng lai
const guestEl = document.getElementById("stat-guest-total");
if (guestEl) guestEl.innerText = thuVangLai.toLocaleString() + "đ";

// 3. Cột Số đơn hàng
const orderCountEl = document.getElementById("stat-order-count");
if (orderCountEl) orderCountEl.innerText = displayedCount;

// 4. Cột Giá trị trung bình/Đơn (SỬA TẠI ĐÂY: Dùng tongThucThu thay vì tongDoanhThu)
const avgOrderEl = document.getElementById("stat-avg-order");
if (avgOrderEl) {
    // Sửa tongDoanhThu thành tongThucThu cho khớp với biến bạn đã cộng dồn ở trên
    const avg = displayedCount > 0 ? Math.round(tongThucThu / displayedCount) : 0;
    avgOrderEl.innerText = avg.toLocaleString() + "đ";
}

    });
}



// Đặt đoạn này ở cuối file JavaScript của bạn
document.addEventListener("DOMContentLoaded", function() {
    
    // Lắng nghe sự kiện thay đổi ở ô "Đến ngày"
    const reportToEl = document.getElementById("report-to");
    if (reportToEl) {
        reportToEl.addEventListener("change", function() {
            const toDateValue = this.value;
            const fromDateEl = document.getElementById("report-from");
            
            if (toDateValue && fromDateEl) {
                // Gán ngày "Từ" bằng ngày "Đến"
                fromDateEl.value = toDateValue;
                
                // Tự động tải lại dữ liệu báo cáo
                taiBaoCaoDoanhThu();
            }
        });
    }
});




/*60.VẼ CHI TIẾT LỊCH SỬ GIAO DỊCH Ở BÁO CÁO DOANH THU*/
function renderTableGiaoDich(list) {
    const container = document.getElementById("report-body-list");
    let html = "";
    let tongTien = 0;

    list.forEach((o, index) => {
        const total = Number(o.total) || 0;
        tongTien += total;
        const d = new Date(o.timestamp);
        const timeStr = `${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;
        const dateStr = `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;

        // Render danh sách món ẩn bên trong
        let itemsHtml = "";
        if (o.items) {
            o.items.forEach(m => {
                itemsHtml += `
                <div style="display:flex; justify-content:space-between; font-size:12px; padding:4px 0; border-bottom:1px dashed #eee;">
                    <span>• ${m.ten} <b style="color:#64748b">x${m.sl}</b></span>
                    <span>${(m.gia * m.sl).toLocaleString()}đ</span>
                </div>`;
            });
        }

        html += `
        <div style="border-bottom:1px solid #f1f5f9;">
            <!-- Dòng chính -->
            <div onclick="toggleDetail('row-${index}')" style="display: grid; grid-template-columns: 1fr 1fr 2fr 1.5fr 50px; padding: 15px 25px; align-items: center; cursor: pointer;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                <div style="font-size:12px; color:#1e293b;"><b>${timeStr}</b> <br><small style="color:#94a3b8">${dateStr}</small></div>
                <div><span style="background:#eff6ff; color:#3b82f6; padding:3px 10px; border-radius:6px; font-size:11px; font-weight:bold;">${o.tableName}</span></div>
                <div style="font-size:13px; color:#475569;"><i class="fas fa-user-circle" style="color:#cbd5e1; margin-right:5px;"></i> ${o.customerName || 'Khách vãng lai'}</div>
                <div style="text-align: right; font-weight: 800; color: #10b981;">${total.toLocaleString()}đ</div>
                <div style="text-align: right; color: #3b82f6;"><i class="far fa-eye"></i></div>
            </div>
            
            <!-- Vùng chi tiết ẩn -->
            <div id="row-${index}" style="display: none; background: #fbfcfd; padding: 15px 50px; border-top: 1px solid #f1f5f9;">
                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 50px;">
                    <div>${itemsHtml}</div>
                    <div style="text-align: right;">
                        <small style="color:#94a3b8;">Thực thu</small>
                        <div style="font-size:18px; font-weight:900; color:#ef4444;">${total.toLocaleString()}đ</div>
                    </div>
                </div>
            </div>
        </div>`;
    });

    container.innerHTML = html || "<p style='text-align:center; padding:30px;'>Không tìm thấy dữ liệu.</p>";
    
    // Cập nhật Footer
    document.getElementById("footer-count").innerText = list.length;
    document.getElementById("footer-total").innerText = tongTien.toLocaleString() + "đ";
    document.getElementById("footer-avg").innerText = list.length > 0 ? Math.round(tongTien/list.length).toLocaleString() + "đ" : "0đ";
}

/*60.ĐÓNG MỞ HÀNG Ở DOANH THU*/
function toggleDetail(id) {
    const el = document.getElementById(id);
    if (el.style.display === "none" || el.style.display === "") {
        el.style.display = "block";
    } else {
        el.style.display = "none";
    }
}





/*61.CHUYỂN ĐẾN TAB HV TỪ LỊCH SỬ ĐƠN HÀNG*/
function denHoiVien(customerId, phone) {
    if (!customerId || customerId === "undefined" || customerId === "null") {
        alert("Đây là khách vãng lai, không có dữ liệu hội viên.");
        return;
    }

    // 1. Đóng modal báo cáo (Dùng ID modal-bao-cao-tong bạn đã gửi)
    const modalBaoCao = document.getElementById('modal-bao-cao-tong');
    if (modalBaoCao) {
        modalBaoCao.style.display = 'none';
    }

    // 2. Chuyển sang tab Hội viên bằng hàm switchTab của bạn
    // Chúng ta tìm nút bấm Menu Hội viên để truyền vào tham số 'btn' giúp nó sáng lên
    const btnMenuHoiVien = document.querySelector("button[onclick*='tab-hoi-vien']");
    switchTab('tab-hoi-vien', btnMenuHoiVien); 

    // 3. Tự động điền số điện thoại tìm kiếm khách hàng
    setTimeout(() => {
        // Hãy kiểm tra ID ô tìm kiếm hội viên của bạn là gì (ví dụ bên dưới là 'search-hoi-vien')
        const searchInput = document.getElementById('search-hoi-vien'); 
        if (searchInput) {
            searchInput.value = phone;
            // Kích hoạt sự kiện tìm kiếm để danh sách tự lọc ngay lập tức
            searchInput.dispatchEvent(new Event('input'));
        }
    }, 200);
}

/*62.LẮNG NGHE QR ORDER*/
let soLuongDonCu = 0; // Biến để theo dõi số lượng đơn

function khoiTaoLangNgheQR() {
    db.ref("pending_qr_orders").on("value", (snap) => {
        const data = snap.val();
        const count = data ? Object.keys(data).length : 0;
        
        // Lấy các thẻ Badge (trong và ngoài)
        const badgeInner = document.getElementById("qr-count-badge"); // Badge nút chuông
        const badgeMain = document.getElementById("fab-main-badge");  // Badge nút dấu +
        const btnChuong = document.getElementById("btn-open-qr-list");
        const fabMain = document.querySelector(".fab-main");
        
        if (count > 0) {
            // HIỆN SỐ Ở CẢ 2 NƠI
            if (badgeInner) { badgeInner.innerText = count; badgeInner.style.display = "flex"; }
            if (badgeMain) { badgeMain.innerText = count; badgeMain.style.display = "flex"; }
            
            if (count > soLuongDonCu) {
                btnChuong.classList.add("has-new-order");
                if (fabMain) fabMain.classList.add("ring-active"); // Rung cả nút +
                
                const sound = new Audio('https://mixkit.co');
                sound.play().catch(e => console.log("Cần tương tác để phát nhạc"));
            }
        } else {
            if (badgeInner) badgeInner.style.display = "none";
            if (badgeMain) badgeMain.style.display = "none";
            btnChuong.classList.remove("has-new-order");
            if (fabMain) fabMain.classList.remove("ring-active");
        }
        
        soLuongDonCu = count;
        if (document.getElementById("modal-qr-list").style.display === "flex") {
            veDanhSachChoQR(data);
        }
    });
}

/*63.MỞ DANH SÁCH QR*/
function moDanhSachChoQR() {
    document.getElementById("modal-qr-list").style.display = "flex";
    db.ref("pending_qr_orders").once("value", (snap) => {
        veDanhSachChoQR(snap.val());
    });
}
/*64. VẼ DANH SÁCH CHO QR*/
function veDanhSachChoQR(data) {
    const container = document.getElementById("qr-pending-container");
    if (!data) {
        container.innerHTML = `<p style="text-align:center; color:#999; margin-top:30px;">Không có đơn hàng nào đang chờ.</p>`;
        return;
    }

    let html = "";
    Object.keys(data).forEach(id => {
        const order = data[id];
        const itemsStr = order.items.map(i => `• ${i.ten} x${i.sl} ${i.note ? `<br><i>- Ghi chú: ${i.note}</i>` : ''}`).join("<br>");
        
        html += `
        <div style="background:#fff; border-radius:10px; padding:15px; margin-bottom:15px; border:1px solid #eee; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
            <div style="display:flex; justify-content:space-between; margin-bottom:10px; border-bottom:1px solid #f0f0f0; padding-bottom:5px;">
                <b style="color:#d32f2f;">BÀN: ${order.tableId}</b>
                <small style="color:#999;">${new Date(order.timestamp).toLocaleTimeString()}</small>
            </div>
            <div style="font-size:13px; line-height:1.5; color:#333;">${itemsStr}</div>
            <div style="display:flex; gap:10px; margin-top:12px;">
                <button onclick="xuLyDonQR('${id}', 'cancel')" style="flex:1; padding:8px; border-radius:5px; border:1px solid #ccc; background:none; cursor:pointer;">HỦY</button>
                <button onclick="xuLyDonQR('${id}', 'accept')" style="flex:1; padding:8px; border-radius:5px; border:none; background:#2e7d32; color:#fff; font-weight:bold; cursor:pointer;">XÁC NHẬN</button>
            </div>
        </div>`;
    });
    container.innerHTML = html;
}
/*65.XỬ LÝ ĐƠN QR*/
function xuLyDonQR(orderId, action) {
    db.ref("pending_qr_orders/" + orderId).once("value").then(snap => {
        const data = snap.val();
        if (!data) return;

        if (action === 'cancel') {
            if (confirm("Hủy đơn hàng của Bàn " + data.tableId + "?")) {
                db.ref("pending_qr_orders/" + orderId).remove();
            }
        } else {
            Promise.all([
                db.ref("menu").once("value"),
                db.ref("orders/" + data.tableId).once("value")
            ]).then(results => {
                const menuGoc = results[0].val();
                let itemsHienTai = results[1].val() || [];
                
                data.items.forEach(newItem => {
                    let idChuan = newItem.id;
                    let moTaChuan = ""; 

                    if (menuGoc) {
                        for (let key in menuGoc) {
                            if (menuGoc[key].ten === newItem.ten) {
                                idChuan = menuGoc[key].id;
                                moTaChuan = menuGoc[key].desc || "";
                                break;
                            }
                        }
                    }

                    let found = itemsHienTai.find(old => 
                        (old.ten === newItem.ten) && ((old.note || "") === (newItem.note || ""))
                    );

                    if (found) {
                        found.sl = Number(found.sl) + Number(newItem.sl);
                        found.desc = moTaChuan;
                    } else {
                        itemsHienTai.push({
                            id_mon: idChuan,
                            id: idChuan,
                            ten: newItem.ten,
                            gia: newItem.gia,
                            sl: newItem.sl,
                            note: newItem.note || "",
                            desc: moTaChuan
                        });
                    }
                });

                // 2. Lưu lại vào bàn và XÓA đơn chờ
                return Promise.all([
                    db.ref("orders/" + data.tableId).set(itemsHienTai),
                    db.ref("pending_qr_orders/" + orderId).remove()
                ]);
            }).then(() => {
                // --- BỔ SUNG THÔNG BÁO TỚI KHÁCH HÀNG ---
                db.ref(`notifications/${data.tableId}`).set({
                    status: "confirmed",
                    timestamp: Date.now()
                });

                if (typeof updateStatus === "function") {
                    updateStatus(data.tableId, "ordering");
                }

                if (typeof currentTableId !== 'undefined' && currentTableId === data.tableId) {
                    db.ref("orders/" + data.tableId).once("value", s => renderOrder(s.val()));
                }
                
                // Bạn có thể bỏ alert này nếu không muốn bị ngắt quãng thao tác
                console.log("✅ Đã gửi thông báo xác nhận tới khách hàng bàn " + data.tableId);
            });
        }
    });
}

/*65.ĐÓNG QR OD*/
function dongModalQRList() {
    document.getElementById("modal-qr-list").style.display = "none";
}

// Gọi khởi tạo
khoiTaoLangNgheQR();


/*66.LINK FIRDE BASE*/
function syncMenuToFirebase() {
    const updates = {};
    
    MENU_MASTER.forEach(mon => {
        updates[mon.id] = mon;
    });

    db.ref("menu").set(updates)
        .then(() => console.log("✅ Menu đã sync Firebase"))
        .catch(err => console.error(err));
}
/*67.MỞ KHO*/
function moKhoHang() {
    // 1. Hiện cái hộp Modal lên
    document.getElementById('modal-kho-hang').style.display = 'flex';
    // 2. Vẽ dữ liệu ra bảng (Lấy từ biến KHO đã được đồng bộ realtime ở trên)
    renderKho();
}
// 3. Quan trọng: Phải ngắt lắng nghe khi đóng Modal để tránh tốn tài nguyên
function dongKhoHang() {
    document.getElementById('modal-kho-hang').style.display = 'none';
    db.ref("kho").off(); // Ngắt kết nối Realtime
}



/*68.MỞ HVIEN*/
function moHoiVien() {
    document.getElementById('modal-hoivien').style.display = 'flex';

    // KHÔNG gắn thêm listener "members" ở đây nữa: đã có 1 listener realtime
    // chạy 24/7 (xem phía dưới file) tự động vẽ lại danh sách khi có thay đổi
    // và khi modal đang mở. Gắn thêm ở đây mỗi lần mở modal sẽ tạo ra listener
    // trùng lặp không bao giờ được gỡ đúng cách -> app nặng dần theo thời gian.
    // Chỉ cần vẽ ngay dữ liệu hiện có khi vừa mở modal:
    if (typeof renderHoiVien === "function") {
        renderHoiVien();
    }
}

/*69.ĐÓNG HVIEN*/
function dongHoiVien() {
    document.getElementById('modal-hoivien').style.display = 'none';
    // KHÔNG gọi db.ref("members").off() ở đây: vì không còn gắn listener riêng
    // trong moHoiVien() nữa, off() ở đây sẽ chỉ vô tình tắt luôn listener 24/7
    // dùng chung cho toàn bộ app, khiến dữ liệu hội viên ngừng tự cập nhật
    // sau khi đóng modal 1 lần.
}

// (Tùy chọn) Thêm tính năng ấn ra ngoài để đóng
window.addEventListener('click', function(e) {
    const modal = document.getElementById('modal-hoivien');
    if (e.target === modal) dongHoiVien();
});




// Lắng nghe dữ liệu Hội viên 24/7
db.ref("members").on("value", snapshot => {
    window.HOIVIEN_DATA = snapshot.val() || {}; // Cập nhật biến dữ liệu toàn cục
    
    // Nếu cái Modal Hội viên đang mở thì vẽ lại bảng ngay lập tức
    const modal = document.getElementById('modal-hoivien');
    if (modal && modal.style.display === 'flex') {
        renderHoiVien(); // Gọi hàm vẽ danh sách của bạn
    }
});


/*70.MÀN HÌNH BẾP*/

let bepTimer = null;

function moManHinhBep() {

    db.ref("kitchen_orders").off();

    document.getElementById('modal-bep').style.display = 'flex';

    db.ref("kitchen_orders").on("value", snapshot => {

        const bepQueue = snapshot.val() || {};

        // FIX LỖI Ở ĐÂY
        const bepGrid =
            document.getElementById('bep-grid');

        if (!bepGrid) {
            console.error("❌ Không tìm thấy #bep-grid");
            return;
        }

        bepGrid.innerHTML = "";

        let count = 0;
        const tickets = Object.keys(bepQueue)
            .map(key => ({
                id: key,
                ...bepQueue[key]
            }))
            .sort((a, b) => a.timestamp - b.timestamp);

        tickets.forEach(ticket => {

            count++;

          const items = Array.isArray(ticket.items)
    ? ticket.items
    : Object.values(ticket.items || {});
            const isDone = ticket.isDoneByChef === true;

            /* =========================
               ITEMS HTML
            ========================= */
console.log("TICKET:", ticket);
console.log("ITEMS:", items);
           let itemsHtml = items.map(i => {

    const imgSrc =
        i.img ||
        "https://i.postimg.cc/cCGKGGNR/Hoa-chau.png";

    const ghiChu = i.note
        ? `
        <div style="
            margin-top:6px;
            background:#fef2f2;
            border:1px solid #fecaca;
            color:#dc2626;
            padding:6px 8px;
            border-radius:10px;
            font-size:12px;
            font-weight:700;
            line-height:1.4;
        ">
            ⚠️ ${i.note}
        </div>
        `
        : "";

    return `

    <div style="
        display:flex;
        gap:12px;
        padding:12px 0;
        border-bottom:1px dashed #dbe2ea;
        opacity:${isDone ? '0.5' : '1'};
        align-items:flex-start;
    ">

        <!-- ẢNH -->
        <div style="
            width:74px;
            height:74px;
            border-radius:16px;
            overflow:hidden;
            background:#f1f5f9;
            flex-shrink:0;
            border:1px solid #e2e8f0;
        ">

            <img
                src="${imgSrc}"

                onerror="
                    this.src='https://i.postimg.cc/cCGKGGNR/Hoa-chau.png'
                "

                style="
                    width:100%;
                    height:100%;
                    object-fit:cover;
                    display:block;
                "
            />

        </div>

        <!-- INFO -->
        <div style="
            flex:1;
            min-width:0;
        ">

            <div style="
                display:flex;
                justify-content:space-between;
                align-items:flex-start;
                gap:10px;
            ">

                <div style="
                    font-size:18px;
                    font-weight:900;
                    color:#0f172a;
                    line-height:1.35;
                ">
                    ${i.ten || 'Không tên'}
                </div>

                <div style="
                    min-width:44px;
                    height:44px;
                    border-radius:14px;
                    background:${isDone
                        ? '#94a3b8'
                        : 'linear-gradient(135deg,#22c55e,#16a34a)'};
                    color:white;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    font-size:18px;
                    font-weight:900;
                    flex-shrink:0;
                ">
                    ×${i.sl || 1}
                </div>

            </div>

            ${ghiChu}

        </div>

    </div>

    `;

}).join('');
            const startTime = ticket.timestamp || Date.now();

            const orderTime = new Date(startTime)
                .toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                });

            /* =========================
               BUTTON
            ========================= */

            const btnBg = isDone
                ? "#64748b"
                : "linear-gradient(135deg,#16a34a,#22c55e)";

            const btnText = isDone
                ? "CHỜ PHỤC VỤ BƯNG ⏳"
                : "XÁC NHẬN XONG ✅";

            const btnAction = isDone
                ? ""
                : `onclick="xacNhanGiaoMon('${ticket.tableId}')"`;


            /* =========================
               CARD
            ========================= */

            bepGrid.innerHTML += `

            <div 
                class="order-card-bep card-safe"
                id="ticket-${ticket.id}"

                style="
                    background:${isDone ? '#f8fafc' : '#ffffff'};
                    border:${isDone
                        ? '2px solid #94a3b8'
                        : '1px solid #e2e8f0'};
                    border-radius:24px;
                    overflow:hidden;
                    display:flex;
                    flex-direction:column;
                    min-height:320px;
                    height:100%;
                    transition:0.3s;
                    box-shadow:
                        0 10px 30px rgba(15,23,42,0.06),
                        0 2px 10px rgba(15,23,42,0.04);
                "
            >

                <!-- HEADER -->
                <div
                    class="card-header-pos header-safe"

                    style="
                        padding:14px 16px;
                        display:flex;
                        justify-content:space-between;
                        align-items:center;
                        flex-shrink:0;
                        background:${isDone
                            ? 'linear-gradient(135deg,#64748b,#475569)'
                            : 'linear-gradient(135deg,#0f172a,#1e293b)'};
                        color:white;
                    "
                >

                    <div>

                        <div style="
                            font-size:18px;
                            font-weight:900;
                        ">
                            ${ticket.tableName}
                        </div>

                        <div style="
                            font-size:11px;
                            opacity:0.8;
                            margin-top:2px;
                        ">
                            🕙 ${orderTime}
                        </div>

                    </div>

                    <!-- TIMER -->
                    <div
                        id="timer-${ticket.id}"
                        class="bep-timer"
                        data-start="${startTime}"

                        style="
                            font-family:monospace;
                            font-weight:900;
                            font-size:20px;
                            background:rgba(255,255,255,0.12);
                            padding:8px 12px;
                            border-radius:12px;
                            backdrop-filter:blur(8px);
                        "
                    >
                        00:00
                    </div>

                </div>

                <!-- BODY -->
                <div style="
                    padding:16px;
                    flex-grow:1;
                    overflow-y:auto;
                ">
                    ${itemsHtml}
                </div>

                <!-- BUTTON -->
                <button
                    ${btnAction}

                    style="
                        background:${btnBg};
                        color:#fff;
                        border:none;
                        padding:16px;
                        font-weight:900;
                        cursor:${isDone ? 'default' : 'pointer'};
                        font-size:15px;
                        width:100%;
                        flex-shrink:0;
                        margin-top:auto;
                        letter-spacing:0.3px;
                    "
                >
                    ${btnText}
                </button>

            </div>

            `;

        });

        document.getElementById('bep-count').innerText =
            `Yêu cầu chế biến: ${count}`;

    });

    if (window.bepTimer)
        clearInterval(window.bepTimer);

    window.bepTimer = setInterval(updateAllTimers, 1000);
}



/*71.TÍNH TOÁN ĐỘ LỆCH TIME*/
function updateAllTimers() {
    const now = Date.now();
    document.querySelectorAll('.bep-timer').forEach(el => {
        const start = parseInt(el.getAttribute('data-start'));
        const diff = Math.floor((now - start) / 1000); 
        const card = el.closest('.order-card-bep'); 
        const header = card ? card.querySelector('.card-header-pos') : null;

        // Hiển thị phút:giây
        const min = String(Math.floor(diff / 60)).padStart(2, '0');
        const sec = String(diff % 60).padStart(2, '0');
        el.innerText = `${min}:${sec}`;

        if (!card || !header) return;

        // LOGIC NHẢY MÀU
        if (diff >= 420) { // Từ phút thứ 7 trở đi
            card.className = "order-card-bep card-danger";
            header.className = "card-header-pos header-danger";
        } 
        else if (diff >= 181) { // Từ phút thứ 4 đến phút thứ 6
            card.className = "order-card-bep card-warning";
            header.className = "card-header-pos header-warning";
        } 
        else { // Dưới 3 phút
            card.className = "order-card-bep card-safe";
            header.className = "card-header-pos header-safe";
        }
    });
}




/*73.ĐÓNG MÀN HÌNH BẾP*/
function dongManHinhBep() {
    document.getElementById('modal-bep').style.display = 'none';
    db.ref("orders").off(); // Ngắt lắng nghe cho nhẹ máy
}


/*75.MỞ MENU TỪ TÊN BÀN CHO MOBILE*/
function moMenuTuTenBan() {
    if (!currentTableId) return;
    const menuSheet = document.getElementById('menu-column');
    if (menuSheet) {
        menuSheet.classList.add('mo-ra');
    }
    // Ngăn chặn việc click vào tên bàn làm hạ luôn đơn hàng
    if (event) event.stopPropagation();
}

// B. ĐIỀU KHIỂN TRỰC TIẾP TỪNG CỘT
// 1. Đối với Menu
const menuCol = document.getElementById('menu-column');
const menuTrigger = document.getElementById('menu-trigger');

menuTrigger.onclick = function(e) {
    e.stopPropagation(); // Chặn không cho báo lên document
    menuCol.classList.remove('mo-ra'); // CHỈ hạ chính nó
    console.log("Đã đóng Menu, Order đứng im nhé!");
};

menuCol.onclick = function(e) {
    e.stopPropagation(); // Click bên trong nội dung menu (chọn món) không bị hạ
};

// 2. Đối với Chi tiết đơn
const orderCol = document.getElementById('order-column');
const orderTrigger = document.getElementById('order-trigger');

orderTrigger.onclick = function(e) {
    e.stopPropagation();
    orderCol.classList.toggle('mo-ra');
};

orderCol.onclick = function(e) {
    e.stopPropagation(); // Click trong đơn hàng không bị hạ
};

// C. CHỈ HẠ TẤT CẢ KHI CHẠM VÀO SƠ ĐỒ BÀN
// Bạn hãy tìm class hoặc ID của vùng chứa Map bàn (ví dụ .left)
const vungMapBan = document.querySelector('.left'); 
if (vungMapBan) {
    vungMapBan.onclick = function() {
        // Chỉ khi chạm vào vùng sơ đồ bàn mới dọn dẹp màn hình
        document.getElementById('menu-column').classList.remove('mo-ra');
        document.getElementById('order-column').classList.remove('mo-ra');
    };
}
// C. LOGIC ĐÓNG NHANH
document.addEventListener('click', function (e) {
    if (window.innerWidth > 1024) return;

    const menuCol = document.getElementById('menu-column');
    const orderCol = document.getElementById('order-column');

    // 1. Nếu nhấn trúng tiêu đề MENU (Trigger của Menu)
    if (e.target.closest('#menu-trigger')) {
        e.stopPropagation(); // Chặn đứng sự kiện, không cho lan ra ngoài
        menuCol.classList.remove('mo-ra'); // CHỈ hạ Menu
        console.log("Đã đóng Menu - Giữ nguyên Order");
        return; 
    }

    // 2. Nếu nhấn trúng tiêu đề CHI TIẾT ĐƠN (Trigger của Order)
    if (e.target.closest('#order-trigger')) {
        e.stopPropagation();
        orderCol.classList.toggle('mo-ra'); // Nâng/Hạ Order
        return;
    }

    // 3. Nếu nhấn trúng BÀN (Table Map)
    if (e.target.closest('.table-card')) {
        // Khi chọn bàn mới: Hiện Order, Đóng Menu cho gọn
        orderCol.classList.add('mo-ra');
        menuCol.classList.remove('mo-ra');
        return;
    }

    // 4. Nếu nhấn VÀO TRONG vùng nội dung của Menu hoặc Order
    // (Đang chọn món, đang sửa số lượng...) -> KHÔNG LÀM GÌ CẢ
    if (menuCol.contains(e.target) || orderCol.contains(e.target)) {
        return; 
    }

    // 5. TRƯỜNG HỢP CUỐI: Nhấn vào vùng trống (Background/Sơ đồ bàn)
    // Thì mới hạ tất cả xuống cho thoáng màn hình
    menuCol.classList.remove('mo-ra');
    orderCol.classList.remove('mo-ra');
});
document.getElementById('menu-column').onclick = function(e) { e.stopPropagation(); };
document.getElementById('order-column').onclick = function(e) { e.stopPropagation(); };



/*75.CẢM ỨNG MENU CHO MOBILE*/
function handleSwipe(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;

    let touchStartY = 0;
    let touchEndY = 0;

    // Khi bắt đầu chạm ngón tay
    el.addEventListener('touchstart', e => {
        touchStartY = e.changedTouches[0].screenY;
    }, {passive: true});

    // Khi buông ngón tay ra
    el.addEventListener('touchend', e => {
        touchEndY = e.changedTouches[0].screenY;
        const diffY = touchStartY - touchEndY;

        // 1. Nếu vuốt LÊN (diffY dương) -> Mở ra
        if (diffY > 50) { 
            el.classList.add('mo-ra');
            // Nếu mở Menu thì hạ Order xuống cho rảnh mắt (tùy chọn)
            if (elementId === 'menu-column') {
                // document.getElementById('order-column').classList.remove('mo-ra');
            }
        } 
        
        // 2. Nếu vuốt XUỐNG (diffY âm) -> Đóng lại
        if (diffY < -50) {
            el.classList.remove('mo-ra');
        }
    }, {passive: true});
}

// Kích hoạt cho cả 2 lá sớ khi trang web load xong
document.addEventListener('DOMContentLoaded', () => {
    handleSwipe('order-column');
    handleSwipe('menu-column');
});


document.addEventListener("keydown", function(e) {
    if (e.key === "F12") e.preventDefault();
});

document.addEventListener("contextmenu", e => e.preventDefault());




/*76.CHỌN MÓN THẺ BAY VÀO*/
function playFlyEffect(e) {
    // 1. Tìm cái khung món ăn (menu-item) bao quanh nút bấm vừa nhấn
    const originalItem = e.currentTarget.closest('.menu-item');
    if (!originalItem) return;

    // 2. Tạo bản sao (Clone) của khung món ăn đó
    const flyer = originalItem.cloneNode(true);
    flyer.classList.remove('combo-neon-glow', 'single-neon-glow'); // Bỏ hiệu ứng hào quang để bay cho nhẹ
    flyer.style.position = 'fixed';
    flyer.style.zIndex = '999999';
    flyer.style.pointerEvents = 'none';
    flyer.style.transition = 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)';
flyer.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
flyer.style.borderRadius = '18px';
flyer.style.backgroundColor = '#ffffff'; // Đảm bảo thẻ có nền trắng khi bay
    
    // 3. Tính toán vị trí hiện tại của món ăn trên màn hình
    const rect = originalItem.getBoundingClientRect();
    flyer.style.width = rect.width + 'px';
    flyer.style.height = rect.height + 'px';
    flyer.style.top = rect.top + 'px';
    flyer.style.left = rect.left + 'px';
    
    document.body.appendChild(flyer);

    // 4. Xác định vị trí đích (Chi tiết đơn)
    const target = document.getElementById('order-column');
    if (!target) return;
    const targetRect = target.getBoundingClientRect();
    const endX = targetRect.left + (targetRect.width / 2);
    const endY = targetRect.top;

    // 5. Kích hoạt hiệu ứng bay sau 50ms
    setTimeout(() => {
        flyer.style.left = (endX - rect.width / 4) + 'px'; // Bay vào giữa
        flyer.style.top = (endY - 20) + 'px';
        flyer.style.transform = 'scale(0.1)'; // Thu nhỏ lại khi bay vào
        flyer.style.opacity = '0.3';
    }, 50);

    // 6. Xóa bản sao và làm rung giỏ hàng
    setTimeout(() => {
        flyer.remove();
        target.classList.add('shake-effect');
        setTimeout(() => target.classList.remove('shake-effect'), 400);
    }, 800);
}


/*77.THÔNG BÁO CHUÔNG KHI CÓ ORDER QR*/
function updateQRCount(count) {
    const mainBadge = document.getElementById('fab-main-badge'); // Badge ngoài nút +
    const innerBadge = document.getElementById('qr-count-badge'); // Badge trong nút chuông

    if (count > 0) {
        // Hiện số ở nút chính
        mainBadge.innerText = count;
        mainBadge.style.display = 'flex';
        
        // Hiện số ở nút chuông bên trong
        innerBadge.innerText = count;
        innerBadge.style.display = 'flex';
        
        // Hiệu ứng rung nhẹ nút chính để gây chú ý
        document.querySelector('.fab-main').classList.add('ring-active');
    } else {
        mainBadge.style.display = 'none';
        innerBadge.style.display = 'none';
        document.querySelector('.fab-main').classList.remove('ring-active');
    }
}


/*78.TẠO QR*/
function capNhatQRThanhToan(tongTien) {
    const qrImg = document.getElementById('qr-image');
    const qrZone = document.getElementById('qr-payment-zone');
    if (!qrImg || !qrZone) return;

    if (!tongTien || tongTien <= 0) {
        qrZone.style.display = 'none';
        return;
    }

    qrZone.style.display = 'block';

    const BANK_ID = "VCB"; // ✅ sửa lại đây
    const ACCOUNT_NO = "030093020397";
    const ACCOUNT_NAME = encodeURIComponent("Nguyễn Kim Anh");

    const tableInfo = typeof currentTableId !== 'undefined' ? currentTableId : '';
    const addInfo = encodeURIComponent(`Thanh toan Ban ${tableInfo}`);

    const qrUrl = `https://img.vietqr.io/image/${BANK_ID}-${ACCOUNT_NO}-compact2.png?amount=${Math.round(tongTien)}&addInfo=${addInfo}&accountName=${ACCOUNT_NAME}&t=${Date.now()}`;

    console.log("QR URL:", qrUrl);

    qrImg.src = qrUrl;

    const qrImgBig = document.getElementById('qr-image-big');
    if (qrImgBig) qrImgBig.src = qrUrl;
}


/*78.PHÓNG TO QR*/
function phongToQR() {
    const modal = document.getElementById('modal-qr-big');
    if (document.getElementById('qr-image').src) {
        modal.style.display = 'flex';
    }
}

// Gọi hàm này ở cuối hàm renderOrder của bạn:
// capNhatQRThanhToan(total);






/*79.BỘ LĂP TIME*/
setInterval(() => {
    if (typeof renderTables === "function") {
        renderTables();
    }
}, 60000);



/*80.HIỂN THỊ NGÀY THÁNG ĐỒNG HỒ*/
const now = new Date();
const dateString = now.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
document.getElementById('clock-date').innerText = dateString;



/*81.UPDATE TRẠNG THÁI ĐÓNG MỞ CỬA*/
function updateStoreStatus() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // Chuyển thời gian hiện tại sang phút để so sánh cho chính xác
    const totalMinutes = currentHour * 60 + currentMinute;
    
    // Cấu hình giờ mở (06:00) và đóng (11:00) tính theo phút
    const openTime = 6 * 60;  // 360 phút
    const closeTime = 11 * 60; // 660 phút

    const statusEl = document.getElementById('store-status');
    const timeTextEl = document.getElementById('store-time-text');

    if (statusEl && timeTextEl) {
        if (totalMinutes >= openTime && totalMinutes < closeTime) {
            // TRẠNG THÁI MỞ CỬA
            statusEl.innerText = "● Đang mở cửa";
            statusEl.style.color = "#2e7d32"; // Màu xanh lá
            timeTextEl.style.color = "#888";
        } else {
            // TRẠNG THÁI ĐÓNG CỬA
            statusEl.innerText = "● Đã đóng cửa";
            statusEl.style.color = "#d32f2f"; // Màu đỏ
            timeTextEl.style.color = "#d32f2f"; // Chuyển màu giờ sang đỏ để gây chú ý
        }
    }
}

// Gọi hàm này ngay lập tức khi load trang
updateStoreStatus();

// Có thể gọi kèm trong setInterval của updateClock() để cập nhật liên tục mỗi giây
setInterval(updateStoreStatus, 60000); // Kiểm tra lại mỗi phút 1 lần là đủ




/*82.DANH SÁCH ĐỘI NGŨ*/
async function moModalDoiNgu() {
    const modal = document.getElementById('modal-container');
    const body = document.getElementById('modal-body');
    const title = document.getElementById('modal-title');
    const nutDongModal = document.querySelector('.modal-close'); 
    
    if (!modal || !body) return;

    // Ép đăng nhập
    if (nutDongModal) nutDongModal.style.display = daDangNhap ? "block" : "none";

    title.innerText = "✨ CHỌN ĐẠI SỨ LÀM VIỆC";
    body.innerHTML = `<div style="text-align:center; padding:20px; color:#888;">Đang tải danh sách đại sứ...</div>`;
    modal.style.display = 'flex';

    // LẤY DỮ LIỆU THỰC TỪ FIREBASE
    firebase.database().ref('NhanSu').once('value', (snapshot) => {
        const data = snapshot.val();
        if (!data) {
            body.innerHTML = `<div style="padding:20px; text-align:center; color:#ef4444;">Chưa có nhân sự nào. Vui lòng thêm nhân sự trước!</div>`;
            return;
        }

        let html = `<div style="display:flex; flex-direction:column; gap:12px; padding:5px;">`;
        
        Object.values(data).forEach(nv => {
            // Xác định màu theo vai trò (giống bảng quản lý)
            const roleColors = { "Đại sứ Hương Vị": "#fb7185", "Đại sứ Đón Tiếp": "#34d399", "Đại sứ Ngoại Giao": "#60a5fa" };
            const color = roleColors[nv.vaiTro] || "#94a3b8";

            html += `
            <div onclick="hienFormDangNhap('${nv.ten.replace(/'/g, "\\'")}')" 
                 style="display:flex; align-items:center; gap:15px; padding:12px; background:#fff; border-radius:15px; border:1px solid #eee; cursor:pointer; transition:0.2s;"
                 onmouseover="this.style.borderColor='${color}'; this.style.background='#fcfcfc'">
                
                <div style="position:relative; width:45px; height:45px; flex-shrink:0;">
                    <img src="${nv.avatarUrl || 'https://placeholder.com'}" style="width:100%; height:100%; border-radius:12px; object-fit:cover; border:2px solid #eee;">
                    <span style="position:absolute; bottom:-2px; right:-2px; width:10px; height:10px; background:${nv.isOnline ? '#10b981' : '#ccc'}; border:2px solid #fff; border-radius:50%;"></span>
                </div>

                <div style="flex:1;">
                    <div style="font-size:9px; color:${color}; font-weight:900; text-transform:uppercase;">${nv.vaiTro}</div>
                    <div style="font-size:15px; font-weight:bold; color:#333;">${nv.ten}</div>
                    <div style="font-size:11px; color:#888;">🕒 Ca: ${nv.ca}</div>
                </div>
                <div style="color:#eee;">❯</div>
            </div>`;
        });

        body.innerHTML = html + `</div>`;
    });
}


// 3. Tự động gọi khi mở trang
window.onload = function() {
    moModalDoiNgu();
};

/*84. HIỆN FORM ĐĂNG NHẬP MK*/
function hienFormDangNhap(tenNhanVien) {
    const body = document.getElementById('modal-body');
    const title = document.getElementById('modal-title');
    
    title.innerText = "🔑 XÁC THỰC ĐẠI SỨ";
    
    body.innerHTML = `
        <div style="padding:10px; text-align:center;">
            <div style="font-size:13px; color:#666; margin-bottom:15px;">Xin chào đại sứ: <br><b style="color:#2e7d32; font-size:18px;">${tenNhanVien}</b></div>
            
            <input type="text" id="login-user" placeholder="Tên đăng nhập (ID)" 
                   style="width:100%; padding:12px; margin-bottom:10px; border:1px solid #ddd; border-radius:10px; outline:none; box-sizing:border-box;">
            
            <input type="password" id="login-pass" placeholder="Mật khẩu" 
                   style="width:100%; padding:12px; margin-bottom:20px; border:1px solid #ddd; border-radius:10px; outline:none; box-sizing:border-box;">
            
            <div style="display:flex; gap:10px;">
                <button onclick="moModalDoiNgu()" style="flex:1; padding:12px; background:#f5f5f5; border:none; border-radius:10px; cursor:pointer; color:#666;">Quay lại</button>
                <button onclick="xuLyDangNhap('${tenNhanVien.replace(/'/g, "\\'")}')" 
                        style="flex:2; padding:12px; background:#10b981; color:white; border:none; border-radius:10px; cursor:pointer; font-weight:bold; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.2);">ĐĂNG NHẬP NGAY</button>
            </div>
        </div>
    `;
}




/*85. CHECK THÔNG TIN ĐĂNG NHẬP (FIX LỖI UNDEFINED)*/
function xuLyDangNhap(ten) {
    const uInput = document.getElementById('login-user').value.trim();
    const pInput = document.getElementById('login-pass').value.trim();
    
    // 🔥 BƯỚC 1: TÀI KHOẢN MASTER ĐỂ ĐĂNG NHẬP KHI DATABASE TRỐNG
    // Bạn có thể đổi lại username và password theo ý muốn
    if (uInput === "admin" && pInput === "123456") {
        alert("🎉 Đăng nhập bằng tài khoản Master Admin thành công!");
        
        // Gọi hàm phân quyền cho Admin
        if (typeof chonDaiSu === "function") {
            chonDaiSu("Đại sứ Minh Bạch", "Quản trị viên", "https://placeholder.com", "Cả ngày");
        }
        return;
    }

    if (!ten) return;

    // BƯỚC 2: LOGIC ĐỐI CHIẾU FIREBASE BÌNH THƯỜNG
    firebase.database().ref('NhanSu').once('value', (snapshot) => {
        const allStaff = snapshot.val();
        
        // Nếu không có dữ liệu trên Firebase
        if (!allStaff) {
            alert("❌ Không tìm thấy dữ liệu nhân sự! Hãy dùng tài khoản Master Admin để đăng nhập.");
            return;
        }

        let nv = null;
        let idFirebase = "";
        const tenChuan = String(ten).toLowerCase().normalize("NFC").replace(/[\s_]+/g, "");

        for (let key in allStaff) {
            const keyChuan = String(key).toLowerCase().normalize("NFC").replace(/[\s_]+/g, "");
            const tenTrongDb = allStaff[key].ten 
                ? String(allStaff[key].ten).toLowerCase().normalize("NFC").replace(/[\s_]+/g, "") 
                : "";

            if (keyChuan === tenChuan || tenTrongDb === tenChuan) {
                nv = allStaff[key];
                idFirebase = key;
                break;
            }
        }

        if (nv) {
            if (String(uInput) === String(nv.username) && String(pInput) === String(nv.password)) {
                firebase.database().ref('NhanSu/' + idFirebase).update({ isOnline: true });
                chonDaiSu(nv.vaiTro, nv.ten, nv.avatarUrl, nv.ca);
                alert(`🎉 Chào mừng Đại sứ ${nv.ten} đã vào ca!`);
            } else {
                alert("❌ Sai tài khoản hoặc mật khẩu!");
            }
        } else {
            alert("❌ Không tìm thấy thông tin đại sứ!");
        }
    }).catch(error => {
        console.error("Lỗi Firebase:", error);
        alert("❌ Lỗi kết nối dữ liệu!");
    });
}

/*86.CHỌN ĐẠI SỨ (PHIÊN BẢN PREMIUM)*/
function chonDaiSu(vaiTro, ten, avatarUrl, ca) {
    // 1. CẬP NHẬT GIAO DIỆN HỒ SƠ (Profile Card)
    // Cập nhật text
    if(document.getElementById('main-staff-role')) {
        document.getElementById('main-staff-role').innerText = vaiTro.toUpperCase();
    }
    if(document.getElementById('main-staff-name')) {
        document.getElementById('main-staff-name').innerText = ten;
    }
    if(document.getElementById('main-staff-shift')) {
        document.getElementById('main-staff-shift').innerText = "Ca làm: " + ca;
    }

    // 2. CẬP NHẬT AVATAR THỰC TẾ
    const avatarBox = document.getElementById('avatar-box-main');
    if (avatarBox) {
        avatarBox.style.position = "relative";
        avatarBox.innerHTML = `
            <img src="${avatarUrl || 'https://placeholder.com'}" 
                 style="width: 60px; height: 60px; border-radius: 50%; border: 2px solid #10b981; object-fit: cover; display: block;">
            <!-- Đèn báo đang làm việc (Xanh lá) -->
            <span style="position: absolute; bottom: 2px; right: 2px; width: 12px; height: 12px; background: #10b981; border: 2px solid #1e293b; border-radius: 50%;"></span>
        `;
    }

    // 3. LOGIC PHÂN QUYỀN & MỞ KHÓA
    daDangNhap = true; 
    const PHAN_QUYEN = {
        "Đại sứ Đón Tiếp": [],
        "Đại sứ Hương Vị": ["order", "print"],
        "Đại sứ Ngoại Giao": ["order", "print", "payment", "discount"],
        "Đại sứ Sạch Sẽ": ["clear_table"],
        "Đại sứ Minh Bạch": ["full_control"]
    };

    const quyenHienTai = PHAN_QUYEN[vaiTro] || [];
    const coQuyen = (q) => quyenHienTai.includes("full_control") || quyenHienTai.includes(q);

    // Mở khóa lớp bảo vệ chính
    const wrapper = document.querySelector('.main-wrapper');
    if (wrapper) {
        wrapper.style.pointerEvents = "auto";
        wrapper.style.filter = "none"; 
    }

    // HIỆN/ẨN CÁC VÙNG CHỨC NĂNG THEO QUYỀN
    const setDisplay = (id, condition) => {
        const el = document.getElementById(id);
        if (el) el.style.display = condition ? "flex" : "none";
    };

    const setPointer = (id, condition) => {
        const el = document.getElementById(id);
        if (el) el.style.pointerEvents = condition ? "auto" : "none";
    };

    setPointer('menu-list', coQuyen("order"));
    setPointer('order-column', coQuyen("order"));
    setDisplay('step-pay', coQuyen("payment"));
    setDisplay('step-print', coQuyen("print") || coQuyen("order"));

    // Hiện nút Đăng xuất (màu đỏ như trong ảnh)
    const btnLogout = document.getElementById('btn-logout-main');
    if (btnLogout) {
        btnLogout.style.display = "block";
        btnLogout.onclick = () => xuLyDangXuat(ten); // Gọi hàm đăng xuất đã viết trước đó
    }

    // Đóng Modal chọn đại sứ
    const modal = document.getElementById('modal-container');
    if (modal) modal.style.display = 'none';

    console.log(`✅ ${ten} (${vaiTro}) đã vào ca thành công!`);
}


/*87. XỬ LÝ KHÓA APP*/
function xuLyKhoaApp() {
    const wrapper = document.querySelector('.main-wrapper'); // Hoặc id/class bao quanh toàn bộ app của bạn
    if (wrapper) {
        if (!daDangNhap) {
            // KHÓA TOÀN BỘ tương tác chuột/cảm ứng
            wrapper.style.pointerEvents = "none";
            wrapper.style.filter = "none"; // Đảm bảo KHÔNG LÀM MỜ
            wrapper.style.userSelect = "none"; // Không cho bôi đen văn bản
        } else {
            // MỞ KHÓA khi đã chọn đại sứ
            wrapper.style.pointerEvents = "auto";
            wrapper.style.filter = "none";
            wrapper.style.userSelect = "auto";
        }
    }
}

// Gọi khi vừa load trang
window.onload = function() {
    xuLyKhoaApp();
    moModalDoiNgu();
};

/*88. ĐĂNG XUẤT (CẬP NHẬT FIREBASE & KHÓA HỆ THỐNG)*/
function dangXuat() {
    // 1. LẤY TÊN NHÂN VIÊN ĐANG ĐĂNG NHẬP ĐỂ SET OFFLINE
    const staffNameEl = document.getElementById('main-staff-name');
    let tenNhanVien = "";
    
    if (staffNameEl) {
        // Lấy tên từ chuỗi "Nhân viên: Nguyễn Kim Anh" -> "Nguyễn Kim Anh"
        tenNhanVien = staffNameEl.innerText.replace("Nhân viên: ", "").trim();
    }

    const thucHienThoat = () => {
        // 2. RESET TRẠNG THÁI HỆ THỐNG
        daDangNhap = false;

        // 3. XÓA TOÀN BỘ THÔNG TIN HIỂN THỊ
        if(document.getElementById('main-staff-role')) document.getElementById('main-staff-role').innerText = "---";
        if(document.getElementById('main-staff-name')) document.getElementById('main-staff-name').innerText = "Chưa đăng nhập";
        if(document.getElementById('main-staff-shift')) document.getElementById('main-staff-shift').innerText = "Ca làm: --:--";
        
        // 4. ĐÓNG THẺ PROFILE (Nếu bạn dùng modal hoặc box ẩn hiện)
        const profileBox = document.getElementById('user-profile-box'); 
        if (profileBox) profileBox.style.display = "none";

        // Xóa Avatar về mặc định
        const avatarBox = document.getElementById('avatar-box-main');
        if (avatarBox) {
            avatarBox.innerHTML = `
                <svg viewBox="0 0 64 64" width="50" height="50">
                    <circle cx="32" cy="32" r="30" fill="#1e293b" stroke="#334155" />
                    <path d="M32 15a10 10 0 100 20 10 10 0 000-20zM15 50c0-10 8-15 17-15s17 5 17 15" fill="#334155" />
                </svg>`;
        }

        // 5. KHÓA HỆ THỐNG (Hiện rõ nhưng không cho bấm)
        const wrapper = document.querySelector('.main-wrapper');
        if (wrapper) {
            wrapper.style.pointerEvents = "none";
            wrapper.style.filter = "grayscale(0.5)"; // Làm xám nhẹ để báo hiệu đang khóa
        }

        // 6. HIỆN LẠI MODAL CHỌN ĐẠI SỨ
        moModalDoiNgu();
        
        console.log("🔒 Hệ thống đã đóng ca làm việc.");
    };

    // LOGIC CẬP NHẬT FIREBASE TRƯỚC KHI THOÁT
    if (tenNhanVien && tenNhanVien !== "Chưa đăng nhập") {
        const idFirebase = tenNhanVien.replace(/\s+/g, '_');
        firebase.database().ref('NhanSu/' + idFirebase).update({ 
            isOnline: false 
        }).then(() => {
            thucHienThoat();
        }).catch(err => {
            console.error("Lỗi cập nhật Offline:", err);
            thucHienThoat(); // Vẫn thoát nếu lỗi mạng
        });
    } else {
        thucHienThoat();
    }
}





/*89.HÀM ĐIỀU KHIỂN SIDEBAR */
function toggleSideMenu() {
    const side = document.getElementById('sidebar-den');
    const overlay = document.getElementById('side-overlay');
    
    if (!side || !overlay) return;

    // Mở menu: Cho hiện lên và trượt ra
    side.style.visibility = 'visible';
    side.style.left = '0px';
    side.style.boxShadow = '10px 0 30px rgba(0,0,0,0.5)'; // Hiện bóng đổ khi mở
    overlay.style.display = 'block';

    // Đổ dữ liệu nhân viên (Giữ nguyên logic của bạn)
    if(document.getElementById('side-role')) 
        document.getElementById('side-role').innerText = document.getElementById('main-staff-role')?.innerText || "ĐẠI SỨ";
    
    if(document.getElementById('side-name')) 
        document.getElementById('side-name').innerText = (document.getElementById('main-staff-name')?.innerText || "").replace("Nhân viên: ", "");
    
    if(document.getElementById('side-shift')) 
        document.getElementById('side-shift').innerText = document.getElementById('main-staff-shift')?.innerText || "Ca làm: --:--";
    
    if(document.getElementById('side-avatar')) 
        document.getElementById('side-avatar').innerHTML = document.getElementById('avatar-box-main')?.innerHTML || "";
}

function dongSideMenu() {
    const side = document.getElementById('sidebar-den');
    const overlay = document.getElementById('side-overlay');
    
    if (side) {
        side.style.left = '-320px'; // Đẩy xa hơn một chút để ẩn cả bóng đổ
        side.style.visibility = 'hidden'; // Ẩn triệt để, không để lại vệt mờ
        side.style.boxShadow = 'none'; // Tắt bóng đổ để mép màn hình sạch
    }
    if (overlay) overlay.style.display = 'none';
}


/*90.đổi tab active*/
function doiTabActive(element) {
    // 1. Tìm tất cả các menu-item và xóa class 'active'
    const items = document.querySelectorAll('.menu-item');
    items.forEach(item => {
        item.classList.remove('active');
    });

    // 2. Thêm class 'active' vào ô vừa được bấm
    element.classList.add('active');
    
    // (Tùy chọn) Thêm logic chuyển màn hình tương ứng tại đây nếu cần
    console.log("Đã chọn tab:", element.innerText);
}



/*91.HÀM MỞ HỘI VIÊN TỪ SIDEBAR */
function moHoiVienTuSidebar() {
    // 1. KHÔNG gọi dongSideMenu() để Sidebar luôn hiện

    // 2. Ẩn các modal khác để tránh chồng chéo (ví dụ: Nhân sự)
    const modalNhanSu = document.getElementById('modal-quan-ly-nhan-su');
    if (modalNhanSu) modalNhanSu.style.display = 'none';

    // 3. Mở Modal Hội viên
    if (typeof moHoiVien === 'function') {
        moHoiVien();
    } else {
        const modalHoiVien = document.getElementById('modal-hoivien-container');
        if (modalHoiVien) {
            modalHoiVien.style.display = 'flex';
            
            // Đảm bảo khung hội viên cũng né sidebar giống nhân sự
            modalHoiVien.style.left = '260px'; 
            modalHoiVien.style.position = 'fixed';
            modalHoiVien.style.width = 'calc(100% - 260px)';
        }
    }
}



/*92. MỞ QUẢN LÝ NHÂN SỰ*/
function moQuanLyNhanSu() {
    const modal = document.getElementById('modal-quan-ly-nhan-su');
    if (modal) {
        modal.style.display = 'flex';
        veDanhSachNhanSu(); // Gọi hàm vẽ bảng
    }
}


/*93. THÊM / CẬP NHẬT NHÂN SỰ (FULL DATA + TÍNH LƯƠNG TỰ ĐỘNG)*/
function themNhanSuMoi() {

    // 1. Lấy dữ liệu cơ bản
    const ten = document.getElementById('ins-ten').value.trim();
    const sdt = document.getElementById('ins-sdt').value.trim();
    const ngaySinh = document.getElementById('ins-ngaysinh').value;
    const cccd = document.getElementById('ins-cccd').value.trim();
    const diachi = document.getElementById('ins-diachi').value.trim();

    // 2. Lấy dữ liệu đăng nhập & phân quyền
    const user = document.getElementById('ins-username').value.trim();
    const pass = document.getElementById('ins-password').value.trim();

    const capDoEl = document.getElementById('ins-capdo');
    const capDo = capDoEl ? capDoEl.value : "STAFF";

    // 3. Lấy dữ liệu công việc
    const vaiTro = document.getElementById('ins-vaitro').value;
    const ca = document.getElementById('ins-ca').value;
    const viTri = document.getElementById('ins-vitri').value;

    // 4. Xử lý lương
    const luongThangRaw = document.getElementById('ins-luong').value;

    const luongThang = Number(
        String(luongThangRaw).replace(/,/g, "")
    ) || 0;

    // Công thức tính lương giờ
    const luongGio = Math.round((luongThang / 26) / 8);

    // 5. Kiểm tra bắt buộc
    if (!ten || !user) {
        alert("⚠️ Vui lòng nhập ít nhất Tên và ID đăng nhập!");
        return;
    }

    // 6. ID NHÂN VIÊN CỐ ĐỊNH
    // Nếu đang sửa => giữ nguyên ID cũ
    // Nếu thêm mới => tạo ID mới
    const id = dangSuaId || ("nv_" + Date.now());

    // 7. Kiểm tra username bị trùng
    const usernameDaTonTai = DANH_SACH_NV.find(nv => 
        nv.username &&
        nv.username.trim().toLowerCase() === user.toLowerCase() &&
        nv.id !== id
    );

    if (usernameDaTonTai) {
        alert("⚠️ ID đăng nhập đã tồn tại!");
        return;
    }

    // 8. Đóng gói dữ liệu
    const data = {
        id: id,
        ten: ten,
        sdt: sdt,
        ngaySinh: ngaySinh,
        cccd: cccd,
        diachi: diachi,

        username: user,
        password: pass,
        capDo: capDo,

        vaiTro: vaiTro,
        ca: ca,
        viTri: viTri,

        luongCoBan: luongThang,
        luong: luongGio,

        updatedAt: Date.now()
    };

    // 9. Chỉ thêm mặc định khi là nhân sự mới
    if (!dangSuaId) {

        data.createdAt = Date.now();

        data.danhGia = 100;

        data.lastCheckInDate = "chưa có";

        data.daVaoCa = false;

        data.daTanCa = false;

        data.isOnline = false;
    }

    // 10. Lưu Firebase
    firebase.database()
        .ref('NhanSu/' + id)
        .update(data)

        .then(() => {

            alert(
                dangSuaId
                    ? "✅ Cập nhật hồ sơ thành công!"
                    : "✅ Thêm nhân sự thành công!"
            );

            resetFormNV();

        })

        .catch(err => {

            console.error("Lỗi:", err);

            alert("❌ Lỗi lưu dữ liệu: " + err.message);

        });
}

/*94.CẬP NHẬT THỐNG KÊ DATA*/
function capNhatThongKe(data) {

    // 1. Luôn đảm bảo là mảng sạch
    const safeData = Array.isArray(data)
        ? data.filter(nv => nv && nv.id)
        : [];

    // 2. Tổng nhân sự
    const totalEl = document.getElementById('stat-total-nv');

    if (totalEl) {
        totalEl.innerText = safeData.length;
    }

    // 3. Tính trung bình hiệu suất
    const avg = safeData.length
        ? Math.round(
            safeData.reduce((tong, nv) => {
                return tong + (Number(nv.danhGia) || 0);
            }, 0) / safeData.length
        )
        : 0;

    const avgEl = document.getElementById('stat-avg-perf');

    if (avgEl) {
        avgEl.innerText = avg + "%";
    }
}


/* 🔥 SYNC REALTIME FIREBASE NHÂN SỰ (đã gộp 2 listener trùng lặp trước đây thành 1) */
firebase.database().ref('NhanSu').on('value', (snap) => {

    const rawData = snap.val();

    // Chuyển object Firebase => mảng an toàn
    window.DANH_SACH_NV = rawData
        ? Object.values(rawData).filter(nv =>
            nv &&
            nv.id &&
            nv.ten &&
            nv.username
        )
        : [];
    DANH_SACH_NV = window.DANH_SACH_NV;

    // Render danh sách (bảng chính)
    if (typeof renderDanhSach === "function") {
        renderDanhSach(window.DANH_SACH_NV);
    }

    // Update thống kê (bảng chính)
    if (typeof capNhatThongKe === "function") {
        capNhatThongKe(window.DANH_SACH_NV);
    }

    // Luôn cập nhật bảng thống kê phụ (Số lượng, Hiệu suất) kể cả khi đóng hay mở Modal
    if (typeof capNhatThongKeNhanSu === 'function') {
        capNhatThongKeNhanSu();
    }

    // Tự động vẽ lại danh sách (view quản lý nhân sự) nếu Modal đang mở
    const modalNV = document.getElementById('modal-quan-ly-nhan-su');
    if (modalNV && modalNV.style.display === 'flex') {
        if (typeof veDanhSachNhanSu === 'function') {
            veDanhSachNhanSu();
        }
    }

});



/*95.RS FORM NV*/
function resetFormNV() {

    // 🔥 Reset trạng thái sửa
    dangSuaId = null;

    // 1. Xóa trắng các ô input text
    const fields = [
        'ins-ten',
        'ins-sdt',
        'ins-ngaysinh',
        'ins-cccd',
        'ins-diachi',
        'ins-username',
        'ins-password'
    ];

    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });

    // 2. Reset dropdown vai trò
    const vaiTroEl = document.getElementById('ins-vaitro');

    if (vaiTroEl) {
        vaiTroEl.selectedIndex = 0;
    }

    // 3. Reset cấp độ nếu có
    const capDoEl = document.getElementById('ins-capdo');

    if (capDoEl) {
        capDoEl.selectedIndex = 0;
    }

    // 4. Đồng bộ lại vị trí + lương mặc định
    if (typeof capNhatViTriTuDong === "function") {
        capNhatViTriTuDong();
    }

    // 5. Reset nút lưu về trạng thái THÊM MỚI
    const btnLuu = document.querySelector(
        'button[onclick*="themNhanSuMoi"]'
    );

    if (btnLuu) {

        btnLuu.innerHTML = "💾 LƯU THÔNG TIN NHÂN VIÊN";

        btnLuu.style.background = "#10b981";

        btnLuu.style.boxShadow =
            "0 4px 15px rgba(16, 185, 129, 0.3)";
    }

}

/*96.CHUẨN BỊ SỬA NHÂN VIÊN*/
window.chuanBiSuaNhanSu = function(idNhanVien) {

    // 1. Kiểm tra ID
    if (!idNhanVien) {

        alert("❌ Không đọc được ID nhân viên!");

        return;
    }

    // 2. Tìm nhân sự theo ID CỐ ĐỊNH
    const nv = DANH_SACH_NV.find(item =>
        item &&
        item.id === idNhanVien
    );

    // 3. Không tìm thấy
    if (!nv) {

        console.error(
            "Không tìm thấy nhân sự với ID:",
            idNhanVien
        );

        alert("❌ Không tìm thấy dữ liệu nhân sự!");

        return;
    }

    // 4. Ghi nhận ID đang sửa
    dangSuaId = nv.id;

    // 5. Đổ dữ liệu vào form
    const setValue = (id, value) => {

        const el = document.getElementById(id);

        if (el) {
            el.value = value || "";
        }
    };

    setValue('ins-ten', nv.ten);
    setValue('ins-sdt', nv.sdt);
    setValue('ins-ngaysinh', nv.ngaySinh);
    setValue('ins-cccd', nv.cccd);
    setValue('ins-diachi', nv.diachi);

    setValue('ins-username', nv.username);
    setValue('ins-password', nv.password);

    setValue('ins-vaitro', nv.vaiTro || "Đại sứ Hương Vị");

    setValue('ins-ca', nv.ca || "05:00 - 12:00");

    // 6. Đồng bộ vị trí theo vai trò
    if (typeof capNhatViTriTuDong === "function") {
        capNhatViTriTuDong();
    }

    // 7. Đổ vị trí + lương
    setValue('ins-vitri', nv.viTri);

    setValue(
        'ins-luong',
        typeof dinhDangTien === "function"
            ? dinhDangTien(nv.luongCoBan || 0)
            : (nv.luongCoBan || 0)
    );

    // 8. Đổi nút lưu thành nút cập nhật
    const btnLuu = document.querySelector(
        'button[onclick*="themNhanSuMoi"]'
    );

    if (btnLuu) {

        btnLuu.innerHTML = "🆙 CẬP NHẬT HỒ SƠ";

        btnLuu.style.background = "#3b82f6";

        btnLuu.style.boxShadow =
            "0 4px 15px rgba(59, 130, 246, 0.3)";
    }

    // 9. Scroll lên form
    document
        .querySelector('.hồ-sơ-nhân-sự')
        ?.scrollIntoView({
            behavior: 'smooth'
        });

};


/*97.XÓA NHÂN VIÊN*/
function xoaNhanSu(idNhanVien) {

    // 1. Kiểm tra ID
    if (!idNhanVien) {

        alert("❌ Không tìm thấy ID nhân sự!");

        return;
    }

    // 2. Tìm nhân sự trong danh sách
    const nv = DANH_SACH_NV.find(item =>
        item &&
        item.id === idNhanVien
    );

    // 3. Không tìm thấy
    if (!nv) {

        alert("❌ Không tìm thấy nhân sự trong hệ thống!");

        return;
    }

    // 4. Xác nhận xóa
    if (
        !confirm(
            `⚠️ Bạn có chắc chắn muốn xóa nhân sự "${nv.ten}"?\nHành động này không thể hoàn tác!`
        )
    ) {
        return;
    }

    // 5. ID Firebase chuẩn
    const idFirebase = idNhanVien;

    console.log(
        "Đang tiến hành xóa tại path:",
        'NhanSu/' + idFirebase
    );

    // 6. Xóa Firebase
    db.ref('NhanSu/' + idFirebase)
        .remove()

        .then(() => {

            console.log(
                "✅ Đã xóa thành công:",
                idFirebase
            );

            // 7. Xóa local cache
            if (typeof DANH_SACH_NV !== 'undefined') {

                DANH_SACH_NV = DANH_SACH_NV.filter(item =>
                    item &&
                    item.id !== idNhanVien
                );
            }

            // 8. Render lại UI
            if (typeof renderDanhSach === "function") {
                renderDanhSach(DANH_SACH_NV);
            }

            // 9. Update thống kê
            if (typeof capNhatThongKe === "function") {
                capNhatThongKe(DANH_SACH_NV);
            }

            // 10. Nếu đang sửa đúng người bị xóa
            if (dangSuaId === idNhanVien) {
                resetFormNV();
            }

            alert(`✅ Đã xóa thành công nhân sự "${nv.ten}"!`);

        })

        .catch(err => {

            console.error("❌ Lỗi xóa Firebase:", err);

            alert("❌ Lỗi xóa: " + err.message);

        });
}

window.xoaNhanSu = xoaNhanSu;

/*98.HÀM CHUẨN HÓA VIẾT HOA CHỮ CÁI ĐẦU NHÂN VIÊN*/
function chuanHoaTen(str) {

    if (!str) return "";

    return String(str)

        .trim()

        // Gộp khoảng trắng dư
        .replace(/\s+/g, ' ')

        .toLowerCase()

        .split(' ')

        .map(word => {

            // Bỏ qua từ rỗng
            if (!word) return "";

            return word.charAt(0).toUpperCase() + word.slice(1);

        })

        .join(' ');
}


/*🔥 AUTO FORMAT TÊN KHI NHẬP*/
document.addEventListener("DOMContentLoaded", () => {

    const oNhapTen = document.getElementById('ins-ten');

    if (!oNhapTen) return;

    // Khi rời ô input
    oNhapTen.addEventListener('blur', function () {

        this.value = chuanHoaTen(this.value);

    });

});


/*🔥 LOẠI BỎ DẤU TIẾNG VIỆT*/
function loaiBoDau(str) {

    if (!str) return "";

    return String(str)

        .toLowerCase()

        .trim()

        // Chuẩn unicode
        .normalize("NFD")

        // Xóa dấu
        .replace(/[\u0300-\u036f]/g, "")

        // đ -> d
        .replace(/đ/g, "d")

        // Xóa khoảng trắng
        .replace(/\s+/g, "")

        // Xóa ký tự đặc biệt
        .replace(/[^a-z0-9]/g, "");
}


/*99. CẬP NHẬT THỐNG KÊ NHÂN VIÊN*/
function capNhatThongKeNhanSu() {

    // 1. Luôn đảm bảo là mảng
    const list = Array.isArray(DANH_SACH_NV)
        ? DANH_SACH_NV.filter(nv => nv && nv.id)
        : [];

    // 2. Tổng nhân viên
    const tongNV = list.length;

    // 3. Tính hiệu suất trung bình
    const tongHieuSuat = list.reduce((sum, nv) => {
        return sum + (Number(nv.danhGia) || 0);
    }, 0);

    const avgPerf = tongNV > 0
        ? Math.round(tongHieuSuat / tongNV)
        : 0;

    // 4. Đếm nhân viên hoạt động
    const dangHoatDong = list.filter(nv =>
        nv.isOnline === true ||
        nv.status === "online" ||
        nv.isWorking === true
    ).length;

    // 5. Hàm cập nhật text an toàn
    function updateText(id, value) {
        const el = document.getElementById(id);
        if (el) {
            el.innerText = value;
        }
    }

    // 6. Render giao diện
    updateText('stat-total-nv', tongNV);
    updateText('stat-active-nv', dangHoatDong);
    updateText('stat-avg-perf', avgPerf + "%");

    // 7. Thanh hiệu suất
    const perfBar = document.getElementById('stat-perf-bar');

    if (perfBar) {
        perfBar.style.width = avgPerf + "%";
    }
}


/*100.FUNCTION TÌM KIẾM NHÂN VIÊN */
function timKiemNhanSu() {

    const tuKhoa = document.getElementById('search-nhan-su')
        .value
        .toLowerCase()
        .trim();

    const vaiTroLoc = document.getElementById('filter-vaitro').value;

    const container = document.getElementById('nhan-su-list-body');

    // 🔥 Luôn kiểm tra DANH_SACH_NV an toàn
    const danhSach = Array.isArray(DANH_SACH_NV)
        ? DANH_SACH_NV.filter(nv => nv && nv.id)
        : [];

    // 1. Lọc danh sách
    const danhSachLoc = danhSach.filter(nv => {

        const ten = String(nv.ten || "").toLowerCase();
        const sdt = String(nv.sdt || "").toLowerCase();
        const username = String(nv.username || "").toLowerCase();

        // Tìm theo tên / sdt / username
        const matchesName = ten.includes(tuKhoa);
        const matchesSdt = sdt.includes(tuKhoa);
        const matchesUser = username.includes(tuKhoa);

        // Lọc vai trò
        const matchesRole =
            vaiTroLoc === "Tất cả" ||
            nv.vaiTro === vaiTroLoc;

        return (
            (matchesName || matchesSdt || matchesUser)
            && matchesRole
        );
    });

    // 2. Không có kết quả
    if (danhSachLoc.length === 0) {

        if (container) {
            container.innerHTML = `
                <div style="
                    text-align:center;
                    color:#64748b;
                    padding:30px;
                    font-size:14px;
                ">
                    🔍 Không tìm thấy nhân viên nào phù hợp
                </div>
            `;
        }

        return;
    }

    // 3. Render danh sách lọc
    renderDanhSach(danhSachLoc);
}



/*101. RENDER DANH SÁCH NHÂN SỰ - BẢN PREMIUM LIGHT MODE*/
function renderDanhSach(mangDuLieu) {
    const container = document.getElementById('nhan-su-list-body');
    const paginationContainer = document.getElementById('pagination-controls');

    if (!container) return;

    // ==========================================
    // CSS HIỆU ỨNG SINH NHẬT (Tối ưu cho Nền Sáng)
    // ==========================================
    if (!document.getElementById('birthday-effect-style')) {
        const style = document.createElement('style');
        style.id = 'birthday-effect-style';
        style.innerHTML = `
            @keyframes birthdayGiftFloat {
                0% { transform: translateY(0px) scale(1); }
                50% { transform: translateY(-3px) scale(1.04); }
                100% { transform: translateY(0px) scale(1); }
            }
            @keyframes birthdayGlow {
                0% { box-shadow: 0 0 0px rgba(251,191,36,0); transform: translateY(0px); }
                50% { box-shadow: 0 10px 25px rgba(245,158,11,0.15), 0 4px 12px rgba(236,72,153,0.1); transform: translateY(-2px); }
                100% { box-shadow: 0 0 0px rgba(251,191,36,0); transform: translateY(0px); }
            }
            @keyframes birthdayBorder {
                0% { border-color:#f59e0b; }
                50% { border-color:#ec4899; }
                100% { border-color:#f59e0b; }
            }
            @keyframes birthdayIcon {
                0% { transform: rotate(-10deg) scale(1); }
                50% { transform: rotate(10deg) scale(1.2); }
                100% { transform: rotate(-10deg) scale(1); }
            }
            .birthday-card {
                animation: birthdayGlow 2.5s infinite ease-in-out, birthdayBorder 2s infinite linear;
                position: relative;
                overflow: hidden;
            }
            .birthday-card::before {
                content:'';
                position:absolute;
                top:0;
                left:-150%;
                width:120%;
                height:100%;
                background:linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent);
                transform: skewX(-25deg);
                animation: shineBirthday 3.5s infinite;
            }
            @keyframes shineBirthday {
                0% { left:-150%; }
                100% { left:150%; }
            }
            .birthday-badge {
                animation: birthdayIcon 1.2s infinite ease-in-out;
                display:inline-flex;
                align-items:center;
                justify-content:center;
            }
        `;
        document.head.appendChild(style);
    }

    // --- BƯỚC 0: LỌC DỮ LIỆU AN TOÀN ---
    const duLieuHopLe = (mangDuLieu || []).filter(nv =>
        nv && nv.id && nv.ten && nv.username
    );

    const homNay = new Date();
    const ngayHomNay = homNay.toLocaleDateString('sv-SE');

    // Format MM-DD
    const mmddHomNay = `${String(homNay.getMonth() + 1).padStart(2, '0')}-${String(homNay.getDate()).padStart(2, '0')}`;

    // Tông màu Đại sứ được làm đậm hơn một chút để nổi bật trên nền sáng
    const roleConfig = {
        "Đại sứ Hương Vị": "#e11d48",
        "Đại sứ Đón Tiếp": "#059669",
        "Đại sứ Ngoại Giao": "#2563eb",
        "Đại sứ Minh Bạch": "#7c3aed",
        "Đại sứ Sạch Sẽ": "#0891b2"
    };

    // --- BƯỚC A: PHÂN TRANG ---
    const tongSoNV = duLieuHopLe.length;
    const tongSoTrang = Math.ceil(tongSoNV / soNhanVienMoiTrang);

    if (trangHienTai > tongSoTrang && tongSoTrang > 0) {
        trangHienTai = tongSoTrang;
    }

    const batDau = (trangHienTai - 1) * soNhanVienMoiTrang;
    const ketThuc = batDau + soNhanVienMoiTrang;
    const duLieuTrangNay = duLieuHopLe.slice(batDau, ketThuc);

    // --- BƯỚC B: VẼ DANH SÁCH ---
    container.innerHTML = duLieuTrangNay.map((nv) => {
        const color = roleConfig[nv.vaiTro] || "#64748b";
        const statusColor = nv.isOnline ? "#10b981" : "#94a3b8";

        // ==========================================
        // CHECK SINH NHẬT
        // ==========================================
        let laSinhNhat = false;
        if (nv.ngaySinh) {
            const dateString = String(nv.ngaySinh);
            let mmddNhanVien = "";

            if (dateString.includes('/')) {
                const arr = dateString.split('/');
                if (arr.length >= 2) {
                    mmddNhanVien = `${arr[1].padStart(2, '0')}-${arr[0].padStart(2, '0')}`;
                }
            } else if (dateString.includes('-')) {
                const arr = dateString.split('-');
                if (arr[0].length === 4) {
                    mmddNhanVien = `${arr[1].padStart(2, '0')}-${arr[2].padStart(2, '0')}`;
                } else {
                    mmddNhanVien = `${arr[1].padStart(2, '0')}-${arr[0].padStart(2, '0')}`;
                }
            }
            laSinhNhat = mmddNhanVien === mmddHomNay;
        }

        const originalIndex = DANH_SACH_NV.findIndex(item => item && item.id === nv.id);
        const laNgayMoi = nv.lastCheckInDate !== ngayHomNay;
        const daVaoCa = !laNgayMoi && nv.daVaoCa === true;
        const daTanCa = !laNgayMoi && nv.daTanCa === true;

        // --- BUTTON CHẤM CÔNG (Light Mode UX) ---
        let vungNutBam = "";
        if (daTanCa) {
            vungNutBam = `
                <div style="
                    color:#64748b;
                    font-size:10px;
                    font-weight:bold;
                    text-align:center;
                    width:100%;
                    border:1px dashed #cbd5e1;
                    padding:5px;
                    border-radius:6px;
                    background: #f8fafc;
                ">
                    ✨ HOÀN THÀNH
                </div>
            `;
        } else if (daVaoCa) {
            vungNutBam = `
                <button onclick="chamCong('${nv.id}', 'ra')" style="
                    width:100%; background:#ef4444; color:#fff; border:none; padding:6px;
                    border-radius:6px; font-size:10px; cursor:pointer; font-weight:bold; transition: 0.2s;
                " onmouseover="this.style.background='#dc2626'" onmouseout="this.style.background='#ef4444'">
                    TAN CA
                </button>
            `;
        } else {
            vungNutBam = `
                <button onclick="chamCong('${nv.id}', 'vao')" style="
                    width:100%; background:#10b981; color:#fff; border:none; padding:6px;
                    border-radius:6px; font-size:10px; cursor:pointer; font-weight:bold; transition: 0.2s;
                " onmouseover="this.style.background='#059669'" onmouseout="this.style.background='#10b981'">
                    VÀO CA
                </button>
            `;
        }

        // Định dạng tiền lương sang định dạng VNĐ chuẩn nền sáng
        const luongHienThi = (() => {
            let val = nv.luongCoBan || nv.luong || 0;
            let soThuan = typeof val === 'string' ? val.replace(/,/g, "") : val;
            return (Number(soThuan) || 0).toLocaleString('vi-VN');
        })();

        return `
        <div class="${laSinhNhat ? 'birthday-card' : ''}" style="
            display:flex;
            align-items:center;
            padding:16px 20px;
            background:${laSinhNhat 
                ? 'linear-gradient(135deg, #fff7ed, #fdf2f8, #f5f3ff)' 
                : '#ffffff'};
            border:1px solid ${laSinhNhat ? '#f59e0b' : '#e2e8f0'};
            border-radius:12px;
            margin-bottom:12px;
            transition: all 0.2s ease;
            box-shadow: 0 1px 3px rgba(0,0,0,0.02), 0 1px 2px rgba(0,0,0,0.03);
        " onmouseover="this.style.borderColor='#cbd5e1'; this.style.boxShadow='0 4px 6px -1px rgba(0,0,0,0.05)';" onmouseout="this.style.borderColor='${laSinhNhat ? '#f59e0b' : '#e2e8f0'}'; this.style.boxShadow='0 1px 3px rgba(0,0,0,0.02)';">

            <div style="width:40%; display:flex; align-items:center; gap:16px;">
                <div onclick="document.getElementById('file-input-${originalIndex}').click()" style="position:relative; width:52px; height:52px; cursor:pointer; flex-shrink:0;">
                    <img src="${nv.avatarUrl || 'https://placeholder.com'}" style="
                        width:100%; height:100%; border-radius:10px; object-fit:cover;
                        border:2px solid ${laSinhNhat ? '#f59e0b' : '#f1f5f9'};
                    ">
                    <span style="
                        position:absolute; bottom:-2px; right:-2px; width:12px; height:12px;
                        background:${statusColor}; border:2px solid #ffffff; border-radius:50%;
                    "></span>
                    <input type="file" id="file-input-${originalIndex}" style="display:none" accept="image/*" onchange="uploadAvatarFirebase(event, ${originalIndex})">
                </div>

                <div style="display:flex; flex-direction:column; gap:4px; min-width:0; flex:1;">
                    <div style="font-weight:600; color:#0f172a; font-size:15px; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                        ${nv.ten}
                        ${laSinhNhat ? `
                            <span class="birthday-badge" style="
                                background:#fef3c7; color:#d97706; border:1px solid #fde68a;
                                padding:2px 6px; border-radius:999px; font-size:9px; font-weight:800;
                            ">
                                🎉 BIRTHDAY
                            </span>
                        ` : ''}
                    </div>

                    ${laSinhNhat ? `
                    <div style="margin: 4px 0; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                        <div onclick="
                            this.classList.toggle('opened-gift');
                            if(!this.dataset.opened){
                                this.dataset.opened='true';
                                alert('🎉 Chúc mừng sinh nhật ${nv.ten}!\\n\\nHệ thống đã kích hoạt gói quà tặng phúc lợi! 🧧');
                                this.innerHTML='🎉 ĐÃ NHẬN QUÀ';
                                this.style.background='#e2e8f0';
                                this.style.color='#64748b';
                            }
                        " style="
                            background:linear-gradient(135deg,#db2777,#x7c3aed); background-color:#db2777;
                            color:#fff; padding:4px 10px; border-radius:8px; font-size:10px; font-weight:bold;
                            cursor:pointer; user-select:none; animation: birthdayGiftFloat 1.8s ease-in-out infinite;
                            box-shadow: 0 2px 8px rgba(219,39,119,0.3);
                        ">
                            🎁 MỞ QUÀ SINH NHẬT
                        </div>
                    </div>
                    ` : ''}

                    <div style="display:flex; align-items:center; gap:12px; font-size:11px; color:#64748b; flex-wrap:wrap;">
                        <span>📞 ${nv.sdt || '---'}</span>
                        <span style="color:#2563eb; font-weight: 500;">🔑 ${nv.username || '---'}</span>
                    </div>

                    <div style="display:flex; align-items:center; gap:12px; font-size:11px; color:#64748b; flex-wrap:wrap;">
                        <span>📅 ${nv.ngaySinh || '---'}</span>
                        <span style="color:#b45309; font-weight: 500;">🪪 ${nv.cccd || '---'}</span>
                    </div>

                    <div style="font-size:11px; color:#94a3b8; display:-webkit-box; -webkit-line-clamp:1; -webkit-box-orient:vertical; overflow:hidden;">
                        🏠 ${nv.diachi || 'Chưa có địa chỉ'}
                    </div>
                </div>
            </div>

            <div style="width:25%; display:flex; flex-direction:column; gap:5px; align-items: flex-start;">
                <span style="
                    background:${color}12; color:${color}; padding:3px 8px;
                    border-radius:6px; font-size:11px; font-weight:600; border:1px solid ${color}25;
                ">
                    ${nv.vaiTro}
                </span>

                <div style="font-size:13px; color:#334155; font-weight:600; margin-top:2px;">
                    🍳 ${nv.viTri || '---'}
                </div>

                <div style="font-size:12px; color:#059669; font-weight:600;">
                    💰 Lương: ${luongHienThi}đ
                </div>

                <div style="font-size:11px; color:#64748b;">
                    🕒 Ca: ${nv.ca || '---'}
                </div>
            </div>

            <div style="width:20%; padding:0 20px 0 0; box-sizing: border-box; display: flex; flex-direction: column; gap: 8px;">
                <div>
                    <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:5px; color:#64748b;">
                        <span>Hiệu suất</span>
                        <b style="color:#0f172a;">${nv.danhGia || 0}%</b>
                    </div>
                    <div style="width:100%; height:6px; background:#e2e8f0; border-radius:99px; overflow:hidden;">
                        <div style="
                            width:${nv.danhGia || 0}%; height:100%; 
                            background:linear-gradient(90deg, ${color}, #60a5fa);
                        "></div>
                    </div>
                </div>
                
                <div>
                    ${vungNutBam}
                </div>
            </div>

            <div style="width:120px; display:flex; align-items:center; gap:6px; flex-shrink:0;">
                <button onclick="resetChamCongThuCong('${nv.id}')" style="
                    background:#f1f5f9; border:1px solid #cbd5e1; color:#64748b; padding:7px;
                    border-radius:6px; cursor:pointer; transition:0.2s; display:flex; align-items:center;
                " title="Reset ca" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'">
                    🔄
                </button>

                <button onclick="chuanBiSuaNhanSu('${nv.id}')" style="
                    background:#eff6ff; border:1px solid #bfdbfe; color:#2563eb; padding:7px;
                    border-radius:6px; cursor:pointer; transition:0.2s; display:flex; align-items:center;
                " title="Sửa hồ sơ" onmouseover="this.style.background='#dbeafe'" onmouseout="this.style.background='#eff6ff'">
                    ✏️
                </button>

                <button onclick="xoaNhanSu('${nv.id}')" style="
                    background:#fef2f2; border:1px solid #fecaca; color:#ef4444; padding:7px;
                    border-radius:6px; cursor:pointer; transition:0.2s; display:flex; align-items:center;
                " title="Xóa nhân sự" onmouseover="this.style.background='#fee2e2'" onmouseout="this.style.background='#fef2f2'">
                    🗑️
                </button>
            </div>

        </div>
        `;
    }).join('');

    // --- BƯỚC C: VẼ PHÂN TRANG (Tối ưu Light Mode) ---
    if (paginationContainer) {
        let pHTML = "";
        pHTML += `
            <button onclick="doiTrang(${trangHienTai - 1})" ${trangHienTai === 1 ? 'disabled' : ''} style="
                padding:6px 12px; border-radius:6px; border:1px solid #cbd5e1;
                background:#ffffff; color:#64748b; cursor:pointer; transition:0.2s;
            " onmouseover="if(!this.disabled) this.style.background='#f1f5f9'" onmouseout="this.style.background='#ffffff'">
                &lt;
            </button>
        `;

        for (let i = 1; i <= tongSoTrang; i++) {
            const active = i === trangHienTai;
            pHTML += `
                <button onclick="doiTrang(${i})" style="
                    width:32px; height:32px; margin:0 3px; border-radius:6px;
                    border:${active ? 'none' : '1px solid #cbd5e1'};
                    background:${active ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : '#ffffff'};
                    color:${active ? '#fff' : '#64748b'};
                    cursor:pointer; font-weight:bold; transition:0.2s;
                " onmouseover="if(!${active}) this.style.background='#f1f5f9'" onmouseout="if(!${active}) this.style.background='#ffffff'">
                    ${i}
                </button>
            `;
        }

        pHTML += `
            <button onclick="doiTrang(${trangHienTai + 1})" ${trangHienTai === tongSoTrang ? 'disabled' : ''} style="
                padding:6px 12px; border-radius:6px; border:1px solid #cbd5e1;
                background:#ffffff; color:#64748b; cursor:pointer; transition:0.2s;
            " onmouseover="if(!this.disabled) this.style.background='#f1f5f9'" onmouseout="this.style.background='#ffffff'">
                &gt;
            </button>
        `;
        paginationContainer.innerHTML = pHTML;
    }

    // --- THỐNG KÊ ---
    capNhatThongKe(duLieuHopLe);
}


/*101.RESET CA THỦ CÔNG CHO ADMIN NHÂN VIÊN*/
function resetChamCongThuCong(idNhanVien) {

    // 🔥 Kiểm tra ID
    if (!idNhanVien || idNhanVien === "undefined") {

        alert("❌ Lỗi: Không tìm thấy ID nhân sự!");

        return;
    }

    // 🔥 Tìm nhân viên theo ID
    const nv = DANH_SACH_NV.find(item =>
        item &&
        item.id === idNhanVien
    );

    if (!nv) {

        alert("❌ Không tìm thấy nhân viên!");

        return;
    }

    const tenNhanVien = nv.ten || "Không rõ";

    // 🔥 Xác nhận reset
    if (
        !confirm(
            `🔄 Reset trạng thái ca làm cho [ ${tenNhanVien} ]?\nNhân viên sẽ có thể "Vào ca" lại ngay lập tức.`
        )
    ) {
        return;
    }

    // 🔥 Update Firebase theo ID
    db.ref('NhanSu/' + idNhanVien).update({

        daVaoCa: false,
        daTanCa: false,
        isOnline: false,
        lastCheckInDate: "reseted"

    })
    .then(() => {

        alert(`✅ Đã reset trạng thái thành công cho ${tenNhanVien}`);

        // 🔥 Reload nếu có
        if (typeof taiLaiDuLieu === "function") {
            taiLaiDuLieu();
        }

    })
    .catch(err => {

        console.error("Lỗi khi reset ca:", err);

        alert("❌ Lỗi: " + err.message);

    });
}

// 🔥 Global
window.resetChamCongThuCong = resetChamCongThuCong;


/*102. UPLOAD AVATAR*/
function uploadAvatarFirebase(event, index) {

    // Lấy file
    const file = event.target.files[0];

    if (!file) return;

    // Giới hạn 500KB
    if (file.size > 500 * 1024) {

        alert("⚠️ Ảnh quá nặng! Vui lòng chọn ảnh dưới 500KB hoặc ảnh chụp màn hình.");

        return;
    }

    // Kiểm tra index an toàn
    const nv = (window.DANH_SACH_NV || [])[index];

    if (!nv) {
        alert("❌ Không tìm thấy nhân viên!");
        return;
    }

    const idNhanVien = nv.id;

    if (!idNhanVien) {
        alert("❌ Nhân viên chưa có ID!");
        return;
    }

    const reader = new FileReader();

    // Sau khi đọc ảnh xong
    reader.onloadend = async function () {

        try {

            const base64String = reader.result;

            // Lưu Firebase
            await firebase.database()
                .ref('NhanSu/' + idNhanVien)
                .update({
                    avatarUrl: base64String
                });

            // Update local
            nv.avatarUrl = base64String;

            alert("✅ Đã cập nhật ảnh nhân viên thành công!");

            // Render lại
            if (typeof renderDanhSach === "function") {
                renderDanhSach(window.DANH_SACH_NV);
            }

        } catch (error) {

            console.error("Lỗi lưu ảnh:", error);

            alert("❌ Không thể lưu ảnh vào Database!");
        }
    };

    // Bắt đầu đọc file
    reader.readAsDataURL(file);
}


/*103. VẼ DANH SÁCH NS*/
// Hàm gọi render chung
function veDanhSachNhanSu() {

    if (!Array.isArray(window.DANH_SACH_NV)) {
        window.DANH_SACH_NV = [];
    }

    renderDanhSach(window.DANH_SACH_NV);
}


/*104.CHẤM CÔNG NV - BẢN SUPPORT NHIỀU CA TRONG 1 NGÀY*/
function chamCong(idNhanVien, hanhDong) {

    // =========================
    // KIỂM TRA ID
    // =========================
    if (!idNhanVien) {
        alert("❌ Lỗi: Không tìm thấy ID nhân viên!");
        return;
    }

    // =========================
    // TÌM NHÂN VIÊN
    // =========================
    const nv = (window.DANH_SACH_NV || []).find(
        item => item.id === idNhanVien
    );

    if (!nv) {
        alert("❌ Không tìm thấy nhân viên!");
        return;
    }

    const tenNhanVien = nv.ten || "Nhân viên";

    const now = new Date();

    // YYYY-MM-DD
    const ngayHomNay = now.toLocaleDateString('sv-SE');

    // HH:mm
    const gioHienTai =
        `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // =========================
    // VÀO CA
    // =========================
    if (hanhDong === 'vao') {

        if (!confirm(`Bạn xác nhận VÀO CA lúc ${gioHienTai} cho [ ${tenNhanVien} ]?`)) {
            return;
        }

        firebase.database()
            .ref('NhanSu/' + idNhanVien)
            .update({
                daVaoCa: true,
                daTanCa: false,
                isOnline: true,
                lastCheckInDate: ngayHomNay
            })

            .then(() => {

                // ====================================
                // TẠO 1 CA MỚI (KHÔNG GHI ĐÈ)
                // ====================================

                const caMoiRef = firebase.database()
                    .ref(`ChamCong/${ngayHomNay}/${idNhanVien}`)
                    .push();

                return caMoiRef.set({
                    ten: tenNhanVien,
                    gioVao: gioHienTai,
                    gioRa: "",
                    timestamp: Date.now()
                });
            })

            .then(() => {

                // =========================
                // UPDATE LOCAL
                // =========================
                nv.daVaoCa = true;
                nv.daTanCa = false;
                nv.isOnline = true;
                nv.lastCheckInDate = ngayHomNay;

                alert(`✅ [ ${tenNhanVien} ] đã VÀO CA thành công!`);

                if (typeof renderDanhSach === "function") {
                    renderDanhSach(window.DANH_SACH_NV);
                }
            })

            .catch(err => {
                console.error(err);
                alert("❌ Lỗi: " + err.message);
            });
    }

    // =========================
    // TAN CA
    // =========================
    else if (hanhDong === 'ra') {

        if (!confirm(`Bạn xác nhận TAN CA lúc ${gioHienTai} cho [ ${tenNhanVien} ]?`)) {
            return;
        }

        firebase.database()
            .ref('NhanSu/' + idNhanVien)
            .update({
                daTanCa: true,
                isOnline: false
            })

            .then(() => {

                // ====================================
                // TÌM CA CHƯA TAN
                // ====================================

                return firebase.database()
                    .ref(`ChamCong/${ngayHomNay}/${idNhanVien}`)
                    .once("value");
            })

            .then(snapshot => {

                const data = snapshot.val();

                if (!data) {
                    throw new Error("Không tìm thấy lịch sử ca làm!");
                }

                // ====================================
                // TÌM CA GẦN NHẤT CHƯA CÓ GIỜ RA
                // ====================================

                const entries = Object.entries(data);

                let caDangLam = null;

                for (let i = entries.length - 1; i >= 0; i--) {

                    const [key, value] = entries[i];

                    if (!value.gioRa || value.gioRa === "") {
                        caDangLam = {
                            key,
                            ...value
                        };
                        break;
                    }
                }

                if (!caDangLam) {
                    throw new Error("Không tìm thấy ca đang làm!");
                }

                // ====================================
                // UPDATE GIỜ RA
                // ====================================

                return firebase.database()
                    .ref(`ChamCong/${ngayHomNay}/${idNhanVien}/${caDangLam.key}`)
                    .update({
                        gioRa: gioHienTai
                    });
            })

            .then(() => {

                // =========================
                // UPDATE LOCAL
                // =========================
                nv.daTanCa = true;
                nv.isOnline = false;

                alert(`✅ [ ${tenNhanVien} ] đã TAN CA thành công!`);

                if (typeof renderDanhSach === "function") {
                    renderDanhSach(window.DANH_SACH_NV);
                }
            })

            .catch(err => {
                console.error(err);
                alert("❌ Lỗi: " + err.message);
            });
    }
}

window.chamCong = chamCong;



/*105.HÀM HIỆN LỊCH SỬ CHẤM CÔNG - ĐÃ TỐI ƯU HIỆU NĂNG*/
function hienLichSuChamCong() {
    const body = document.getElementById('nhan-su-list-body');
    const searchInput = document.getElementById('search-nhan-su');

    if (!body || !searchInput) {
        console.error("Không tìm thấy element lịch sử chấm công!");
        return;
    }

    const headerContainer = searchInput.parentElement?.nextElementSibling;

    // Hiện / ẩn nút
    const btnBack = document.getElementById('btn-back-to-list');
    const btnHistory = document.getElementById('btn-show-history');

    if (btnBack) btnBack.style.display = 'block';
    if (btnHistory) btnHistory.style.display = 'none';

    searchInput.style.display = 'none';

    // Header
    if (headerContainer) {
        headerContainer.innerHTML = `
            <div style="width:38%;">Đại sứ & Thông tin hồ sơ</div>
            <div style="width:14%;">Ngày làm</div>
            <div style="width:13%;">Vào ca</div>
            <div style="width:13%;">Tan ca</div>
            <div style="width:12%; text-align:center;">Tổng giờ</div>
            <div style="width:10%; text-align:right;">Trạng thái</div>
        `;
    }

    body.innerHTML = `
        <div style="text-align:center; padding:30px; color:#94a3b8;">
            🔍 Đang trích xuất dữ liệu lịch sử...
        </div>
    `;

    // 1. TỐI ƯU: Tạo Map tra cứu nhanh cho DANH_SACH_NV nhằm tăng tốc độ xử lý từ O(N) về O(1)
    const nhanVienMap = new Map();
    if (Array.isArray(DANH_SACH_NV)) {
        DANH_SACH_NV.forEach(nv => {
            if (nv && nv.ten) {
                const tenChuan = String(nv.ten).trim().normalize("NFC");
                const tenNodash = tenChuan.replace(/\s+/g, '_');
                
                // Lưu cả 2 định dạng tên để đối chiếu
                nhanVienMap.set(tenChuan, nv);
                nhanVienMap.set(tenNodash, nv);
            }
        });
    }

    firebase.database().ref('ChamCong').once('value')
    .then((snapshot) => {
        const data = snapshot.val();

        if (!data) {
            body.innerHTML = `
                <div style="text-align:center; padding:20px; color:#ef4444;">
                    Chưa có lịch sử chấm công nào được ghi nhận.
                </div>
            `;
            return;
        }

        let html = "";
        let hasData = false; // Biến cờ kiểm tra xem thực sự có bản ghi hợp lệ nào được sinh ra không
        const sortedDates = Object.keys(data).sort().reverse();

        sortedDates.forEach(ngay => {
            const nhanVienTrongNgay = data[ngay] || {};

            Object.keys(nhanVienTrongNgay).forEach(idNhanVien => {
                const sessions = nhanVienTrongNgay[idNhanVien] || {};

                Object.values(sessions).forEach(log => {
                    if (!log || !log.ten) return;

                    // 2. TỐI ƯU: Tra cứu O(1) thay vì dùng .find() vòng lặp lồng
                    const logTenChuan = String(log.ten).trim().normalize("NFC");
                    const infoGoc = nhanVienMap.get(logTenChuan) || {};

                    // Tính tổng giờ
                    let tongGioHienThi = "---";
                    if (log.gioVao && log.gioRa) {
                        const [hVao, mVao] = log.gioVao.split(':').map(Number);
                        const [hRa, mRa] = log.gioRa.split(':').map(Number);

                        let phutVao = hVao * 60 + mVao;
                        let phutRa = hRa * 60 + mRa;

                        if (phutRa < phutVao) { // Ca xuyên đêm
                            phutRa += 24 * 60;
                        }

                        const tongPhut = phutRa - phutVao;
                        const soGio = Math.floor(tongPhut / 60);
                        const soPhut = tongPhut % 60;

                        tongGioHienThi = soPhut > 0 ? `${soGio}h ${soPhut}m` : `${soGio}h`;
                    }

                    hasData = true; // Xác nhận có dữ liệu hợp lệ hiển thị
                    
                    html += `
                    <div style="
                        display:flex;
                        align-items:center;
                        padding:15px;
                        background:#1e293b;
                        border:1px solid #334155;
                        border-radius:16px;
                        margin-bottom:10px;
                        transition:0.2s;
                    ">
                        <div style="width:38%; display:flex; align-items:center; gap:12px;">
                            <img
                                src="${infoGoc.avatarUrl || 'https://via.placeholder.com/45'}"
                                style="width:45px; height:45px; border-radius:10px; object-fit:cover; border:1px solid #334155;"
                            >
                            <div style="display:flex; flex-direction:column; gap:2px;">
                                <div style="font-weight:bold; color:#fff; font-size:14px;">
                                    ${log.ten}
                                </div>
                                <div style="font-size:10px; color:#94a3b8; display:flex; gap:10px;">
                                    <span>📞 ${infoGoc.sdt || '---'}</span>
                                    <span style="color:#3b82f6;">🔑 ID: ${infoGoc.username || '---'}</span>
                                </div>
                            </div>
                        </div>

                        <div style="width:14%; color:#94a3b8; font-size:12px; font-weight:500;">
                            📅 ${ngay}
                        </div>

                        <div style="width:13%; color:#10b981; font-family:'Courier New', monospace; font-weight:bold; font-size:14px;">
                            ${log.gioVao || '--:--'}
                        </div>

                        <div style="width:13%; color:#ef4444; font-family:'Courier New', monospace; font-weight:bold; font-size:14px;">
                            ${log.gioRa || '--:--'}
                        </div>

                        <div style="width:12%; text-align:center; color:#3b82f6; font-family:'Courier New', monospace; font-weight:bold; font-size:14px;">
                            ${tongGioHienThi}
                        </div>

                        <div style="width:10%; text-align:right;">
                            <span style="
                                font-size:9px;
                                padding:4px 8px;
                                border-radius:6px;
                                font-weight:900;
                                text-transform:uppercase;
                                background:${log.gioRa ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)'};
                                color:${log.gioRa ? '#10b981' : '#f59e0b'};
                                border:1px solid ${log.gioRa ? '#10b98133' : '#f59e0b33'};
                            ">
                                ${log.gioRa ? 'Xong' : 'Đang làm'}
                            </span>
                        </div>
                    </div>
                    `;
                });
            });
        });

        // 3. SỬA LỖI: Kiểm tra bằng biến cờ hasData thay vì chuỗi html đơn thuần
        body.innerHTML = hasData ? html : `
            <div style="text-align:center; padding:20px; color:#94a3b8;">
                Không có dữ liệu chấm công hợp lệ.
            </div>
        `;
    })
    .catch(err => {
        console.error("Lỗi tải lịch sử:", err);
        body.innerHTML = `
            <div style="text-align:center; padding:20px; color:#ef4444;">
                ❌ Lỗi tải lịch sử chấm công!
            </div>
        `;
    });
}

window.hienLichSuChamCong = hienLichSuChamCong;

/*106.HÀM QUAY LẠI DANH SÁCH NHÂN SỰ */
function quayLaiDanhSach() {

    const searchInput = document.getElementById('search-nhan-su');

    if (!searchInput) {
        console.error("Không tìm thấy ô tìm kiếm nhân sự!");
        return;
    }

    // 1. Header chuẩn
    const headerContainer = searchInput.parentElement?.nextElementSibling;

    if (headerContainer) {
        headerContainer.innerHTML = `
            <div style="flex:1;">Hồ sơ đại sứ</div>
            <div style="width:200px;">Vai trò & Ca làm</div>
            <div style="width:150px;">Hiệu suất</div>
            <div style="width:120px; text-align:left; padding-left: 5px;">Thao tác</div>
        `;
    }

    // 2. Điều khiển nút
    const btnBack = document.getElementById('btn-back-to-list');
    const btnHistory = document.getElementById('btn-show-history');

    if (btnBack) btnBack.style.display = 'none';
    if (btnHistory) btnHistory.style.display = 'block';

    searchInput.style.display = 'block';

    // 3. Render lại danh sách
    if (typeof renderDanhSach === "function") {
        renderDanhSach(DANH_SACH_NV || []);
    }
}

window.quayLaiDanhSach = quayLaiDanhSach;



// ===============================
// PHÂN TRANG
// ===============================
let trangHienTai = 1;

const soNhanVienMoiTrang = 5;
// Có thể đổi thành:
// 8
// 10
// 15



// ===============================
// MIGRATE NHÂN VIÊN ID
// ===============================
function migrateNhanVienID() {

    firebase.database().ref("NhanSu").once("value")
    .then(snap => {

        const data = snap.val();

        if (!data) {
            console.warn("Không có dữ liệu nhân sự!");
            return;
        }

        const updates = {};

        Object.entries(data).forEach(([key, nv]) => {

            // Nếu đã có id thì giữ nguyên
            const newId =
                nv.id ||
                ("nv_" + Date.now() + "_" + Math.floor(Math.random() * 9999));

            updates[newId] = {
                ...nv,
                id: newId
            };
        });

        // Ghi đè toàn bộ
        return firebase.database().ref("NhanSu").set(updates);

    })
    .then(() => {

        console.log("✅ DONE MIGRATE NHÂN VIÊN ID");

    })
    .catch(err => {

        console.error("❌ Lỗi migrate:", err);

    });
}

window.migrateNhanVienID = migrateNhanVienID;

/*107.XỬ LÝ KHI ĐỔI VAI TRÒ NHÂN VIÊN*/
function capNhatViTriTuDong() {

    const elVaiTro = document.getElementById('ins-vaitro');
    const elViTri = document.getElementById('ins-vitri');
    const elLuong = document.getElementById('ins-luong');

    // Kiểm tra tồn tại
    if (!elVaiTro || !elViTri || !elLuong) {
        console.warn("Thiếu element vị trí / vai trò / lương");
        return;
    }

    const vaiTro = String(elVaiTro.value || "").trim();

    // MAP VỊ TRÍ
    const mapViTri = {

        "Đại sứ Hương Vị": [
            "Bếp trưởng",
            "Bếp phó"
        ],

        "Đại sứ Ngoại Giao": [
            "Phục vụ 1",
            "Phục vụ 2"
        ],

        "Đại sứ Minh Bạch": [
            "Thu ngân"
        ],

        "Đại sứ Đón Tiếp": [
            "Bảo an"
        ],

        "Đại sứ Sạch Sẽ": [
            "Vệ sinh"
        ]
    };

    // Danh sách vị trí
    const dsViTri = mapViTri[vaiTro] || [];

    // Render option
    elViTri.innerHTML = dsViTri.map(vt => `
        <option value="${vt.trim()}">
            ${vt.trim()}
        </option>
    `).join('');

    // Nếu không có option thì clear lương
    if (dsViTri.length === 0) {
        elLuong.value = "";
        return;
    }

    // Tự cập nhật lương
    if (typeof capNhatLuongHienTai === "function") {
        capNhatLuongHienTai();
    }
}



/*108.CẬP NHẬT LƯƠNG NHÂN VIÊN*/
function capNhatLuongHienTai() {

    const elViTri = document.getElementById('ins-vitri');
    const elLuong = document.getElementById('ins-luong');

    if (!elViTri || !elLuong) {
        console.warn("Thiếu element vị trí hoặc lương");
        return;
    }

    const vitri = String(elViTri.value || "").trim();

    // FIX:
    // tránh crash nếu chưa khai báo BANG_LUONG
    const bangLuongSafe =
        typeof BANG_LUONG !== 'undefined'
        ? BANG_LUONG
        : {};

    const soTien = Number(bangLuongSafe[vitri]) || 0;

    // FIX:
    // tránh lỗi nếu thiếu hàm dinhDangTien
    if (typeof dinhDangTien === "function") {

        elLuong.value = dinhDangTien(soTien);

    } else {

        elLuong.value = soTien.toLocaleString('vi-VN');

    }
}



// ===============================
// AUTO LISTENER
// ===============================

// Đổi vai trò => đổi vị trí
document.getElementById('ins-vaitro')?.addEventListener(
    'change',
    capNhatViTriTuDong
);

// Đổi vị trí => đổi lương
document.getElementById('ins-vitri')?.addEventListener(
    'change',
    capNhatLuongHienTai
);



/*109.HÀM VẼ PHÂN TRANG NV*/
function veNutPhanTrang(tongSoNV) {

    const container = document.getElementById('pagination-controls');
    if (!container) return;

    const tongSoTrang = Math.ceil(tongSoNV / soNhanVienMoiTrang);

    // Nếu không có dữ liệu
    if (tongSoTrang <= 1) {
        container.innerHTML = "";
        return;
    }

    let html = "";

    // Nút lùi
    html += `
    <button 
        onclick="doiTrang(${trangHienTai - 1})"
        ${trangHienTai === 1 ? 'disabled' : ''}
        style="
            width:32px;
            height:32px;
            border-radius:8px;
            border:1px solid #334155;
            background:#0f172a;
            color:#94a3b8;
            cursor:pointer;
        ">
        <
    </button>`;

    // Các số trang
    for (let i = 1; i <= tongSoTrang; i++) {

        const isActive = i === trangHienTai;

        html += `
        <button 
            onclick="doiTrang(${i})"
            style="
                width:32px;
                height:32px;
                border-radius:8px;
                border:none;
                background:${isActive ? '#10b981' : '#0f172a'};
                color:${isActive ? '#fff' : '#94a3b8'};
                font-weight:bold;
                cursor:pointer;
                transition:0.2s;
            ">
            ${i}
        </button>`;
    }

    // Nút tiến
    html += `
    <button 
        onclick="doiTrang(${trangHienTai + 1})"
        ${trangHienTai === tongSoTrang ? 'disabled' : ''}
        style="
            width:32px;
            height:32px;
            border-radius:8px;
            border:1px solid #334155;
            background:#0f172a;
            color:#94a3b8;
            cursor:pointer;
        ">
        >
    </button>`;

    container.innerHTML = html;
}


/*110.HÀM ĐỔI TRANG*/
function doiTrang(trangMoi) {

    const tongSoTrang = Math.ceil(DANH_SACH_NV.length / soNhanVienMoiTrang);

    // Chặn lỗi âm trang
    if (trangMoi < 1) {
        trangMoi = 1;
    }

    // Chặn vượt trang
    if (trangMoi > tongSoTrang) {
        trangMoi = tongSoTrang;
    }

    trangHienTai = trangMoi;

    // Render lại
    renderDanhSach(DANH_SACH_NV);
}



/*111.CẬP NHẬT LƯƠNG THEO VỊ TRÍ*/
function capNhatLuongTheoViTri() {

    const elViTri = document.getElementById("ins-vitri");
    const oLuong = document.getElementById("ins-luong");

    if (!elViTri || !oLuong) return;

    const vitriDaChon = elViTri.value;

    if (BANG_LUONG && BANG_LUONG[vitriDaChon]) {

        // Format tiền
        oLuong.value = dinhDangTien(BANG_LUONG[vitriDaChon]);

    } else {

        oLuong.value = "";

    }
}


/*112.NHẢY DẤU PHẨY KHI GÕ TIỀN LƯƠNG*/
function dinhDangTien(giaTri) {

    if (giaTri === null || giaTri === undefined) {
        return "";
    }

    // Xóa ký tự không phải số
    let soThuan = giaTri.toString().replace(/\D/g, "");

    // Nếu rỗng
    if (!soThuan) {
        return "";
    }

    // Thêm dấu phẩy
    return soThuan.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}


/*113.LẤY SỐ LƯƠNG SẠCH TRƯỚC KHI LƯU VÀO FIREBASE*/
function laySoThuanTuy(chuoi) {

    if (!chuoi) return "0";

    return chuoi.toString().replace(/,/g, "");
}


/* 114. Hàm mở Cài đặt */
function moCaiDat() {
    // Ẩn các modal khác
    const dsModal = ['modal-quan-ly-nhan-su', 'modal-hoivien-container', 'modal-baocao-container'];
    dsModal.forEach(id => { if(document.getElementById(id)) document.getElementById(id).style.display = 'none'; });

    document.getElementById('modal-cai-dat').style.display = 'block';
}

/* 2. Cập nhật danh sách Esc */
// Thêm 'modal-cai-dat' vào mảng dsTab trong hàm window.addEventListener('keydown', ...) của bạn

/*115.Logic Đổi ngôn ngữ (Cơ bản) */
function doiNgonNgu(lang) {
    const dictionary = [
        ["PHỞ TÚY 11H", "PHO TUY 11H"],
        ["Số 11 Bà Triệu, Hải Phòng", "11 Ba Trieu St, Hai Phong"],
        ["Tổng quan", "Overview"],
        ["Màn Hình Bếp", "Kitchen Display"],
        ["Sơ Đồ Bàn", "Table Map"],
        ["Đơn Hàng", "Orders"],
        ["Hội Viên", "Members"],
        ["Kho Hàng", "Inventory"],
        ["Nhân Sự", "Staff"],
        ["Báo Cáo", "Reports"],
        ["Cài Đặt", "Settings"],
        ["chi tiêu", "Expenses"],
        ["Bàn", "Table"],
        ["Bar", "Bar"],
        ["đã đóng cửa", "Closed"],
        ["suất bán ngày", "Daily Sales"],
        ["đồ uống", "Drinks"],
        ["phở thường", "Regular Pho"],
        ["phở đặc biệt", "Special Pho"],
        ["trứng chần", "Poached Egg"],
        ["trứng hấp", "Steamed Egg"],
        ["giòn rụn(4 cái)", "Crispy Fried Dough(4 pcs)"],
        ["chi tiết đơn", "Order Details"],
        ["tên khách / sdt", "Customer Name / Phone"],
        ["chưa có món ăn", "No items selected"],
        ["tiền món", "Subtotal"],
        ["giảm giá", "Discount"],
        ["thuế", "Tax"],
        ["tổng cộng", "Total"],
        ["chọn mã giảm giá", "Select Discount Code"],
        ["không áp dụng", "Not Applied"],
        ["áp dụng", "Apply"],
        ["gộp", "Merge"],
        ["tách", "Split"],
        ["in hóa đơn & gửi bếp", "Print & Send to Kitchen"],
        ["thanh toán (kho)", "Payment (Stock)"],
        ["đã dọn bàn", "Table Cleared"], // Thêm dấu phẩy ở đây
        ["tìm món ăn", "Find food"],     // Thêm dấu phẩy ở đây
        ["trống", "empty"],             // Thêm dấu phẩy ở đây
        ["đang chọn", "Choosing"],      // Thêm dấu phẩy ở đây
        ["đang ăn", "eating"],          // Thêm dấu phẩy ở đây
        ["chờ dọn", "Clearing"]
    ];

/*116.TRAVERSE NGÔN NGỮ*/
    function traverse(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            let text = node.textContent;
            dictionary.forEach(([vi, en]) => {
                // Nếu là tiếng Anh, tìm Tiếng Việt (không phân biệt hoa thường) để thay thế
                if (lang === 'en') {
                    const regex = new RegExp(vi, 'gi'); 
                    text = text.replace(regex, en);
                } 
                // Nếu là tiếng Việt, tìm Tiếng Anh để thay thế ngược lại
                else {
                    const regex = new RegExp(en, 'gi');
                    text = text.replace(regex, vi);
                }
            });
            node.textContent = text;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            // Dịch cả Placeholder cho các ô nhập liệu
            if (node.placeholder) {
                dictionary.forEach(([vi, en]) => {
                    if (lang === 'en') {
                        node.placeholder = node.placeholder.replace(new RegExp(vi, 'gi'), en);
                    } else {
                        node.placeholder = node.placeholder.replace(new RegExp(en, 'gi'), vi);
                    }
                });
            }
            node.childNodes.forEach(traverse);
        }
    }

    traverse(document.body);

    // Cập nhật giao diện nút trong cài đặt
    capNhatGiaoDienNutLang(lang);
    localStorage.setItem('selected_lang', lang);
}






/*117.HÀM ĐIỀU PHỐI MỞ CHỨC NĂNG CHÍNH XÁC */
/*117.HÀM ĐIỀU PHỐI MỞ CHỨC NĂNG CHÍNH XÁC - ĐÃ THÊM CASE HOIVIEN */
function moChucNangTuSidebar(type) {
    console.log("--- Chuyển mục: " + type + " ---");

    // 1. Dọn dẹp: Ẩn các Modals đang mở
    const dsModal = [
        'modal-quan-ly-nhan-su', 
        'modal-qr-list', 
        'modal-bao-cao-tong', 
        'modal-hoivien', // Đảm bảo ID này khớp 100% với ID trong HTML
        'modal-kho-hang',
        'modal-thu-chi',
        'modal-cai-dat'
    ];
    
    dsModal.forEach(id => {
        const m = document.getElementById(id);
        if (m) m.style.display = 'none';
    });

    // 2. Mở chức năng tương ứng
    switch (type) {
        case 'hoivien': // <-- THÊM MỚI CASE NÀY
            const modalHV = document.getElementById('modal-hoivien');
            if (modalHV) {
                modalHV.style.display = 'block';
                // Nếu bạn có hàm render lại danh sách hội viên thì gọi ở đây
                if (typeof renderHoiVien === 'function') renderHoiVien(); 
            } else {
                console.error("Không tìm thấy modal-hoivien trong HTML");
            }
            break;

        case 'thuchi':
            const modalThuChi = document.getElementById('modal-thu-chi');
            if (modalThuChi) {
                modalThuChi.style.display = 'block';
                if (typeof listenThuChi === 'function') listenThuChi();
            }
            break;

        case 'baocao':
            if (typeof moModalBaoCao === 'function') moModalBaoCao();
            break;

        case 'kho':
            if (typeof moKhoHang === 'function') moKhoHang();
            break;

        case 'bep':
            if (typeof moManHinhBep === 'function') moManHinhBep();
            break;

        case 'qr':
            if (typeof moDanhSachChoQR === 'function') moDanhSachChoQR();
            break;

        case 'nhansu':
            if (typeof moQuanLyNhanSu === 'function') moQuanLyNhanSu();
            break;

        case 'caidat':
            const modalCaiDat = document.getElementById('modal-cai-dat');
            if (modalCaiDat) modalCaiDat.style.display = 'block';
            break;

        case 'tongquan':
            // Quay về sơ đồ bàn (thường là ẩn hết modal là thấy sơ đồ bàn)
            console.log("Đã quay lại màn hình Sơ đồ bàn & Đơn hàng");
            break;
    }
}

/*118.TÍNH NĂNG NHẤN ESC THÔNG MINH */
window.addEventListener('keydown', function(event) {
    if (event.key === "Escape" || event.keyCode === 27) {
        
        const modalChiTiet = document.getElementById('modal-ct-thu-chi');
        
        // 1. Nếu đang mở "Xem chi tiết thu chi", chỉ đóng nó và dừng lại (không thoát hết)
        if (modalChiTiet && modalChiTiet.style.display !== 'none') {
            console.log("⌨️ Đã nhấn Esc - Chỉ đóng Xem chi tiết Thu Chi");
            modalChiTiet.style.setProperty('display', 'none', 'important');
            return; // Dừng hàm tại đây để giữ lại giao diện Thu Chi chính
        }

        // 2. Nếu không mở chi tiết, tiến hành đóng tất cả các tab khác như bình thường
        console.log("⌨️ Đã nhấn Esc - Đang đóng các tab hệ thống...");
        const dsTab = [
            'modal-thu-chi',         
            'modal-quan-ly-nhan-su', 
            'modal-hoivien', 
            'modal-bao-cao-tong',  
            'modal-baocao-chitiet',    
            'modal-lich-su-khach', 
            'modal-qr-list',
            'modal-kho-hang',
             'modal-bep'
        ];

        dsTab.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.style.setProperty('display', 'none', 'important');
            }
        });

        // 3. Reset trạng thái Sửa của Thu Chi
        const btnLuuTC = document.getElementById('btn-luu-tc');
        if (btnLuuTC && btnLuuTC.innerText === "Cập nhật") {
            btnLuuTC.innerText = "Lưu";
            btnLuuTC.style.background = "#3b82f6";
            btnLuuTC.onclick = themThuChi;
            if(document.getElementById('tien-tc')) document.getElementById('tien-tc').value = "";
            if(document.getElementById('nd-tc')) document.getElementById('nd-tc').value = "";
        }

        // 4. Reset các trạng thái khác
        if (typeof dangSuaId !== 'undefined') dangSuaId = null;
        if (typeof resetFormNV === 'function') resetFormNV();
    }
});



/*119. TỰ ĐỘNG THÊM DẤU , KHI GÕ */
function formatCurrencyInput(input) {
    // 1. Xóa tất cả ký tự không phải số
    let value = input.value.replace(/\D/g, "");
    
    // 2. Định dạng lại có dấu phẩy
    if (value !== "") {
        input.value = Number(value).toLocaleString('en-US');
    } else {
        input.value = "";
    }
}

/*120.CẬP NHẬT LẠI HÀM LƯU (themThuChi)*/
async function themThuChi() {
    const loai = document.getElementById('loai-tc').value;
    const tienRaw = document.getElementById('tien-tc').value.replace(/,/g, "");
    const soTien = parseFloat(tienRaw);
    const noiDung = document.getElementById('nd-tc').value;
    const danhMuc = document.getElementById('dm-tc').value;
    const phuongThuc = document.getElementById('pt-tc').value;
    
    // LẤY NGÀY TỪ Ô NHẬP
    const ngayChon = document.getElementById('ngay-tc').value; 
    let thoiGianLuu;

    if (ngayChon) {
        // Nếu có chọn ngày: Lấy ngày đó + giờ hiện tại
        const gioHienTai = new Date().toLocaleTimeString('vi-VN');
        thoiGianLuu = new Date(ngayChon).toLocaleDateString('vi-VN') + ", " + gioHienTai;
    } else {
        // Nếu không chọn: Mặc định là bây giờ
        thoiGianLuu = new Date().toLocaleString('vi-VN');
    }

    if (!soTien || !noiDung) {
        alert("Vui lòng nhập đầy đủ Số tiền và Nội dung!");
        return;
    }

    const data = {
        thoi_gian: thoiGianLuu,
        loai: loai,
        so_tien: soTien,
        noi_dung: noiDung,
        danh_muc: danhMuc,
        phuong_thuc: phuongThuc,
        trang_thai: "Đã duyệt",
        nguoi_tao: "Nguyễn Kim Anh"
    };

    try {
        await db.ref("thu_chi").push(data);
        // Reset form (giữ lại ngày để nếu nhập nhiều đơn cùng ngày thì đỡ phải chọn lại)
        document.getElementById('tien-tc').value = "";
        document.getElementById('nd-tc').value = "";
    } catch (e) {
        alert("Lỗi khi lưu: " + e.message);
    }
}

/* 121. Lắng nghe và Render Thu Chi */

let chartInstances = {};

function listenThuChi() {
    db.ref("thu_chi").on("value", s => {
        const data = s.val();
        const container = document.getElementById("thu-chi-body");
        // Lấy giá trị từ bộ lọc thời gian (Nếu chưa có sẽ mặc định là 'all')
        const filterType = document.getElementById("filter-time-tc")?.value || 'all';
        
        if (!container) return;

        let h = "";
        let totalAllThu = 0, totalAllChi = 0;
        let thuToday = 0, thuYesterday = 0;
        let chiToday = 0, chiYesterday = 0;

        // Object để gom nhóm dữ liệu theo ngày cho biểu đồ
        let dailyThu = {}; 
        let dailyChi = {};

        const now = new Date();
        const getDateOnly = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

        const today = getDateOnly(now);
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);

        const list = data ? Object.entries(data) : [];

     
       // 1. LỌC DỮ LIỆU THEO THỜI GIAN CHỌN
const filteredList = list.filter(([key, val]) => {
    if (!val.thoi_gian) return false;
    
    // Chuyển "28/04/2026, 09:23:45" thành Date object chuẩn
    const dateStr = val.thoi_gian.split(',')[0].trim();
    const [d, m, y] = dateStr.split('/');
    const itemDateObj = new Date(y, m - 1, d); // Giữ object để dùng cho Month/Year
    const itemDateTime = itemDateObj.getTime(); // Dùng số để so sánh nhanh

    if (filterType === 'all') return true;
    
    // Lọc Hôm nay
    if (filterType === 'today') return itemDateTime === today.getTime();

    // Lọc Tuần này
    if (filterType === 'week') {
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        return itemDateTime >= startOfWeek.getTime();
    }

    // Lọc Tháng này
    if (filterType === 'month') {
        return itemDateObj.getMonth() === today.getMonth() && 
               itemDateObj.getFullYear() === today.getFullYear();
    }

    // Lọc Năm nay
    if (filterType === 'year') {
        return itemDateObj.getFullYear() === today.getFullYear();
    }

    // Lọc Tùy chỉnh (Từ ngày... Đến ngày...)
    if (filterType === 'custom') {
        const from = document.getElementById('date-from').value; 
        const to = document.getElementById('date-to').value;
        
        if (!from || !to) return true; 

        const dFrom = new Date(from).setHours(0,0,0,0);
        const dTo = new Date(to).setHours(0,0,0,0);
        
        return itemDateTime >= dFrom && itemDateTime <= dTo;
    }

    return true;
});

        // =========================
        // 2. LOOP TÍNH TOÁN & GOM NHÓM BIỂU ĐỒ (Trên danh sách đã lọc)
        // =========================
        filteredList.forEach(([key, val]) => {
            const tien = Number(val.so_tien) || 0;
            const isThu = val.loai === "thu";

            const datePart = val.thoi_gian.split(',')[0].trim(); 
            const [d, m, y] = datePart.split('/');
            const itemDate = new Date(y, m - 1, d);
            const dateKey = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;

            if (isThu) {
                totalAllThu += tien;
                dailyThu[dateKey] = (dailyThu[dateKey] || 0) + tien;
                if (getDateOnly(itemDate).getTime() === today.getTime()) thuToday += tien;
                if (getDateOnly(itemDate).getTime() === yesterday.getTime()) thuYesterday += tien;
            } else {
                totalAllChi += tien;
                dailyChi[dateKey] = (dailyChi[dateKey] || 0) + tien;
                if (getDateOnly(itemDate).getTime() === today.getTime()) chiToday += tien;
                if (getDateOnly(itemDate).getTime() === yesterday.getTime()) chiYesterday += tien;
            }
        });

        // =========================
        // 3. RENDER TABLE (Đảo ngược danh sách đã lọc)
        // =========================
               const listDisplay = [...filteredList].reverse();
        listDisplay.forEach(([key, val]) => {
            const isThu = val.loai === "thu";
            const soTien = Number(val.so_tien) || 0;
            const rowColor = isThu ? '#10b981' : '#ef4444';
            const rowIcon = isThu ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down';


let thoiGianRaw = val.thoi_gian || "";
    let ngay = thoiGianRaw.split(',')[0] || "";
    let gio = thoiGianRaw.split(',')[1] || "";

            let iconDm = "📁";
            if(val.danh_muc === "Doanh thu bán hàng") iconDm = "💹";
            if(val.danh_muc === "Lương nhân viên") iconDm = "👤";
            if(val.danh_muc === "Nguyên liệu") iconDm = "🥩";
            if(val.danh_muc === "Chi phí năng lượng") iconDm = "🔥";

            let iconPt = val.phuong_thuc === "Chuyển khoản" ? "🏛️" : "💵";

          h += `
    <tr style="border-bottom:1px solid #33415555;" onmouseover="this.style.background='#0f172a55'">
        <!-- 1. LOẠI -->
        <td style="padding:12px 20px;">
            <div style="display:flex; gap:6px; align-items:center;">
                <i class="fas ${rowIcon}" style="color:${rowColor}"></i>
                <span style="color:${rowColor}; font-weight:bold; font-size:11px;">${isThu ? 'THU' : 'CHI'}</span>
            </div>
        </td>

        <!-- 2. NỘI DUNG -->
        <td style="padding:12px 20px; color:#fff;">${val.noi_dung}</td>

        <!-- 3. DANH MỤC -->
        <td style="padding:12px 20px; color:#94a3b8;">${iconDm} ${val.danh_muc || 'Khác'}</td>

        <!-- 4. SỐ TIỀN -->
        <td style="padding:12px 20px; text-align:right; color:${rowColor}; font-weight:bold;">${val.so_tien.toLocaleString()}đ</td>

        <!-- 5. PHƯƠNG THỨC -->
        <td style="padding:12px 20px; color:#fff;">
            <span style="font-size:14px;">${iconPt}</span> ${val.phuong_thuc || 'Tiền mặt'}
        </td>

        <!-- 6. NGƯỜI NHẬP (Đã thêm mới) -->
        <td style="padding:12px 20px; text-align:center;">
            <div style="display:flex; align-items:center; justify-content:center; gap:6px; color:#3b82f6;">
                <i class="fas fa-user-circle" style="font-size:12px;"></i>
                <span style="font-size:12px;">${val.nguoi_tao || "Nguyễn Kim Anh"}</span>
            </div>
        </td>

        <!-- 7. THỜI GIAN -->
        <td style="padding:12px 20px; color:#fff; font-size:11px;">
            <div style="font-weight:bold;">${gio.trim()}</div>
            <div style="color:#64748b; font-size:10px;">${ngay.trim()}</div>
        </td>

        <!-- 8. TRẠNG THÁI -->
        <td style="padding:12px 20px; text-align:center;">
            <span style="background:#10b98122; color:#10b981; padding:3px 8px; border-radius:10px; font-size:10px; font-weight:bold;">Đã duyệt</span>
        </td>

        <!-- 9. THAO TÁC (Đã khôi phục nút Xem/Lịch sử) -->
        <td style="padding:12px 20px; text-align:center; width: 130px;">
    <div style="display:flex; justify-content:center; gap:6px;">
        <!-- Nút Xem chi tiết -->
        <button onclick="xemChiTietTC('${key}')" title="Xem chi tiết" 
                style="background:#3b82f622; border:none; color:#3b82f6; width:28px; height:28px; border-radius:6px; cursor:pointer; transition:0.2s;">
            <i class="fas fa-eye"></i>
        </button>
        
        <!-- NÚT SỬA (ĐÃ KHÔI PHỤC) -->
        <button onclick="suaTC('${key}')" title="Sửa giao dịch" 
                style="background:#fbbf2422; border:none; color:#fbbf24; width:28px; height:28px; border-radius:6px; cursor:pointer; transition:0.2s;">
            <i class="fas fa-edit"></i>
        </button>
        
        <!-- Nút Xóa -->
        <button onclick="xoaTC('${key}')" title="Xóa" 
                style="background:#ef444422; border:none; color:#ef4444; width:28px; height:28px; border-radius:6px; cursor:pointer; transition:0.2s;">
            <i class="fas fa-trash"></i>
        </button>
    </div>
</td>
    </tr>`;
});
        container.innerHTML = h || '<tr><td colspan="7" style="text-align:center; padding:40px; color:#64748b;">Không có dữ liệu trong khoảng thời gian này</td></tr>';


        // =========================
        // 4. UPDATE UI DASHBOARD
        // =========================
        const calcPercent = (t, y) => (y <= 0) ? (t > 0 ? 100 : 0) : ((t - y) / y) * 100;
        const renderPercent = (id, val) => {
            const el = document.getElementById(id); if (!el) return;
            const isUp = val >= 0; const color = isUp ? '#10b981' : '#ef4444';
            el.innerHTML = `<span style="color:${color}; font-weight:bold; background:${color}22; padding:2px 6px; border-radius:6px;">${isUp ? '↑' : '↓'} ${Math.abs(val).toFixed(1)}%</span>`;
        };

         document.getElementById('tong-thu').innerText = totalAllThu.toLocaleString() + "đ";
        document.getElementById('tong-chi').innerText = totalAllChi.toLocaleString() + "đ";
        document.getElementById('loi-nhuan').innerText = (totalAllThu - totalAllChi).toLocaleString() + "đ";

        // === THÊM VÀO ĐÂY ===
        const countElement = document.getElementById('count-tc');
        if (countElement) {
            countElement.innerText = `${filteredList.length} giao dịch`;
        }
        // ====================

        renderPercent('percent-thu', calcPercent(thuToday, thuYesterday));
        renderPercent('percent-chi', calcPercent(chiToday, chiYesterday));
        renderPercent('percent-ln', calcPercent(thuToday - chiToday, thuYesterday - chiYesterday));

        // =========================
        // 5. XỬ LÝ BIỂU ĐỒ
        // =========================
        const allDates = [...new Set([...Object.keys(dailyThu), ...Object.keys(dailyChi)])].sort();
        renderSparkline('chart-thu', '#10b981', allDates.map(d => dailyThu[d] || 0));
        renderSparkline('chart-chi', '#ef4444', allDates.map(d => dailyChi[d] || 0));
        renderSparkline('chart-ln', '#3b82f6', allDates.map(d => (dailyThu[d] || 0) - (dailyChi[d] || 0)));
    });
}



/* 122. VẼ BIỂU ĐỒ THU CHI PHỤ TRỢ */
function renderSparkline(id, color, points) {
    const canvas = document.getElementById(id);
    if (!canvas) return;

    if (chartInstances[id]) {
        chartInstances[id].destroy();
    }

    const ctx = canvas.getContext('2d');
    
    // Tạo Gradient chuyên nghiệp hơn
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, color + '66'); // Đậm hơn một chút ở đỉnh
    gradient.addColorStop(1, color + '00'); // Trong suốt hoàn toàn ở đáy

    chartInstances[id] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: points.map((_, i) => i),
            datasets: [{
                data: points,
                borderColor: color,
                borderWidth: 2,
                fill: true,
                backgroundColor: gradient,
                tension: 0.4, 
                pointRadius: 0,
                pointHoverRadius: 4, // Hiện điểm tròn nhỏ khi di chuột vào (giống soi giá chứng khoán)
                pointHitRadius: 10,  // Dễ bắt điểm hơn khi di chuột gần đường kẻ
                borderCapStyle: 'round',
                borderJoinStyle: 'round'
            }]
        },
        options: {
            plugins: {
                legend: { display: false },
                tooltip: { 
                    enabled: true, // Bật lại tooltip nhưng cấu hình tối giản
                    intersect: false,
                    mode: 'index',
                    callbacks: {
                        label: function(context) {
                            return context.parsed.y.toLocaleString() + 'đ';
                        },
                        title: () => null // Ẩn tiêu đề tooltip cho gọn
                    }
                }
            },
            scales: {
                x: { display: false },
                y: { 
                    display: false,
                    // Thêm đệm để đường kẻ không bị chạm sát mép trên/dưới của Card
                    suggestedMin: Math.min(...points) * 0.9,
                    suggestedMax: Math.max(...points) * 1.1
                }
            },
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index',
            },
            animation: {
                duration: 1000,
                easing: 'easeInOutQuart' // Hiệu ứng vẽ đường kẻ mượt hơn
            }
        }
    });
}

/* 123.TÍCH HỢP THU CHI DATA VÀO FIREBASE */
function updateChartsAndPercents(dataThu, dataChi) {
    // Vẽ biểu đồ thu (lấy 10 giao dịch cuối)
    renderSparkline('chart-thu', '#10b981', dataThu.slice(-10));
    
    // Vẽ biểu đồ chi (lấy 10 giao dịch cuối)
    renderSparkline('chart-chi', '#ef4444', dataChi.slice(-10));
    
    // Vẽ biểu đồ lợi nhuận (giả lập dựa trên cặp thu - chi)
    const dataLN = dataThu.slice(-10).map((v, i) => v - (dataChi.slice(-10)[i] || 0));
    renderSparkline('chart-ln', '#3b82f6', dataLN);
}

/* 124.XÓA THU CHI */
function xoaThuChi(key) {
    if(confirm("Xóa giao dịch này?")) db.ref("thu_chi/"+key).remove();
}

// Chạy khởi tạo
listenThuChi();

/* 124.XÓA THU CHI */
async function xoaTC(key) {
    if (confirm("Bạn có chắc chắn muốn xóa giao dịch này không?")) {
        try {
            await db.ref("thu_chi/" + key).remove();
            alert("Đã xóa thành công!");
        } catch (e) {
            alert("Lỗi khi xóa: " + e.message);
        }
    }
}

/* 124.XEM CHI TIẾT THU CHI */
function xemChiTietTC(key) {
    db.ref("thu_chi/" + key).once("value", s => {
        const v = s.val();
        if (!v) return;

        const isThu = v.loai === 'thu';
        const modal = document.getElementById('modal-ct-thu-chi');
        const content = document.getElementById('ct-tc-content');

        // 1. Chuẩn bị phần Lịch sử (màu vàng)
        let lichSuHTML = "";
        if (v.lich_su_sua && v.lich_su_sua.length > 0) {
            lichSuHTML = `
                <div style="margin-top:20px; border-top:1px dashed #334155; padding-top:15px;">
                    <div style="font-size:11px; color:#fbbf24; text-transform:uppercase; letter-spacing:1px; margin-bottom:10px; font-weight:bold;">
                        <i class="fas fa-history"></i> Lịch sử chỉnh sửa
                    </div>
                    <div style="max-height: 150px; overflow-y: auto; padding-right: 5px;">
                        ${v.lich_su_sua.slice().reverse().map(ls => `
                            <div style="background:#0f172a; padding:10px; border-radius:8px; margin-bottom:8px; border:1px solid #1e293b;">
                                <div style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:11px;">
                                    <span style="color:#94a3b8;">${ls.thoi_gian_sua}</span>
                                    <span style="color:#3b82f6; font-weight:600;">${ls.nguoi_sua}</span>
                                </div>
                                <div style="color:#64748b; font-size:11px; line-height:1.4;">
                                    <div>Cũ: <span style="color:#cbd5e1;">${ls.noi_dung_cu} (${Number(ls.so_tien_cu).toLocaleString()}đ)</span></div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // 2. Đổ toàn bộ dữ liệu (Dùng dấu ` để bao toàn bộ)
        content.innerHTML = `
            <div style="text-align:center; margin-bottom:20px;">
                <div style="font-size:28px; font-weight:bold; color:${isThu ? '#10b981' : '#ef4444'};">
                    ${isThu ? '+' : '-'}${Number(v.so_tien).toLocaleString()}đ
                </div>
            </div>
            
            <div style="display:flex; flex-direction:column; gap:10px; border-top:1px dashed #334155; padding-top:15px;">
                <div style="display:flex; justify-content:space-between;"><span style="color:#64748b;">Trạng thái:</span><span style="color:#10b981; font-weight:bold;">${v.trang_thai || 'Đã duyệt'}</span></div>
                <div style="display:flex; justify-content:space-between;"><span style="color:#64748b;">Nội dung:</span><span style="color:#fff;">${v.noi_dung}</span></div>
                <div style="display:flex; justify-content:space-between;"><span style="color:#64748b;">Danh mục:</span><span style="color:#fff;">${v.danh_muc || 'Khác'}</span></div>
                <div style="display:flex; justify-content:space-between;"><span style="color:#64748b;">Thời gian tạo:</span><span style="color:#fff;">${v.thoi_gian}</span></div>
                <div style="display:flex; justify-content:space-between;"><span style="color:#64748b;">Người tạo:</span><span style="color:#3b82f6;">${v.nguoi_tao}</span></div>
            </div>

            <!-- Phần Thông tin Duyệt -->
            <div style="display:flex; justify-content:space-between; margin-top:10px; border-top:1px dashed #334155; padding-top:10px;">
                <span style="color:#64748b;">Người duyệt:</span>
                <span style="color:#10b981;">${v.nguoi_duyet || '---'}</span>
            </div>

            <!-- Phần Lịch sử sửa (Nếu có) -->
            ${lichSuHTML}
        `;

        modal.style.display = 'flex';
    });
}


/* 125.SỬA THU CHI*/
async function suaTC(key) {
    db.ref("thu_chi/" + key).once("value", s => {
        const v = s.val();
        if (!v) return;

        // Đổ dữ liệu lên form nhập
        document.getElementById('loai-tc').value = v.loai;
        document.getElementById('tien-tc').value = Number(v.so_tien).toLocaleString('en-US');
        document.getElementById('nd-tc').value = v.noi_dung;
        document.getElementById('dm-tc').value = v.danh_muc;
        document.getElementById('pt-tc').value = v.phuong_thuc;

        const btnLuu = document.getElementById('btn-luu-tc');
        btnLuu.innerText = "Cập nhật";
        btnLuu.style.background = "#fbbf24";

        btnLuu.onclick = async function() {
            const tienMoi = parseFloat(document.getElementById('tien-tc').value.replace(/,/g, ""));
            
            // GHI LỊCH SỬ CHỈNH SỬA
            const lichSuMoi = {
                thoi_gian_sua: new Date().toLocaleString('vi-VN'),
                nguoi_sua: "Nguyễn Kim Anh",
                noi_dung_cu: v.noi_dung,
                so_tien_cu: v.so_tien
            };
            const danhSachLichSu = v.lich_su_sua || [];
            danhSachLichSu.push(lichSuMoi);

            await db.ref("thu_chi/" + key).update({
                loai: document.getElementById('loai-tc').value,
                so_tien: tienMoi,
                noi_dung: document.getElementById('nd-tc').value,
                danh_muc: document.getElementById('dm-tc').value,
                phuong_thuc: document.getElementById('pt-tc').value,
                lich_su_sua: danhSachLichSu // Lưu mảng lịch sử vào Firebase
            });

            alert("Đã cập nhật!");
            btnLuu.innerText = "Lưu";
            btnLuu.style.background = "#3b82f6";
            btnLuu.onclick = themThuChi;
        };
    });
}

/* 126.ẨN HOẶC HIỆN KHUNG CHỌN NGÀY TÙY CHỈNH*/
function toggleCustomDate() {
    const val = document.getElementById('filter-time-tc').value;
    document.getElementById('custom-date-group').style.display = (val === 'custom') ? 'flex' : 'none';
}

function toggleRevCustomDate() {
    const val = document.getElementById('rev-table-filter-time').value;
    document.getElementById('rev-custom-date-group').style.display = (val === 'custom') ? 'flex' : 'none';
}


/*127.CẬP NHẬT REALTIME HỘI VIÊN*/
function kichHoatLangNgheDiemKhach(customerId) {

    if (!customerId) return;

    db.ref(`members/${customerId}`)
    .on("value", memberSnap => {

        const v = memberSnap.val() || {};

        const points =
            (Number(v.tuy_tam_count) || 0) +
            (Number(v.tuy_thuong_count) || 0);

        const tableIdx = TABLES.findIndex(
            t => String(t.customerId) === String(customerId)
        );

        // 🔥 RENDER FULL CARD MỚI
        renderCustomerCard(
            {
                ...v,
                points: points
            },

            tableIdx
        );

        console.log(
            "🔥 Realtime customer updated:",
            points
        );

    });
}



/* Hàm hỗ trợ mở nhanh báo cáo từ màn hình Bếp */
function moChucNhanhBaoCaoTuBep() {
    // 1. Đóng màn hình bếp trước
    if (typeof dongManHinhBep === "function") {
        dongManHinhBep();
    } else {
        document.getElementById('modal-bep').style.display = 'none';
    }

    // 2. Gọi hàm điều phối mở báo cáo (Dùng hàm 117 của bạn)
    if (typeof moChucNhanTuSidebar === "function") {
        moChucNhanTuSidebar('baocao');
    } else {
        // Nếu không gọi được hàm điều phối, mở trực tiếp modal báo cáo
        const modalBC = document.getElementById('modal-bao-cao-tong');
        if (modalBC) modalBC.style.display = 'block';
    }
    
    console.log("🚀 Mở nhanh Báo cáo từ phím tắt Double Click tại Bếp");
}




let revenueChartInstance = null;

function moModalRevenueTable() {
    document.getElementById('modal-revenue-by-table').style.display = 'flex';
    taiBaoCaoDoanhThuTheoBan();
}

function dongModalRevenueTable() {
    document.getElementById('modal-revenue-by-table').style.display = 'none';
}

/* =========================================================
   BÁO CÁO DOANH THU THEO BÀN - FIX FULL
========================================================= */

function taiBaoCaoDoanhThuTheoBan() {

    const timeFilter =
        document.getElementById('rev-table-filter-time').value;

    const startVal =
        document.getElementById('rev-start-date').value;

    const endVal =
        document.getElementById('rev-end-date').value;

    db.ref("history_orders").once("value").then(snap => {

        const data = snap.val();

        if (!data) {

            document.getElementById(
                'revenue-table-list'
            ).innerHTML = "Chưa có dữ liệu!";

            return;
        }

        const orders = Object.values(data);

        let tableMap = {};

        let grandTotal = 0;

        let totalOrdersCount = 0;

        /* =========================
           TIME FILTER
        ========================= */

        const now = new Date();

        const startOfToday =
            new Date(
                now.setHours(0,0,0,0)
            ).getTime();

        const dayMs =
            24 * 60 * 60 * 1000;

        let curS = 0;
        let curE = Date.now();

        let prevS = 0;
        let prevE = 0;

        if (timeFilter === 'today') {

            curS = startOfToday;
            curE = Date.now();

            prevS = startOfToday - dayMs;
            prevE = startOfToday;

        } else if (timeFilter === 'yesterday') {

            curS = startOfToday - dayMs;
            curE = startOfToday;

            prevS = startOfToday - (dayMs * 2);
            prevE = startOfToday - dayMs;

        } else if (
            timeFilter === 'custom'
            && startVal
            && endVal
        ) {

            curS =
                new Date(startVal)
                .setHours(0,0,0,0);

            curE =
                new Date(endVal)
                .setHours(23,59,59,999);

            let duration = curE - curS;

            prevS = curS - duration;
            prevE = curS;
        }

        /* =========================
           CALC
        ========================= */

        orders.forEach(order => {

            const t =
                order.timestamp || 0;

            const money =
                Number(order.total || 0);

            const tableName =
                order.tableName || "Bàn ẩn";

            if (t >= curS && t <= curE) {

                if (money <= 0) return;

                if (!tableMap[tableName]) {

                    tableMap[tableName] = {
                        name: tableName,
                        total: 0,
                        count: 0,
                        totalPrev: 0
                    };
                }

                tableMap[tableName].total += money;

                tableMap[tableName].count += 1;

                grandTotal += money;

                totalOrdersCount += 1;

            } else if (
                t >= prevS
                && t < prevE
            ) {

                if (money <= 0) return;

                if (!tableMap[tableName]) {

                    tableMap[tableName] = {
                        name: tableName,
                        total: 0,
                        count: 0,
                        totalPrev: 0
                    };
                }

                tableMap[tableName].totalPrev += money;
            }
        });

        /* =========================
           SORT
        ========================= */

        const sortedData =
            Object.values(tableMap)

            .filter(item => item.total > 0)

            .sort((a, b) =>
                b.total - a.total
            );

        /* =========================
           RENDER
        ========================= */

        const listEl =
            document.getElementById(
                'revenue-table-list'
            );

        const rows = sortedData.map((item, index) => {

            const phanTram =
                grandTotal > 0
                ? ((item.total / grandTotal) * 100).toFixed(1)
                : 0;

            /* =========================
               TREND
            ========================= */

            let trend = "";

            let diff = 0;

            if (item.totalPrev > 0) {

                diff =
                    (
                        (
                            (item.total - item.totalPrev)
                            / item.totalPrev
                        ) * 100
                    ).toFixed(1);

            } else {

                diff =
                    item.total > 0
                    ? 100
                    : 0;
            }

            if (diff > 0) {

                trend = `
                <span style="
                    color:#16a34a;
                    font-weight:800;
                ">
                    ↑ ${diff}%
                </span>
                `;

            } else if (diff < 0) {

                trend = `
                <span style="
                    color:#ef4444;
                    font-weight:800;
                ">
                    ↓ ${Math.abs(diff)}%
                </span>
                `;

            } else {

                trend = `
                <span style="
                    color:#94a3b8;
                    font-weight:700;
                ">
                    0%
                </span>
                `;
            }

            /* =========================
               TOP STYLE
            ========================= */

            let progressColor = "#94a3b8";

            let subTitle =
                "Hiệu suất trung bình";

            let rankDisplay = "";

            let cardBorder = "#e2e8f0";

            let bgSoft = "#ffffff";

            if (index === 0) {

                progressColor = "#f59e0b";

                cardBorder = "#fbbf24";

                bgSoft =
                    "linear-gradient(135deg,#fffdf7,#ffffff)";

                subTitle =
                    "🔥 Hiệu suất vượt trội";

                rankDisplay = `

                <div style="
                    width:82px;
                    min-width:82px;
                    height:96px;

                    border-radius:22px;

                    background:
                        linear-gradient(
                            180deg,
                            #fff7d6 0%,
                            #fffdf5 100%
                        );

                    border:1px solid #fde68a;

                    display:flex;
                    flex-direction:column;
                    align-items:center;
                    justify-content:center;

                    position:relative;
                ">

                    <div style="
                        position:absolute;
                        top:-12px;
                        font-size:22px;
                    ">
                        👑
                    </div>

                    <div style="
                        width:46px;
                        height:46px;

                        border-radius:999px;

                        background:
                            linear-gradient(
                                135deg,
                                #fcd34d,
                                #f59e0b
                            );

                        color:white;

                        display:flex;
                        align-items:center;
                        justify-content:center;

                        font-size:22px;
                        font-weight:900;

                        border:3px solid #fff7ed;

                        box-shadow:
                            0 6px 14px rgba(245,158,11,0.35);
                    ">
                        1
                    </div>

                    <div style="
                        margin-top:7px;

                        font-size:10px;
                        font-weight:900;

                        color:#d97706;

                        letter-spacing:0.5px;
                    ">
                        LEADER
                    </div>

                    <div style="
                        margin-top:4px;

                        padding:2px 7px;

                        border-radius:999px;

                        border:1px solid #fed7aa;

                        background:#fff;

                        font-size:8px;
                        font-weight:800;

                        color:#d97706;
                    ">
                        TOP TABLE
                    </div>

                </div>
                `;

            } else if (index === 1) {

                progressColor = "#3b82f6";

                cardBorder = "#cbd5e1";

                bgSoft =
                    "linear-gradient(135deg,#f8fbff,#ffffff)";

                subTitle =
                    "✨ Hiệu suất tốt";

                rankDisplay = `

                <div style="
                    width:82px;
                    min-width:82px;
                    height:96px;

                    border-radius:22px;

                    background:
                        linear-gradient(
                            180deg,
                            #f8fafc 0%,
                            #ffffff 100%
                        );

                    border:1px solid #e2e8f0;

                    display:flex;
                    flex-direction:column;
                    align-items:center;
                    justify-content:center;

                    position:relative;
                ">

                    <div style="
                        position:absolute;
                        top:-12px;
                        font-size:20px;
                    ">
                        🥈
                    </div>

                    <div style="
                        width:46px;
                        height:46px;

                        border-radius:999px;

                        background:
                            linear-gradient(
                                135deg,
                                #e2e8f0,
                                #94a3b8
                            );

                        color:white;

                        display:flex;
                        align-items:center;
                        justify-content:center;

                        font-size:22px;
                        font-weight:900;

                        border:3px solid white;

                        box-shadow:
                            0 6px 14px rgba(148,163,184,0.35);
                    ">
                        2
                    </div>

                    <div style="
                        margin-top:7px;

                        font-size:10px;
                        font-weight:900;

                        color:#475569;

                        letter-spacing:0.5px;
                    ">
                        EXCELLENT
                    </div>

                    <div style="
                        margin-top:4px;

                        padding:2px 7px;

                        border-radius:999px;

                        border:1px solid #cbd5e1;

                        background:white;

                        font-size:8px;
                        font-weight:800;

                        color:#475569;
                    ">
                        TOP TABLE
                    </div>

                </div>
                `;

            } else if (index === 2) {

                progressColor = "#f97316";

                cardBorder = "#fdba74";

                bgSoft =
                    "linear-gradient(135deg,#fff8f3,#ffffff)";

                subTitle =
                    "💪 Hiệu suất khá";

                rankDisplay = `

                <div style="
                    width:82px;
                    min-width:82px;
                    height:96px;

                    border-radius:22px;

                    background:
                        linear-gradient(
                            180deg,
                            #fff7ed 0%,
                            #ffffff 100%
                        );

                    border:1px solid #fed7aa;

                    display:flex;
                    flex-direction:column;
                    align-items:center;
                    justify-content:center;

                    position:relative;
                ">

                    <div style="
                        position:absolute;
                        top:-12px;
                        font-size:20px;
                    ">
                        🥉
                    </div>

                    <div style="
                        width:46px;
                        height:46px;

                        border-radius:999px;

                        background:
                            linear-gradient(
                                135deg,
                                #fdba74,
                                #f97316
                            );

                        color:white;

                        display:flex;
                        align-items:center;
                        justify-content:center;

                        font-size:22px;
                        font-weight:900;

                        border:3px solid white;

                        box-shadow:
                            0 6px 14px rgba(249,115,22,0.35);
                    ">
                        3
                    </div>

                    <div style="
                        margin-top:7px;

                        font-size:10px;
                        font-weight:900;

                        color:#c2410c;

                        letter-spacing:0.5px;
                    ">
                        STRONG
                    </div>

                    <div style="
                        margin-top:4px;

                        padding:2px 7px;

                        border-radius:999px;

                        border:1px solid #fdba74;

                        background:white;

                        font-size:8px;
                        font-weight:800;

                        color:#c2410c;
                    ">
                        TOP TABLE
                    </div>

                </div>
                `;

            } else {

                rankDisplay = `

                <div style="
                    width:62px;
                    min-width:62px;
                    height:62px;

                    border-radius:18px;

                    background:#f8fafc;

                    border:1px solid #e2e8f0;

                    display:flex;
                    align-items:center;
                    justify-content:center;

                    font-size:24px;
                    font-weight:900;

                    color:#64748b;
                ">
                    ${index + 1}
                </div>
                `;
            }

            return `

            <div style="
                background:${bgSoft};

                border:1px solid ${cardBorder};

                border-left:4px solid ${progressColor};

                border-radius:26px;

                padding:16px 18px;

                display:flex;
                align-items:center;
                justify-content:space-between;

                gap:18px;

                margin-bottom:14px;

                box-shadow:
                    0 6px 20px rgba(15,23,42,0.04);
            ">

                <!-- LEFT -->

                <div style="
                    display:flex;
                    align-items:center;
                    gap:16px;
                    flex:1;
                ">

                    ${rankDisplay}

                    <!-- INFO -->

                    <div style="
                        flex:1;
                    ">

                        <div style="
                            display:flex;
                            align-items:center;
                            gap:6px;
                        ">

                            <b style="
                                font-size:15px;
                                color:#0f172a;
                            ">
                                ${item.name}
                            </b>

                            ${index === 0 ? '👑' : ''}

                        </div>

                        <div style="
                            margin-top:2px;

                            font-size:10px;
                            color:#64748b;
                        ">
                            ${item.count} đơn hàng phục vụ
                        </div>

                        <div style="
                            margin-top:6px;

                            font-size:10px;
                            font-weight:700;

                            color:${progressColor};
                        ">
                            ● ${subTitle}
                        </div>

                        <!-- PROGRESS -->

                        <div style="
                            display:flex;
                            align-items:center;
                            gap:10px;

                            margin-top:8px;
                        ">

                            <div style="
                                flex:1;
                                height:6px;

                                border-radius:999px;

                                overflow:hidden;

                                background:#e2e8f0;
                            ">

                                <div style="
                                    width:${phanTram}%;

                                    height:100%;

                                    border-radius:999px;

                                    background:${progressColor};
                                "></div>

                            </div>

                            <div style="
                                font-size:11px;
                                font-weight:800;

                                color:${progressColor};
                            ">
                                ${phanTram}%
                            </div>

                        </div>

                    </div>

                </div>

                <!-- RIGHT -->

                <div style="
                    min-width:120px;
                    text-align:right;
                ">

                    <div style="
                        font-size:17px;
                        font-weight:900;

                        color:#0f172a;
                    ">
                        ${item.total.toLocaleString()}đ
                    </div>

                    <div style="
                        margin-top:6px;

                        display:inline-flex;
                        align-items:center;
                        gap:5px;

                        background:#f8fafc;

                        padding:5px 9px;

                        border-radius:10px;

                        font-size:11px;
                        font-weight:800;

                        color:${progressColor};
                    ">
                        ${phanTram}% doanh thu
                    </div>

                    <div style="
                        margin-top:6px;

                        font-size:10px;
                    ">
                        ${trend}

                        <span style="
                            color:#94a3b8;
                        ">
                            so với kỳ trước
                        </span>
                    </div>

                </div>

                <!-- ARROW -->

                <div style="
                    color:#cbd5e1;
                    font-size:16px;
                ">
                    ❯
                </div>

            </div>
            `;

        }).join('');

        listEl.innerHTML =
            rows ||
            `
            <div style="
                text-align:center;
                padding:30px;
                color:#94a3b8;
            ">
                Không có dữ liệu
            </div>
            `;

        document.getElementById(
            'rev-total-val'
        ).innerText =
            grandTotal.toLocaleString() + "đ";

        document.getElementById(
            'rev-total-orders'
        ).innerText =
            totalOrdersCount;

        if (
            typeof veBieuDoDoanhThu === "function"
        ) {

            veBieuDoDoanhThu(sortedData);
        }

    });
}
function veBieuDoDoanhThu(sortedData) {
    const ctx = document.getElementById('revenuePieChart').getContext('2d');
    if (window.revenueChartInstance) window.revenueChartInstance.destroy();

    // 1. Chỉ lấy Top 5 bàn đầu, phần còn lại gom vào "Khác"
    let displayData = sortedData.slice(0, 5);
    let totalOther = sortedData.slice(5).reduce((sum, item) => sum + item.total, 0);
    if (totalOther > 0) displayData.push({ name: "Khác", total: totalOther });

    const grandTotal = sortedData.reduce((sum, item) => sum + item.total, 0);
    const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#a855f7', '#ec4899', '#94a3b8'];

    // 2. Vẽ số ở giữa (Viết tắt triệu M hoặc nghìn K)
    const shortVal = grandTotal >= 1000000 ? (grandTotal/1000000).toFixed(1) + "M" : (grandTotal/1000).toFixed(0) + "K";
    document.getElementById('chart-center-val').innerText = shortVal;

    // 3. Khởi tạo Biểu đồ Doughnut
    window.revenueChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: displayData.map(d => d.name),
            datasets: [{
                data: displayData.map(d => d.total),
                backgroundColor: colors,
                borderWidth: 0,
                cutout: '75%'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } } // Ẩn legend mặc định để tự vẽ
        }
    });

    // 4. Vẽ danh sách chú thích bên phải
    document.getElementById('chart-legend-list').innerHTML = displayData.map((d, i) => {
        const percent = grandTotal > 0 ? ((d.total / grandTotal) * 100).toFixed(1) : 0;
        return `
        <div style="display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 8px;">
                <div style="width: 8px; height: 8px; border-radius: 50%; background: ${colors[i]};"></div>
                <div style="font-size: 12px; font-weight: 700; color: #1e293b;">${d.name}</div>
            </div>
            <div style="display: flex; gap: 10px; align-items: center;">
                <div style="font-size: 11px; color: #64748b;">${percent}%</div>
            </div>
        </div>`;
    }).join('');

    // 5. Cập nhật thanh tóm tắt Insight
    if (displayData.length > 0) {
        const top = displayData[0];
        const p = ((top.total / grandTotal) * 100).toFixed(1);
        document.getElementById('chart-summary-text').innerHTML = 
            `<b>${top.name}</b> đang chiếm <span style="color:#22c55e">${p}%</span> tổng doanh thu`;
    }
}


/*Hàm tính toán thời gian đối xứng của rank bàn*/
function getComparePeriod(timeFilter, startVal, endVal) {
    const now = new Date();
    const startOfToday = new Date(now.setHours(0,0,0,0)).getTime();
    const dayMs = 24 * 60 * 60 * 1000;

    let currentRange = { start: 0, end: Date.now() };
    let previousRange = { start: 0, end: 0 };

    if (timeFilter === 'today') {
        currentRange = { start: startOfToday, end: Date.now() };
        previousRange = { start: startOfToday - dayMs, end: startOfToday };
    } 
    else if (timeFilter === 'yesterday') {
        currentRange = { start: startOfToday - dayMs, end: startOfToday };
        previousRange = { start: startOfToday - (dayMs * 2), end: startOfToday - dayMs };
    }
    else if (timeFilter === 'custom' && startVal && endVal) {
        const s = new Date(startVal).getTime();
        const e = new Date(endVal).getTime() + dayMs;
        const duration = e - s;
        currentRange = { start: s, end: e };
        previousRange = { start: s - duration, end: s };
    }
    // Sếp có thể thêm 'thisMonth' tương tự
    return { currentRange, previousRange };
}

























// ---- (Phần JS thứ 2, tách từ vị trí gốc trong HTML) ----

document.addEventListener('click', function (e) {
    const sheet = document.getElementById('order-column');
    if (!sheet || window.innerWidth > 768) return;

    const isTriggerClick = e.target.closest('#order-trigger');
    const isInsideSheet = sheet.contains(e.target);
    const isTableCard = e.target.closest('.table-card');
    
    // THÊM DÒNG NÀY: Kiểm tra xem có bấm vào nút Xóa món không
    // (Giả sử nút xóa của bạn có emoji ❌ hoặc class chứa chữ 'x' hoặc 'delete')
    const isDeleteBtn = e.target.innerText === 'X' || e.target.innerText === '❌' || e.target.closest('.delete-btn');

    if (isTriggerClick) {
        sheet.classList.toggle('mo-ra');
    } 
    else if (isTableCard) {
        sheet.classList.add('mo-ra');
    }
    // Nếu bấm vào nút Xóa món bên trong sheet, ta KHÔNG làm gì cả (để nó giữ nguyên trạng thái mở)
    else if (isDeleteBtn) {
        return; 
    }
    else if (!isInsideSheet) {
        sheet.classList.remove('mo-ra');
    }
});
// Hàm di chuyển layout thoát khỏi wrapper để fixed chạy chuẩn
function fixOrderLayout() {
    const col = document.getElementById('order-column');
    if (window.innerWidth <= 1024 && col && col.parentElement && col.parentElement.classList.contains('main-wrapper')) {
        document.body.appendChild(col);
    }
}
window.addEventListener('load', fixOrderLayout);
window.addEventListener('resize', fixOrderLayout);


function toggleFab(event) {
    if(event) event.stopPropagation();
    const wrapper = document.getElementById('fabWrapper');
    const icon = document.getElementById('fab-icon');
    
    wrapper.classList.toggle('active');
    icon.innerText = wrapper.classList.contains('active') ? '✖' : '➕';
}

function handleFabClick(callback) {
    if (typeof callback === 'function') callback();
    // Đóng menu sau khi chọn chức năng
    const wrapper = document.getElementById('fabWrapper');
    wrapper.classList.remove('active');
    document.getElementById('fab-icon').innerText = '➕';
}

// Đóng menu khi bấm ra ngoài vùng cụm nút
document.addEventListener('click', function(e) {
    const wrapper = document.getElementById('fabWrapper');
    if (wrapper && !wrapper.contains(e.target)) {
        wrapper.classList.remove('active');
        document.getElementById('fab-icon').innerText = '➕';
    }
});


