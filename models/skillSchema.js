const mongoose = require("mongoose")

/**
 * Skill Schema - Manages user skills and proficiency levels
 */
const skillSchema = new mongoose.Schema(
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
      enum: ["Technical", "Design", "Business", "Soft Skills", "Language", "Other"],
      default: "Other",
    },
    proficiency: {
      type: String,
      enum: ["Beginner", "Intermediate", "Advanced", "Expert"],
      required: true,
    },
    yearsOfExperience: {
      type: Number,
      min: 0,
      max: 50,
      default: 0,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    endorsements: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        message: {
          type: String,
          maxlength: 200,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  },
)

// Compound indexes
skillSchema.index({ user: 1, name: 1 }, { unique: true })
skillSchema.index({ name: 1, proficiency: 1 })
skillSchema.index({ category: 1 })

// Static methods
skillSchema.statics.findByUser = async function (userId) {
  return await this.find({ user: userId }).sort({ proficiency: -1, name: 1 })
}

skillSchema.statics.findBySkillName = async function (skillName) {
  return await this.find({ name: new RegExp(skillName, "i") }).populate("user", "name email")
}

skillSchema.statics.getTopSkills = async function (limit = 10) {
  return await this.aggregate([
    { $group: { _id: "$name", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit },
  ])
}

// Instance methods
skillSchema.methods.addEndorsement = function (userId, message) {
  this.endorsements.push({
    user: userId,
    message: message,
  })
  return this.save()
}

module.exports = mongoose.model("Skill", skillSchema)
