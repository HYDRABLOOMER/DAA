const User = require("../models/userSchema")
const Friendship = require("../models/friendshipSchema")
const FriendshipService = require("../services/friendshipService")

/**
 * Friend Controller - Handles friend-related operations
 */

// Get user's friends
exports.getFriends = async (req, res) => {
  try {
    const friends = await FriendshipService.getFriends(req.user._id)

    res.json({
      success: true,
      friends,
      count: friends.length,
    })
  } catch (error) {
    console.error("Error getting friends:", error)
    res.status(500).json({
      success: false,
      message: "Error retrieving friends",
    })
  }
}

// Get pending friend requests
exports.getPendingRequests = async (req, res) => {
  try {
    const pendingRequests = await FriendshipService.getPendingRequests(req.user._id)

    res.json({
      success: true,
      requests: pendingRequests,
      count: pendingRequests.length,
    })
  } catch (error) {
    console.error("Error getting pending requests:", error)
    res.status(500).json({
      success: false,
      message: "Error retrieving pending requests",
    })
  }
}

// Get sent friend requests
exports.getSentRequests = async (req, res) => {
  try {
    const sentRequests = await FriendshipService.getSentRequests(req.user._id)

    res.json({
      success: true,
      requests: sentRequests,
      count: sentRequests.length,
    })
  } catch (error) {
    console.error("Error getting sent requests:", error)
    res.status(500).json({
      success: false,
      message: "Error retrieving sent requests",
    })
  }
}

// Send friend request
exports.sendFriendRequest = async (req, res) => {
  try {
    const { recipientId, message } = req.body

    if (!recipientId) {
      return res.status(400).json({
        success: false,
        message: "Recipient ID is required",
      })
    }

    // Check if recipient exists
    const recipient = await User.findById(recipientId)
    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    // Cannot send request to self
    if (recipientId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "Cannot send friend request to yourself",
      })
    }

    const result = await FriendshipService.sendFriendRequest(req.user._id, recipientId)

    if (result.success) {
      res.status(201).json(result)
    } else {
      res.status(400).json(result)
    }
  } catch (error) {
    console.error("Error sending friend request:", error)
    res.status(500).json({
      success: false,
      message: "Error sending friend request",
    })
  }
}

// Accept friend request
exports.acceptFriendRequest = async (req, res) => {
  try {
    const { requestId } = req.body

    if (!requestId) {
      return res.status(400).json({
        success: false,
        message: "Request ID is required",
      })
    }

    const result = await FriendshipService.acceptFriendRequest(requestId, req.user._id)

    if (result.success) {
      res.json(result)
    } else {
      res.status(400).json(result)
    }
  } catch (error) {
    console.error("Error accepting friend request:", error)
    res.status(500).json({
      success: false,
      message: "Error accepting friend request",
    })
  }
}

// Reject friend request
exports.rejectFriendRequest = async (req, res) => {
  try {
    const { requestId } = req.body

    if (!requestId) {
      return res.status(400).json({
        success: false,
        message: "Request ID is required",
      })
    }

    const result = await FriendshipService.rejectFriendRequest(requestId, req.user._id)

    if (result.success) {
      res.json(result)
    } else {
      res.status(400).json(result)
    }
  } catch (error) {
    console.error("Error rejecting friend request:", error)
    res.status(500).json({
      success: false,
      message: "Error rejecting friend request",
    })
  }
}

// Remove friend
exports.removeFriend = async (req, res) => {
  try {
    const { friendId } = req.body

    if (!friendId) {
      return res.status(400).json({
        success: false,
        message: "Friend ID is required",
      })
    }

    const result = await FriendshipService.removeFriend(req.user._id, friendId)

    if (result.success) {
      res.json(result)
    } else {
      res.status(400).json(result)
    }
  } catch (error) {
    console.error("Error removing friend:", error)
    res.status(500).json({
      success: false,
      message: "Error removing friend",
    })
  }
}

// Block user
exports.blockUser = async (req, res) => {
  try {
    const { userId } = req.body

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      })
    }

    // Cannot block self
    if (userId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "Cannot block yourself",
      })
    }

    const result = await FriendshipService.blockUser(req.user._id, userId)

    if (result.success) {
      res.json(result)
    } else {
      res.status(400).json(result)
    }
  } catch (error) {
    console.error("Error blocking user:", error)
    res.status(500).json({
      success: false,
      message: "Error blocking user",
    })
  }
}

// Unblock user
exports.unblockUser = async (req, res) => {
  try {
    const { userId } = req.body

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      })
    }

    const result = await FriendshipService.unblockUser(req.user._id, userId)

    if (result.success) {
      res.json(result)
    } else {
      res.status(400).json(result)
    }
  } catch (error) {
    console.error("Error unblocking user:", error)
    res.status(500).json({
      success: false,
      message: "Error unblocking user",
    })
  }
}

// Get mutual friends
exports.getMutualFriends = async (req, res) => {
  try {
    const { userId } = req.params

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      })
    }

    const RecommendationService = require("../services/recommendationService")
    const result = await RecommendationService.getMutualFriends(req.user._id, userId)

    if (result.success) {
      res.json(result)
    } else {
      res.status(400).json(result)
    }
  } catch (error) {
    console.error("Error getting mutual friends:", error)
    res.status(500).json({
      success: false,
      message: "Error getting mutual friends",
    })
  }
}

module.exports = {
  getFriends: exports.getFriends,
  getPendingRequests: exports.getPendingRequests,
  getSentRequests: exports.getSentRequests,
  sendFriendRequest: exports.sendFriendRequest,
  acceptFriendRequest: exports.acceptFriendRequest,
  rejectFriendRequest: exports.rejectFriendRequest,
  removeFriend: exports.removeFriend,
  blockUser: exports.blockUser,
  unblockUser: exports.unblockUser,
  getMutualFriends: exports.getMutualFriends,
}
