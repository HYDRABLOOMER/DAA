const express = require("express")
const router = express.Router()
const { isAuthenticated } = require("../middleware/auth")
const User = require("../models/userSchema")

// Get user profile
router.get("/profile", isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password").populate("friends", "name email university")

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" })
    }

    res.json({
      success: true,
      user: user,
      skills: user.skills || [],
      interests: user.interests || [],
    })
  } catch (error) {
    console.error("Error fetching profile:", error)
    res.status(500).json({ success: false, message: "Error fetching profile" })
  }
})

// Update user profile
router.put("/profile", isAuthenticated, async (req, res) => {
  try {
    const { studentId, university, major, bio, department, year, skills, interests } = req.body

    const updateData = {}
    if (studentId) updateData.studentId = studentId
    if (university) updateData.university = university
    if (major) updateData.major = major
    if (bio) updateData.bio = bio
    if (department) updateData.department = department
    if (year) updateData.year = year
    if (skills) updateData.skills = skills
    if (interests) updateData.interests = interests

    const user = await User.findByIdAndUpdate(req.user._id, updateData, { new: true, runValidators: true }).select(
      "-password",
    )

    res.json({ success: true, user: user })
  } catch (error) {
    console.error("Error updating profile:", error)
    res.status(500).json({ success: false, message: "Error updating profile" })
  }
})

module.exports = router
