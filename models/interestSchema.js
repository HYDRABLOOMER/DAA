const mongoose = require("mongoose")

/**
 * Interest Schema - Manages user interests and preferences
 */
const interestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    category: {
      type: String,
      enum: ["Technical", "Design", "Business", "Soft Skills", "Hobbies", "Academic", "Other"],
      default: "Other",
    },
    intensity: {
      type: Number,
      min: 1,
      max: 5,
      default: 3,
    },
    description: {
      type: String,
      maxlength: 500,
      trim: true,
    },
    tags: [
      {
        type: String,
        trim: true,
        maxlength: 50,
      },
    ],
  },
  {
    timestamps: true,
  },
)

// Compound indexes
interestSchema.index({ user: 1, name: 1 }, { unique: true })
interestSchema.index({ name: 1, intensity: -1 })
interestSchema.index({ category: 1 })

// Static methods
interestSchema.statics.findByUser = async function (userId) {
  return await this.find({ user: userId }).sort({ intensity: -1, name: 1 })
}

interestSchema.statics.findByInterestName = async function (interestName) {
  return await this.find({ name: new RegExp(interestName, "i") }).populate("user", "name email")
}

interestSchema.statics.getTopInterests = async function (limit = 10) {
  return await this.aggregate([
    { $group: { _id: "$name", count: { $sum: 1 }, avgIntensity: { $avg: "$intensity" } } },
    { $sort: { count: -1, avgIntensity: -1 } },
    { $limit: limit },
  ])
}

// Instance methods
interestSchema.methods.calculateSimilarity = function (otherInterest) {
  if (this.name !== otherInterest.name) return 0

  // Calculate similarity based on intensity difference
  const intensityDiff = Math.abs(this.intensity - otherInterest.intensity)
  const intensitySimilarity = 1 - intensityDiff / 4 // Max diff is 4

  // Calculate tag similarity
  const commonTags = this.tags.filter((tag) => otherInterest.tags.includes(tag))
  const allTags = [...new Set([...this.tags, ...otherInterest.tags])]
  const tagSimilarity = allTags.length > 0 ? commonTags.length / allTags.length : 1

  // Weighted average
  return intensitySimilarity * 0.7 + tagSimilarity * 0.3
}

module.exports = mongoose.model("Interest", interestSchema)
