import { deleteModel, model, models, Schema, type InferSchemaType, type Model } from "mongoose";

import { EXPENSE_ENTRY_TYPES } from "@/lib/expenses.types";

const expenseEntrySchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    entryType: {
      type: String,
      enum: EXPENSE_ENTRY_TYPES,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    note: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    occurredAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    collection: "expense-entries",
    timestamps: true,
  }
);

expenseEntrySchema.index({ userId: 1, occurredAt: -1, createdAt: -1 });

export type ExpenseEntryDocument = InferSchemaType<typeof expenseEntrySchema>;

function hasCurrentExpenseEntrySchema(existingModel: Model<ExpenseEntryDocument>) {
  return ["entryType", "note", "occurredAt"].every((path) => existingModel.schema.path(path));
}

const existingExpenseEntryModel =
  models.ExpenseEntry as Model<ExpenseEntryDocument> | undefined;

if (existingExpenseEntryModel && !hasCurrentExpenseEntrySchema(existingExpenseEntryModel)) {
  deleteModel("ExpenseEntry");
}

export const ExpenseEntry =
  (models.ExpenseEntry as Model<ExpenseEntryDocument> | undefined) ||
  model<ExpenseEntryDocument>("ExpenseEntry", expenseEntrySchema);
