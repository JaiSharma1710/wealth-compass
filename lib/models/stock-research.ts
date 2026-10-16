import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

// Shared (not per-user) Yahoo fundamentals snapshot, refreshed weekly.
const stockResearchSchema = new Schema(
  {
    symbol: { type: String, required: true, unique: true, uppercase: true, trim: true },
    fundamentals: { type: Schema.Types.Mixed, required: true },
    fetchedAt: { type: Date, required: true },
  },
  { collection: "stock-research", timestamps: true }
);

// Per-user AI research note (includes the user's position), cached per day and provider.
const stockAnalysisSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    symbol: { type: String, required: true, uppercase: true },
    provider: { type: String, default: "gemini" },
    date: { type: String, required: true },
    analysis: { type: Schema.Types.Mixed, required: true },
    model: { type: String, default: "" },
    generatedAt: { type: Date, required: true },
  },
  { collection: "stock-analyses", timestamps: true }
);

stockAnalysisSchema.index({ userId: 1, symbol: 1, provider: 1, date: -1 });

// Short-lived news cache keyed by symbol.
const newsCacheSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    items: { type: Schema.Types.Mixed, required: true },
    fetchedAt: { type: Date, required: true },
  },
  { collection: "news-cache" }
);

type StockResearchDocument = InferSchemaType<typeof stockResearchSchema>;
type StockAnalysisDocument = InferSchemaType<typeof stockAnalysisSchema>;
type NewsCacheDocument = InferSchemaType<typeof newsCacheSchema>;

export const StockResearchModel =
  (models.StockResearch as Model<StockResearchDocument> | undefined) ||
  model<StockResearchDocument>("StockResearch", stockResearchSchema);

export const StockAnalysisModel =
  (models.StockAnalysis as Model<StockAnalysisDocument> | undefined) ||
  model<StockAnalysisDocument>("StockAnalysis", stockAnalysisSchema);

export const NewsCacheModel =
  (models.NewsCache as Model<NewsCacheDocument> | undefined) ||
  model<NewsCacheDocument>("NewsCache", newsCacheSchema);
