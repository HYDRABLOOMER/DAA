const mongoose = require("mongoose")

/**
 * Feedback Schema - Manages project collaboration feedback
 */
const feedbackSchema = new mongoose.Schema(
  {
    fromUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    toUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    feedbackType: {
      type: String,
      enum: ["Technical", "Communication", "Teamwork", "Responsibility", "Overall"],
      required: true,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    comment: {
      type: String,
      maxlength: 1000,
      trim: true,
    },
    weight: {
      type: Number,
      min: 0.1,
      max: 2.0,
      default: 1.0,
    },
    isAnonymous: {
      type: Boolean,
      default: false,
    },
    verified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
)

// Compound indexes
feedbackSchema.index({ toUserId: 1, feedbackType: 1 })
feedbackSchema.index({ projectId: 1, createdAt: -1 })
feedbackSchema.index({ fromUserId: 1, toUserId: 1, projectId: 1 }, { unique: true })

// Static methods
feedbackSchema.statics.findByUser = async function (userId) {
  return await this.find({ toUserId: userId })
    .populate("fromUserId", "name")
    .populate("projectId", "title")
    .sort({ createdAt: -1 })
}

feedbackSchema.statics.findByProject = async function (projectId) {
  return await this.find({ projectId })
    .populate("fromUserId", "name")
    .populate("toUserId", "name")
    .sort({ createdAt: -1 })
}

feedbackSchema.statics.getAverageRating = async function (userId, feedbackType = null) {
  const match = { toUserId: userId }
  if (feedbackType) match.feedbackType = feedbackType

  const result = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        avgRating: { $avg: "$rating" },
        count: { $sum: 1 },
      },
    },
  ])

  return result.length > 0 ? result[0] : { avgRating: 0, count: 0 }
}

// Instance methods
feedbackSchema.methods.calculateWeightedScore = function () {
  return this.rating * this.weight
}

feedbackSchema.methods.isRecent = function (days = 30) {
  const threshold = new Date()
  threshold.setDate(threshold.getDate() - days)
  return this.createdAt >= threshold
}

module.exports = mongoose.model("Feedback", feedbackSchema)
