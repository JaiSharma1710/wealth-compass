import { deleteModel, model, models, Schema, type InferSchemaType, type Model } from "mongoose";

import { GOAL_ASSET_TYPES } from "@/lib/goals.types";

const goalSchema = new Schema(
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
    note: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },
    targetAmount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    targetDate: {
      type: Date,
      default: null,
    },
    // Legacy single-link fields: kept readable for old documents, no longer written.
    assetType: {
      type: String,
      enum: GOAL_ASSET_TYPES,
      index: true,
    },
    investmentId: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    investmentLabel: {
      type: String,
      trim: true,
      maxlength: 220,
    },
    investmentDetail: {
      type: String,
      default: "",
      trim: true,
      maxlength: 220,
    },
    links: {
      type: [
        new Schema(
          {
            assetType: { type: String, enum: GOAL_ASSET_TYPES, required: true },
            investmentId: { type: String, required: true, trim: true, maxlength: 200 },
            label: { type: String, default: "", trim: true, maxlength: 220 },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  {
    collection: "goals",
    timestamps: true,
  }
);

goalSchema.index({ userId: 1, createdAt: -1 });

export type GoalDocument = InferSchemaType<typeof goalSchema>;

function hasCurrentGoalSchema(existingModel: Model<GoalDocument>) {
  return [
    "note",
    "targetDate",
    "assetType",
    "investmentId",
    "investmentLabel",
    "investmentDetail",
    "links",
  ].every((path) => existingModel.schema.path(path));
}

const existingGoalModel = models.Goal as Model<GoalDocument> | undefined;

if (existingGoalModel && !hasCurrentGoalSchema(existingGoalModel)) {
  deleteModel("Goal");
}

export const Goal =
  (models.Goal as Model<GoalDocument> | undefined) || model<GoalDocument>("Goal", goalSchema);
