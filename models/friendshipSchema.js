const mongoose = require("mongoose")

/**
 * Friendship Schema - Manages friendship relationships and requests
 *
 * This schema handles:
 * - Friend requests (pending, accepted, rejected, blocked)
 * - Similarity scores between users
 * - Friendship metadata and timestamps
 */
const friendshipSchema = new mongoose.Schema(
  {
    requester: {
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
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "blocked"],
      default: "pending",
      index: true,
    },
    similarityScore: {
      jaccard: {
        type: Number,
        default: 0,
        min: 0,
        max: 1,
      },
      adamicAdar: {
        type: Number,
        default: 0,
        min: 0,
      },
      composite: {
        type: Number,
        default: 0,
        min: 0,
        max: 1,
      },
      deptScore: {
        type: Number,
        default: 0,
        min: 0,
        max: 1,
      },
      skillSimilarity: {
        type: Number,
        default: 0,
        min: 0,
        max: 1,
      },
      interestSimilarity: {
        type: Number,
        default: 0,
        min: 0,
        max: 1,
      },
    },
    requestMessage: {
      type: String,
      maxlength: 500,
      trim: true,
    },
    responseMessage: {
      type: String,
      maxlength: 500,
      trim: true,
    },
    respondedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

// Compound indexes for efficient queries
friendshipSchema.index({ requester: 1, recipient: 1 }, { unique: true })
friendshipSchema.index({ requester: 1, status: 1 })
friendshipSchema.index({ recipient: 1, status: 1 })
friendshipSchema.index({ status: 1, createdAt: -1 })

// Virtual for checking if friendship is mutual
friendshipSchema.virtual("isMutual").get(function () {
  return this.status === "accepted"
})

// Static methods
friendshipSchema.statics.getFriends = async function (userId) {
  const friendships = await this.find({
    $or: [{ requester: userId }, { recipient: userId }],
    status: "accepted",
  })
    .populate("requester", "name email profilePicture")
    .populate("recipient", "name email profilePicture")

  return friendships.map((friendship) => {
    return friendship.requester._id.toString() === userId.toString() ? friendship.recipient : friendship.requester
  })
}

friendshipSchema.statics.getPendingRequests = async function (userId) {
  return await this.find({
    recipient: userId,
    status: "pending",
  }).populate("requester", "name email profilePicture")
}

friendshipSchema.statics.getSentRequests = async function (userId) {
  return await this.find({
    requester: userId,
    status: "pending",
  }).populate("recipient", "name email profilePicture")
}

friendshipSchema.statics.areFriends = async function (userId1, userId2) {
  const friendship = await this.findOne({
    $or: [
      { requester: userId1, recipient: userId2 },
      { requester: userId2, recipient: userId1 },
    ],
    status: "accepted",
  })
  return !!friendship
}

friendshipSchema.statics.updateSimilarityScores = async function (userId1, userId2, scores) {
  return await this.updateOne(
    {
      $or: [
        { requester: userId1, recipient: userId2 },
        { requester: userId2, recipient: userId1 },
      ],
    },
    { $set: { similarityScore: scores } },
  )
}

// Instance methods
friendshipSchema.methods.calculateWeightedScore = function () {
  const weights = {
    jaccard: 0.3,
    adamicAdar: 0.25,
    composite: 0.2,
    deptScore: 0.1,
    skillSimilarity: 0.1,
    interestSimilarity: 0.05,
  }

  let score = 0
  if (this.similarityScore) {
    Object.keys(weights).forEach((key) => {
      if (this.similarityScore[key]) {
        score += this.similarityScore[key] * weights[key]
      }
    })
  }

  return score
}

module.exports = mongoose.model("Friendship", friendshipSchema)
