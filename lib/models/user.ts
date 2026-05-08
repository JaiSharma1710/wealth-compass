import { deleteModel, model, models, Schema, type InferSchemaType, type Model } from "mongoose";

const profileSchema = new Schema(
  {
    username: {
      type: String,
      default: "",
      trim: true,
      maxlength: 50,
    },
    currency: {
      type: String,
      default: "USD",
      trim: true,
      uppercase: true,
    },
    timezone: {
      type: String,
      default: "UTC",
      trim: true,
    },
    dateOfBirth: {
      type: String,
      default: "",
      trim: true,
    },
    presentAddress: {
      type: String,
      default: "",
      trim: true,
      maxlength: 160,
    },
    permanentAddress: {
      type: String,
      default: "",
      trim: true,
      maxlength: 160,
    },
    city: {
      type: String,
      default: "",
      trim: true,
      maxlength: 80,
    },
    postalCode: {
      type: String,
      default: "",
      trim: true,
      maxlength: 20,
    },
    country: {
      type: String,
      default: "",
      trim: true,
      maxlength: 80,
    },
  },
  {
    _id: false,
  }
);

const userSchema = new Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    status: {
      type: String,
      enum: ["active", "disabled"],
      default: "active",
    },
    profile: {
      type: profileSchema,
      default: () => ({}),
    },
    onboardingComplete: {
      type: Boolean,
      default: false,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    collection: "users",
    timestamps: true,
  }
);

export type UserDocument = InferSchemaType<typeof userSchema>;

function hasCurrentProfileSchema(existingModel: Model<UserDocument>) {
  return [
    "profile.username",
    "profile.currency",
    "profile.timezone",
    "profile.dateOfBirth",
    "profile.presentAddress",
    "profile.permanentAddress",
    "profile.city",
    "profile.postalCode",
    "profile.country",
  ].every((path) => existingModel.schema.path(path));
}

const existingUserModel = models.User as Model<UserDocument> | undefined;

if (existingUserModel && !hasCurrentProfileSchema(existingUserModel)) {
  deleteModel("User");
}

export const User =
  (models.User as Model<UserDocument> | undefined) || model<UserDocument>("User", userSchema);
