const User = require("../models/userSchema")

const isAuthenticated = async (req, res, next) => {
  try {
    const userId = req.cookies.userId

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Please log in.",
      })
    }

    // Get user from database
    const user = await User.findById(userId).select("-password")

    if (!user) {
      // Clear invalid cookie
      res.clearCookie("userId")
      res.clearCookie("userName")
      return res.status(401).json({
        success: false,
        message: "User not found. Please log in again.",
      })
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Account is deactivated.",
      })
    }

    // Attach user to request
    req.user = user
    next()
  } catch (error) {
    console.error("Auth middleware error:", error)
    return res.status(500).json({
      success: false,
      message: "Authentication error",
    })
  }
}

const isProjectMember = async (req, res, next) => {
  try {
    const Project = require("../models/projectSchema")
    const projectId = req.params.projectId || req.body.projectId

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: "Project ID is required",
      })
    }

    const project = await Project.findById(projectId)
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      })
    }

    // Check if user is creator or member
    const isCreator = project.creator.toString() === req.user._id.toString()
    const isMember = project.currentMembers.some((member) => member.user.toString() === req.user._id.toString())

    if (!isCreator && !isMember) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You are not a member of this project.",
      })
    }

    req.project = project
    req.isProjectCreator = isCreator
    next()
  } catch (error) {
    console.error("Project member middleware error:", error)
    return res.status(500).json({
      success: false,
      message: "Authorization error",
    })
  }
}

module.exports = {
  isAuthenticated,
  isProjectMember,
}
