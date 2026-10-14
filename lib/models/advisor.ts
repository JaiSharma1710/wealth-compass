import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

import { RISK_PROFILES } from "@/lib/advisor.types";

const advisorProfileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    monthlyIncome: { type: Number, default: null, min: 0 },
    riskProfile: { type: String, enum: RISK_PROFILES, default: "moderate" },
  },
  { collection: "advisor-profiles", timestamps: true }
);

// One cached AI analysis per user per day keeps usage inside the free Gemini quota.
const advisorReportSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    date: { type: String, required: true },
    advice: { type: Schema.Types.Mixed, required: true },
    model: { type: String, default: "" },
    generatedAt: { type: Date, required: true },
  },
  { collection: "advisor-reports", timestamps: true }
);

advisorReportSchema.index({ userId: 1, date: -1 });

export type AdvisorProfileDocument = InferSchemaType<typeof advisorProfileSchema>;
export type AdvisorReportDocument = InferSchemaType<typeof advisorReportSchema>;

export const AdvisorProfileModel =
  (models.AdvisorProfile as Model<AdvisorProfileDocument> | undefined) ||
  model<AdvisorProfileDocument>("AdvisorProfile", advisorProfileSchema);

export const AdvisorReportModel =
  (models.AdvisorReport as Model<AdvisorReportDocument> | undefined) ||
  model<AdvisorReportDocument>("AdvisorReport", advisorReportSchema);
