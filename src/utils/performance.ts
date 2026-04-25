import type { Asset } from '../db/database';

export function annualizedReturn(
    cost: number,
    currentPrice: number,
    purchaseDate: number
): number | null {
    if (!cost || cost <= 0) return null;
    if (!currentPrice || currentPrice <= 0) return null;
    if (!purchaseDate || purchaseDate <= 0) return null;
    const holdingDays = Math.floor((Date.now() - purchaseDate) / 86400000);
    if (holdingDays < 1) return null;
    return Math.pow(currentPrice / cost, 365 / holdingDays) - 1;
}

export function portfolioAnnualizedReturn(
    assets: Asset[],
    exchangeRate: number
): { value: number | null; excludedCount: number } {
    let weightedSum = 0;
    let totalWeightTWD = 0;
    let excludedCount = 0;

    for (const a of assets) {
        if (!a.purchaseDate || !a.currentPrice || !a.cost) {
            excludedCount++;
            continue;
        }
        const ret = annualizedReturn(a.cost, a.currentPrice, a.purchaseDate);
        if (ret === null) {
            excludedCount++;
            continue;
        }
        const rate = a.market === 'TW' ? 1 : (exchangeRate || 32.5);
        const mktValueTWD = a.currentPrice * a.quantity * rate;
        weightedSum += ret * mktValueTWD;
        totalWeightTWD += mktValueTWD;
    }

    if (totalWeightTWD <= 0.01) return { value: null, excludedCount };
    return { value: weightedSum / totalWeightTWD, excludedCount };
}

export function benchmarkAnnualizedReturn(
    startPrice: number,
    currentPrice: number,
    holdingDays: number
): number | null {
    if (!startPrice || startPrice <= 0) return null;
    if (!currentPrice || currentPrice <= 0) return null;
    if (holdingDays < 1) return null;
    return Math.pow(currentPrice / startPrice, 365 / holdingDays) - 1;
}

export function portfolioHoldingDays(assets: Asset[]): number {
    const datedAssets = assets.filter(a => a.purchaseDate && a.purchaseDate > 0);
    if (datedAssets.length === 0) return 0;
    const earliest = datedAssets.reduce((min, a) => Math.min(min, a.purchaseDate!), Infinity);
    return Math.floor((Date.now() - earliest) / 86400000);
}

export function portfolioStartDate(assets: Asset[]): number | null {
    const datedAssets = assets.filter(a => a.purchaseDate && a.purchaseDate > 0);
    if (datedAssets.length === 0) return null;
    return datedAssets.reduce((min, a) => Math.min(min, a.purchaseDate!), Infinity);
}
