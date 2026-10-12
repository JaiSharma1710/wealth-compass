import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

import { GOLD_INVESTMENT_OPTIONS } from "@/lib/gold.types";

// Links a gold holding to an exchange-traded ticker so its value can be refreshed
// automatically (units x market price) instead of entering daily valuations by hand.
const goldPriceTrackerSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    holdingId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 260,
    },
    investmentOption: {
      type: String,
      enum: GOLD_INVESTMENT_OPTIONS.map((option) => option.value),
      required: true,
    },
    schemeName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 220,
    },
    symbol: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 60,
    },
    units: {
      type: Number,
      required: true,
      min: 0.0001,
    },
    lastPrice: {
      type: Number,
      default: null,
    },
    lastSyncedAt: {
      type: Date,
      default: null,
    },
    lastError: {
      type: String,
      default: "",
      maxlength: 300,
    },
  },
  {
    collection: "gold-price-trackers",
    timestamps: true,
  }
);

goldPriceTrackerSchema.index({ userId: 1, holdingId: 1 }, { unique: true });

export type GoldPriceTrackerDocument = InferSchemaType<typeof goldPriceTrackerSchema>;

export const GoldPriceTracker =
  (models.GoldPriceTracker as Model<GoldPriceTrackerDocument> | undefined) ||
  model<GoldPriceTrackerDocument>("GoldPriceTracker", goldPriceTrackerSchema);
