import { model, models, Schema, type Model } from "mongoose";

export type CurrencyEntry = {
  code?: string;
  name?: string;
  symbol?: string;
};

export type CurrencyCatalogDocument = Record<string, CurrencyEntry | unknown>;

const currencyCatalogSchema = new Schema(
  {},
  {
    collection: "currency",
    strict: false,
    versionKey: false,
  }
);

export const CurrencyCatalog =
  (models.CurrencyCatalog as Model<CurrencyCatalogDocument> | undefined) ||
  model<CurrencyCatalogDocument>("CurrencyCatalog", currencyCatalogSchema);
