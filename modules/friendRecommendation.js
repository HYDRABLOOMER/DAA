/**
 * Friend Recommendation Module - Main Export
 *
 * This module consolidates all friend recommendation functionality
 * Previously located in features/friend_recommendation/index.js
 */

const RecommendationService = require("../services/recommendationService")
const FriendshipService = require("../services/friendshipService")
const { calculateJaccardSimilarity, calculateAdamicAdarIndex } = require("../utils/recommendationAlgorithm")

module.exports = {
  // Services
  RecommendationService,
  FriendshipService,

  // Algorithms
  calculateJaccardSimilarity,
  calculateAdamicAdarIndex,

  // Main functions
  async getFriendRecommendations(userId, limit = 10) {
    return await RecommendationService.getFriendRecommendations(userId, limit)
  },

  async getMutualFriends(userId1, userId2) {
    return await RecommendationService.getMutualFriends(userId1, userId2)
  },

  async getSimilarityScore(userId1, userId2) {
    return await RecommendationService.getSimilarityScore(userId1, userId2)
  },

  // Friendship management
  async sendFriendRequest(requesterId, recipientId) {
    return await FriendshipService.sendFriendRequest(requesterId, recipientId)
  },

  async acceptFriendRequest(requestId, userId) {
    return await FriendshipService.acceptFriendRequest(requestId, userId)
  },

  async rejectFriendRequest(requestId, userId) {
    return await FriendshipService.rejectFriendRequest(requestId, userId)
  },
}
