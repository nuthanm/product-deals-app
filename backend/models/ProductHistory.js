import { Schema, model } from "mongoose";

const ProductHistorySchema = new Schema({
  products: [
    {
      type: Schema.Types.ObjectId,
      ref: "Product",
    },
  ],
  searchDate: {
    type: Date,
    default: Date.now,
  },
});

export default model("ProductHistory", ProductHistorySchema);
