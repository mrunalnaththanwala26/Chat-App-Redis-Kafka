const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    memberIds: [{ type: mongoose.Schema.Types.ObjectId, required: true }],
    adminId: { type: mongoose.Schema.Types.ObjectId, required: true },
  },
  { timestamps: true }
);

groupSchema.index({ memberIds: 1 });

module.exports = mongoose.model('Group', groupSchema);
