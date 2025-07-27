const express = require("express")
const router = express.Router()
const { isAuthenticated } = require("../middleware/auth")
const User = require("../models/userSchema")
const { getIntelligentTeamRecommendations } = require("../utils/teamRecommendationAlgorithm")

// Get team members (simplified for now)
router.get("/team/members", isAuthenticated, async (req, res) => {
  try {
    // For now, return user's friends as team members
    const user = await User.findById(req.user._id).populate("friends", "name email university department")

    res.json({
      success: true,
      members: user.friends || [],
    })
  } catch (error) {
    console.error("Error fetching team members:", error)
    res.status(500).json({ success: false, message: "Error fetching team members" })
  }
})

// Get intelligent team recommendations using vector similarity
router.get("/team/recommendations", isAuthenticated, async (req, res) => {
  try {
    const currentUser = req.user

    console.log("🧠 Getting intelligent team recommendations for:", currentUser.name)
    console.log("🎯 User skills:", currentUser.skills)
    console.log("🎯 User interests:", currentUser.interests)

    // Get all users from same university
    const allUsers = await User.find({
      university: currentUser.university,
    }).select("name email university department skills interests")

    console.log("👥 Total users found:", allUsers.length)

    // Get intelligent recommendations using vector similarity
    const intelligentRecommendations = await getIntelligentTeamRecommendations(currentUser, allUsers, 10)

    console.log("🚀 Intelligent recommendations:", intelligentRecommendations.length)

    // Format response for frontend
    const formattedRecommendations = intelligentRecommendations.map((rec) => ({
      _id: rec.user._id,
      name: rec.user.name,
      email: rec.user.email,
      university: rec.user.university,
      department: rec.user.department,
      skills: rec.user.skills,
      interests: rec.user.interests,
      compatibilityScore: rec.compatibilityScore.overall,
      skillsMatch: rec.compatibilityScore.skills,
      interestsMatch: rec.compatibilityScore.interests,
      reasons: rec.reasons,
      breakdown: rec.compatibilityScore.breakdown,
    }))

    res.json({
      success: true,
      recommendations: formattedRecommendations,
    })
  } catch (error) {
    console.error("Error fetching intelligent recommendations:", error)
    res.status(500).json({ success: false, message: "Error fetching intelligent recommendations" })
  }
})

// Add team member
router.post("/team/members", isAuthenticated, async (req, res) => {
  try {
    const { userId } = req.body
    const currentUser = req.user

    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required" })
    }

    // Prevent adding self
    if (userId === currentUser._id.toString()) {
      return res.status(400).json({ success: false, message: "Cannot add yourself to the team" })
    }

    // For now, just add as friend
    await User.findByIdAndUpdate(currentUser._id, {
      $addToSet: { friends: userId },
    })

    await User.findByIdAndUpdate(userId, {
      $addToSet: { friends: currentUser._id },
    })

    res.json({ success: true, message: "Team member added successfully" })
  } catch (error) {
    console.error("Error adding team member:", error)
    res.status(500).json({ success: false, message: "Error adding team member" })
  }
})

// Remove team member
router.delete("/team/members/:userId", isAuthenticated, async (req, res) => {
  try {
    const { userId } = req.params
    const currentUser = req.user

    await User.findByIdAndUpdate(currentUser._id, {
      $pull: { friends: userId },
    })

    await User.findByIdAndUpdate(userId, {
      $pull: { friends: currentUser._id },
    })

    res.json({ success: true, message: "Team member removed successfully" })
  } catch (error) {
    console.error("Error removing team member:", error)
    res.status(500).json({ success: false, message: "Error removing team member" })
  }
})

module.exports = router
