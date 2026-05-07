// V-BILLING POS - Core Logic

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
    shopName: 'V-BILLING Pharma',
    shopAddress: '123 Medical Street, City Center',
    shopPhone: '+91 9876543210',
    shopLogo: '',
    printerType: '3inch',
    gstDefault: true,
    currency: '₹',
    licenses: []
};
let purchases = JSON.parse(localStorage.getItem('mediflow_purchases')) || [];
let expenses = JSON.parse(localStorage.getItem('mediflow_expenses')) || [];
let categories = JSON.parse(localStorage.getItem('mediflow_categories')) || ['Tablet', 'Syrup', 'Injection', 'Capsule', 'Ointment', 'Other'];
let units = JSON.parse(localStorage.getItem('mediflow_units')) || ['PCS', 'STRIP', 'BOX', 'KG', 'GRM', 'ML', 'LIT'];
let expenseCategories = JSON.parse(localStorage.getItem('mediflow_expense_categories')) || ['Rent', 'Electricity', 'Salary', 'Maintenance', 'Other'];
let customers = JSON.parse(localStorage.getItem('mediflow_customers')) || [];
let customerPayments = JSON.parse(localStorage.getItem('mediflow_customer_payments')) || [];
let suppliers = JSON.parse(localStorage.getItem('mediflow_suppliers')) || [];
let supplierPayments = JSON.parse(localStorage.getItem('mediflow_supplier_payments')) || [];
let doctors = JSON.parse(localStorage.getItem('mediflow_doctors')) || [];
let currentSection = 'dashboard';
let branches = JSON.parse(localStorage.getItem('mediflow_branches')) || [{ id: 'main', name: 'Main Branch', settings: {} }];
let currentBranch = sessionStorage.getItem('mediflow_current_branch') || 'main';
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
            console.log("V-BILLING Cloud Connected");
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
        const collections = ['branches', 'products', 'sales', 'settings', 'purchases', 'expenses', 'customers', 'suppliers', 'admins', 'supplierPayments', 'customerPayments', 'categories', 'expenseCategories'];

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
                    let arrayData = cloudData || [];
                    // Safely unwrap if it was accidentally saved as {data: [...]} 
                    if (!Array.isArray(arrayData) && arrayData.data && Array.isArray(arrayData.data)) {
                        arrayData = arrayData.data;
                    }

                    if (arrayData.length > 0) {
                        if (col === 'products') products = arrayData;
                        else if (col === 'sales') sales = arrayData;
                        else if (col === 'purchases') purchases = arrayData;
                        else if (col === 'expenses') expenses = arrayData;
                        else if (col === 'customers') customers = arrayData;
                        else if (col === 'suppliers') suppliers = arrayData;
                        else if (col === 'admins') admins = arrayData;
                        else if (col === 'supplierPayments') supplierPayments = arrayData;
                        else if (col === 'customerPayments') customerPayments = arrayData;
                        else if (col === 'categories') categories = arrayData;
                        else if (col === 'expenseCategories') expenseCategories = arrayData;
                        else if (col === 'branches') branches = arrayData;

                        // Special names for localStorage
                        let localKey = 'mediflow_' + (col === 'supplierPayments' ? 'supplier_payments' : (col === 'customerPayments' ? 'customer_payments' : (col === 'expenseCategories' ? 'expense_categories' : col)));
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

    const btn = document.getElementById('cloud-backup-btn');
    const originalText = btn ? btn.innerHTML : '';

    try {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i data-lucide="loader" class="spin"></i> Backing up...';
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }

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
        await syncToCloud('admins', admins);
        await syncToCloud('categories', categories);
        await syncToCloud('expenseCategories', expenseCategories);
        await syncToCloud('branches', branches);

        alert('All local data successfully backed up to Firebase Cloud!');
    } catch (e) {
        console.error('Backup failed:', e);
        alert('Cloud Backup Failed! Check your internet connection. ' + e.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }
}

let activeSection = 'dashboard';
let currentPayMode = 'Cash';

// --- Auto-Backup Interceptor ---
const originalSetItem = localStorage.setItem;
localStorage.setItem = function (key, value) {
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
            'mediflow_customer_payments': 'customerPayments',
            'mediflow_categories': 'categories',
            'mediflow_expense_categories': 'expenseCategories',
            'mediflow_branches': 'branches'
        };

        if (keyMap[key]) {
            try {
                const payload = (key === 'mediflow_settings') ? JSON.parse(value) : { data: JSON.parse(value) };
                syncToCloud(keyMap[key], payload);
            } catch (e) {
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
            renderBranchSwitcher();
        } else {
            const foundUser = admins.find(a => a.username === loggedInUsername);
            if (foundUser) {
                actualRole = foundUser.role;
                if (foundUser.branchId) {
                    currentBranch = foundUser.branchId;
                    sessionStorage.setItem('mediflow_current_branch', currentBranch);
                }
            }
        }

        const isSuperAdmin = (actualRole === 'superadmin');

        const switcher = document.getElementById('branch-switcher-container');
        if (switcher) switcher.style.display = isSuperAdmin ? 'flex' : 'none';

        const branchAdminSection = document.getElementById('superadmin-branches-section');
        if (branchAdminSection) branchAdminSection.style.display = isSuperAdmin ? 'block' : 'none';

        const featuresSection = document.getElementById('superadmin-features-section');
        if (featuresSection) featuresSection.style.display = isSuperAdmin ? 'block' : 'none';

        const unitsSection = document.getElementById('superadmin-units-section');
        if (unitsSection) unitsSection.style.display = isSuperAdmin ? 'block' : 'none';

        const amcSection = document.getElementById('superadmin-amc-section');
        if (amcSection) amcSection.style.display = isSuperAdmin ? 'block' : 'none';

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
            navUsers.style.display = (actualRole === 'superadmin' || actualRole === 'admin') ? 'flex' : 'none';
        }

        // Ensure create button is strictly visible only to VIKI
        const createUserBtn = document.getElementById('create-user-btn');
        if (createUserBtn) {
            createUserBtn.style.display = (actualRole === 'superadmin' || actualRole === 'admin') ? 'inline-flex' : 'none';
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
            const loginTime = new Date().toISOString();
            sessionStorage.setItem('mediflow_login_time', loginTime);
            try { recordSessionLog('login', 'VIKI', loginTime); } catch (e) { console.error(e); }
            checkLoginStatus();
            return;
        }

        // Check Other Admins
        const found = admins.find(a => a.username === user && a.password === pass);
        if (found) {
            sessionStorage.setItem('mediflow_logged_in', 'true');
            sessionStorage.setItem('mediflow_user', user);
            const loginTime = new Date().toISOString();
            sessionStorage.setItem('mediflow_login_time', loginTime);
            try { recordSessionLog('login', user, loginTime); } catch (e) { console.error(e); }
            checkLoginStatus();
        } else {
            error.style.display = 'block';
            setTimeout(() => { error.style.display = 'none'; }, 3000);
        }
    });
}

function initApp() {
    try {
        // Synchronize context settings with active branch
        const activeBranchData = branches.find(b => b.id === currentBranch);
        if (activeBranchData && activeBranchData.settings) {
            settings = activeBranchData.settings;
        }
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
        renderBranches();
        if (sessionStorage.getItem('mediflow_user') === 'VIKI') {
            renderBranchSwitcher();
        }
        renderDashboard();
        renderProducts();
        renderSalesHistory();
        renderPurchases();
        renderExpenses();
        renderCategoryManagement();
        renderUnitManagement();
        renderExpenseCategoryManagement();
        renderCustomers();
        renderSuppliers();
        renderDoctors();
        updateDoctorDropdown();
        renderCartTabs();
        loadSettings();
        applyFeatureToggles();

        // Setup Auto Daily Local Backup Interval
        setTimeout(checkAndRunAutoBackup, 5000);
        setInterval(checkAndRunAutoBackup, 15 * 60 * 1000);

        lucide.createIcons();
        checkSubscriptionLock();
    } catch (error) {
        console.error('App initialization error:', error);
    }
}

