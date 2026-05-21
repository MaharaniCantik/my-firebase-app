import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// FIREBASE CONFIGURATION
const firebaseConfig = {
  apiKey: "AIzaSyArMXfOKApC1WznjYcqBWQi_X2w7cgzszI",
  authDomain: "mendoannasipecel25.firebaseapp.com",
  projectId: "mendoannasipecel25",
  storageBucket: "mendoannasipecel25.firebasestorage.app",
  messagingSenderId: "671433678552",
  appId: "1:671433678552:web:e24c26056a32ff4569c1ad",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// STATE MANAGEMENT
let currentUser = null;
let userRole = null;
let menusData = [];
let ordersData = [];
let cart = [];

// DOM Elements
const elLoader = document.getElementById("global-loader");
const viewLogin = document.getElementById("view-login");
const viewAdmin = document.getElementById("view-admin");
const viewCustomer = document.getElementById("view-customer");
const navUserInfo = document.getElementById("nav-user-info");
const navUserGreeting = document.getElementById("user-greeting");
const navUserBadge = document.getElementById("user-badge");
const menuForm = document.getElementById("menu-form");

// UTILS
const formatRp = (num) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(num);
const showLoader = (show) => elLoader.classList.toggle("hidden", !show);

const showToast = (msg, isError = false) => {
  const toast = document.getElementById("toast");
  document.getElementById("toast-msg").textContent = msg;
  toast.className = `fixed bottom-4 right-4 px-4 py-2 rounded-lg shadow-lg transform transition-transform duration-300 z-50 text-white ${isError ? "bg-red-500" : "bg-emerald-600"}`;
  toast.classList.remove("translate-y-20", "opacity-0");
  setTimeout(() => toast.classList.add("translate-y-20", "opacity-0"), 3000);
};

const switchView = (viewId) => {
  [viewLogin, viewAdmin, viewCustomer].forEach((el) => el.classList.add("hidden"));
  document.getElementById(viewId).classList.remove("hidden");
};

// AUTH LOGIC
const checkAndSaveUserRole = async (user, defaultRole) => {
  try {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email.split("@")[0],
        role: defaultRole,
        createdAt: serverTimestamp(),
      });
      userRole = defaultRole;
    } else {
      userRole = userSnap.data().role;
    }

    navUserInfo.classList.remove("hidden");
    navUserGreeting.textContent = `Halo, ${user.displayName || user.email.split("@")[0]}`;
    navUserBadge.textContent = userRole;
    navUserBadge.className = `px-2 py-1 rounded-full text-xs font-bold uppercase ${userRole === "admin" ? "bg-orange-500 text-white" : "bg-emerald-200 text-emerald-800"}`;

    if (userRole === "admin") {
      switchView("view-admin");
      initAdminData();
    } else {
      switchView("view-customer");
      initCustomerData();
    }
  } catch (error) {
    console.error("Error checking role:", error);
    showToast("Gagal memuat profil pengguna", true);
    signOut(auth);
  }
};

onAuthStateChanged(auth, (user) => {
  showLoader(true);
  if (user) {
    currentUser = user;
    const isEmailAuth = user.providerData.some((p) => p.providerId === "password");
    checkAndSaveUserRole(user, isEmailAuth ? "admin" : "customer").finally(() => showLoader(false));
  } else {
    currentUser = null;
    userRole = null;
    navUserInfo.classList.add("hidden");
    switchView("view-login");
    showLoader(false);
  }
});

// AUTH LISTENERS
document.getElementById("admin-login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("admin-email").value;
  const password = document.getElementById("admin-password").value;
  showLoader(true);
  try {
    await signInWithEmailAndPassword(auth, email, password);
    showToast("Login Admin Berhasil");
  } catch (error) {
    showToast("Login Gagal: " + error.message, true);
    showLoader(false);
  }
});

