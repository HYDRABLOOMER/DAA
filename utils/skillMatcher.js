const Skill = require("../models/skillSchema")

/**
 * SkillMatcher - Calculates skill compatibility between users
 */
class SkillMatcher {
  constructor() {
    this.proficiencyWeights = {
      Beginner: 1,
      Intermediate: 2,
      Advanced: 3,
      Expert: 4,
    }
  }

  /**
   * Calculate skill compatibility score between two users
   * @param {Object} user1 - First user's skills
   * @param {Object} user2 - Second user's skills
   * @param {Object} project - Project requirements
   * @returns {Promise<number>} - Skill compatibility score (0-1)
   */
  async calculateSkillMatch(user1, user2, project) {
    try {
      // Get skills for both users
      const user1Skills = await Skill.findByUser(user1._id)
      const user2Skills = await Skill.findByUser(user2._id)

      // Get required skills for the project
      const requiredSkills = project.requiredSkills || []

      // Calculate skill overlap
      const commonSkills = this.findCommonSkills(user1Skills, user2Skills)

      // Calculate proficiency scores
      const proficiencyScore = this.calculateProficiencyScore(commonSkills)

      // Calculate required skill match
      const requiredSkillMatch = this.calculateRequiredSkillMatch(user1Skills, user2Skills, requiredSkills)

      // Calculate skill diversity
      const skillDiversity = this.calculateSkillDiversity(user1Skills, user2Skills)

      // Weighted average of all factors
      return commonSkills.length * 0.4 + proficiencyScore * 0.3 + requiredSkillMatch * 0.2 + skillDiversity * 0.1
    } catch (error) {
      console.error("Error calculating skill match:", error)
      return 0
    }
  }

  /**
   * Find common skills between two users
   * @param {Array} skills1 - First user's skills
   * @param {Array} skills2 - Second user's skills
   * @returns {Array} - Array of common skills
   */
  findCommonSkills(skills1, skills2) {
    const skillMap = new Map()

    // Add all skills from first user
    skills1.forEach((skill) => {
      skillMap.set(skill.name, {
        user1: skill,
        user2: null,
      })
    })

    // Add matching skills from second user
    skills2.forEach((skill) => {
      if (skillMap.has(skill.name)) {
        skillMap.get(skill.name).user2 = skill
      } else {
        skillMap.set(skill.name, {
          user1: null,
          user2: skill,
        })
      }
    })

    return Array.from(skillMap.values()).filter((pair) => pair.user1 && pair.user2)
  }

  /**
   * Calculate proficiency score for common skills
   * @param {Array} commonSkills - Array of common skills
   * @returns {number} - Proficiency score (0-1)
   */
  calculateProficiencyScore(commonSkills) {
    if (!commonSkills.length) return 0

    const totalScore = commonSkills.reduce((sum, pair) => {
      const prof1 = this.proficiencyWeights[pair.user1.proficiency]
      const prof2 = this.proficiencyWeights[pair.user2.proficiency]
      return sum + (prof1 + prof2) / 2
    }, 0)

    return totalScore / (commonSkills.length * 4) // Normalize to 0-1
  }

  /**
   * Calculate how well users match project requirements
   * @param {Array} user1Skills - First user's skills
   * @param {Array} user2Skills - Second user's skills
   * @param {Array} requiredSkills - Project's required skills
   * @returns {number} - Required skill match score (0-1)
   */
  calculateRequiredSkillMatch(user1Skills, user2Skills, requiredSkills) {
    if (!requiredSkills.length) return 1

    const user1Map = new Map(user1Skills.map((skill) => [skill.name, skill]))
    const user2Map = new Map(user2Skills.map((skill) => [skill.name, skill]))

    let matchCount = 0
    let requiredCount = 0

    requiredSkills.forEach((req) => {
      if (req.required) {
        requiredCount++

        if (
          (user1Map.has(req.name) &&
            this.proficiencyWeights[user1Map.get(req.name).proficiency] >= this.proficiencyWeights[req.proficiency]) ||
          (user2Map.has(req.name) &&
            this.proficiencyWeights[user2Map.get(req.name).proficiency] >= this.proficiencyWeights[req.proficiency])
        ) {
          matchCount++
        }
      }
    })

    return requiredCount ? matchCount / requiredCount : 1
  }

  /**
   * Calculate skill diversity between users
   * @param {Array} skills1 - First user's skills
   * @param {Array} skills2 - Second user's skills
   * @returns {number} - Skill diversity score (0-1)
   */
  calculateSkillDiversity(skills1, skills2) {
    const allSkills = new Set([...skills1, ...skills2].map((skill) => skill.name))
    const commonSkills = this.findCommonSkills(skills1, skills2)

    return 1 - commonSkills.length / allSkills.size
  }
}

module.exports = SkillMatcher