function applyFeatureToggles() {
    const enableDocs = !!settings.enableDoctors;
    const docNav = document.querySelector('[data-section="doctors"]');
    if (docNav) {
        docNav.style.display = enableDocs ? 'flex' : 'none';
    }
    const docSelectGroup = document.getElementById('doctor-select-group');
    if (docSelectGroup) {
        docSelectGroup.style.display = enableDocs ? 'block' : 'none';
    }
    if (!enableDocs && activeSection === 'doctors') {
        switchSection('dashboard');
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
            'set-currency': settings.currency,
            'set-amc-plan': settings.amcPlan,
            'set-amc-expiry': settings.amcExpiry
        };

        for (const [id, val] of Object.entries(fields)) {
            const el = document.getElementById(id);
            if (el) el.value = val || '';
        }

        const logoPreview = document.getElementById('logo-preview');
        if (logoPreview) {
            if (settings.shopLogo) {
                logoPreview.src = settings.shopLogo;
                logoPreview.style.display = 'block';
            } else {
                logoPreview.style.display = 'none';
                logoPreview.src = '';
            }
        }

        const gstEl = document.getElementById('set-gst-default');
        if (gstEl) gstEl.checked = !!settings.gstDefault;

        // Render licenses
        const container = document.getElementById('licenses-container');
        if (container) {
            container.innerHTML = '';
            const licenseList = Array.isArray(settings.licenses) ? settings.licenses : [];
            if (licenseList.length === 0) {
                addLicenseField();
            } else {
                licenseList.forEach(lic => addLicenseField(lic));
            }
        }

        const enableDocEl = document.getElementById('set-enable-doctors');
        if (enableDocEl) enableDocEl.checked = !!settings.enableDoctors;

        // Apply currency to UI
        document.querySelectorAll('.currency-symbol').forEach(el => el.textContent = settings.currency || '₹');

        // WhatsApp Float
        const waBtn = document.getElementById('whatsapp-float');
        if (waBtn) {
            const shopNameStr = settings.shopName ? settings.shopName : 'your system';
            const message = encodeURIComponent(`Hello, I am contacting you regarding ${shopNameStr}.`);
            waBtn.href = `https://wa.me/919360039283?text=${message}`;
        }
        updateSubscriptionBadge();
    } catch (e) {
        console.error('Error loading settings:', e);
    }
}

function updateSubscriptionBadge() {
    const badge = document.getElementById('subscription-badge');
    const span = document.getElementById('subscription-days');
    if (!badge || !span) return;

    if (!settings.amcExpiry || currentBranch === 'all') {
        badge.style.display = 'none';
        return;
    }

    const expiryParts = settings.amcExpiry.split('-').map(Number);
    const expiry = new Date(expiryParts[0], expiryParts[1] - 1, expiryParts[2]);
    expiry.setHours(23, 59, 59, 999);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    badge.style.display = 'flex';
    badge.title = `Plan: ${settings.amcPlan || 'N/A'} | Expiry: ${settings.amcExpiry}`;

    if (diffDays < 0) {
        span.textContent = 'Expired';
        badge.style.background = '#fee2e2';
        badge.style.color = '#991b1b';
    } else if (diffDays <= 7) {
        span.textContent = `${diffDays} days left`;
        badge.style.background = '#ffedd5';
        badge.style.color = '#9a3412';
    } else {
        span.textContent = `${diffDays} days left`;
        badge.style.background = '#fef9c3';
        badge.style.color = '#854d0e';
    }
    return diffDays;
}

function checkSubscriptionLock() {
    const isVicki = sessionStorage.getItem('mediflow_user') === 'VIKI';
    const daysLeft = updateSubscriptionBadge();
    const overlay = document.getElementById('expiry-lock-overlay');
    if (!overlay) return;

    if (daysLeft < 0 && currentBranch !== 'all') {
        overlay.style.display = 'flex';
        const branchName = document.getElementById('lock-branch-name');
        if (branchName) {
            const b = branches.find(br => br.id === currentBranch);
            branchName.textContent = b ? b.name : 'this branch';
        }

        const settingsBtn = document.getElementById('lock-settings-btn');
        if (settingsBtn) {
            settingsBtn.style.display = isVicki ? 'block' : 'none';
            settingsBtn.onclick = () => {
                overlay.style.display = 'none';
                switchSection('settings');
            };
        }

        const logoutBtn = document.getElementById('lock-logout-btn');
        if (logoutBtn) {
            logoutBtn.onclick = () => {
                sessionStorage.removeItem('mediflow_logged_in');
                sessionStorage.removeItem('mediflow_user');
                location.reload();
            };
        }
    } else {
        overlay.style.display = 'none';
    }
}

// --- Navigation ---
function switchSection(sectionId) {
    currentSection = sectionId;
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

    // Update Branch Name in Header
    const headerBranch = document.getElementById('header-branch-name');
    if (headerBranch) {
        const b = branches.find(br => br.id === currentBranch);
        headerBranch.textContent = b ? b.name : (currentBranch === 'all' ? 'All Branches (Global)' : 'Main Branch');
    }

    // Specific actions
    if (sectionId === 'dashboard') renderDashboard();
    if (sectionId === 'products') renderProducts();
    if (sectionId === 'customers') renderCustomers();
    if (sectionId === 'suppliers') renderSuppliers();
    if (sectionId === 'sales') renderSalesHistory();
    if (sectionId === 'purchase') {
        renderProductDropdown();
        renderSupplierDropdown();
        renderPurchases();
    }
    if (sectionId === 'expenses') renderExpenses();
    if (sectionId === 'reports') renderReports();
    if (sectionId === 'billing') {
        document.getElementById('billing-search').focus();
        generateInvoiceNumber();
        // Set GST default from settings
        document.getElementById('gst-toggle').checked = settings.gstDefault;
    }
}

