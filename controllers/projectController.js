const Project = require("../models/projectSchema")
const ProjectApplication = require("../models/projectApplicationSchema")
const ProjectFeedback = require("../models/projectFeedbackSchema")
const User = require("../models/userSchema")
const {
  getProjectRecommendations,
  calculateProjectMatchScore,
  calculateUserFeedbackScore,
} = require("../utils/projectMatchingAlgorithm")
const ProjectCollaborationService = require("../services/projectCollaborationService")

// Get all projects with filtering
exports.getProjects = async (req, res) => {
  try {
    const { status, category, search, page = 1, limit = 20 } = req.query
    const filter = { university: req.user.university }

    // Apply filters
    if (status && status !== "all") filter.status = status
    if (category && category !== "all") filter.category = category
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { requiredSkills: { $in: [new RegExp(search, "i")] } },
      ]
    }

    const skip = (Number.parseInt(page) - 1) * Number.parseInt(limit)

    const projects = await Project.find(filter)
      .populate("creator", "name department email")
      .populate("currentMembers.user", "name department")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number.parseInt(limit))

    const total = await Project.countDocuments(filter)

    res.json({
      success: true,
      projects,
      pagination: {
        current: Number.parseInt(page),
        total: Math.ceil(total / Number.parseInt(limit)),
        count: projects.length,
        totalProjects: total,
      },
    })
  } catch (error) {
    console.error("Error getting projects:", error)
    res.status(500).json({
      success: false,
      message: "Error retrieving projects",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    })
  }
}

// Get project recommendations
exports.getRecommendations = async (req, res) => {
  try {
    const { limit = 10 } = req.query

    const projects = await Project.find({
      university: req.user.university,
      status: "recruiting",
    })
      .populate("creator", "name department")
      .populate("currentMembers.user", "name department")

    const recommendations = await getProjectRecommendations(req.user, projects, ProjectFeedback, Number.parseInt(limit))

    res.json({
      success: true,
      recommendations,
      count: recommendations.length,
    })
  } catch (error) {
    console.error("Error getting recommendations:", error)
    res.status(500).json({
      success: false,
      message: "Error getting recommendations",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    })
  }
}

// Create new project
exports.createProject = async (req, res) => {
  try {
    const { title, description, requiredSkills, preferredInterests, maxMembers, deadline, category } = req.body

    // Validation
    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: "Title and description are required",
      })
    }

    if (title.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Title cannot exceed 100 characters",
      })
    }

    if (description.length > 2000) {
      return res.status(400).json({
        success: false,
        message: "Description cannot exceed 2000 characters",
      })
    }

    const project = new Project({
      title: title.trim(),
      description: description.trim(),
      creator: req.user._id,
      requiredSkills: Array.isArray(requiredSkills) ? requiredSkills.filter((s) => s.trim()) : [],
      preferredInterests: Array.isArray(preferredInterests) ? preferredInterests.filter((i) => i.trim()) : [],
      maxMembers: Math.max(2, Math.min(10, Number.parseInt(maxMembers) || 4)),
      deadline: deadline ? new Date(deadline) : null,
      category: category || "other",
      university: req.user.university,
      currentMembers: [
        {
          user: req.user._id,
          role: "creator",
        },
      ],
    })

    await project.save()
    await project.populate("creator", "name department email")

    res.status(201).json({
      success: true,
      project,
      message: "Project created successfully",
    })
  } catch (error) {
    console.error("Error creating project:", error)

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((e) => e.message)
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors,
      })
    }

    res.status(500).json({
      success: false,
      message: "Error creating project",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    })
  }
}

// Get single project details
exports.getProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate("creator", "name department university email bio")
      .populate("currentMembers.user", "name department university bio")
      .populate({
        path: "applications",
        populate: {
          path: "applicant",
          select: "name department university skills interests bio",
        },
      })

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      })
    }

    // Check if user can view this project (same university)
    if (project.university !== req.user.university) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Project is from a different university.",
      })
    }

    // Check if user is creator or member
    const isCreator = project.creator._id.toString() === req.user._id.toString()
    const isMember = project.currentMembers.some((member) => member.user._id.toString() === req.user._id.toString())

    // Calculate match score if user is not creator or member
    let matchScore = null
    if (!isCreator && !isMember) {
      const userFeedbackScore = await calculateUserFeedbackScore(req.user._id, ProjectFeedback)
      matchScore = calculateProjectMatchScore(req.user, project, userFeedbackScore)
    }

    res.json({
      success: true,
      project,
      userRelation: {
        isCreator,
        isMember,
        canApply: !isCreator && !isMember && project.status === "recruiting" && !project.isFull,
      },
      matchScore,
    })
  } catch (error) {
    console.error("Error getting project:", error)
    res.status(500).json({
      success: false,
      message: "Error retrieving project",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    })
  }
}

