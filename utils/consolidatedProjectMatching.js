/**
 * Consolidated Project Matching Algorithms
 * Combines logic from projectMatchingAlgorithm.js, skillMatcher.js, and matchScoreCalculator.js
 */

/**
 * Calculate Jaccard similarity between two arrays
 */
function calculateJaccardSimilarity(arr1 = [], arr2 = []) {
  if (!arr1.length || !arr2.length) return 0

  const set1 = new Set(arr1.map((item) => item.toLowerCase().trim()))
  const set2 = new Set(arr2.map((item) => item.toLowerCase().trim()))

  const intersection = [...set1].filter((x) => set2.has(x))
  const union = new Set([...set1, ...set2])

  return intersection.length / union.size
}

/**
 * Calculate cosine similarity between two arrays (converted to vectors)
 */
function calculateCosineSimilarity(arr1 = [], arr2 = []) {
  if (!arr1.length || !arr2.length) return 0

  // Create master list of all unique items
  const allItems = [
    ...new Set([...arr1.map((s) => s.toLowerCase().trim()), ...arr2.map((s) => s.toLowerCase().trim())]),
  ]

  // Convert to binary vectors
  const vec1 = allItems.map((item) => (arr1.some((a) => a.toLowerCase().trim() === item) ? 1 : 0))
  const vec2 = allItems.map((item) => (arr2.some((a) => a.toLowerCase().trim() === item) ? 1 : 0))

  // Calculate cosine similarity
  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i]
    normA += vec1[i] * vec1[i]
    normB += vec2[i] * vec2[i]
  }

  if (normA === 0 || normB === 0) return 0

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * Calculate skill similarity using combined Jaccard and Cosine similarity
 */
function calculateSkillSimilarity(userSkills = [], projectSkills = []) {
  const jaccardScore = calculateJaccardSimilarity(userSkills, projectSkills)
  const cosineScore = calculateCosineSimilarity(userSkills, projectSkills)

  // Weighted combination: 60% Jaccard, 40% Cosine
  return jaccardScore * 0.6 + cosineScore * 0.4
}

/**
 * Calculate interest similarity using Jaccard similarity
 */
function calculateInterestSimilarity(userInterests = [], projectInterests = []) {
  return calculateJaccardSimilarity(userInterests, projectInterests)
}

/**
 * Calculate university and department bonuses
 */
function calculateContextualBonuses(user, project) {
  let bonus = 0
  const breakdown = {
    universityMatch: false,
    departmentRelevance: false,
  }

  // University match bonus
  if (user.university && project.university && user.university === project.university) {
    bonus += 0.1
    breakdown.universityMatch = true
  }

  // Department relevance bonus (simplified logic)
  if (user.department && project.category) {
    const relevantDepartments = {
      "Computer Science": ["web development", "software", "app", "ai", "data"],
      Design: ["ui", "ux", "design", "graphics"],
      Business: ["marketing", "business", "startup", "finance"],
      Engineering: ["hardware", "iot", "robotics", "embedded"],
    }

    const userDept = user.department
    const projectCat = project.category?.toLowerCase() || project.title?.toLowerCase() || ""

    if (relevantDepartments[userDept]) {
      const isRelevant = relevantDepartments[userDept].some((keyword) => projectCat.includes(keyword))
      if (isRelevant) {
        bonus += 0.05
        breakdown.departmentRelevance = true
      }
    }
  }

  return { bonus, breakdown }
}

/**
 * Main function to calculate project match score
 */
function calculateProjectMatchScore(user, project, userFeedbackScore = 0.5) {
  try {
    // Extract skills from different possible field names
    const userSkills = user.skills || user.technicalSkills || []
    const projectSkills =
      project.requiredSkills || project.skills || project.skillRequirements?.map((req) => req.skill) || []

    // Extract interests
    const userInterests = user.interests || user.areasOfInterest || []
    const projectInterests = project.interests || project.categories || project.tags || []

    // Calculate similarity scores
    const skillScore = calculateSkillSimilarity(userSkills, projectSkills)
    const interestScore = calculateInterestSimilarity(userInterests, projectInterests)
    const feedbackScore = Math.max(0, Math.min(1, userFeedbackScore)) // Ensure 0-1 range

    // Calculate contextual bonuses
    const { bonus, breakdown } = calculateContextualBonuses(user, project)

    // Calculate base score with weights
    const baseScore = skillScore * 0.5 + interestScore * 0.3 + feedbackScore * 0.2

    // Add bonuses
    const finalScore = Math.min(1, Math.max(0, baseScore + bonus))

    return {
      overall: finalScore,
      skills: skillScore,
      interests: interestScore,
      feedback: feedbackScore,
      bonus: bonus,
      breakdown: breakdown,
    }
  } catch (error) {
    console.error("Error calculating project match score:", error)
    return {
      overall: 0,
      skills: 0,
      interests: 0,
      feedback: userFeedbackScore,
      bonus: 0,
      breakdown: {},
    }
  }
}

/**
 * Calculate team compatibility score between users
 */
function calculateTeamCompatibilityScore(user1, user2, project = null) {
  try {
    const skillSimilarity = calculateSkillSimilarity(user1.skills || [], user2.skills || [])

    const interestSimilarity = calculateInterestSimilarity(user1.interests || [], user2.interests || [])

    // Base compatibility
    let compatibility = skillSimilarity * 0.4 + interestSimilarity * 0.6

    // Project context bonus
    if (project) {
      const user1ProjectMatch = calculateProjectMatchScore(user1, project)
      const user2ProjectMatch = calculateProjectMatchScore(user2, project)

      // Bonus if both users are good matches for the project
      const projectAlignmentBonus = Math.min(user1ProjectMatch.overall, user2ProjectMatch.overall) * 0.2
      compatibility += projectAlignmentBonus
    }

    return Math.min(1, Math.max(0, compatibility))
  } catch (error) {
    console.error("Error calculating team compatibility:", error)
    return 0.5 // Default neutral compatibility
  }
}

/**
 * Batch calculate match scores for multiple users against a project
 */
function calculateBatchMatchScores(users, project, feedbackScores = {}) {
  return users
    .map((user) => {
      const userFeedback = feedbackScores[user._id] || 0.5
      const matchScore = calculateProjectMatchScore(user, project, userFeedback)

      return {
        user,
        score: matchScore,
        userId: user._id,
      }
    })
    .sort((a, b) => b.score.overall - a.score.overall)
}

module.exports = {
  calculateProjectMatchScore,
  calculateTeamCompatibilityScore,
  calculateSkillSimilarity,
  calculateInterestSimilarity,
  calculateJaccardSimilarity,
  calculateCosineSimilarity,
  calculateBatchMatchScores,
  calculateContextualBonuses,
}
