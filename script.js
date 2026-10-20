function getPersianDateParts(date) {
    if (!date) return null;
    const d = new Date(date);
    if (isNaN(d)) return null;
    const formatter = new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const parts = formatter.formatToParts(d);
    let year = '', month = '', day = '';
    for (const p of parts) {
        if (p.type === 'year') year = p.value;
        else if (p.type === 'month') month = p.value;
        else if (p.type === 'day') day = p.value;
    }
    const map = { '۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9','٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9' };
    const conv = s => s.split('').map(c => map[c] || c).join('');
    const y = parseInt(conv(year));
    const m = parseInt(conv(month));
    const dd = parseInt(conv(day));
    if (isNaN(y) || isNaN(m) || isNaN(dd)) return null;
    return { year: y, month: m, day: dd };
}

function toPersianDateWithEnglishNumbers(date, withTime = true) {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d)) return '';
    const fmt = new Intl.DateTimeFormat('fa-IR', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: withTime ? '2-digit' : undefined, minute: withTime ? '2-digit' : undefined, hour12: false
    });
    const parts = fmt.formatToParts(d);
    let y = '', m = '', dy = '', h = '', mi = '';
    for (const p of parts) {
        if (p.type === 'year') y = p.value;
        else if (p.type === 'month') m = p.value;
        else if (p.type === 'day') dy = p.value;
        else if (p.type === 'hour') h = p.value;
        else if (p.type === 'minute') mi = p.value;
    }
    const map = { '۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9','٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9' };
    const conv = s => s.split('').map(c => map[c] || c).join('');
    y = conv(y); m = conv(m); dy = conv(dy);
    return withTime ? `${y}/${m}/${dy} ${conv(h)}:${conv(mi)}` : `${y}/${m}/${dy}`;
}

function formatPersianDate(date, withTime = true) {
    return toPersianDateWithEnglishNumbers(date, withTime);
}

// ✅ تبدیل امن رشته به عدد: ارقام فارسی، کاما، فاصله
function toNumber(str) {
    if (typeof str === 'number') return str;
    if (!str) return 0;
    const map = { '۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9','٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9' };
    const normalized = String(str).split('').map(c => map[c] || c).join('').replace(/,/g, '').replace(/\s/g, '');
    const n = parseFloat(normalized);
    return isNaN(n) ? 0 : n;
}

function generateUID() {
    return 'trade_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);
}

// ✅ ID یکتا با فضای نمونه‌ی بزرگ (کاهش تصادم در import)
function generateTradeId() {
    return Date.now() * 1000000 + Math.floor(Math.random() * 1000000);
}

function getMimeType(name) {
    if (!name || !name.includes('.')) return 'image/png';
    const ext = name.split('.').pop().toLowerCase();
    const types = { png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', gif:'image/gif', webp:'image/webp', bmp:'image/bmp', svg:'image/svg+xml', ico:'image/x-icon' };
    return types[ext] || 'image/png';
}

let editingTradeId = null;
let editBaseBalance = null;
const PRESET_STRATEGIES = ['SL', 'Breakout', 'Candle Setup'];
let customStrategies = [];
let isImportCancelled = false;
let importStartTime = 0;
let accountGrowthChart = null;
let monthlyGrowthChart = null;

function escapeHTML(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

class TradingJournalDB {
    constructor() {
        this.dbName = 'CryptoJournal';
        this.version = 4;
        this.db = null;
        this.isReady = false;
    }

    open() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(this.dbName, this.version);
            req.onerror = () => reject(req.error);
            req.onsuccess = () => {
                this.db = req.result;
                this.isReady = true;
                console.log('✅ IndexedDB آماده است');
                resolve(this.db);
            };
            req.onupgradeneeded = (ev) => {
                const db = ev.target.result;
                const oldV = ev.oldVersion;
                if (oldV < 1) {
                    const ts = db.createObjectStore('trades', { keyPath: 'id' });
                    ts.createIndex('uid', 'uid', { unique: true });
                    ts.createIndex('accountId', 'accountId', { unique: false });
                    ts.createIndex('date', 'date', { unique: false });
                    ts.createIndex('status', 'status', { unique: false });
                    db.createObjectStore('accounts', { keyPath: 'id' });
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
                if (oldV < 2) {
                    if (!db.objectStoreNames.contains('trades')) return;
                    const ts = ev.target.transaction.objectStore('trades');
                    if (!ts.indexNames.contains('uid')) ts.createIndex('uid', 'uid', { unique: true });
                }
            };
        });
    }

    // ✅ resolve بعد از tx.oncomplete (نه req.onsuccess)
    saveTrade(trade) {
        this.checkReady();
        return new Promise((resolve, reject) => {
            let tx;
            try {
                tx = this.db.transaction(['trades'], 'readwrite');
                tx.objectStore('trades').put(trade);
            } catch (e) { return reject(e); }
            tx.oncomplete = () => resolve(trade.id);
            tx.onerror = () => {
                const err = tx.error;
                if (err && err.name === 'QuotaExceededError') reject(new Error('⚠️ فضای ذخیره‌سازی کافی نیست. لطفاً بکاپ بگیرید و داده‌های قدیمی را حذف کنید.'));
                else reject(err || new Error('خطا در ذخیره معامله'));
            };
            tx.onabort = () => reject(tx.error || new Error('تراکنش لغو شد'));
        });
    }

    saveTrades(tradesArray) {
        this.checkReady();
        return new Promise((resolve, reject) => {
            let tx;
            try {
                tx = this.db.transaction(['trades'], 'readwrite');
                const store = tx.objectStore('trades');
                for (const t of tradesArray) store.put(t);
            } catch (e) { return reject(e); }
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => {
                const err = tx.error;
                if (err && err.name === 'QuotaExceededError') reject(new Error('⚠️ فضای ذخیره‌سازی کافی نیست'));
                else reject(err || new Error('تراکنش لغو شد'));
            };
        });
    }

    getTradesByAccount(accountId) {
        this.checkReady();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['trades'], 'readonly');
            const req = tx.objectStore('trades').index('accountId').getAll(parseInt(accountId));
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    }

    getAllTrades() {
        this.checkReady();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['trades'], 'readonly');
            const req = tx.objectStore('trades').getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    }

    getTradeById(tradeId) {
        this.checkReady();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['trades'], 'readonly');
            const req = tx.objectStore('trades').get(parseInt(tradeId));
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    deleteTrade(tradeId) {
        this.checkReady();
        return new Promise((resolve, reject) => {
            let tx;
            try {
                tx = this.db.transaction(['trades'], 'readwrite');
                tx.objectStore('trades').delete(parseInt(tradeId));
            } catch (e) { return reject(e); }
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error || new Error('aborted'));
        });
    }

    deleteTrades(tradeIds) {
        this.checkReady();
        return new Promise((resolve, reject) => {
            let tx;
            try {
                tx = this.db.transaction(['trades'], 'readwrite');
                const store = tx.objectStore('trades');
                for (const id of tradeIds) store.delete(parseInt(id));
            } catch (e) { return reject(e); }
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error || new Error('aborted'));
        });
    }

    saveAccounts(arr) {
        this.checkReady();
        return new Promise((resolve, reject) => {
            let tx;
            try {
                tx = this.db.transaction(['accounts'], 'readwrite');
                const store = tx.objectStore('accounts');
                for (const a of arr) store.put(a);
            } catch (e) { return reject(e); }
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error || new Error('aborted'));
        });
    }

    getAccounts() {
        this.checkReady();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['accounts'], 'readonly');
            const req = tx.objectStore('accounts').getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    }

    // ✅ deleteAccount که واقعاً پاک می‌کند
    deleteAccount(accountId) {
        this.checkReady();
        return new Promise((resolve, reject) => {
            let tx;
            try {
                tx = this.db.transaction(['accounts'], 'readwrite');
                tx.objectStore('accounts').delete(parseInt(accountId));
            } catch (e) { return reject(e); }
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error || new Error('aborted'));
        });
    }

    // ✅ saveSetting بعد از tx.oncomplete
    saveSetting(key, value) {
        this.checkReady();
        return new Promise((resolve, reject) => {
            let tx;
            try {
                tx = this.db.transaction(['settings'], 'readwrite');
                tx.objectStore('settings').put({ key, value });
            } catch (e) { return reject(e); }
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error || new Error('aborted'));
        });
    }

    getSetting(key) {
        this.checkReady();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['settings'], 'readonly');
            const req = tx.objectStore('settings').get(key);
            req.onsuccess = () => resolve(req.result?.value);
            req.onerror = () => reject(req.error);
        });
    }

    getAllSettings() {
        this.checkReady();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['settings'], 'readonly');
            const req = tx.objectStore('settings').getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    }

    checkReady() {
        if (!this.isReady || !this.db) throw new Error('دیتابیس آماده نیست');
    }

    // ✅ backup شامل settings
    async backup() {
        const accounts = await this.getAccounts();
        const trades = await this.getAllTrades();
        const settings = await this.getAllSettings();
        return { accounts, trades, settings, exportDate: new Date().toISOString(), version: '4.1' };
    }

    clearAll() {
        this.checkReady();
        const clear = (name) => new Promise((resolve, reject) => {
            const tx = this.db.transaction([name], 'readwrite');
            tx.objectStore(name).clear();
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error || new Error('aborted'));
        });
        return Promise.all([clear('trades'), clear('accounts'), clear('settings')]);
    }

    async upgradeOldTrades() {
        try {
            const all = await this.getAllTrades();
            if (!all || all.length === 0) return;
            let changed = false;
            for (const t of all) {
                if (!t.uid) { t.uid = `trade_${t.id}`; changed = true; }
                if (t.baseBalanceAtEntry == null) {
                    if (t.riskPercent > 0 && t.totalRiskAmount > 0) t.baseBalanceAtEntry = t.totalRiskAmount * 100 / t.riskPercent;
                    changed = true;
                }
                if (t.entryScreenshot && !String(t.entryScreenshot).startsWith('data:image')) { t.entryScreenshot = null; t.entryScreenshotName = null; changed = true; }
                if (t.exitScreenshot && !String(t.exitScreenshot).startsWith('data:image')) { t.exitScreenshot = null; t.exitScreenshotName = null; changed = true; }
                if (t.entryScreenshot && !t.entryScreenshotName) { t.entryScreenshotName = `entry_${t.uid}.png`; changed = true; }
                if (t.exitScreenshot && !t.exitScreenshotName) { t.exitScreenshotName = `exit_${t.uid}.png`; changed = true; }
            }
            if (changed) { await this.saveTrades(all); console.log('✅ migration انجام شد'); }
        } catch (e) { console.error('migration error:', e); }
    }
}

