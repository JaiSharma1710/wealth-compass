import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

import { ACCOUNT_CATEGORIES, ACCOUNT_KINDS } from "@/lib/accounts.types";

// Manually valued assets (FD, PPF, property, ...) and liabilities (loans, cards)
// that complete the net-worth picture beyond market-linked holdings.
const accountSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    kind: {
      type: String,
      enum: ACCOUNT_KINDS,
      required: true,
    },
    category: {
      type: String,
      enum: ACCOUNT_CATEGORIES.map((category) => category.value),
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    institution: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    currentValue: {
      type: Number,
      required: true,
      min: 0,
    },
    baseAmount: {
      type: Number,
      default: null,
      min: 0,
    },
    interestRate: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
    },
    monthlyPayment: {
      type: Number,
      default: null,
      min: 0,
    },
    maturityDate: {
      type: Date,
      default: null,
    },
    note: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },
    valueUpdatedAt: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
    history: {
      type: [
        {
          _id: false,
          date: { type: String, required: true },
          value: { type: Number, required: true },
        },
      ],
      default: [],
    },
  },
  {
    collection: "net-worth-accounts",
    timestamps: true,
  }
);

accountSchema.index({ userId: 1, kind: 1, createdAt: -1 });

export type NetWorthAccountDocument = InferSchemaType<typeof accountSchema>;

export const NetWorthAccount =
  (models.NetWorthAccount as Model<NetWorthAccountDocument> | undefined) ||
  model<NetWorthAccountDocument>("NetWorthAccount", accountSchema);
