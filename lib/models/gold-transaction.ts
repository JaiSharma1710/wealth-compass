import { deleteModel, model, models, Schema, type InferSchemaType, type Model } from "mongoose";

import { GOLD_INVESTMENT_OPTIONS } from "@/lib/gold.types";

const goldTransactionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    investmentOption: {
      type: String,
      enum: GOLD_INVESTMENT_OPTIONS.map((option) => option.value),
      required: true,
      index: true,
    },
    schemeName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 220,
    },
    transactionType: {
      type: String,
      enum: ["buy", "sell", "valuation"],
      required: true,
    },
    investedAmount: {
      type: Number,
      default: null,
      min: 0.01,
    },
    currentValue: {
      type: Number,
      default: null,
      min: 0.01,
    },
    sellAmount: {
      type: Number,
      default: null,
      min: 0.01,
    },
    realizedCostBasisAmount: {
      type: Number,
      default: null,
      min: 0,
    },
    realizedProfitAmount: {
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
    collection: "gold-transactions",
    timestamps: true,
  }
);

goldTransactionSchema.index({
  userId: 1,
  transactionDate: -1,
  createdAt: -1,
});

export type GoldTransactionDocument = InferSchemaType<typeof goldTransactionSchema>;

function hasCurrentGoldTransactionSchema(existingModel: Model<GoldTransactionDocument>) {
  return [
    "investmentOption",
    "schemeName",
    "investedAmount",
    "currentValue",
    "sellAmount",
    "realizedCostBasisAmount",
    "realizedProfitAmount",
  ].every((path) => existingModel.schema.path(path));
}

const existingGoldTransactionModel =
  models.GoldTransaction as Model<GoldTransactionDocument> | undefined;

if (
  existingGoldTransactionModel &&
  !hasCurrentGoldTransactionSchema(existingGoldTransactionModel)
) {
  deleteModel("GoldTransaction");
}

export const GoldTransaction =
  (models.GoldTransaction as Model<GoldTransactionDocument> | undefined) ||
  model<GoldTransactionDocument>("GoldTransaction", goldTransactionSchema);
