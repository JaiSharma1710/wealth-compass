import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

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

export const User =
  (models.User as Model<UserDocument>) || model<UserDocument>("User", userSchema);
