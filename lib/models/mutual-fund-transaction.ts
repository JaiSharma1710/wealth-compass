import { deleteModel, model, models, Schema, type InferSchemaType, type Model } from "mongoose";

const mutualFundTransactionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    schemeCode: {
      type: Number,
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
      enum: ["buy", "sell"],
      required: true,
    },
    units: {
      type: Number,
      required: true,
      min: 0.0001,
    },
    nav: {
      type: Number,
      required: true,
      min: 0.0001,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.0001,
    },
    averageBuyNav: {
      type: Number,
      default: null,
      min: 0,
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
    collection: "mutual-fund-transactions",
    timestamps: true,
  }
);

mutualFundTransactionSchema.index({
  userId: 1,
  transactionDate: -1,
  createdAt: -1,
});

export type MutualFundTransactionDocument = InferSchemaType<typeof mutualFundTransactionSchema>;

function hasCurrentTransactionSchema(
  existingModel: Model<MutualFundTransactionDocument>
) {
  return [
    "averageBuyNav",
    "realizedCostBasisAmount",
    "realizedProfitAmount",
  ].every((path) => existingModel.schema.path(path));
}

const existingTransactionModel =
  models.MutualFundTransaction as Model<MutualFundTransactionDocument> | undefined;

if (existingTransactionModel && !hasCurrentTransactionSchema(existingTransactionModel)) {
  deleteModel("MutualFundTransaction");
}

export const MutualFundTransaction =
  (models.MutualFundTransaction as Model<MutualFundTransactionDocument> | undefined) ||
  model<MutualFundTransactionDocument>(
    "MutualFundTransaction",
    mutualFundTransactionSchema
  );
