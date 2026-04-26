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
    const result = Math.pow(currentPrice / cost, 365 / holdingDays) - 1;
    if (!isFinite(result)) return null;
    return result;
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

export interface GroupedAssetReturn {
    symbol: string;
    market: string;
    name: string;
    annReturn: number | null;
    holdingDays: number;
    pnlTWD: number;
    shortHolding: boolean;
    hasCostData: boolean;
}

export function groupedAssetReturns(
    assets: Asset[],
    exchangeRate: number
): GroupedAssetReturn[] {
    const groups = new Map<string, Asset[]>();
    for (const a of assets) {
        const key = `${a.symbol}::${a.market}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(a);
    }

    const result: GroupedAssetReturn[] = [];
    for (const lots of groups.values()) {
        const first = lots[0];
        const rate = first.market === 'TW' ? 1 : (exchangeRate || 32.5);

        const datedLots = lots.filter(a => a.purchaseDate && a.purchaseDate > 0);
        const earliestDate = datedLots.length > 0
            ? datedLots.reduce((min, a) => Math.min(min, a.purchaseDate!), Infinity)
            : 0;
        const holdingDays = earliestDate > 0
            ? Math.floor((Date.now() - earliestDate) / 86400000)
            : 0;

        let weightedSum = 0;
        let totalWeight = 0;
        for (const a of lots) {
            if (!a.purchaseDate || !a.currentPrice || !a.cost) continue;
            const ret = annualizedReturn(a.cost, a.currentPrice, a.purchaseDate);
            if (ret === null) continue;
            const mktValue = a.currentPrice * a.quantity;
            weightedSum += ret * mktValue;
            totalWeight += mktValue;
        }
        const annReturn = totalWeight > 0.01 ? weightedSum / totalWeight : null;

        let pnlTWD = 0;
        let hasCostData = false;
        for (const a of lots) {
            if (a.currentPrice && a.cost) {
                pnlTWD += (a.currentPrice - a.cost) * a.quantity * rate;
                hasCostData = true;
            }
        }

        result.push({
            symbol: first.symbol,
            market: first.market,
            name: first.name,
            annReturn,
            holdingDays,
            pnlTWD,
            shortHolding: holdingDays > 0 && holdingDays < 30,
            hasCostData,
        });
    }

    return result.sort((a, b) => {
        if (a.annReturn === null && b.annReturn === null) return 0;
        if (a.annReturn === null) return 1;
        if (b.annReturn === null) return -1;
        return b.annReturn - a.annReturn;
    });
}
