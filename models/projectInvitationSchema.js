const mongoose = require("mongoose")

const projectInvitationSchema = new mongoose.Schema(
  {
    // Core invitation data
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Invitation details
    message: {
      type: String,
      maxlength: 500,
      trim: true,
      default: "",
    },

    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "expired", "cancelled"],
      default: "pending",
      required: true,
      index: true,
    },

    // Metadata
    matchScore: {
      type: Number,
      min: 0,
      max: 1,
      default: 0,
    },

    matchReasons: [
      {
        type: String,
        trim: true,
      },
    ],

    // Timestamps
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    respondedAt: {
      type: Date,
      default: null,
    },

    expiresAt: {
      type: Date,
      default: () => {
        // Default expiration: 7 days from creation
        return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      },
      index: true,
    },

    // Response details
    responseMessage: {
      type: String,
      maxlength: 300,
      trim: true,
      default: "",
    },

    // Tracking
    viewedAt: {
      type: Date,
      default: null,
    },

    remindersSent: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    collection: "projectinvitations",
  },
)

// Compound indexes for efficient queries
projectInvitationSchema.index({ recipient: 1, status: 1 })
projectInvitationSchema.index({ project: 1, status: 1 })
projectInvitationSchema.index({ sender: 1, createdAt: -1 })
projectInvitationSchema.index({ expiresAt: 1, status: 1 })

// Prevent duplicate invitations
projectInvitationSchema.index(
  {
    project: 1,
    sender: 1,
    recipient: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ["pending", "accepted"] },
    },
  },
)

// Virtual for checking if invitation is expired
projectInvitationSchema.virtual("isExpired").get(function () {
  return this.status === "pending" && this.expiresAt < new Date()
})

// Virtual for time remaining
projectInvitationSchema.virtual("timeRemaining").get(function () {
  if (this.status !== "pending") return null
  const now = new Date()
  const remaining = this.expiresAt - now
  return remaining > 0 ? remaining : 0
})

// Pre-save middleware to auto-expire invitations
projectInvitationSchema.pre("save", function (next) {
  if (this.status === "pending" && this.expiresAt < new Date()) {
    this.status = "expired"
  }
  next()
})

// Static method to find user's pending invitations
projectInvitationSchema.statics.findUserInvitations = function (userId, status = "pending") {
  return this.find({
    recipient: userId,
    status: status,
  })
    .populate("project", "title description category requiredSkills deadline")
    .populate("sender", "name email university department")
    .sort({ createdAt: -1 })
}

// Static method to find project invitations
projectInvitationSchema.statics.findProjectInvitations = function (projectId, status = null) {
  const query = { project: projectId }
  if (status) query.status = status

  return this.find(query)
    .populate("recipient", "name email skills interests university department")
    .populate("sender", "name email")
    .sort({ createdAt: -1 })
}

// Static method to check if invitation exists
projectInvitationSchema.statics.invitationExists = function (projectId, senderId, recipientId) {
  return this.findOne({
    project: projectId,
    sender: senderId,
    recipient: recipientId,
    status: { $in: ["pending", "accepted"] },
  })
}

// Instance method to accept invitation
projectInvitationSchema.methods.accept = function (responseMessage = "") {
  this.status = "accepted"
  this.respondedAt = new Date()
  this.responseMessage = responseMessage
  return this.save()
}

// Instance method to reject invitation
projectInvitationSchema.methods.reject = function (responseMessage = "") {
  this.status = "rejected"
  this.respondedAt = new Date()
  this.responseMessage = responseMessage
  return this.save()
}

// Instance method to cancel invitation (by sender)
projectInvitationSchema.methods.cancel = function () {
  this.status = "cancelled"
  this.respondedAt = new Date()
  return this.save()
}

// Instance method to mark as viewed
projectInvitationSchema.methods.markAsViewed = function () {
  if (!this.viewedAt) {
    this.viewedAt = new Date()
    return this.save()
  }
  return Promise.resolve(this)
}

const ProjectInvitation = mongoose.model("ProjectInvitation", projectInvitationSchema)

module.exports = ProjectInvitation
