/**
 * Consolidated Compatibility Calculator
 * Merges functionality from skillMatcher.js and interestSimilarityCalculator.js
 */

const Skill = require("../models/skillSchema")
const Interest = require("../models/interestSchema")

class CompatibilityCalculator {
  constructor() {
    this.categoryWeights = {
      Technical: 0.3,
      Design: 0.25,
      Business: 0.2,
      "Soft Skills": 0.15,
      Hobbies: 0.1,
    }
  }

  /**
   * Calculate overall compatibility between two users
   */
  async calculateOverallCompatibility(user1, user2, project = null) {
    try {
      const skillCompatibility = await this.calculateSkillCompatibility(user1, user2, project)
      const interestCompatibility = await this.calculateInterestCompatibility(user1, user2)

      // Weighted average
      return skillCompatibility * 0.6 + interestCompatibility * 0.4
    } catch (error) {
      console.error("Error calculating overall compatibility:", error)
      return 0
    }
  }

  /**
   * Calculate skill compatibility between two users
   */
  async calculateSkillCompatibility(user1, user2, project = null) {
    try {
      const user1Skills = await Skill.findByUser(user1._id)
      const user2Skills = await Skill.findByUser(user2._id)

      if (!user1Skills.length || !user2Skills.length) return 0

      // Calculate skill overlap
      const skillOverlap = this.calculateSkillOverlap(user1Skills, user2Skills)

      // Calculate complementary skills
      const complementaryScore = this.calculateComplementarySkills(user1Skills, user2Skills, project)

      // Calculate proficiency alignment
      const proficiencyAlignment = this.calculateProficiencyAlignment(user1Skills, user2Skills)

      // Weighted combination
      return skillOverlap * 0.4 + complementaryScore * 0.4 + proficiencyAlignment * 0.2
    } catch (error) {
      console.error("Error calculating skill compatibility:", error)
      return 0
    }
  }

  /**
   * Calculate interest compatibility between two users
   */
  async calculateInterestCompatibility(user1, user2) {
    try {
      const user1Interests = await Interest.findByUser(user1._id)
      const user2Interests = await Interest.findByUser(user2._id)

      if (!user1Interests.length || !user2Interests.length) return 0

      const overallSimilarity = this.calculateOverallSimilarity(user1Interests, user2Interests)
      const categorySimilarity = await this.calculateCategorySimilarity(user1Interests, user2Interests)
      const intensitySimilarity = this.calculateIntensitySimilarity(user1Interests, user2Interests)

      return overallSimilarity * 0.5 + categorySimilarity * 0.3 + intensitySimilarity * 0.2
    } catch (error) {
      console.error("Error calculating interest compatibility:", error)
      return 0
    }
  }

  /**
   * Calculate skill overlap between two users
   */
  calculateSkillOverlap(skills1, skills2) {
    const skillNames1 = skills1.map((s) => s.skill.toLowerCase())
    const skillNames2 = skills2.map((s) => s.skill.toLowerCase())

    const intersection = skillNames1.filter((skill) => skillNames2.includes(skill))
    const union = [...new Set([...skillNames1, ...skillNames2])]

    return union.length > 0 ? intersection.length / union.length : 0
  }

  /**
   * Calculate complementary skills score
   */
  calculateComplementarySkills(skills1, skills2, project = null) {
    if (!project || !project.requiredSkills) return 0

    const requiredSkills = project.requiredSkills.map((s) => s.toLowerCase())
    const user1Skills = skills1.map((s) => s.skill.toLowerCase())
    const user2Skills = skills2.map((s) => s.skill.toLowerCase())

    const combinedSkills = [...new Set([...user1Skills, ...user2Skills])]
    const coveredSkills = requiredSkills.filter((skill) => combinedSkills.includes(skill))

    return requiredSkills.length > 0 ? coveredSkills.length / requiredSkills.length : 0
  }

