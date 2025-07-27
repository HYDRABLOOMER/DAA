const User = require("../models/userSchema")
const Project = require("../models/projectSchema")
const ProjectCollaboration = require("../models/projectCollaborationSchema")
const { calculateProjectMatchScore } = require("../utils/projectMatchingAlgorithm")
const { calculateTeamCompatibilityScore } = require("../utils/teamRecommendationAlgorithm")
const CompatibilityCalculator = require("../utils/compatibilityCalculator")

/**
 * Matchmaking Service - Handles project-user matching
 */
class MatchmakingService {
  constructor() {
    this.compatibilityCalculator = new CompatibilityCalculator()
  }

  /**
   * Find best matches for a project
   */
  async findProjectMatches(projectId, limit = 10) {
    try {
      const project = await Project.findById(projectId).populate("creator")
      if (!project) {
        return {
          success: false,
          message: "Project not found",
        }
      }

      // Get potential users (exclude current members and creator)
      const excludeUserIds = [project.creator._id]

      // Add current members to exclusion list
      if (project.currentMembers && project.currentMembers.length > 0) {
        project.currentMembers.forEach((member) => {
          if (member.user) {
            excludeUserIds.push(member.user)
          }
        })
      }

      // Find potential users from same university
      const potentialUsers = await User.find({
        _id: { $nin: excludeUserIds },
        university: project.university, // Match university
      }).select("name email university department skills interests profilePicture bio")

      if (potentialUsers.length === 0) {
        return {
          success: true,
          matches: [],
          count: 0,
        }
      }

      // Calculate match scores using existing algorithm
      const matches = []
      for (const user of potentialUsers) {
        // Calculate user's feedback score (default to 0.5 for now)
        const userFeedbackScore = 0.5 // TODO: Implement actual feedback calculation

        // Calculate match score
        const matchScore = calculateProjectMatchScore(user, project, userFeedbackScore)

        // Generate reasons for the match
        const reasons = this.generateMatchReasons(user, project, matchScore)

        matches.push({
          user: user,
          score: matchScore,
          reasons: reasons,
        })
      }

      // Sort by overall match score (descending)
      matches.sort((a, b) => b.score.overall - a.score.overall)

      // Return top matches
      const topMatches = matches.slice(0, limit)

      return {
        success: true,
        matches: topMatches,
        count: topMatches.length,
      }
    } catch (error) {
      console.error("Error finding project matches:", error)
      return {
        success: false,
        message: "Failed to find project matches",
        error: error.message,
      }
    }
  }

  /**
   * Find best projects for a user
   */
  async findUserMatches(userId, limit = 10) {
    try {
      const user = await User.findById(userId)
      if (!user) {
        return {
          success: false,
          message: "User not found",
        }
      }

      // Get available projects (recruiting status, same university, not already member)
      const projects = await Project.find({
        university: user.university,
        status: "recruiting",
        creator: { $ne: userId },
        "currentMembers.user": { $ne: userId },
      }).populate("creator")

      // Calculate match scores
      const matches = []
      for (const project of projects) {
        const score = await this.compatibilityCalculator.calculateMatchScore(user, project.creator, project)
        matches.push({
          project,
          score,
        })
      }

      // Sort by score and return top matches
      matches.sort((a, b) => b.score - a.score)

      return {
        success: true,
        matches: matches.slice(0, limit),
        count: Math.min(matches.length, limit),
      }
    } catch (error) {
      console.error("Error finding user matches:", error)
      return {
        success: false,
        message: "Failed to find user matches",
        error: error.message,
      }
    }
  }

  /**
   * Calculate compatibility between two users
   */
  async calculateUserCompatibility(userId1, userId2, projectId = null) {
    try {
      const user1 = await User.findById(userId1)
      const user2 = await User.findById(userId2)

      if (!user1 || !user2) {
        return {
          success: false,
          message: "One or both users not found",
        }
      }

      let project = null
      if (projectId) {
        project = await Project.findById(projectId)
      }

      const score = await this.compatibilityCalculator.calculateMatchScore(user1, user2, project)

      return {
        success: true,
        compatibility: {
          overall: score,
          users: {
            user1: { _id: user1._id, name: user1.name },
            user2: { _id: user2._id, name: user2.name },
          },
          project: project ? { _id: project._id, title: project.title } : null,
        },
      }
    } catch (error) {
      console.error("Error calculating user compatibility:", error)
      return {
        success: false,
        message: "Failed to calculate user compatibility",
        error: error.message,
      }
    }
  }