document.getElementById("btn-register-admin").addEventListener("click", async () => {
  const email = document.getElementById("admin-email").value;
  const password = document.getElementById("admin-password").value;
  if (!email || !password) return showToast("Isi email dan password untuk mendaftar", true);
  showLoader(true);
  try {
    await createUserWithEmailAndPassword(auth, email, password);
    showToast("Pendaftaran Admin Berhasil");
  } catch (error) {
    showToast("Daftar Gagal: " + error.message, true);
    showLoader(false);
  }
});

document.getElementById("btn-google-login").addEventListener("click", async () => {
  showLoader(true);
  try {
    await signInWithPopup(auth, googleProvider);
    showToast("Login Berhasil");
  } catch (error) {
    showToast("Login Google Gagal: " + error.message, true);
    showLoader(false);
  }
});

document.getElementById("btn-logout").addEventListener("click", () => {
  signOut(auth);
  cart = [];
  updateCartUI();
});

// REALTIME FIRESTORE LISTENERS
let unsubMenus = null;
let unsubOrders = null;

function listenMenus(callback) {
  if (unsubMenus) unsubMenus();
  unsubMenus = onSnapshot(
    collection(db, "menus"),
    (snapshot) => {
      menusData = [];
      snapshot.forEach((doc) => menusData.push({ id: doc.id, ...doc.data() }));
      callback();
    },
    (error) => console.error("Menu Listener Error", error),
  );
}

function listenOrders(callback) {
  if (unsubOrders) unsubOrders();
  unsubOrders = onSnapshot(
    collection(db, "orders"),
    (snapshot) => {
      ordersData = [];
      snapshot.forEach((doc) => ordersData.push({ id: doc.id, ...doc.data() }));
      ordersData.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      callback();
    },
    (error) => console.error("Order Listener Error", error),
  );
}

// ADMIN DASHBOARD MANAGEMENT
function initAdminData() {
  listenMenus(renderAdminMenus);
  listenOrders(renderAdminOrders);
}

document.getElementById("btn-toggle-menu-form").addEventListener("click", () => {
  menuForm.classList.toggle("hidden");
  menuForm.reset();
  document.getElementById("menu-id").value = "";
});

document.getElementById("btn-cancel-menu").addEventListener("click", () => {
  menuForm.classList.add("hidden");
});

menuForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("menu-id").value;
  const data = {
    name: document.getElementById("menu-name").value,
    price: parseFloat(document.getElementById("menu-price").value),
    desc: document.getElementById("menu-desc").value,
    img: document.getElementById("menu-img").value || "https://via.placeholder.com/150?text=Makanan",
  };

  try {
    showLoader(true);
    if (id) {
      await updateDoc(doc(db, "menus", id), data);
      showToast("Menu diperbarui");
    } else {
      await addDoc(collection(db, "menus"), data);
      showToast("Menu ditambahkan");
    }
    menuForm.reset();
    menuForm.classList.add("hidden");
  } catch (error) {
    showToast("Gagal menyimpan menu", true);
  } finally {
    showLoader(false);
  }
});

// MENDAFTARKAN CRITICAL FUNCTIONS KE GLOBAL WINDOW OBJECT
window.editMenu = (id) => {
  const m = menusData.find((x) => x.id === id);
  if (m) {
    document.getElementById("menu-id").value = m.id;
    document.getElementById("menu-name").value = m.name;
    document.getElementById("menu-price").value = m.price;
    document.getElementById("menu-desc").value = m.desc || "";
    document.getElementById("menu-img").value = m.img || "";
    menuForm.classList.remove("hidden");
  }
};

window.deleteMenu = async (id) => {
  if (confirm("Hapus menu ini?")) {
    try {
      await deleteDoc(doc(db, "menus", id));
      showToast("Menu dihapus");
    } catch (e) {
      showToast("Gagal menghapus", true);
    }
  }
};