// Apply to project
exports.applyToProject = async (req, res) => {
  try {
    const { projectId, message } = req.body

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

    // Validation checks
    if (project.creator.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "Cannot apply to your own project",
      })
    }

    if (project.currentMembers.some((member) => member.user.toString() === req.user._id.toString())) {
      return res.status(400).json({
        success: false,
        message: "You are already a member of this project",
      })
    }

    if (project.status !== "recruiting") {
      return res.status(400).json({
        success: false,
        message: "Project is not currently recruiting",
      })
    }

    if (project.currentMembers.length >= project.maxMembers) {
      return res.status(400).json({
        success: false,
        message: "Project is full",
      })
    }

    // Check for existing application
    const existingApplication = await ProjectApplication.findOne({
      project: projectId,
      applicant: req.user._id,
    })

    if (existingApplication) {
      return res.status(400).json({
        success: false,
        message: "You have already applied to this project",
      })
    }

    // Calculate match score
    const userFeedbackScore = await calculateUserFeedbackScore(req.user._id, ProjectFeedback)
    const matchScore = calculateProjectMatchScore(req.user, project, userFeedbackScore)

    // Create application
    const application = new ProjectApplication({
      project: projectId,
      applicant: req.user._id,
      message: message ? message.trim() : "",
      matchScore: matchScore.overall,
      skillsMatch: matchScore.skills,
      interestsMatch: matchScore.interests,
      feedbackScore: matchScore.feedback,
    })

    await application.save()

    // Add application to project
    project.applications.push(application._id)
    await project.save()

    await application.populate("applicant", "name department university")

    res.status(201).json({
      success: true,
      application,
      matchScore,
      message: "Application submitted successfully",
    })
  } catch (error) {
    console.error("Error applying to project:", error)

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "You have already applied to this project",
      })
    }

    res.status(500).json({
      success: false,
      message: "Error submitting application",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    })
  }
}

// Handle application (accept/reject)
exports.handleApplication = async (req, res) => {
  try {
    const { applicationId, action } = req.body

    if (!applicationId || !action) {
      return res.status(400).json({
        success: false,
        message: "Application ID and action are required",
      })
    }

    if (!["accept", "reject"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Action must be either "accept" or "reject"',
      })
    }

    const application = await ProjectApplication.findById(applicationId)
      .populate("project")
      .populate("applicant", "name department email")

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      })
    }

    // Check if user is project creator
    if (application.project.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Only project creator can handle applications",
      })
    }

    if (application.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Application has already been processed",
      })
    }

    if (action === "accept") {
      // Check if project still has space
      if (application.project.currentMembers.length >= application.project.maxMembers) {
        return res.status(400).json({
          success: false,
          message: "Project is full",
        })
      }

      // Add user to project members
      application.project.currentMembers.push({
        user: application.applicant._id,
        role: "member",
      })

      await application.project.save()
      application.status = "accepted"
    } else {
      application.status = "rejected"
    }

    application.reviewedAt = new Date()
    application.reviewedBy = req.user._id
    await application.save()

    res.json({
      success: true,
      application,
      message: `Application ${action}ed successfully`,
    })
  } catch (error) {
    console.error("Error handling application:", error)
    res.status(500).json({
      success: false,
      message: "Error processing application",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    })
  }
}

// Get user's projects (created and joined)
exports.getUserProjects = async (req, res) => {
  try {
    const createdProjects = await Project.find({ creator: req.user._id })
      .populate("creator", "name department")
      .populate("currentMembers.user", "name department")
      .populate("applications", "status applicant")
      .sort({ createdAt: -1 })

    const joinedProjects = await Project.find({
      "currentMembers.user": req.user._id,
      creator: { $ne: req.user._id },
    })
      .populate("creator", "name department")
      .populate("currentMembers.user", "name department")
      .sort({ createdAt: -1 })

    const applications = await ProjectApplication.find({ applicant: req.user._id })
      .populate("project", "title status creator")
      .populate("project.creator", "name")
      .sort({ createdAt: -1 })

    res.json({
      success: true,
      createdProjects,
      joinedProjects,
      applications,
      summary: {
        created: createdProjects.length,
        joined: joinedProjects.length,
        applied: applications.length,
        pendingApplications: applications.filter((app) => app.status === "pending").length,
      },
    })
  } catch (error) {
    console.error("Error getting user projects:", error)
    res.status(500).json({
      success: false,
      message: "Error retrieving user projects",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    })
  }
}

