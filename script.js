// MediFlow POS - Core Logic

// --- Constants & State ---
let products = JSON.parse(localStorage.getItem('mediflow_products')) || [];
if (products.length === 0) {
    products = [
        { id: 'P01', name: 'Paracetamol 500mg', category: 'Tablet', hsn: '3004', batch: 'BN1024', expiry: '2026-12-31', mrp: 40.00, salePrice: 35.00, stock: 150, gst: 12 },
        { id: 'P02', name: 'Amoxicillin 250mg', category: 'Capsule', hsn: '3004', batch: 'BN2025', expiry: '2026-06-15', mrp: 120.00, salePrice: 110.00, stock: 8, gst: 12 },
        { id: 'P03', name: 'Benadryl Cough Syrup', category: 'Syrup', hsn: '3004', batch: 'BN3026', expiry: '2026-09-20', mrp: 105.00, salePrice: 95.00, stock: 45, gst: 5 }
    ];
    localStorage.setItem('mediflow_products', JSON.stringify(products));
}
let sales = JSON.parse(localStorage.getItem('mediflow_sales')) || [];
let settings = JSON.parse(localStorage.getItem('mediflow_settings')) || {
    shopName: 'MediFlow Pharma',
    shopAddress: '123 Medical Street, City Center',
    shopPhone: '+91 9876543210',
    shopLogo: '',
    printerType: '3inch',
    gstDefault: true,
    currency: '₹'
};
let purchases = JSON.parse(localStorage.getItem('mediflow_purchases')) || [];
let expenses = JSON.parse(localStorage.getItem('mediflow_expenses')) || [];
let categories = JSON.parse(localStorage.getItem('mediflow_categories')) || ['Tablet', 'Syrup', 'Injection', 'Capsule', 'Ointment', 'Other'];
let customers = JSON.parse(localStorage.getItem('mediflow_customers')) || [];
let customerPayments = JSON.parse(localStorage.getItem('mediflow_customer_payments')) || [];
let suppliers = JSON.parse(localStorage.getItem('mediflow_suppliers')) || [];
let supplierPayments = JSON.parse(localStorage.getItem('mediflow_supplier_payments')) || [];
let admins = JSON.parse(localStorage.getItem('mediflow_admins')) || [];
let cart = [];
let heldCarts = JSON.parse(localStorage.getItem('mediflow_held_carts')) || [];
let currentUser = sessionStorage.getItem('mediflow_user') || null;
let currentTheme = localStorage.getItem('mediflow_theme') || 'light';

// --- Firebase Config (User to fill this) ---
const firebaseConfig = {
    apiKey: "AIzaSyDHWpCbtbs2G3_Gtm0-XKI2bxLoBG5TIDY",
    authDomain: "dical-billing-001.firebaseapp.com",
    databaseURL: "https://dical-billing-001-default-rtdb.firebaseio.com",
    projectId: "dical-billing-001",
    storageBucket: "dical-billing-001.firebasestorage.app",
    messagingSenderId: "1022770660641",
    appId: "1:1022770660641:web:8a56086be5fb5b2867aa60",
    measurementId: "G-QFJCKQYP9P"
};

let db = null;
let isFirebaseEnabled = false;

function initFirebase() {
    try {
        if (typeof firebase !== 'undefined' && firebaseConfig.apiKey && firebaseConfig.apiKey !== "REPLACE_WITH_YOUR_KEY") {
            firebase.initializeApp(firebaseConfig);
            db = firebase.firestore();
            isFirebaseEnabled = true;
            console.log("MediFlow Cloud Connected");
            syncFromCloud();
        }
    } catch (e) {
        console.error("Cloud Connection Error:", e);
    }
}

async function syncToCloud(collectionName, documentData) {
    if (!isFirebaseEnabled || !db) return;
    try {
        let docName = collectionName;
        // Fix naming convention to match screenshot database
        if (collectionName === 'customerPayments') docName = 'customer_payments';
        
        await db.collection('mediflow_data').doc(docName).set({
            payload: documentData.data !== undefined ? documentData.data : documentData,
            updatedAt: new Date().toISOString()
        });
    } catch (e) {
        console.error('Error syncing to cloud:', e);
    }
}

let isSyncingFromCloud = false;

async function syncFromCloud() {
    if (!isFirebaseEnabled || !db) return;
    try {
        isSyncingFromCloud = true;
        const collections = ['products', 'sales', 'settings', 'purchases', 'expenses', 'customers', 'suppliers', 'admins', 'supplierPayments', 'customerPayments'];
        
        let hasUpdates = false;
        for (const col of collections) {
            let docName = col;
            if (col === 'customerPayments') docName = 'customer_payments';

            const doc = await db.collection('mediflow_data').doc(docName).get();
            if (doc.exists) {
                const cloudData = doc.data().payload;
                if (!cloudData) continue;

                if (col === 'settings') {
                    settings = cloudData;
                    localStorage.setItem('mediflow_settings', JSON.stringify(settings));
                } else {
                    const arrayData = cloudData || [];
                    if (arrayData.length > 0) {
                        window[col] = arrayData;
                        // Special names for localStorage
                        let localKey = 'mediflow_' + (col === 'supplierPayments' ? 'supplier_payments' : (col === 'customerPayments' ? 'customer_payments' : col));
                        localStorage.setItem(localKey, JSON.stringify(arrayData));
                    }
                }
                hasUpdates = true;
            }
        }
        
        if (hasUpdates) {
            console.log("Cloud sync complete: App re-initialized with remote data.");
            initApp();
        }
    } catch (e) {
        console.error('Error syncing from cloud:', e);
    } finally {
        isSyncingFromCloud = false;
    }
}

async function backupAllToCloud() {
    if (!isFirebaseEnabled || !db) {
        alert('Cloud backup is not connected.');
        return;
    }
    try {
        const btn = document.getElementById('cloud-backup-btn');
        if (btn) btn.innerHTML = 'Backing up...';
        await syncToCloud('products', { data: products });
        await syncToCloud('sales', { data: sales });
        await syncToCloud('settings', settings);
        await syncToCloud('purchases', { data: purchases });
        await syncToCloud('expenses', { data: expenses });
        await syncToCloud('customers', { data: customers });
        await syncToCloud('suppliers', { data: suppliers });
        await syncToCloud('admins', { data: admins });
        alert('All local data successfully backed up to Firebase!');
        if (btn) btn.innerHTML = '<i data-lucide="cloud-upload"></i> BACKUP TO CLOUD';
        if (typeof lucide !== 'undefined') lucide.createIcons();
    } catch (e) {
         alert('Backup failed: ' + e.message);
         console.error(e);
    }
}

let activeSection = 'dashboard';
let currentPayMode = 'Cash';

// --- Auto-Backup Interceptor ---
const originalSetItem = localStorage.setItem;
localStorage.setItem = function(key, value) {
    originalSetItem.apply(this, arguments);

    // Only auto-backup if we aren't currently pulling down from Firebase
    if (!isSyncingFromCloud && isFirebaseEnabled && db) {
        const keyMap = {
            'mediflow_products': 'products',
            'mediflow_sales': 'sales',
            'mediflow_settings': 'settings',
            'mediflow_purchases': 'purchases',
            'mediflow_expenses': 'expenses',
            'mediflow_customers': 'customers',
            'mediflow_suppliers': 'suppliers',
            'mediflow_admins': 'admins',
            'mediflow_supplier_payments': 'supplierPayments',
            'mediflow_customer_payments': 'customerPayments'
        };

        if (keyMap[key]) {
             try {
                 const payload = (key === 'mediflow_settings') ? JSON.parse(value) : { data: JSON.parse(value) };
                 syncToCloud(keyMap[key], payload);
             } catch(e) {
                 console.error("Auto-backup parse error for " + key, e);
             }
        }
    }
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initFirebase();
    lucide.createIcons();
    checkLoginStatus();
    setupLoginHandler();
    // initApp is called inside checkLoginStatus
    setupEventListeners();
});

function checkLoginStatus() {
    const isLoggedIn = sessionStorage.getItem('mediflow_logged_in');
    const loginScreen = document.getElementById('login-screen');
    const appContainer = document.getElementById('app-container');
    const userRole = sessionStorage.getItem('mediflow_user');

    if (isLoggedIn === 'true') {
        const loggedInUsername = sessionStorage.getItem('mediflow_user');
        let actualRole = 'staff'; 
        if (loggedInUsername === 'VIKI') {
            actualRole = 'superadmin';
        } else {
            const foundUser = admins.find(a => a.username === loggedInUsername);
            if (foundUser) actualRole = foundUser.role;
        }

        const isStaff = (actualRole === 'staff');

        if (loginScreen) loginScreen.style.display = 'none';
        if (appContainer) appContainer.classList.add('active-app');

        // Hide sensitive nav items if user is just Staff
        const hideForStaff = ['dashboard', 'products', 'purchase', 'customers', 'suppliers', 'sales', 'settings'];
        hideForStaff.forEach(secName => {
            const navLink = document.querySelector(`.nav-item[data-section="${secName}"]`);
            if (navLink) navLink.style.display = isStaff ? 'none' : 'flex';
        });
        
        // Strictly limit Staff Administration visibility to Super Admin only
        const navUsers = document.getElementById('nav-users');
        if (navUsers) {
            navUsers.style.display = (actualRole === 'superadmin') ? 'flex' : 'none';
        }
        
        // Ensure create button is strictly visible only to VIKI
        const createUserBtn = document.getElementById('create-user-btn');
        if (createUserBtn) {
            createUserBtn.style.display = (actualRole === 'superadmin') ? 'inline-flex' : 'none';
        }

        initApp();
        renderAdmins();

        // Redirect to Billing if default section is Dashboard for staff
        if (isStaff && activeSection === 'dashboard') {
            switchSection('billing');
        } else {
            switchSection(activeSection);
        }
    } else {
        if (loginScreen) loginScreen.style.display = 'flex';
        if (appContainer) appContainer.classList.remove('active-app');
    }
}