window.updateOrderStatus = async (id, status) => {
  try {
    await updateDoc(doc(db, "orders", id), { status });
    showToast(`Status pesanan diubah ke ${status}`);
  } catch (e) {
    showToast("Gagal mengubah status", true);
  }
};

function renderAdminMenus() {
  const tbody = document.getElementById("admin-menu-list");
  tbody.innerHTML = "";
  menusData.forEach((m) => {
    tbody.innerHTML += `
            <tr>
                <td class="px-6 py-4">
                    <div class="flex items-center">
                        <img class="h-10 w-10 rounded-full object-cover mr-3" src="${m.img}" alt="${m.name}" onerror="this.src='https://via.placeholder.com/150'">
                        <div>
                            <div class="text-sm font-medium text-gray-900">${m.name}</div>
                            <div class="text-sm text-gray-500">${m.desc || "-"}</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 text-sm text-gray-500">${formatRp(m.price)}</td>
                <td class="px-6 py-4 text-right text-sm font-medium">
                    <button onclick="editMenu('${m.id}')" class="text-emerald-600 hover:text-emerald-900 mr-3">Edit</button>
                    <button onclick="deleteMenu('${m.id}')" class="text-red-600 hover:text-red-900">Hapus</button>
                </td>
            </tr>`;
  });
}

function renderAdminOrders() {
  const tbody = document.getElementById("admin-order-list");
  tbody.innerHTML = "";
  if (ordersData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-gray-400 italic">Belum ada pesanan</td></tr>';
    return;
  }
  ordersData.forEach((o) => {
    const date = o.createdAt?.seconds ? new Date(o.createdAt.seconds * 1000).toLocaleString("id-ID") : "Pending";
    const itemsStr = o.items.map((i) => `${i.name} (${i.qty}x)`).join(", ");
    tbody.innerHTML += `
            <tr>
                <td class="px-4 py-3 text-xs text-gray-500">ID: ${o.id.substring(0, 5)}...<br>${date}</td>
                <td class="px-4 py-3 text-sm">${o.customerName}<br><span class="text-xs text-gray-400">${o.customerEmail}</span></td>
                <td class="px-4 py-3 text-sm">${itemsStr}</td>
                <td class="px-4 py-3 text-sm font-semibold">${formatRp(o.total)}<br><span class="text-xs font-normal uppercase text-gray-500">${o.payment}</span></td>
                <td class="px-4 py-3 text-sm"><span class="px-2 py-0.5 rounded text-xs font-bold ${o.status === "Selesai" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}">${o.status}</span></td>
                <td class="px-4 py-3 text-right text-xs">
                    <button onclick="updateOrderStatus('${o.id}', 'Selesai')" class="text-emerald-600 hover:underline mr-2">Selesai</button>
                    <button onclick="updateOrderStatus('${o.id}', 'Diproses')" class="text-orange-600 hover:underline">Proses</button>
                </td>
            </tr>`;
  });
}

// CUSTOMER MANAGEMENT
function initCustomerData() {
  listenMenus(renderCustomerMenus);
  listenOrders(renderCustomerOrders);
}

function renderCustomerMenus() {
  const grid = document.getElementById("customer-menu-grid");
  grid.innerHTML = "";
  menusData.forEach((m) => {
    grid.innerHTML += `
            <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex gap-4">
                <img class="w-24 h-24 rounded-lg object-cover bg-gray-100" src="${m.img}" onerror="this.src='https://via.placeholder.com/150'">
                <div class="flex-grow flex flex-col justify-between">
                    <div>
                        <h3 class="font-bold text-gray-800">${m.name}</h3>
                        <p class="text-xs text-gray-500 line-clamp-2 mt-1">${m.desc || "-"}</p>
                    </div>
                    <div class="flex justify-between items-center mt-2">
                        <span class="font-bold text-emerald-600">${formatRp(m.price)}</span>
                        <button onclick="addToCart('${m.id}')" class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 py-1.5 rounded transition font-medium">+ Tambah</button>
                    </div>
                </div>
            </div>`;
  });
}