const db = new TradingJournalDB();

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

const persianMonths = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];

function switchSection(sectionId) {
    document.querySelectorAll('.section, .dashboard-section').forEach(s => s.classList.remove('active-section'));
    const target = document.getElementById(sectionId + '-section');
    if (target) target.classList.add('active-section');
    document.querySelectorAll('.toolbar-btn').forEach(b => b.classList.remove('active'));
    const activeBtn = document.querySelector(`.toolbar-btn[data-section="${sectionId}"]`);
    if (activeBtn) activeBtn.classList.add('active');
    const bal = document.getElementById('balanceSection');
    if (bal) {
        if (sectionId === 'trade-form') bal.classList.remove('hidden-section');
        else bal.classList.add('hidden-section');
    }
    if (sectionId === 'stats') { updateStats(); updateDetailedStats(); updateGrowthChart(); }
    if (sectionId === 'dashboard') { updateMonthlyDashboard(); updateMonthlyGrowthChart(); }
    if (sectionId === 'history') loadTrades();
    if (sectionId === 'trade-form') loadOpenTrades();
    closeAllModals();
}

function updateDetailedStats() {
    const el = id => document.getElementById(id);
    if (el('initialBalance')) el('initialBalance').textContent = formatCurrency(initialAccountBalance);
    const totalPnL = calculateTotalPnL();
    if (el('currentBalanceStats')) el('currentBalanceStats').textContent = formatCurrency(initialAccountBalance + totalPnL);
    const tpnl = el('totalPnLStats');
    if (tpnl) { tpnl.textContent = (totalPnL >= 0 ? '+' : '') + formatCurrency(Math.abs(totalPnL)); tpnl.style.color = totalPnL >= 0 ? '#10b981' : '#ef4444'; }
    const profitPct = initialAccountBalance > 0 ? (totalPnL / initialAccountBalance) * 100 : 0;
    const pp = el('profitPercentage');
    if (pp) { pp.textContent = (profitPct >= 0 ? '+' : '') + profitPct.toFixed(2) + '%'; pp.className = profitPct >= 0 ? 'stats-value percentage-box' : 'stats-value percentage-box negative'; }
    const np = el('netProfit');
    if (np) { np.textContent = formatCurrency(calculateTotalProfit()); np.className = 'stats-value positive-box'; }
    const nl = el('netLoss');
    if (nl) { nl.textContent = formatCurrency(calculateTotalLoss()); nl.className = 'stats-value negative-box'; }
    if (el('totalTradesStats')) el('totalTradesStats').textContent = trades.length;
    if (el('longTradesCount')) el('longTradesCount').textContent = trades.filter(t => t.type === 'buy').length;
    if (el('shortTradesCount')) el('shortTradesCount').textContent = trades.filter(t => t.type === 'sell').length;
}

function updateGrowthChart() {
    const canvas = document.getElementById('accountGrowthChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const closed = [...trades].filter(t => t.status === 'closed').sort((a, b) => new Date(a.closedDate || a.date) - new Date(b.closedDate || b.date));
    let bal = initialAccountBalance;
    const history = [bal];
    const labels = [0];
    closed.forEach((t, i) => { bal += calculateTradePnL(t); history.push(bal); labels.push(i + 1); });
    if (closed.length === 0) { history.push(initialAccountBalance); labels.push(1); }
    if (accountGrowthChart) accountGrowthChart.destroy();
    accountGrowthChart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets: [{ label: 'رشد حساب ($)', data: history, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', borderWidth: 4, pointBackgroundColor: '#60a5fa', pointBorderColor: '#1e293b', pointRadius: 5, pointHoverRadius: 8, tension: 0.1, fill: true }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e293b', titleColor: '#f1f5f9', bodyColor: '#94a3b8', borderColor: '#3b82f6', borderWidth: 2 } }, scales: { x: { grid: { color: 'rgba(71,85,105,0.2)' }, ticks: { color: '#94a3b8' }, title: { display: true, text: 'تعداد معاملات', color: '#cbd5e1' } }, y: { grid: { color: 'rgba(71,85,105,0.2)' }, ticks: { color: '#94a3b8', callback: v => '$' + v }, title: { display: true, text: 'رشد سرمایه ($)', color: '#cbd5e1' } } } }
    });
}

// ✅ نمودار ماهانه از بالانس اول ماه شروع می‌شود
function updateMonthlyGrowthChart() {
    const canvas = document.getElementById('monthlyGrowthChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const monthly = trades.filter(t => {
        if (t.accountId !== activeAccountId) return false;
        const pd = getPersianDateParts(t.date);
        return pd && pd.year === currentYear && pd.month === currentMonth;
    });
    const closed = [...monthly].filter(t => t.status === 'closed').sort((a, b) => new Date(a.date) - new Date(b.date));

    // بالانس اول ماه = initialAccountBalance + ΣPnL(معاملات قبل از این ماه)
    const monthStartBalance = initialAccountBalance + trades
        .filter(t => t.accountId === activeAccountId && t.status === 'closed')
        .filter(t => {
            const pd = getPersianDateParts(t.date);
            if (!pd) return false;
            return (pd.year < currentYear) || (pd.year === currentYear && pd.month < currentMonth);
        })
        .reduce((s, t) => s + calculateTradePnL(t), 0);

    let bal = monthStartBalance;
    const history = [bal];
    const labels = [0];
    closed.forEach((t, i) => { bal += calculateTradePnL(t); history.push(bal); labels.push(i + 1); });
    if (closed.length === 0) { history.push(monthStartBalance); labels.push(1); }
    if (monthlyGrowthChart) monthlyGrowthChart.destroy();
    monthlyGrowthChart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets: [{ label: 'رشد ماهانه ($)', data: history, borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)', borderWidth: 4, pointBackgroundColor: '#fbbf24', pointBorderColor: '#1e293b', pointRadius: 5, pointHoverRadius: 8, tension: 0.1, fill: true }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e293b', titleColor: '#f1f5f9', bodyColor: '#94a3b8', borderColor: '#f59e0b', borderWidth: 2 } }, scales: { x: { grid: { color: 'rgba(71,85,105,0.2)' }, ticks: { color: '#94a3b8' }, title: { display: true, text: 'تعداد معاملات', color: '#cbd5e1' } }, y: { grid: { color: 'rgba(71,85,105,0.2)' }, ticks: { color: '#94a3b8', callback: v => '$' + v }, title: { display: true, text: 'رشد سرمایه ($)', color: '#cbd5e1' } } } }
    });
}

function loadOpenTrades() {
    const list = document.getElementById('openTradesList');
    if (!list) return;
    const openTrades = trades.filter(t => t.status === 'open' && t.accountId === activeAccountId);
    if (openTrades.length === 0) {
        list.innerHTML = '<div class="no-open-trades"><i class="fas fa-check-circle"></i> هیچ معامله بازی وجود ندارد</div>';
        return;
    }
    let html = '';
    openTrades.forEach(t => {
        const typeText = t.type === 'buy' ? 'لانگ' : 'شورت';
        const icon = t.type === 'buy' ? 'fa-arrow-up' : 'fa-arrow-down';
        const color = t.type === 'buy' ? '#10b981' : '#ef4444';
        html += `<div class="open-trade-item">
            <div class="open-trade-info">
                <span class="open-trade-symbol">${escapeHTML(t.symbol)}</span>
                <div class="open-trade-detail"><i class="fas ${icon}" style="color:${color}"></i><span>${typeText}</span></div>
                <div class="open-trade-detail"><i class="fas fa-calendar"></i><span>${formatPersianDate(t.date, true)}</span></div>
                <div class="open-trade-detail"><i class="fas fa-arrow-right"></i><span>${escapeHTML(t.entryPriceStr || t.entryPrice)}</span></div>
                <div class="open-trade-detail"><i class="fas fa-shield-alt"></i><span>${escapeHTML(t.stopLossStr || t.stopLoss)}</span></div>
                <div class="open-trade-detail"><i class="fas fa-bullseye"></i><span>${escapeHTML(t.takeProfitStr || t.takeProfit)}</span></div>
            </div>
            <div class="open-trade-actions">
                <button class="btn-icon" onclick="openCloseModal(${t.id})" title="بستن"><i class="fas fa-check-circle"></i></button>
            </div>
        </div>`;
    });
    list.innerHTML = html;
}

