// ============================
// توابع تبدیل تاریخ میلادی به شمسی با اعداد انگلیسی
// ============================

function getPersianDateParts(date) {
    if (!date) return null;
    
    const d = new Date(date);
    const formatter = new Intl.DateTimeFormat('fa-IR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    
    const persianParts = formatter.formatToParts(d);
    
    let year = '', month = '', day = '';
    
    for (const part of persianParts) {
        if (part.type === 'year') year = part.value;
        else if (part.type === 'month') month = part.value;
        else if (part.type === 'day') day = part.value;
    }
    
    const persianToEnglish = {
        '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
        '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9'
    };
    
    const convertNumber = (str) => {
        return str.split('').map(ch => persianToEnglish[ch] || ch).join('');
    };
    
    return {
        year: parseInt(convertNumber(year)),
        month: parseInt(convertNumber(month)),
        day: parseInt(convertNumber(day))
    };
}

function getPersianYearMonth(date) {
    const parts = getPersianDateParts(date);
    if (!parts) return null;
    return {
        year: parts.year,
        month: parts.month
    };
}

function getPersianMonthName(date) {
    const persianDate = new Intl.DateTimeFormat('fa-IR', { month: 'long' }).format(date);
    const persianYear = new Intl.DateTimeFormat('fa-IR', { year: 'numeric' }).format(date);
    
    const persianToEnglish = {
        '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
        '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9'
    };
    
    const englishYear = persianYear.split('').map(ch => persianToEnglish[ch] || ch).join('');
    
    return persianDate + ' ' + englishYear;
}

function toPersianDateWithEnglishNumbers(date, withTime = true) {
    if (!date) return '';
    
    const d = new Date(date);
    
    const formatter = new Intl.DateTimeFormat('fa-IR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: withTime ? '2-digit' : undefined,
        minute: withTime ? '2-digit' : undefined,
        hour12: false
    });
    
    const persianParts = formatter.formatToParts(d);
    
    let year = '', month = '', day = '', hour = '', minute = '';
    
    for (const part of persianParts) {
        if (part.type === 'year') year = part.value;
        else if (part.type === 'month') month = part.value;
        else if (part.type === 'day') day = part.value;
        else if (part.type === 'hour') hour = part.value;
        else if (part.type === 'minute') minute = part.value;
    }
    
    const persianToEnglish = {
        '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
        '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9'
    };
    
    const convertNumber = (str) => {
        return str.split('').map(ch => persianToEnglish[ch] || ch).join('');
    };
    
    year = convertNumber(year);
    month = convertNumber(month);
    day = convertNumber(day);
    
    if (withTime) {
        hour = convertNumber(hour);
        minute = convertNumber(minute);
        return `${year}/${month}/${day} ${hour}:${minute}`;
    } else {
        return `${year}/${month}/${day}`;
    }
}

function formatPersianDate(date, withTime = true) {
    return toPersianDateWithEnglishNumbers(date, withTime);
}

// ============================
// تابع تولید UID منحصربه‌فرد
// ============================
function generateUID() {
    return 'trade_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// ============================
// تابع تشخیص MIME Type
// ============================
function getMimeType(fileName) {
    if (!fileName || !fileName.includes('.')) {
        return 'image/png';
    }
    
    const ext = fileName.split('.').pop().toLowerCase();
    const types = {
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'bmp': 'image/bmp',
        'svg': 'image/svg+xml',
        'ico': 'image/x-icon'
    };
    return types[ext] || 'image/png';
}

// ============================
// متغیرهای سراسری برای مدیریت آپلود
// ============================
let editingTradeId = null;
let editBaseBalance = null;
const PRESET_STRATEGIES = ['SL', 'Breakout', 'Candle Setup'];
let customStrategies = [];
function escapeHTML(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
let isImportCancelled = false;
let importStartTime = 0;
let accountGrowthChart = null;
let monthlyGrowthChart = null;

// ============================
// کلاس مدیریت IndexedDB - ذخیره‌سازی نامحدود
// ============================
class TradingJournalDB {
    constructor() {
        this.dbName = 'CryptoJournal';
        this.version = 3;
        this.db = null;
        this.isReady = false;
    }

    async open() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                console.error('خطا در باز کردن دیتابیس:', request.error);
                reject(request.error);
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                this.isReady = true;
                console.log('✅ دیتابیس IndexedDB با موفقیت باز شد');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const oldVersion = event.oldVersion;
                
                if (oldVersion < 1) {
                    const tradeStore = db.createObjectStore('trades', { keyPath: 'id' });
                    tradeStore.createIndex('uid', 'uid', { unique: true });
                    tradeStore.createIndex('accountId', 'accountId', { unique: false });
                    tradeStore.createIndex('date', 'date', { unique: false });
                    tradeStore.createIndex('status', 'status', { unique: false });
                    
                    db.createObjectStore('accounts', { keyPath: 'id' });
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
                
                if (oldVersion < 2) {
                    if (!db.objectStoreNames.contains('trades')) return;
                    const transaction = event.target.transaction;
                    const tradeStore = transaction.objectStore('trades');
                    
                    if (!tradeStore.indexNames.contains('uid')) {
                        tradeStore.createIndex('uid', 'uid', { unique: true });
                    }
                }
                
                if (oldVersion < 3) {
                    console.log('آپگرید به ورژن ۳');
                }
            };
        });
    }

    async saveTrade(trade) {
        this.checkReady();
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction(['trades'], 'readwrite');
                const store = transaction.objectStore('trades');
                
                const request = store.put(trade);
                
                request.onsuccess = () => resolve(trade.id);
                
                request.onerror = (event) => {
                    const error = event.target.error;
                    if (error.name === 'QuotaExceededError') {
                        reject(new Error('⚠️ فضای ذخیره‌سازی کافی نیست. لطفاً با پشتیبان‌گیری و حذف داده‌های قدیمی فضا آزاد کنید.'));
                    } else {
                        reject(error);
                    }
                };
            } catch (error) {
                reject(error);
            }
        });
    }

    async saveTrades(tradesArray) {
        this.checkReady();
        const transaction = this.db.transaction(['trades'], 'readwrite');
        const store = transaction.objectStore('trades');
        
        for (const trade of tradesArray) {
            await new Promise((resolve, reject) => {
                const request = store.put(trade);
                request.onsuccess = () => resolve();
                request.onerror = (event) => {
                    const error = event.target.error;
                    if (error.name === 'QuotaExceededError') {
                        reject(new Error('⚠️ فضای ذخیره‌سازی کافی نیست'));
                    } else {
                        reject(error);
                    }
                };
            });
        }
    }

    async getTradesByAccount(accountId) {
        this.checkReady();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['trades'], 'readonly');
            const store = transaction.objectStore('trades');
            const index = store.index('accountId');
            
            const request = index.getAll(parseInt(accountId));
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllTrades() {
        this.checkReady();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['trades'], 'readonly');
            const store = transaction.objectStore('trades');
            
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    async getTradeById(tradeId) {
        this.checkReady();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['trades'], 'readonly');
            const store = transaction.objectStore('trades');
            
            const request = store.get(parseInt(tradeId));
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getTradeByUid(uid) {
        this.checkReady();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['trades'], 'readonly');
            const store = transaction.objectStore('trades');
            const index = store.index('uid');
            
            const request = index.get(uid);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteTrade(tradeId) {
        this.checkReady();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['trades'], 'readwrite');
            const store = transaction.objectStore('trades');
            
            const request = store.delete(parseInt(tradeId));
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async deleteTrades(tradeIds) {
        this.checkReady();
        const transaction = this.db.transaction(['trades'], 'readwrite');
        const store = transaction.objectStore('trades');
        
        for (const id of tradeIds) {
            await new Promise((resolve, reject) => {
                const request = store.delete(parseInt(id));
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }
    }

    async saveAccounts(accountsArray) {
        this.checkReady();
        const transaction = this.db.transaction(['accounts'], 'readwrite');
        const store = transaction.objectStore('accounts');
        
        for (const account of accountsArray) {
            await new Promise((resolve, reject) => {
                const request = store.put(account);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }
    }

    async getAccounts() {
        this.checkReady();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['accounts'], 'readonly');
            const store = transaction.objectStore('accounts');
            
            const request = store.getAll();
            request.onsuccess = () => {
                const accounts = request.result || [];
                console.log('📊 حساب‌های دریافت شده:', accounts);
                resolve(accounts);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async getAccountById(accountId) {
        this.checkReady();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['accounts'], 'readonly');
            const store = transaction.objectStore('accounts');
            
            const request = store.get(parseInt(accountId));
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteAccount(accountId) {
        this.checkReady();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['accounts'], 'readwrite');
            const store = transaction.objectStore('accounts');
            
            const request = store.delete(parseInt(accountId));
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async saveSetting(key, value) {
        this.checkReady();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['settings'], 'readwrite');
            const store = transaction.objectStore('settings');
            
            const request = store.put({ key, value });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getSetting(key) {
        this.checkReady();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['settings'], 'readonly');
            const store = transaction.objectStore('settings');
            
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result?.value);
            request.onerror = () => reject(request.error);
        });
    }

    checkReady() {
        if (!this.isReady || !this.db) {
            throw new Error('دیتابیس آماده نیست. ابتدا open() را فراخوانی کنید');
        }
    }

    async backup() {
        const accounts = await this.getAccounts();
        const trades = await this.getAllTrades();
        
        return {
            accounts,
            trades,
            exportDate: new Date().toISOString(),
            version: '4.0'
        };
    }

    async clearAll() {
        this.checkReady();
        
        const clearStore = (storeName) => {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        };

        await Promise.all([
            clearStore('trades'),
            clearStore('accounts'),
            clearStore('settings')
        ]);
    }

    async upgradeOldTrades() {
        try {
            const allTrades = await this.getAllTrades();
            if (!allTrades || allTrades.length === 0) return;
            
            let changed = false;
            
            for (const trade of allTrades) {
                if (!trade.uid) {
                    trade.uid = `trade_${trade.id}`;
                    changed = true;
                }
                if (trade.entryScreenshot && !trade.entryScreenshotName) {
                    trade.entryScreenshotName = `entry_${trade.uid}.png`;
                    changed = true;
                }
                if (trade.exitScreenshot && !trade.exitScreenshotName) {
                    trade.exitScreenshotName = `exit_${trade.uid}.png`;
                    changed = true;
                }
            }
            
            if (changed) {
                await this.saveTrades(allTrades);
                console.log('✅ معاملات قدیمی به فرمت جدید آپگرید شدند');
            }
        } catch (error) {
            console.error('خطا در آپگرید معاملات:', error);
        }
    }
}

// ============================
// نمونه اصلی دیتابیس
// ============================
const db = new TradingJournalDB();

// ============================
// متغیرهای سراسری
// ============================
let accounts = [];
let activeAccountId = 1;
let activeAccount = null;
let accountBalance = 0;
let initialAccountBalance = 0;
let trades = [];

let currentYear = null;
let currentMonth = null;
let currentTradeIdForClose = null;
let closeScreenshotData = null;

