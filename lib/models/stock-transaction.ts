import { deleteModel, model, models, Schema, type InferSchemaType, type Model } from "mongoose";

import { STOCK_TRANSACTION_TYPES } from "@/lib/stocks.types";

const stockTransactionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    holdingId: {
      type: Schema.Types.ObjectId,
      ref: "StockHolding",
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
    type: {
      type: String,
      enum: STOCK_TRANSACTION_TYPES,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    price: {
      type: Number,
      required: true,
      min: 0.0001,
    },
    brokerage: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    taxes: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    charges: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    note: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    buyGrossAmount: {
      type: Number,
      default: null,
      min: 0,
    },
    buyCharges: {
      type: Number,
      default: null,
      min: 0,
    },
    buyNetAmount: {
      type: Number,
      default: null,
      min: 0,
    },
    averagePriceAtSellTime: {
      type: Number,
      default: null,
      min: 0,
    },
    costBasis: {
      type: Number,
      default: null,
      min: 0,
    },
    sellGrossAmount: {
      type: Number,
      default: null,
      min: 0,
    },
    sellCharges: {
      type: Number,
      default: null,
      min: 0,
    },
    sellNetAmount: {
      type: Number,
      default: null,
    },
    realizedProfitForSell: {
      type: Number,
      default: null,
    },
    transactionDate: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    collection: "stock-transactions",
    timestamps: true,
  }
);

stockTransactionSchema.index({ userId: 1, transactionDate: -1, createdAt: -1 });
stockTransactionSchema.index({ userId: 1, symbol: 1, transactionDate: -1, createdAt: -1 });
stockTransactionSchema.index({ holdingId: 1, transactionDate: 1, createdAt: 1 });

export type StockTransactionDocument = InferSchemaType<typeof stockTransactionSchema>;

function hasCurrentStockTransactionSchema(existingModel: Model<StockTransactionDocument>) {
  return [
    "holdingId",
    "brokerage",
    "taxes",
    "charges",
    "buyGrossAmount",
    "buyCharges",
    "buyNetAmount",
    "averagePriceAtSellTime",
    "costBasis",
    "sellGrossAmount",
    "sellCharges",
    "sellNetAmount",
    "realizedProfitForSell",
  ].every((path) => existingModel.schema.path(path));
}

const existingStockTransactionModel =
  models.StockTransaction as Model<StockTransactionDocument> | undefined;

if (
  existingStockTransactionModel &&
  !hasCurrentStockTransactionSchema(existingStockTransactionModel)
) {
  deleteModel("StockTransaction");
}

export const StockTransaction =
  (models.StockTransaction as Model<StockTransactionDocument> | undefined) ||
  model<StockTransactionDocument>("StockTransaction", stockTransactionSchema);
