/**
 * Friend Recommendation - Friendship Service
 *
 * Service for managing friendships and friend requests
 * Orchestrates friendship operations and data persistence
 */

const Friendship = require("../models/friendshipSchema")
const {
  calculateJaccardSimilarity,
  calculateAdamicAdarIndex,
  calculateCompositeSimilarity,
} = require("../utils/recommendationAlgorithm")

class FriendshipService {
  /**
   * Get all friends of a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} User's friends
   */
  async getFriends(userId) {
    try {
      return await Friendship.getFriends(userId)
    } catch (error) {
      console.error("Error getting friends:", error)
      return []
    }
  }

  /**
   * Get pending friend requests for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Pending friend requests
   */
  async getPendingRequests(userId) {
    try {
      return await Friendship.getPendingRequests(userId)
    } catch (error) {
      console.error("Error getting pending requests:", error)
      return []
    }
  }

  /**
   * Get sent friend requests by a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Sent friend requests
   */
  async getSentRequests(userId) {
    try {
      return await Friendship.getSentRequests(userId)
    } catch (error) {
      console.error("Error getting sent requests:", error)
      return []
    }
  }

  /**
   * Check if two users are friends
   * @param {string} userId1 - First user ID
   * @param {string} userId2 - Second user ID
   * @returns {Promise<boolean>} Whether users are friends
   */
  async areFriends(userId1, userId2) {
    try {
      return await Friendship.areFriends(userId1, userId2)
    } catch (error) {
      console.error("Error checking friendship:", error)
      return false
    }
  }

  /**
   * Send a friend request
   * @param {string} requesterId - Requester user ID
   * @param {string} recipientId - Recipient user ID
   * @returns {Promise<Object>} Created friendship or error
   */
  async sendFriendRequest(requesterId, recipientId) {
    try {
      // Check if request already exists
      const existingRequest = await Friendship.findOne({
        $or: [
          { requester: requesterId, recipient: recipientId },
          { requester: recipientId, recipient: requesterId },
        ],
      })

      if (existingRequest) {
        return {
          success: false,
          message: "Friend request already exists or users are already friends",
          data: existingRequest,
        }
      }

      // Calculate similarity scores
      const jaccardScore = await calculateJaccardSimilarity(requesterId, recipientId, Friendship)
      const adamicAdarScore = await calculateAdamicAdarIndex(requesterId, recipientId, Friendship)
      const compositeScore = calculateCompositeSimilarity(jaccardScore, adamicAdarScore)

      // Create friend request
      const friendRequest = new Friendship({
        requester: requesterId,
        recipient: recipientId,
        status: "pending",
        similarityScore: {
          jaccard: jaccardScore,
          adamicAdar: adamicAdarScore,
          composite: compositeScore,
        },
      })

      await friendRequest.save()

      return {
        success: true,
        message: "Friend request sent successfully",
        data: friendRequest,
      }
    } catch (error) {
      console.error("Error sending friend request:", error)
      return {
        success: false,
        message: "Failed to send friend request",
        error: error.message,
      }
    }
  }

  /**
   * Accept a friend request
   * @param {string} requestId - Friend request ID
   * @param {string} userId - User ID (must be the recipient)
   * @returns {Promise<Object>} Updated friendship or error
   */
  async acceptFriendRequest(requestId, userId) {
    try {
      // Find the friend request
      const friendRequest = await Friendship.findById(requestId)

      if (!friendRequest) {
        return {
          success: false,
          message: "Friend request not found",
        }
      }

      // Check if the user is the recipient
      if (friendRequest.recipient.toString() !== userId.toString()) {
        return {
          success: false,
          message: "Not authorized to accept this request",
        }
      }

      // Update friend request status
      friendRequest.status = "accepted"
      await friendRequest.save()

      return {
        success: true,
        message: "Friend request accepted successfully",
        data: friendRequest,
      }
    } catch (error) {
      console.error("Error accepting friend request:", error)
      return {
        success: false,
        message: "Failed to accept friend request",
        error: error.message,
      }
    }
  }

