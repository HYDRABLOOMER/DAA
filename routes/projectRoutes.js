const express = require("express")
const router = express.Router()
const projectController = require("../controllers/projectController")
const { isAuthenticated } = require("../middleware/auth")

// IMPORTANT: Specific routes MUST come BEFORE generic routes with parameters

// Specific routes first (these must be before /:id routes)
router.get("/projects/recommendations", isAuthenticated, projectController.getRecommendations)
router.get("/projects/my", isAuthenticated, projectController.getUserProjects)
router.get("/projects/invitations", isAuthenticated, projectController.getUserInvitations)
router.post("/projects/send-invitation", isAuthenticated, projectController.sendInvitation)
router.post("/projects/handle-invitation", isAuthenticated, projectController.handleInvitation)
router.post("/projects/apply", isAuthenticated, projectController.applyToProject)
router.post("/projects/applications/handle", isAuthenticated, projectController.handleApplication)
router.put("/projects/status", isAuthenticated, projectController.updateProjectStatus)

// Generic routes with parameters (these must come AFTER specific routes)
router.get("/projects/:id/user-recommendations", isAuthenticated, async (req, res) => {
  try {
    const { id: projectId } = req.params
    const limit = Number.parseInt(req.query.limit) || 10

    // Use the existing matchmaking service
    const MatchmakingService = require("../services/matchmakingService")
    const result = await MatchmakingService.findProjectMatches(projectId, limit)

    if (!result.success) {
      return res.status(404).json(result)
    }

    // Format response to match frontend expectations
    const recommendations = result.matches.map((match) => ({
      user: match.user,
      matchScore: {
        overall: match.score.overall || match.score,
        skills: match.score.skills || 0,
        interests: match.score.interests || 0,
        feedback: match.score.feedback || 0.5,
      },
      reasons: match.reasons || [],
    }))

    res.json({
      success: true,
      recommendations,
      count: recommendations.length,
    })
  } catch (error) {
    console.error("Error getting user recommendations:", error)
    res.status(500).json({
      success: false,
      message: "Failed to get user recommendations",
      error: error.message,
    })
  }
})

router.get("/projects/:id", isAuthenticated, projectController.getProject)
router.get("/projects", isAuthenticated, projectController.getProjects)
router.post("/projects", isAuthenticated, projectController.createProject)

module.exports = router