// --- Event Listeners ---
function setupEventListeners() {
    const globalBranchSel = document.getElementById('global-branch-selector');
    if (globalBranchSel) {
        globalBranchSel.addEventListener('change', (e) => {
            currentBranch = e.target.value;
            sessionStorage.setItem('mediflow_current_branch', currentBranch);
            const selectedBranch = branches.find(b => b.id === currentBranch);
            if (selectedBranch && selectedBranch.settings) {
                settings = selectedBranch.settings;
                localStorage.setItem('mediflow_settings', JSON.stringify(settings));
                syncToCloud('settings', settings);
            }
            initApp();
        });
    }

    // Sidebar Navigation
    document.querySelectorAll('.nav-item[data-section]').forEach(item => {
        item.addEventListener('click', () => switchSection(item.dataset.section));
    });

    // Logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            const user = sessionStorage.getItem('mediflow_user');
            if (user) recordSessionLog('logout', user, new Date().toISOString());
            sessionStorage.clear();
            window.location.reload();
        });
    }

    // Logout for expired session
    const lockLogoutBtn = document.getElementById('lock-logout-btn');
    if (lockLogoutBtn) {
        lockLogoutBtn.addEventListener('click', () => {
            const user = sessionStorage.getItem('mediflow_user');
            if (user) recordSessionLog('logout', user, new Date().toISOString());
            sessionStorage.clear();
            window.location.reload();
        });
    }

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

    // Logo Upload Logic
    const logoUpload = document.getElementById('logo-upload');
    const setShopLogo = document.getElementById('set-shop-logo');
    const logoPreview = document.getElementById('logo-preview');

    if (logoUpload && setShopLogo && logoPreview) {
        logoUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const img = new Image();
                    img.src = event.target.result;
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        const MAX_WIDTH = 200;
                        const MAX_HEIGHT = 200;
                        let width = img.width;
                        let height = img.height;

                        if (width > height) {
                            if (width > MAX_WIDTH) {
                                height *= MAX_WIDTH / width;
                                width = MAX_WIDTH;
                            }
                        } else {
                            if (height > MAX_HEIGHT) {
                                width *= MAX_HEIGHT / height;
                                height = MAX_HEIGHT;
                            }
                        }

                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);
                        const optimizedBase64 = canvas.toDataURL('image/png', 0.7);

                        setShopLogo.value = optimizedBase64;
                        logoPreview.src = optimizedBase64;
                        logoPreview.style.display = 'block';
                    };
                };
                reader.readAsDataURL(file);
            }
        });

        setShopLogo.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            if (val) {
                logoPreview.src = val;
                logoPreview.style.display = 'block';
            } else {
                logoPreview.style.display = 'none';
                logoPreview.src = '';
            }
        });
    }

    // Settings Form
    document.getElementById('settings-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const isVicki = sessionStorage.getItem('mediflow_user') === 'VIKI';

        const enableDoctorsVal = isVicki ? document.getElementById('set-enable-doctors').checked : !!settings.enableDoctors;

        const licenseInputs = document.querySelectorAll('.license-input');
        const licenseList = Array.from(licenseInputs).map(input => input.value.trim()).filter(v => v !== '');

        settings = {
            shopName: document.getElementById('set-shop-name').value,
            shopAddress: document.getElementById('set-shop-address').value,
            shopPhone: document.getElementById('set-shop-phone').value,
            shopLogo: document.getElementById('set-shop-logo').value,
            printerType: document.getElementById('set-printer-type').value,
            gstDefault: document.getElementById('set-gst-default').checked,
            currency: document.getElementById('set-currency').value,
            amcPlan: isVicki ? document.getElementById('set-amc-plan').value : (settings.amcPlan || 'Trial'),
            amcExpiry: isVicki ? document.getElementById('set-amc-expiry').value : (settings.amcExpiry || ''),
            enableDoctors: enableDoctorsVal,
            licenses: licenseList
        };
        localStorage.setItem('mediflow_settings', JSON.stringify(settings));
        await syncToCloud('settings', settings);



        const bIndex = branches.findIndex(b => b.id === currentBranch);
        if (bIndex > -1) {
            branches[bIndex].settings = settings;
        }

        localStorage.setItem('mediflow_branches', JSON.stringify(branches));
        await syncToCloud('branches', branches);

        alert('Settings saved successfully!');
        initApp(); // Refresh to apply changes
    });

    // Purchase Form
    document.getElementById('purchase-form').addEventListener('submit', handlePurchaseSubmit);

    // Expense Form
    document.getElementById('expense-form').addEventListener('submit', handleExpenseSubmit);

    // Admin Form
    document.getElementById('admin-form').addEventListener('submit', handleAdminSubmit);

    // Doctor Form
    const docForm = document.getElementById('doctor-form');
    if (docForm) docForm.addEventListener('submit', handleDoctorSubmit);

    // Logout
    document.getElementById('logout-btn').addEventListener('click', () => {
        if (confirm('Are you sure you want to logout?')) {
            sessionStorage.removeItem('mediflow_logged_in');
            sessionStorage.removeItem('mediflow_user');
            checkLoginStatus();
        }
    });

    // AMC Plan Auto-fill
    const amcPlanSelect = document.getElementById('set-amc-plan');
    if (amcPlanSelect) {
        amcPlanSelect.addEventListener('change', (e) => {
            const plan = e.target.value;
            const expiryInput = document.getElementById('set-amc-expiry');
            const customGroup = document.getElementById('amc-custom-days-group');
            if (!expiryInput) return;

            if (customGroup) customGroup.style.display = plan === 'Custom' ? 'block' : 'none';

            let date = new Date();
            if (plan === 'Trial') {
                date.setDate(date.getDate() + 15);
            } else if (plan === 'Basic') {
                date.setFullYear(date.getFullYear() + 1);
            } else if (plan === 'Professional') {
                date.setFullYear(date.getFullYear() + 2);
            } else if (plan === 'Premium') {
                date.setFullYear(date.getFullYear() + 99);
            } else if (plan === 'Custom') {
                const customInput = document.getElementById('set-amc-custom-days');
                const days = customInput ? parseInt(customInput.value) || 0 : 0;
                date.setDate(date.getDate() + days);
            }

            expiryInput.value = date.toISOString().split('T')[0];
            calculateAMCCost();
        });

        const customDaysInput = document.getElementById('set-amc-custom-days');
        if (customDaysInput) {
            customDaysInput.addEventListener('input', () => {
                amcPlanSelect.dispatchEvent(new Event('change'));
            });
        }
    }

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

// --- Branch Management ---
function updateUnitDropdowns() {
    const pUnitSelect = document.getElementById('p-unit');
    if (pUnitSelect) {
        const currentVal = pUnitSelect.value;
        pUnitSelect.innerHTML = units.map(u => `<option value="${u}">${u}</option>`).join('');
        if (units.includes(currentVal)) pUnitSelect.value = currentVal;
    }
}

function renderUnitManagement() {
    const list = document.getElementById('unit-list');
    if (!list) return;
    list.innerHTML = '';
    units.forEach(u => {
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.style.background = '#f1f5f9';
        badge.style.color = '#64748b';
        badge.innerHTML = `${u} <i data-lucide="x" style="cursor:pointer; width:12px; margin-left:5px;" onclick="deleteUnit('${u}')"></i>`;
        list.appendChild(badge);
    });
    updateUnitDropdowns();
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function addUnit() {
    const input = document.getElementById('new-unit-name');
    const val = input.value.trim().toUpperCase();
    if (val && !units.includes(val)) {
        units.push(val);
        localStorage.setItem('mediflow_units', JSON.stringify(units));
        syncToCloud('units', units);
        input.value = '';
        renderUnitManagement();
        alert('Unit added!');
    }
}

function deleteUnit(u) {
    if (confirm(`Delete unit "${u}"?`)) {
        units = units.filter(item => item !== u);
        localStorage.setItem('mediflow_units', JSON.stringify(units));
        syncToCloud('units', units);
        renderUnitManagement();
    }
}

function renderBranchSwitcher() {
    const sel = document.getElementById('global-branch-selector');
    const adminSel = document.getElementById('admin-branch');
    if (sel) {
        sel.innerHTML = '<option value="all">-- All Branches (Global) --</option>';
        branches.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.id;
            opt.textContent = b.name;
            sel.appendChild(opt);
        });
        sel.value = currentBranch;
    }
    if (adminSel) {
        adminSel.innerHTML = '';
        branches.forEach(b => {
            const opt2 = document.createElement('option');
            opt2.value = b.id;
            opt2.textContent = b.name;
            adminSel.appendChild(opt2);
        });
        const exInput = document.getElementById('set-amc-expiry');
        if (exInput) exInput.addEventListener('change', calculateAMCCost);
    }
}

function calculateAMCCost() {
    const expiryInput = document.getElementById('set-amc-expiry');
    const costDisplay = document.getElementById('amc-total-cost');
    if (!expiryInput || !costDisplay || !expiryInput.value) return;
    const parts = expiryInput.value.split('-').map(Number);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(parts[0], parts[1] - 1, parts[2]);
    const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
    const plan = document.getElementById('set-amc-plan') ? document.getElementById('set-amc-plan').value : '';

    if (plan === 'Premium') {
        costDisplay.textContent = `₹30,000`;
    } else if (diffDays > 0) {
        costDisplay.textContent = `₹${(diffDays * 35).toLocaleString('en-IN')}`;
    } else {
        costDisplay.textContent = `₹0`;
    }
}

