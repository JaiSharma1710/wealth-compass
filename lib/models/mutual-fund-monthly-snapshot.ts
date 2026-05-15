import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

const mutualFundSnapshotHoldingSchema = new Schema(
  {
    schemeCode: {
      type: Number,
      required: true,
    },
    schemeName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 220,
    },
    units: {
      type: Number,
      required: true,
      min: 0,
    },
    investedAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    currentNav: {
      type: Number,
      required: true,
      min: 0,
    },
    currentValue: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    _id: false,
  }
);

const mutualFundMonthlySnapshotSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    monthKey: {
      type: String,
      required: true,
      trim: true,
    },
    year: {
      type: Number,
      required: true,
      min: 1900,
      max: 9999,
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    totalInvested: {
      type: Number,
      required: true,
      min: 0,
    },
    totalValue: {
      type: Number,
      required: true,
      min: 0,
    },
    distribution: {
      type: [mutualFundSnapshotHoldingSchema],
      default: [],
    },
  },
  {
    collection: "mutual-fund-monthly-snapshots",
    timestamps: true,
  }
);

mutualFundMonthlySnapshotSchema.index({ userId: 1, monthKey: 1 }, { unique: true });
mutualFundMonthlySnapshotSchema.index({ userId: 1, year: -1, month: -1 });

export type MutualFundMonthlySnapshotDocument = InferSchemaType<
  typeof mutualFundMonthlySnapshotSchema
>;

export const MutualFundMonthlySnapshot =
  (models.MutualFundMonthlySnapshot as
    | Model<MutualFundMonthlySnapshotDocument>
    | undefined) ||
  model<MutualFundMonthlySnapshotDocument>(
    "MutualFundMonthlySnapshot",
    mutualFundMonthlySnapshotSchema
  );