async function initialize() {
    try {
        await db.open();
        const migDone = await db.getSetting('migV4');
        if (!migDone) { await db.upgradeOldTrades(); await db.saveSetting('migV4', '1'); }
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
        setTimeout(() => { updateGrowthChart(); updateMonthlyGrowthChart(); }, 500);
        try { customStrategies = JSON.parse((await db.getSetting('customStrategies')) || '[]'); } catch (e) { customStrategies = []; }
        refreshStrategyList();
        if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
        checkStorage();
        if (trades.length > 0) {
            const last = parseInt(await db.getSetting('lastBackupAt')) || 0;
            const days = last ? Math.floor((Date.now() - last) / 86400000) : null;
            if (days === null || days >= 7) setTimeout(() => showNotification(days === null ? 'هنوز بکاپ نگرفته‌اید.' : `${days} روز از آخرین بکاپ گذشته است.`, 'warning'), 1500);
        }
        console.log('✅ راه‌اندازی کامل شد');
    } catch (e) {
        console.error('❌ خطای راه‌اندازی:', e);
        showNotification('خطا در راه‌اندازی دیتابیس', 'error');
    }
}

async function checkStorage() {
    if (!navigator.storage || !navigator.storage.estimate) return;
    try {
        const { usage, quota } = await navigator.storage.estimate();
        if (!quota) return;
        const ratio = usage / quota;
        if (ratio > 0.85) showNotification(`⚠️ ${(ratio*100).toFixed(0)}٪ فضا پر شده. بکاپ بگیرید.`, 'error');
        else if (ratio > 0.7) showNotification(`فضا: ${(ratio*100).toFixed(0)}٪ پر شده.`, 'warning');
    } catch (e) {}
}

function setInitialMonthBasedOnLastTrade() {
    if (trades.length > 0) {
        const sorted = [...trades].sort((a, b) => new Date(b.date) - new Date(a.date));
        const pd = getPersianDateParts(sorted[0].date);
        if (pd) { currentYear = pd.year; currentMonth = pd.month; return; }
    }
    const now = getPersianDateParts(new Date());
    currentYear = now.year;
    currentMonth = now.month;
}

async function loadAccountsFromDB() {
    try {
        const dbAcc = await db.getAccounts();
        if (dbAcc && dbAcc.length > 0) accounts = dbAcc;
        else { accounts = [{ id: 1, name: 'حساب اصلی', balance: 0, vipLevel: 'vip0' }]; await db.saveAccounts(accounts); }
        const savedId = await db.getSetting('activeAccountId');
        activeAccountId = savedId ? parseInt(savedId) : 1;
        activeAccount = accounts.find(a => a.id === activeAccountId) || accounts[0];
        accountBalance = activeAccount ? activeAccount.balance : 0;
        initialAccountBalance = accountBalance;
        updateAccountsList();
        syncAutoFee();
    } catch (e) {
        console.error(e);
        accounts = [{ id: 1, name: 'حساب اصلی', balance: 0 }];
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
    } catch (e) {
        console.error(e);
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
    } catch (e) {
        if (e.message.includes('فضای')) showNotification(e.message, 'error');
        else { console.error(e); showNotification('خطا در ذخیره معامله', 'error'); }
        return false;
    }
}

async function deleteTradeFromDB(tradeId) {
    try { await db.deleteTrade(tradeId); trades = await db.getTradesByAccount(activeAccountId); return true; }
    catch (e) { console.error(e); return false; }
}

async function saveAccountsToDB() {
    try { await db.saveAccounts(accounts); await db.saveSetting('activeAccountId', activeAccountId.toString()); return true; }
    catch (e) { console.error(e); return false; }
}

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

let activeModal = null;
function toggleModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    const btn = document.getElementById(modalId.replace('Modal', 'Btn'));
    if (activeModal && activeModal !== modal) {
        activeModal.classList.remove('active');
        const ab = document.getElementById(activeModal.id.replace('Modal', 'Btn'));
        if (ab) ab.classList.remove('active');
    }
    if (modal.classList.contains('active')) {
        modal.classList.remove('active');
        if (btn) btn.classList.remove('active');
        activeModal = null;
    } else {
        modal.classList.add('active');
        if (btn) btn.classList.add('active');
        activeModal = modal;
        if (modalId === 'balanceModal') { const i = document.getElementById('newBalanceInput'); if (i) i.value = initialAccountBalance; }
        if (modalId === 'accountModal') updateAccountsList();
    }
}
function closeAllModals() {
    document.querySelectorAll('.modal-box').forEach(m => m.classList.remove('active'));
    document.querySelectorAll('.balance-btn').forEach(b => b.classList.remove('active'));
    activeModal = null;
}

function previewEntryScreenshot(input) {
    if (input.files && input.files[0]) {
        const r = new FileReader();
        r.onload = e => {
            const preview = document.getElementById('entryScreenshotPreview');
            compressImage(e.target.result, data => {
                preview.src = data;
                document.getElementById('entryScreenshotPreviewContainer').classList.add('active');
            });
        };
        r.readAsDataURL(input.files[0]);
    }
}
function previewCloseScreenshot(input) {
    if (input.files && input.files[0]) {
        const r = new FileReader();
        r.onload = e => {
            const preview = document.getElementById('closeScreenshotPreview');
            compressImage(e.target.result, data => {
                preview.src = data;
                preview.classList.add('active');
                document.getElementById('closeScreenshotRemove').style.display = 'inline';
                closeScreenshotData = data;
            });
        };
        r.readAsDataURL(input.files[0]);
    }
}
function removeEntryScreenshot() {
    const f = document.getElementById('entryScreenshotFile'); if (f) f.value = '';
    const p = document.getElementById('entryScreenshotPreview'); if (p) p.src = '';
    const c = document.getElementById('entryScreenshotPreviewContainer'); if (c) c.classList.remove('active');
}
function removeCloseScreenshot() {
    const f = document.getElementById('closeScreenshotFile'); if (f) f.value = '';
    const p = document.getElementById('closeScreenshotPreview'); if (p) p.classList.remove('active');
    const r = document.getElementById('closeScreenshotRemove'); if (r) r.style.display = 'none';
    closeScreenshotData = null;
}

function setBalancePreset(amount) { document.getElementById('newBalanceInput').value = amount; }

function updateBalanceDisplay() {
    const eq = getEquity();
    const el = id => document.getElementById(id);
    if (el('currentBalance')) el('currentBalance').textContent = '$' + formatNumber(Math.round(eq * 100) / 100);
    if (el('currentBalanceDisplay')) el('currentBalanceDisplay').textContent = '$' + formatNumber(accountBalance);
    if (el('currentAccountName')) el('currentAccountName').textContent = activeAccount ? activeAccount.name : 'حساب اصلی';
    if (el('activeAccountIndicator')) el('activeAccountIndicator').textContent = `${accounts.findIndex(a => a.id === activeAccountId) + 1}/${accounts.length}`;
    const pnl = calculateTotalPnL();
    const tpnl = el('totalPnL');
    if (tpnl) { tpnl.textContent = (pnl >= 0 ? '+' : '') + formatCurrency(Math.abs(pnl)); tpnl.style.color = pnl >= 0 ? '#10b981' : '#ef4444'; }
}

function getEquity() { return (initialAccountBalance || 0) + calculateTotalPnL(); }

function formatCurrency(num) {
    return '$' + parseFloat(num || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatNumber(num) {
    const n = parseFloat(num);
    if (isNaN(n)) return '0';
    if (n % 1 !== 0) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 });
    return n.toLocaleString('en-US');
}

function updateTotalRisk() {
    const totalRisk = trades.filter(t => t.status === 'open').reduce((s, t) => s + (t.totalRiskAmount || 0), 0);
    const eq = getEquity();
    const pct = eq > 0 ? (totalRisk / eq) * 100 : 0;
    const el = document.getElementById('totalRiskPercent');
    if (el) el.textContent = pct.toFixed(2) + '%';
}

function setRiskPercent(percent) {
    document.getElementById('riskPercent').value = percent;
    calculateRisk();
}