  /**
   * Calculate proficiency alignment
   */
  calculateProficiencyAlignment(skills1, skills2) {
    const commonSkills = this.findCommonSkills(skills1, skills2)

    if (!commonSkills.length) return 0

    const totalAlignment = commonSkills.reduce((sum, pair) => {
      const proficiencyDiff = Math.abs(
        this.getProficiencyValue(pair.skill1.proficiency) - this.getProficiencyValue(pair.skill2.proficiency),
      )
      return sum + (1 - proficiencyDiff / 4) // Normalize to 0-1
    }, 0)

    return totalAlignment / commonSkills.length
  }

  /**
   * Find common skills between two users
   */
  findCommonSkills(skills1, skills2) {
    const commonSkills = []

    skills1.forEach((skill1) => {
      const matchingSkill = skills2.find((skill2) => skill1.skill.toLowerCase() === skill2.skill.toLowerCase())

      if (matchingSkill) {
        commonSkills.push({ skill1, skill2: matchingSkill })
      }
    })

    return commonSkills
  }

  /**
   * Convert proficiency level to numeric value
   */
  getProficiencyValue(proficiency) {
    const levels = {
      Beginner: 1,
      Intermediate: 2,
      Advanced: 3,
      Expert: 4,
    }
    return levels[proficiency] || 1
  }

  /**
   * Calculate overall interest similarity
   */
  calculateOverallSimilarity(interests1, interests2) {
    const commonInterests = this.findCommonInterests(interests1, interests2)

    if (!commonInterests.length) return 0

    const totalSimilarity = commonInterests.reduce((sum, pair) => {
      return sum + pair.interest1.calculateSimilarity(pair.interest2)
    }, 0)

    return totalSimilarity / commonInterests.length
  }

  /**
   * Calculate category-based similarity
   */
  async calculateCategorySimilarity(interests1, interests2) {
    const categoryMap = new Map()

    interests1.forEach((interest) => {
      if (!categoryMap.has(interest.category)) {
        categoryMap.set(interest.category, { count1: 0, count2: 0 })
      }
      categoryMap.get(interest.category).count1++
    })

    interests2.forEach((interest) => {
      if (!categoryMap.has(interest.category)) {
        categoryMap.set(interest.category, { count1: 0, count2: 0 })
      }
      categoryMap.get(interest.category).count2++
    })

    let totalScore = 0
    let totalWeight = 0

    for (const [category, counts] of categoryMap.entries()) {
      const weight = this.categoryWeights[category] || 0.1
      const similarity = 1 - Math.abs(counts.count1 - counts.count2) / Math.max(counts.count1, counts.count2, 1)

      totalScore += similarity * weight
      totalWeight += weight
    }

    return totalScore / totalWeight
  }

  /**
   * Calculate intensity-based similarity
   */
  calculateIntensitySimilarity(interests1, interests2) {
    const commonInterests = this.findCommonInterests(interests1, interests2)

    if (!commonInterests.length) return 0

    const totalIntensityDiff = commonInterests.reduce((sum, pair) => {
      return sum + Math.abs(pair.interest1.intensity - pair.interest2.intensity)
    }, 0)

    return 1 - totalIntensityDiff / (commonInterests.length * 4)
  }

  /**
   * Find common interests between two users
   */
  findCommonInterests(interests1, interests2) {
    const interestMap = new Map()

    interests1.forEach((interest) => {
      interestMap.set(interest.name, {
        interest1: interest,
        interest2: null,
      })
    })

    interests2.forEach((interest) => {
      if (interestMap.has(interest.name)) {
        interestMap.get(interest.name).interest2 = interest
      } else {
        interestMap.set(interest.name, {
          interest1: null,
          interest2: interest,
        })
      }
    })

    return Array.from(interestMap.values()).filter((pair) => pair.interest1 && pair.interest2)
  }
}

module.exports = CompatibilityCalculator