  /**
   * Reject a friend request
   * @param {string} requestId - Friend request ID
   * @param {string} userId - User ID (must be the recipient)
   * @returns {Promise<Object>} Updated friendship or error
   */
  async rejectFriendRequest(requestId, userId) {
    try {
      // Find the friend request
      const friendRequest = await Friendship.findById(requestId)

      if (!friendRequest) {
        return {
          success: false,
          message: "Friend request not found",
        }
      }

      // Check if the user is the recipient
      if (friendRequest.recipient.toString() !== userId.toString()) {
        return {
          success: false,
          message: "Not authorized to reject this request",
        }
      }

      // Update friend request status
      friendRequest.status = "rejected"
      await friendRequest.save()

      return {
        success: true,
        message: "Friend request rejected successfully",
        data: friendRequest,
      }
    } catch (error) {
      console.error("Error rejecting friend request:", error)
      return {
        success: false,
        message: "Failed to reject friend request",
        error: error.message,
      }
    }
  }

  /**
   * Remove a friend
   * @param {string} userId - User ID
   * @param {string} friendId - Friend ID to remove
   * @returns {Promise<Object>} Result of operation
   */
  async removeFriend(userId, friendId) {
    try {
      // Find the friendship
      const friendship = await Friendship.findOne({
        $or: [
          { requester: userId, recipient: friendId, status: "accepted" },
          { requester: friendId, recipient: userId, status: "accepted" },
        ],
      })

      if (!friendship) {
        return {
          success: false,
          message: "Friendship not found",
        }
      }

      // Delete the friendship
      await friendship.deleteOne()

      return {
        success: true,
        message: "Friend removed successfully",
      }
    } catch (error) {
      console.error("Error removing friend:", error)
      return {
        success: false,
        message: "Failed to remove friend",
        error: error.message,
      }
    }
  }

  /**
   * Block a user
   * @param {string} userId - User ID
   * @param {string} blockUserId - User ID to block
   * @returns {Promise<Object>} Result of operation
   */
  async blockUser(userId, blockUserId) {
    try {
      // Find existing friendship
      let friendship = await Friendship.findOne({
        $or: [
          { requester: userId, recipient: blockUserId },
          { requester: blockUserId, recipient: userId },
        ],
      })

      if (friendship) {
        // Update existing friendship to blocked status
        friendship.status = "blocked"

        // Ensure the blocking user is the requester
        if (friendship.requester.toString() !== userId.toString()) {
          // Swap requester and recipient
          const temp = friendship.requester
          friendship.requester = friendship.recipient
          friendship.recipient = temp
        }

        await friendship.save()
      } else {
        // Create new blocked relationship
        friendship = new Friendship({
          requester: userId,
          recipient: blockUserId,
          status: "blocked",
        })

        await friendship.save()
      }

      return {
        success: true,
        message: "User blocked successfully",
        data: friendship,
      }
    } catch (error) {
      console.error("Error blocking user:", error)
      return {
        success: false,
        message: "Failed to block user",
        error: error.message,
      }
    }
  }

  /**
   * Unblock a user
   * @param {string} userId - User ID
   * @param {string} unblockUserId - User ID to unblock
   * @returns {Promise<Object>} Result of operation
   */
  async unblockUser(userId, unblockUserId) {
    try {
      // Find the blocked relationship
      const friendship = await Friendship.findOne({
        requester: userId,
        recipient: unblockUserId,
        status: "blocked",
      })

      if (!friendship) {
        return {
          success: false,
          message: "Blocked relationship not found",
        }
      }

      // Delete the relationship
      await friendship.deleteOne()

      return {
        success: true,
        message: "User unblocked successfully",
      }
    } catch (error) {
      console.error("Error unblocking user:", error)
      return {
        success: false,
        message: "Failed to unblock user",
        error: error.message,
      }
    }
  }

  /**
   * Update similarity scores between users
   * @param {string} userId1 - First user ID
   * @param {string} userId2 - Second user ID
   * @returns {Promise<Object>} Updated scores
   */
  async updateSimilarityScores(userId1, userId2) {
    try {
      // Calculate similarity scores
      const jaccardScore = await calculateJaccardSimilarity(userId1, userId2, Friendship)
      const adamicAdarScore = await calculateAdamicAdarIndex(userId1, userId2, Friendship)
      const compositeScore = calculateCompositeSimilarity(jaccardScore, adamicAdarScore)

      // Update scores in database
      const success = await Friendship.updateSimilarityScores(userId1, userId2, {
        jaccard: jaccardScore,
        adamicAdar: adamicAdarScore,
        composite: compositeScore,
      })

      return {
        success,
        scores: {
          jaccard: jaccardScore,
          adamicAdar: adamicAdarScore,
          composite: compositeScore,
        },
      }
    } catch (error) {
      console.error("Error updating similarity scores:", error)
      return {
        success: false,
        message: "Failed to update similarity scores",
        error: error.message,
      }
    }
  }
}

module.exports = new FriendshipService()
