import { Schema, model } from "mongoose";

const ProductSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  category: {
    type: String,
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Create text index for search
ProductSchema.index({ name: "text" });

export default model("Product", ProductSchema);
