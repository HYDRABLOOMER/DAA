const Feedback = require("../models/feedbackSchema")
const FeedbackAggregator = require("../utils/feedbackAggregator")

/**
 * Feedback Service - Manages project collaboration feedback
 */
class FeedbackService {
  constructor() {
    this.feedbackAggregator = new FeedbackAggregator()
  }

  /**
   * Create new feedback
   */
  async createFeedback(fromUserId, toUserId, projectId, feedbackData) {
    try {
      const feedback = new Feedback({
        fromUserId,
        toUserId,
        projectId,
        ...feedbackData,
      })

      await feedback.save()
      await feedback.populate("fromUserId", "name")
      await feedback.populate("toUserId", "name")
      await feedback.populate("projectId", "title")

      return {
        success: true,
        feedback,
        message: "Feedback created successfully",
      }
    } catch (error) {
      console.error("Error creating feedback:", error)
      return {
        success: false,
        message: "Failed to create feedback",
        error: error.message,
      }
    }
  }

  /**
   * Get feedback for a user
   */
  async getUserFeedback(userId) {
    try {
      const feedback = await Feedback.findByUser(userId)
      const score = await this.feedbackAggregator.calculateUserScore(userId)

      return {
        success: true,
        feedback,
        score,
        count: feedback.length,
      }
    } catch (error) {
      console.error("Error getting user feedback:", error)
      return {
        success: false,
        message: "Failed to get user feedback",
        error: error.message,
      }
    }
  }

  /**
   * Get feedback for a project
   */
  async getProjectFeedback(projectId) {
    try {
      const feedback = await Feedback.findByProject(projectId)

      return {
        success: true,
        feedback,
        count: feedback.length,
      }
    } catch (error) {
      console.error("Error getting project feedback:", error)
      return {
        success: false,
        message: "Failed to get project feedback",
        error: error.message,
      }
    }
  }

  /**
   * Update feedback
   */
  async updateFeedback(feedbackId, userId, updateData) {
    try {
      const feedback = await Feedback.findById(feedbackId)
      if (!feedback) {
        return {
          success: false,
          message: "Feedback not found",
        }
      }

      // Check if user can update this feedback
      if (feedback.fromUserId.toString() !== userId.toString()) {
        return {
          success: false,
          message: "Not authorized to update this feedback",
        }
      }

      Object.assign(feedback, updateData)
      await feedback.save()

      return {
        success: true,
        feedback,
        message: "Feedback updated successfully",
      }
    } catch (error) {
      console.error("Error updating feedback:", error)
      return {
        success: false,
        message: "Failed to update feedback",
        error: error.message,
      }
    }
  }

  /**
   * Delete feedback
   */
  async deleteFeedback(feedbackId, userId) {
    try {
      const feedback = await Feedback.findById(feedbackId)
      if (!feedback) {
        return {
          success: false,
          message: "Feedback not found",
        }
      }

      // Check if user can delete this feedback
      if (feedback.fromUserId.toString() !== userId.toString()) {
        return {
          success: false,
          message: "Not authorized to delete this feedback",
        }
      }

      await feedback.deleteOne()

      return {
        success: true,
        message: "Feedback deleted successfully",
      }
    } catch (error) {
      console.error("Error deleting feedback:", error)
      return {
        success: false,
        message: "Failed to delete feedback",
        error: error.message,
      }
    }
  }

  /**
   * Get average rating for a user
   */
  async getUserAverageRating(userId, feedbackType = null) {
    try {
      const result = await Feedback.getAverageRating(userId, feedbackType)

      return {
        success: true,
        averageRating: result.avgRating,
        count: result.count,
      }
    } catch (error) {
      console.error("Error getting user average rating:", error)
      return {
        success: false,
        message: "Failed to get user average rating",
        error: error.message,
      }
    }
  }
}

module.exports = new FeedbackService()
