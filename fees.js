const VIP_FEE_RATES = {
    vip0: { maker: 0.0002,  taker: 0.0006 },
    vip1: { maker: 0.0002,  taker: 0.0005 },
    vip2: { maker: 0.00016, taker: 0.0005 },
    vip3: { maker: 0.00014, taker: 0.0004 },
    vip4: { maker: 0.00012, taker: 0.000375 },
    vip5: { maker: 0.0001,  taker: 0.00035 },
    vip6: { maker: 0.00008, taker: 0.000315 },
    vip7: { maker: 0.00006, taker: 0.0003 }
};
const VIP_LEVELS = Object.keys(VIP_FEE_RATES);
const DEFAULT_ENTRY_ORDER = 'taker';
const DEFAULT_EXIT_ORDER = 'taker';

function normalizeVip(vipLevel) { return VIP_FEE_RATES[vipLevel] ? vipLevel : 'vip0'; }
function getFeeRate(vipLevel, orderType) {
    const rates = VIP_FEE_RATES[normalizeVip(vipLevel)];
    return orderType === 'maker' ? rates.maker : rates.taker;
}
function getTotalFeePercent(vipLevel, entryType = DEFAULT_ENTRY_ORDER, exitType = DEFAULT_EXIT_ORDER) {
    const total = getFeeRate(vipLevel, entryType) + getFeeRate(vipLevel, exitType);
    return Math.round(total * 100 * 1e6) / 1e6;
}
function vipLabel(vipLevel) { return 'VIP ' + normalizeVip(vipLevel).replace('vip', ''); }
function vipOptionsHTML(selected) {
    const sel = normalizeVip(selected);
    return VIP_LEVELS.map(v => `<option value="${v}"${v === sel ? ' selected' : ''}>${vipLabel(v)}</option>`).join('');
}
