const path = require("path")
const User = require("../models/userSchema")
const utils = require("../utils/passwordUtils")
const bcrypt = require("bcrypt")

const getSignup = (req, res) => {
  res.sendFile(path.join(__dirname, "../public/signup.html"))
}

const postSignup = async (req, res) => {
  try {
    const { name, email, university, studentId, password } = req.body

    // Check if user already exists
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" })
    }
    // Check if studentId already exists
    const existingStudent = await User.findOne({ studentId })
    if (existingStudent) {
      return res.status(400).json({ message: "Student ID already in use" })
    }
    const hashedpasswor = await utils.hashPassword(password)
    const newUser = new User({
      name,
      email,
      university,
      studentId,
      password: hashedpasswor,
    })

    const savedUser = await newUser.save()
    res.status(201).json({ message: "ACCOUNT CREATED", user: savedUser })
  } catch (error) {
    console.error("Error saving user:", error)
    res.status(500).json({ message: "SERVER DOWN: CANNOT UPDATE USER. TRY AGAIN." })
  }
}

const getLogin = (req, res) => {
  res.sendFile(path.join(__dirname, "../public/login.html"))
}

const postLogin = async (req, res) => {
  try {
    const { email, password } = req.body
    const user = await User.findOne({ email })
    if (user) {
      const isMatch = await bcrypt.compare(password, user.password)
      if (!isMatch) {
        return res.status(401).json({ message: "INVALID CREDENTIALS" })
      } else {
        // Set both userId and userName cookies
        res.cookie("userId", user.id, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
        })
        res.cookie("userName", user.name, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
        })
        res.status(200).json({ message: "LOGIN SUCCESSFUL", user })
      }
    } else {
      return res.status(401).json({ message: "INVALID CREDENTIALS" })
    }
  } catch (error) {
    console.error("Error during login:", error)
    res.status(500).json({ message: "SERVER DOWN: CANNOT PROCESS LOGIN. TRY AGAIN." })
  }
}

// Get all users (this might be what's being used for "Find Users")
const getAllUsers = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      })
    }

    const currentUserId = req.user._id.toString()

    // Get current user's friends list
    const currentUser = await User.findById(currentUserId).populate("friends", "_id")
    const friendIds = currentUser.friends.map((friend) => friend._id.toString())

    // Add current user ID to exclusion list
    friendIds.push(currentUserId)

    // Get current user's friend requests (both sent and received)
    const sentRequests = await User.find({ friendRequests: currentUserId }).select("_id")
    const sentRequestIds = sentRequests.map((u) => u._id.toString())

    // Add sent request IDs to exclusion list
    sentRequestIds.forEach((id) => friendIds.push(id))

    // Add received friend requests to exclusion list
    if (currentUser.friendRequests && currentUser.friendRequests.length > 0) {
      currentUser.friendRequests.forEach((id) => friendIds.push(id.toString()))
    }

    // Find users excluding friends, pending requests, and self
    const users = await User.find({
      _id: { $nin: friendIds },
      university: currentUser.university, // Only show users from same university
    }).select("name email university major year profilePicture department skills interests")

    res.json({
      success: true,
      users: users,
    })
  } catch (error) {
    console.error("Error fetching users:", error)
    res.status(500).json({
      success: false,
      message: "Error fetching users",
    })
  }
}

// Get user profile
const getUserProfile = async (req, res) => {
  try {
    const userId = req.params.id
    const user = await User.findById(userId).select("-password").populate("friends", "name email university")

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    res.json({
      success: true,
      user: user,
    })
  } catch (error) {
    console.error("Error fetching user profile:", error)
    res.status(500).json({
      success: false,
      message: "Error fetching user profile",
    })
  }
}

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const userId = req.user._id
    const updates = req.body

    // Remove sensitive fields that shouldn't be updated this way
    delete updates.password
    delete updates.email
    delete updates._id

    const user = await User.findByIdAndUpdate(userId, { $set: updates }, { new: true, runValidators: true }).select(
      "-password",
    )

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: user,
    })
  } catch (error) {
    console.error("Error updating profile:", error)
    res.status(500).json({
      success: false,
      message: "Error updating profile",
    })
  }
}

// Search users
const searchUsers = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      })
    }

    const { query } = req.query
    const currentUserId = req.user._id.toString()

    // Get current user's friends and requests to exclude them
    const currentUser = await User.findById(currentUserId).populate("friends", "_id")
    const friendIds = currentUser.friends.map((friend) => friend._id.toString())
    friendIds.push(currentUserId) // Exclude self

    // Get sent and received friend requests
    const sentRequests = await User.find({ friendRequests: currentUserId }).select("_id")
    const sentRequestIds = sentRequests.map((u) => u._id.toString())
    sentRequestIds.forEach((id) => friendIds.push(id))

    if (currentUser.friendRequests && currentUser.friendRequests.length > 0) {
      currentUser.friendRequests.forEach((id) => friendIds.push(id.toString()))
    }

    const searchCriteria = {
      _id: { $nin: friendIds },
    }

    if (query && query.trim()) {
      searchCriteria.$or = [
        { name: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } },
        { university: { $regex: query, $options: "i" } },
        { major: { $regex: query, $options: "i" } },
      ]
    }

    // Only show users from same university
    if (currentUser.university) {
      searchCriteria.university = currentUser.university
    }

    const users = await User.find(searchCriteria)
      .select("name email university major year profilePicture department skills interests")
      .limit(20)

    res.json({
      success: true,
      users: users,
    })
  } catch (error) {
    console.error("Error searching users:", error)
    res.status(500).json({
      success: false,
      message: "Error searching users",
    })
  }
}

