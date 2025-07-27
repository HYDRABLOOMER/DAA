const SkillMatcher = require("./skillMatcher")
const InterestSimilarityCalculator = require("./interestSimilarityCalculator")
const FeedbackAggregator = require("./feedbackAggregator")

/**
 * MatchScoreCalculator - Calculates overall compatibility score between users for projects
 */
class MatchScoreCalculator {
  constructor() {
    this.weights = {
      skillMatch: 0.4,
      interestSimilarity: 0.3,
      peerFeedback: 0.2,
      availability: 0.1,
    }

    this.skillMatcher = new SkillMatcher()
    this.interestSimilarityCalculator = new InterestSimilarityCalculator()
    this.feedbackAggregator = new FeedbackAggregator()
  }

  /**
   * Calculate overall match score between two users for a project
   * @param {Object} user1 - First user
   * @param {Object} user2 - Second user
   * @param {Object} project - Project context
   * @returns {Promise<number>} - Match score (0-1)
   */
  async calculateMatchScore(user1, user2, project) {
    try {
      // Calculate skill compatibility
      const skillScore = await this.skillMatcher.calculateSkillMatch(user1, user2, project)

      // Calculate interest similarity
      const interestScore = await this.interestSimilarityCalculator.calculateInterestSimilarity(user1, user2)

      // Calculate feedback score
      const feedbackScore = await this.calculateFeedbackScore(user1, user2)

      // Calculate availability score
      const availabilityScore = this.calculateAvailabilityScore(user1, user2, project)

      // Calculate final score with weights
      return (
        skillScore * this.weights.skillMatch +
        interestScore * this.weights.interestSimilarity +
        feedbackScore * this.weights.peerFeedback +
        availabilityScore * this.weights.availability
      )
    } catch (error) {
      console.error("Error calculating match score:", error)
      return 0
    }
  }

  /**
   * Calculate feedback score between users
   * @param {Object} user1 - First user
   * @param {Object} user2 - Second user
   * @returns {Promise<number>} - Feedback score (0-1)
   */
  async calculateFeedbackScore(user1, user2) {
    try {
      // Get feedback scores for both users
      const user1Score = await this.feedbackAggregator.calculateUserScore(user1._id)
      const user2Score = await this.feedbackAggregator.calculateUserScore(user2._id)

      // Calculate average feedback score
      const avgScore = (user1Score.overall + user2Score.overall) / 2

      // Get recent feedback trends
      const user1Trend = await this.feedbackAggregator.getRecentFeedbackTrends(user1._id)
      const user2Trend = await this.feedbackAggregator.getRecentFeedbackTrends(user2._id)

      // Apply trend adjustment
      let trendAdjustment = 1
      if (user1Trend.trend === "improving" && user2Trend.trend === "improving") {
        trendAdjustment = 1.1
      } else if (user1Trend.trend === "declining" || user2Trend.trend === "declining") {
        trendAdjustment = 0.9
      }

      return avgScore * trendAdjustment
    } catch (error) {
      console.error("Error calculating feedback score:", error)
      return 0
    }
  }

  /**
   * Calculate availability score for users
   * @param {Object} user1 - First user
   * @param {Object} user2 - Second user
   * @param {Object} project - Project context
   * @returns {number} - Availability score (0-1)
   */
  calculateAvailabilityScore(user1, user2, project) {
    // This would typically involve checking users' schedules and availability
    // For now, we'll use a simple heuristic based on project duration
    const durationMap = {
      "1 week": 0.9,
      "2 weeks": 0.85,
      "1 month": 0.8,
      "2 months": 0.75,
      "3 months": 0.7,
      "6 months": 0.6,
      "1 year": 0.5,
    }

    const baseScore = durationMap[project.duration] || 0.5

    // Apply adjustment based on current project load
    const user1Projects = user1.projects || []
    const user2Projects = user2.projects || []

    const projectLoad = Math.min((user1Projects.length + user2Projects.length) / 5, 1)

    return baseScore * (1 - projectLoad)
  }

  /**
   * Get top matches for a project
   * @param {Object} project - Project to find matches for
   * @param {Array} potentialUsers - Array of potential users
   * @param {number} limit - Maximum number of matches to return
   * @returns {Promise<Array>} - Array of top matches with scores
   */
  async getTopMatches(project, potentialUsers, limit = 10) {
    try {
      const matches = []

      // Calculate scores for all potential matches
      for (const user of potentialUsers) {
        const score = await this.calculateMatchScore(user, project.creator, project)
        matches.push({ user, score })
      }

      // Sort matches by score
      matches.sort((a, b) => b.score - a.score)

      // Return top matches
      return matches.slice(0, limit)
    } catch (error) {
      console.error("Error getting top matches:", error)
      return []
    }
  }
}

module.exports = MatchScoreCalculator