function setupLoginHandler() {
    const form = document.getElementById('login-form');
    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const user = document.getElementById('login-username').value;
        const pass = document.getElementById('login-password').value;
        const error = document.getElementById('login-error');

        // Check Super Admin
        if (user === 'VIKI' && pass === 'VIKI1101') {
            sessionStorage.setItem('mediflow_logged_in', 'true');
            sessionStorage.setItem('mediflow_user', 'VIKI');
            checkLoginStatus();
            return;
        }

        // Check Other Admins
        const found = admins.find(a => a.username === user && a.password === pass);
        if (found) {
            sessionStorage.setItem('mediflow_logged_in', 'true');
            sessionStorage.setItem('mediflow_user', user);
            checkLoginStatus();
        } else {
            error.style.display = 'block';
            setTimeout(() => { error.style.display = 'none'; }, 3000);
        }
    });
}

function initApp() {
    try {
        // Data Migration: Ensure all sales have grandTotal (fix for legacy 'total' field)
        sales.forEach(s => {
            if (s.total !== undefined && s.grandTotal === undefined) {
                s.grandTotal = s.total;
            }
        });

        // Set theme
        document.body.setAttribute('data-theme', currentTheme);
        updateThemeIcon();

        // Set current date
        const now = new Date();
        const dateEl = document.getElementById('current-date');
        if (dateEl) dateEl.textContent = now.toDateString();

        // Generate first invoice number if in billing
        generateInvoiceNumber();

        // Initial renders with element safety
        renderDashboard();
        renderProducts();
        renderSalesHistory();
        renderPurchases();
        renderExpenses();
        renderCategoryManagement();
        renderCustomers();
        renderSuppliers();
        renderCartTabs();
        loadSettings();
        
        lucide.createIcons();
    } catch (error) {
        console.error('App initialization error:', error);
    }
}

function loadSettings() {
    try {
        const fields = {
            'set-shop-name': settings.shopName,
            'set-shop-address': settings.shopAddress,
            'set-shop-phone': settings.shopPhone,
            'set-shop-logo': settings.shopLogo,
            'set-printer-type': settings.printerType,
            'set-currency': settings.currency
        };
        
        for (const [id, val] of Object.entries(fields)) {
            const el = document.getElementById(id);
            if (el) el.value = val || '';
        }

        const gstEl = document.getElementById('set-gst-default');
        if (gstEl) gstEl.checked = !!settings.gstDefault;

        // Apply currency to UI
        document.querySelectorAll('.currency-symbol').forEach(el => el.textContent = settings.currency || '₹');
        
        // WhatsApp Float
        const waBtn = document.getElementById('whatsapp-float');
        if (waBtn) {
            const shopNameStr = settings.shopName ? settings.shopName : 'your system';
            const message = encodeURIComponent(`Hello, I am contacting you regarding ${shopNameStr}.`);
            waBtn.href = `https://wa.me/919360039283?text=${message}`;
        }
    } catch (e) {
        console.error('Error loading settings:', e);
    }
}

// --- Navigation ---
function switchSection(sectionId) {
    // Update UI
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');

    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.querySelector(`[data-section="${sectionId}"]`).classList.add('active');

    // Update Title
    const titles = {
        'dashboard': 'Dashboard',
        'billing': 'Billing Terminal',
        'products': 'Product Management',
        'purchase': 'Purchase & Stock In',
        'expenses': 'Expense Management',
        'customers': 'Customer Management',
        'suppliers': 'Supplier Management',
        'sales': 'Sales History',
        'settings': 'Application Settings'
    };
    document.getElementById('section-title').textContent = titles[sectionId];
    activeSection = sectionId;

    // Specific actions
    if (sectionId === 'dashboard') renderDashboard();
    if (sectionId === 'customers') renderCustomers();
    if (sectionId === 'suppliers') renderSuppliers();
    if (sectionId === 'purchase') {
        renderProductDropdown();
        renderSupplierDropdown();
        renderPurchases();
    }
    if (sectionId === 'expenses') renderExpenses();
    if (sectionId === 'billing') {
        document.getElementById('billing-search').focus();
        generateInvoiceNumber();
        // Set GST default from settings
        document.getElementById('gst-toggle').checked = settings.gstDefault;
    }
}

// --- Event Listeners ---
function setupEventListeners() {
    // Sidebar Navigation
    document.querySelectorAll('.nav-item[data-section]').forEach(item => {
        item.addEventListener('click', () => switchSection(item.dataset.section));
    });

    // Theme Toggle
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

    // Product Modal
    document.getElementById('open-add-product').addEventListener('click', () => openProductModal());
    document.getElementById('close-product-modal').addEventListener('click', closeProductModal);
    document.getElementById('cancel-product').addEventListener('click', closeProductModal);
    document.getElementById('product-form').addEventListener('submit', handleProductSubmit);

    // Billing Logic
    const billingSearch = document.getElementById('billing-search');
    billingSearch.addEventListener('input', handleBillingSearch);
    
    document.getElementById('clear-cart-btn').addEventListener('click', clearCart);
    document.getElementById('gst-toggle').addEventListener('change', updateCartTotals);
    document.getElementById('discount-input').addEventListener('input', updateCartTotals);
    document.getElementById('discount-type').addEventListener('change', updateCartTotals);

    // Customer Auto-suggest
    document.getElementById('customer-name').addEventListener('input', handleCustomerSuggest);
    document.getElementById('customer-list-search').addEventListener('input', renderCustomers);

    document.getElementById('sale-date-from').addEventListener('change', renderSalesHistory);
    document.getElementById('sale-date-to').addEventListener('change', renderSalesHistory);

    document.getElementById('customer-form').addEventListener('submit', handleCustomerSubmit);
    document.getElementById('supplier-form').addEventListener('submit', handleSupplierSubmit);
    document.getElementById('supplier-list-search').addEventListener('input', renderSuppliers);
    document.getElementById('supplier-payment-form').addEventListener('submit', handleSupplierPaymentSubmit);
    document.getElementById('payment-form').addEventListener('submit', handlePaymentSubmit);

    document.getElementById('save-bill-btn').addEventListener('click', () => processSale(false));
    document.getElementById('generate-bill-btn').addEventListener('click', () => processSale(true));
    document.getElementById('whatsapp-bill-btn').addEventListener('click', () => processSale(false, true));

    // Settings Form
    document.getElementById('settings-form').addEventListener('submit', (e) => {
        e.preventDefault();
        settings = {
            shopName: document.getElementById('set-shop-name').value,
            shopAddress: document.getElementById('set-shop-address').value,
            shopPhone: document.getElementById('set-shop-phone').value,
            shopLogo: document.getElementById('set-shop-logo').value,
            printerType: document.getElementById('set-printer-type').value,
            gstDefault: document.getElementById('set-gst-default').checked,
            currency: document.getElementById('set-currency').value
        };
        localStorage.setItem('mediflow_settings', JSON.stringify(settings));
        alert('Settings saved successfully!');
        initApp(); // Refresh to apply changes
    });

    // Purchase Form
    document.getElementById('purchase-form').addEventListener('submit', handlePurchaseSubmit);
    
    // Expense Form
    document.getElementById('expense-form').addEventListener('submit', handleExpenseSubmit);

    // Admin Form
    document.getElementById('admin-form').addEventListener('submit', handleAdminSubmit);

    // Logout
    document.getElementById('logout-btn').addEventListener('click', () => {
        if (confirm('Are you sure you want to logout?')) {
            sessionStorage.removeItem('mediflow_logged_in');
            sessionStorage.removeItem('mediflow_user');
            checkLoginStatus();
        }
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
        if (e.key === 'F2') switchSection('billing');
        if (e.key === 'F4') switchSection('products');
        
        if (activeSection === 'billing') {
            if (e.ctrlKey && e.key === 'Enter') processSale(true);
            if (e.key === 'Escape') {
                document.getElementById('search-results').style.display = 'none';
                const billingSearch = document.getElementById('billing-search');
                if (billingSearch) billingSearch.blur();
            }
        }
    });

    // Sales History Export
    const exportSalesBtn = document.getElementById('export-sales');
    if (exportSalesBtn) exportSalesBtn.addEventListener('click', exportData);
    // Export/Import Data
    const exportDataBtn = document.getElementById('export-data-btn');
    if (exportDataBtn) exportDataBtn.addEventListener('click', exportData);

    const importDataBtn = document.getElementById('import-data-btn');
    if (importDataBtn) importDataBtn.addEventListener('click', () => {
        document.getElementById('import-file-input').click();
    });
    
    const importFileInput = document.getElementById('import-file-input');
    if (importFileInput) importFileInput.addEventListener('change', importData);

    // Product specific Export/Import
    const importProdBtn = document.getElementById('import-products-btn');
    if (importProdBtn) importProdBtn.addEventListener('click', () => {
        document.getElementById('product-import-input').click();
    });

    const prodImportInput = document.getElementById('product-import-input');
    if (prodImportInput) prodImportInput.addEventListener('change', importProducts);

    // Close search results on click outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) {
            document.getElementById('search-results').style.display = 'none';
        }
    });
}

// --- Theme Logic ---
function toggleTheme() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.body.setAttribute('data-theme', currentTheme);
    localStorage.setItem('mediflow_theme', currentTheme);
    updateThemeIcon();
}

function updateThemeIcon() {
    const icon = document.getElementById('theme-icon');
    icon.setAttribute('data-lucide', currentTheme === 'light' ? 'moon' : 'sun');
    lucide.createIcons();
}

