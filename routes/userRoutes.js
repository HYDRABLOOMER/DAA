const express = require("express")
const router = express.Router()
const userController = require("../controllers/userController")
const homeController = require("../controllers/homecontroller")
const User = require("../models/userSchema")
const { isAuthenticated } = require("../middleware/auth")

router.get("/", userController.getSignup)
router.get("/signup", userController.getSignup)
router.post("/signup", userController.postSignup)
router.get("/login", userController.getLogin)
router.post("/login", userController.postLogin)
router.get("/home", homeController.gethome)

// Get all users - HIDE existing friends, show only pending and non-friends
router.get("/api/users", isAuthenticated, async (req, res) => {
  try {
    const currentUserId = req.user._id

    // Get current user with populated friends
    const currentUser = await User.findById(currentUserId).populate("friends", "_id")

    if (!currentUser) {
      return res.status(404).json({ success: false, message: "User not found" })
    }

    // Get friend IDs to EXCLUDE from default view
    const friendIds = currentUser.friends.map((friend) => friend._id.toString())
    friendIds.push(currentUserId.toString()) // Also exclude self

    // Get all users EXCEPT current user and existing friends
    const users = await User.find({
      _id: { $nin: friendIds },
    }).select("name email university department skills interests")

    // Get users who have pending friend requests FROM current user
    const usersWithSentRequests = await User.find({
      friendRequests: currentUserId,
    }).select("_id")
    const sentRequestIds = usersWithSentRequests.map((u) => u._id.toString())

    // Get users who have sent requests TO current user (received requests)
    const receivedRequestIds = currentUser.friendRequests ? currentUser.friendRequests.map((id) => id.toString()) : []

    // Add friendship status to each user
    const usersWithStatus = users.map((user) => {
      const userId = user._id.toString()
      let friendshipStatus = "none"
      let isRequester = false

      if (sentRequestIds.includes(userId)) {
        friendshipStatus = "pending"
        isRequester = true // Current user sent the request
      } else if (receivedRequestIds.includes(userId)) {
        friendshipStatus = "pending"
        isRequester = false // Current user received the request
      }

      return {
        ...user.toObject(),
        friendshipStatus,
        isRequester,
      }
    })

    res.json(usersWithStatus)
  } catch (error) {
    console.error("Error fetching users:", error)
    res.status(500).json({ success: false, message: "Error fetching users" })
  }
})

// Search users - SHOW ALL users including friends with their status
router.get("/api/users/search", isAuthenticated, async (req, res) => {
  try {
    const { query } = req.query
    const currentUserId = req.user._id

    // Get current user with populated friends
    const currentUser = await User.findById(currentUserId).populate("friends", "_id")

    if (!currentUser) {
      return res.status(404).json({ success: false, message: "User not found" })
    }

    // Get friend IDs
    const friendIds = currentUser.friends.map((friend) => friend._id.toString())

    const searchRegex = new RegExp(query, "i")

    // Search ALL users except current user (include friends in search results)
    const users = await User.find({
      _id: { $ne: currentUserId },
      $or: [{ name: searchRegex }, { university: searchRegex }, { department: searchRegex }],
    }).select("name email university department skills interests")

    // Get users who have pending friend requests FROM current user
    const usersWithSentRequests = await User.find({
      friendRequests: currentUserId,
    }).select("_id")
    const sentRequestIds = usersWithSentRequests.map((u) => u._id.toString())

    // Get users who have sent requests TO current user (received requests)
    const receivedRequestIds = currentUser.friendRequests ? currentUser.friendRequests.map((id) => id.toString()) : []

    // Add friendship status to each user (including friends in search)
    const usersWithStatus = users.map((user) => {
      const userId = user._id.toString()
      let friendshipStatus = "none"
      let isRequester = false

      if (friendIds.includes(userId)) {
        friendshipStatus = "accepted" // Show friends in search results
      } else if (sentRequestIds.includes(userId)) {
        friendshipStatus = "pending"
        isRequester = true // Current user sent the request
      } else if (receivedRequestIds.includes(userId)) {
        friendshipStatus = "pending"
        isRequester = false // Current user received the request
      }

      return {
        ...user.toObject(),
        friendshipStatus,
        isRequester,
      }
    })

    res.json(usersWithStatus)
  } catch (error) {
    console.error("Error searching users:", error)
    res.status(500).json({ success: false, message: "Error searching users" })
  }
})

