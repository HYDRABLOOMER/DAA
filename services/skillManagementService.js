const Skill = require("../models/skillSchema")
const User = require("../models/userSchema")

/**
 * Skill Management Service - Handles user skills and endorsements
 */
class SkillManagementService {
  /**
   * Add skill to user
   */
  async addSkill(userId, skillData) {
    try {
      const skill = new Skill({
        user: userId,
        ...skillData,
      })

      await skill.save()

      return {
        success: true,
        skill,
        message: "Skill added successfully",
      }
    } catch (error) {
      console.error("Error adding skill:", error)

      if (error.code === 11000) {
        return {
          success: false,
          message: "Skill already exists for this user",
        }
      }

      return {
        success: false,
        message: "Failed to add skill",
        error: error.message,
      }
    }
  }

  /**
   * Update user skill
   */
  async updateSkill(skillId, userId, updateData) {
    try {
      const skill = await Skill.findById(skillId)
      if (!skill) {
        return {
          success: false,
          message: "Skill not found",
        }
      }

      // Check if user owns this skill
      if (skill.user.toString() !== userId.toString()) {
        return {
          success: false,
          message: "Not authorized to update this skill",
        }
      }

      Object.assign(skill, updateData)
      await skill.save()

      return {
        success: true,
        skill,
        message: "Skill updated successfully",
      }
    } catch (error) {
      console.error("Error updating skill:", error)
      return {
        success: false,
        message: "Failed to update skill",
        error: error.message,
      }
    }
  }

  /**
   * Delete user skill
   */
  async deleteSkill(skillId, userId) {
    try {
      const skill = await Skill.findById(skillId)
      if (!skill) {
        return {
          success: false,
          message: "Skill not found",
        }
      }

      // Check if user owns this skill
      if (skill.user.toString() !== userId.toString()) {
        return {
          success: false,
          message: "Not authorized to delete this skill",
        }
      }

      await skill.deleteOne()

      return {
        success: true,
        message: "Skill deleted successfully",
      }
    } catch (error) {
      console.error("Error deleting skill:", error)
      return {
        success: false,
        message: "Failed to delete skill",
        error: error.message,
      }
    }
  }

  /**
   * Get user skills
   */
  async getUserSkills(userId) {
    try {
      const skills = await Skill.findByUser(userId)

      return {
        success: true,
        skills,
        count: skills.length,
      }
    } catch (error) {
      console.error("Error getting user skills:", error)
      return {
        success: false,
        message: "Failed to get user skills",
        error: error.message,
      }
    }
  }

  /**
   * Endorse user skill
   */
  async endorseSkill(skillId, endorserId, message = "") {
    try {
      const skill = await Skill.findById(skillId)
      if (!skill) {
        return {
          success: false,
          message: "Skill not found",
        }
      }

      // Check if user is trying to endorse their own skill
      if (skill.user.toString() === endorserId.toString()) {
        return {
          success: false,
          message: "Cannot endorse your own skill",
        }
      }

      // Check if user has already endorsed this skill
      const existingEndorsement = skill.endorsements.find(
        (endorsement) => endorsement.user.toString() === endorserId.toString(),
      )

      if (existingEndorsement) {
        return {
          success: false,
          message: "You have already endorsed this skill",
        }
      }

      await skill.addEndorsement(endorserId, message)

      return {
        success: true,
        skill,
        message: "Skill endorsed successfully",
      }
    } catch (error) {
      console.error("Error endorsing skill:", error)
      return {
        success: false,
        message: "Failed to endorse skill",
        error: error.message,
      }
    }
  }

  /**
   * Get skills by name
   */
  async getSkillsByName(skillName) {
    try {
      const skills = await Skill.findBySkillName(skillName)

      return {
        success: true,
        skills,
        count: skills.length,
      }
    } catch (error) {
      console.error("Error getting skills by name:", error)
      return {
        success: false,
        message: "Failed to get skills",
        error: error.message,
      }
    }
  }

  /**
   * Get top skills
   */
  async getTopSkills(limit = 10) {
    try {
      const topSkills = await Skill.getTopSkills(limit)

      return {
        success: true,
        skills: topSkills,
        count: topSkills.length,
      }
    } catch (error) {
      console.error("Error getting top skills:", error)
      return {
        success: false,
        message: "Failed to get top skills",
        error: error.message,
      }
    }
  }

  /**
   * Verify user skill
   */
  async verifySkill(skillId, verifierId) {
    try {
      const skill = await Skill.findById(skillId)
      if (!skill) {
        return {
          success: false,
          message: "Skill not found",
        }
      }

      // Check if user is trying to verify their own skill
      if (skill.user.toString() === verifierId.toString()) {
        return {
          success: false,
          message: "Cannot verify your own skill",
        }
      }

      skill.verified = true
      skill.verifiedBy = verifierId
      await skill.save()

      return {
        success: true,
        skill,
        message: "Skill verified successfully",
      }
    } catch (error) {
      console.error("Error verifying skill:", error)
      return {
        success: false,
        message: "Failed to verify skill",
        error: error.message,
      }
    }
  }
}

module.exports = new SkillManagementService()