function renderBranches() {
    const list = document.getElementById('branch-list');
    if (!list) return;
    list.innerHTML = '';
    branches.forEach(b => {
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.style.display = 'inline-flex';
        badge.style.alignItems = 'center';
        badge.style.gap = '5px';
        badge.style.background = 'var(--primary-light)';
        badge.style.color = 'var(--primary-color)';
        badge.style.fontSize = '0.9rem';
        badge.style.padding = '0.5rem 1rem';

        let deleteBtn = '';
        let editBtn = '';
        if (b.id !== 'main') {
            deleteBtn = `<i data-lucide="x" style="cursor:pointer; width:14px; color: var(--danger-color);" onclick="deleteBranch('${b.id}')" title="Delete Branch"></i>`;
        }
        editBtn = `<i data-lucide="edit-2" style="cursor:pointer; width:14px; margin-left: 5px;" onclick="editBranchName('${b.id}')" title="Edit Name"></i>`;

        badge.innerHTML = `<i data-lucide="store" style="width:14px;"></i> ${b.name} ${editBtn} ${deleteBtn}`;

        // Show AMC status if available
        if (b.settings && b.settings.amcExpiry) {
            const parts = b.settings.amcExpiry.split('-').map(Number);
            const expiry = new Date(parts[0], parts[1] - 1, parts[2]);
            expiry.setHours(23, 59, 59, 999);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const diff = Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            const amcText = diff < 0 ? 'Expired' : `${diff}d left`;
            const amcColor = diff < 0 ? 'var(--danger-color)' : (diff <= 7 ? 'var(--warning-color)' : '#16a34a');
            badge.innerHTML = `<i data-lucide="store" style="width:14px;"></i> <strong>${b.name}</strong> <span style="font-size: 0.7rem; color: ${amcColor}; margin-left: 5px;">(${amcText})</span> ${editBtn} ${deleteBtn}`;
        }

        list.appendChild(badge);
    });
    if (typeof lucide !== 'undefined') lucide.createIcons();
}



function addBranch() {
    const input = document.getElementById('new-branch-name');
    const val = input.value.trim();
    if (!val) return;
    const id = 'B' + Date.now();
    branches.push({ id, name: val });
    input.value = '';
    localStorage.setItem('mediflow_branches', JSON.stringify(branches));
    syncToCloud('branches', branches);
    renderBranches();
    renderBranchSwitcher();
}

function deleteBranch(id) {
    if (id === 'main') { return alert("Main branch cannot be deleted."); }
    if (confirm('Are you sure you want to delete this branch?')) {
        branches = branches.filter(b => b.id !== id);
        if (currentBranch === id) {
            currentBranch = 'main';
            sessionStorage.setItem('mediflow_current_branch', 'main');
        }
        localStorage.setItem('mediflow_branches', JSON.stringify(branches));
        syncToCloud('branches', branches);
        renderBranches();
        renderBranchSwitcher();
        initApp();
    }
}

function editBranchName(id) {
    const b = branches.find(branch => branch.id === id);
    if (!b) return;

    const newName = prompt('Enter new name for branch:', b.name);
    if (newName === null) return;

    b.name = newName.trim() || b.name;

    const currentExpiry = (b.settings && b.settings.amcExpiry) ? b.settings.amcExpiry : '';
    const newExpiry = prompt('Update Subscription Expiry (YYYY-MM-DD):', currentExpiry);

    if (newExpiry !== null) {
        if (!b.settings) b.settings = {};
        b.settings.amcExpiry = newExpiry.trim();
        // Also update Plan to 'Custom/Updated' if they changed expiry manually here
        b.settings.amcPlan = b.settings.amcPlan || 'Basic';
    }

    localStorage.setItem('mediflow_branches', JSON.stringify(branches));
    syncToCloud('branches', branches);
    renderBranches();
    renderBranchSwitcher();
    initApp();
}

