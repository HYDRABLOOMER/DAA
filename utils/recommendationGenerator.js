/**
 * Friend Recommendation - Recommendation Generator
 *
 * Implements the BFS algorithm for traversing the social graph
 * and generating friend recommendations
 */

const { calculateJaccardSimilarity, calculateAdamicAdarIndex } = require("./recommendationAlgorithm")
const {
  calculateDeptScore,
  calculateSkillSimilarity,
  calculateInterestSimilarity,
  calculateCompositeSimilarity,
} = require("./findPotentialFriendsWithMetrics")

/**
 * Generate friend recommendations for a user
 *
 * Uses an efficient BFS traversal to find friends-of-friends (depth 2) and calculates
 * multiple similarity metrics to rank potential friend recommendations.
 *
 * The algorithm works as follows:
 * 1. Get direct friends of the user (depth 1)
 * 2. For each direct friend, get their friends (depth 2)
 * 3. Filter out users who are already friends or self
 * 4. Calculate similarity metrics for each candidate:
 *    - Jaccard similarity (based on mutual friends)
 *    - Adamic/Adar index (weighted mutual friends)
 *    - Department similarity
 *    - Skill similarity
 *    - Interest similarity
 * 5. Calculate a composite similarity score using weighted metrics
 * 6. Filter out candidates with very low similarity scores
 * 7. Sort candidates by similarity score and return the top K
 *
 * @param {Object} user - The current user object
 * @param {string|ObjectId} user._id - User ID
 * @param {Array} user.friends - Array of friend IDs or friend objects
 * @param {string} [user.university] - User's university (used for filtering)
 * @param {string} [user.department] - User's department (used for similarity)
 * @param {Array} [user.skills] - User's skills (used for similarity)
 * @param {Array} [user.interests] - User's interests (used for similarity)
 * @param {number} [limit=10] - Maximum number of recommendations to return
 * @param {Object} Friendship - Friendship model for database queries
 * @param {Function} Friendship.getFriends - Function to get friends of a user
 * @param {Function} Friendship.find - Function to find friendships
 * @param {Object} User - User model for database queries
 * @param {Function} User.findById - Function to find a user by ID
 *
 * @returns {Promise<Array>} - Array of recommended users with similarity scores
 * @returns {Object} recommendation.user - The recommended user object
 * @returns {Object} recommendation.similarityScore - Object containing all similarity metrics
 * @returns {number} recommendation.similarityScore.jaccard - Jaccard similarity score
 * @returns {number} recommendation.similarityScore.adamicAdar - Adamic/Adar index
 * @returns {number} recommendation.similarityScore.deptScore - Department similarity score
 * @returns {number} recommendation.similarityScore.skillSimilarity - Skill similarity score
 * @returns {number} recommendation.similarityScore.interestSimilarity - Interest similarity score
 * @returns {number} recommendation.similarityScore.composite - Composite similarity score
 * @returns {Array} recommendation.mutualFriends - Array of mutual friend IDs
 */