async function updateBalance() {
    const input = document.getElementById('newBalanceInput');
    const nb = toNumber(input.value);
    if (nb <= 0) { showNotification('لطفاً یک عدد معتبر وارد کنید.', 'error'); return; }
    const rounded = Math.round(nb * 100) / 100;
    const idx = accounts.findIndex(a => a.id === activeAccountId);
    if (idx !== -1) {
        accounts[idx].balance = rounded;
        activeAccount = accounts[idx];
        accountBalance = rounded;
        initialAccountBalance = rounded;
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
    showNotification('بالانس به‌روزرسانی شد.', 'success');
}

function resetForm() {
    editingTradeId = null;
    editBaseBalance = null;
    document.getElementById('tradeForm').reset();
    document.getElementById('type').value = '';
    const fd = document.getElementById('feeDetails'); if (fd) fd.style.display = 'none';
    removeEntryScreenshot();
    const now = new Date();
    const off = now.getTimezoneOffset() * 60000;
    document.getElementById('date').value = new Date(now - off).toISOString().slice(0, 16);
    syncAutoFee();
}

function getAccountVip(account) { return normalizeVip(account && account.vipLevel); }

function syncAutoFee() {
    const input = document.getElementById('feePercent');
    const text = document.getElementById('feeAutoText');
    if (!input) return;
    if (editingTradeId !== null) { if (text) text.textContent = 'کارمزد ثبت‌شده حفظ می‌شود'; return; }
    const vip = getAccountVip(activeAccount);
    input.value = String(getTotalFeePercent(vip));
    if (text) {
        const e = (getFeeRate(vip, DEFAULT_ENTRY_ORDER) * 100).toFixed(3);
        const x = (getFeeRate(vip, DEFAULT_EXIT_ORDER) * 100).toFixed(3);
        text.textContent = `${vipLabel(vip)} · ورود ${e}٪ + خروج ${x}٪`;
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
    showNotification(`سطح ${vipLabel(acc.vipLevel)} برای «${acc.name}» ثبت شد.`, 'success');
}

// ✅ استفاده از toNumber برای اعداد فارسی/کاما
function calculateRisk() {
    syncAutoFee();
    const v = id => (document.getElementById(id) || {}).value || '';
    const entryPriceStr = String(v('entryPrice')).trim();
    const stopLossStr = String(v('stopLoss')).trim();
    const takeProfitStr = String(v('takeProfit')).trim();
    const riskPercentStr = String(v('riskPercent')).trim();
    const feePercentStr = String(v('feePercent')).trim();
    const type = v('type');

    const entryPrice = toNumber(entryPriceStr);
    const stopLoss = toNumber(stopLossStr);
    const takeProfit = toNumber(takeProfitStr);
    const riskPercent = toNumber(riskPercentStr);
    const feePct = toNumber(feePercentStr);

    const setTxt = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };

    if (entryPrice <= 0 || stopLoss <= 0 || takeProfit <= 0 || riskPercent <= 0 || !type) {
        const fd = document.getElementById('feeDetails'); if (fd) fd.style.display = 'none';
        setTxt('riskAmount', '$0'); setTxt('potentialProfit', '$0'); setTxt('riskRewardRatio', '1:0');
        return;
    }

    const base = (editingTradeId !== null && editBaseBalance != null && editBaseBalance > 0) ? editBaseBalance : getEquity();
    const totalRisk = (base * riskPercent) / 100;

    let slPts, tpPts;
    if (type === 'buy') { slPts = Math.abs(entryPrice - stopLoss); tpPts = Math.abs(takeProfit - entryPrice); }
    else { slPts = Math.abs(stopLoss - entryPrice); tpPts = Math.abs(entryPrice - takeProfit); }
    if (slPts <= 0) { const fd = document.getElementById('feeDetails'); if (fd) fd.style.display = 'none'; return; }

    const feePerUnit = (entryPrice * feePct) / 100;
    const denom = slPts + feePerUnit;
    const posSize = denom > 0 ? totalRisk / denom : 0;
    const posValue = posSize * entryPrice;
    const totalFee = (posValue * feePct) / 100;
    const feeEntry = totalFee / 2;
    const feeExit = totalFee / 2;
    const potentialProfit = posSize * tpPts;
    const netProfit = potentialProfit - totalFee;
    const rr = slPts > 0 ? (tpPts / slPts).toFixed(2) : 0;

    setTxt('riskAmount', formatCurrency(totalRisk));
    setTxt('potentialProfit', formatCurrency(potentialProfit));
    const netRR = totalRisk > 0 ? ((potentialProfit - totalFee) / totalRisk).toFixed(2) : '0';
    setTxt('riskRewardRatio', '1:' + rr + ' (خالص 1:' + netRR + ')');
    setTxt('feeEntryAmount', formatCurrency(feeEntry));
    setTxt('feeExitAmount', formatCurrency(feeExit));
    setTxt('totalFeeAmount', formatCurrency(totalFee));
    setTxt('grossLossAmount', formatCurrency(posSize * slPts));
    setTxt('totalLossAmount', formatCurrency(posSize * slPts + totalFee));
    setTxt('netProfitAmount', formatCurrency(netProfit));
    const fd = document.getElementById('feeDetails'); if (fd) fd.style.display = 'block';

    return { totalRisk, positionSize: posSize, positionValue: posValue, potentialProfit, netProfit, riskRewardRatio: rr, feeEntry, feeExit, totalFee };
}

document.getElementById('tradeForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    syncAutoFee();

    const v = id => document.getElementById(id).value.trim();
    const entryPriceStr = v('entryPrice');
    const stopLossStr = v('stopLoss');
    const takeProfitStr = v('takeProfit');
    const riskPercentStr = v('riskPercent');
    const feePercentStr = v('feePercent');

    const entryPrice = toNumber(entryPriceStr);
    const stopLoss = toNumber(stopLossStr);
    const takeProfit = toNumber(takeProfitStr);
    const riskPercent = toNumber(riskPercentStr);
    const feePct = toNumber(feePercentStr);

    if (entryPrice <= 0 || stopLoss <= 0 || takeProfit <= 0 || riskPercent <= 0) {
        showNotification('همه فیلدهای ضروری را پر کنید.', 'error'); return;
    }
    const type = document.getElementById('type').value;
    if (!type) { showNotification('نوع معامله را انتخاب کنید.', 'error'); return; }
    if (type === 'buy' && stopLoss >= entryPrice) { showNotification('حد ضرر باید کمتر از ورود باشد.', 'error'); return; }
    if (type === 'sell' && stopLoss <= entryPrice) { showNotification('حد ضرر باید بیشتر از ورود باشد.', 'error'); return; }
    if (type === 'buy' && takeProfit <= entryPrice) { showNotification('حد سود باید بیشتر از ورود باشد.', 'error'); return; }
    if (type === 'sell' && takeProfit >= entryPrice) { showNotification('حد سود باید کمتر از ورود باشد.', 'error'); return; }

    const riskData = calculateRisk();
    if (!riskData) { showNotification('خطا در محاسبات ریسک.', 'error'); return; }

    const tradeUID = generateUID();
    const preview = document.getElementById('entryScreenshotPreview');
    let entryScreenshot = null, entryScreenshotName = null;
    if (preview.getAttribute('src') && preview.src.startsWith('data:image')) {
        entryScreenshot = preview.src;
        entryScreenshotName = `entry_${tradeUID}.png`;
    }

    const baseBalanceAtEntry = (editingTradeId !== null && editBaseBalance != null && editBaseBalance > 0) ? editBaseBalance : getEquity();

    const trade = {
        id: generateTradeId(),
        uid: tradeUID,
        symbol: document.getElementById('symbol').value.toUpperCase(),
        date: document.getElementById('date').value,
        type,
        entryPrice, entryPriceStr,
        stopLoss, stopLossStr,
        takeProfit, takeProfitStr,
        riskPercent,
        totalFeePercent: feePct,
        feeEntry: riskData.feeEntry,
        feeExit: riskData.feeExit,
        totalFee: riskData.totalFee,
        baseBalanceAtEntry,
        status: 'open',
        closedPrice: null,
        closedDate: null,
        entryScreenshot, entryScreenshotName,
        exitScreenshot: null, exitScreenshotName: null,
        totalRiskAmount: riskData.totalRisk,
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
            if (orig.actualFee != null) { trade.actualFee = orig.actualFee; trade.totalFee = orig.actualFee; trade.feeEntry = orig.actualFee / 2; trade.feeExit = orig.actualFee / 2; }
            trade.closedDate = orig.closedDate;
            trade.exitScreenshot = orig.exitScreenshot;
            trade.exitScreenshotName = orig.exitScreenshotName;
            trade.accountId = orig.accountId;
            if (orig.baseBalanceAtEntry != null) trade.baseBalanceAtEntry = orig.baseBalanceAtEntry;
            if (!trade.entryScreenshot) { trade.entryScreenshot = orig.entryScreenshot; trade.entryScreenshotName = orig.entryScreenshotName; }
            else { trade.entryScreenshotName = `entry_${orig.uid}.png`; }
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
    const off = now.getTimezoneOffset() * 60000;
    document.getElementById('date').value = new Date(now - off).toISOString().slice(0, 16);
    document.getElementById('type').value = '';
    document.getElementById('feeDetails').style.display = 'none';
    syncAutoFee();
    removeEntryScreenshot();

    showNotification(isEditing ? (exitFollowed ? 'ذخیره شد؛ قیمت خروج با حد جدید به‌روز شد.' : 'ویرایش ذخیره شد.') : 'معامله ثبت شد!', 'success');
    checkStorage();
});

function loadTrades() {
    const tbody = document.getElementById('tradesTableBody');
    const noMsg = document.getElementById('noTradesMessage');
    if (!tbody) return;
    const all = trades.filter(t => t.accountId === activeAccountId);
    const filtered = applyHistoryFilters(all);
    const countEl = document.getElementById('histCount');
    if (countEl) countEl.textContent = filtered.length === all.length ? `${all.length} معامله` : `${filtered.length} از ${all.length} معامله`;

    if (filtered.length === 0) {
        tbody.innerHTML = '';
        if (noMsg) noMsg.style.display = 'block';
        return;
    }
    if (noMsg) noMsg.style.display = 'none';

    const sorted = [...filtered].sort((a, b) => new Date(b.date) - new Date(a.date));
    let html = '';
    sorted.forEach(t => {
        const pnl = calculateTradePnL(t);
        const pnlCls = pnl > 0 ? 'profit' : (pnl < 0 ? 'loss' : 'neutral');
        const pnlTxt = t.status === 'closed' ? (pnl >= 0 ? '+' : '−') + formatCurrency(Math.abs(pnl)) : 'باز';
        const typeText = t.type === 'buy' ? 'لانگ' : 'شورت';
        const statusText = t.status === 'open' ? 'باز' : 'بسته';
        const statusCls = t.status === 'open' ? 'chip chip-open' : 'chip chip-closed';
        const rowCls = t.status === 'open' ? 'row-open' : (pnl > 0 ? 'row-win' : (pnl < 0 ? 'row-loss' : 'row-flat'));
        const typeChip = `<span class="chip ${t.type === 'buy' ? 'chip-long' : 'chip-short'}">${typeText}</span>`;
        const feeTxt = t.totalFeePercent > 0 ? `${t.totalFeePercent}%` : '-';
        const dateText = formatPersianDate(t.date, true);
        const cam = t.entryScreenshot ? '<i class="fas fa-camera" style="color:#3b82f6;margin-right:5px;" title="اسکرین‌شات"></i>' : '';

        html += `<tr class="${rowCls}">
            <td data-label="ارز"><div class="crypto-badge"><i class="fas fa-coins"></i>${escapeHTML(t.symbol)} ${cam}</div></td>
            <td data-label="تاریخ">${dateText}</td>
            <td data-label="نوع">${typeChip}</td>
            <td class="price-display" data-label="ورود">${escapeHTML(t.entryPriceStr || t.entryPrice)}</td>
            <td class="price-display" data-label="حد ضرر">${escapeHTML(t.stopLossStr || t.stopLoss)}</td>
            <td class="price-display" data-label="حد سود">${escapeHTML(t.takeProfitStr || t.takeProfit)}</td>
            <td data-label="ریسک">${(t.riskPercent || 0).toFixed(2)}%</td>
            <td data-label="کارمزد">${feeTxt}</td>
            <td data-label="وضعیت"><span class="${statusCls}">${statusText}</span></td>
            <td data-label="سود/ضرر"><span class="${pnlCls}">${pnlTxt}</span></td>
            <td class="actions">
                <button class="btn-icon" onclick="showTradeDetails(${t.id})" style="background-color:rgba(14,165,233,0.1);color:#0ea5e9;border:1px solid rgba(14,165,233,0.3);" title="جزئیات"><i class="fas fa-eye"></i></button>
                <button class="btn-icon" onclick="editTrade(${t.id})" style="background-color:rgba(245,158,11,0.1);color:#f59e0b;border:1px solid rgba(245,158,11,0.3);" title="ویرایش"><i class="fas fa-edit"></i></button>
                ${t.status === 'closed' ? `<button class="btn-icon" onclick="openCloseModal(${t.id})" style="background-color:rgba(16,185,129,0.1);color:#10b981;border:1px solid rgba(16,185,129,0.3);" title="ویرایش خروج"><i class="fas fa-flag-checkered"></i></button>` : ''}
                <button class="btn-icon" onclick="deleteTrade(${t.id})" style="background-color:rgba(239,68,68,0.1);color:#ef4444;border:1px solid rgba(239,68,68,0.3);" title="حذف"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    });
    tbody.innerHTML = html;
}

async function showTradeDetails(tradeId) {
    const t = trades.find(x => x.id === tradeId);
    if (!t) return;
    const modal = document.getElementById('detailsModal');
    const setTxt = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };

    setTxt('detail-symbol', t.symbol);
    setTxt('detail-type', t.type === 'buy' ? 'لانگ' : 'شورت');
    setTxt('detail-date', formatPersianDate(t.date, true));
    const st = document.getElementById('detail-status');
    if (st) { st.textContent = t.status === 'open' ? 'باز' : 'بسته'; st.className = 'detail-value ' + (t.status === 'open' ? 'profit' : 'neutral'); }
    setTxt('detail-entry', t.entryPriceStr || t.entryPrice);
    setTxt('detail-sl', t.stopLossStr || t.stopLoss);
    setTxt('detail-tp', t.takeProfitStr || t.takeProfit);
    setTxt('detail-risk-percent', (t.riskPercent || 0).toFixed(2) + '%');
    setTxt('detail-risk-amount', formatCurrency(t.totalRiskAmount || 0));
    setTxt('detail-position-size', formatNumber(t.positionSize || 0));
    setTxt('detail-rr', '1:' + (t.riskRewardRatio || 0) + (t.netProfit != null && t.totalRiskAmount > 0 ? ' (خالص 1:' + (t.netProfit / t.totalRiskAmount).toFixed(2) + ')' : ''));
    setTxt('detail-fee-entry', formatCurrency(t.feeEntry || 0));
    setTxt('detail-fee-exit', formatCurrency(t.feeExit || 0));
    setTxt('detail-total-fee', formatCurrency(t.totalFee || 0));

    const eImg = document.getElementById('detail-screenshot-entry');
    const ePh = document.getElementById('detail-screenshot-entry-placeholder');
    const xImg = document.getElementById('detail-screenshot-exit');
    const xPh = document.getElementById('detail-screenshot-exit-placeholder');

    if (t.entryScreenshot) { eImg.src = t.entryScreenshot; eImg.style.display = 'inline'; ePh.style.display = 'none'; }
    else { eImg.style.display = 'none'; ePh.style.display = 'block'; }
    if (t.exitScreenshot) { xImg.src = t.exitScreenshot; xImg.style.display = 'inline'; xPh.style.display = 'none'; }
    else { xImg.style.display = 'none'; xPh.style.display = 'block'; }

    const jr = document.getElementById('detail-journal-section');
    const items = [['استراتژی', t.strategy], ['یادداشت', t.notes]].filter(i => i[1]);
    jr.style.display = items.length ? 'block' : 'none';
    jr.innerHTML = items.length ? '<div class="detail-section-title"><i class="fas fa-book"></i> ژورنال</div><div class="details-grid">' + items.map(([l, v]) => `<div class="detail-item"><span class="detail-label">${l}</span><div class="detail-value">${escapeHTML(v)}</div></div>`).join('') + '</div>' : '';

    if (t.status === 'closed') {
        document.getElementById('detail-closed-price-container').style.display = 'block';
        document.getElementById('detail-result-section').style.display = 'block';
        setTxt('detail-closed-price', t.closedPrice || '0');
        const pnl = calculateTradePnL(t);
        const pe = document.getElementById('detail-net-pnl');
        pe.textContent = (pnl >= 0 ? '+' : '−') + formatCurrency(Math.abs(pnl));
        pe.style.color = pnl >= 0 ? '#10b981' : '#ef4444';
        const diff = t.type === 'buy' ? t.closedPrice - t.entryPrice : t.entryPrice - t.closedPrice;
        const gross = t.positionSize * diff;
        const gp = document.getElementById('detail-gross-pnl');
        gp.textContent = (gross >= 0 ? '+' : '') + formatCurrency(Math.abs(gross));
        gp.style.color = gross >= 0 ? '#10b981' : '#ef4444';
        setTxt('detail-fee-deducted', formatCurrency(t.totalFee || 0));
        if (t.closedDate) setTxt('detail-closed-date', formatPersianDate(t.closedDate, true));
    } else {
        document.getElementById('detail-closed-price-container').style.display = 'none';
        document.getElementById('detail-result-section').style.display = 'none';
    }

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeDetailsModal() {
    document.getElementById('detailsModal').style.display = 'none';
    document.body.style.overflow = 'auto';
}

function openCloseModal(tradeId) {
    currentTradeIdForClose = tradeId;
    const t = trades.find(x => x.id === tradeId);
    document.getElementById('closePriceInput').value = t && t.status === 'closed' ? t.closedPrice : '';
    document.getElementById('closeFeeInput').value = t && t.actualFee != null ? t.actualFee : '';
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
    const cpStr = document.getElementById('closePriceInput').value.trim();
    const cp = toNumber(cpStr);
    if (cp <= 0) { showNotification('قیمت معتبر وارد کنید.', 'error'); return; }
    if (!currentTradeIdForClose) return;
    const idx = trades.findIndex(t => t.id === currentTradeIdForClose);
    if (idx === -1) return;
    const t = trades[idx];
    const wasOpen = t.status === 'open';

    trades[idx].status = 'closed';
    trades[idx].closedPrice = cp;
    trades[idx].closedDate = (!wasOpen && t.closedDate) ? t.closedDate : new Date().toISOString();

    const feeStr = document.getElementById('closeFeeInput').value.trim();
    if (feeStr !== '') {
        const f = toNumber(feeStr);
        if (f >= 0) {
            trades[idx].totalFee = f;
            trades[idx].feeEntry = f / 2;
            trades[idx].feeExit = f / 2;
            trades[idx].actualFee = f;
        }
    }

    if (closeScreenshotData) {
        trades[idx].exitScreenshot = closeScreenshotData;
        trades[idx].exitScreenshotName = `exit_${t.uid}.png`;
    }

    await saveTradeToDB(trades[idx]);
    loadTrades();
    updateStats();
    updateDetailedStats();
    updateTotalRisk();
    updateMonthlyDashboard();
    loadOpenTrades();
    updateGrowthChart();
    updateMonthlyGrowthChart();
    closeCloseModal();

    const diff = t.type === 'buy' ? cp - t.entryPrice : t.entryPrice - cp;
    const pnl = diff * t.positionSize - (trades[idx].totalFee || 0);
    showNotification(`بسته شد. ${pnl >= 0 ? 'سود' : 'ضرر'}: ${formatCurrency(Math.abs(pnl))}`, pnl >= 0 ? 'success' : 'warning');
    checkStorage();
}

function calculateTradePnL(t) {
    if (t.status !== 'closed' || !t.closedPrice) return 0;
    const diff = t.type === 'buy' ? t.closedPrice - t.entryPrice : t.entryPrice - t.closedPrice;
    return t.positionSize * diff - (t.totalFee || 0);
}
function calculateTotalPnL() { return trades.reduce((s, t) => s + calculateTradePnL(t), 0); }
function calculateTotalProfit() { return trades.reduce((s, t) => { const p = calculateTradePnL(t); return s + (p > 0 ? p : 0); }, 0); }
function calculateTotalLoss() { return trades.reduce((s, t) => { const p = calculateTradePnL(t); return s + (p < 0 ? Math.abs(p) : 0); }, 0); }
function calculateTotalFees() { return trades.reduce((s, t) => s + (t.totalFee || 0), 0); }

function updateStats() {
    updateBalanceDisplay();
    renderAdvancedStats();
    refreshStrategyList();
    if (trades.length === 0) { resetStats(); return; }
    const closed = trades.filter(t => t.status === 'closed');
    const open = trades.filter(t => t.status === 'open');
    let profitable = 0, maxP = 0, maxL = 0;
    closed.forEach(t => { const p = calculateTradePnL(t); if (p > 0) { profitable++; if (p > maxP) maxP = p; } else if (p < maxL) maxL = p; });
    const winRate = closed.length > 0 ? (profitable / closed.length) * 100 : 0;
    document.getElementById('totalTrades').textContent = trades.length;
    document.getElementById('openTrades').textContent = open.length;
    document.getElementById('totalProfit').textContent = formatCurrency(calculateTotalProfit());
    document.getElementById('totalLoss').textContent = formatCurrency(calculateTotalLoss());
    document.getElementById('totalFees').textContent = formatCurrency(calculateTotalFees());
    document.getElementById('winRate').textContent = winRate.toFixed(1) + '%';
    document.getElementById('maxProfit').textContent = '+' + formatCurrency(Math.abs(maxP));
    document.getElementById('maxLoss').textContent = formatCurrency(Math.abs(maxL));
}

function resetStats() {
    const setTxt = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    setTxt('totalTrades', '0'); setTxt('openTrades', '0');
    setTxt('totalProfit', '$0.00'); setTxt('totalLoss', '$0.00'); setTxt('totalFees', '$0.00');
    setTxt('winRate', '0%'); setTxt('maxProfit', '$0.00'); setTxt('maxLoss', '$0.00');
}

async function editTrade(id) {
    const t = trades.find(x => x.id === id);
    if (!t) return;
    document.getElementById('symbol').value = t.symbol;
    document.getElementById('date').value = t.date;
    document.getElementById('type').value = t.type;
    document.getElementById('entryPrice').value = t.entryPriceStr || t.entryPrice;
    document.getElementById('stopLoss').value = t.stopLossStr || t.stopLoss;
    document.getElementById('takeProfit').value = t.takeProfitStr || t.takeProfit;
    document.getElementById('riskPercent').value = t.riskPercent;
    document.getElementById('feePercent').value = t.totalFeePercent ?? '';
    refreshStrategyList(t.strategy || '');
    document.getElementById('notes').value = t.notes || '';

    if (t.baseBalanceAtEntry != null && t.baseBalanceAtEntry > 0) editBaseBalance = t.baseBalanceAtEntry;
    else if (t.riskPercent > 0 && t.totalRiskAmount > 0) editBaseBalance = t.totalRiskAmount * 100 / t.riskPercent;
    else editBaseBalance = null;
    editingTradeId = id;

    if (t.entryScreenshot) {
        document.getElementById('entryScreenshotPreview').src = t.entryScreenshot;
        document.getElementById('entryScreenshotPreviewContainer').classList.add('active');
    } else {
        removeEntryScreenshot();
    }

    calculateRisk();
    showNotification('در حال ویرایش. با ثبت، تغییرات ذخیره می‌شود.', 'info');
    switchSection('trade-form');
    loadOpenTrades();
}

async function deleteTrade(id) {
    if (!confirm('از حذف این معامله اطمینان دارید؟')) return;
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
    showNotification('حذف شد.', 'warning');
}

function updateAccountsList() {
    const c = document.getElementById('accountsListContainer');
    if (!c) return;
    if (!accounts || accounts.length === 0) { c.innerHTML = '<div class="account-item" style="justify-content:center;">حسابی وجود ندارد</div>'; return; }
    c.innerHTML = accounts.map(a => {
        const isActive = a.id === activeAccountId;
        return `<div class="account-item ${isActive ? 'active-account' : ''}">
            <div class="account-info">
                <div class="account-name">${escapeHTML(a.name)}</div>
                <div class="account-balance">${formatCurrency(a.balance)}</div>
                ${isActive ? '<div class="active-badge">فعال</div>' : ''}
            </div>
            <div class="account-vip">
                <select class="account-vip-select" onchange="setAccountVip(${a.id}, this.value)" title="VIP">${vipOptionsHTML(a.vipLevel)}</select>
            </div>
            <div class="account-actions">
                <button class="account-action-btn" onclick="switchAccount(${a.id})" ${isActive ? 'disabled' : ''} title="فعال"><i class="fas fa-check-circle"></i></button>
                <button class="account-action-btn delete" onclick="deleteAccount(${a.id})" ${a.id === 1 ? 'disabled' : ''} title="حذف"><i class="fas fa-trash"></i></button>
            </div>
        </div>`;
    }).join('');
}

async function addNewAccount() {
    const name = document.getElementById('newAccountName').value.trim();
    const balance = toNumber(document.getElementById('newAccountBalance').value);
    const vip = normalizeVip(document.getElementById('newAccountVip').value);
    if (!name) { showNotification('نام حساب را وارد کنید.', 'error'); return; }
    if (balance <= 0) { showNotification('موجودی اولیه معتبر وارد کنید.', 'error'); return; }
    if (accounts.find(a => a.name.toLowerCase() === name.toLowerCase())) { showNotification('این نام قبلاً وجود دارد.', 'error'); return; }
    const newId = accounts.length > 0 ? Math.max(...accounts.map(a => a.id)) + 1 : 1;
    accounts.push({ id: newId, name, balance: Math.round(balance * 100) / 100, vipLevel: vip });
    await saveAccountsToDB();
    document.getElementById('newAccountName').value = '';
    document.getElementById('newAccountBalance').value = '';
    updateAccountsList();
    showNotification('حساب اضافه شد.', 'success');
}

// ✅ deleteAccount که واقعاً از IndexedDB پاک می‌کند
async function deleteAccount(accountId) {
    if (accountId === 1) { showNotification('حساب اصلی حذف نمی‌شود.', 'error'); return; }
    if (accounts.length <= 1) { showNotification('حداقل یک حساب لازم است.', 'error'); return; }
    if (!confirm('حذف این حساب و تمام معاملاتش؟')) return;
    try {
        await db.deleteAccount(accountId);
        const accTrades = await db.getTradesByAccount(accountId);
        if (accTrades.length > 0) await db.deleteTrades(accTrades.map(t => t.id));
        accounts = accounts.filter(a => a.id !== accountId);
        if (accountId === activeAccountId) {
            activeAccountId = 1;
            activeAccount = accounts.find(a => a.id === 1);
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
        showNotification('حساب حذف شد.', 'warning');
    } catch (e) {
        console.error(e);
        showNotification('خطا در حذف حساب.', 'error');
    }
}

async function switchAccount(accountId) {
    const newAcc = accounts.find(a => a.id === accountId);
    if (!newAcc) { showNotification('حساب یافت نشد.', 'error'); return; }
    activeAccountId = accountId;
    activeAccount = newAcc;
    accountBalance = newAcc.balance;
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
    showNotification(`«${newAcc.name}» فعال شد.`, 'success');
    closeAllModals();
}

function changeMonth(dir) {
    let m = currentMonth + dir, y = currentYear;
    if (m > 12) { m = 1; y++; } else if (m < 1) { m = 12; y--; }
    currentYear = y; currentMonth = m;
    updateMonthlyDashboard();
    updateMonthlyGrowthChart();
}

function updateMonthlyDashboard() {
    const md = document.getElementById('currentMonthDisplay');
    if (!md) return;
    md.textContent = persianMonths[currentMonth - 1] + ' ' + currentYear;
    const now = getPersianDateParts(new Date());
    const nextBtn = document.getElementById('nextMonthBtn');
    if (nextBtn) nextBtn.disabled = !!(now && currentYear === now.year && currentMonth === now.month);

    const monthly = trades.filter(t => {
        if (t.accountId !== activeAccountId) return false;
        const pd = getPersianDateParts(t.date);
        return pd && pd.year === currentYear && pd.month === currentMonth;
    });
    document.getElementById('monthlyTradeCount').textContent = monthly.length;
    let totalPnL = 0, prof = 0, loss = 0;
    monthly.forEach(t => {
        if (t.status === 'closed') {
            const p = calculateTradePnL(t);
            totalPnL += p;
            if (p > 0) prof++; else if (p < 0) loss++;
        }
    });
    const tp = document.getElementById('monthlyTotalPnL');
    tp.textContent = (totalPnL >= 0 ? '+' : '') + formatCurrency(Math.abs(totalPnL));
    tp.style.color = totalPnL >= 0 ? '#10b981' : '#ef4444';
    document.getElementById('monthlyProfitable').textContent = prof;
    document.getElementById('monthlyLoss').textContent = loss;

    const tbody = document.getElementById('monthlyTradesBody');
    if (monthly.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="no-trades-month"><i class="fas fa-chart-line" style="font-size:2rem;margin-bottom:15px;display:block;"></i>معامله‌ای در این ماه نیست</td></tr>`;
        return;
    }
    const sorted = [...monthly].sort((a, b) => new Date(b.date) - new Date(a.date));
    tbody.innerHTML = sorted.map(t => {
        let pnlTxt = 'باز', pnlCls = 'neutral';
        if (t.status === 'closed') {
            const p = calculateTradePnL(t);
            pnlTxt = (p >= 0 ? '+' : '−') + formatCurrency(Math.abs(p));
            pnlCls = p > 0 ? 'profit' : (p < 0 ? 'loss' : 'neutral');
        }
        return `<tr onclick="showTradeDetails(${t.id})">
            <td data-label="تاریخ">${formatPersianDate(t.date, true)}</td>
            <td data-label="ارز"><span class="crypto-badge" style="font-size:0.8rem;">${escapeHTML(t.symbol)}</span></td>
            <td data-label="نوع">${t.type === 'buy' ? 'لانگ' : 'شورت'}</td>
            <td class="price-display" data-label="ورود">${escapeHTML(t.entryPriceStr || t.entryPrice)}</td>
            <td class="price-display" data-label="خروج">${t.status === 'closed' ? escapeHTML(t.closedPrice) : '-'}</td>
            <td data-label="سود/ضرر"><span class="${pnlCls}">${pnlTxt}</span></td>
            <td data-label="وضعیت"><span class="${t.status === 'open' ? 'profit' : 'neutral'}">${t.status === 'open' ? 'باز' : 'بسته'}</span></td>
        </tr>`;
    }).join('');
}

function showProgress(message, percent = 0) {
    const p = document.getElementById('backupProgress');
    if (!p) return;
    p.classList.add('active');
    const bar = document.getElementById('progressBar'); if (bar) bar.style.width = percent + '%';
    const txt = document.getElementById('progressText'); if (txt) txt.textContent = message;
    const st = document.getElementById('progressStatus'); if (st) st.textContent = percent + '%';
    const c = document.getElementById('cancelImportBtn'); if (c) c.style.display = 'inline-block';
}
function hideProgress() {
    const p = document.getElementById('backupProgress'); if (p) p.classList.remove('active');
    const c = document.getElementById('cancelImportBtn'); if (c) c.style.display = 'none';
}
function cancelImport() { isImportCancelled = true; hideProgress(); showNotification('لغو شد', 'warning'); }

async function exportData() {
    try {
        showProgress('آماده‌سازی...', 10);
        const backupData = await db.backup();
        showProgress('ایجاد ZIP...', 30);
        const zip = new JSZip();
        const exportTrades = backupData.trades.map(t => ({ ...t, entryScreenshot: t.entryScreenshotName || null, exitScreenshot: t.exitScreenshotName || null }));
        zip.file('data.json', JSON.stringify({ ...backupData, trades: exportTrades }, null, 2));
        showProgress('پردازش تصاویر...', 50);
        const imgFolder = zip.folder('images');
        let count = 0, processed = 0;
        backupData.trades.forEach(t => { if (t.entryScreenshot) count++; if (t.exitScreenshot) count++; });
        for (const t of backupData.trades) {
            if (isImportCancelled) { showNotification('لغو شد', 'warning'); hideProgress(); return; }
            if (t.entryScreenshot && t.entryScreenshotName) {
                imgFolder.file(t.entryScreenshotName, t.entryScreenshot.split(',')[1], { base64: true });
                processed++;
                showProgress(`تصویر ${processed}/${count}...`, 50 + Math.floor((processed / Math.max(1, count)) * 40));
            }
            if (t.exitScreenshot && t.exitScreenshotName) {
                imgFolder.file(t.exitScreenshotName, t.exitScreenshot.split(',')[1], { base64: true });
                processed++;
                showProgress(`تصویر ${processed}/${count}...`, 50 + Math.floor((processed / Math.max(1, count)) * 40));
            }
        }
        showProgress('نهایی‌سازی...', 90);
        const now = new Date();
        const pd = new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(now).replace(/\//g, '-');
        const fileName = `crypto-journal-${pd}.zip`;
        const content = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
        showProgress('دانلود...', 100);
        await db.saveSetting('lastBackupAt', String(Date.now()));

        if (window.navigator.standalone && navigator.canShare) {
            const file = new File([content], fileName, { type: 'application/zip' });
            if (navigator.canShare({ files: [file] })) {
                try { await navigator.share({ files: [file], title: fileName }); hideProgress(); showNotification('آماده ذخیره شد.', 'success'); return; }
                catch (e) { if (e && e.name === 'AbortError') { hideProgress(); return; } }
            }
        }
        const url = URL.createObjectURL(content);
        const link = document.createElement('a');
        link.href = url; link.download = fileName; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
        setTimeout(hideProgress, 2000);
        showNotification('دانلود شد.', 'success');
    } catch (e) {
        console.error(e); hideProgress(); showNotification('خطا: ' + e.message, 'error');
    } finally { isImportCancelled = false; }
}

async function importData() {
    const fileInput = document.getElementById('backupFile');
    const file = fileInput.files[0];
    if (!file) { showNotification('فایل ZIP انتخاب کنید.', 'error'); return; }
    const MAX = 2 * 1024 * 1024 * 1024;
    if (file.size > MAX) { showNotification('حجم بیش از ۲GB', 'error'); fileInput.value = ''; return; }
    if (!confirm('اطلاعات فعلی جایگزین می‌شود. ادامه؟')) return;

    isImportCancelled = false;
    importStartTime = Date.now();
    let snapshot = null, wiped = false;
    let failedCount = 0;  // ✅ شمارش خطاها
    const restore = async () => {
        if (!wiped || !snapshot) return;
        try {
            await db.clearAll();
            await db.saveAccounts(snapshot.accounts || []);
            await db.saveTrades(snapshot.trades || []);
            if (snapshot.settings) {
                for (const s of snapshot.settings) await db.saveSetting(s.key, s.value);
            }
            if (snapshot.activeId) await db.saveSetting('activeAccountId', snapshot.activeId);
            await loadAccountsFromDB();
            await loadTradesFromDB();
            updateBalanceDisplay();
            updateStats();
        } catch (e) { console.error('restore error:', e); }
        wiped = false;
    };

    try {
        showProgress('خواندن ZIP...', 10);
        const zip = new JSZip();
        const zc = await zip.loadAsync(file);
        if (!zc.file('data.json')) throw new Error('data.json یافت نشد');
        showProgress('استخراج...', 20);
        const dataStr = await zc.file('data.json').async('string');
        const backupData = JSON.parse(dataStr);

        showProgress('تصاویر...', 30);
        const imagesMap = new Map();
        const imgFolder = zc.folder('images');
        let total = 0, done = 0;
        if (imgFolder) {
            imgFolder.forEach(() => total++);
            const proms = [];
            imgFolder.forEach((rel, f) => {
                if (!f.dir) {
                    proms.push(
                        f.async('base64').then(content => {
                            if (isImportCancelled) return;
                            const name = rel.split('/').pop();
                            imagesMap.set(name, `data:${getMimeType(name)};base64,${content}`);
                            done++;
                            const pct = 30 + Math.floor((done / Math.max(1, total)) * 30);
                            showProgress(`تصویر ${done}/${total}`, pct);
                        }).catch(err => {
                            console.warn('تصویر خراب نادیده گرفته شد:', rel, err);
                            done++;
                        })
                    );
                }
            });
            await Promise.all(proms);
            if (isImportCancelled) { showNotification('لغو شد', 'warning'); hideProgress(); return; }
        }
        showProgress('اتصال عکس‌ها...', 60);

        const validIds = new Set((backupData.accounts || []).map(a => a.id));
        const fallbackId = backupData.accounts && backupData.accounts.length > 0 ? backupData.accounts[0].id : 1;
        if (backupData.trades && Array.isArray(backupData.trades)) {
            for (const t of backupData.trades) {
                if (isImportCancelled) { showNotification('لغو شد', 'warning'); hideProgress(); return; }
                if (!t.uid) t.uid = `trade_${t.id}`;
                if (!t.accountId || !validIds.has(t.accountId)) t.accountId = fallbackId;
                if (t.id == null || isNaN(parseInt(t.id))) t.id = generateTradeId();
                if (t.entryScreenshot) {
                    const fn = `entry_${t.uid}.png`;
                    if (imagesMap.has(fn)) { t.entryScreenshot = imagesMap.get(fn); t.entryScreenshotName = fn; }
                    else { t.entryScreenshot = null; t.entryScreenshotName = null; }
                }
                if (t.exitScreenshot) {
                    const fn = `exit_${t.uid}.png`;
                    if (imagesMap.has(fn)) { t.exitScreenshot = imagesMap.get(fn); t.exitScreenshotName = fn; }
                    else { t.exitScreenshot = null; t.exitScreenshotName = null; }
                }
                if (t.baseBalanceAtEntry == null && t.riskPercent > 0 && t.totalRiskAmount > 0) {
                    t.baseBalanceAtEntry = t.totalRiskAmount * 100 / t.riskPercent;
                }
            }
        }

        showProgress('ذخیره...', 70);
        snapshot = await db.backup();
        snapshot.activeId = await db.getSetting('activeAccountId');
        await db.clearAll();
        wiped = true;

        if (backupData.accounts && Array.isArray(backupData.accounts)) {
            await db.saveAccounts(backupData.accounts);
            accounts = backupData.accounts;
        }
        // ✅ بازگردانی settings (customStrategies و غیره)
        if (backupData.settings && Array.isArray(backupData.settings)) {
            for (const s of backupData.settings) {
                try { await db.saveSetting(s.key, s.value); } catch (e) { console.warn('skip setting', s.key); }
            }
            const cs = backupData.settings.find(s => s.key === 'customStrategies');
            if (cs) { try { customStrategies = JSON.parse(cs.value || '[]'); } catch (e) {} }
        }
        if (backupData.trades && Array.isArray(backupData.trades)) {
            const batch = 20, totalT = backupData.trades.length;
            trades = [];
            for (let i = 0; i < totalT; i += batch) {
                if (isImportCancelled) { await restore(); showNotification('لغو و بازگردانی', 'warning'); hideProgress(); return; }
                const b = backupData.trades.slice(i, i + batch);
                for (const t of b) {
                    try { await db.saveTrade(t); trades.push(t); }
                    catch (e) {
                        if (e.message.includes('فضا')) { isImportCancelled = true; await restore(); hideProgress(); showNotification(e.message, 'error'); return; }
                        failedCount++;
                        console.error('خطا در ذخیره معامله', t.id, e);
                    }
                }
                showProgress(`ذخیره ${i + b.length}/${totalT}`, 70 + Math.floor((i / totalT) * 25));
                await new Promise(r => setTimeout(r, 5));
            }
        }
        if (accounts.length > 0) {
            const savedId = await db.getSetting('activeAccountId');
            activeAccountId = savedId ? parseInt(savedId) : accounts[0].id;
            activeAccount = accounts.find(a => a.id === activeAccountId) || accounts[0];
            accountBalance = activeAccount ? activeAccount.balance : 0;
            initialAccountBalance = accountBalance;
        }
        showProgress('نهایی...', 100);
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
        refreshStrategyList();
        fileInput.value = '';
        setTimeout(hideProgress, 2000);
        if (failedCount > 0) {
            showNotification(`⚠️ بارگذاری شد ولی ${failedCount} معامله ذخیره نشد (${trades.length} از ${backupData.trades?.length || 0})`, 'warning');
        } else {
            showNotification(`✅ بارگذاری شد. ${trades.length} معامله`, 'success');
        }
        checkStorage();
    } catch (e) {
        console.error(e); await restore(); hideProgress();
        showNotification('❌ ' + (e.message || 'خطا در خواندن فایل'), 'error');
    } finally { isImportCancelled = false; }
}

function showNotification(msg, type = 'info') {
    const ex = document.querySelector('.notification'); if (ex) ex.remove();
    const n = document.createElement('div');
    n.className = 'notification';
    n.textContent = msg;
    Object.assign(n.style, { position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', padding: '12px 20px', borderRadius: '8px', zIndex: '10000', fontWeight: '600', boxShadow: '0 5px 15px rgba(0,0,0,0.3)', maxWidth: '90vw', textAlign: 'center' });
    if (type === 'success') { n.style.backgroundColor = '#10b981'; n.style.color = 'white'; }
    else if (type === 'warning') { n.style.backgroundColor = '#f59e0b'; n.style.color = '#78350f'; }
    else if (type === 'error') { n.style.backgroundColor = '#ef4444'; n.style.color = 'white'; }
    else { n.style.backgroundColor = '#3b82f6'; n.style.color = 'white'; }
    document.body.appendChild(n);
    setTimeout(() => {
        n.style.opacity = '0'; n.style.transition = 'opacity 0.5s';
        setTimeout(() => { if (n.parentNode) n.parentNode.removeChild(n); }, 500);
    }, 3000);
}

document.addEventListener('DOMContentLoaded', function() {
    const now = new Date();
    const off = now.getTimezoneOffset() * 60000;
    document.getElementById('date').value = new Date(now - off).toISOString().slice(0, 16);
    document.getElementById('newAccountVip').innerHTML = vipOptionsHTML('vip0');

    document.getElementById('tradeForm').addEventListener('reset', () => {
        editingTradeId = null;
        editBaseBalance = null;
        setTimeout(() => {
            removeEntryScreenshot();
            const fd = document.getElementById('feeDetails'); if (fd) fd.style.display = 'none';
            syncAutoFee();
        }, 0);
    });

    initialize();

    ['entryPrice', 'stopLoss', 'takeProfit', 'riskPercent', 'feePercent'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', calculateRisk);
    });
    const typeEl = document.getElementById('type');
    if (typeEl) typeEl.addEventListener('change', calculateRisk);

    const nb = document.getElementById('newBalanceInput');
    if (nb) nb.addEventListener('input', function() {
        const v = toNumber(this.value);
        if (v > 0) this.value = Math.round(v * 100) / 100;
    });
    const nab = document.getElementById('newAccountBalance');
    if (nab) nab.addEventListener('input', function() {
        const v = toNumber(this.value);
        if (v > 0) this.value = Math.round(v * 100) / 100;
    });

    const dm = document.getElementById('detailsModal');
    if (dm) dm.addEventListener('click', e => { if (e.target === dm) closeDetailsModal(); });
    const cm = document.getElementById('closeTradeModal');
    if (cm) cm.addEventListener('click', e => { if (e.target === cm) closeCloseModal(); });
    const im = document.getElementById('imageModal');
    if (im) im.addEventListener('click', e => { if (e.target === im) closeImageModal(); });
});

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-box.active, .details-modal, .close-modal, .image-modal').forEach(m => {
            if (m.style.display === 'flex' || m.classList.contains('active')) {
                if (m.id === 'detailsModal') closeDetailsModal();
                else if (m.id === 'closeTradeModal') closeCloseModal();
                else if (m.id === 'imageModal') closeImageModal();
                else if (m.classList.contains('modal-box')) toggleModal(m.id);
            }
        });
    }
});

