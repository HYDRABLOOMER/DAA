const mongoose = require("mongoose")

const projectApplicationSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    applicant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    message: {
      type: String,
      trim: true,
      maxlength: [500, "Application message cannot exceed 500 characters"],
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
    matchScore: {
      type: Number,
      min: 0,
      max: 1,
      default: 0,
    },
    skillsMatch: {
      type: Number,
      min: 0,
      max: 1,
      default: 0,
    },
    interestsMatch: {
      type: Number,
      min: 0,
      max: 1,
      default: 0,
    },
    feedbackScore: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.5,
    },
    reviewedAt: {
      type: Date,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  },
)

// Prevent duplicate applications
projectApplicationSchema.index({ project: 1, applicant: 1 }, { unique: true })

// Index for queries
projectApplicationSchema.index({ status: 1 })
projectApplicationSchema.index({ applicant: 1 })

module.exports = mongoose.model("ProjectApplication", projectApplicationSchema)
