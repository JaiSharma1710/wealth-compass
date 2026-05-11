import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

const countrySchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 3,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
  },
  {
    collection: "countries",
    versionKey: false,
  }
);

countrySchema.index({ code: 1 }, { unique: true });
countrySchema.index({ name: 1 });

export type CountryDocument = InferSchemaType<typeof countrySchema>;

export const Country =
  (models.Country as Model<CountryDocument> | undefined) ||
  model<CountryDocument>("Country", countrySchema);