const generateFriendRecommendations = async (user, limit = 10, Friendship, User) => {
  try {
    // Simplified approach to find friends-of-friends
    const selfId = user._id.toString()

    // Get direct friends and create a Set of their IDs for quick lookup
    const directFriends = await Friendship.getFriends(user._id)
    const directFriendIds = new Set(directFriends.map((f) => f._id.toString()))

    // Get all existing relationships to exclude (pending, blocked, etc.)
    const existingRelationships = await Friendship.find({
      $or: [{ requester: user._id }, { recipient: user._id }],
    })

    // Create comprehensive exclusion set
    const excludedUserIds = new Set([selfId])

    // Add direct friends to exclusion
    directFriendIds.forEach((id) => excludedUserIds.add(id))

    // Add all users with existing relationships (pending, blocked, etc.)
    existingRelationships.forEach((relationship) => {
      const otherUserId =
        relationship.requester.toString() === selfId
          ? relationship.recipient.toString()
          : relationship.requester.toString()
      excludedUserIds.add(otherUserId)
    })

    // Find friends-of-friends (potential recommendations)
    const potentialRecommendations = []

    // For each direct friend, get their friends (depth 2)
    for (const directFriend of directFriends) {
      const friendsOfFriend = await Friendship.getFriends(directFriend._id)

      // Check each friend-of-friend as a potential recommendation
      for (const candidate of friendsOfFriend) {
        const candidateId = candidate._id.toString()

        // Skip if already excluded (self, direct friend, or has existing relationship)
        if (excludedUserIds.has(candidateId)) continue
        excludedUserIds.add(candidateId) // Add to prevent duplicates

        // Get full candidate details
        const candidateDetails = await User.findById(candidateId).lean()
        if (!candidateDetails) continue

        // Only filter by university if both have university defined
        if (user.university && candidateDetails.university && user.university !== candidateDetails.university) continue

        // Calculate similarity scores
        const deptScore = calculateDeptScore(user.department || "", candidateDetails.department || "")

        const skillSimilarity = calculateSkillSimilarity(user.skills || [], candidateDetails.skills || [])

        const interestSimilarity = calculateInterestSimilarity(user.interests || [], candidateDetails.interests || [])

        // Default values for graph-based metrics
        let jaccardScore = 0
        let adamicAdarScore = 0

        try {
          // Calculate graph-based similarity metrics
          jaccardScore = (await calculateJaccardSimilarity(user._id, candidateId, Friendship)) || 0
          adamicAdarScore = (await calculateAdamicAdarIndex(user._id, candidateId, Friendship)) || 0
        } catch (error) {
          console.error(`Error calculating similarity for ${candidateId}:`, error)
          // Continue with default values
        }

        // Ensure all metrics are valid numbers
        const metrics = {
          jaccard: jaccardScore || 0,
          adamicAdar: adamicAdarScore || 0,
          deptScore: deptScore || 0,
          skillSimilarity: skillSimilarity || 0,
          interestSimilarity: interestSimilarity || 0,
        }

        // Calculate composite score
        const composite = calculateCompositeSimilarity(metrics)

        // Apply minimum similarity threshold filter
        // Skip candidates with very low similarity scores
        const MIN_COMPOSITE_THRESHOLD = 0.1 // Minimum 10% similarity
        const MIN_INDIVIDUAL_THRESHOLD = 0.05 // At least one metric should be > 5%

        const hasMinimumSimilarity =
          composite >= MIN_COMPOSITE_THRESHOLD ||
          jaccardScore >= MIN_INDIVIDUAL_THRESHOLD ||
          adamicAdarScore >= MIN_INDIVIDUAL_THRESHOLD ||
          deptScore >= MIN_INDIVIDUAL_THRESHOLD ||
          skillSimilarity >= MIN_INDIVIDUAL_THRESHOLD ||
          interestSimilarity >= MIN_INDIVIDUAL_THRESHOLD

        // Skip if similarity is too low (all scores near zero)
        if (!hasMinimumSimilarity) {
          console.log(`Skipping ${candidateDetails.name} - similarity too low (composite: ${composite})`)
          continue
        }

        // Find mutual friends - reuse directFriendIds that was already created
        const candidateFriendIds = (candidateDetails.friends || []).map((f) =>
          f._id ? f._id.toString() : f.toString(),
        )
        const mutualFriends = candidateFriendIds.filter((id) => directFriendIds.has(id))

        // Add to potential recommendations
        potentialRecommendations.push({
          user: candidateDetails,
          score: composite,
          metrics: {
            jaccard: jaccardScore,
            adamicAdar: adamicAdarScore,
            deptScore,
            skillSimilarity,
            interestSimilarity,
            composite,
          },
          mutualFriends,
        })
      }
    }

    // Sort recommendations by score (descending) and get top K
    const finalRecommendations = potentialRecommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((rec) => ({
        user: rec.user,
        similarityScore: {
          jaccard: rec.metrics.jaccard,
          adamicAdar: rec.metrics.adamicAdar,
          deptScore: rec.metrics.deptScore,
          skillSimilarity: rec.metrics.skillSimilarity,
          interestSimilarity: rec.metrics.interestSimilarity,
          composite: rec.metrics.composite,
        },
        mutualFriends: rec.mutualFriends,
      }))

    console.log(`Generated ${finalRecommendations.length} recommendations after filtering`)
    return finalRecommendations
  } catch (error) {
    console.error("Error generating friend recommendations:", error)
    return []
  }
}

module.exports = {
  generateFriendRecommendations,
}