// --- Product Management ---
function renderProducts() {
    try {
        const tbody = document.querySelector('#products-table tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        products.forEach(p => {
        const tr = document.createElement('tr');
        const isExpired = new Date(p.expiry) < new Date();
        const isLowStock = p.stock <= 10;

        tr.innerHTML = `
            <td>${p.name}</td>
            <td><span class="badge" style="background: #e2e8f0; color: #475569;">${p.category}</span></td>
            <td>${p.hsn || '-'}</td>
            <td>${p.batch}</td>
            <td>
                <span class="badge ${isExpired ? 'badge-danger' : (isNearExpiry(p.expiry) ? 'badge-warning' : 'badge-success')}">
                    ${p.expiry}
                </span>
            </td>
            <td>${settings.currency}${p.mrp}</td>
            <td>${settings.currency}${p.salePrice}</td>
            <td>
                <span class="badge ${isLowStock ? 'badge-danger' : 'badge-success'}">
                    ${p.stock}
                </span>
            </td>
            <td>
                <button class="btn btn-primary" onclick="addToCartAndSwitch('${p.id}')" style="padding: 5px; background: var(--secondary-color);"><i data-lucide="shopping-cart" style="width: 16px;"></i></button>
                <button class="btn btn-outline" onclick="editProduct('${p.id}')" style="padding: 5px;"><i data-lucide="edit-2" style="width: 16px;"></i></button>
                ${sessionStorage.getItem('mediflow_user') === 'VIKI' ? `<button class="btn btn-outline" onclick="deleteProduct('${p.id}')" style="padding: 5px; color: var(--danger-color);"><i data-lucide="trash" style="width: 16px;"></i></button>` : ''}
            </td>
        `;
        tbody.appendChild(tr);
        });

        if (products.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 2rem; color: var(--text-muted);">No products found in cloud or local. Click "Add New Product" to start.</td></tr>';
        }
        lucide.createIcons();
    } catch (e) {
        console.error('Error rendering products:', e);
    }
}

function addToCartAndSwitch(id) {
    addToCart(id);
    switchSection('billing');
}

function openProductModal(id = null) {
    const modal = document.getElementById('product-modal');
    const form = document.getElementById('product-form');
    const title = document.getElementById('modal-title');
    
    form.reset();
    document.getElementById('edit-id').value = '';

    if (id) {
        const p = products.find(prod => prod.id === id);
        title.textContent = 'Edit Product';
        document.getElementById('edit-id').value = p.id;
        document.getElementById('p-name').value = p.name;
        document.getElementById('p-barcode').value = p.barcode || '';
        document.getElementById('p-category').value = p.category;
        document.getElementById('p-hsn').value = p.hsn;
        document.getElementById('p-batch').value = p.batch;
        document.getElementById('p-expiry').value = p.expiry;
        document.getElementById('p-mrp').value = p.mrp;
        document.getElementById('p-sale-price').value = p.salePrice;
        document.getElementById('p-stock').value = p.stock;
        document.getElementById('p-gst').value = p.gst;
    } else {
        title.textContent = 'Add New Product';
    }

    modal.style.display = 'flex';
}

function closeProductModal() {
    document.getElementById('product-modal').style.display = 'none';
}

function handleProductSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    
    const productData = {
        id: id || 'P' + Date.now(),
        name: document.getElementById('p-name').value,
        barcode: document.getElementById('p-barcode').value,
        category: document.getElementById('p-category').value,
        hsn: document.getElementById('p-hsn').value,
        batch: document.getElementById('p-batch').value,
        expiry: document.getElementById('p-expiry').value,
        mrp: parseFloat(document.getElementById('p-mrp').value),
        salePrice: parseFloat(document.getElementById('p-sale-price').value),
        stock: parseInt(document.getElementById('p-stock').value),
        gst: parseInt(document.getElementById('p-gst').value)
    };

    if (id) {
        const index = products.findIndex(p => p.id === id);
        products[index] = productData;
    } else {
        products.push(productData);
    }

    saveAndRefresh();
    closeProductModal();
}

function deleteProduct(id) {
    if (confirm('Are you sure you want to delete this product?')) {
        products = products.filter(p => p.id !== id);
        saveAndRefresh();
    }
}

function editProduct(id) {
    openProductModal(id);
}

function saveAndRefresh() {
    localStorage.setItem('mediflow_products', JSON.stringify(products));
    renderProducts();
    renderDashboard();
    syncToCloud('products', products);
}

// --- Cloud Sync Helpers ---
async function syncToCloud(collection, data) {
    if (!isFirebaseEnabled || !db || typeof firebase === 'undefined') return;
    try {
        await db.collection('mediflow_data').doc(collection).set({ payload: data, updatedAt: new Date().toISOString() });
    } catch (e) {
        console.warn("Cloud Sync Failed:", e);
    }
}

async function syncFromCloud() {
    if (!isFirebaseEnabled || !db || typeof firebase === 'undefined') return;
    try {
        const doc = await db.collection('mediflow_data').doc('products').get();
        if (doc.exists) {
            const cloudData = doc.data().payload;
            if (cloudData && Array.isArray(cloudData) && cloudData.length > 0) {
                products = cloudData;
                localStorage.setItem('mediflow_products', JSON.stringify(products));
                renderProducts();
                renderDashboard();
            }
        }
    } catch (e) {
        console.error("Error fetching from cloud:", e);
    }
}

async function backupAllToCloud() {
    if (!isFirebaseEnabled || !db || typeof firebase === 'undefined') {
        alert("Firebase is not connected. Please check your config in script.js");
        return;
    }

    const btn = document.getElementById('cloud-backup-btn');
    const originalText = btn.innerHTML;
    
    try {
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="loader" class="spin"></i> Backing up...';
        lucide.createIcons();

        // Backup each major collection
        await syncToCloud('products', products);
        await syncToCloud('sales', sales);
        await syncToCloud('expenses', expenses);
        await syncToCloud('purchases', purchases);
        await syncToCloud('customers', customers);
        await syncToCloud('suppliers', suppliers);
        await syncToCloud('customer_payments', customerPayments);
        await syncToCloud('supplierPayments', supplierPayments);
        await syncToCloud('settings', settings);

        alert("Database successfully backed up to Firebase Cloud!");
    } catch (e) {
        console.error("Backup failed:", e);
        alert("Cloud Backup Failed! Check your internet connection.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
        lucide.createIcons();
    }
}

// --- Billing Logic ---
function handleBillingSearch(e) {
    const query = e.target.value.trim().toLowerCase();
    const resultsDiv = document.getElementById('search-results');
    
    if (query.length < 1) {
        resultsDiv.style.display = 'none';
        return;
    }

    // Check for EXACT barcode match first (Hardware Scanners)
    const exactMatch = products.find(p => p.barcode && p.barcode.toLowerCase() === query);
    if (exactMatch) {
        addToCart(exactMatch.id);
        e.target.value = '';
        resultsDiv.style.display = 'none';
        return;
    }

    const filtered = products.filter(p => 
        p.name.toLowerCase().includes(query) || 
        (p.barcode && p.barcode.toLowerCase().includes(query)) ||
        p.batch.toLowerCase().includes(query)
    ).slice(0, 5);

    if (filtered.length > 0) {
        resultsDiv.innerHTML = filtered.map(p => `
            <div class="search-item" onclick="addToCart('${p.id}')">
                <span class="name">${p.name} <small>(${p.category})</small></span>
                <span class="details">Barcode: ${p.barcode || 'N/A'} | Batch: ${p.batch} | Price: ${settings.currency}${p.salePrice}</span>
            </div>
        `).join('');
        resultsDiv.style.display = 'block';
    } else {
        resultsDiv.style.display = 'none';
    }
}

function addToCart(productId, qty = 1) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    if (product.stock <= 0) {
        alert('Item out of stock!');
        return;
    }

    const existing = cart.find(item => item.id === productId);
    if (existing) {
        const newQty = existing.qty + qty;
        if (newQty > product.stock) {
            alert('Exceeds available stock!');
            return;
        }
        existing.qty = newQty;
    } else {
        cart.push({
            ...product,
            qty: qty
        });
    }

    // Play sound (simulated)
    playBeep();

    document.getElementById('billing-search').value = '';
    document.getElementById('search-results').style.display = 'none';
    renderCart();
}

