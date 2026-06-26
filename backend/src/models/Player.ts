import { Schema, model } from 'mongoose';
import { IPlayer } from '../types';

const playerSchema = new Schema<IPlayer>(
  {
    playerId: { type: String, required: true, unique: true, index: true, trim: true },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 40 },
    // Auth linkage (null for guests). Sparse so multiple guests (user=null) are allowed.
    user: { type: Schema.Types.ObjectId, ref: 'User', index: true, sparse: true },
    email: { type: String, trim: true, lowercase: true, index: true, sparse: true },
  },
  { timestamps: true } // createdAt + updatedAt
);

export const Player = model<IPlayer>('Player', playerSchema);
