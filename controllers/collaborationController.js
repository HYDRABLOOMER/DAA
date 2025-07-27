const Project = require("../models/projectSchema")
const ProjectCollaboration = require("../models/projectCollaborationSchema")
const User = require("../models/userSchema")
const ProjectCollaborationService = require("../services/projectCollaborationService")

/**
 * Collaboration Controller - Handles project collaboration features
 */

// Get collaboration settings for a project
exports.getCollaborationSettings = async (req, res) => {
  try {
    const { projectId } = req.params

    const collaboration = await ProjectCollaboration.findByProject(projectId)
    if (!collaboration) {
      return res.status(404).json({
        success: false,
        message: "Collaboration settings not found",
      })
    }

    // Check if user has access to this project
    if (collaboration.project.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      })
    }

    res.json({
      success: true,
      collaboration,
    })
  } catch (error) {
    console.error("Error getting collaboration settings:", error)
    res.status(500).json({
      success: false,
      message: "Error retrieving collaboration settings",
    })
  }
}

// Update collaboration settings
exports.updateCollaborationSettings = async (req, res) => {
  try {
    const { projectId } = req.params
    const { skillRequirements, interestPreferences, collaborationSettings, matchingCriteria } = req.body

    const collaboration = await ProjectCollaboration.findByProject(projectId)
    if (!collaboration) {
      return res.status(404).json({
        success: false,
        message: "Collaboration settings not found",
      })
    }

    // Check if user has access to this project
    if (collaboration.project.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      })
    }

    // Update settings
    if (skillRequirements) collaboration.skillRequirements = skillRequirements
    if (interestPreferences) collaboration.interestPreferences = interestPreferences
    if (collaborationSettings)
      collaboration.collaborationSettings = { ...collaboration.collaborationSettings, ...collaborationSettings }
    if (matchingCriteria) collaboration.matchingCriteria = { ...collaboration.matchingCriteria, ...matchingCriteria }

    await collaboration.save()

    res.json({
      success: true,
      collaboration,
      message: "Collaboration settings updated successfully",
    })
  } catch (error) {
    console.error("Error updating collaboration settings:", error)
    res.status(500).json({
      success: false,
      message: "Error updating collaboration settings",
    })
  }
}

// Get project matches
exports.getProjectMatches = async (req, res) => {
  try {
    const { projectId } = req.params
    const { limit = 10 } = req.query

    const project = await Project.findById(projectId)
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      })
    }

    // Check if user has access to this project
    if (project.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      })
    }

    // Get potential users (exclude current members)
    const excludeUserIds = [project.creator, ...project.currentMembers.map((member) => member.user)]
    const potentialUsers = await User.find({
      university: project.university,
      _id: { $nin: excludeUserIds },
    })

    // Get matches using collaboration service
    const matches = await ProjectCollaborationService.getProjectMatches(project, potentialUsers, Number.parseInt(limit))

    res.json({
      success: true,
      matches,
      count: matches.length,
    })
  } catch (error) {
    console.error("Error getting project matches:", error)
    res.status(500).json({
      success: false,
      message: "Error getting project matches",
    })
  }
}

// Calculate user match score for project
exports.calculateUserMatch = async (req, res) => {
  try {
    const { projectId, userId } = req.params

    const project = await Project.findById(projectId)
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      })
    }

    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    // Calculate match score
    const matchScore = await ProjectCollaborationService.calculateUserMatch(user, project.creator, project)

    res.json({
      success: true,
      matchScore,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
      },
      project: {
        _id: project._id,
        title: project.title,
      },
    })
  } catch (error) {
    console.error("Error calculating user match:", error)
    res.status(500).json({
      success: false,
      message: "Error calculating user match",
    })
  }
}

// Get collaboration analytics
exports.getCollaborationAnalytics = async (req, res) => {
  try {
    const { projectId } = req.params

    const collaboration = await ProjectCollaboration.findByProject(projectId)
    if (!collaboration) {
      return res.status(404).json({
        success: false,
        message: "Collaboration data not found",
      })
    }

    // Check if user has access to this project
    if (collaboration.project.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      })
    }

    res.json({
      success: true,
      analytics: collaboration.analytics,
    })
  } catch (error) {
    console.error("Error getting collaboration analytics:", error)
    res.status(500).json({
      success: false,
      message: "Error getting collaboration analytics",
    })
  }
}

// Initialize collaboration settings for a project
exports.initializeCollaboration = async (req, res) => {
  try {
    const { projectId } = req.body

    const project = await Project.findById(projectId)
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      })
    }

    // Check if user is project creator
    if (project.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Only project creator can initialize collaboration",
      })
    }

    // Check if collaboration already exists
    const existingCollaboration = await ProjectCollaboration.findByProject(projectId)
    if (existingCollaboration) {
      return res.status(400).json({
        success: false,
        message: "Collaboration already initialized for this project",
      })
    }

    // Create collaboration settings
    const collaboration = new ProjectCollaboration({
      project: projectId,
      skillRequirements:
        project.requiredSkills?.map((skill) => ({
          skill: skill,
          proficiency: "Intermediate",
          required: true,
          weight: 1.0,
        })) || [],
      interestPreferences:
        project.preferredInterests?.map((interest) => ({
          interest: interest,
          importance: 3,
        })) || [],
    })

    await collaboration.save()

    res.status(201).json({
      success: true,
      collaboration,
      message: "Collaboration initialized successfully",
    })
  } catch (error) {
    console.error("Error initializing collaboration:", error)
    res.status(500).json({
      success: false,
      message: "Error initializing collaboration",
    })
  }
}

module.exports = {
  getCollaborationSettings: exports.getCollaborationSettings,
  updateCollaborationSettings: exports.updateCollaborationSettings,
  getProjectMatches: exports.getProjectMatches,
  calculateUserMatch: exports.calculateUserMatch,
  getCollaborationAnalytics: exports.getCollaborationAnalytics,
  initializeCollaboration: exports.initializeCollaboration,
}