// --- Product Management ---
function renderProducts() {
    try {
        const tbody = document.querySelector('#products-table tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        const branchProducts = products.filter(p => currentBranch === 'all' || !p.branchId || p.branchId === currentBranch);
        branchProducts.forEach(p => {
            const tr = document.createElement('tr');
            const isExpired = new Date(p.expiry) < new Date();
            const isLowStock = p.stock <= 10;

            tr.innerHTML = `
            <td>${p.name}</td>
            <td><span class="badge" style="background: #e2e8f0; color: #475569;">${p.category}</span></td>
            <td><strong>${p.unit || 'PCS'}</strong></td>
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

    // Populate dynamic dropdowns
    updateCategoryDropdowns();
    updateUnitDropdowns();

    if (id) {
        const p = products.find(prod => prod.id === id);
        title.textContent = 'Edit Product';
        document.getElementById('edit-id').value = p.id;
        document.getElementById('p-name').value = p.name;
        document.getElementById('p-barcode').value = p.barcode || '';
        document.getElementById('p-category').value = p.category;
        document.getElementById('p-unit').value = p.unit || 'PCS';
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
        branchId: currentBranch,
        name: document.getElementById('p-name').value,
        barcode: document.getElementById('p-barcode').value,
        category: document.getElementById('p-category').value,
        unit: document.getElementById('p-unit').value,
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

// --- Firebase Duplicate Helpers Cleaned ---

// --- Billing Logic ---
function handleBillingSearch(e) {
    const query = e.target.value.trim().toLowerCase();
    const resultsDiv = document.getElementById('search-results');

    if (query.length < 1) {
        resultsDiv.style.display = 'none';
        return;
    }

    // Check for EXACT barcode match first (Hardware Scanners)
    const branchProducts = products.filter(p => currentBranch === 'all' || !p.branchId || p.branchId === currentBranch);
    const exactMatch = branchProducts.find(p => p.barcode && p.barcode.toLowerCase() === query);
    if (exactMatch) {
        addToCart(exactMatch.id);
        e.target.value = '';
        resultsDiv.style.display = 'none';
        return;
    }

    const filtered = branchProducts.filter(p =>
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
            <td>
                <div style="display: flex; align-items: center; gap: 2px;">
                    <span>${settings.currency}</span>
                    <input type="number" value="${item.salePrice}" step="0.01" 
                        onchange="updatePrice('${item.id}', this.value)" class="form-control qty-input" style="width: 75px; padding: 2px 4px;">
                </div>
            </td>
            <td>
                <input type="number" value="${item.qty}" min="1" max="${item.stock}" 
                    onchange="updateQty('${item.id}', this.value)" class="form-control qty-input">
            </td>
            <td>
                <input type="number" value="${item.gst}" min="0" max="100" 
                    onchange="updateGST('${item.id}', this.value)" class="form-control qty-input" style="width: 55px; padding: 2px 4px;">
            </td>
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

function updateGST(id, val) {
    const item = cart.find(i => i.id === id);
    if (item) {
        item.gst = parseInt(val) || 0;
        updateCartTotals();
        renderCart();
    }
}

function updatePrice(id, val) {
    const item = cart.find(i => i.id === id);
    if (item) {
        item.salePrice = parseFloat(val) || 0;
        updateCartTotals();
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
        customerName: document.getElementById('customer-name').value || 'Cash Customer',
        customerPhone: document.getElementById('customer-phone').value || '',
        doctorName: document.getElementById('doctor-select') ? document.getElementById('doctor-select').value : '',
        items: [...cart],
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

    const rawCustomerName = document.getElementById('customer-name').value.trim();
    const rawCustomerPhone = document.getElementById('customer-phone').value.trim();
    const doctorName = document.getElementById('doctor-select') ? document.getElementById('doctor-select').value : '';

    if (currentPayMode === 'Credit' && (!rawCustomerName || !rawCustomerPhone)) {
        alert('Customer Name and Phone Number are MANDATORY for Credit bills.');
        document.getElementById(!rawCustomerName ? 'customer-name' : 'customer-phone').focus();
        return;
    }

    const customer = {
        name: rawCustomerName || 'Cash Customer',
        phone: rawCustomerPhone || '-'
    };

    const subtotal = parseFloat(document.getElementById('summary-subtotal').textContent.replace(settings.currency, ''));
    const gst = parseFloat(document.getElementById('summary-gst').textContent.replace(settings.currency, ''));
    const discInput = parseFloat(document.getElementById('discount-input').value) || 0;
    const discType = document.getElementById('discount-type').value;

    let discountAmount = discType === 'percent' ? (subtotal + gst) * (discInput / 100) : discInput;
    const grandTotal = subtotal + gst - discountAmount;

    const saleData = {
        id: 'S' + Date.now(),
        branchId: currentBranch,
        invoiceNo,
        customer,
        doctorName,
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

    const licensesEl = document.getElementById('bill-licenses');
    if (licensesEl) {
        if (settings.licenses && settings.licenses.length > 0) {
            licensesEl.innerHTML = settings.licenses.map(lic => `<div>Lic No: ${lic}</div>`).join('');
            licensesEl.style.display = 'block';
        } else {
            licensesEl.style.display = 'none';
        }
    }

    document.getElementById('bill-inv-no').textContent = sale.invoiceNo;
    document.getElementById('bill-date').textContent = new Date(sale.date).toLocaleString();

    // Fix: Handle customer object or name correctly
    const finalCustName = (sale.customer && sale.customer.name) ? sale.customer.name : (sale.customerName || 'Cash Customer');
    document.getElementById('bill-cust-name').textContent = finalCustName;

    if (sale.doctorName) {
        document.getElementById('bill-doc-row').style.display = 'block';
        document.getElementById('bill-doc-name').textContent = sale.doctorName;
    } else {
        document.getElementById('bill-doc-row').style.display = 'none';
    }

    const itemsTbody = document.getElementById('bill-items-body');
    itemsTbody.innerHTML = sale.items.map(item => `
        <tr>
            <td class="col-item">
                <span class="item-name">${item.name}</span>
                ${item.batch ? `<span class="item-meta">Batch: ${item.batch}</span>` : ''}
            </td>
            <td class="col-qty">${item.qty}</td>
            <td class="col-price">${item.salePrice}</td>
            <td class="col-total">${(item.salePrice * item.qty).toFixed(2)}</td>
        </tr>
    `).join('');

    const footerItemCountEl = document.getElementById('bill-footer-item-count');
    if (footerItemCountEl) footerItemCountEl.textContent = sale.items.length;

    document.getElementById('bill-subtotal').textContent = `${settings.currency}${sale.subtotal.toFixed(2)}`;
    const gstRow = document.getElementById('bill-gst-row');
    if (gstRow) {
        if (sale.gst > 0) {
            gstRow.style.display = 'flex';
            document.getElementById('bill-gst').textContent = `${settings.currency}${sale.gst.toFixed(2)}`;
        } else {
            gstRow.style.display = 'none';
        }
    }

    const discountRow = document.getElementById('bill-discount-row');
    if (discountRow) {
        if (sale.discount > 0) {
            discountRow.style.display = 'flex';
            document.getElementById('bill-discount').textContent = `-${settings.currency}${sale.discount.toFixed(2)}`;
        } else {
            discountRow.style.display = 'none';
        }
    }

    document.getElementById('bill-grand-total').textContent = `${settings.currency}${sale.grandTotal.toFixed(2)}`;

    const paymentModeEl = document.getElementById('bill-payment-mode');
    if (paymentModeEl) {
        paymentModeEl.textContent = sale.paymentMode || 'Cash';
    }

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

        let filteredSales = sales.filter(s => currentBranch === 'all' || (s.branchId || 'main') === currentBranch);

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
    if (!select) return;
    select.innerHTML = '<option value="">Select Product</option>';
    const branchProducts = products.filter(p => currentBranch === 'all' || !p.branchId || p.branchId === currentBranch);
    branchProducts.forEach(p => {
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
        branchId: currentBranch,
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
        const branchPurchases = purchases.filter(p => currentBranch === 'all' || !p.branchId || p.branchId === currentBranch);
        branchPurchases.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(p => {
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
        branchId: currentBranch,
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
        const branchExpenses = expenses.filter(e => currentBranch === 'all' || !e.branchId || e.branchId === currentBranch);
        branchExpenses.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(ex => {
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

// --- Doctor Management ---
function renderDoctors() {
    const tbody = document.querySelector('#doctors-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    doctors.forEach(d => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${d.name}</td>
            <td>${d.specialization || '-'}</td>
            <td>
                <button class="btn btn-outline" onclick="deleteDoctor('${d.id}')" style="padding: 5px; color: var(--danger-color);"><i data-lucide="trash" style="width: 14px;"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    if (doctors.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 2rem; color: var(--text-muted);">No doctors added yet.</td></tr>';
    }
    updateDoctorDropdown();
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function handleDoctorSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('doc-name').value.trim();
    const spec = document.getElementById('doc-spec').value.trim();

    if (name) {
        doctors.push({
            id: 'DOC' + Date.now(),
            name: name,
            specialization: spec,
            branchId: currentBranch
        });
        localStorage.setItem('mediflow_doctors', JSON.stringify(doctors));
        syncToCloud('doctors', doctors);
        e.target.reset();
        renderDoctors();
        alert('Doctor added to list!');
    }
}

function deleteDoctor(id) {
    if (confirm('Are you sure you want to delete this doctor?')) {
        doctors = doctors.filter(d => d.id !== id);
        localStorage.setItem('mediflow_doctors', JSON.stringify(doctors));
        syncToCloud('doctors', doctors);
        renderDoctors();
    }
}

function updateDoctorDropdown() {
    const sel = document.getElementById('doctor-select');
    if (sel) {
        const currentVal = sel.value;
        sel.innerHTML = '<option value="">Select Doctor (Optional)</option>' +
            doctors.map(d => `<option value="${d.name}">${d.name} (${d.specialization || 'Gen'})</option>`).join('');
        sel.value = currentVal;
    }
}

// --- Dashboard Logic ---
function renderDashboard() {
    try {
        const today = new Date().toDateString();

        const branchSales = sales.filter(s => currentBranch === 'all' || (s.branchId || 'main') === currentBranch);
        const branchExpenses = expenses.filter(e => currentBranch === 'all' || !e.branchId || e.branchId === currentBranch);
        const branchPurchases = purchases.filter(p => currentBranch === 'all' || !p.branchId || p.branchId === currentBranch);
        const branchProducts = products.filter(p => currentBranch === 'all' || !p.branchId || p.branchId === currentBranch);

        const todaysSales = branchSales.filter(s => s.date && new Date(s.date).toDateString() === today);
        const todaysExpenses = branchExpenses.filter(ex => ex.date && new Date(ex.date).toDateString() === today);
        const todaysPurchases = branchPurchases.filter(p => p.date && new Date(p.date).toDateString() === today);

        const revenue = todaysSales.reduce((sum, s) => sum + (parseFloat(s.grandTotal) || 0), 0);
        const dailyExpenses = todaysExpenses.reduce((sum, ex) => sum + (parseFloat(ex.amount) || 0), 0);
        const dailyPurchases = todaysPurchases.reduce((sum, p) => sum + ((parseFloat(p.price) || 0) * (parseFloat(p.qty) || 0)), 0);
        const netProfit = revenue - dailyExpenses - dailyPurchases;

        const lowStock = branchProducts.filter(p => (parseInt(p.stock) || 0) <= 10).length;
        const expired = branchProducts.filter(p => p.expiry && isNearExpiry(p.expiry)).length;

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
                    <td>${s.date ? new Date(s.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</td>
                </tr>
            `).join('');
        }
    } catch (e) {
        console.error('Error rendering dashboard:', e);
    }
}

// --- Helpers ---
function generateInvoiceNumber() {
    const branchSales = sales.filter(s => currentBranch === 'all' || (s.branchId || 'main') === currentBranch);
    const lastSale = branchSales[branchSales.length - 1];
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
        customerPayments: JSON.parse(localStorage.getItem('mediflow_customer_payments')) || [],
        admins: JSON.parse(localStorage.getItem('mediflow_admins')) || [],
        categories: JSON.parse(localStorage.getItem('mediflow_categories')) || [],
        expenseCategories: JSON.parse(localStorage.getItem('mediflow_expense_categories')) || [],
        doctors: JSON.parse(localStorage.getItem('mediflow_doctors')) || [],
        theme: localStorage.getItem('mediflow_theme') || 'light',
        exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `V-BILLING_Backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// --- Automatic Local JSON Backup ---
function checkAndRunAutoBackup() {
    // Only run if user is actively logged in to avoid backup spam on login screen
    if (sessionStorage.getItem('mediflow_logged_in') !== 'true') return;

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const lastBackupStr = localStorage.getItem('mediflow_last_auto_backup_date');

    // Backup once per day automatically
    if (todayStr !== lastBackupStr) {
        exportDataSilent(todayStr);
        localStorage.setItem('mediflow_last_auto_backup_date', todayStr);
    }
}

function exportDataSilent(dateStr) {
    const data = {
        products: JSON.parse(localStorage.getItem('mediflow_products')) || [],
        sales: JSON.parse(localStorage.getItem('mediflow_sales')) || [],
        settings: JSON.parse(localStorage.getItem('mediflow_settings')) || {},
        purchases: JSON.parse(localStorage.getItem('mediflow_purchases')) || [],
        expenses: JSON.parse(localStorage.getItem('mediflow_expenses')) || [],
        customers: JSON.parse(localStorage.getItem('mediflow_customers')) || [],
        suppliers: JSON.parse(localStorage.getItem('mediflow_suppliers')) || [],
        supplierPayments: JSON.parse(localStorage.getItem('mediflow_supplier_payments')) || [],
        customerPayments: JSON.parse(localStorage.getItem('mediflow_customer_payments')) || [],
        admins: JSON.parse(localStorage.getItem('mediflow_admins')) || [],
        categories: JSON.parse(localStorage.getItem('mediflow_categories')) || [],
        expenseCategories: JSON.parse(localStorage.getItem('mediflow_expense_categories')) || [],
        doctors: JSON.parse(localStorage.getItem('mediflow_doctors')) || [],
        theme: localStorage.getItem('mediflow_theme') || 'light',
        exportDate: new Date().toISOString()
    };

    // Show a small non-intrusive notification
    const alertDiv = document.createElement('div');
    alertDiv.style.position = 'fixed';
    alertDiv.style.bottom = '20px';
    alertDiv.style.right = '20px';
    alertDiv.style.background = 'var(--primary-color)';
    alertDiv.style.color = '#fff';
    alertDiv.style.padding = '12px 20px';
    alertDiv.style.borderRadius = '8px';
    alertDiv.style.zIndex = '9999';
    alertDiv.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
    alertDiv.style.fontFamily = 'inherit';
    alertDiv.style.fontSize = '14px';
    alertDiv.innerHTML = '📥 Downloading Daily Auto-Backup...';
    document.body.appendChild(alertDiv);

    setTimeout(() => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `V-BILLING_DailyBackup_${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setTimeout(() => {
            alertDiv.style.opacity = '0';
            alertDiv.style.transition = 'opacity 0.5s ease';
            setTimeout(() => document.body.removeChild(alertDiv), 500);
        }, 3000);
    }, 1500);
}

