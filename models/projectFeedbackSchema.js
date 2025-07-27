const mongoose = require("mongoose")

const projectFeedbackSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reviewee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    ratings: {
      technical: {
        type: Number,
        min: [1, "Rating must be at least 1"],
        max: [5, "Rating cannot exceed 5"],
        required: true,
      },
      communication: {
        type: Number,
        min: [1, "Rating must be at least 1"],
        max: [5, "Rating cannot exceed 5"],
        required: true,
      },
      teamwork: {
        type: Number,
        min: [1, "Rating must be at least 1"],
        max: [5, "Rating cannot exceed 5"],
        required: true,
      },
      reliability: {
        type: Number,
        min: [1, "Rating must be at least 1"],
        max: [5, "Rating cannot exceed 5"],
        required: true,
      },
    },
    comment: {
      type: String,
      trim: true,
      maxlength: [1000, "Comment cannot exceed 1000 characters"],
      default: "",
    },
    isAnonymous: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
)

// Prevent duplicate feedback
projectFeedbackSchema.index({ project: 1, reviewer: 1, reviewee: 1 }, { unique: true })

// Indexes for queries
projectFeedbackSchema.index({ reviewee: 1 })
projectFeedbackSchema.index({ project: 1 })

// Virtual for average rating
projectFeedbackSchema.virtual("averageRating").get(function () {
  const { technical, communication, teamwork, reliability } = this.ratings
  return (technical + communication + teamwork + reliability) / 4
})

module.exports = mongoose.model("ProjectFeedback", projectFeedbackSchema)
