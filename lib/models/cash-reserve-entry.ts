import { deleteModel, model, models, Schema, type InferSchemaType, type Model } from "mongoose";

const cashReserveEntrySchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    entryDate: {
      type: Date,
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    entryType: {
      type: String,
      enum: ["credit", "debit"],
      required: true,
    },
    bank: {
      type: String,
      required: true,
      trim: true,
      maxlength: 140,
    },
    note: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
  },
  {
    collection: "cash-reserve-entries",
    timestamps: true,
  }
);

cashReserveEntrySchema.index({ userId: 1, entryDate: -1, createdAt: -1 });

export type CashReserveEntryDocument = InferSchemaType<typeof cashReserveEntrySchema>;

function hasCurrentCashReserveEntrySchema(existingModel: Model<CashReserveEntryDocument>) {
  return ["bank", "note"].every((path) => existingModel.schema.path(path));
}

const existingCashReserveEntryModel =
  models.CashReserveEntry as Model<CashReserveEntryDocument> | undefined;

if (
  existingCashReserveEntryModel &&
  !hasCurrentCashReserveEntrySchema(existingCashReserveEntryModel)
) {
  deleteModel("CashReserveEntry");
}

export const CashReserveEntry =
  (models.CashReserveEntry as Model<CashReserveEntryDocument> | undefined) ||
  model<CashReserveEntryDocument>("CashReserveEntry", cashReserveEntrySchema);
