const ProjectFeedback = require("../models/projectFeedbackSchema")
const Project = require("../models/projectSchema")
const User = require("../models/userSchema")

// Submit feedback for project member
exports.submitFeedback = async (req, res) => {
  try {
    const { projectId, revieweeId, ratings, comment, isAnonymous } = req.body

    // Validate project exists and user was a member
    const project = await Project.findById(projectId)
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" })
    }

    // Check if reviewer was part of the project
    const reviewerWasMember =
      project.currentMembers.some((member) => member.user.toString() === req.user._id.toString()) ||
      project.creator.toString() === req.user._id.toString()

    if (!reviewerWasMember) {
      return res.status(403).json({ success: false, message: "You were not a member of this project" })
    }

    // Check if reviewee was part of the project
    const revieweeWasMember =
      project.currentMembers.some((member) => member.user.toString() === revieweeId) ||
      project.creator.toString() === revieweeId

    if (!revieweeWasMember) {
      return res.status(400).json({ success: false, message: "Reviewee was not a member of this project" })
    }

    // Cannot review yourself
    if (req.user._id.toString() === revieweeId) {
      return res.status(400).json({ success: false, message: "Cannot review yourself" })
    }

    // Check for existing feedback
    const existingFeedback = await ProjectFeedback.findOne({
      project: projectId,
      reviewer: req.user._id,
      reviewee: revieweeId,
    })

    if (existingFeedback) {
      return res.status(400).json({ success: false, message: "Feedback already submitted for this member" })
    }

    // Validate ratings
    const { technical, communication, teamwork, reliability } = ratings
    if (!technical || !communication || !teamwork || !reliability) {
      return res.status(400).json({ success: false, message: "All ratings are required" })
    }

    if ([technical, communication, teamwork, reliability].some((rating) => rating < 1 || rating > 5)) {
      return res.status(400).json({ success: false, message: "Ratings must be between 1 and 5" })
    }

    // Create feedback
    const feedback = new ProjectFeedback({
      project: projectId,
      reviewer: req.user._id,
      reviewee: revieweeId,
      ratings: {
        technical,
        communication,
        teamwork,
        reliability,
      },
      comment: comment || "",
      isAnonymous: isAnonymous || false,
    })

    await feedback.save()

    res.json({ success: true, feedback })
  } catch (error) {
    console.error("Error submitting feedback:", error)
    res.status(500).json({ success: false, message: "Error submitting feedback" })
  }
}

// Get feedback for a user
exports.getUserFeedback = async (req, res) => {
  try {
    const userId = req.params.userId || req.user._id

    const feedbacks = await ProjectFeedback.find({ reviewee: userId })
      .populate("project", "title")
      .populate("reviewer", "name department")
      .sort({ createdAt: -1 })

    // Calculate average ratings
    const totalRatings = {
      technical: 0,
      communication: 0,
      teamwork: 0,
      reliability: 0,
    }

    const count = feedbacks.length

    feedbacks.forEach((feedback) => {
      totalRatings.technical += feedback.ratings.technical
      totalRatings.communication += feedback.ratings.communication
      totalRatings.teamwork += feedback.ratings.teamwork
      totalRatings.reliability += feedback.ratings.reliability
    })

    const averageRatings =
      count > 0
        ? {
            technical: (totalRatings.technical / count).toFixed(1),
            communication: (totalRatings.communication / count).toFixed(1),
            teamwork: (totalRatings.teamwork / count).toFixed(1),
            reliability: (totalRatings.reliability / count).toFixed(1),
            overall: (
              (totalRatings.technical + totalRatings.communication + totalRatings.teamwork + totalRatings.reliability) /
              (count * 4)
            ).toFixed(1),
          }
        : null

    res.json({
      success: true,
      feedbacks: feedbacks.map((f) => ({
        ...f.toObject(),
        reviewer: f.isAnonymous ? null : f.reviewer,
      })),
      averageRatings,
      totalFeedbacks: count,
    })
  } catch (error) {
    console.error("Error getting user feedback:", error)
    res.status(500).json({ success: false, message: "Error getting user feedback" })
  }
}

// Get projects available for feedback
exports.getProjectsForFeedback = async (req, res) => {
  try {
    // Find completed projects where user was a member
    const projects = await Project.find({
      status: "completed",
      $or: [{ creator: req.user._id }, { "currentMembers.user": req.user._id }],
    })
      .populate("creator", "name department")
      .populate("currentMembers.user", "name department")
      .sort({ updatedAt: -1 })

    // For each project, get team members and check if feedback was already given
    const projectsWithFeedbackStatus = await Promise.all(
      projects.map(async (project) => {
        const teamMembers = [
          { user: project.creator, role: "creator" },
          ...project.currentMembers.filter((member) => member.user._id.toString() !== req.user._id.toString()),
        ]

        // Check feedback status for each member
        const membersWithFeedbackStatus = await Promise.all(
          teamMembers.map(async (member) => {
            if (member.user._id.toString() === req.user._id.toString()) {
              return null // Skip self
            }

            const existingFeedback = await ProjectFeedback.findOne({
              project: project._id,
              reviewer: req.user._id,
              reviewee: member.user._id,
            })

            return {
              ...member.user.toObject(),
              role: member.role,
              feedbackGiven: !!existingFeedback,
            }
          }),
        )

        return {
          ...project.toObject(),
          teamMembers: membersWithFeedbackStatus.filter((m) => m !== null),
        }
      }),
    )

    res.json({ success: true, projects: projectsWithFeedbackStatus })
  } catch (error) {
    console.error("Error getting projects for feedback:", error)
    res.status(500).json({ success: false, message: "Error getting projects for feedback" })
  }
}
