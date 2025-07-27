const Feedback = require("../models/feedbackSchema")

/**
 * FeedbackAggregator - Aggregates and calculates feedback scores
 */
class FeedbackAggregator {
  constructor() {
    this.feedbackWeights = {
      Technical: 0.3,
      Communication: 0.25,
      Teamwork: 0.2,
      Responsibility: 0.15,
      Overall: 0.1,
    }

    this.recencyFactor = 0.1 // Weight for recency
    this.verificationFactor = 0.2 // Weight for feedback giver's verification
  }

  /**
   * Calculate overall feedback score for a user
   * @param {Object} userId - User to calculate score for
   * @param {Object} project - Optional project context
   * @returns {Promise<Object>} - Feedback score object
   */
  async calculateUserScore(userId, project) {
    try {
      // Get all feedback for this user
      const feedbacks = await Feedback.findByUser(userId)

      if (!feedbacks.length)
        return {
          overall: 0,
          breakdown: {
            Technical: 0,
            Communication: 0,
            Teamwork: 0,
            Responsibility: 0,
            Overall: 0,
          },
        }

      // Group feedback by type
      const feedbackByType = this.groupFeedbackByType(feedbacks)

      // Calculate scores for each type
      const breakdown = {}
      let totalWeight = 0
      let weightedScore = 0

      for (const [type, feedbacks] of Object.entries(feedbackByType)) {
        const score = this.calculateTypeScore(feedbacks, project)
        breakdown[type] = score

        // Apply type weight
        const typeWeight = this.feedbackWeights[type] || 0.1
        weightedScore += score * typeWeight
        totalWeight += typeWeight
      }

      return {
        overall: weightedScore / totalWeight,
        breakdown,
      }
    } catch (error) {
      console.error("Error calculating user feedback score:", error)
      return { overall: 0, breakdown: {} }
    }
  }

  /**
   * Group feedbacks by type
   * @param {Array} feedbacks - Array of feedback objects
   * @returns {Object} - Feedback grouped by type
   */
  groupFeedbackByType(feedbacks) {
    const grouped = {}
    feedbacks.forEach((feedback) => {
      if (!grouped[feedback.feedbackType]) {
        grouped[feedback.feedbackType] = []
      }
      grouped[feedback.feedbackType].push(feedback)
    })
    return grouped
  }

  /**
   * Calculate score for a specific feedback type
   * @param {Array} feedbacks - Feedbacks of the same type
   * @param {Object} project - Optional project context
   * @returns {number} - Score for this feedback type (0-1)
   */
  calculateTypeScore(feedbacks, project) {
    if (!feedbacks.length) return 0

    let totalScore = 0
    let totalWeight = 0

    feedbacks.forEach((feedback) => {
      // Base score is the rating
      let score = feedback.rating / 5

      // Apply recency bonus
      if (feedback.isRecent()) {
        score *= 1 + this.recencyFactor
      }

      // Apply verification bonus
      if (feedback.fromUserId) {
        // Get feedback giver's verification status
        // This would typically be a database query
        const isVerified = true // TODO: Implement verification check
        if (isVerified) {
          score *= 1 + this.verificationFactor
        }
      }

      // Apply project-specific weight
      let weight = feedback.weight
      if (project && project._id.equals(feedback.projectId)) {
        weight *= 1.2 // Give more weight to project-specific feedback
      }

      totalScore += score * weight
      totalWeight += weight
    })

    return totalScore / totalWeight
  }

  /**
   * Get recent feedback trends for a user
   * @param {Object} userId - User to analyze
   * @param {number} days - Number of days to look back
   * @returns {Promise<Object>} - Feedback trend analysis
   */
  async getRecentFeedbackTrends(userId, days = 30) {
    try {
      const threshold = new Date()
      threshold.setDate(threshold.getDate() - days)

      const recentFeedbacks = await Feedback.find({
        toUserId: userId,
        createdAt: { $gte: threshold },
      }).sort({ createdAt: -1 })

      if (!recentFeedbacks.length) {
        return {
          trend: "stable",
          average: 0,
          recentScore: 0,
        }
      }

      const scores = recentFeedbacks.map((f) => f.calculateWeightedScore())
      const average = scores.reduce((sum, score) => sum + score, 0) / scores.length
      const recentScore = scores[0] // Most recent score

      const trend = recentScore > average ? "improving" : recentScore < average ? "declining" : "stable"

      return {
        trend,
        average,
        recentScore,
        feedbacks: recentFeedbacks.length,
      }
    } catch (error) {
      console.error("Error calculating feedback trends:", error)
      return {
        trend: "stable",
        average: 0,
        recentScore: 0,
      }
    }
  }
}

module.exports = FeedbackAggregator