// Get friends
router.get("/api/friends", isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate(
      "friends",
      "name email university department skills interests",
    )

    res.json(user.friends || [])
  } catch (error) {
    console.error("Error fetching friends:", error)
    res.status(500).json({ success: false, message: "Error fetching friends" })
  }
})

// Get friend requests
router.get("/api/friends/requests", isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate("friendRequests", "name email university department")

    res.json(user.friendRequests || [])
  } catch (error) {
    console.error("Error fetching friend requests:", error)
    res.status(500).json({ success: false, message: "Error fetching friend requests" })
  }
})

// Send friend request
router.post("/api/friends/request", isAuthenticated, async (req, res) => {
  try {
    const { userId } = req.body
    const currentUser = req.user

    const targetUser = await User.findById(userId)
    if (!targetUser) {
      return res.status(404).json({ success: false, message: "User not found" })
    }

    if (currentUser.friends.includes(userId)) {
      return res.status(400).json({ success: false, message: "Already friends with this user" })
    }

    if (targetUser.friendRequests.includes(currentUser._id)) {
      return res.status(400).json({ success: false, message: "Friend request already sent" })
    }

    if (currentUser.friendRequests.includes(userId)) {
      return res.status(400).json({ success: false, message: "This user has already sent you a friend request" })
    }

    targetUser.friendRequests.push(currentUser._id)
    await targetUser.save()

    res.json({ success: true, message: "Friend request sent successfully" })
  } catch (error) {
    console.error("Error sending friend request:", error)
    res.status(500).json({ success: false, message: "Error sending friend request" })
  }
})

// Cancel friend request - NEW ENDPOINT
router.post("/api/friends/cancel", isAuthenticated, async (req, res) => {
  try {
    const { userId } = req.body
    const currentUser = req.user

    const targetUser = await User.findById(userId)
    if (!targetUser) {
      return res.status(404).json({ success: false, message: "User not found" })
    }

    // Remove the friend request from target user's friendRequests array
    const requestIndex = targetUser.friendRequests.indexOf(currentUser._id)
    if (requestIndex === -1) {
      return res.status(400).json({ success: false, message: "Friend request not found" })
    }

    targetUser.friendRequests.splice(requestIndex, 1)
    await targetUser.save()

    res.json({ success: true, message: "Friend request cancelled successfully" })
  } catch (error) {
    console.error("Error cancelling friend request:", error)
    res.status(500).json({ success: false, message: "Error cancelling friend request" })
  }
})

// Accept friend request
router.post("/api/friends/accept", isAuthenticated, async (req, res) => {
  try {
    const { userId } = req.body
    const currentUser = req.user

    // Add to both users' friends lists
    await User.findByIdAndUpdate(currentUser._id, {
      $addToSet: { friends: userId },
      $pull: { friendRequests: userId },
    })

    await User.findByIdAndUpdate(userId, {
      $addToSet: { friends: currentUser._id },
    })

    res.json({ success: true, message: "Friend request accepted" })
  } catch (error) {
    console.error("Error accepting friend request:", error)
    res.status(500).json({ success: false, message: "Error accepting friend request" })
  }
})

// Reject friend request
router.post("/api/friends/reject", isAuthenticated, async (req, res) => {
  try {
    const { userId } = req.body
    const currentUser = req.user

    await User.findByIdAndUpdate(currentUser._id, {
      $pull: { friendRequests: userId },
    })

    res.json({ success: true, message: "Friend request rejected" })
  } catch (error) {
    console.error("Error rejecting friend request:", error)
    res.status(500).json({ success: false, message: "Error rejecting friend request" })
  }
})

module.exports = router