function renderCart() {
    const tbody = document.querySelector('#cart-table tbody');
    tbody.innerHTML = '';

    cart.forEach((item, index) => {
        const total = item.salePrice * item.qty;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.name}</td>
            <td>${item.batch}</td>
            <td>${settings.currency}${item.salePrice}</td>
            <td>
                <input type="number" value="${item.qty}" min="1" max="${item.stock}" 
                    onchange="updateQty('${item.id}', this.value)" class="form-control qty-input">
            </td>
            <td>${item.gst}%</td>
            <td>${settings.currency}${total.toFixed(2)}</td>
            <td>
                <button class="btn btn-outline" onclick="removeFromCart(${index})" style="color: var(--danger-color);">
                    <i data-lucide="x" style="width: 16px;"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    lucide.createIcons();
    updateCartTotals();
}

function updateQty(id, val) {
    const item = cart.find(i => i.id === id);
    if (item) {
        item.qty = parseInt(val);
        renderCart();
    }
}

function removeFromCart(index) {
    cart.splice(index, 1);
    renderCart();
}

function clearCart() {
    if (confirm('Clear all items from cart?')) {
        cart = [];
        renderCart();
    }
}

function updateCartTotals() {
    const includeGst = document.getElementById('gst-toggle').checked;
    const discInput = parseFloat(document.getElementById('discount-input').value) || 0;
    const discType = document.getElementById('discount-type').value;

    let subtotal = 0;
    let gstTotal = 0;

    cart.forEach(item => {
        const lineTotal = item.salePrice * item.qty;
        subtotal += lineTotal;
        
        if (includeGst) {
            gstTotal += (lineTotal * item.gst / 100);
        }
    });

    let discount = 0;
    if (discType === 'percent') {
        discount = (subtotal + gstTotal) * (discInput / 100);
    } else {
        discount = discInput;
    }

    const grandTotal = subtotal + gstTotal - discount;

    document.getElementById('summary-subtotal').textContent = `${settings.currency}${subtotal.toFixed(2)}`;
    document.getElementById('summary-gst').textContent = `${settings.currency}${gstTotal.toFixed(2)}`;
    document.getElementById('summary-grand-total').textContent = `${settings.currency}${grandTotal.toFixed(2)}`;
}

// --- Hold Bill Logic ---
function holdCurrentCart() {
    if (cart.length === 0) {
        alert("Cart is empty! There's nothing to hold.");
        return;
    }
    
    const cartName = prompt("Enter a name or identifier for this suspended bill (e.g. Person 1):", `Cart ${heldCarts.length + 1}`);
    if (!cartName) return;

    const cartData = {
        name: cartName,
        timestamp: Date.now(),
        cartFiles: JSON.parse(JSON.stringify(cart)),
        customerName: document.getElementById('customer-name').value,
        customerPhone: document.getElementById('customer-phone').value,
        discount: document.getElementById('discount-input').value,
        discountType: document.getElementById('discount-type').value,
        gstToggle: document.getElementById('gst-toggle').checked
    };

    heldCarts.push(cartData);
    localStorage.setItem('mediflow_held_carts', JSON.stringify(heldCarts));
    
    // Clear UI
    document.getElementById('clear-cart-btn').click(); 
    document.getElementById('customer-name').value = '';
    document.getElementById('customer-phone').value = '';
    renderCartTabs();
    alert(`Bill suspended safely as "${cartName}".`);
}

function recallCart(index) {
    if (cart.length > 0) {
        if (!confirm("You currently have items in the active cart! Recalling a held bill will erase the current one. Proceed?")) {
            return;
        }
    }

    const cData = heldCarts[index];
    cart = [...cData.cartFiles];
    document.getElementById('customer-name').value = cData.customerName || '';
    document.getElementById('customer-phone').value = cData.customerPhone || '';
    document.getElementById('discount-input').value = cData.discount || '0';
    document.getElementById('discount-type').value = cData.discountType || 'percent';
    
    const toggle = document.getElementById('gst-toggle');
    if (toggle) toggle.checked = cData.gstToggle;

    heldCarts.splice(index, 1);
    localStorage.setItem('mediflow_held_carts', JSON.stringify(heldCarts));
    
    renderCart();
    renderCartTabs();
}

function renderCartTabs() {
    const container = document.getElementById('cart-tabs-container');
    if (!container) return;
    container.innerHTML = '';
    
    heldCarts.forEach((hc, index) => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-outline';
        btn.style.cssText = "padding: 6px 12px; border-radius: 20px; font-size: 0.8rem; background: var(--warning-light); color: var(--warning-color); border-color: var(--warning-color); display: flex; gap: 6px; align-items: center; cursor: pointer; white-space: nowrap;";
        btn.innerHTML = `<i data-lucide="shopping-bag" style="width: 14px;"></i> ${hc.name} <span class="badge" style="background: var(--danger-color); color: white; padding: 2px 6px; border-radius: 50%; font-size: 10px;">${hc.cartFiles.length}</span>`;
        btn.onclick = () => recallCart(index);
        container.appendChild(btn);
    });
    lucide.createIcons();
}