window.addToCart = (id) => {
  const menu = menusData.find((x) => x.id === id);
  if (!menu) return;
  const exist = cart.find((x) => x.id === id);
  if (exist) {
    exist.qty++;
  } else {
    cart.push({ id: menu.id, name: menu.name, price: menu.price, qty: 1 });
  }
  updateCartUI();
};

window.changeQty = (id, delta) => {
  const item = cart.find((x) => x.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter((x) => x.id !== id);
  updateCartUI();
};

function updateCartUI() {
  const container = document.getElementById("cart-items");
  const totalEl = document.getElementById("cart-total");
  if (cart.length === 0) {
    container.innerHTML = '<p class="text-gray-400 text-sm italic">Belum ada pesanan.</p>';
    totalEl.textContent = "Rp 0";
    return;
  }
  container.innerHTML = "";
  let total = 0;
  cart.forEach((item) => {
    total += item.price * item.qty;
    container.innerHTML += `
            <div class="flex justify-between items-center text-sm border-b pb-2">
                <div>
                    <p class="font-medium text-gray-800">${item.name}</p>
                    <p class="text-xs text-gray-500">${formatRp(item.price)}</p>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="changeQty('${item.id}', -1)" class="w-6 h-6 bg-gray-200 text-gray-700 rounded-full flex items-center justify-center font-bold hover:bg-gray-300">-</button>
                    <span class="font-semibold w-4 text-center">${item.qty}</span>
                    <button onclick="changeQty('${item.id}', 1)" class="w-6 h-6 bg-gray-200 text-gray-700 rounded-full flex items-center justify-center font-bold hover:bg-gray-300">+</button>
                </div>
            </div>`;
  });
  totalEl.textContent = formatRp(total);
}

document.getElementById("payment-method").addEventListener("change", (e) => {
  document.getElementById("qris-container").classList.toggle("hidden", e.target.value !== "qris");
});

document.getElementById("checkout-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (cart.length === 0) return showToast("Keranjang belanja kosong", true);

  const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  const dataOrder = {
    customerId: currentUser.uid,
    customerName: currentUser.displayName || currentUser.email.split("@")[0],
    customerEmail: currentUser.email,
    items: cart,
    total: total,
    payment: document.getElementById("payment-method").value,
    status: "Diproses",
    createdAt: serverTimestamp(),
  };

  try {
    showLoader(true);
    await addDoc(collection(db, "orders"), dataOrder);
    showToast("Pesanan berhasil dibuat!");
    cart = [];
    updateCartUI();
  } catch (err) {
    showToast("Gagal membuat pesanan", true);
  } finally {
    showLoader(false);
  }
});

function renderCustomerOrders() {
  const container = document.getElementById("customer-order-history");
  container.innerHTML = "";

  // Filter pesanan milik user yang sedang login
  const myOrders = ordersData.filter((o) => o.customerId === currentUser.uid);

  if (myOrders.length === 0) {
    container.innerHTML = '<p class="text-xs text-gray-400 italic">Belum ada riwayat pesanan</p>';
    return;
  }

  myOrders.forEach((o) => {
    const itemsStr = o.items.map((i) => `${i.name} (${i.qty}x)`).join(", ");
    // Warna badge penanda status
    const statusClass = o.status === "Selesai" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800";

    container.innerHTML += `
            <div class="p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs mb-2">
                <div class="flex justify-between font-bold text-gray-700">
                    <span>ID: ${o.id.substring(0, 6)}...</span>
                    <span class="px-1.5 py-0.5 rounded text-[10px] ${statusClass}">${o.status}</span>
                </div>
                <p class="text-gray-600 mt-1">${itemsStr}</p>
                <p class="font-semibold text-emerald-700 mt-1">Total: ${formatRp(o.total)}</p>
            </div>`;
  });
}
