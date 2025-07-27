/**
 * Advanced project matching algorithm using vector-based similarity
 * Integrates skills, interests, and peer feedback for optimal team formation
 */

/**
 * Calculate Jaccard similarity between two arrays
 */
function calculateJaccardSimilarity(arr1 = [], arr2 = []) {
  if (!Array.isArray(arr1) || !Array.isArray(arr2)) return 0
  if (!arr1.length && !arr2.length) return 0
  if (!arr1.length || !arr2.length) return 0

  const set1 = new Set(arr1.map((item) => item.toLowerCase().trim()))
  const set2 = new Set(arr2.map((item) => item.toLowerCase().trim()))

  const intersection = [...set1].filter((x) => set2.has(x))
  const union = new Set([...set1, ...set2])

  return union.size > 0 ? intersection.length / union.size : 0
}

/**
 * Calculate cosine similarity between two vectors
 */
function calculateCosineSimilarity(vecA, vecB) {
  if (!Array.isArray(vecA) || !Array.isArray(vecB)) return 0
  if (vecA.length !== vecB.length || vecA.length === 0) return 0

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i]
    normA += vecA[i] * vecA[i]
    normB += vecB[i] * vecB[i]
  }

  if (normA === 0 || normB === 0) return 0

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * Create skill vector from user skills and project requirements
 */
function createSkillVector(userSkills = [], projectSkills = []) {
  const allSkills = [
    ...new Set([...userSkills.map((s) => s.toLowerCase().trim()), ...projectSkills.map((s) => s.toLowerCase().trim())]),
  ]

  if (allSkills.length === 0) return { userVector: [], projectVector: [], allSkills: [] }

  const userVector = allSkills.map((skill) => (userSkills.some((us) => us.toLowerCase().trim() === skill) ? 1 : 0))

  const projectVector = allSkills.map((skill) =>
    projectSkills.some((ps) => ps.toLowerCase().trim() === skill) ? 1 : 0,
  )

  return { userVector, projectVector, allSkills }
}

/**
 * Calculate comprehensive match score between user and project
 */
function calculateProjectMatchScore(user, project, userFeedbackScore = 0.5) {
  try {
    // Validate inputs
    if (!user || !project) return { overall: 0, skills: 0, interests: 0, feedback: 0 }

    // Skills matching using both Jaccard and Cosine similarity
    const skillsJaccard = calculateJaccardSimilarity(user.skills || [], project.requiredSkills || [])

    const { userVector, projectVector } = createSkillVector(user.skills || [], project.requiredSkills || [])

    const skillsCosine = calculateCosineSimilarity(userVector, projectVector)

    // Combined skills score (weighted average)
    const skillsScore = skillsJaccard * 0.6 + skillsCosine * 0.4

    // Interests matching
    const interestsScore = calculateJaccardSimilarity(user.interests || [], project.preferredInterests || [])

    // University match bonus
    const universityBonus = user.university === project.university ? 0.1 : 0

    // Department relevance bonus
    const departmentBonus =
      user.department && project.category && user.department.toLowerCase().includes(project.category.toLowerCase())
        ? 0.05
        : 0

    // Normalize feedback score (0-1 range)
    const normalizedFeedbackScore = Math.max(0, Math.min(1, userFeedbackScore))

    // Composite score calculation
    const baseScore = skillsScore * 0.5 + interestsScore * 0.3 + normalizedFeedbackScore * 0.2
    const finalScore = Math.min(1, Math.max(0, baseScore + universityBonus + departmentBonus))

    return {
      overall: Number(finalScore.toFixed(3)),
      skills: Number(skillsScore.toFixed(3)),
      interests: Number(interestsScore.toFixed(3)),
      feedback: Number(normalizedFeedbackScore.toFixed(3)),
      breakdown: {
        skillsJaccard: Number(skillsJaccard.toFixed(3)),
        skillsCosine: Number(skillsCosine.toFixed(3)),
        universityMatch: user.university === project.university,
        departmentRelevance: departmentBonus > 0,
        universityBonus,
        departmentBonus,
      },
    }
  } catch (error) {
    console.error("Error calculating match score:", error)
    return { overall: 0, skills: 0, interests: 0, feedback: 0 }
  }
}

/**
 * Calculate user's average feedback score from past projects
 */
async function calculateUserFeedbackScore(userId, ProjectFeedback) {
  try {
    if (!userId || !ProjectFeedback) return 0.5

    const feedbacks = await ProjectFeedback.find({ reviewee: userId })

    if (feedbacks.length === 0) return 0.5 // Neutral score for new users

    let totalScore = 0
    let count = 0

    feedbacks.forEach((feedback) => {
      if (feedback.ratings) {
        const avgRating =
          ((feedback.ratings.technical || 0) +
            (feedback.ratings.communication || 0) +
            (feedback.ratings.teamwork || 0) +
            (feedback.ratings.reliability || 0)) /
          4

        totalScore += avgRating
        count++
      }
    })

    if (count === 0) return 0.5

    // Normalize to 0-1 scale (ratings are 1-5)
    const normalizedScore = (totalScore / count - 1) / 4
    return Math.max(0, Math.min(1, normalizedScore))
  } catch (error) {
    console.error("Error calculating feedback score:", error)
    return 0.5
  }
}

/**
 * Get project recommendations for a user
 */
async function getProjectRecommendations(user, projects, ProjectFeedback, limit = 10) {
  try {
    if (!user || !Array.isArray(projects)) return []

    const userFeedbackScore = await calculateUserFeedbackScore(user._id, ProjectFeedback)

    const recommendations = projects
      .filter((project) => {
        // Filter out invalid projects
        if (!project || !project._id) return false

        // Filter out user's own projects
        if (project.creator && project.creator.toString() === user._id.toString()) return false

        // Filter out projects user is already in
        if (
          project.currentMembers &&
          project.currentMembers.some((member) => member.user && member.user.toString() === user._id.toString())
        )
          return false

        // Only recruiting projects
        if (project.status !== "recruiting") return false

        // Not full projects
        if (project.currentMembers && project.currentMembers.length >= project.maxMembers) return false

        return true
      })
      .map((project) => {
        const matchScore = calculateProjectMatchScore(user, project, userFeedbackScore)
        return {
          project,
          matchScore,
          reasons: generateMatchReasons(user, project, matchScore),
        }
      })
      .sort((a, b) => b.matchScore.overall - a.matchScore.overall)
      .slice(0, Math.max(1, limit))

    return recommendations
  } catch (error) {
    console.error("Error getting recommendations:", error)
    return []
  }
}

/**
 * Generate human-readable reasons for the match
 */
function generateMatchReasons(user, project, matchScore) {
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

module.exports = {
  calculateProjectMatchScore,
  calculateUserFeedbackScore,
  getProjectRecommendations,
  calculateJaccardSimilarity,
  calculateCosineSimilarity,
  generateMatchReasons,
  createSkillVector,
}
