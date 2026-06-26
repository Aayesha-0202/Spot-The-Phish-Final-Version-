import { Schema, model } from 'mongoose';
import { IUser } from '../types';

const userProfileSchema = new Schema(
  {
    avatarUrl: { type: String, trim: true },
    designation: { type: String, trim: true },
  },
  { _id: false }
);

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    username: { type: String, required: true, trim: true, maxlength: 40 },
    passwordHash: { type: String }, // null/absent for Google-only accounts
    googleId: { type: String, index: true, sparse: true }, // unique per Google account
    emailVerified: { type: Boolean, default: false },
    profile: { type: userProfileSchema, default: () => ({}) },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

export const User = model<IUser>('User', userSchema);
