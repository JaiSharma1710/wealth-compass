import { deleteModel, model, models, Schema, type InferSchemaType, type Model } from "mongoose";

const debtLoanSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    lender: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    loanType: {
      type: String,
      enum: ["standard", "no_cost_emi"],
      default: "standard",
      required: true,
    },
    principalAmount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    annualInterestRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    durationMonths: {
      type: Number,
      required: true,
      min: 1,
      max: 600,
    },
    startDate: {
      type: Date,
      required: true,
      index: true,
    },
    emiPaymentDay: {
      type: Number,
      required: true,
      min: 1,
      max: 31,
    },
    plannedPrepaymentAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    note: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
  },
  {
    collection: "debt-loans",
    timestamps: true,
  }
);

debtLoanSchema.index({ userId: 1, createdAt: -1 });

export type DebtLoanDocument = InferSchemaType<typeof debtLoanSchema>;

function hasCurrentDebtLoanSchema(existingModel: Model<DebtLoanDocument>) {
  return [
    "lender",
    "loanType",
    "annualInterestRate",
    "durationMonths",
    "startDate",
    "emiPaymentDay",
    "plannedPrepaymentAmount",
    "note",
  ].every((path) => existingModel.schema.path(path));
}

const existingDebtLoanModel = models.DebtLoan as Model<DebtLoanDocument> | undefined;

if (existingDebtLoanModel && !hasCurrentDebtLoanSchema(existingDebtLoanModel)) {
  deleteModel("DebtLoan");
}

export const DebtLoan =
  (models.DebtLoan as Model<DebtLoanDocument> | undefined) ||
  model<DebtLoanDocument>("DebtLoan", debtLoanSchema);