// Send friend request
const sendFriendRequest = async (req, res) => {
  try {
    const { recipientId } = req.body
    const requesterId = req.user._id

    if (requesterId.toString() === recipientId) {
      return res.status(400).json({
        success: false,
        message: "Cannot send friend request to yourself",
      })
    }

    // Check if users are already friends
    const requester = await User.findById(requesterId)
    const recipient = await User.findById(recipientId)

    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    // Check if already friends
    if (requester.friends.includes(recipientId)) {
      return res.status(400).json({
        success: false,
        message: "Already friends with this user",
      })
    }

    // Check if request already sent
    if (recipient.friendRequests.includes(requesterId)) {
      return res.status(400).json({
        success: false,
        message: "Friend request already sent",
      })
    }

    // Add friend request
    recipient.friendRequests.push(requesterId)
    await recipient.save()

    res.json({
      success: true,
      message: "Friend request sent successfully",
    })
  } catch (error) {
    console.error("Error sending friend request:", error)
    res.status(500).json({
      success: false,
      message: "Error sending friend request",
    })
  }
}

// Accept friend request
const acceptFriendRequest = async (req, res) => {
  try {
    const { requesterId } = req.body
    const recipientId = req.user._id

    const requester = await User.findById(requesterId)
    const recipient = await User.findById(recipientId)

    if (!requester) {
      return res.status(404).json({
        success: false,
        message: "Requester not found",
      })
    }

    // Check if friend request exists
    if (!recipient.friendRequests.includes(requesterId)) {
      return res.status(400).json({
        success: false,
        message: "No friend request found",
      })
    }

    // Add to friends lists
    requester.friends.push(recipientId)
    recipient.friends.push(requesterId)

    // Remove from friend requests
    recipient.friendRequests = recipient.friendRequests.filter((id) => id.toString() !== requesterId.toString())

    await requester.save()
    await recipient.save()

    res.json({
      success: true,
      message: "Friend request accepted",
    })
  } catch (error) {
    console.error("Error accepting friend request:", error)
    res.status(500).json({
      success: false,
      message: "Error accepting friend request",
    })
  }
}

// Reject friend request
const rejectFriendRequest = async (req, res) => {
  try {
    const { requesterId } = req.body
    const recipientId = req.user._id

    const recipient = await User.findById(recipientId)

    // Remove from friend requests
    recipient.friendRequests = recipient.friendRequests.filter((id) => id.toString() !== requesterId.toString())

    await recipient.save()

    res.json({
      success: true,
      message: "Friend request rejected",
    })
  } catch (error) {
    console.error("Error rejecting friend request:", error)
    res.status(500).json({
      success: false,
      message: "Error rejecting friend request",
    })
  }
}

// Remove friend
const removeFriend = async (req, res) => {
  try {
    const { friendId } = req.body
    const userId = req.user._id

    const user = await User.findById(userId)
    const friend = await User.findById(friendId)

    if (!friend) {
      return res.status(404).json({
        success: false,
        message: "Friend not found",
      })
    }

    // Remove from both users' friends lists
    user.friends = user.friends.filter((id) => id.toString() !== friendId.toString())
    friend.friends = friend.friends.filter((id) => id.toString() !== userId.toString())

    await user.save()
    await friend.save()

    res.json({
      success: true,
      message: "Friend removed successfully",
    })
  } catch (error) {
    console.error("Error removing friend:", error)
    res.status(500).json({
      success: false,
      message: "Error removing friend",
    })
  }
}

// Get friend requests
const getFriendRequests = async (req, res) => {
  try {
    const userId = req.user._id
    const user = await User.findById(userId).populate("friendRequests", "name email university profilePicture")

    res.json({
      success: true,
      friendRequests: user.friendRequests,
    })
  } catch (error) {
    console.error("Error getting friend requests:", error)
    res.status(500).json({
      success: false,
      message: "Error getting friend requests",
    })
  }
}

// Get user's friends
const getFriends = async (req, res) => {
  try {
    const userId = req.user._id
    const user = await User.findById(userId).populate("friends", "name email university profilePicture")

    res.json({
      success: true,
      friends: user.friends,
    })
  } catch (error) {
    console.error("Error getting friends:", error)
    res.status(500).json({
      success: false,
      message: "Error getting friends",
    })
  }
}

module.exports = {
  getSignup,
  postSignup,
  getLogin,
  postLogin,
  getAllUsers,
  getUserProfile,
  updateProfile,
  searchUsers,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
  getFriendRequests,
  getFriends,
}
