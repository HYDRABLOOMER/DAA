const Interest = require("../models/interestSchema")

/**
 * InterestSimilarityCalculator - Calculates interest compatibility between users
 */
class InterestSimilarityCalculator {
  constructor() {
    this.categoryWeights = {
      Technical: 0.3,
      Design: 0.25,
      Business: 0.2,
      "Soft Skills": 0.15,
      Hobbies: 0.1,
    }
  }

  /**
   * Calculate interest similarity score between two users
   * @param {Object} user1 - First user
   * @param {Object} user2 - Second user
   * @returns {Promise<number>} - Interest similarity score (0-1)
   */
  async calculateInterestSimilarity(user1, user2) {
    try {
      // Get interests for both users
      const user1Interests = await Interest.findByUser(user1._id)
      const user2Interests = await Interest.findByUser(user2._id)

      // Calculate overall similarity
      const similarity = this.calculateOverallSimilarity(user1Interests, user2Interests)

      // Calculate category-based similarity
      const categorySimilarity = await this.calculateCategorySimilarity(user1Interests, user2Interests)

      // Calculate intensity-based similarity
      const intensitySimilarity = this.calculateIntensitySimilarity(user1Interests, user2Interests)

      // Weighted average of all factors
      return similarity * 0.5 + categorySimilarity * 0.3 + intensitySimilarity * 0.2
    } catch (error) {
      console.error("Error calculating interest similarity:", error)
      return 0
    }
  }

  /**
   * Calculate overall interest similarity using cosine similarity
   * @param {Array} interests1 - First user's interests
   * @param {Array} interests2 - Second user's interests
   * @returns {number} - Similarity score (0-1)
   */
  calculateOverallSimilarity(interests1, interests2) {
    const commonInterests = this.findCommonInterests(interests1, interests2)

    if (!commonInterests.length) return 0

    // Calculate average cosine similarity of common interests
    const totalSimilarity = commonInterests.reduce((sum, pair) => {
      return sum + pair.interest1.calculateSimilarity(pair.interest2)
    }, 0)

    return totalSimilarity / commonInterests.length
  }

  /**
   * Calculate similarity based on interest categories
   * @param {Array} interests1 - First user's interests
   * @param {Array} interests2 - Second user's interests
   * @returns {Promise<number>} - Category similarity score (0-1)
   */
  async calculateCategorySimilarity(interests1, interests2) {
    const categoryMap = new Map()

    // Count interests per category for both users
    interests1.forEach((interest) => {
      if (!categoryMap.has(interest.category)) {
        categoryMap.set(interest.category, { count1: 0, count2: 0 })
      }
      categoryMap.get(interest.category).count1++
    })

    interests2.forEach((interest) => {
      if (!categoryMap.has(interest.category)) {
        categoryMap.set(interest.category, { count1: 0, count2: 0 })
      }
      categoryMap.get(interest.category).count2++
    })

    // Calculate weighted similarity
    let totalScore = 0
    let totalWeight = 0

    for (const [category, counts] of categoryMap.entries()) {
      const weight = this.categoryWeights[category] || 0.1
      const similarity = 1 - Math.abs(counts.count1 - counts.count2) / Math.max(counts.count1, counts.count2, 1)

      totalScore += similarity * weight
      totalWeight += weight
    }

    return totalScore / totalWeight
  }

  /**
   * Calculate similarity based on interest intensity
   * @param {Array} interests1 - First user's interests
   * @param {Array} interests2 - Second user's interests
   * @returns {number} - Intensity similarity score (0-1)
   */
  calculateIntensitySimilarity(interests1, interests2) {
    const commonInterests = this.findCommonInterests(interests1, interests2)

    if (!commonInterests.length) return 0

    const totalIntensityDiff = commonInterests.reduce((sum, pair) => {
      return sum + Math.abs(pair.interest1.intensity - pair.interest2.intensity)
    }, 0)

    // Normalize to 0-1
    return 1 - totalIntensityDiff / (commonInterests.length * 4) // Max intensity diff is 4
  }

  /**
   * Find common interests between two users
   * @param {Array} interests1 - First user's interests
   * @param {Array} interests2 - Second user's interests
   * @returns {Array} - Array of common interest pairs
   */
  findCommonInterests(interests1, interests2) {
    const interestMap = new Map()

    // Add all interests from first user
    interests1.forEach((interest) => {
      interestMap.set(interest.name, {
        interest1: interest,
        interest2: null,
      })
    })

    // Add matching interests from second user
    interests2.forEach((interest) => {
      if (interestMap.has(interest.name)) {
        interestMap.get(interest.name).interest2 = interest
      } else {
        interestMap.set(interest.name, {
          interest1: null,
          interest2: interest,
        })
      }
    })

    return Array.from(interestMap.values()).filter((pair) => pair.interest1 && pair.interest2)
  }
}

module.exports = InterestSimilarityCalculator