function importData(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!confirm('Are you sure you want to import this data? This will overwrite all your current products, sales, and settings. This action cannot be undone.')) {
        e.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function (event) {
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
            if (data.doctors) localStorage.setItem('mediflow_doctors', JSON.stringify(data.doctors));
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
    a.download = `V-BILLING_Products_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importProducts(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!confirm('Are you sure you want to import products? This will add these products to your current inventory for the selected branch.')) {
        e.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function (event) {
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

            // Keep products from other branches
            const otherBranchProducts = products.filter(p => p.branchId && p.branchId !== currentBranch);

            // Map and add new products
            const newProducts = importedProducts.map(p => ({
                id: p.id || 'P' + Math.random().toString(36).substr(2, 9),
                branchId: currentBranch,
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

            products = [...otherBranchProducts, ...newProducts];

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
    const branchProducts = products.filter(p => currentBranch === 'all' || !p.branchId || p.branchId === currentBranch);
    const csvContent = jsonToCSV(branchProducts, headers);
    downloadBlob(csvContent, `V-BILLING_Products_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
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

    const branchSales = sales.filter(s => currentBranch === 'all' || (s.branchId || 'main') === currentBranch);
    branchSales.forEach(sale => {
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
    downloadBlob(csvContent, `V-BILLING_Sales_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
}

function exportPurchasesCSV() {
    const headers = ['date', 'productName', 'supplier', 'invoice', 'qty', 'price', 'total'];
    const csvContent = jsonToCSV(purchases, headers);
    downloadBlob(csvContent, `V-BILLING_Purchases_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
}

function exportExpensesCSV() {
    const headers = ['date', 'category', 'description', 'amount'];
    const csvContent = jsonToCSV(expenses, headers);
    downloadBlob(csvContent, `V-BILLING_Expenses_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
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

// --- Expense Category Management ---
function renderExpenseCategoryManagement() {
    const list = document.getElementById('exp-category-list');
    if (!list) return;

    list.innerHTML = expenseCategories.map(cat => `
        <div class="badge" style="background: var(--warning-light); color: var(--warning-color); padding: 5px 10px; display: flex; align-items: center; gap: 8px;">
            ${cat}
            <i data-lucide="edit-2" style="width: 12px; cursor: pointer;" onclick="editExpenseCategoryName('${cat}')"></i>
            <i data-lucide="x" style="width: 12px; cursor: pointer;" onclick="deleteExpenseCategory('${cat}')"></i>
        </div>
    `).join('');

    // Also update expense category dropdowns
    updateExpenseCategoryDropdowns();
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function updateExpenseCategoryDropdowns() {
    const expCatSelect = document.getElementById('exp-category');
    if (expCatSelect) {
        const currentVal = expCatSelect.value;
        expCatSelect.innerHTML = expenseCategories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
        if (expenseCategories.includes(currentVal)) expCatSelect.value = currentVal;
    }
}

function addExpenseCategory() {
    const input = document.getElementById('new-exp-category-name');
    const name = input.value.trim();

    if (!name) return;
    if (expenseCategories.includes(name)) {
        alert('Expense category already exists!');
        return;
    }

    expenseCategories.push(name);
    saveExpenseCategories();
    input.value = '';
    renderExpenseCategoryManagement();
}

function editExpenseCategoryName(oldName) {
    const newName = prompt('Enter new name for expense category:', oldName);
    if (!newName || newName.trim() === oldName) return;

    const trimmedNewName = newName.trim();
    if (expenseCategories.includes(trimmedNewName)) {
        alert('Expense category name already exists!');
        return;
    }

    const index = expenseCategories.indexOf(oldName);
    if (index !== -1) {
        expenseCategories[index] = trimmedNewName;

        expenses.forEach(e => {
            if (e.category === oldName) e.category = trimmedNewName;
        });

        saveExpenseCategories();
        localStorage.setItem('mediflow_expenses', JSON.stringify(expenses));
        renderExpenseCategoryManagement();
        renderExpenses();
    }
}

function deleteExpenseCategory(name) {
    if (expenseCategories.length <= 1) {
        alert('Must have at least one expense category.');
        return;
    }

    const count = expenses.filter(e => e.category === name).length;
    if (count > 0) {
        if (!confirm(`There are ${count} expenses using this category. Deleting it will set them to "${expenseCategories[0] === name ? expenseCategories[1] : expenseCategories[0]}". Continue?`)) {
            return;
        }

        const fallback = expenseCategories[0] === name ? expenseCategories[1] : expenseCategories[0];
        expenses.forEach(e => {
            if (e.category === name) e.category = fallback;
        });
        localStorage.setItem('mediflow_expenses', JSON.stringify(expenses));
        renderExpenses();
    }

    expenseCategories = expenseCategories.filter(c => c !== name);
    saveExpenseCategories();
    renderExpenseCategoryManagement();
}

function saveExpenseCategories() {
    localStorage.setItem('mediflow_expense_categories', JSON.stringify(expenseCategories));
}

// --- Customer Management ---
function renderCustomers() {
    const tbody = document.querySelector('#customers-table tbody');
    if (!tbody) return;

    // Calculate summaries from sales first
    const customerSummaries = {};
    const branchSales = sales.filter(s => currentBranch === 'all' || (s.branchId || 'main') === currentBranch);
    branchSales.forEach(s => {
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
    const branchCustPayments = customerPayments.filter(p => currentBranch === 'all' || !p.branchId || p.branchId === currentBranch);
    branchCustPayments.forEach(p => {
        const phone = p.customerPhone;
        if (!customerSummaries[phone]) {
            customerSummaries[phone] = { paid: 0, credit: 0, returned: 0 };
        }
        customerSummaries[phone].returned += parseFloat(p.amount || 0);
        customerSummaries[phone].credit -= parseFloat(p.amount || 0);
    });

    const queryInput = document.getElementById('customer-list-search');
    const query = queryInput ? queryInput.value.toLowerCase() : '';
    const filtered = customers.filter(c =>
        (currentBranch === 'all' || !c.branchId || c.branchId === currentBranch) &&
        (c.name.toLowerCase().includes(query) ||
            c.phone.includes(query))
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
                    <button class="btn btn-outline" onclick="showCustomerHistory('${c.phone}')" title="Transaction History" style="padding: 5px; color: var(--primary-color); border-color: var(--primary-color);"><i data-lucide="history" style="width: 14px;"></i></button>
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
        (currentBranch === 'all' || !c.branchId || c.branchId === currentBranch) &&
        (c.name.toLowerCase().includes(query) ||
            c.phone.includes(query))
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
            branchId: currentBranch,
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

    let branchSuppliers = suppliers.filter(s => currentBranch === 'all' || !s.branchId || s.branchId === currentBranch);
    let filtered = branchSuppliers;
    if (query) {
        filtered = branchSuppliers.filter(s =>
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
        supplierData.branchId = currentBranch;
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

    const branchSuppliers = suppliers.filter(s => currentBranch === 'all' || !s.branchId || s.branchId === currentBranch);
    sSelect.innerHTML = '<option value="">Select Supplier (Optional)</option>' +
        branchSuppliers.map(s => `<option value="${s.name}">${s.name}</option>`).join('');

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
            branchId: currentBranch,
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
            branchId: currentBranch,
            customerId: c.id,
            customerName: c.name,
            customerPhone: c.phone,
            amount: amount,
            method: method,
            date: new Date().toISOString()
        });

        localStorage.setItem('mediflow_customer_payments', JSON.stringify(customerPayments));
        syncToCloud('customer_payments', { data: customerPayments });
        // Actually, let's keep it separate for the ledger.

        closePaymentModal();
        renderCustomers();
        alert(`Payment of ${settings.currency}${amount} recorded for ${c.name}`);
    }
}

function showCustomerHistory(phone) {
    const c = customers.find(cust => cust.phone === phone);
    if (!c) return;

    document.getElementById('hist-customer-name').textContent = c.name;
    const tbody = document.getElementById('customer-history-body');
    tbody.innerHTML = '';

    // Get Sales
    const cSales = sales.filter(s => s.customer && s.customer.phone === phone);
    // Get Payments
    const cPayments = customerPayments.filter(p => p.customerPhone === phone);

    // Merge
    let history = [
        ...cSales.map(s => ({
            date: s.date,
            type: 'SALE',
            ref: s.invoiceNo,
            mode: s.paymentMode || 'Cash',
            amount: s.grandTotal,
            isDebit: s.paymentMode === 'Credit'
        })),
        ...cPayments.map(p => ({
            date: p.date,
            type: 'PAYMENT',
            ref: 'PAY-' + p.id.substring(1, 8),
            mode: p.method,
            amount: p.amount,
            isDebit: false
        }))
    ];

    // Sort ASC to calculate running balance
    history.sort((a, b) => new Date(a.date) - new Date(b.date));

    let runningBalance = 0;
    const ledger = history.map(h => {
        if (h.isDebit) {
            runningBalance += h.amount;
        } else if (h.type === 'PAYMENT') {
            runningBalance -= h.amount;
        }
        return { ...h, balance: runningBalance };
    });

    // Reverse for display (Newest at top)
    ledger.reverse();

    if (ledger.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #666;">No transactions found for this customer.</td></tr>';
    } else {
        tbody.innerHTML = ledger.map(h => {
            const debitText = h.isDebit ? `${settings.currency}${h.amount.toFixed(2)}` : '---';
            const creditText = (h.type === 'PAYMENT') ? `${settings.currency}${h.amount.toFixed(2)}` : '---';

            return `
                <tr>
                    <td>${new Date(h.date).toLocaleString()}</td>
                    <td>${h.ref}</td>
                    <td>${h.mode}</td>
                    <td style="color: #dc2626;">${debitText}</td>
                    <td style="color: #16a34a;">${creditText}</td>
                    <td style="font-weight: 700; color: ${h.balance > 0 ? '#dc2626' : '#16a34a'};">
                        ${settings.currency}${h.balance.toFixed(2)}
                    </td>
                </tr>
            `;
        }).join('');
    }

    document.getElementById('customer-history-modal').style.display = 'flex';
}

// --- Admin Management ---
function openAdminModal() {
    const isVicki = sessionStorage.getItem('mediflow_user') === 'VIKI';
    const thisUser = admins.find(a => a.username === sessionStorage.getItem('mediflow_user'));
    const isBranchAdmin = thisUser && thisUser.role === 'admin';
    if (!isVicki && !isBranchAdmin) {
        alert('Access Denied: Only Admins can create new Accounts.');
        return;
    }
    document.getElementById('admin-user').value = '';
    document.getElementById('admin-pass').value = '';
    const roleSelect = document.getElementById('admin-role');
    if (roleSelect) {
        roleSelect.value = 'staff';
        roleSelect.disabled = !isVicki; // Branch admin can only create staff
    }
    const branchGroup = document.getElementById('admin-branch-group');
    if (branchGroup) branchGroup.style.display = isVicki ? 'block' : 'none';
    document.getElementById('admin-modal').style.display = 'flex';
}

function closeAdminModal() {
    document.getElementById('admin-modal').style.display = 'none';
}

function handleAdminSubmit(e) {
    e.preventDefault();

    const isVicki = sessionStorage.getItem('mediflow_user') === 'VIKI';
    const thisUser = admins.find(a => a.username === sessionStorage.getItem('mediflow_user'));
    const isBranchAdmin = thisUser && thisUser.role === 'admin';
    if (!isVicki && !isBranchAdmin) {
        alert('Only Admins can create new user accounts.');
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

    const branchSelect = document.getElementById('admin-branch');
    const branchId = branchSelect ? branchSelect.value : currentBranch;

    admins.push({
        id: 'A' + Date.now(),
        username: user,
        password: pass,
        role: role,
        branchId: branchId
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

    const isVicki = sessionStorage.getItem('mediflow_user') === 'VIKI';

    // Always render the Super Admin first if Vicki
    if (isVicki) {
        const trSuper = document.createElement('tr');
        trSuper.innerHTML = `
            <td><strong>VIKI</strong></td>
            <td><span class="badge" style="background: var(--warning-color); color: white;">Super Admin</span></td>
            <td><span style="font-size: 0.8rem; color: var(--text-muted);">Root Account (Cannot be modified)</span></td>
        `;
        tbody.appendChild(trSuper);
    }

    let branchAdmins = admins;
    if (!isVicki) {
        branchAdmins = admins.filter(a => currentBranch === 'all' || a.branchId === currentBranch);
    }

    if (branchAdmins.length === 0) {
        const emptyTr = document.createElement('tr');
        emptyTr.innerHTML = '<td colspan="3" style="text-align: center; padding: 1.5rem; color: var(--text-muted);">No additional staff or admin accounts found. Click "Create New User" to add one.</td>';
        tbody.appendChild(emptyTr);
    } else {
        branchAdmins.forEach(a => {
            const tr = document.createElement('tr');
            const badgeStyle = a.role === 'admin' ? 'background: var(--primary-light); color: var(--primary-color);' : 'background: #e2e8f0; color: #475569;';
            const displayRole = a.role === 'admin' ? 'Admin' : 'Staff';

            const b = branches.find(br => br.id === a.branchId);
            const branchName = b ? b.name : (a.username === 'VIKI' ? 'System' : 'Unknown');

            tr.innerHTML = `
                <td>${a.username}</td>
                <td><span class="badge" style="${badgeStyle}">${displayRole}</span></td>
                <td><span class="badge" style="background: #f1f5f9; color: #64748b; font-size: 0.75rem;">${branchName}</span></td>
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
    const isVicki = sessionStorage.getItem('mediflow_user') === 'VIKI';
    const thisUser = admins.find(a => a.username === sessionStorage.getItem('mediflow_user'));
    const isBranchAdmin = thisUser && thisUser.role === 'admin';

    // A branch admin can delete their branch staff
    if (!isVicki && !isBranchAdmin) {
        alert('Only Admins can delete accounts.');
        return;
    }
    if (confirm('Are you sure you want to delete this account?')) {
        admins = admins.filter(a => a.id !== id);
        localStorage.setItem('mediflow_admins', JSON.stringify(admins));
        renderAdmins();
        syncToCloud('admins', { data: admins });
    }
}

function addLicenseField(value = '') {
    const container = document.getElementById('licenses-container');
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'license-row';
    div.style.display = 'flex';
    div.style.gap = '0.5rem';

    div.innerHTML = `
        <input type="text" class="form-control license-input" placeholder="License No." value="${value}" style="flex: 1;">
        <button type="button" class="btn btn-outline" onclick="this.parentElement.remove()" style="padding: 0 10px; color: var(--danger-color);">
            <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
        </button>
    `;

    container.appendChild(div);
    if (window.lucide) lucide.createIcons();
}

// --- Reports & Session Logs ---
function renderReports() {
    const today = new Date().toISOString().split('T')[0];
    const todaySales = sales.filter(s => s.date.startsWith(today));

    let totalCash = 0;
    let totalGPay = 0;
    let totalCredit = 0;
    let totalSales = 0;

    todaySales.forEach(s => {
        const pMode = s.paymentMode || 'Cash';
        totalSales += (s.grandTotal || 0);
        if (pMode === 'Cash') totalCash += (s.grandTotal || 0);
        else if (pMode === 'GPay') totalGPay += (s.grandTotal || 0);
        else if (pMode === 'Credit') totalCredit += (s.grandTotal || 0);
    });

    document.getElementById('report-total-sales').textContent = `${settings.currency}${totalSales.toFixed(2)}`;
    document.getElementById('report-total-cash').textContent = `${settings.currency}${totalCash.toFixed(2)}`;
    document.getElementById('report-total-gpay').textContent = `${settings.currency}${totalGPay.toFixed(2)}`;
    document.getElementById('report-total-credit').textContent = `${settings.currency}${totalCredit.toFixed(2)}`;

    // Inventory Alerts
    const nearExpiryCount = products.filter(p => {
        const expDate = p.expiry || p.expiryDate;
        if (!expDate) return false;
        const diff = new Date(expDate) - new Date();
        const days = diff / (1000 * 60 * 60 * 24);
        return days > 0 && days <= 90;
    }).length;

    const expiredCount = products.filter(p => {
        const expDate = p.expiry || p.expiryDate;
        if (!expDate) return false;
        return new Date(expDate) < new Date();
    }).length;

    document.getElementById('report-near-expiry').textContent = nearExpiryCount;
    document.getElementById('report-expired').textContent = expiredCount;

    // Render Session Logs
    const logs = JSON.parse(localStorage.getItem('mediflow_session_logs')) || [];
    const tbody = document.getElementById('session-logs-body');
    if (tbody) {
        tbody.innerHTML = logs.slice().reverse().slice(0, 20).map(log => `
            <tr>
                <td><strong>${log.user}</strong></td>
                <td>${new Date(log.login).toLocaleString()}</td>
                <td>${log.logout ? new Date(log.logout).toLocaleString() : '<span class="badge" style="background: #dcfce7; color: #16a34a;">Active</span>'}</td>
                <td>${log.duration || '---'}</td>
            </tr>
        `).join('');
    }
}

function recordSessionLog(type, user, time) {
    let logs = JSON.parse(localStorage.getItem('mediflow_session_logs')) || [];
    if (type === 'login') {
        logs.push({
            user: user,
            login: time,
            logout: null,
            duration: null
        });
    } else if (type === 'logout') {
        // Find the last active session for this user
        for (let i = logs.length - 1; i >= 0; i--) {
            if (logs[i].user === user && !logs[i].logout) {
                logs[i].logout = time;
                const diff = new Date(time) - new Date(logs[i].login);
                logs[i].duration = formatDuration(diff);
                break;
            }
        }
    }
    localStorage.setItem('mediflow_session_logs', JSON.stringify(logs));
}

function formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    let str = "";
    if (hours > 0) str += hours + "h ";
    if (minutes > 0) str += minutes + "m ";
    str += seconds + "s";
    return str;
}

function clearSessionLogs() {
    if (confirm('Are you sure you want to clear all session logs?')) {
        localStorage.removeItem('mediflow_session_logs');
        renderReports();
    }
}

// Keyboard Shortcuts Logic
document.addEventListener('keydown', (e) => {
    // Only trigger shortcuts if not typing in a text field (for certain keys)
    const activeEl = document.activeElement;
    const isInput = activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable;

    // Navigation Shortcuts (F1 - F10)
    const navShortcuts = {
        'F1': 'dashboard',
        'F2': 'billing',
        'F3': 'products',
        'F4': 'purchase',
        'F5': 'expenses',
        'F6': 'customers',
        'F7': 'suppliers',
        'F8': 'sales',
        'F9': 'reports',
        'F10': 'settings'
    };

    if (navShortcuts[e.key]) {
        e.preventDefault();
        switchSection(navShortcuts[e.key]);
        return;
    }

    // Global Shortcuts
    if (e.key === 'Escape') {
        // Close all modals
        document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
        return;
    }

    // Billing Specific Shortcuts
    if (currentSection === 'billing') {
        // Process Sale (Save & Print) - Ctrl + Enter
        if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            const processBtn = document.getElementById('process-sale-btn');
            if (processBtn && !processBtn.disabled) processSale(true);
        }
        // Process Sale (Save Only) - Shift + Enter
        else if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault();
            const processBtn = document.getElementById('process-sale-btn');
            if (processBtn && !processBtn.disabled) processSale(false);
        }
        // Clear Cart - F12
        else if (e.key === 'F12') {
            e.preventDefault();
            clearCart();
        }
        // Focus Search - Slash (/) if not in input
        else if (e.key === '/' && !isInput) {
            e.preventDefault();
            document.getElementById('billing-search')?.focus();
        }
    }
});