// --- Sale Processing ---
function setPayMode(mode, btn) {
    currentPayMode = mode;
    document.querySelectorAll('.pay-mode').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

function processSale(shouldPrint, shouldWhatsApp = false) {
    if (cart.length === 0) {
        alert('Cart is empty!');
        return;
    }

    const invoiceNo = document.getElementById('invoice-number').value;
    const customer = {
        name: document.getElementById('customer-name').value || 'Cash Customer',
        phone: document.getElementById('customer-phone').value || '-'
    };

    const subtotal = parseFloat(document.getElementById('summary-subtotal').textContent.replace(settings.currency, ''));
    const gst = parseFloat(document.getElementById('summary-gst').textContent.replace(settings.currency, ''));
    const discInput = parseFloat(document.getElementById('discount-input').value) || 0;
    const discType = document.getElementById('discount-type').value;
    
    let discountAmount = discType === 'percent' ? (subtotal + gst) * (discInput / 100) : discInput;
    const grandTotal = subtotal + gst - discountAmount;

    const saleData = {
        id: 'S' + Date.now(),
        invoiceNo,
        customer,
        items: [...cart],
        subtotal: subtotal,
        gst: gst,
        discount: discountAmount,
        grandTotal: grandTotal,
        paymentMode: currentPayMode,
        date: new Date().toISOString()
    };

    // Update Stock
    cart.forEach(item => {
        const pIndex = products.findIndex(p => p.id === item.id);
        if (pIndex !== -1) {
            products[pIndex].stock -= item.qty;
        }
    });

    // Update Customer Stats
    if (customer.name !== 'Cash Customer' && customer.phone !== '-') {
        let cust = customers.find(c => c.phone === customer.phone);
        if (!cust) {
            cust = { id: 'C' + Date.now(), name: customer.name, phone: customer.phone, visits: 0, totalSpent: 0 };
            customers.push(cust);
        }
        cust.visits = (cust.visits || 0) + 1;
        cust.totalSpent = (parseFloat(cust.totalSpent) || 0) + grandTotal;
        localStorage.setItem('mediflow_customers', JSON.stringify(customers));
        renderCustomers();
    }

    sales.push(saleData);
    localStorage.setItem('mediflow_products', JSON.stringify(products));
    localStorage.setItem('mediflow_sales', JSON.stringify(sales));

    if (shouldPrint) {
        printBill(saleData);
    } else if (shouldWhatsApp) {
        sendWhatsAppBill(saleData.id);
    } else {
        alert('Sale saved successfully!');
    }

    // Reset
    cart = [];
    document.getElementById('customer-name').value = '';
    document.getElementById('customer-phone').value = '';
    document.getElementById('discount-input').value = '0';
    currentPayMode = 'Cash';
    document.querySelectorAll('.pay-mode').forEach(b => {
        b.classList.remove('active');
        if (b.getAttribute('data-mode') === 'Cash') b.classList.add('active');
    });
    renderCart();
    renderProducts();
    renderDashboard();
    renderSalesHistory();
    generateInvoiceNumber();
}

function printBill(sale) {
    const bill = document.getElementById('thermal-bill');
    
    // Set print size class
    bill.className = ''; // Reset
    bill.classList.add('print-' + settings.printerType);

    // Fill the hidden bill with settings
    const logoImg = document.getElementById('bill-logo');
    if (settings.shopLogo) {
        logoImg.src = settings.shopLogo;
        logoImg.style.display = 'inline-block';
    } else {
        logoImg.style.display = 'none';
    }

    document.getElementById('bill-shop-name').textContent = settings.shopName;
    document.getElementById('bill-shop-address').innerHTML = `${settings.shopAddress}<br>Phone: ${settings.shopPhone}`;
    
    document.getElementById('bill-inv-no').textContent = sale.invoiceNo;
    document.getElementById('bill-date').textContent = new Date(sale.date).toLocaleDateString();
    document.getElementById('bill-cust-name').textContent = sale.customer.name;
    
    const itemsTbody = document.getElementById('bill-items-body');
    itemsTbody.innerHTML = sale.items.map(item => `
        <tr>
            <td style="padding: 2px 0;">${item.name}</td>
            <td style="padding: 2px 0; text-align: center;">${item.qty}</td>
            <td style="padding: 2px 0; text-align: right;">${item.salePrice}</td>
            <td style="padding: 2px 0; text-align: right;">${(item.salePrice * item.qty).toFixed(2)}</td>
        </tr>
    `).join('');

    document.getElementById('bill-subtotal').textContent = `${settings.currency}${sale.subtotal.toFixed(2)}`;
    document.getElementById('bill-gst').textContent = `${settings.currency}${sale.gst.toFixed(2)}`;
    document.getElementById('bill-discount').textContent = `${settings.currency}${sale.discount.toFixed(2)}`;
    document.getElementById('bill-grand-total').textContent = `${settings.currency}${sale.grandTotal.toFixed(2)}`;

    // Show template, print, and hide
    bill.style.display = 'block';
    window.print();
    bill.style.display = 'none';
}

// --- Sales History ---
function renderSalesHistory() {
    try {
        const tbody = document.querySelector('#sales-history-table tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';

        const fromDate = document.getElementById('sale-date-from')?.value;
        const toDate = document.getElementById('sale-date-to')?.value;

        let filteredSales = [...sales];

        if (fromDate) {
            filteredSales = filteredSales.filter(s => s.date && new Date(s.date) >= new Date(fromDate));
        }
        if (toDate) {
            const end = new Date(toDate);
            end.setHours(23, 59, 59, 999);
            filteredSales = filteredSales.filter(s => s.date && new Date(s.date) <= end);
        }

        filteredSales.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(s => {
            const tr = document.createElement('tr');
            const amount = parseFloat(s.grandTotal || s.total || 0);
            const itemsCount = s.items ? s.items.length : 0;
            const custName = (s.customer && s.customer.name) ? s.customer.name : 'Cash Customer';
            const payMode = s.paymentMode || 'Cash';

            tr.innerHTML = `
                <td>#${s.invoiceNo || '---'}</td>
                <td>${s.date ? new Date(s.date).toLocaleString() : '---'}</td>
                <td>${custName}</td>
                <td><span class="badge" style="background: ${payMode === 'Credit' ? '#fee2e2' : '#dcfce7'}; color: ${payMode === 'Credit' ? '#dc2626' : '#16a34a'};">${payMode}</span></td>
                <td><strong>${settings.currency}${amount.toFixed(2)}</strong></td>
                <td>${itemsCount} items</td>
                <td>
                    <button class="btn btn-outline" onclick="reprintBill('${s.id}')" style="padding: 5px;"><i data-lucide="printer" style="width: 16px;"></i></button>
                    <button class="btn btn-outline" onclick="sendWhatsAppBill('${s.id}')" style="padding: 5px; color: #25d366;"><i data-lucide="message-square" style="width: 16px;"></i></button>
                    ${sessionStorage.getItem('mediflow_user') === 'VIKI' ? `<button class="btn btn-outline" onclick="deleteSale('${s.id}')" style="padding: 5px; color: var(--danger-color);"><i data-lucide="trash" style="width: 16px;"></i></button>` : ''}
                </td>
            `;
            tbody.appendChild(tr);
        });
        lucide.createIcons();
    } catch (e) {
        console.error('Error rendering sales history:', e);
    }
}

function deleteSale(id) {
    if (!confirm('Are you sure you want to delete this sale? This will restock the sold items.')) return;
    
    const loggedInUsername = sessionStorage.getItem('mediflow_user');
    let actualRole = 'staff'; 
    if (loggedInUsername === 'VIKI') {
        actualRole = 'superadmin';
    } else {
        const foundUser = admins.find(a => a.username === loggedInUsername);
        if (foundUser) actualRole = foundUser.role;
    }
    
    if (actualRole === 'staff') {
        alert('Access Denied: Staff cannot delete sales.');
        return;
    }

    const saleIndex = sales.findIndex(s => s.id === id);
    if (saleIndex > -1) {
        const sale = sales[saleIndex];
        
        // Restore stock
        if (sale.items && Array.isArray(sale.items)) {
            sale.items.forEach(item => {
                const prodIndex = products.findIndex(p => p.id === item.id);
                if (prodIndex > -1) {
                    products[prodIndex].stock += item.qty;
                }
            });
            localStorage.setItem('mediflow_products', JSON.stringify(products));
            syncToCloud('products', products);
        }

        sales.splice(saleIndex, 1);
        localStorage.setItem('mediflow_sales', JSON.stringify(sales));
        syncToCloud('sales', sales);

        renderSalesHistory();
        renderDashboard();
        if (activeSection === 'products') renderProducts();
        alert('Sale deleted and stock restored successfully.');
    }
}

// --- Purchase & Expenses Logic ---
function renderProductDropdown() {
    const select = document.getElementById('pur-product');
    select.innerHTML = '<option value="">Select Product</option>';
    products.forEach(p => {
        select.innerHTML += `<option value="${p.id}">${p.name} (${p.batch})</option>`;
    });
}

function handlePurchaseSubmit(e) {
    e.preventDefault();
    const productId = document.getElementById('pur-product').value;
    const qty = parseInt(document.getElementById('pur-qty').value);
    const price = parseFloat(document.getElementById('pur-price').value);
    
    const purchaseData = {
        id: 'PUR' + Date.now(),
        productId,
        productName: products.find(p => p.id === productId).name,
        supplier: document.getElementById('pur-supplier').value,
        invoice: document.getElementById('pur-invoice').value,
        date: document.getElementById('pur-date').value,
        qty,
        price,
        total: qty * price
    };

    // Update stock
    const pIndex = products.findIndex(p => p.id === productId);
    products[pIndex].stock += qty;

    purchases.push(purchaseData);
    localStorage.setItem('mediflow_products', JSON.stringify(products));
    localStorage.setItem('mediflow_purchases', JSON.stringify(purchases));
    
    e.target.reset();
    renderPurchases();
    renderProducts();
    alert('Purchase recorded and stock updated!');
}

function renderPurchases() {
    try {
        const tbody = document.querySelector('#purchase-table tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        purchases.sort((a,b) => new Date(b.date) - new Date(a.date)).forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${p.date || '---'}</td>
                <td>${p.productName || '---'}</td>
                <td>${p.qty || 0}</td>
                <td>${settings.currency}${parseFloat(p.total || 0).toFixed(2)}</td>
                <td>
                    ${sessionStorage.getItem('mediflow_user') === 'VIKI' ? `<button class="btn btn-outline" onclick="deletePurchase('${p.id}')" style="padding: 5px; color: var(--danger-color);"><i data-lucide="trash" style="width: 14px;"></i></button>` : ''}
                </td>
            `;
            tbody.appendChild(tr);
        });
        lucide.createIcons();
    } catch (e) {
        console.error('Error rendering purchases:', e);
    }
}

function deletePurchase(id) {
    if (confirm('Are you sure you want to delete this purchase? Stock levels will be reduced accordingly.')) {
        const purchase = purchases.find(p => p.id === id);
        if (purchase) {
            // Deduct stock
            const pIndex = products.findIndex(p => p.id === purchase.productId);
            if (pIndex !== -1) {
                products[pIndex].stock = Math.max(0, products[pIndex].stock - purchase.qty);
            }
            
            // Remove purchase
            purchases = purchases.filter(p => p.id !== id);
            
            // Save
            localStorage.setItem('mediflow_products', JSON.stringify(products));
            localStorage.setItem('mediflow_purchases', JSON.stringify(purchases));
            
            renderPurchases();
            renderProducts();
            if (activeSection === 'dashboard') renderDashboard();
            if (activeSection === 'suppliers') renderSuppliers();
            alert('Purchase deleted and stock restored successfully.');
        }
    }
}

function handleExpenseSubmit(e) {
    e.preventDefault();
    const expenseData = {
        id: 'EXP' + Date.now(),
        category: document.getElementById('exp-category').value,
        description: document.getElementById('exp-desc').value,
        amount: parseFloat(document.getElementById('exp-amount').value),
        date: document.getElementById('exp-date').value
    };

    expenses.push(expenseData);
    localStorage.setItem('mediflow_expenses', JSON.stringify(expenses));
    
    e.target.reset();
    renderExpenses();
    alert('Expense recorded!');
}

function renderExpenses() {
    try {
        const tbody = document.querySelector('#expenses-table tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        expenses.sort((a,b) => new Date(b.date) - new Date(a.date)).forEach(ex => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${ex.date || '---'}</td>
                <td>${ex.category || '---'}</td>
                <td>${settings.currency}${parseFloat(ex.amount || 0).toFixed(2)}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error('Error rendering expenses:', e);
    }
}

function reprintBill(saleId) {
    const sale = sales.find(s => s.id === saleId);
    if (sale) printBill(sale);
}

// --- Dashboard Logic ---
function renderDashboard() {
    try {
        const today = new Date().toDateString();
        const todaysSales = sales.filter(s => s.date && new Date(s.date).toDateString() === today);
        const todaysExpenses = expenses.filter(ex => ex.date && new Date(ex.date).toDateString() === today);
        const todaysPurchases = purchases.filter(p => p.date && new Date(p.date).toDateString() === today);
        
        const revenue = todaysSales.reduce((sum, s) => sum + (parseFloat(s.grandTotal) || 0), 0);
        const dailyExpenses = todaysExpenses.reduce((sum, ex) => sum + (parseFloat(ex.amount) || 0), 0);
        const dailyPurchases = todaysPurchases.reduce((sum, p) => sum + ((parseFloat(p.price) || 0) * (parseFloat(p.qty) || 0)), 0);
        const netProfit = revenue - dailyExpenses - dailyPurchases;

        const lowStock = products.filter(p => (parseInt(p.stock) || 0) <= 10).length;
        const expired = products.filter(p => p.expiry && isNearExpiry(p.expiry)).length;

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        setVal('stat-sales-count', todaysSales.length);
        setVal('stat-revenue', `${settings.currency}${revenue.toFixed(2)}`);
        setVal('stat-expenses', `${settings.currency}${dailyExpenses.toFixed(2)}`);
        setVal('stat-purchases', `${settings.currency}${dailyPurchases.toFixed(2)}`);
        setVal('stat-profit', `${settings.currency}${netProfit.toFixed(2)}`);
        setVal('stat-low-stock', lowStock);
        setVal('stat-expired', expired);

        // Recent Sales table
        const recentTbody = document.querySelector('#recent-sales-table tbody');
        if (recentTbody) {
            recentTbody.innerHTML = todaysSales.slice(0, 5).map(s => `
                <tr>
                    <td>#${s.invoiceNo || '---'}</td>
                    <td>${s.customer ? s.customer.name : 'Cash Customer'}</td>
                    <td>${s.items ? s.items.length : 0}</td>
                    <td>${settings.currency}${(parseFloat(s.grandTotal) || 0).toFixed(2)}</td>
                    <td>${s.date ? new Date(s.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}</td>
                </tr>
            `).join('');
        }
    } catch (e) {
        console.error('Error rendering dashboard:', e);
    }
}

// --- Helpers ---
function generateInvoiceNumber() {
    const lastSale = sales[sales.length - 1];
    let nextNo = 1;
    if (lastSale && lastSale.invoiceNo) {
        nextNo = parseInt(lastSale.invoiceNo) + 1;
    }
    const invInput = document.getElementById('invoice-number');
    if (invInput) invInput.value = nextNo.toString().padStart(6, '0');
}

function isNearExpiry(dateStr) {
    const expiryDate = new Date(dateStr);
    const today = new Date();
    const threeMonthsFromNow = new Date();
    threeMonthsFromNow.setMonth(today.getMonth() + 3);
    return expiryDate < threeMonthsFromNow;
}

function playBeep() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.1);
}

// --- Backup & Restore ---
function exportData() {
    const data = {
        products: JSON.parse(localStorage.getItem('mediflow_products')) || [],
        sales: JSON.parse(localStorage.getItem('mediflow_sales')) || [],
        settings: JSON.parse(localStorage.getItem('mediflow_settings')) || {},
        purchases: JSON.parse(localStorage.getItem('mediflow_purchases')) || [],
        expenses: JSON.parse(localStorage.getItem('mediflow_expenses')) || [],
        customers: JSON.parse(localStorage.getItem('mediflow_customers')) || [],
        suppliers: JSON.parse(localStorage.getItem('mediflow_suppliers')) || [],
        supplierPayments: JSON.parse(localStorage.getItem('mediflow_supplier_payments')) || [],
        theme: localStorage.getItem('mediflow_theme') || 'light',
        exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MediFlow_Backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importData(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!confirm('Are you sure you want to import this data? This will overwrite all your current products, sales, and settings. This action cannot be undone.')) {
        e.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const data = JSON.parse(event.target.result);
            
            // Basic validation
            if (!data.products || !data.sales) {
                throw new Error('Invalid backup file format.');
            }

            // Save to localStorage
            localStorage.setItem('mediflow_products', JSON.stringify(data.products));
            localStorage.setItem('mediflow_sales', JSON.stringify(data.sales));
            if (data.settings) localStorage.setItem('mediflow_settings', JSON.stringify(data.settings));
            if (data.purchases) localStorage.setItem('mediflow_purchases', JSON.stringify(data.purchases));
            if (data.expenses) localStorage.setItem('mediflow_expenses', JSON.stringify(data.expenses));
            if (data.customers) localStorage.setItem('mediflow_customers', JSON.stringify(data.customers));
            if (data.suppliers) localStorage.setItem('mediflow_suppliers', JSON.stringify(data.suppliers));
            if (data.supplierPayments) localStorage.setItem('mediflow_supplier_payments', JSON.stringify(data.supplierPayments));
            if (data.theme) localStorage.setItem('mediflow_theme', data.theme);

            alert('Data imported successfully! The application will now reload.');
            window.location.reload();
        } catch (error) {
            console.error('Import error:', error);
            alert('Error importing data: ' + error.message);
        }
    };
    reader.readAsText(file);
}

// --- Product Specific Backup ---
function exportProducts() {
    const productsData = JSON.parse(localStorage.getItem('mediflow_products')) || [];
    const blob = new Blob([JSON.stringify(productsData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MediFlow_Products_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importProducts(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!confirm('Are you sure you want to import products? This will replace your current product list.')) {
        e.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            let importedProducts = [];
            const fileName = file.name.toLowerCase();

            if (fileName.endsWith('.json')) {
                importedProducts = JSON.parse(event.target.result);
            } else if (fileName.endsWith('.csv')) {
                importedProducts = csvToJSON(event.target.result);
            } else {
                throw new Error('Unsupported file format. Use .json or .csv');
            }
            
            if (!Array.isArray(importedProducts)) {
                throw new Error('Invalid products data format.');
            }

            // Simple validation
            if (importedProducts.length > 0 && (!importedProducts[0].name)) {
                throw new Error('Invalid product data. "name" field is required.');
            }

            // Assign IDs if missing
            products = importedProducts.map(p => ({
                id: p.id || 'P' + Math.random().toString(36).substr(2, 9),
                name: p.name || 'Unknown',
                category: p.category || 'Other',
                hsn: p.hsn || '',
                batch: p.batch || 'BN-000',
                expiry: p.expiry || '2026-12-31',
                mrp: parseFloat(p.mrp) || 0,
                salePrice: parseFloat(p.salePrice) || 0,
                stock: parseInt(p.stock) || 0,
                gst: parseInt(p.gst) || 12
            }));

            localStorage.setItem('mediflow_products', JSON.stringify(products));
            
            alert('Products imported successfully!');
            renderProducts();
            renderDashboard();
            if (activeSection === 'purchase') renderProductDropdown();
        } catch (error) {
            console.error('Import error:', error);
            alert('Error importing products: ' + error.message);
        } finally {
            e.target.value = '';
        }
    };
    reader.readAsText(file);
}

// --- CSV Helper Functions ---

function exportProductsCSV() {
    const headers = ['id', 'name', 'category', 'hsn', 'batch', 'expiry', 'mrp', 'salePrice', 'stock', 'gst'];
    const csvContent = jsonToCSV(products, headers);
    downloadBlob(csvContent, `MediFlow_Products_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
}

function jsonToCSV(items, headers) {
    const csvRows = [];
    // Header row
    csvRows.push(headers.join(','));

    // Data rows
    for (const item of items) {
        const values = headers.map(header => {
            const val = item[header] || '';
            const escaped = ('' + val).replace(/"/g, '""');
            return `"${escaped}"`;
        });
        csvRows.push(values.join(','));
    }
    return csvRows.join('\n');
}

function csvToJSON(csvText) {
    const lines = csvText.split(/\r?\n/);
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const result = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Simple CSV parser that handles quotes
        const values = [];
        let current = '';
        let inQuotes = false;
        
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));

        const obj = {};
        headers.forEach((header, index) => {
            obj[header] = values[index];
        });
        result.push(obj);
    }
    return result;
}

function downloadBlob(content, filename, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function exportSalesCSV() {
    const headers = ['invoiceNo', 'date', 'customerName', 'customerPhone', 'itemName', 'qty', 'price', 'gst', 'total', 'grandTotal'];
    const flattenedSales = [];
    
    sales.forEach(sale => {
        sale.items.forEach(item => {
            flattenedSales.push({
                invoiceNo: sale.invoiceNo,
                date: new Date(sale.date).toLocaleString(),
                customerName: sale.customer.name,
                customerPhone: sale.customer.phone,
                itemName: item.name,
                qty: item.qty,
                price: item.salePrice,
                gst: item.gst,
                total: (item.qty * item.salePrice).toFixed(2),
                grandTotal: sale.grandTotal.toFixed(2)
            });
        });
    });

    const csvContent = jsonToCSV(flattenedSales, headers);
    downloadBlob(csvContent, `MediFlow_Sales_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
}

function exportPurchasesCSV() {
    const headers = ['date', 'productName', 'supplier', 'invoice', 'qty', 'price', 'total'];
    const csvContent = jsonToCSV(purchases, headers);
    downloadBlob(csvContent, `MediFlow_Purchases_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
}

function exportExpensesCSV() {
    const headers = ['date', 'category', 'description', 'amount'];
    const csvContent = jsonToCSV(expenses, headers);
    downloadBlob(csvContent, `MediFlow_Expenses_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
}

// --- Category Management ---
function renderCategoryManagement() {
    const list = document.getElementById('category-list');
    if (!list) return;
    
    list.innerHTML = categories.map(cat => `
        <div class="badge" style="background: var(--primary-light); color: var(--primary-color); padding: 5px 10px; display: flex; align-items: center; gap: 8px;">
            ${cat}
            <i data-lucide="edit-2" style="width: 12px; cursor: pointer;" onclick="editCategoryName('${cat}')"></i>
            <i data-lucide="x" style="width: 12px; cursor: pointer;" onclick="deleteCategory('${cat}')"></i>
        </div>
    `).join('');
    
    // Also update product category dropdowns
    updateCategoryDropdowns();
    lucide.createIcons();
}

function updateCategoryDropdowns() {
    const pCatSelect = document.getElementById('p-category');
    if (pCatSelect) {
        const currentVal = pCatSelect.value;
        pCatSelect.innerHTML = categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
        if (categories.includes(currentVal)) pCatSelect.value = currentVal;
    }
}

function addCategory() {
    const input = document.getElementById('new-category-name');
    const name = input.value.trim();
    
    if (!name) return;
    if (categories.includes(name)) {
        alert('Category already exists!');
        return;
    }
    
    categories.push(name);
    saveCategories();
    input.value = '';
    renderCategoryManagement();
}

function editCategoryName(oldName) {
    const newName = prompt('Enter new name for category:', oldName);
    if (!newName || newName.trim() === oldName) return;
    
    const trimmedNewName = newName.trim();
    if (categories.includes(trimmedNewName)) {
        alert('Category name already exists!');
        return;
    }
    
    // Update category list
    const index = categories.indexOf(oldName);
    if (index !== -1) {
        categories[index] = trimmedNewName;
        
        // Update all products using this category
        products.forEach(p => {
            if (p.category === oldName) p.category = trimmedNewName;
        });
        
        saveCategories();
        localStorage.setItem('mediflow_products', JSON.stringify(products));
        renderCategoryManagement();
        renderProducts();
    }
}

function deleteCategory(name) {
    if (categories.length <= 1) {
        alert('Must have at least one category.');
        return;
    }
    
    const count = products.filter(p => p.category === name).length;
    if (count > 0) {
        if (!confirm(`There are ${count} products using this category. Deleting it will set them to "${categories[0] === name ? categories[1] : categories[0]}". Continue?`)) {
            return;
        }
        
        const fallback = categories[0] === name ? categories[1] : categories[0];
        products.forEach(p => {
            if (p.category === name) p.category = fallback;
        });
        localStorage.setItem('mediflow_products', JSON.stringify(products));
        renderProducts();
    }
    
    categories = categories.filter(c => c !== name);
    saveCategories();
    renderCategoryManagement();
}

function saveCategories() {
    localStorage.setItem('mediflow_categories', JSON.stringify(categories));
}

// --- Customer Management ---
function renderCustomers() {
    const tbody = document.querySelector('#customers-table tbody');
    if (!tbody) return;
    
    // Calculate summaries from sales first
    const customerSummaries = {};
    sales.forEach(s => {
        if (!s.customer || !s.customer.phone) return;
        const phone = s.customer.phone;
        if (!customerSummaries[phone]) {
            customerSummaries[phone] = { paid: 0, credit: 0, returned: 0 };
        }
        if (s.paymentMode === 'Credit') {
            customerSummaries[phone].credit += (parseFloat(s.grandTotal) || 0);
        } else {
            customerSummaries[phone].paid += (parseFloat(s.grandTotal) || 0);
        }
    });

    // Substract actual payments made
    customerPayments.forEach(p => {
        const phone = p.customerPhone;
        if (customerSummaries[phone]) {
            customerSummaries[phone].returned += parseFloat(p.amount);
            customerSummaries[phone].credit -= parseFloat(p.amount);
        }
    });

    const queryInput = document.getElementById('customer-list-search');
    const query = queryInput ? queryInput.value.toLowerCase() : '';
    const filtered = customers.filter(c => 
        c.name.toLowerCase().includes(query) || 
        c.phone.includes(query)
    );

    tbody.innerHTML = filtered.map(c => {
        const summary = customerSummaries[c.phone] || { paid: 0, credit: 0 };
        return `
            <tr>
                <td>${c.name}</td>
                <td>${c.phone}</td>
                <td>${c.visits || 0}</td>
                <td>${settings.currency}${parseFloat(c.totalSpent || 0).toFixed(2)}</td>
                <td style="color: #16a34a; font-weight: 600;">${settings.currency}${(summary.paid + summary.returned).toFixed(2)}</td>
                <td style="color: #dc2626; font-weight: 600;">${settings.currency}${summary.credit.toFixed(2)}</td>
                <td>
                    <button class="btn btn-outline" onclick="openPaymentModal('${c.id}')" title="Return Amount" style="padding: 5px; color: #16a34a; border-color: #16a34a;"><i data-lucide="arrow-down-to-dot" style="width: 14px;"></i></button>
                    <button class="btn btn-outline" onclick="editCustomer('${c.id}')" style="padding: 5px;"><i data-lucide="edit-2" style="width: 14px;"></i></button>
                    ${sessionStorage.getItem('mediflow_user') === 'VIKI' ? `<button class="btn btn-outline" onclick="deleteCustomer('${c.id}')" style="padding: 5px; color: var(--danger-color);"><i data-lucide="trash" style="width: 14px;"></i></button>` : ''}
                </td>
            </tr>
        `;
    }).join('');
    lucide.createIcons();
}

function handleCustomerSuggest(e) {
    const query = e.target.value.toLowerCase();
    const suggestions = document.getElementById('customer-suggestions');
    
    if (query.length < 1) {
        suggestions.style.display = 'none';
        return;
    }

    const filtered = customers.filter(c => 
        c.name.toLowerCase().includes(query) || 
        c.phone.includes(query)
    ).slice(0, 5);

    if (filtered.length > 0) {
        suggestions.innerHTML = filtered.map(c => `
            <div class="search-item" onclick="selectCustomer('${c.name}', '${c.phone}')">
                <span class="name">${c.name}</span>
                <span class="details">${c.phone}</span>
            </div>
        `).join('');
        suggestions.style.display = 'block';
    } else {
        suggestions.style.display = 'none';
    }
}

function selectCustomer(name, phone) {
    document.getElementById('customer-name').value = name;
    document.getElementById('customer-phone').value = phone;
    document.getElementById('customer-suggestions').style.display = 'none';
}

function openCustomerModal(id = null) {
    const modal = document.getElementById('customer-modal');
    const title = document.getElementById('customer-modal-title');
    const form = document.getElementById('customer-form');
    
    form.reset();
    document.getElementById('edit-customer-id').value = '';
    
    if (id) {
        const c = customers.find(cust => cust.id === id);
        title.textContent = 'Edit Customer';
        document.getElementById('edit-customer-id').value = c.id;
        document.getElementById('c-name').value = c.name;
        document.getElementById('c-phone').value = c.phone;
    } else {
        title.textContent = 'Add New Customer';
    }
    
    modal.style.display = 'flex';
}

function closeCustomerModal() {
    document.getElementById('customer-modal').style.display = 'none';
}

function handleCustomerSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('edit-customer-id').value;
    const name = document.getElementById('c-name').value.trim();
    const phone = document.getElementById('c-phone').value.trim();

    if (id) {
        const index = customers.findIndex(c => c.id === id);
        customers[index] = { ...customers[index], name, phone };
    } else {
        customers.push({
            id: 'C' + Date.now(),
            name,
            phone,
            visits: 0,
            totalSpent: 0
        });
    }

    localStorage.setItem('mediflow_customers', JSON.stringify(customers));
    closeCustomerModal();
    renderCustomers();
}

function deleteCustomer(id) {
    if (confirm('Are you sure you want to delete this customer?')) {
        customers = customers.filter(c => c.id !== id);
        localStorage.setItem('mediflow_customers', JSON.stringify(customers));
        renderCustomers();
    }
}

function editCustomer(id) {
    openCustomerModal(id);
}

// --- Supplier Management ---
function renderSuppliers() {
    const tbody = document.querySelector('#suppliers-table tbody');
    if (!tbody) return;
    
    const searchInput = document.getElementById('supplier-list-search');
    let query = searchInput ? searchInput.value.toLowerCase() : '';

    let filtered = suppliers;
    if (query) {
        filtered = suppliers.filter(s => 
            s.name.toLowerCase().includes(query) || 
            s.phone.includes(query) || 
            (s.person && s.person.toLowerCase().includes(query))
        );
    }

    tbody.innerHTML = '';
    
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">No suppliers found.</td></tr>';
        return;
    }

    filtered.forEach(s => {
        let totalPurchases = 0;
        purchases.forEach(p => {
            if (p.supplier === s.name) {
                totalPurchases += (parseFloat(p.total) || 0);
            }
        });

        let totalPaid = 0;
        supplierPayments.forEach(p => {
            if (p.supplierId === s.id) {
                totalPaid += (parseFloat(p.amount) || 0);
            }
        });

        let balance = totalPurchases - totalPaid;

        const isOwe = balance > 0;
        const balanceColor = isOwe ? 'var(--danger-color)' : (balance < 0 ? 'var(--success-color)' : 'inherit');

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${s.name}</strong></td>
            <td>${s.phone}</td>
            <td>${settings.currency}${totalPurchases.toFixed(2)}</td>
            <td>${settings.currency}${totalPaid.toFixed(2)}</td>
            <td style="color: ${balanceColor}; font-weight: bold;">${settings.currency}${Math.abs(balance).toFixed(2)} ${balance < 0 ? '(Adv)' : ''}</td>
            <td>
                <button class="btn btn-primary" onclick="openSupplierPaymentModal('${s.id}')" style="padding: 5px 10px; font-size: 0.8rem; margin-right: 5px;">Pay</button>
                <button class="btn btn-outline" onclick="openSupplierReport('${s.id}')" style="padding: 5px; margin-right: 5px;" title="Ledger Report"><i data-lucide="file-text" style="width: 14px;"></i></button>
                <button class="btn btn-outline" onclick="editSupplier('${s.id}')" style="padding: 5px; margin-right: 5px;"><i data-lucide="edit-2" style="width: 14px;"></i></button>
                ${sessionStorage.getItem('mediflow_user') === 'VIKI' ? `<button class="btn btn-outline" onclick="deleteSupplier('${s.id}')" style="padding: 5px; color: var(--danger-color);"><i data-lucide="trash" style="width: 14px;"></i></button>` : ''}
            </td>
        `;
        tbody.appendChild(tr);
    });

    lucide.createIcons();
}

function openSupplierModal(id = null) {
    const modal = document.getElementById('supplier-modal');
    const title = document.getElementById('supplier-modal-title');
    const form = document.getElementById('supplier-form');
    
    form.reset();
    document.getElementById('edit-supplier-id').value = '';
    
    if (id) {
        const s = suppliers.find(sup => sup.id === id);
        title.textContent = 'Edit Supplier';
        document.getElementById('edit-supplier-id').value = s.id;
        document.getElementById('s-name').value = s.name;
        document.getElementById('s-person').value = s.person || '';
        document.getElementById('s-phone').value = s.phone || '';
        document.getElementById('s-email').value = s.email || '';
        document.getElementById('s-gstin').value = s.gstin || '';
        document.getElementById('s-address').value = s.address || '';
    } else {
        title.textContent = 'Add New Supplier';
    }
    
    modal.style.display = 'flex';
}

function closeSupplierModal() {
    document.getElementById('supplier-modal').style.display = 'none';
}

function handleSupplierSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('edit-supplier-id').value;
    
    const supplierData = {
        name: document.getElementById('s-name').value.trim(),
        person: document.getElementById('s-person').value.trim(),
        phone: document.getElementById('s-phone').value.trim(),
        email: document.getElementById('s-email').value.trim(),
        gstin: document.getElementById('s-gstin').value.trim(),
        address: document.getElementById('s-address').value.trim()
    };

    if (id) {
        const index = suppliers.findIndex(s => s.id === id);
        suppliers[index] = { ...suppliers[index], ...supplierData };
    } else {
        supplierData.id = 'SUP' + Date.now();
        suppliers.push(supplierData);
    }

    localStorage.setItem('mediflow_suppliers', JSON.stringify(suppliers));
    closeSupplierModal();
    renderSuppliers();
    if (activeSection === 'purchase') renderSupplierDropdown();
}

function deleteSupplier(id) {
    if (confirm('Are you sure you want to delete this supplier?')) {
        suppliers = suppliers.filter(s => s.id !== id);
        localStorage.setItem('mediflow_suppliers', JSON.stringify(suppliers));
        renderSuppliers();
        if (activeSection === 'purchase') renderSupplierDropdown();
    }
}

function editSupplier(id) {
    openSupplierModal(id);
}

function renderSupplierDropdown() {
    const sSelect = document.getElementById('pur-supplier');
    if (!sSelect) return;
    const currentVal = sSelect.value;
    
    sSelect.innerHTML = '<option value="">Select Supplier (Optional)</option>' + 
        suppliers.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
        
    // Keep selection if exists
    if (suppliers.some(s => s.name === currentVal)) {
        sSelect.value = currentVal;
    }
}

// --- Supplier Payments & Ledger ---
function openSupplierPaymentModal(id) {
    const s = suppliers.find(sup => sup.id === id);
    if (!s) return;

    document.getElementById('spay-supplier-id').value = s.id;
    document.getElementById('spay-supplier-name').value = s.name;
    document.getElementById('spay-amount').value = '';
    document.getElementById('supplier-payment-modal').style.display = 'flex';
}

function closeSupplierPaymentModal() {
    document.getElementById('supplier-payment-modal').style.display = 'none';
}

function handleSupplierPaymentSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('spay-supplier-id').value;
    const amount = parseFloat(document.getElementById('spay-amount').value);
    const method = document.getElementById('spay-method').value;

    const s = suppliers.find(sup => sup.id === id);
    if (s && amount > 0) {
        supplierPayments.push({
            id: 'SP' + Date.now(),
            supplierId: s.id,
            supplierName: s.name,
            amount: amount,
            method: method,
            date: new Date().toISOString()
        });

        localStorage.setItem('mediflow_supplier_payments', JSON.stringify(supplierPayments));
        
        closeSupplierPaymentModal();
        renderSuppliers();
        alert(`Payment of ${settings.currency}${amount} to ${s.name} recorded!`);
    }
}

function openSupplierReport(id) {
    const s = suppliers.find(sup => sup.id === id);
    if (!s) return;

    document.getElementById('report-supplier-name').textContent = s.name;
    document.getElementById('report-supplier-phone').textContent = `Ph: ${s.phone} ${s.gstin ? ' | GSTIN: ' + s.gstin : ''}`;

    const tbody = document.querySelector('#supplier-ledger-table tbody');
    tbody.innerHTML = '';

    // Collect transactions
    const transactions = [];
    
    // 1. Add Purchases
    purchases.forEach(p => {
        if (p.supplier === s.name) {
            transactions.push({
                date: new Date(p.date),
                desc: 'Purchase',
                ref: `Inv: ${p.invoice || '-'}`,
                debit: parseFloat(p.total) || 0,
                credit: 0
            });
        }
    });

    // 2. Add Payments
    supplierPayments.forEach(p => {
        if (p.supplierId === s.id) {
            transactions.push({
                date: new Date(p.date),
                desc: 'Payment',
                ref: p.method,
                debit: 0,
                credit: parseFloat(p.amount) || 0
            });
        }
    });

    // Sort by date ascending
    transactions.sort((a, b) => a.date - b.date);

    let runningBalance = 0;
    
    if (transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 1.5rem; color: var(--text-muted);">No transactions found for this supplier.</td></tr>';
        document.getElementById('report-supplier-balance').textContent = `${settings.currency}0.00`;
        document.getElementById('supplier-report-modal').style.display = 'flex';
        return;
    }

    transactions.forEach(t => {
        runningBalance += t.debit;
        runningBalance -= t.credit;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${t.date.toLocaleDateString()}</td>
            <td>${t.desc}</td>
            <td>${t.ref}</td>
            <td style="text-align: right;">${t.debit > 0 ? settings.currency + t.debit.toFixed(2) : '-'}</td>
            <td style="text-align: right; color: var(--success-color);">${t.credit > 0 ? settings.currency + t.credit.toFixed(2) : '-'}</td>
            <td style="text-align: right; font-weight: bold;">${settings.currency}${runningBalance.toFixed(2)}</td>
        `;
        tbody.appendChild(tr);
    });

    const isOwe = runningBalance > 0;
    const balanceColor = isOwe ? 'var(--danger-color)' : (runningBalance < 0 ? 'var(--success-color)' : 'var(--text-color)');
    
    const balanceEl = document.getElementById('report-supplier-balance');
    balanceEl.textContent = `${settings.currency}${Math.abs(runningBalance).toFixed(2)} ${runningBalance < 0 ? '(Advance)' : ''}`;
    balanceEl.style.color = balanceColor;

    document.getElementById('supplier-report-modal').style.display = 'flex';
}

function closeSupplierReport() {
    document.getElementById('supplier-report-modal').style.display = 'none';
}

function printSupplierReport() {
    const sName = document.getElementById('report-supplier-name').textContent;
    const sPhone = document.getElementById('report-supplier-phone').textContent;
    const balance = document.getElementById('report-supplier-balance').textContent;
    const tableHTML = document.getElementById('supplier-ledger-table').outerHTML;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>Supplier Report - ${sName}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                h1 { margin-bottom: 5px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f4f4f4; }
                .right { text-align: right; }
                @media print {
                    button { display: none; }
                }
            </style>
        </head>
        <body>
            <h1>${settings.shopName}</h1>
            <h2>Supplier Ledger Report</h2>
            <p><strong>Supplier:</strong> ${sName}<br>
            ${sPhone}<br>
            <strong>Date:</strong> ${new Date().toLocaleString()}</p>
            <h3 style="color: ${document.getElementById('report-supplier-balance').style.color};">Current Balance: ${balance}</h3>
            ${tableHTML}
            <br>
            <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px; cursor: pointer;">Print Report</button>
        </body>
        </html>
    `);
    printWindow.document.close();
}

function sendWhatsAppBill(saleId) {
    const sale = sales.find(s => s.id === saleId);
    if (!sale) return;

    let message = `*${settings.shopName.toUpperCase()} - INVOICE*\n`;
    message += `Inv: #${sale.invoiceNo} | Date: ${new Date(sale.date).toLocaleDateString()}\n`;
    message += `Cust: ${sale.customer.name}\n\n`;

    sale.items.forEach(item => {
        message += `• ${item.name} (${item.qty} x ${item.salePrice}) = *${settings.currency}${(item.qty * item.salePrice).toFixed(2)}*\n`;
    });

    let subInfo = `\nGST: ${settings.currency}${sale.gst.toFixed(2)}`;
    if (sale.discount > 0) subInfo += ` | Disc: ${settings.currency}${sale.discount.toFixed(2)}`;
    message += `${subInfo}\n`;
    message += `*TOTAL: ${settings.currency}${sale.grandTotal.toFixed(2)} (${sale.paymentMode || 'Cash'})*\n\n`;
    message += `Thank you for choosing ${settings.shopName}! 🙏`;

    const phoneNumber = sale.customer.phone.replace(/\D/g, '');
    const cleanPhone = (phoneNumber.startsWith('91') || phoneNumber.length === 0) ? phoneNumber : '91' + phoneNumber;
    if (cleanPhone === '') {
        alert('No valid phone number found for this customer!');
        return;
    }
    
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
}

function openPaymentModal(customerId) {
    const c = customers.find(cust => cust.id === customerId);
    if (!c) return;

    document.getElementById('pay-customer-id').value = c.id;
    document.getElementById('pay-customer-name').value = c.name;
    document.getElementById('pay-amount').value = '';
    document.getElementById('payment-modal').style.display = 'flex';
}

function closePaymentModal() {
    document.getElementById('payment-modal').style.display = 'none';
}

function handlePaymentSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('pay-customer-id').value;
    const amount = parseFloat(document.getElementById('pay-amount').value);
    const method = document.getElementById('pay-method').value;

    const c = customers.find(cust => cust.id === id);
    if (c && amount > 0) {
        customerPayments.push({
            id: 'P' + Date.now(),
            customerId: c.id,
            customerName: c.name,
            customerPhone: c.phone,
            amount: amount,
            method: method,
            date: new Date().toISOString()
        });

        localStorage.setItem('mediflow_customer_payments', JSON.stringify(customerPayments));
        
        // Record as a "Sales Entry" or just let the ledger handle it.
        // Actually, let's keep it separate for the ledger.
        
        closePaymentModal();
        renderCustomers();
        alert(`Payment of ${settings.currency}${amount} recorded for ${c.name}`);
    }
}

// --- Admin Management ---
function openAdminModal() {
    if (sessionStorage.getItem('mediflow_user') !== 'VIKI') {
        alert('Access Denied: Only the Super Admin (VIKI) can create new Accounts.');
        return;
    }
    document.getElementById('admin-user').value = '';
    document.getElementById('admin-pass').value = '';
    const roleSelect = document.getElementById('admin-role');
    if (roleSelect) roleSelect.value = 'staff';
    document.getElementById('admin-modal').style.display = 'flex';
}

function closeAdminModal() {
    document.getElementById('admin-modal').style.display = 'none';
}

function handleAdminSubmit(e) {
    e.preventDefault();
    
    if (sessionStorage.getItem('mediflow_user') !== 'VIKI') {
        alert('Only the Super Admin (VIKI) can create new user accounts.');
        return;
    }

    const user = document.getElementById('admin-user').value;
    const pass = document.getElementById('admin-pass').value;
    const roleSelect = document.getElementById('admin-role');
    const role = roleSelect ? roleSelect.value : 'staff';

    if (admins.some(a => a.username === user)) {
        alert('Username already exists!');
        return;
    }

    admins.push({
        id: 'A' + Date.now(),
        username: user,
        password: pass,
        role: role
    });

    localStorage.setItem('mediflow_admins', JSON.stringify(admins));
    closeAdminModal();
    renderAdmins();
    alert('Account created successfully!');
    syncToCloud('admins', { data: admins });
}

function renderAdmins() {
    const tbody = document.querySelector('#admins-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    // Always render the Super Admin first
    const trSuper = document.createElement('tr');
    trSuper.innerHTML = `
        <td><strong>VIKI</strong></td>
        <td><span class="badge" style="background: var(--warning-color); color: white;">Super Admin</span></td>
        <td><span style="font-size: 0.8rem; color: var(--text-muted);">Root Account (Cannot be modified)</span></td>
    `;
    tbody.appendChild(trSuper);

    if (admins.length === 0) {
        const emptyTr = document.createElement('tr');
        emptyTr.innerHTML = '<td colspan="3" style="text-align: center; padding: 1.5rem; color: var(--text-muted);">No additional staff or admin accounts found. Click "Create New User" to add one.</td>';
        tbody.appendChild(emptyTr);
    } else {
        admins.forEach(a => {
            const tr = document.createElement('tr');
            const badgeStyle = a.role === 'admin' ? 'background: var(--primary-light); color: var(--primary-color);' : 'background: #e2e8f0; color: #475569;';
            const displayRole = a.role === 'admin' ? 'Admin' : 'Staff';
            
            tr.innerHTML = `
                <td>${a.username}</td>
                <td><span class="badge" style="${badgeStyle}">${displayRole}</span></td>
                <td>
                    <button class="btn btn-outline" onclick="deleteAdmin('${a.id}')" style="padding: 5px; color: var(--danger-color);"><i data-lucide="trash" style="width: 14px;"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
    lucide.createIcons();
}

function deleteAdmin(id) {
    if (sessionStorage.getItem('mediflow_user') !== 'VIKI') {
        alert('Only the Super Admin (VIKI) can delete accounts.');
        return;
    }
    if (confirm('Are you sure you want to delete this account?')) {
        admins = admins.filter(a => a.id !== id);
        localStorage.setItem('mediflow_admins', JSON.stringify(admins));
        renderAdmins();
        syncToCloud('admins', { data: admins });
    }
}
