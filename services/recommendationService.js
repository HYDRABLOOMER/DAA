/**
 * Friend Recommendation - Recommendation Service
 *
 * Service for generating and managing friend recommendations
 * Orchestrates recommendation algorithms and caching
 */

const User = require("../models/userSchema")
const { generateFriendRecommendations } = require("../utils/recommendationGenerator")
// Note: Cache utilities would need to be implemented or removed if not available

const Friendship = require("../data/friendshipSchema")
const { setCache, getCache, deleteCache } = require("../utils/cacheUtils")

class RecommendationService {
  /**
   * Get friend recommendations for a user
   * @param {string} userId - User ID
   * @param {number} limit - Maximum number of recommendations to return
   * @param {boolean} useCache - Whether to use cached recommendations
   * @returns {Promise<Array>} Recommended users with similarity scores
   */
  async getFriendRecommendations(userId, limit = 10, useCache = true) {
    try {
      // Check cache first if enabled
      if (useCache) {
        const cacheKey = `friend_recommendations:${userId}`
        const cachedRecommendations = await getCache(cacheKey)

        if (cachedRecommendations) {
          return {
            success: true,
            data: cachedRecommendations,
            source: "cache",
          }
        }
      }

      // Measure start time for metrics
      const startTime = Date.now()

      // Fetch full user object (with department, skills, interests, friends)
      const user = await User.findById(userId).lean()
      if (!user) {
        return {
          success: false,
          message: "User not found",
        }
      }
      // Populate friends for the user
      const friends = await Friendship.getFriends(userId)
      user.friends = friends.map((f) => f._id)
      // Generate recommendations using the user object
      const recommendations = await generateFriendRecommendations(user, limit, Friendship, User)

      // Calculate query time for metrics
      const queryTime = Date.now() - startTime
      console.log(`Generate recommendations query time: ${queryTime}ms`)

      // Cache recommendations if enabled
      if (useCache) {
        const cacheKey = `friend_recommendations:${userId}`
        await setCache(cacheKey, recommendations, 3600) // 1 hour cache
      }

      return {
        success: true,
        count: recommendations.length,
        data: recommendations,
        source: "algorithm",
      }
    } catch (error) {
      console.error("Error getting friend recommendations:", error)
      return {
        success: false,
        message: "Failed to get friend recommendations",
        error: error.message,
      }
    }
  }

  /**
   * Invalidate recommendations cache for a user
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async invalidateRecommendationsCache(userId) {
    try {
      const cacheKey = `friend_recommendations:${userId}`
      await deleteCache(cacheKey)
      return true
    } catch (error) {
      console.error("Error invalidating recommendations cache:", error)
      return false
    }
  }

  /**
   * Get mutual friends between two users
   * @param {string} userId1 - First user ID
   * @param {string} userId2 - Second user ID
   * @returns {Promise<Array>} Mutual friends
   */
  async getMutualFriends(userId1, userId2) {
    try {
      // Get friends for both users
      const user1Friends = await Friendship.getFriends(userId1)
      const user2Friends = await Friendship.getFriends(userId2)

      if (!user1Friends.length || !user2Friends.length) {
        return {
          success: true,
          count: 0,
          data: [],
        }
      }

      // Convert friend objects to IDs for easier comparison
      const user1FriendIds = user1Friends.map((friend) => friend._id.toString())
      const user2FriendIds = user2Friends.map((friend) => friend._id.toString())

      // Find intersection (mutual friends)
      const mutualFriendIds = user1FriendIds.filter((id) => user2FriendIds.includes(id))

      // Get mutual friend details
      const mutualFriends = user1Friends.filter((friend) => mutualFriendIds.includes(friend._id.toString()))

      return {
        success: true,
        count: mutualFriends.length,
        data: mutualFriends,
      }
    } catch (error) {
      console.error("Error getting mutual friends:", error)
      return {
        success: false,
        message: "Failed to get mutual friends",
        error: error.message,
      }
    }
  }

  /**
   * Get similarity score between two users
   * @param {string} userId1 - First user ID
   * @param {string} userId2 - Second user ID
   * @returns {Promise<Object>} Similarity scores
   */
  async getSimilarityScore(userId1, userId2) {
    try {
      // Find friendship record
      const friendship = await Friendship.findOne({
        $or: [
          { requester: userId1, recipient: userId2 },
          { requester: userId2, recipient: userId1 },
        ],
      })

      // If friendship exists and has scores, return them
      if (friendship && friendship.similarityScore) {
        return {
          success: true,
          data: friendship.similarityScore,
        }
      }

      // Otherwise calculate scores
      const {
        calculateJaccardSimilarity,
        calculateAdamicAdarIndex,
        calculateCompositeSimilarity,
      } = require("../algorithms/recommendationAlgorithm")

      const jaccardScore = await calculateJaccardSimilarity(userId1, userId2, Friendship)
      const adamicAdarScore = await calculateAdamicAdarIndex(userId1, userId2, Friendship)
      const compositeScore = calculateCompositeSimilarity(jaccardScore, adamicAdarScore)

      const scores = {
        jaccard: jaccardScore,
        adamicAdar: adamicAdarScore,
        composite: compositeScore,
      }

      return {
        success: true,
        data: scores,
      }
    } catch (error) {
      console.error("Error getting similarity score:", error)
      return {
        success: false,
        message: "Failed to get similarity score",
        error: error.message,
      }
    }
  }

  /**
   * Get friend suggestions based on common attributes
   * @param {string} userId - User ID
   * @param {number} limit - Maximum number of suggestions to return
   * @returns {Promise<Array>} Suggested users
   */
  async getFriendSuggestionsByAttributes(userId, limit = 10) {
    try {
      // Get user details
      const user = await User.findById(userId)
      if (!user) {
        return {
          success: false,
          message: "User not found",
        }
      }

      // Get existing friends - use the friendship service to get actual friends
      const friends = await Friendship.getFriends(userId)
      const friendIds = friends.map((friend) => friend._id.toString())

      // Add user's own ID to exclusion list
      friendIds.push(userId.toString())

      // Get all pending requests (both sent and received) to exclude them too
      const pendingSent = await Friendship.find({
        requester: userId,
        status: "pending",
      })

      const pendingReceived = await Friendship.find({
        recipient: userId,
        status: "pending",
      })

      // Get blocked users to exclude them
      const blockedUsers = await Friendship.find({
        $or: [
          { requester: userId, status: "blocked" },
          { recipient: userId, status: "blocked" },
        ],
      })

      // Add all excluded user IDs
      pendingSent.forEach((req) => friendIds.push(req.recipient.toString()))
      pendingReceived.forEach((req) => friendIds.push(req.requester.toString()))
      blockedUsers.forEach((blocked) => {
        const blockedUserId =
          blocked.requester.toString() === userId.toString()
            ? blocked.recipient.toString()
            : blocked.requester.toString()
        friendIds.push(blockedUserId)
      })

      // Build query for users with similar attributes
      const query = {
        _id: { $nin: friendIds },
      }

      // Add attribute filters if available
      if (user.university) {
        query.university = user.university
      }

      if (user.major) {
        query.major = user.major
      }

      if (user.year) {
        query.year = user.year
      }

      // Find users with similar attributes
      const suggestions = await User.find(query).select("name email university major year profilePicture").limit(limit)

      return {
        success: true,
        count: suggestions.length,
        data: suggestions,
      }
    } catch (error) {
      console.error("Error getting friend suggestions by attributes:", error)
      return {
        success: false,
        message: "Failed to get friend suggestions",
        error: error.message,
      }
    }
  }
}

module.exports = new RecommendationService()
