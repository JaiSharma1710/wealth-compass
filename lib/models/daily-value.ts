import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

export const DAILY_VALUE_SCOPES = ["holding", "asset", "portfolio"] as const;
export const DAILY_VALUE_ASSET_TYPES = [
  "stock",
  "mutual_fund",
  "gold",
  "cash",
  "portfolio",
] as const;
export const DAILY_VALUE_SOURCES = ["cron", "manual", "migration", "system"] as const;

const dailyValueSchema = new Schema(
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
    scope: {
      type: String,
      enum: DAILY_VALUE_SCOPES,
      required: true,
      index: true,
    },
    assetType: {
      type: String,
      enum: DAILY_VALUE_ASSET_TYPES,
      required: true,
      index: true,
    },
    assetKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 220,
      index: true,
    },
    assetLabel: {
      type: String,
      default: "",
      trim: true,
      maxlength: 260,
    },
    priceOrNav: {
      type: Number,
      default: null,
      min: 0,
    },
    quantityOrUnits: {
      type: Number,
      default: null,
      min: 0,
    },
    investedAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    currentValue: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    gainLoss: {
      type: Number,
      required: true,
      default: 0,
    },
    source: {
      type: String,
      enum: DAILY_VALUE_SOURCES,
      required: true,
      default: "system",
    },
    sourceFetchedAt: {
      type: Date,
      default: null,
    },
    syncedAt: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
  },
  {
    collection: "daily-values",
    timestamps: true,
  }
);

dailyValueSchema.index(
  { userId: 1, date: 1, scope: 1, assetType: 1, assetKey: 1 },
  { unique: true }
);
dailyValueSchema.index({ userId: 1, scope: 1, assetType: 1, assetKey: 1, date: -1 });
dailyValueSchema.index({ userId: 1, scope: 1, date: 1 });

export type DailyValueDocument = InferSchemaType<typeof dailyValueSchema>;

export const DailyValue =
  (models.DailyValue as Model<DailyValueDocument> | undefined) ||
  model<DailyValueDocument>("DailyValue", dailyValueSchema);