function applyHistoryFilters(list) {
    const v = id => (document.getElementById(id) || {}).value || '';
    const q = v('histSearch').trim().toLowerCase();
    const st = v('histStatus') || 'all';
    const rs = v('histResult') || 'all';
    const ty = v('histType') || 'all';
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
        const max = 1200;
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * s);
        c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        cb(c.toDataURL('image/jpeg', 0.78));
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
    if (PRESET_STRATEGIES.includes(name)) { showNotification('پیش‌فرض قابل حذف نیست.', 'warning'); return; }
    if (trades.some(t => t.strategy === name)) { showNotification('در معامله‌ها استفاده شده.', 'warning'); return; }
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
        box.innerHTML = '<h2 class="section-title"><i class="fas fa-microscope"></i> تحلیل پیشرفته</h2><p class="adv-empty">بعد از اولین معامله‌ی بسته، تحلیل اینجا نمایش داده می‌شود.</p>';
        return;
    }
    const n = rows.length;
    const wins = rows.filter(x => x.pnl > 0);
    const losses = rows.filter(x => x.pnl < 0);
    const gp = wins.reduce((s, x) => s + x.pnl, 0);
    const gl = Math.abs(losses.reduce((s, x) => s + x.pnl, 0));
    const pf = gl > 0 ? (gp / gl).toFixed(2) : (gp > 0 ? '∞' : '-');
    const avgR = rows.reduce((s, x) => s + x.r, 0) / n;
    const avgWin = wins.length ? gp / wins.length : 0;
    const avgLoss = losses.length ? gl / losses.length : 0;
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
    const days = ['یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه','شنبه'];
    const group = keyFn => {
        const m = new Map();
        rows.forEach(x => {
            const k = keyFn(x.t) || 'نامشخص';
            const g = m.get(k) || { n: 0, w: 0, pnl: 0, r: 0 };
            g.n++; if (x.pnl > 0) g.w++; g.pnl += x.pnl; g.r += x.r;
            m.set(k, g);
        });
        return [...m.entries()].sort((a, b) => b[1].pnl - a[1].pnl);
    };
    const table = (title, list) => `<div class="adv-block"><h3>${title}</h3><div class="adv-table-wrap"><table class="adv-table"><thead><tr><th>مورد</th><th>تعداد</th><th>وین‌ریت</th><th>میانگین R</th><th>سود/زیان</th></tr></thead><tbody>` +
        list.map(([k, g]) => `<tr><td>${escapeHTML(k)}</td><td>${g.n}</td><td>${Math.round(g.w / g.n * 100)}%</td><td>${(g.r / g.n).toFixed(2)}</td><td class="${g.pnl >= 0 ? 'profit' : 'loss'}">${sgn(g.pnl)}</td></tr>`).join('') +
        '</tbody></table></div></div>';
    box.innerHTML = '<h2 class="section-title"><i class="fas fa-microscope"></i> تحلیل پیشرفته</h2><div class="adv-grid">' +
        tile('ضریب سود (Profit Factor)', pf, parseFloat(pf) >= 1 || pf === '∞' ? 'profit' : 'loss') +
        tile('میانگین R', avgR.toFixed(2) + 'R', avgR >= 0 ? 'profit' : 'loss') +
        tile('امید ریاضی (هر معامله)', sgn((gp - gl) / n), gp - gl >= 0 ? 'profit' : 'loss') +
        tile('میانگین سود / ضرر', `${formatCurrency(avgWin)} / ${formatCurrency(avgLoss)}`) +
        tile('نسبت سود به ضرر', payoff) +
        tile('حداکثر دراودان', `${formatCurrency(mdd)} (${mddP.toFixed(1)}%)`, mdd > 0 ? 'loss' : '') +
        tile('بیشترین برد پیاپی', maxW) +
        tile('بیشترین باخت پیاپی', maxL) +
        tile('رگه‌ی فعلی', cur) + '</div>' +
        table('بر اساس نماد', group(t => t.symbol)) +
        table('بر اساس استراتژی', group(t => t.strategy)) +
        table('بر اساس روز هفته', group(t => { const d = new Date(t.date); return isNaN(d) ? '' : days[d.getDay()]; }));
}
