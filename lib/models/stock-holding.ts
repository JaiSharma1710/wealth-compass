import { deleteModel, model, models, Schema, type InferSchemaType, type Model } from "mongoose";

import { STOCK_HOLDING_STATUSES } from "@/lib/stocks.types";

const stockHoldingSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    symbol: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 40,
      index: true,
    },
    exchange: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
    },
    companyName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 220,
    },
    shortName: {
      type: String,
      default: "",
      trim: true,
      maxlength: 220,
    },
    sector: {
      type: String,
      default: null,
      trim: true,
      maxlength: 120,
    },
    industry: {
      type: String,
      default: null,
      trim: true,
      maxlength: 120,
    },
    currency: {
      type: String,
      default: null,
      trim: true,
      uppercase: true,
      maxlength: 10,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    averagePrice: {
      type: Number,
      required: true,
      min: 0,
    },
    investedAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    currentPrice: {
      type: Number,
      default: null,
      min: 0,
    },
    currentValue: {
      type: Number,
      required: true,
      min: 0,
    },
    unrealizedProfit: {
      type: Number,
      required: true,
    },
    unrealizedProfitPercent: {
      type: Number,
      required: true,
    },
    realizedProfit: {
      type: Number,
      required: true,
      default: 0,
    },
    totalDividends: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: STOCK_HOLDING_STATUSES,
      required: true,
      index: true,
    },
    openedAt: {
      type: Date,
      required: true,
    },
    closedAt: {
      type: Date,
      default: null,
    },
    lastQuoteAt: {
      type: Date,
      default: null,
    },
  },
  {
    collection: "stock-holdings",
    timestamps: true,
  }
);

stockHoldingSchema.index(
  { userId: 1, symbol: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "ACTIVE" },
  }
);
stockHoldingSchema.index({ userId: 1, status: 1, updatedAt: -1 });
stockHoldingSchema.index({ userId: 1, symbol: 1, updatedAt: -1 });

export type StockHoldingDocument = InferSchemaType<typeof stockHoldingSchema>;

function hasCurrentStockHoldingSchema(existingModel: Model<StockHoldingDocument>) {
  return [
    "exchange",
    "companyName",
    "shortName",
    "sector",
    "industry",
    "currency",
    "realizedProfit",
    "openedAt",
    "closedAt",
    "lastQuoteAt",
  ].every((path) => existingModel.schema.path(path));
}

const existingStockHoldingModel =
  models.StockHolding as Model<StockHoldingDocument> | undefined;

if (existingStockHoldingModel && !hasCurrentStockHoldingSchema(existingStockHoldingModel)) {
  deleteModel("StockHolding");
}

export const StockHolding =
  (models.StockHolding as Model<StockHoldingDocument> | undefined) ||
  model<StockHoldingDocument>("StockHolding", stockHoldingSchema);