// Update project status
exports.updateProjectStatus = async (req, res) => {
  try {
    const { projectId, status } = req.body

    if (!projectId || !status) {
      return res.status(400).json({
        success: false,
        message: "Project ID and status are required",
      })
    }

    const validStatuses = ["recruiting", "in-progress", "completed", "cancelled"]
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be one of: " + validStatuses.join(", "),
      })
    }

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
        message: "Only project creator can update status",
      })
    }

    project.status = status
    await project.save()

    res.json({
      success: true,
      project,
      message: "Project status updated successfully",
    })
  } catch (error) {
    console.error("Error updating project status:", error)
    res.status(500).json({
      success: false,
      message: "Error updating project status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    })
  }
}

// Get user recommendations for a project
exports.getUserRecommendations = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)

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
        message: "Only project creator can view recommendations",
      })
    }

    // Get all users from same university (excluding current members and creator)
    const excludeUserIds = [project.creator, ...project.currentMembers.map((member) => member.user)]

    const users = await User.find({
      university: req.user.university,
      _id: { $nin: excludeUserIds },
    })

    // Calculate match scores for each user
    const recommendations = users.map((user) => {
      const matchScore = calculateProjectMatchScore(user, project, 0.5) // Default feedback score
      return {
        user,
        matchScore: matchScore.overall,
        skillsMatch: matchScore.skills,
        interestsMatch: matchScore.interests,
        feedbackScore: matchScore.feedback,
      }
    })

    // Sort by match score and return top 10
    recommendations.sort((a, b) => b.matchScore - a.matchScore)
    const topRecommendations = recommendations.slice(0, 10)

    res.json({
      success: true,
      recommendations: topRecommendations,
      count: topRecommendations.length,
    })
  } catch (error) {
    console.error("Error getting user recommendations:", error)
    res.status(500).json({
      success: false,
      message: "Error getting recommendations",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    })
  }
}

// Send invitation to user - UPDATED TO USE NEW SERVICE
exports.sendInvitation = async (req, res) => {
  try {
    const { projectId, userId, message } = req.body

    console.log("=== SEND INVITATION DEBUG ===")
    console.log("Request body:", req.body)
    console.log("Sender ID:", req.user._id)

    if (!projectId || !userId) {
      return res.status(400).json({
        success: false,
        message: "Project ID and User ID are required",
      })
    }

    // Verify project exists and user is creator
    const project = await Project.findById(projectId)
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      })
    }

    if (project.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Only project creator can send invitations",
      })
    }

    // Check if project is full
    if (project.currentMembers.length >= project.maxMembers) {
      return res.status(400).json({
        success: false,
        message: "Project is full",
      })
    }

    // Use the updated service to send invitation
    const invitation = await ProjectCollaborationService.sendInvitation(
      projectId,
      userId,
      req.user._id,
      message || "",
      null, // matchScore - can be calculated if needed
      [], // matchReasons - can be calculated if needed
    )

    console.log("Invitation created:", invitation)

    res.json({
      success: true,
      message: "Invitation sent successfully",
      invitation: invitation,
    })
  } catch (error) {
    console.error("Error sending invitation:", error)
    res.status(500).json({
      success: false,
      message: "Error sending invitation: " + error.message,
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    })
  }
}

// Handle invitation response - UPDATED TO USE NEW SERVICE
exports.handleInvitation = async (req, res) => {
  try {
    const { invitationId, action } = req.body
    const userId = req.user._id

    console.log("=== HANDLE INVITATION DEBUG ===")
    console.log("Invitation ID:", invitationId)
    console.log("Action:", action)
    console.log("User ID:", userId)

    const result = await ProjectCollaborationService.handleInvitation(invitationId, action, userId)

    res.json({
      success: true,
      message: "Invitation handled successfully",
      result,
    })
  } catch (error) {
    console.error("Error handling invitation:", error)
    res.status(500).json({
      success: false,
      message: "Error handling invitation: " + error.message,
    })
  }
}

// Get user's invitations - UPDATED TO USE NEW SERVICE
exports.getUserInvitations = async (req, res) => {
  try {
    const userId = req.user._id
    console.log("=== GET USER INVITATIONS DEBUG ===")
    console.log("User ID:", userId)

    const invitations = await ProjectCollaborationService.getUserInvitations(userId)

    console.log("Found invitations:", invitations.length)

    res.json({
      success: true,
      invitations: invitations,
    })
  } catch (error) {
    console.error("Error getting invitations:", error)
    res.status(500).json({
      success: false,
      message: "Error getting invitations",
    })
  }
}

module.exports = {
  getProjects: exports.getProjects,
  getRecommendations: exports.getRecommendations,
  createProject: exports.createProject,
  getProject: exports.getProject,
  applyToProject: exports.applyToProject,
  handleApplication: exports.handleApplication,
  getUserProjects: exports.getUserProjects,
  updateProjectStatus: exports.updateProjectStatus,
  getUserRecommendations: exports.getUserRecommendations,
  sendInvitation: exports.sendInvitation,
  handleInvitation: exports.handleInvitation,
  getUserInvitations: exports.getUserInvitations,
}
