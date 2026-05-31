import { deleteModel, model, models, Schema, type InferSchemaType, type Model } from "mongoose";

const expenseBudgetSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    cycleStartDate: {
      type: Date,
      required: true,
    },
    cycleEndDate: {
      type: Date,
      required: true,
    },
    startYear: {
      type: Number,
      required: true,
      min: 1900,
    },
    startMonth: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
  },
  {
    collection: "expense-budgets",
    timestamps: true,
  }
);

expenseBudgetSchema.index({ userId: 1, startYear: 1, startMonth: 1 }, { unique: true });
expenseBudgetSchema.index({ userId: 1, cycleStartDate: -1 });

export type ExpenseBudgetDocument = InferSchemaType<typeof expenseBudgetSchema>;

function hasCurrentExpenseBudgetSchema(existingModel: Model<ExpenseBudgetDocument>) {
  return ["cycleStartDate", "cycleEndDate", "startYear", "startMonth", "amount"].every((path) =>
    existingModel.schema.path(path)
  );
}

const existingExpenseBudgetModel =
  models.ExpenseBudget as Model<ExpenseBudgetDocument> | undefined;

if (existingExpenseBudgetModel && !hasCurrentExpenseBudgetSchema(existingExpenseBudgetModel)) {
  deleteModel("ExpenseBudget");
}

export const ExpenseBudget =
  (models.ExpenseBudget as Model<ExpenseBudgetDocument> | undefined) ||
  model<ExpenseBudgetDocument>("ExpenseBudget", expenseBudgetSchema);
