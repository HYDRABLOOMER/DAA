const express = require("express")
const router = express.Router()
const feedbackController = require("../controllers/feedbackController")
const { isAuthenticated } = require("../middleware/auth")

// Feedback routes
router.post("/feedback", isAuthenticated, feedbackController.submitFeedback)
router.get("/feedback/user/:userId?", isAuthenticated, feedbackController.getUserFeedback)
router.get("/feedback/projects", isAuthenticated, feedbackController.getProjectsForFeedback)

module.exports = router