const persianMonths = [
    'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];

// ============================
// تابع سوئیچ بین بخش‌ها
// ============================
function switchSection(sectionId) {
    const sections = document.querySelectorAll('.section, .dashboard-section');
    sections.forEach(section => {
        section.classList.remove('active-section');
        section.style.display = 'none';
    });
    
    const targetSection = document.getElementById(sectionId + '-section');
    if (targetSection) {
        targetSection.classList.add('active-section');
        targetSection.style.display = 'block';
    }
    
    const toolbarBtns = document.querySelectorAll('.toolbar-btn');
    toolbarBtns.forEach(btn => {
        btn.classList.remove('active');
    });
    
    const activeBtn = document.querySelector(`.toolbar-btn[data-section="${sectionId}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
    
    // نمایش یا مخفی کردن بالانس بر اساس بخش
    const balanceSection = document.getElementById('balanceSection');
    if (balanceSection) {
        if (sectionId === 'trade-form') {
            balanceSection.style.display = 'flex';
        } else {
            balanceSection.style.display = 'none';
        }
    }
    
    if (sectionId === 'stats') {
        updateStats();
        updateDetailedStats();
        updateGrowthChart();
    }
    
    if (sectionId === 'dashboard') {
        updateMonthlyDashboard();
        updateMonthlyGrowthChart();
    }
    
    if (sectionId === 'history') {
        loadTrades();
    }
    
    if (sectionId === 'trade-form') {
        loadOpenTrades();
    }
    
    closeAllModals();
}

// ============================
// تابع به‌روزرسانی آمار تفصیلی
// ============================
function updateDetailedStats() {
    // موجودی اولیه
    document.getElementById('initialBalance').textContent = formatCurrency(initialAccountBalance);
    
    // موجودی فعلی (محاسبه شده از سود و ضرر معاملات بسته شده)
    const totalPnL = calculateTotalPnL();
    const currentCalculatedBalance = initialAccountBalance + totalPnL;
    document.getElementById('currentBalanceStats').textContent = formatCurrency(currentCalculatedBalance);
    
    // سود و ضرر کل
    const totalPnLElement = document.getElementById('totalPnLStats');
    totalPnLElement.textContent = (totalPnL >= 0 ? '+' : '') + formatCurrency(Math.abs(totalPnL));
    totalPnLElement.style.color = totalPnL >= 0 ? '#10b981' : '#ef4444';
    
    // درصد سود/ضرر نسبت به بالانس اولیه با باکس رنگی
    const profitPercentage = initialAccountBalance > 0 ? (totalPnL / initialAccountBalance) * 100 : 0;
    const profitPercentageElement = document.getElementById('profitPercentage');
    profitPercentageElement.textContent = (profitPercentage >= 0 ? '+' : '') + profitPercentage.toFixed(2) + '%';
    profitPercentageElement.className = profitPercentage >= 0 ? 'stats-value percentage-box' : 'stats-value percentage-box negative';
    
    // سود خالص (مجموع معاملات سودده) با باکس رنگی
    const totalProfit = calculateTotalProfit();
    const netProfitElement = document.getElementById('netProfit');
    netProfitElement.textContent = formatCurrency(totalProfit);
    netProfitElement.className = 'stats-value positive-box';
    
    // ضرر خالص (مجموع معاملات ضررده) با باکس رنگی
    const totalLoss = calculateTotalLoss();
    const netLossElement = document.getElementById('netLoss');
    netLossElement.textContent = formatCurrency(totalLoss);
    netLossElement.className = 'stats-value negative-box';
    
    // تعداد کل معاملات
    document.getElementById('totalTradesStats').textContent = trades.length;
    
    // تعداد معاملات لانگ و شورت
    const longTrades = trades.filter(t => t.type === 'buy').length;
    const shortTrades = trades.filter(t => t.type === 'sell').length;
    document.getElementById('longTradesCount').textContent = longTrades;
    document.getElementById('shortTradesCount').textContent = shortTrades;
}

// ============================
// تابع به‌روزرسانی نمودار رشد حساب کلی
// ============================
function updateGrowthChart() {
    const ctx = document.getElementById('accountGrowthChart').getContext('2d');
    
    // مرتب‌سازی معاملات بر اساس تاریخ
    const sortedTrades = [...trades]
        .filter(t => t.status === 'closed')
        .sort((a, b) => new Date(a.closedDate || a.date) - new Date(b.closedDate || b.date));
    
    // محاسبه رشد حساب
    let balance = initialAccountBalance;
    const balanceHistory = [balance];
    const tradeNumbers = [0];
    
    sortedTrades.forEach((trade, index) => {
        const pnl = calculateTradePnL(trade);
        balance += pnl;
        balanceHistory.push(balance);
        tradeNumbers.push(index + 1);
    });
    
    // اگر معامله‌ای وجود نداشت
    if (sortedTrades.length === 0) {
        balanceHistory.push(initialAccountBalance);
        tradeNumbers.push(1);
    }
    
    // نابود کردن نمودار قبلی اگر وجود دارد
    if (accountGrowthChart) {
        accountGrowthChart.destroy();
    }
    
    // ایجاد نمودار جدید با خط صاف و افکت نئونی
    accountGrowthChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: tradeNumbers,
            datasets: [{
                label: 'رشد حساب ($)',
                data: balanceHistory,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 4,
                pointBackgroundColor: '#60a5fa',
                pointBorderColor: '#1e293b',
                pointRadius: 5,
                pointHoverRadius: 8,
                tension: 0.1,
                fill: true,
                borderDash: [], // خط صاف (بدون نقطه چین)
                shadowOffsetX: 0,
                shadowOffsetY: 0,
                shadowBlur: 15,
                shadowColor: 'rgba(59, 130, 246, 0.8)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: '#1e293b',
                    titleColor: '#f1f5f9',
                    bodyColor: '#94a3b8',
                    borderColor: '#3b82f6',
                    borderWidth: 2
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(71, 85, 105, 0.2)'
                    },
                    ticks: {
                        color: '#94a3b8'
                    },
                    title: {
                        display: true,
                        text: 'تعداد معاملات',
                        color: '#cbd5e1'
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(71, 85, 105, 0.2)'
                    },
                    ticks: {
                        color: '#94a3b8',
                        callback: function(value) {
                            return '$' + value;
                        }
                    },
                    title: {
                        display: true,
                        text: 'رشد سرمایه ($)',
                        color: '#cbd5e1'
                    }
                }
            },
            elements: {
                line: {
                    borderJoinStyle: 'round',
                    borderCapStyle: 'round'
                }
            }
        }
    });
}

// ============================
// تابع به‌روزرسانی نمودار رشد ماهانه
// ============================
function updateMonthlyGrowthChart() {
    const ctx = document.getElementById('monthlyGrowthChart').getContext('2d');
    
    // فیلتر معاملات ماه جاری
    const monthlyTrades = trades.filter(trade => {
        if (trade.accountId !== activeAccountId) return false;
        
        const persianDate = getPersianDateParts(trade.date);
        if (!persianDate) return false;
        
        return persianDate.year === currentYear && persianDate.month === currentMonth;
    });
    
    // مرتب‌سازی معاملات ماه جاری بر اساس تاریخ
    const sortedMonthlyTrades = [...monthlyTrades]
        .filter(t => t.status === 'closed')
        .sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // محاسبه رشد حساب در ماه جاری
    let monthlyBalance = initialAccountBalance;
    const monthlyBalanceHistory = [monthlyBalance];
    const monthlyTradeNumbers = [0];
    
    sortedMonthlyTrades.forEach((trade, index) => {
        const pnl = calculateTradePnL(trade);
        monthlyBalance += pnl;
        monthlyBalanceHistory.push(monthlyBalance);
        monthlyTradeNumbers.push(index + 1);
    });
    
    // اگر معامله‌ای در ماه جاری وجود نداشت
    if (sortedMonthlyTrades.length === 0) {
        monthlyBalanceHistory.push(initialAccountBalance);
        monthlyTradeNumbers.push(1);
    }
    
    // نابود کردن نمودار قبلی اگر وجود دارد
    if (monthlyGrowthChart) {
        monthlyGrowthChart.destroy();
    }
    
    // ایجاد نمودار جدید با خط صاف و افکت نئونی
    monthlyGrowthChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: monthlyTradeNumbers,
            datasets: [{
                label: 'رشد حساب ماهانه ($)',
                data: monthlyBalanceHistory,
                borderColor: '#f59e0b',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                borderWidth: 4,
                pointBackgroundColor: '#fbbf24',
                pointBorderColor: '#1e293b',
                pointRadius: 5,
                pointHoverRadius: 8,
                tension: 0.1,
                fill: true,
                borderDash: [], // خط صاف (بدون نقطه چین)
                shadowOffsetX: 0,
                shadowOffsetY: 0,
                shadowBlur: 15,
                shadowColor: 'rgba(245, 158, 11, 0.8)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: '#1e293b',
                    titleColor: '#f1f5f9',
                    bodyColor: '#94a3b8',
                    borderColor: '#f59e0b',
                    borderWidth: 2
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(71, 85, 105, 0.2)'
                    },
                    ticks: {
                        color: '#94a3b8'
                    },
                    title: {
                        display: true,
                        text: 'تعداد معاملات',
                        color: '#cbd5e1'
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(71, 85, 105, 0.2)'
                    },
                    ticks: {
                        color: '#94a3b8',
                        callback: function(value) {
                            return '$' + value;
                        }
                    },
                    title: {
                        display: true,
                        text: 'رشد سرمایه ($)',
                        color: '#cbd5e1'
                    }
                }
            },
            elements: {
                line: {
                    borderJoinStyle: 'round',
                    borderCapStyle: 'round'
                }
            }
        }
    });
}

// ============================
// تابع بارگذاری معاملات باز در فرم ثبت معامله
// ============================
function loadOpenTrades() {
    const openTradesList = document.getElementById('openTradesList');
    if (!openTradesList) return;
    
    const openTrades = trades.filter(t => t.status === 'open' && t.accountId === activeAccountId);
    
    if (openTrades.length === 0) {
        openTradesList.innerHTML = '<div class="no-open-trades"><i class="fas fa-check-circle"></i> هیچ معامله بازی وجود ندارد</div>';
        return;
    }
    
    let html = '';
    openTrades.forEach(trade => {
        const dateText = formatPersianDate(trade.date, true);
        const typeText = trade.type === 'buy' ? 'لانگ' : 'شورت';
        const typeIcon = trade.type === 'buy' ? 'fa-arrow-up' : 'fa-arrow-down';
        const typeColor = trade.type === 'buy' ? '#10b981' : '#ef4444';
        
        html += `
        <div class="open-trade-item">
            <div class="open-trade-info">
                <span class="open-trade-symbol">${escapeHTML(trade.symbol)}</span>
                <div class="open-trade-detail">
                    <i class="fas ${typeIcon}" style="color: ${typeColor}"></i>
                    <span>${typeText}</span>
                </div>
                <div class="open-trade-detail">
                    <i class="fas fa-calendar"></i>
                    <span>${dateText}</span>
                </div>
                <div class="open-trade-detail">
                    <i class="fas fa-arrow-right"></i>
                    <span>${trade.entryPriceStr || trade.entryPrice}</span>
                </div>
                <div class="open-trade-detail">
                    <i class="fas fa-shield-alt"></i>
                    <span>${trade.stopLossStr || trade.stopLoss}</span>
                </div>
                <div class="open-trade-detail">
                    <i class="fas fa-bullseye"></i>
                    <span>${trade.takeProfitStr || trade.takeProfit}</span>
                </div>
            </div>
            <div class="open-trade-actions">
                <button class="btn-icon" onclick="openCloseModal(${trade.id})" title="بستن معامله">
                    <i class="fas fa-check-circle"></i>
                </button>
            </div>
        </div>
        `;
    });
    
    openTradesList.innerHTML = html;
}

// ============================
// توابع اولیه‌سازی
// ============================

async function initialize() {
    try {
        await db.open();
        console.log('✅ دیتابیس IndexedDB آماده است');
        
        await db.upgradeOldTrades();
        await loadAccountsFromDB();
        await loadTradesFromDB();
        
        updateBalanceDisplay();
        updateTotalRisk();
        updateStats();
        updateDetailedStats();
        
        setInitialMonthBasedOnLastTrade();
        updateMonthlyDashboard();
        
        switchSection('trade-form');
        loadOpenTrades();
        
        // مقداردهی اولیه نمودارها
        setTimeout(() => {
            updateGrowthChart();
            updateMonthlyGrowthChart();
        }, 500);
        
        try { customStrategies = JSON.parse((await db.getSetting('customStrategies')) || '[]'); } catch (e) { customStrategies = []; }
        refreshStrategyList();
        console.log('✅ برنامه با موفقیت راه‌اندازی شد');
        if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
        if (trades.length > 0) {
            const last = parseInt(await db.getSetting('lastBackupAt')) || 0;
            const days = last ? Math.floor((Date.now() - last) / 86400000) : null;
            if (days === null || days >= 7) {
                setTimeout(() => showNotification(days === null ? 'هنوز بکاپ نگرفته‌اید. از بخش «بکاپ» یک نسخه‌ی پشتیبان بگیرید.' : `${days} روز از آخرین بکاپ گذشته است.`, 'warning'), 1500);
            }
        }
    } catch (error) {
        console.error('❌ خطا در راه‌اندازی:', error);
        showNotification('خطا در راه‌اندازی دیتابیس', 'error');
    }
}

function setInitialMonthBasedOnLastTrade() {
    if (trades.length > 0) {
        const sortedTrades = [...trades].sort((a, b) => new Date(b.date) - new Date(a.date));
        const latestTrade = sortedTrades[0];
        
        const persianDate = getPersianDateParts(latestTrade.date);
        if (persianDate) {
            currentYear = persianDate.year;
            currentMonth = persianDate.month;
        } else {
            const now = new Date();
            const nowPersian = getPersianDateParts(now);
            currentYear = nowPersian.year;
            currentMonth = nowPersian.month;
        }
    } else {
        const now = new Date();
        const nowPersian = getPersianDateParts(now);
        currentYear = nowPersian.year;
        currentMonth = nowPersian.month;
    }
    
    updateMonthlyDashboard();
}

async function loadAccountsFromDB() {
    try {
        const dbAccounts = await db.getAccounts();
        
        if (dbAccounts && dbAccounts.length > 0) {
            accounts = dbAccounts;
        } else {
            accounts = [
                { id: 1, name: 'حساب اصلی', balance: 0, vipLevel: 'vip0' }
            ];
            await db.saveAccounts(accounts);
        }
        
        const savedActiveId = await db.getSetting('activeAccountId');
        activeAccountId = savedActiveId ? parseInt(savedActiveId) : 1;
        activeAccount = accounts.find(acc => acc.id === activeAccountId) || accounts[0];
        accountBalance = activeAccount ? activeAccount.balance : 0;
        initialAccountBalance = accountBalance; // ذخیره موجودی اولیه
        
        updateAccountsList();
        syncAutoFee();
        
    } catch (error) {
        console.error('خطا در بارگذاری حساب‌ها:', error);
        accounts = [
            { id: 1, name: 'حساب اصلی', balance: 0 }
        ];
        activeAccountId = 1;
        activeAccount = accounts[0];
        accountBalance = 0;
        initialAccountBalance = 0;
        updateAccountsList();
    }
}

async function loadTradesFromDB() {
    try {
        trades = await db.getTradesByAccount(activeAccountId);
        loadTrades();
        loadOpenTrades();
    } catch (error) {
        console.error('خطا در بارگذاری معاملات:', error);
        trades = [];
        loadTrades();
        loadOpenTrades();
    }
}

async function saveTradeToDB(trade) {
    try {
        await db.saveTrade(trade);
        trades = await db.getTradesByAccount(activeAccountId);
        return true;
    } catch (error) {
        if (error.message.includes('فضای ذخیره‌سازی')) {
            showNotification(error.message, 'error');
        } else {
            console.error('خطا در ذخیره معامله:', error);
            showNotification('خطا در ذخیره معامله', 'error');
        }
        return false;
    }
}

async function deleteTradeFromDB(tradeId) {
    try {
        await db.deleteTrade(tradeId);
        trades = await db.getTradesByAccount(activeAccountId);
        return true;
    } catch (error) {
        console.error('خطا در حذف معامله:', error);
        return false;
    }
}

async function saveAccountsToDB() {
    try {
        await db.saveAccounts(accounts);
        await db.saveSetting('activeAccountId', activeAccountId.toString());
        return true;
    } catch (error) {
        console.error('خطا در ذخیره حساب‌ها:', error);
        return false;
    }
}

// ============================
// توابع مدیریت تصویر
// ============================
function openImageModal(src) {
    if (src) {
        document.getElementById('fullSizeImage').src = src;
        document.getElementById('imageModal').style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function closeImageModal() {
    document.getElementById('imageModal').style.display = 'none';
    document.body.style.overflow = 'auto';
}

// ============================
// توابع مدیریت مودال‌ها
// ============================
let activeModal = null;

function toggleModal(modalId) {
    const modal = document.getElementById(modalId);
    const btn = document.getElementById(modalId.replace('Modal', 'Btn'));
    
    if (activeModal && activeModal !== modal) {
        activeModal.classList.remove('active');
        const activeBtn = document.getElementById(activeModal.id.replace('Modal', 'Btn'));
        if (activeBtn) {
            activeBtn.classList.remove('active');
        }
    }
    
    if (modal.classList.contains('active')) {
        modal.classList.remove('active');
        if (btn) btn.classList.remove('active');
        activeModal = null;
    } else {
        modal.classList.add('active');
        if (btn) btn.classList.add('active');
        activeModal = modal;
        
        if (modalId === 'balanceModal') {
            document.getElementById('newBalanceInput').value = accountBalance;
        }
        if (modalId === 'accountModal') {
            updateAccountsList();
        }
    }
}

function closeAllModals() {
    const modals = document.querySelectorAll('.modal-box');
    const buttons = document.querySelectorAll('.balance-btn');
    
    modals.forEach(modal => {
        modal.classList.remove('active');
    });
    
    buttons.forEach(button => {
        button.classList.remove('active');
    });
    
    activeModal = null;
}

// ============================
// توابع پیش‌نمایش اسکرین‌شات
// ============================
function previewEntryScreenshot(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const preview = document.getElementById('entryScreenshotPreview');
            compressImage(e.target.result, function(data) {
                preview.src = data;
                document.getElementById('entryScreenshotPreviewContainer').classList.add('active');
            });
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function previewCloseScreenshot(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const preview = document.getElementById('closeScreenshotPreview');
            compressImage(e.target.result, function(data) {
                preview.src = data;
                preview.classList.add('active');
                document.getElementById('closeScreenshotRemove').style.display = 'inline';
                closeScreenshotData = data;
            });
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function removeEntryScreenshot() {
    document.getElementById('entryScreenshotFile').value = '';
    document.getElementById('entryScreenshotPreview').src = '';
    document.getElementById('entryScreenshotPreviewContainer').classList.remove('active');
}

function removeCloseScreenshot() {
    document.getElementById('closeScreenshotFile').value = '';
    document.getElementById('closeScreenshotPreview').classList.remove('active');
    document.getElementById('closeScreenshotRemove').style.display = 'none';
    closeScreenshotData = null;
}

// ============================
// توابع مدیریت حساب و بالانس
// ============================
function setBalancePreset(amount) {
    document.getElementById('newBalanceInput').value = amount;
}

function updateBalanceDisplay() {
    document.getElementById('currentBalance').textContent = '$' + formatNumber(Math.round(getEquity() * 100) / 100);
    document.getElementById('currentBalanceDisplay').textContent = '$' + formatNumber(accountBalance);
    document.getElementById('currentAccountName').textContent = activeAccount ? activeAccount.name : 'حساب اصلی';
    
    const activeAccountIndicator = document.getElementById('activeAccountIndicator');
    activeAccountIndicator.textContent = `${accounts.findIndex(acc => acc.id === activeAccountId) + 1}/${accounts.length}`;
    
    const totalPnL = calculateTotalPnL();
    const totalPnLElement = document.getElementById('totalPnL');
    totalPnLElement.textContent = (totalPnL >= 0 ? '+' : '') + formatCurrency(Math.abs(totalPnL));
    totalPnLElement.style.color = totalPnL >= 0 ? '#10b981' : '#ef4444';
}

function getEquity() {
    return (initialAccountBalance || 0) + calculateTotalPnL();
}

function formatCurrency(num) {
    return '$' + parseFloat(num).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatNumber(num) {
    const numValue = parseFloat(num);
    if (isNaN(numValue)) return '0';
    
    if (numValue % 1 !== 0) {
        return numValue.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 8
        });
    }
    return numValue.toLocaleString('en-US');
}

function updateTotalRisk() {
    const openTrades = trades.filter(t => t.status === 'open');
    let totalRiskAmount = 0;
    
    openTrades.forEach(trade => {
        totalRiskAmount += trade.totalRiskAmount || calculateTradeRisk(trade).totalRiskAmount || 0;
    });
    
    const eqNow = getEquity();
    const totalRiskPercent = eqNow > 0 ? (totalRiskAmount / eqNow) * 100 : 0;
    document.getElementById('totalRiskPercent').textContent = totalRiskPercent.toFixed(2) + '%';
}

function setRiskPercent(percent) {
    document.getElementById('riskPercent').value = percent;
    calculateRisk();
}

async function updateBalance() {
    const newBalanceInput = document.getElementById('newBalanceInput');
    let newBalance = parseFloat(newBalanceInput.value);
    
    if (isNaN(newBalance) || newBalance <= 0) {
        showNotification('لطفاً یک عدد معتبر وارد کنید.', 'error');
        return;
    }
    
    newBalance = Math.round(newBalance * 100) / 100;
    
    const activeAccountIndex = accounts.findIndex(acc => acc.id === activeAccountId);
    if (activeAccountIndex !== -1) {
        accounts[activeAccountIndex].balance = newBalance;
        activeAccount = accounts[activeAccountIndex];
        accountBalance = newBalance;
        initialAccountBalance = newBalance; // به‌روزرسانی موجودی اولیه
        
        await saveAccountsToDB();
    }
    
    updateBalanceDisplay();
    updateTotalRisk();
    updateStats();
    updateDetailedStats();
    updateGrowthChart();
    updateMonthlyGrowthChart();
    calculateRisk();
    closeAllModals();
    showNotification('بالانس حساب به‌روزرسانی شد.', 'success');
}

function resetForm() {
    editingTradeId = null;
    editBaseBalance = null;
    document.getElementById('tradeForm').reset();
    document.getElementById('type').value = '';
    document.getElementById('feeDetails').style.display = 'none';
    removeEntryScreenshot();
    
    const now = new Date();
    const timezoneOffset = now.getTimezoneOffset() * 60000;
    const localISOTime = new Date(now - timezoneOffset).toISOString().slice(0, 16);
    document.getElementById('date').value = localISOTime;
    syncAutoFee();
}

// ============================
// کارمزد خودکار (بر اساس VIP حساب فعال، ورود و خروج هر دو تیکر)
// ============================
function getAccountVip(account) {
    return normalizeVip(account && account.vipLevel);
}

function syncAutoFee() {
    const input = document.getElementById('feePercent');
    const text = document.getElementById('feeAutoText');
    if (!input) return;
    
    // موقع ویرایش، کارمزد ثبت‌شدهٔ خود معامله حفظ می‌شود
    if (editingTradeId !== null) {
        if (text) text.textContent = 'کارمزد ثبت‌شدهٔ همین معامله حفظ می‌شود';
        return;
    }
    
    const vip = getAccountVip(activeAccount);
    input.value = String(getTotalFeePercent(vip));
    if (text) {
        const e = (getFeeRate(vip, DEFAULT_ENTRY_ORDER) * 100).toFixed(3);
        const x = (getFeeRate(vip, DEFAULT_EXIT_ORDER) * 100).toFixed(3);
        text.textContent = `${vipLabel(vip)} · ورود تیکر ${e}٪ + خروج تیکر ${x}٪`;
    }
}

async function setAccountVip(accountId, vipLevel) {
    const acc = accounts.find(a => a.id === accountId);
    if (!acc) return;
    acc.vipLevel = normalizeVip(vipLevel);
    if (activeAccount && activeAccount.id === acc.id) activeAccount = acc;
    await saveAccountsToDB();
    updateAccountsList();
    syncAutoFee();
    calculateRisk();
    showNotification(`سطح ${vipLabel(acc.vipLevel)} برای حساب «${acc.name}» ثبت شد.`, 'success');
}

function calculateRisk() {
    syncAutoFee();
    const entryPriceStr = document.getElementById('entryPrice').value.trim();
    const stopLossStr = document.getElementById('stopLoss').value.trim();
    const takeProfitStr = document.getElementById('takeProfit').value.trim();
    const riskPercentStr = document.getElementById('riskPercent').value.trim();
    const feePercentStr = document.getElementById('feePercent').value.trim();
    const type = document.getElementById('type').value;
    
    const entryPrice = parseFloat(entryPriceStr) || 0;
    const stopLoss = parseFloat(stopLossStr) || 0;
    const takeProfit = parseFloat(takeProfitStr) || 0;
    const riskPercent = parseFloat(riskPercentStr) || 0;
    const totalFeePercent = parseFloat(feePercentStr) || 0;
    
    if (entryPrice <= 0 || stopLoss <= 0 || takeProfit <= 0 || riskPercent <= 0 || !type) {
        document.getElementById('feeDetails').style.display = 'none';
        document.getElementById('riskAmount').textContent = '$0';
        document.getElementById('potentialProfit').textContent = '$0';
        document.getElementById('riskRewardRatio').textContent = '1:0';
        return;
    }
    
    const totalRiskAmount = ((editingTradeId !== null && editBaseBalance ? editBaseBalance : getEquity()) * riskPercent) / 100;
    
    let stopLossPoints, takeProfitPoints;
    
    if (type === 'buy') {
        stopLossPoints = Math.abs(entryPrice - stopLoss);
        takeProfitPoints = Math.abs(takeProfit - entryPrice);
    } else {
        stopLossPoints = Math.abs(stopLoss - entryPrice);
        takeProfitPoints = Math.abs(entryPrice - takeProfit);
    }
    
    if (stopLossPoints <= 0) {
        document.getElementById('feeDetails').style.display = 'none';
        return;
    }
    
    const feePerUnit = (entryPrice * totalFeePercent) / 100;
    const denominator = stopLossPoints + feePerUnit;
    const positionSize = denominator > 0 ? totalRiskAmount / denominator : 0;
    const positionValue = positionSize * entryPrice;
    const totalFee = (positionValue * totalFeePercent) / 100;
    const feeEntry = totalFee / 2;
    const feeExit = totalFee / 2;
    const potentialProfit = positionSize * takeProfitPoints;
    const netProfit = potentialProfit - totalFee;
    const riskRewardRatio = stopLossPoints > 0 ? (takeProfitPoints / stopLossPoints).toFixed(2) : 0;
    
    document.getElementById('riskAmount').textContent = formatCurrency(totalRiskAmount);
    document.getElementById('potentialProfit').textContent = formatCurrency(potentialProfit);
    document.getElementById('riskRewardRatio').textContent = '1:' + riskRewardRatio;
    
    document.getElementById('feeEntryAmount').textContent = formatCurrency(feeEntry);
    document.getElementById('feeExitAmount').textContent = formatCurrency(feeExit);
    document.getElementById('totalFeeAmount').textContent = formatCurrency(totalFee);
    document.getElementById('grossLossAmount').textContent = formatCurrency(positionSize * stopLossPoints);
    document.getElementById('totalLossAmount').textContent = formatCurrency(positionSize * stopLossPoints + totalFee);
    document.getElementById('netProfitAmount').textContent = formatCurrency(netProfit);
    document.getElementById('feeDetails').style.display = 'block';
    
    return {
        totalRiskAmount, positionSize, positionValue, potentialProfit, netProfit,
        riskRewardRatio, totalFeePercent, feeEntry, feeExit, totalFee,
        entryPriceStr, stopLossStr, takeProfitStr
    };
}

// ============================
// ثبت معامله جدید
// ============================
document.getElementById('tradeForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    syncAutoFee();
    
    const entryPriceStr = document.getElementById('entryPrice').value.trim();
    const stopLossStr = document.getElementById('stopLoss').value.trim();
    const takeProfitStr = document.getElementById('takeProfit').value.trim();
    const riskPercentStr = document.getElementById('riskPercent').value.trim();
    const feePercentStr = document.getElementById('feePercent').value.trim();
    
    const entryPrice = parseFloat(entryPriceStr);
    const stopLoss = parseFloat(stopLossStr);
    const takeProfit = parseFloat(takeProfitStr);
    const riskPercent = parseFloat(riskPercentStr);
    const totalFeePercent = parseFloat(feePercentStr) || 0;
    
    if (isNaN(entryPrice) || entryPrice <= 0 || 
        isNaN(stopLoss) || stopLoss <= 0 || 
        isNaN(takeProfit) || takeProfit <= 0 || 
        isNaN(riskPercent) || riskPercent <= 0) {
        showNotification('لطفاً تمام فیلدهای ضروری را به درستی پر کنید.', 'error');
        return;
    }
    
    const type = document.getElementById('type').value;
    if (!type) {
        showNotification('لطفاً نوع معامله را انتخاب کنید.', 'error');
        return;
    }
    
    if (type === 'buy' && stopLoss >= entryPrice) {
        showNotification('برای لانگ، حد ضرر باید کمتر از قیمت ورود باشد.', 'error');
        return;
    }
    if (type === 'sell' && stopLoss <= entryPrice) {
        showNotification('برای شورت، حد ضرر باید بیشتر از قیمت ورود باشد.', 'error');
        return;
    }
    
    if (type === 'buy' && takeProfit <= entryPrice) {
        showNotification('برای لانگ، حد سود باید بیشتر از قیمت ورود باشد.', 'error');
        return;
    }
    if (type === 'sell' && takeProfit >= entryPrice) {
        showNotification('برای شورت، حد سود باید کمتر از قیمت ورود باشد.', 'error');
        return;
    }

    const riskData = calculateRisk();
    if (!riskData) {
        showNotification('خطا در محاسبات ریسک.', 'error');
        return;
    }
    
    const tradeUID = generateUID();
    
    const entryScreenshotPreview = document.getElementById('entryScreenshotPreview');
    let entryScreenshot = null;
    let entryScreenshotName = null;
    
    if (entryScreenshotPreview.src) {
        entryScreenshot = entryScreenshotPreview.src;
        entryScreenshotName = `entry_${tradeUID}.png`;
    }
    
    const trade = {
        id: Date.now(),
        uid: tradeUID,
        symbol: document.getElementById('symbol').value.toUpperCase(),
        date: document.getElementById('date').value,
        type: type,
        entryPrice: entryPrice,
        entryPriceStr: entryPriceStr,
        stopLoss: stopLoss,
        stopLossStr: stopLossStr,
        takeProfit: takeProfit,
        takeProfitStr: takeProfitStr,
        riskPercent: riskPercent,
        totalFeePercent: totalFeePercent,
        feeEntry: riskData.feeEntry,
        feeExit: riskData.feeExit,
        totalFee: riskData.totalFee,
        status: 'open',
        closedPrice: null,
        closedDate: null,
        entryScreenshot: entryScreenshot,
        entryScreenshotName: entryScreenshotName,
        exitScreenshot: null,
        exitScreenshotName: null,
        totalRiskAmount: riskData.totalRiskAmount,
        positionSize: riskData.positionSize,
        positionValue: riskData.positionValue,
        potentialProfit: riskData.potentialProfit,
        netProfit: riskData.netProfit,
        riskRewardRatio: riskData.riskRewardRatio,
        strategy: document.getElementById('strategy').value.trim(),
        notes: document.getElementById('notes').value.trim(),
        accountId: activeAccountId
    };
    
    const isEditing = editingTradeId !== null;
    let exitFollowed = false;
    if (isEditing) {
        const orig = await db.getTradeById(editingTradeId);
        if (orig) {
            trade.id = orig.id;
            trade.uid = orig.uid;
            trade.status = orig.status;
            trade.closedPrice = orig.closedPrice;
            if (orig.status === 'closed') {
                const cp = Number(orig.closedPrice);
                const same = (x, y) => Math.abs(x - y) <= 1e-9 * Math.max(1, Math.abs(y));
                if (same(cp, orig.takeProfit) && !same(trade.takeProfit, orig.takeProfit)) { trade.closedPrice = trade.takeProfit; exitFollowed = true; }
                else if (same(cp, orig.stopLoss) && !same(trade.stopLoss, orig.stopLoss)) { trade.closedPrice = trade.stopLoss; exitFollowed = true; }
            }
            if (orig.actualFee != null) {
                trade.actualFee = orig.actualFee; trade.totalFee = orig.actualFee;
                trade.feeEntry = orig.actualFee / 2; trade.feeExit = orig.actualFee / 2;
            }
            trade.closedDate = orig.closedDate;
            trade.exitScreenshot = orig.exitScreenshot;
            trade.exitScreenshotName = orig.exitScreenshotName;
            trade.accountId = orig.accountId;
            if (!trade.entryScreenshot) {
                trade.entryScreenshot = orig.entryScreenshot;
                trade.entryScreenshotName = orig.entryScreenshotName;
            } else {
                trade.entryScreenshotName = `entry_${orig.uid}.png`;
            }
        }
    }

    const saved = await saveTradeToDB(trade);
    if (!saved) return;
    editingTradeId = null;
    editBaseBalance = null;
    
    loadTrades();
    updateStats();
    updateDetailedStats();
    updateTotalRisk();
    loadOpenTrades();
    updateGrowthChart();
    updateMonthlyGrowthChart();
    
    setInitialMonthBasedOnLastTrade();
    updateMonthlyDashboard();
    
    this.reset();
    
    const now = new Date();
    const timezoneOffset = now.getTimezoneOffset() * 60000;
    const localISOTime = new Date(now - timezoneOffset).toISOString().slice(0, 16);
    document.getElementById('date').value = localISOTime;
    document.getElementById('type').value = '';
    document.getElementById('feeDetails').style.display = 'none';
    syncAutoFee();
    
    removeEntryScreenshot();
    
    showNotification(isEditing ? (exitFollowed ? 'ویرایش ذخیره شد و قیمت خروج هم با حد جدید به‌روز شد.' : 'ویرایش معامله ذخیره شد.') : 'معامله با موفقیت ثبت شد!', 'success');
});

function calculateTradeRisk(trade) {
    let stopLossPoints;
    
    if (trade.type === 'buy') {
        stopLossPoints = Math.abs(trade.entryPrice - trade.stopLoss);
    } else {
        stopLossPoints = Math.abs(trade.stopLoss - trade.entryPrice);
    }
    
    const totalRiskAmount = (getEquity() * trade.riskPercent) / 100;
    const feePerUnit = (trade.entryPrice * (trade.totalFeePercent || 0)) / 100;
    const denominator = stopLossPoints + feePerUnit;
    const positionSize = denominator > 0 ? totalRiskAmount / denominator : 0;
    
    return { totalRiskAmount, positionSize };
}

function loadTrades() {
    const tbody = document.getElementById('tradesTableBody');
    const noTradesMessage = document.getElementById('noTradesMessage');
    
    const allAccountTrades = trades.filter(trade => trade.accountId === activeAccountId);
    const accountTrades = applyHistoryFilters(allAccountTrades);
    const countEl = document.getElementById('histCount');
    if (countEl) countEl.textContent = accountTrades.length === allAccountTrades.length ? `${allAccountTrades.length} معامله` : `${accountTrades.length} از ${allAccountTrades.length} معامله`;
    
    if (accountTrades.length === 0) {
        tbody.innerHTML = '';
        noTradesMessage.style.display = 'block';
        return;
    }
    
    noTradesMessage.style.display = 'none';
    
    const sortedTrades = [...accountTrades].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    let html = '';
    sortedTrades.forEach(trade => {
        const pnl = calculateTradePnL(trade);
        const pnlClass = pnl > 0 ? 'profit' : (pnl < 0 ? 'loss' : 'neutral');
        const pnlText = trade.status === 'closed' ? 
            (pnl >= 0 ? '+' : '−') + formatCurrency(Math.abs(pnl)) : 
            'باز';
        
        const typeText = trade.type === 'buy' ? 'لانگ' : 'شورت';
        const statusText = trade.status === 'open' ? 'باز' : 'بسته';
        const statusClass = trade.status === 'open' ? 'chip chip-open' : 'chip chip-closed';
        const rowClass = trade.status === 'open' ? 'row-open' : (pnl > 0 ? 'row-win' : (pnl < 0 ? 'row-loss' : 'row-flat'));
        const typeChip = `<span class="chip ${trade.type === 'buy' ? 'chip-long' : 'chip-short'}">${typeText}</span>`;
        const feeText = trade.totalFeePercent > 0 ? `${trade.totalFeePercent}%` : '-';
        
        const dateText = formatPersianDate(trade.date, true);
        
        const screenshotIcon = trade.entryScreenshot ? 
            '<i class="fas fa-camera" style="color: #3b82f6; margin-right: 5px;" title="اسکرین‌شات موجود است"></i>' : '';
        
        html += `
        <tr class="${rowClass}">
            <td data-label="ارز">
                <div class="crypto-badge">
                    <i class="fas fa-coins"></i>
                    ${escapeHTML(trade.symbol)} ${screenshotIcon}
                </div>
            </td>
            <td data-label="تاریخ">${dateText}</td>
            <td data-label="نوع">${typeChip}</td>
            <td class="price-display" data-label="ورود">${trade.entryPriceStr || trade.entryPrice}</td>
            <td class="price-display" data-label="حد ضرر">${trade.stopLossStr || trade.stopLoss}</td>
            <td class="price-display" data-label="حد سود">${trade.takeProfitStr || trade.takeProfit}</td>
            <td data-label="ریسک">${trade.riskPercent.toFixed(2)}%</td>
            <td data-label="کارمزد">${feeText}</td>
            <td data-label="وضعیت"><span class="${statusClass}">${statusText}</span></td>
            <td data-label="سود/ضرر"><span class="${pnlClass}">${pnlText}</span></td>
            <td class="actions">
                <button class="btn-icon" onclick="showTradeDetails(${trade.id})" style="background-color: rgba(14, 165, 233, 0.1); color: #0ea5e9; border: 1px solid rgba(14, 165, 233, 0.3);" title="مشاهده جزئیات">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn-icon" onclick="editTrade(${trade.id})" style="background-color: rgba(245, 158, 11, 0.1); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3);" title="ویرایش معامله">
                    <i class="fas fa-edit"></i>
                </button>
                ${trade.status === 'closed' ? `<button class="btn-icon" onclick="openCloseModal(${trade.id})" style="background-color: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3);" title="ویرایش خروج"><i class="fas fa-flag-checkered"></i></button>` : ''}
                <button class="btn-icon" onclick="deleteTrade(${trade.id})" style="background-color: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3);" title="حذف معامله">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

async function showTradeDetails(tradeId) {
    const trade = trades.find(t => t.id === tradeId);
    if (!trade) return;
    
    const detailsModal = document.getElementById('detailsModal');
    
    document.getElementById('detail-symbol').textContent = trade.symbol;
    document.getElementById('detail-type').textContent = trade.type === 'buy' ? 'لانگ' : 'شورت';
    
    const dateText = formatPersianDate(trade.date, true);
    document.getElementById('detail-date').textContent = dateText;
    
    const statusText = trade.status === 'open' ? 'باز' : 'بسته';
    const statusClass = trade.status === 'open' ? 'profit' : 'neutral';
    const statusElement = document.getElementById('detail-status');
    statusElement.textContent = statusText;
    statusElement.className = 'detail-value ' + statusClass;
    
    document.getElementById('detail-entry').textContent = trade.entryPriceStr || trade.entryPrice;
    document.getElementById('detail-sl').textContent = trade.stopLossStr || trade.stopLoss;
    document.getElementById('detail-tp').textContent = trade.takeProfitStr || trade.takeProfit;
    
    document.getElementById('detail-risk-percent').textContent = trade.riskPercent.toFixed(2) + '%';
    document.getElementById('detail-risk-amount').textContent = formatCurrency(trade.totalRiskAmount || 0);
    document.getElementById('detail-position-size').textContent = formatNumber(trade.positionSize || 0);
    document.getElementById('detail-rr').textContent = '1:' + (trade.riskRewardRatio || 0);
    
    document.getElementById('detail-fee-entry').textContent = formatCurrency(trade.feeEntry || 0);
    document.getElementById('detail-fee-exit').textContent = formatCurrency(trade.feeExit || 0);
    document.getElementById('detail-total-fee').textContent = formatCurrency(trade.totalFee || 0);
    
    const entryScreenshotImg = document.getElementById('detail-screenshot-entry');
    const entryPlaceholder = document.getElementById('detail-screenshot-entry-placeholder');
    const exitScreenshotImg = document.getElementById('detail-screenshot-exit');
    const exitPlaceholder = document.getElementById('detail-screenshot-exit-placeholder');
    
    if (trade.entryScreenshot) {
        entryScreenshotImg.src = trade.entryScreenshot;
        entryScreenshotImg.style.display = 'inline';
        entryPlaceholder.style.display = 'none';
    } else {
        entryScreenshotImg.style.display = 'none';
        entryPlaceholder.style.display = 'block';
    }
    
    if (trade.exitScreenshot) {
        exitScreenshotImg.src = trade.exitScreenshot;
        exitScreenshotImg.style.display = 'inline';
        exitPlaceholder.style.display = 'none';
    } else {
        exitScreenshotImg.style.display = 'none';
        exitPlaceholder.style.display = 'block';
    }
    
    const jr = document.getElementById('detail-journal-section');
    const jItems = [['استراتژی', trade.strategy], ['یادداشت', trade.notes]].filter(i => i[1]);
    jr.style.display = jItems.length ? 'block' : 'none';
    jr.innerHTML = jItems.length ? '<div class="detail-section-title"><i class="fas fa-book"></i> ژورنال</div><div class="details-grid">' +
        jItems.map(([l, v]) => `<div class="detail-item"><span class="detail-label">${l}</span><div class="detail-value">${escapeHTML(v)}</div></div>`).join('') + '</div>' : '';
    
    if (trade.status === 'closed') {
        document.getElementById('detail-closed-price-container').style.display = 'block';
        document.getElementById('detail-result-section').style.display = 'block';
        
        document.getElementById('detail-closed-price').textContent = trade.closedPrice || '0';
        
        const pnl = calculateTradePnL(trade);
        const pnlElement = document.getElementById('detail-net-pnl');
        pnlElement.textContent = (pnl >= 0 ? '+' : '−') + formatCurrency(Math.abs(pnl));
        pnlElement.style.color = pnl >= 0 ? '#10b981' : '#ef4444';
        
        let priceDifference;
        if (trade.type === 'buy') {
            priceDifference = trade.closedPrice - trade.entryPrice;
        } else {
            priceDifference = trade.entryPrice - trade.closedPrice;
        }
        const grossPnl = trade.positionSize * priceDifference;
        
        document.getElementById('detail-gross-pnl').textContent = 
            (grossPnl >= 0 ? '+' : '') + formatCurrency(Math.abs(grossPnl));
        document.getElementById('detail-gross-pnl').style.color = 
            grossPnl >= 0 ? '#10b981' : '#ef4444';
        
        document.getElementById('detail-fee-deducted').textContent = formatCurrency(trade.totalFee || 0);
        
        if (trade.closedDate) {
            const closedDateText = formatPersianDate(trade.closedDate, true);
            document.getElementById('detail-closed-date').textContent = closedDateText;
        }
    } else {
        document.getElementById('detail-closed-price-container').style.display = 'none';
        document.getElementById('detail-result-section').style.display = 'none';
    }
    
    detailsModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeDetailsModal() {
    document.getElementById('detailsModal').style.display = 'none';
    document.body.style.overflow = 'auto';
}

function openCloseModal(tradeId) {
    currentTradeIdForClose = tradeId;
    const tClose = trades.find(x => x.id === tradeId);
    document.getElementById('closePriceInput').value = tClose && tClose.status === 'closed' ? tClose.closedPrice : '';
    document.getElementById('closeFeeInput').value = tClose && tClose.actualFee != null ? tClose.actualFee : '';
    removeCloseScreenshot();
    document.getElementById('closeTradeModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeCloseModal() {
    document.getElementById('closeTradeModal').style.display = 'none';
    document.body.style.overflow = 'auto';
    currentTradeIdForClose = null;
    closeScreenshotData = null;
}

async function confirmCloseTrade() {
    const closePrice = document.getElementById('closePriceInput').value.trim();
    
    if (!closePrice || isNaN(parseFloat(closePrice)) || parseFloat(closePrice) <= 0) {
        showNotification('لطفاً قیمت معتبر وارد کنید.', 'error');
        return;
    }
    
    if (!currentTradeIdForClose) return;
    
    const tradeIndex = trades.findIndex(t => t.id === currentTradeIdForClose);
    if (tradeIndex !== -1) {
        const trade = trades[tradeIndex];
        
        trades[tradeIndex].status = 'closed';
        trades[tradeIndex].closedPrice = parseFloat(closePrice);
        trades[tradeIndex].closedDate = trades[tradeIndex].closedDate && trade.status === 'closed' ? trades[tradeIndex].closedDate : new Date().toISOString();
        const feeStr = document.getElementById('closeFeeInput').value.trim();
        if (feeStr !== '' && !isNaN(parseFloat(feeStr)) && parseFloat(feeStr) >= 0) {
            const f = parseFloat(feeStr);
            trades[tradeIndex].totalFee = f; trades[tradeIndex].feeEntry = f / 2; trades[tradeIndex].feeExit = f / 2; trades[tradeIndex].actualFee = f;
        }
        
        if (closeScreenshotData) {
            const exitScreenshotName = `exit_${trade.uid}.png`;
            trades[tradeIndex].exitScreenshot = closeScreenshotData;
            trades[tradeIndex].exitScreenshotName = exitScreenshotName;
        }
        
        await saveTradeToDB(trades[tradeIndex]);
        
        loadTrades();
        updateStats();
        updateDetailedStats();
        updateTotalRisk();
        updateMonthlyDashboard();
        loadOpenTrades();
        updateGrowthChart();
        updateMonthlyGrowthChart();
        
        closeCloseModal();
        
        const priceDiff = trade.type === 'buy' 
            ? parseFloat(closePrice) - trade.entryPrice
            : trade.entryPrice - parseFloat(closePrice);
        const pnl = priceDiff * trade.positionSize - (trade.totalFee || 0);
        
        showNotification(`معامله بسته شد. ${pnl >= 0 ? 'سود' : 'ضرر'}: ${formatCurrency(Math.abs(pnl))}`, pnl >= 0 ? 'success' : 'warning');
    }
}

function calculateTradePnL(trade) {
    if (trade.status !== 'closed' || !trade.closedPrice) return 0;
    
    let priceDifference;
    
    if (trade.type === 'buy') {
        priceDifference = trade.closedPrice - trade.entryPrice;
    } else {
        priceDifference = trade.entryPrice - trade.closedPrice;
    }
    
    const grossPnl = trade.positionSize * priceDifference;
    const netPnl = grossPnl - (trade.totalFee || 0);
    
    return netPnl;
}

function calculateTotalPnL() {
    let total = 0;
    trades.forEach(trade => {
        total += calculateTradePnL(trade);
    });
    return total;
}

function calculateTotalProfit() {
    let total = 0;
    trades.forEach(trade => {
        const pnl = calculateTradePnL(trade);
        if (pnl > 0) total += pnl;
    });
    return total;
}

function calculateTotalLoss() {
    let total = 0;
    trades.forEach(trade => {
        const pnl = calculateTradePnL(trade);
        if (pnl < 0) total += Math.abs(pnl);
    });
    return total;
}

function calculateTotalFees() {
    let total = 0;
    trades.forEach(trade => {
        total += trade.totalFee || 0;
    });
    return total;
}

function updateStats() {
    updateBalanceDisplay();
    renderAdvancedStats();
    refreshStrategyList();
    if (trades.length === 0) {
        resetStats();
        return;
    }
    
    const closedTrades = trades.filter(t => t.status === 'closed');
    const openTrades = trades.filter(t => t.status === 'open');
    const totalTrades = trades.length;
    
    let profitableTrades = 0;
    let maxProfit = 0;
    let maxLoss = 0;
    
    closedTrades.forEach(trade => {
        const pnl = calculateTradePnL(trade);
        if (pnl > 0) {
            profitableTrades++;
            if (pnl > maxProfit) maxProfit = pnl;
        } else if (pnl < maxLoss) {
            maxLoss = pnl;
        }
    });
    
    const totalProfit = calculateTotalProfit();
    const totalLoss = calculateTotalLoss();
    const totalFees = calculateTotalFees();
    const winRate = closedTrades.length > 0 ? (profitableTrades / closedTrades.length) * 100 : 0;
    
    document.getElementById('totalTrades').textContent = totalTrades;
    document.getElementById('openTrades').textContent = openTrades.length;
    document.getElementById('totalProfit').textContent = formatCurrency(totalProfit);
    document.getElementById('totalLoss').textContent = formatCurrency(totalLoss);
    document.getElementById('totalFees').textContent = formatCurrency(totalFees);
    document.getElementById('winRate').textContent = winRate.toFixed(1) + '%';
    document.getElementById('maxProfit').textContent = '+' + formatCurrency(Math.abs(maxProfit));
    document.getElementById('maxLoss').textContent = formatCurrency(Math.abs(maxLoss));
}

function resetStats() {
    document.getElementById('totalTrades').textContent = '0';
    document.getElementById('openTrades').textContent = '0';
    document.getElementById('totalProfit').textContent = '$0.00';
    document.getElementById('totalLoss').textContent = '$0.00';
    document.getElementById('totalFees').textContent = '$0.00';
    document.getElementById('winRate').textContent = '0%';
    document.getElementById('maxProfit').textContent = '$0.00';
    document.getElementById('maxLoss').textContent = '$0.00';
}

async function editTrade(id) {
    const trade = trades.find(t => t.id === id);
    if (!trade) return;
    
    document.getElementById('symbol').value = trade.symbol;
    document.getElementById('date').value = trade.date;
    document.getElementById('type').value = trade.type;
    document.getElementById('entryPrice').value = trade.entryPriceStr || trade.entryPrice;
    document.getElementById('stopLoss').value = trade.stopLossStr || trade.stopLoss;
    document.getElementById('takeProfit').value = trade.takeProfitStr || trade.takeProfit;
    document.getElementById('riskPercent').value = trade.riskPercent;
    document.getElementById('feePercent').value = trade.totalFeePercent ?? '';
    refreshStrategyList(trade.strategy || '');
    document.getElementById('notes').value = trade.notes || '';
    
    editBaseBalance = (trade.riskPercent > 0 && trade.totalRiskAmount > 0) ? trade.totalRiskAmount * 100 / trade.riskPercent : null;
    editingTradeId = id;
    
    calculateRisk();
    showNotification('در حال ویرایش معامله. با ثبت فرم، تغییرات ذخیره می‌شود.', 'info');
    
    switchSection('trade-form');
    loadOpenTrades();
}

async function deleteTrade(id) {
    if (confirm('آیا از حذف این معامله اطمینان دارید؟')) {
        await deleteTradeFromDB(id);
        
        loadTrades();
        updateStats();
        updateDetailedStats();
        updateTotalRisk();
        loadOpenTrades();
        updateGrowthChart();
        updateMonthlyGrowthChart();
        setInitialMonthBasedOnLastTrade();
        updateMonthlyDashboard();
        showNotification('معامله حذف شد.', 'warning');
    }
}

function updateAccountsList() {
    const container = document.getElementById('accountsListContainer');
    if (!container) {
        console.error('❌ container accountsListContainer یافت نشد');
        return;
    }
    
    console.log('📊 به‌روزرسانی لیست حساب‌ها:', accounts);
    
    if (!accounts || accounts.length === 0) {
        container.innerHTML = '<div class="account-item" style="justify-content: center;">هیچ حسابی وجود ندارد</div>';
        return;
    }
    
    let html = '';
    
    accounts.forEach(account => {
        const isActive = account.id === activeAccountId;
        
        html += `
            <div class="account-item ${isActive ? 'active-account' : ''}">
                <div class="account-info">
                    <div class="account-name">${escapeHTML(account.name)}</div>
                    <div class="account-balance">${formatCurrency(account.balance)}</div>
                    ${isActive ? '<div class="active-badge">فعال</div>' : ''}
                </div>
                <div class="account-vip">
                    <select class="account-vip-select" onchange="setAccountVip(${account.id}, this.value)" title="سطح VIP این حساب">
                        ${vipOptionsHTML(account.vipLevel)}
                    </select>
                </div>
                <div class="account-actions">
                    <button class="account-action-btn" onclick="switchAccount(${account.id})" ${isActive ? 'disabled' : ''} title="انتخاب به عنوان حساب فعال">
                        <i class="fas fa-check-circle"></i>
                    </button>
                    <button class="account-action-btn delete" onclick="deleteAccount(${account.id})" ${account.id === 1 ? 'disabled' : ''} title="حذف حساب">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    console.log('✅ لیست حساب‌ها به‌روزرسانی شد');
}

async function addNewAccount() {
    const newAccountName = document.getElementById('newAccountName').value.trim();
    const newAccountBalance = parseFloat(document.getElementById('newAccountBalance').value);
    const newAccountVip = normalizeVip(document.getElementById('newAccountVip').value);
    
    if (!newAccountName) {
        showNotification('لطفاً نام حساب را وارد کنید.', 'error');
        return;
    }
    
    if (isNaN(newAccountBalance) || newAccountBalance <= 0) {
        showNotification('لطفاً موجودی اولیه معتبر وارد کنید.', 'error');
        return;
    }
    
    const existingAccount = accounts.find(acc => acc.name.toLowerCase() === newAccountName.toLowerCase());
    if (existingAccount) {
        showNotification('حسابی با این نام از قبل وجود دارد.', 'error');
        return;
    }
    
    const newAccountId = accounts.length > 0 ? Math.max(...accounts.map(acc => acc.id)) + 1 : 1;
    
    const newAccount = {
        id: newAccountId,
        name: newAccountName,
        balance: newAccountBalance,
        vipLevel: newAccountVip
    };
    
    accounts.push(newAccount);
    
    await saveAccountsToDB();
    
    document.getElementById('newAccountName').value = '';
    document.getElementById('newAccountBalance').value = '';
    
    updateAccountsList();
    showNotification('حساب جدید با موفقیت اضافه شد.', 'success');
}

async function deleteAccount(accountId) {
    if (accountId === 1) {
        showNotification('حساب اصلی قابل حذف نیست.', 'error');
        return;
    }
    
    if (accounts.length <= 1) {
        showNotification('حداقل باید یک حساب وجود داشته باشد.', 'error');
        return;
    }
    
    if (confirm('آیا از حذف این حساب اطمینان دارید؟ تمام معاملات مربوط به این حساب نیز حذف خواهند شد.')) {
        accounts = accounts.filter(acc => acc.id !== accountId);
        
        const accountTrades = await db.getTradesByAccount(accountId);
        const tradesToDelete = accountTrades.map(t => t.id);
        if (tradesToDelete.length > 0) {
            await db.deleteTrades(tradesToDelete);
        }
        
        if (accountId === activeAccountId) {
            activeAccountId = 1;
            activeAccount = accounts.find(acc => acc.id === 1);
            accountBalance = activeAccount ? activeAccount.balance : 0;
            initialAccountBalance = accountBalance;
        }
        trades = await db.getTradesByAccount(activeAccountId);
        
        await saveAccountsToDB();
        
        updateBalanceDisplay();
        updateAccountsList();
        loadTrades();
        loadOpenTrades();
        updateStats();
        updateDetailedStats();
        updateTotalRisk();
        updateGrowthChart();
        updateMonthlyGrowthChart();
        setInitialMonthBasedOnLastTrade();
        updateMonthlyDashboard();
        
        showNotification('حساب و معاملات مربوطه حذف شدند.', 'warning');
    }
}

async function switchAccount(accountId) {
    const newActiveAccount = accounts.find(acc => acc.id === accountId);
    if (!newActiveAccount) {
        showNotification('حساب مورد نظر یافت نشد.', 'error');
        return;
    }
    
    activeAccountId = accountId;
    activeAccount = newActiveAccount;
    accountBalance = activeAccount.balance;
    initialAccountBalance = accountBalance;
    
    await db.saveSetting('activeAccountId', activeAccountId.toString());
    
    trades = await db.getTradesByAccount(activeAccountId);
    
    updateBalanceDisplay();
    updateAccountsList();
    loadTrades();
    loadOpenTrades();
    updateStats();
    updateDetailedStats();
    updateTotalRisk();
    updateGrowthChart();
    updateMonthlyGrowthChart();
    setInitialMonthBasedOnLastTrade();
    updateMonthlyDashboard();
    calculateRisk();
    
    showNotification(`حساب "${activeAccount.name}" فعال شد.`, 'success');
    closeAllModals();
}

// ============================
// توابع داشبورد ماهانه
// ============================
function changeMonth(direction) {
    let newMonth = currentMonth + direction;
    let newYear = currentYear;
    
    if (newMonth > 12) {
        newMonth = 1;
        newYear++;
    } else if (newMonth < 1) {
        newMonth = 12;
        newYear--;
    }
    
    currentYear = newYear;
    currentMonth = newMonth;
    
    updateMonthlyDashboard();
    updateMonthlyGrowthChart();
}

function updateMonthlyDashboard() {
    const monthDisplay = document.getElementById('currentMonthDisplay');
    monthDisplay.textContent = persianMonths[currentMonth - 1] + ' ' + currentYear;
    
    const now = new Date();
    const nowPersian = getPersianDateParts(now);
    const prevBtn = document.getElementById('prevMonthBtn');
    const nextBtn = document.getElementById('nextMonthBtn');
    
    if (nowPersian && currentYear === nowPersian.year && currentMonth === nowPersian.month) {
        nextBtn.disabled = true;
    } else {
        nextBtn.disabled = false;
    }
    
    const monthlyTrades = trades.filter(trade => {
        if (trade.accountId !== activeAccountId) return false;
        
        const persianDate = getPersianDateParts(trade.date);
        if (!persianDate) return false;
        
        return persianDate.year === currentYear && persianDate.month === currentMonth;
    });
    
    document.getElementById('monthlyTradeCount').textContent = monthlyTrades.length;
    
    let totalPnL = 0;
    let profitable = 0;
    let loss = 0;
    
    monthlyTrades.forEach(trade => {
        if (trade.status === 'closed') {
            const pnl = calculateTradePnL(trade);
            totalPnL += pnl;
            if (pnl > 0) profitable++;
            else if (pnl < 0) loss++;
        }
    });
    
    const totalPnLElement = document.getElementById('monthlyTotalPnL');
    totalPnLElement.textContent = (totalPnL >= 0 ? '+' : '') + formatCurrency(Math.abs(totalPnL));
    totalPnLElement.style.color = totalPnL >= 0 ? '#10b981' : '#ef4444';
    
    document.getElementById('monthlyProfitable').textContent = profitable;
    document.getElementById('monthlyLoss').textContent = loss;
    
    const tbody = document.getElementById('monthlyTradesBody');
    
    if (monthlyTrades.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="no-trades-month">
                    <i class="fas fa-chart-line" style="font-size: 2rem; margin-bottom: 15px; display: block;"></i>
                    هیچ معامله‌ای در این ماه وجود ندارد
                </td>
            </tr>
        `;
        return;
    }
    
    const sortedTrades = [...monthlyTrades].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    let html = '';
    sortedTrades.forEach(trade => {
        const dateText = formatPersianDate(trade.date, true);
        
        const typeText = trade.type === 'buy' ? 'لانگ' : 'شورت';
        const statusText = trade.status === 'open' ? 'باز' : 'بسته';
        
        let pnlText = 'باز';
        let pnlClass = 'neutral';
        
        if (trade.status === 'closed') {
            const pnl = calculateTradePnL(trade);
            pnlText = (pnl >= 0 ? '+' : '−') + formatCurrency(Math.abs(pnl));
            pnlClass = pnl > 0 ? 'profit' : (pnl < 0 ? 'loss' : 'neutral');
        }
        
        html += `
            <tr onclick="showTradeDetails(${trade.id})">
                <td data-label="تاریخ">${dateText}</td>
                <td data-label="ارز"><span class="crypto-badge" style="font-size: 0.8rem;">${escapeHTML(trade.symbol)}</span></td>
                <td data-label="نوع">${typeText}</td>
                <td class="price-display" data-label="ورود">${trade.entryPriceStr || trade.entryPrice}</td>
                <td class="price-display" data-label="خروج">${trade.status === 'closed' ? trade.closedPrice : '-'}</td>
                <td data-label="سود/ضرر"><span class="${pnlClass}">${pnlText}</span></td>
                <td data-label="وضعیت"><span class="${trade.status === 'open' ? 'profit' : 'neutral'}">${statusText}</span></td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

// ============================
// توابع پشتیبان‌گیری
// ============================
function showProgress(message, percent = 0) {
    const progressDiv = document.getElementById('backupProgress');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const progressStatus = document.getElementById('progressStatus');
    
    progressDiv.classList.add('active');
    progressBar.style.width = percent + '%';
    progressText.textContent = message;
    progressStatus.textContent = percent + '%';
    
    document.getElementById('cancelImportBtn').style.display = 'inline-block';
}

function hideProgress() {
    const progressDiv = document.getElementById('backupProgress');
    progressDiv.classList.remove('active');
    document.getElementById('cancelImportBtn').style.display = 'none';
}

function cancelImport() {
    isImportCancelled = true;
    hideProgress();
    showNotification('عملیات لغو شد', 'warning');
}

async function exportData() {
    try {
        showProgress('در حال آماده‌سازی داده‌ها...', 10);
        
        const backupData = await db.backup();
        
        showProgress('در حال ایجاد فایل ZIP...', 30);
        
        const zip = new JSZip();
        
        const exportTrades = backupData.trades.map(trade => ({
            ...trade,
            entryScreenshot: trade.entryScreenshotName || null,
            exitScreenshot: trade.exitScreenshotName || null
        }));
        
        const exportData = {
            ...backupData,
            trades: exportTrades
        };
        
        zip.file('data.json', JSON.stringify(exportData, null, 2));
        
        showProgress('در حال پردازش تصاویر...', 50);
        
        const imagesFolder = zip.folder('images');
        
        let imageCount = 0;
        backupData.trades.forEach(trade => {
            if (trade.entryScreenshot) imageCount++;
            if (trade.exitScreenshot) imageCount++;
        });
        
        let processedImages = 0;
        
        for (const trade of backupData.trades) {
            if (isImportCancelled) {
                showNotification('عملیات لغو شد', 'warning');
                hideProgress();
                return;
            }
            
            if (trade.entryScreenshot && trade.entryScreenshotName) {
                const base64Data = trade.entryScreenshot.split(',')[1];
                imagesFolder.file(trade.entryScreenshotName, base64Data, { base64: true });
                
                processedImages++;
                const percent = 50 + Math.floor((processedImages / imageCount) * 40);
                showProgress(`در حال پردازش تصویر ${processedImages} از ${imageCount}...`, percent);
            }
            if (trade.exitScreenshot && trade.exitScreenshotName) {
                const base64Data = trade.exitScreenshot.split(',')[1];
                imagesFolder.file(trade.exitScreenshotName, base64Data, { base64: true });
                
                processedImages++;
                const percent = 50 + Math.floor((processedImages / imageCount) * 40);
                showProgress(`در حال پردازش تصویر ${processedImages} از ${imageCount}...`, percent);
            }
        }
        
        showProgress('در حال نهایی‌سازی فایل ZIP...', 90);
        
        const now = new Date();
        const persianDate = new Intl.DateTimeFormat('fa-IR', { 
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(now).replace(/\//g, '-');
        
        const fileName = `crypto-journal-${persianDate}.zip`;
        
        const content = await zip.generateAsync({ 
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });
        
        showProgress('در حال دانلود فایل...', 100);
        
        await db.saveSetting('lastBackupAt', String(Date.now()));
        if (window.navigator.standalone && navigator.canShare) {
            const shareFile = new File([content], fileName, { type: 'application/zip' });
            if (navigator.canShare({ files: [shareFile] })) {
                try {
                    await navigator.share({ files: [shareFile], title: fileName });
                    hideProgress();
                    showNotification('پشتیبان آماده ذخیره شد.', 'success');
                    return;
                } catch (shareErr) {
                    if (shareErr && shareErr.name === 'AbortError') { hideProgress(); return; }
                }
            }
        }
        
        const url = URL.createObjectURL(content);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
        
        setTimeout(hideProgress, 2000);
        showNotification('پشتیبان با موفقیت دانلود شد.', 'success');
        
    } catch (error) {
        console.error('خطا در پشتیبان‌گیری:', error);
        hideProgress();
        showNotification('خطا در پشتیبان‌گیری: ' + error.message, 'error');
    } finally {
        isImportCancelled = false;
    }
}

async function importData() {
    const fileInput = document.getElementById('backupFile');
    const file = fileInput.files[0];
    
    if (!file) {
        showNotification('لطفاً یک فایل ZIP انتخاب کنید.', 'error');
        return;
    }
    
    const MAX_SIZE = 2 * 1024 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
        showNotification('حجم فایل بیش از حد مجاز است (حداکثر ۲ گیگابایت)', 'error');
        fileInput.value = '';
        return;
    }
    
    if (!confirm('بارگذاری این فایل، اطلاعات فعلی را جایگزین می‌کند. ادامه می‌دهید؟')) {
        return;
    }
    
    isImportCancelled = false;
    importStartTime = Date.now();
    let snapshot = null;
    let wiped = false;
    const restoreSnapshot = async () => {
        if (!wiped || !snapshot) return;
        try {
            await db.clearAll();
            await db.saveAccounts(snapshot.accounts || []);
            await db.saveTrades(snapshot.trades || []);
            if (snapshot.activeId) await db.saveSetting('activeAccountId', snapshot.activeId);
            await loadAccountsFromDB();
            await loadTradesFromDB();
            updateBalanceDisplay();
            updateStats();
        } catch (restoreErr) {
            console.error('خطا در بازگردانی اطلاعات قبلی:', restoreErr);
        }
        wiped = false;
    };
    
    try {
        showProgress('در حال خواندن فایل ZIP...', 10);
        
        const zip = new JSZip();
        const zipContent = await zip.loadAsync(file);
        
        if (!zipContent.file('data.json')) {
            throw new Error('فایل ZIP معتبر نیست - فایل data.json یافت نشد');
        }
        
        showProgress('در حال استخراج اطلاعات...', 20);
        
        const dataFile = zipContent.file('data.json');
        const dataStr = await dataFile.async('string');
        const backupData = JSON.parse(dataStr);
        
        showProgress('در حال پردازش تصاویر...', 30);
        
        const imagesMap = new Map();
        
        const imagesFolder = zipContent.folder('images');
        let imageCount = 0;
        let processedImages = 0;
        
        if (imagesFolder) {
            imagesFolder.forEach(() => imageCount++);
            
            const imagePromises = [];
            imagesFolder.forEach(async (relativePath, file) => {
                if (!file.dir) {
                    const promise = file.async('base64').then(content => {
                        if (isImportCancelled) return;
                        
                        const fileName = relativePath.split('/').pop();
                        const mimeType = getMimeType(fileName);
                        
                        imagesMap.set(fileName, `data:${mimeType};base64,${content}`);
                        
                        processedImages++;
                        const percent = 30 + Math.floor((processedImages / imageCount) * 30);
                        
                        const elapsed = (Date.now() - importStartTime) / 1000;
                        const speed = processedImages / elapsed;
                        const remaining = !isNaN(speed) && speed > 0 ? (imageCount - processedImages) / speed : 0;
                        
                        showProgress(`در حال پردازش تصویر ${processedImages} از ${imageCount}${remaining > 0 ? ` - زمان باقی‌مانده: ${Math.ceil(remaining)} ثانیه` : ''}`, percent);
                    });
                    imagePromises.push(promise);
                }
            });
            
            await Promise.all(imagePromises);
            
            if (isImportCancelled) {
                showNotification('عملیات لغو شد', 'warning');
                hideProgress();
                return;
            }
        }
        
        showProgress('در حال بازسازی ارتباط عکس‌ها با معاملات...', 60);
        
        if (backupData.trades && Array.isArray(backupData.trades)) {
            for (const trade of backupData.trades) {
                if (isImportCancelled) {
                    showNotification('عملیات لغو شد', 'warning');
                    hideProgress();
                    return;
                }
                
                if (!trade.uid) {
                    trade.uid = `trade_${trade.id}`;
                }
                
                if (trade.entryScreenshot) {
                    const fileName = `entry_${trade.uid}.png`;
                    if (imagesMap.has(fileName)) {
                        trade.entryScreenshot = imagesMap.get(fileName);
                        trade.entryScreenshotName = fileName;
                        console.log(`✅ عکس ورود برای معامله ${trade.uid} بازسازی شد`);
                    } else {
                        console.warn(`⚠️ عکس ورود برای معامله ${trade.uid} یافت نشد: ${fileName}`);
                        trade.entryScreenshot = null;
                        trade.entryScreenshotName = null;
                    }
                }
                
                if (trade.exitScreenshot) {
                    const fileName = `exit_${trade.uid}.png`;
                    if (imagesMap.has(fileName)) {
                        trade.exitScreenshot = imagesMap.get(fileName);
                        trade.exitScreenshotName = fileName;
                        console.log(`✅ عکس خروج برای معامله ${trade.uid} بازسازی شد`);
                    } else {
                        console.warn(`⚠️ عکس خروج برای معامله ${trade.uid} یافت نشد: ${fileName}`);
                        trade.exitScreenshot = null;
                        trade.exitScreenshotName = null;
                    }
                }
            }
        }
        
        showProgress('در حال ذخیره در دیتابیس...', 70);
        
        snapshot = await db.backup();
        snapshot.activeId = await db.getSetting('activeAccountId');
        await db.clearAll();
        wiped = true;
        
        if (backupData.accounts && Array.isArray(backupData.accounts)) {
            await db.saveAccounts(backupData.accounts);
            accounts = backupData.accounts;
        }
        
        if (backupData.trades && Array.isArray(backupData.trades)) {
            const batchSize = 5;
            const totalTrades = backupData.trades.length;
            
            const startFrom = 0;
            
            trades = [];
            
            for (let i = startFrom; i < totalTrades; i += batchSize) {
                if (isImportCancelled) {
                    await restoreSnapshot();
                    showNotification('عملیات لغو شد - اطلاعات قبلی بازگردانده شد.', 'warning');
                    hideProgress();
                    return;
                }
                
                const batch = backupData.trades.slice(i, i + batchSize);
                
                for (const trade of batch) {
                    try {
                        await db.saveTrade(trade);
                        trades.push(trade);
                    } catch (tradeError) {
                        if (tradeError.message.includes('فضای ذخیره‌سازی')) {
                            showNotification(tradeError.message, 'error');
                            isImportCancelled = true;
                            await restoreSnapshot();
                            hideProgress();
                            return;
                        }
                        console.error(`❌ خطا در ذخیره معامله ${trade.id}:`, tradeError);
                    }
                }
                
                const percent = 70 + Math.floor((i / totalTrades) * 25);
                
                const elapsed = (Date.now() - importStartTime) / 1000;
                const speed = i / elapsed;
                const remaining = !isNaN(speed) && speed > 0 ? (totalTrades - i) / speed : 0;
                
                showProgress(`در حال ذخیره معاملات (${i + batch.length}/${totalTrades})${remaining > 0 ? ` - زمان باقی‌مانده: ${Math.ceil(remaining)} ثانیه` : ''}`, percent);
                
                await new Promise(resolve => setTimeout(resolve, 5));
            }
            
        }
        
        if (accounts.length > 0) {
            const savedActiveId = await db.getSetting('activeAccountId');
            activeAccountId = savedActiveId ? parseInt(savedActiveId) : accounts[0].id;
            activeAccount = accounts.find(acc => acc.id === activeAccountId) || accounts[0];
            accountBalance = activeAccount ? activeAccount.balance : 0;
            initialAccountBalance = accountBalance;
        }
        
        showProgress('در حال به‌روزرسانی نمایش...', 100);
        
        updateBalanceDisplay();
        updateAccountsList();
        loadTrades();
        loadOpenTrades();
        updateStats();
        updateDetailedStats();
        updateTotalRisk();
        updateGrowthChart();
        updateMonthlyGrowthChart();
        setInitialMonthBasedOnLastTrade();
        updateMonthlyDashboard();
        
        fileInput.value = '';
        
        setTimeout(hideProgress, 2000);
        showNotification(`✅ اطلاعات با موفقیت بارگذاری شد. ${trades.length} معامله بازیابی شد.`, 'success');
        
    } catch (error) {
        console.error('خطا در خواندن فایل:', error);
        await restoreSnapshot();
        hideProgress();
        
        let errorMessage = 'خطا در خواندن فایل';
        if (error.message.includes('معتبر نیست')) {
            errorMessage = error.message;
        } else if (error.message.includes('JSON')) {
            errorMessage = 'فایل JSON معتبر نیست';
        }
        
        showNotification('❌ ' + errorMessage, 'error');
    } finally {
        isImportCancelled = false;
    }
}

function showNotification(message, type = 'info') {
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    notification.style.position = 'fixed';
    notification.style.top = '20px';
    notification.style.left = '50%';
    notification.style.transform = 'translateX(-50%)';
    notification.style.padding = '12px 20px';
    notification.style.borderRadius = '8px';
    notification.style.zIndex = '10000';
    notification.style.fontWeight = '600';
    notification.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.3)';
    
    if (type === 'success') {
        notification.style.backgroundColor = '#10b981';
        notification.style.color = 'white';
    } else if (type === 'warning') {
        notification.style.backgroundColor = '#f59e0b';
        notification.style.color = '#78350f';
    } else if (type === 'error') {
        notification.style.backgroundColor = '#ef4444';
        notification.style.color = 'white';
    } else {
        notification.style.backgroundColor = '#3b82f6';
        notification.style.color = 'white';
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.5s';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 500);
    }, 3000);
}

// ============================
// رویدادهای اولیه
// ============================
document.addEventListener('DOMContentLoaded', function() {
    const now = new Date();
    const timezoneOffset = now.getTimezoneOffset() * 60000;
    const localISOTime = new Date(now - timezoneOffset).toISOString().slice(0, 16);
    document.getElementById('date').value = localISOTime;
    
    document.getElementById('newAccountVip').innerHTML = vipOptionsHTML('vip0');
    // دکمه «پاک کردن» (type=reset) فیلدها را خالی می‌کند؛ کارمزد خودکار باید برگردد
    document.getElementById('tradeForm').addEventListener('reset', () => setTimeout(syncAutoFee, 0));
    
    initialize();
    
    document.getElementById('entryPrice').addEventListener('input', calculateRisk);
    document.getElementById('stopLoss').addEventListener('input', calculateRisk);
    document.getElementById('takeProfit').addEventListener('input', calculateRisk);
    document.getElementById('riskPercent').addEventListener('input', calculateRisk);
    document.getElementById('feePercent').addEventListener('input', calculateRisk);
    document.getElementById('type').addEventListener('change', calculateRisk);
    
    document.getElementById('newBalanceInput').addEventListener('input', function() {
        const value = parseFloat(this.value);
        if (!isNaN(value) && value > 0) {
            this.value = Math.round(value * 100) / 100;
        }
    });
    
    document.getElementById('newAccountBalance').addEventListener('input', function() {
        const value = parseFloat(this.value);
        if (!isNaN(value) && value > 0) {
            this.value = Math.round(value * 100) / 100;
        }
    });
    
    const detailsModal = document.getElementById('detailsModal');
    if (detailsModal) {
        detailsModal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeDetailsModal();
            }
        });
    }
    
    const closeModal = document.getElementById('closeTradeModal');
    if (closeModal) {
        closeModal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeCloseModal();
            }
        });
    }
    
    const imageModal = document.getElementById('imageModal');
    if (imageModal) {
        imageModal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeImageModal();
            }
        });
    }
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-box.active, .details-modal, .close-modal, .image-modal').forEach(modal => {
            if (modal.style.display === 'flex' || modal.classList.contains('active')) {
                if (modal.id === 'detailsModal') closeDetailsModal();
                else if (modal.id === 'closeTradeModal') closeCloseModal();
                else if (modal.id === 'imageModal') closeImageModal();
                else if (modal.classList.contains('modal-box')) toggleModal(modal.id);
            }
        });
    }
});


// ============================
// توابع جدید: فیلتر، فشرده‌سازی تصویر، تحلیل پیشرفته
// ============================
function applyHistoryFilters(list) {
    const val = id => (document.getElementById(id) || {}).value || '';
    const q = val('histSearch').trim().toLowerCase();
    const st = val('histStatus') || 'all', rs = val('histResult') || 'all', ty = val('histType') || 'all';
    return list.filter(t => {
        if (q && !`${t.symbol} ${t.strategy || ''} ${t.notes || ''}`.toLowerCase().includes(q)) return false;
        if (st !== 'all' && t.status !== st) return false;
        if (ty !== 'all' && t.type !== ty) return false;
        if (rs !== 'all') {
            if (t.status !== 'closed') return false;
            const p = calculateTradePnL(t);
            if (rs === 'win' && !(p > 0)) return false;
            if (rs === 'loss' && !(p < 0)) return false;
        }
        return true;
    });
}

function compressImage(dataUrl, cb) {
    const img = new Image();
    img.onload = () => {
        const max = 1400, s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        cb(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => cb(dataUrl);
    img.src = dataUrl;
}

function strategyNames() {
    return [...new Set([...PRESET_STRATEGIES, ...customStrategies, ...trades.map(t => (t.strategy || '').trim()).filter(Boolean)])];
}

function refreshStrategyList(selected) {
    const sel = document.getElementById('strategy');
    if (!sel) return;
    const cur = selected !== undefined ? selected : sel.value;
    const names = strategyNames();
    if (cur && !names.includes(cur)) names.push(cur);
    sel.innerHTML = '<option value="">بدون استراتژی</option>' + names.map(n => `<option value="${escapeHTML(n)}">${escapeHTML(n)}</option>`).join('');
    sel.value = cur || '';
}

async function addStrategy() {
    const name = (prompt('نام استراتژی جدید:') || '').trim();
    if (!name) return;
    if (!strategyNames().includes(name)) {
        customStrategies.push(name);
        await db.saveSetting('customStrategies', JSON.stringify(customStrategies));
    }
    refreshStrategyList(name);
}

async function removeStrategy() {
    const name = document.getElementById('strategy').value;
    if (!name) return;
    if (PRESET_STRATEGIES.includes(name)) { showNotification('استراتژی‌های پیش‌فرض قابل حذف نیستند.', 'warning'); return; }
    if (trades.some(t => t.strategy === name)) { showNotification('این استراتژی در معامله‌های ثبت‌شده استفاده شده و از لیست حذف نمی‌شود.', 'warning'); return; }
    customStrategies = customStrategies.filter(n => n !== name);
    await db.saveSetting('customStrategies', JSON.stringify(customStrategies));
    refreshStrategyList('');
}

function renderAdvancedStats() {
    const box = document.getElementById('advancedStats');
    if (!box) return;
    const rows = trades.filter(t => t.status === 'closed')
        .sort((a, b) => new Date(a.closedDate || a.date) - new Date(b.closedDate || b.date))
        .map(t => { const pnl = calculateTradePnL(t); return { t, pnl, r: t.totalRiskAmount > 0 ? pnl / t.totalRiskAmount : 0 }; });
    if (!rows.length) {
        box.innerHTML = '<h2 class="section-title"><i class="fas fa-microscope"></i> تحلیل پیشرفته</h2><p class="adv-empty">بعد از بستن اولین معامله، تحلیل پیشرفته اینجا نمایش داده می‌شود.</p>';
        return;
    }
    const n = rows.length, wins = rows.filter(x => x.pnl > 0), losses = rows.filter(x => x.pnl < 0);
    const gp = wins.reduce((s, x) => s + x.pnl, 0), gl = Math.abs(losses.reduce((s, x) => s + x.pnl, 0));
    const pf = gl > 0 ? (gp / gl).toFixed(2) : (gp > 0 ? '∞' : '-');
    const avgR = rows.reduce((s, x) => s + x.r, 0) / n;
    const avgWin = wins.length ? gp / wins.length : 0, avgLoss = losses.length ? gl / losses.length : 0;
    const payoff = avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : '-';
    let eq = initialAccountBalance, peak = eq, mdd = 0, mddP = 0;
    rows.forEach(x => { eq += x.pnl; if (eq > peak) peak = eq; const d = peak - eq; if (d > mdd) { mdd = d; mddP = peak > 0 ? d / peak * 100 : 0; } });
    let maxW = 0, maxL = 0, cw = 0, cl = 0;
    rows.forEach(x => {
        if (x.pnl > 0) { cw++; cl = 0; } else if (x.pnl < 0) { cl++; cw = 0; } else { cw = 0; cl = 0; }
        maxW = Math.max(maxW, cw); maxL = Math.max(maxL, cl);
    });
    const cur = cw > 0 ? `${cw} برد` : (cl > 0 ? `${cl} باخت` : '-');
    const sgn = v => (v >= 0 ? '+' : '-') + formatCurrency(Math.abs(v));
    const tile = (l, v, c) => `<div class="adv-tile"><div class="adv-label">${l}</div><div class="adv-value ${c || ''}">${v}</div></div>`;
    const days = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
    const group = keyFn => {
        const m = new Map();
        rows.forEach(x => {
            const k = keyFn(x.t) || 'نامشخص', g = m.get(k) || { n: 0, w: 0, pnl: 0, r: 0 };
            g.n++; if (x.pnl > 0) g.w++; g.pnl += x.pnl; g.r += x.r; m.set(k, g);
        });
        return [...m.entries()].sort((a, b) => b[1].pnl - a[1].pnl);
    };
    const table = (title, list) => `<div class="adv-block"><h3>${title}</h3><div class="adv-table-wrap"><table class="adv-table"><thead><tr><th>مورد</th><th>تعداد</th><th>وین‌ریت</th><th>میانگین R</th><th>سود/زیان</th></tr></thead><tbody>` +
        list.map(([k, g]) => `<tr><td>${escapeHTML(k)}</td><td>${g.n}</td><td>${Math.round(g.w / g.n * 100)}%</td><td>${(g.r / g.n).toFixed(2)}</td><td class="${g.pnl >= 0 ? 'profit' : 'loss'}">${sgn(g.pnl)}</td></tr>`).join('') + '</tbody></table></div></div>';
    box.innerHTML = '<h2 class="section-title"><i class="fas fa-microscope"></i> تحلیل پیشرفته</h2><div class="adv-grid">' +
        tile('ضریب سود (Profit Factor)', pf, parseFloat(pf) >= 1 || pf === '∞' ? 'profit' : 'loss') +
        tile('میانگین R هر معامله', avgR.toFixed(2) + 'R', avgR >= 0 ? 'profit' : 'loss') +
        tile('امید ریاضی (هر معامله)', sgn((gp - gl) / n), gp - gl >= 0 ? 'profit' : 'loss') +
        tile('میانگین سود / میانگین ضرر', `${formatCurrency(avgWin)} / ${formatCurrency(avgLoss)}`) +
        tile('نسبت سود به ضرر (Payoff)', payoff) +
        tile('حداکثر دراودان', `${formatCurrency(mdd)} (${mddP.toFixed(1)}%)`, mdd > 0 ? 'loss' : '') +
        tile('بیشترین برد پیاپی', maxW) + tile('بیشترین باخت پیاپی', maxL) + tile('رگه‌ی فعلی', cur) + '</div>' +
        table('بر اساس نماد', group(t => t.symbol)) + table('بر اساس استراتژی', group(t => t.strategy)) +
        table('بر اساس روز هفته', group(t => { const d = new Date(t.date); return isNaN(d) ? '' : days[d.getDay()]; }));
}
