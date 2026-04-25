import { db, type SellRecord } from '../db/database';

export class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ValidationError';
    }
}

export interface SellAssetParams {
    assetId: number;
    soldQuantity: number;
    sellPrice: number;
    sellDate: number;
    fees?: number;
    exchangeRateAtSale?: number; // required for US/Crypto; omit for TW
}

export async function sellAsset(params: SellAssetParams): Promise<SellRecord> {
    const { assetId, soldQuantity, sellPrice, sellDate, fees, exchangeRateAtSale } = params;

    if (soldQuantity <= 0) throw new ValidationError('soldQuantity must be > 0');
    if (sellPrice <= 0) throw new ValidationError('sellPrice must be > 0');

    let createdRecord!: SellRecord;

    await db.transaction('rw', db.assets, db.sellRecords, async () => {
        // Step 0: re-read inside transaction to guard against race conditions
        const asset = await db.assets.get(assetId);
        if (!asset) throw new ValidationError('Asset not found');
        if (soldQuantity > asset.quantity) throw new ValidationError('數量超過持倉');

        const avgCostAtSale = asset.cost;
        const effectiveFees = fees ?? 0;
        const realizedGain = (sellPrice - avgCostAtSale) * soldQuantity - effectiveFees;

        let realizedGainTWD: number | undefined;
        if (asset.market !== 'TW' && exchangeRateAtSale !== undefined) {
            realizedGainTWD = realizedGain * exchangeRateAtSale;
        }

        let holdingDays: number | undefined;
        if (asset.purchaseDate !== undefined && asset.purchaseDate > 0) {
            holdingDays = Math.floor((sellDate - asset.purchaseDate) / 86400000);
        }

        const record: Omit<SellRecord, 'id'> = {
            recordId: `sell-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            symbol: asset.symbol,
            name: asset.name,
            market: asset.market,
            soldQuantity,
            avgCostAtSale,
            sellPrice,
            sellDate,
            purchaseDateSnapshot: asset.purchaseDate,
            holdingDays,
            exchangeRateAtSale: asset.market !== 'TW' ? exchangeRateAtSale : undefined,
            realizedGain,
            realizedGainTWD,
            fees,
        };

        await db.sellRecords.add(record as SellRecord);
        createdRecord = record as SellRecord;

        if (soldQuantity < asset.quantity) {
            await db.assets.update(assetId, { quantity: asset.quantity - soldQuantity });
        } else {
            await db.assets.delete(assetId);
        }
    });

    return createdRecord;
}
