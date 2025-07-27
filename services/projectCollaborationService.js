/**
 * Project Collaboration Service - Enhanced with Invitation System
 *
 * Service for managing project collaboration features including:
 * - Skill matching
 * - Interest similarity calculation
 * - Feedback aggregation
 * - Match score calculation
 * - Project invitations
 */

const SkillMatcher = require("../utils/skillMatcher")
const InterestSimilarityCalculator = require("../utils/interestSimilarityCalculator")
const FeedbackAggregator = require("../utils/feedbackAggregator")
const MatchScoreCalculator = require("../utils/matchScoreCalculator")
const ProjectInvitation = require("../models/projectInvitationSchema")

class ProjectCollaborationService {
  constructor() {
    this.skillMatcher = new SkillMatcher()
    this.interestCalculator = new InterestSimilarityCalculator()
    this.feedbackAggregator = new FeedbackAggregator()
    this.matchCalculator = new MatchScoreCalculator()
  }

  /**
   * Calculate match score between two users for a project
   */
  async calculateUserMatch(user1, user2, project) {
    return await this.matchCalculator.calculateMatchScore(user1, user2, project)
  }

  /**
   * Get skill compatibility between users
   */
  async getSkillMatch(user1, user2, project) {
    return await this.skillMatcher.calculateSkillMatch(user1, user2, project)
  }

  /**
   * Get interest similarity between users
   */
  async getInterestSimilarity(user1, user2) {
    return await this.interestCalculator.calculateInterestSimilarity(user1, user2)
  }

  /**
   * Get user's feedback score
   */
  async getUserFeedbackScore(userId, project = null) {
    return await this.feedbackAggregator.calculateUserScore(userId, project)
  }

  /**
   * Get top matches for a project
   */
  async getProjectMatches(project, potentialUsers, limit = 10) {
    return await this.matchCalculator.getTopMatches(project, potentialUsers, limit)
  }

  // ==================== INVITATION SYSTEM ====================

  /**
   * Send invitation to user
   */
  async sendInvitation(projectId, recipientId, senderId, message = "", matchScore = null, matchReasons = []) {
    try {
      // Check if invitation already exists
      const existingInvitation = await ProjectInvitation.invitationExists(projectId, senderId, recipientId)
      if (existingInvitation) {
        throw new Error("Invitation already sent to this user")
      }

      // Create new invitation
      const invitation = new ProjectInvitation({
        project: projectId,
        sender: senderId,
        recipient: recipientId,
        message: message,
        matchScore: matchScore,
        matchReasons: matchReasons,
        status: "pending",
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      })

      await invitation.save()

      // Populate project and sender info for response
      await invitation.populate([
        { path: "project", select: "title description category" },
        { path: "sender", select: "name email university" },
      ])

      return invitation
    } catch (error) {
      console.error("Error sending invitation:", error)
      throw error
    }
  }

  /**
   * Get user's invitations (received invitations)
   */
  async getUserInvitations(userId) {
    try {
      const invitations = await ProjectInvitation.findUserInvitations(userId)
      return invitations
    } catch (error) {
      console.error("Error getting user invitations:", error)
      return []
    }
  }

  /**
   * Get sent invitations (invitations user has sent)
   */
  async getSentInvitations(userId) {
    try {
      const invitations = await ProjectInvitation.find({ sender: userId })
        .populate([
          { path: "project", select: "title description category" },
          { path: "recipient", select: "name email university" },
        ])
        .sort({ createdAt: -1 })

      return invitations
    } catch (error) {
      console.error("Error getting sent invitations:", error)
      return []
    }
  }

  /**
   * Handle invitation response (accept/reject)
   */
  async handleInvitation(invitationId, action, userId, responseMessage = "") {
    try {
      const invitation = await ProjectInvitation.findById(invitationId).populate([
        { path: "project" },
        { path: "sender", select: "name email" },
        { path: "recipient", select: "name email" },
      ])

      if (!invitation) {
        throw new Error("Invitation not found")
      }

      // Verify user is the recipient
      if (invitation.recipient._id.toString() !== userId.toString()) {
        throw new Error("Unauthorized: You can only respond to your own invitations")
      }

      // Check if invitation is still pending
      if (invitation.status !== "pending") {
        throw new Error(`Invitation already ${invitation.status}`)
      }

      // Check if invitation has expired
      if (invitation.expiresAt && new Date() > invitation.expiresAt) {
        invitation.status = "expired"
        await invitation.save()
        throw new Error("Invitation has expired")
      }

      // Handle the response
      if (action === "accept") {
        await invitation.accept(responseMessage)

        // TODO: Add user to project members
        // This would require updating the project schema
        // project.members.push({ user: userId, role: 'member', joinedAt: new Date() })
      } else if (action === "reject") {
        await invitation.reject(responseMessage)
      } else {
        throw new Error("Invalid action. Must be 'accept' or 'reject'")
      }

      return invitation
    } catch (error) {
      console.error("Error handling invitation:", error)
      throw error
    }
  }

  /**
   * Get invitation by ID
   */
  async getInvitation(invitationId) {
    try {
      const invitation = await ProjectInvitation.findById(invitationId).populate([
        { path: "project", select: "title description category creator" },
        { path: "sender", select: "name email university" },
        { path: "recipient", select: "name email university" },
      ])

      return invitation
    } catch (error) {
      console.error("Error getting invitation:", error)
      return null
    }
  }

  /**
   * Cancel invitation (for senders)
   */
  async cancelInvitation(invitationId, senderId) {
    try {
      const invitation = await ProjectInvitation.findById(invitationId)

      if (!invitation) {
        throw new Error("Invitation not found")
      }

      // Verify user is the sender
      if (invitation.sender.toString() !== senderId.toString()) {
        throw new Error("Unauthorized: You can only cancel your own invitations")
      }

      // Can only cancel pending invitations
      if (invitation.status !== "pending") {
        throw new Error(`Cannot cancel ${invitation.status} invitation`)
      }

      invitation.status = "cancelled"
      invitation.respondedAt = new Date()
      await invitation.save()

      return invitation
    } catch (error) {
      console.error("Error cancelling invitation:", error)
      throw error
    }
  }

  /**
   * Mark invitation as viewed
   */
  async markInvitationViewed(invitationId, userId) {
    try {
      const invitation = await ProjectInvitation.findById(invitationId)

      if (!invitation) {
        throw new Error("Invitation not found")
      }

      // Only recipient can mark as viewed
      if (invitation.recipient.toString() !== userId.toString()) {
        throw new Error("Unauthorized")
      }

      if (!invitation.viewedAt) {
        invitation.viewedAt = new Date()
        await invitation.save()
      }

      return invitation
    } catch (error) {
      console.error("Error marking invitation as viewed:", error)
      throw error
    }
  }

  /**
   * Get invitation statistics for a project
   */
  async getProjectInvitationStats(projectId) {
    try {
      const stats = await ProjectInvitation.aggregate([
        { $match: { project: projectId } },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ])

      const result = {
        pending: 0,
        accepted: 0,
        rejected: 0,
        expired: 0,
        cancelled: 0,
      }

      stats.forEach((stat) => {
        result[stat._id] = stat.count
      })

      return result
    } catch (error) {
      console.error("Error getting invitation stats:", error)
      return { pending: 0, accepted: 0, rejected: 0, expired: 0, cancelled: 0 }
    }
  }
}

module.exports = new ProjectCollaborationService()