  /**
   * Get recommended team composition for a project
   */
  async getRecommendedTeamComposition(projectId) {
    try {
      const project = await Project.findById(projectId)
      if (!project) {
        return {
          success: false,
          message: "Project not found",
        }
      }

      const collaboration = await ProjectCollaboration.findByProject(projectId)
      if (!collaboration) {
        return {
          success: false,
          message: "Collaboration settings not found",
        }
      }

      // Analyze required skills and suggest team composition
      const skillRequirements = collaboration.skillRequirements
      const teamSize = project.maxMembers

      // Group skills by category and proficiency
      const skillCategories = {}
      skillRequirements.forEach((req) => {
        if (!skillCategories[req.skill]) {
          skillCategories[req.skill] = []
        }
        skillCategories[req.skill].push(req)
      })

      // Generate recommendations
      const recommendations = {
        totalMembers: teamSize,
        currentMembers: project.currentMembers.length,
        remainingSlots: teamSize - project.currentMembers.length,
        skillDistribution: skillCategories,
        suggestedRoles: this.generateRoleSuggestions(skillRequirements, teamSize),
      }

      return {
        success: true,
        recommendations,
      }
    } catch (error) {
      console.error("Error getting team composition:", error)
      return {
        success: false,
        message: "Failed to get team composition",
        error: error.message,
      }
    }
  }

  /**
   * Generate role suggestions based on skill requirements
   */
  generateRoleSuggestions(skillRequirements, teamSize) {
    const roles = []
    const skillGroups = {
      technical: ["JavaScript", "Python", "React", "Node.js", "Database", "API"],
      design: ["UI/UX", "Graphic Design", "Prototyping", "Figma"],
      business: ["Project Management", "Marketing", "Business Analysis"],
      other: [],
    }

    // Categorize skills
    skillRequirements.forEach((req) => {
      let categorized = false
      for (const [category, skills] of Object.entries(skillGroups)) {
        if (category !== "other" && skills.some((skill) => req.skill.toLowerCase().includes(skill.toLowerCase()))) {
          if (!roles.find((role) => role.category === category)) {
            roles.push({
              category,
              skills: [req.skill],
              proficiency: req.proficiency,
              required: req.required,
            })
          } else {
            roles.find((role) => role.category === category).skills.push(req.skill)
          }
          categorized = true
          break
        }
      }

      if (!categorized) {
        skillGroups.other.push(req.skill)
      }
    })

    // Add other skills as general role
    if (skillGroups.other.length > 0) {
      roles.push({
        category: "other",
        skills: skillGroups.other,
        proficiency: "Intermediate",
        required: false,
      })
    }

    return roles
  }

  // Add method to generate human-readable match reasons
  generateMatchReasons(user, project, matchScore) {
    const reasons = []

    try {
      if (matchScore.skills > 0.7) {
        reasons.push("Strong skill match")
      } else if (matchScore.skills > 0.4) {
        reasons.push("Good skill compatibility")
      } else if (matchScore.skills > 0.1) {
        reasons.push("Some relevant skills")
      }

      if (matchScore.interests > 0.5) {
        reasons.push("Shared interests")
      } else if (matchScore.interests > 0.2) {
        reasons.push("Similar interests")
      }

      if (matchScore.feedback > 0.7) {
        reasons.push("Excellent peer ratings")
      } else if (matchScore.feedback > 0.6) {
        reasons.push("Good collaboration history")
      }

      if (matchScore.breakdown && matchScore.breakdown.universityMatch) {
        reasons.push("Same university")
      }

      if (matchScore.breakdown && matchScore.breakdown.departmentRelevance) {
        reasons.push("Relevant department")
      }

      if (reasons.length === 0) {
        reasons.push("Potential for growth")
      }

      return reasons
    } catch (error) {
      console.error("Error generating match reasons:", error)
      return ["Potential match"]
    }
  }
}

module.exports = new MatchmakingService()
