import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

export const MARKET_SYNC_BATCH_SOURCES = ["cron", "manual"] as const;
export const MARKET_SYNC_BATCH_ASSET_TYPES = ["stock", "mutual_fund", "mixed"] as const;
export const MARKET_SYNC_BATCH_STATUSES = [
  "pending",
  "partially_approved",
  "approved",
  "synced",
  "discarded",
  "error",
] as const;
export const MARKET_SYNC_ITEM_STATUSES = [
  "pending",
  "approved",
  "synced",
  "skipped",
  "error",
] as const;

const marketSyncBatchItemSchema = new Schema(
  {
    itemKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 260,
    },
    assetType: {
      type: String,
      enum: ["stock", "mutual_fund"],
      required: true,
      index: true,
    },
    assetKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 220,
    },
    assetLabel: {
      type: String,
      required: true,
      trim: true,
      maxlength: 260,
    },
    quantityOrUnits: {
      type: Number,
      required: true,
      min: 0,
    },
    investedAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    oldPriceOrNav: {
      type: Number,
      default: null,
      min: 0,
    },
    oldValue: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    oldSyncedAt: {
      type: Date,
      default: null,
    },
    newPriceOrNav: {
      type: Number,
      default: null,
      min: 0,
    },
    newValue: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    newFetchedAt: {
      type: Date,
      required: true,
    },
    changeAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    changePercent: {
      type: Number,
      default: null,
    },
    status: {
      type: String,
      enum: MARKET_SYNC_ITEM_STATUSES,
      required: true,
      default: "pending",
      index: true,
    },
    errorMessage: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
  },
  {
    _id: true,
  }
);

const marketSyncBatchSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    date: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      index: true,
    },
    source: {
      type: String,
      enum: MARKET_SYNC_BATCH_SOURCES,
      required: true,
      index: true,
    },
    assetType: {
      type: String,
      enum: MARKET_SYNC_BATCH_ASSET_TYPES,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: MARKET_SYNC_BATCH_STATUSES,
      required: true,
      default: "pending",
      index: true,
    },
    fetchedAt: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
    syncedAt: {
      type: Date,
      default: null,
    },
    items: {
      type: [marketSyncBatchItemSchema],
      default: [],
    },
    errorMessage: {
      type: String,
      default: "",
      trim: true,
      maxlength: 800,
    },
  },
  {
    collection: "market-sync-batches",
    timestamps: true,
  }
);

marketSyncBatchSchema.index({ userId: 1, status: 1, fetchedAt: -1 });
marketSyncBatchSchema.index({ userId: 1, source: 1, assetType: 1, fetchedAt: -1 });

export type MarketSyncBatchDocument = InferSchemaType<typeof marketSyncBatchSchema>;

export const MarketSyncBatch =
  (models.MarketSyncBatch as Model<MarketSyncBatchDocument> | undefined) ||
  model<MarketSyncBatchDocument>("MarketSyncBatch", marketSyncBatchSchema);
