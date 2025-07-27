/**
 * Project Collaboration Module - Main Export
 *
 * This module consolidates all project collaboration functionality
 * Previously located in features/project_collaboration/index.js
 */

const ProjectCollaborationService = require("../services/projectCollaborationService")
const FeedbackService = require("../services/feedbackService")
const MatchmakingService = require("../services/matchmakingService")
const SkillManagementService = require("../services/skillManagementService")

const SkillMatcher = require("../utils/skillMatcher")
const InterestSimilarityCalculator = require("../utils/interestSimilarityCalculator")
const FeedbackAggregator = require("../utils/feedbackAggregator")
const MatchScoreCalculator = require("../utils/matchScoreCalculator")

module.exports = {
  // Services
  ProjectCollaborationService,
  FeedbackService,
  MatchmakingService,
  SkillManagementService,

  // Algorithms/Utilities
  SkillMatcher,
  InterestSimilarityCalculator,
  FeedbackAggregator,
  MatchScoreCalculator,

  // Main functions
  async calculateUserMatch(user1, user2, project) {
    return await ProjectCollaborationService.calculateUserMatch(user1, user2, project)
  },

  async getProjectMatches(project, potentialUsers, limit = 10) {
    return await ProjectCollaborationService.getProjectMatches(project, potentialUsers, limit)
  },

  async getSkillMatch(user1, user2, project) {
    return await ProjectCollaborationService.getSkillMatch(user1, user2, project)
  },

  async getInterestSimilarity(user1, user2) {
    return await ProjectCollaborationService.getInterestSimilarity(user1, user2)
  },

  async getUserFeedbackScore(userId, project = null) {
    return await ProjectCollaborationService.getUserFeedbackScore(userId, project)
  },

  // Skill management
  async addSkill(userId, skillData) {
    return await SkillManagementService.addSkill(userId, skillData)
  },

  async endorseSkill(skillId, endorserId, message) {
    return await SkillManagementService.endorseSkill(skillId, endorserId, message)
  },

  // Feedback management
  async createFeedback(fromUserId, toUserId, projectId, feedbackData) {
    return await FeedbackService.createFeedback(fromUserId, toUserId, projectId, feedbackData)
  },

  async getUserFeedback(userId) {
    return await FeedbackService.getUserFeedback(userId)
  },
}
