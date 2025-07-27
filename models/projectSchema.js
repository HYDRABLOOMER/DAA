const mongoose = require("mongoose")

const projectSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Project title is required"],
      trim: true,
      maxlength: [100, "Title cannot exceed 100 characters"],
    },
    description: {
      type: String,
      required: [true, "Project description is required"],
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    requiredSkills: [
      {
        type: String,
        trim: true,
      },
    ],
    preferredInterests: [
      {
        type: String,
        trim: true,
      },
    ],
    maxMembers: {
      type: Number,
      default: 4,
      min: [2, "Project must have at least 2 members"],
      max: [10, "Project cannot have more than 10 members"],
    },
    currentMembers: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
        role: {
          type: String,
          enum: ["creator", "member"],
          default: "member",
        },
      },
    ],
    status: {
      type: String,
      enum: ["recruiting", "in-progress", "completed", "cancelled"],
      default: "recruiting",
    },
    deadline: {
      type: Date,
      validate: {
        validator: (v) => !v || v > new Date(),
        message: "Deadline must be in the future",
      },
    },
    category: {
      type: String,
      enum: ["web-development", "mobile-app", "data-science", "ai-ml", "research", "design", "other"],
      default: "other",
    },
    university: {
      type: String,
      required: [true, "University is required"],
    },
    applications: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ProjectApplication",
      },
    ],
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
  },
  {
    timestamps: true,
  },
)

// Indexes
projectSchema.index({ university: 1, status: 1 })
projectSchema.index({ creator: 1 })
projectSchema.index({ "currentMembers.user": 1 })
projectSchema.index({ category: 1 })
projectSchema.index({ requiredSkills: 1 })

// Virtual for available spots
projectSchema.virtual("availableSpots").get(function () {
  return this.maxMembers - this.currentMembers.length
})

// Virtual for is full
projectSchema.virtual("isFull").get(function () {
  return this.currentMembers.length >= this.maxMembers
})

module.exports = mongoose.model("Project", projectSchema)
