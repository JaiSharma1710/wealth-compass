import { deleteModel, model, models, Schema, type InferSchemaType, type Model } from "mongoose";

const portfolioSnapshotSchema = new Schema(
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
    },
    totalCurrentWorth: {
      type: Number,
      required: true,
      min: 0,
    },
    totalInvested: {
      type: Number,
      required: true,
      min: 0,
    },
    totalGainLoss: {
      type: Number,
      required: true,
    },
    totalGainLossPercent: {
      type: Number,
      required: true,
    },
    stocksValue: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    mutualFundsValue: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    goldValue: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    cashValue: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    goalsSavedValue: {
      type: Number,
      default: null,
      min: 0,
    },
  },
  {
    collection: "portfolio-snapshots",
    timestamps: true,
  }
);

portfolioSnapshotSchema.index({ userId: 1, date: 1 }, { unique: true });
portfolioSnapshotSchema.index({ userId: 1, createdAt: -1 });

export type PortfolioSnapshotDocument = InferSchemaType<typeof portfolioSnapshotSchema>;

function hasCurrentPortfolioSnapshotSchema(existingModel: Model<PortfolioSnapshotDocument>) {
  return [
    "date",
    "totalCurrentWorth",
    "totalInvested",
    "totalGainLoss",
    "totalGainLossPercent",
    "stocksValue",
    "mutualFundsValue",
    "goldValue",
    "cashValue",
  ].every((path) => existingModel.schema.path(path));
}

const existingPortfolioSnapshotModel =
  models.PortfolioSnapshot as Model<PortfolioSnapshotDocument> | undefined;

if (
  existingPortfolioSnapshotModel &&
  !hasCurrentPortfolioSnapshotSchema(existingPortfolioSnapshotModel)
) {
  deleteModel("PortfolioSnapshot");
}

export const PortfolioSnapshot =
  (models.PortfolioSnapshot as Model<PortfolioSnapshotDocument> | undefined) ||
  model<PortfolioSnapshotDocument>("PortfolioSnapshot", portfolioSnapshotSchema);
