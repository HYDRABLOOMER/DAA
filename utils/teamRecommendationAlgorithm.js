/**
 * Advanced team recommendation algorithm using vector-based similarity
 * Focuses on skills and interests compatibility for optimal team formation
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
 * Create skill vector from user skills and comparison skills
 */
function createSkillVector(userSkills = [], comparisonSkills = []) {
  const allSkills = [
    ...new Set([
      ...userSkills.map((s) => s.toLowerCase().trim()),
      ...comparisonSkills.map((s) => s.toLowerCase().trim()),
    ]),
  ]

  if (allSkills.length === 0) return { userVector: [], comparisonVector: [], allSkills: [] }

  const userVector = allSkills.map((skill) => (userSkills.some((us) => us.toLowerCase().trim() === skill) ? 1 : 0))

  const comparisonVector = allSkills.map((skill) =>
    comparisonSkills.some((cs) => cs.toLowerCase().trim() === skill) ? 1 : 0,
  )

  return { userVector, comparisonVector, allSkills }
}

/**
 * Calculate comprehensive compatibility score between two users
 */
function calculateTeamCompatibilityScore(currentUser, candidateUser) {
  try {
    // Validate inputs
    if (!currentUser || !candidateUser) return { overall: 0, skills: 0, interests: 0, breakdown: {} }

    // Skills matching using both Jaccard and Cosine similarity
    const skillsJaccard = calculateJaccardSimilarity(currentUser.skills || [], candidateUser.skills || [])

    const { userVector, comparisonVector } = createSkillVector(currentUser.skills || [], candidateUser.skills || [])

    const skillsCosine = calculateCosineSimilarity(userVector, comparisonVector)

    // Combined skills score (weighted average)
    const skillsScore = skillsJaccard * 0.6 + skillsCosine * 0.4

    // Interests matching using same approach
    const interestsJaccard = calculateJaccardSimilarity(currentUser.interests || [], candidateUser.interests || [])

    const { userVector: userInterestVector, comparisonVector: candidateInterestVector } = createSkillVector(
      currentUser.interests || [],
      candidateUser.interests || [],
    )

    const interestsCosine = calculateCosineSimilarity(userInterestVector, candidateInterestVector)

    // Combined interests score
    const interestsScore = interestsJaccard * 0.6 + interestsCosine * 0.4

    // University match bonus
    const universityBonus = currentUser.university === candidateUser.university ? 0.1 : 0

    // Department diversity bonus (different departments can be good for teams)
    const departmentDiversityBonus =
      currentUser.department && candidateUser.department && currentUser.department !== candidateUser.department
        ? 0.05
        : 0

    // Same department bonus (for some projects, same expertise is valuable)
    const departmentSimilarityBonus =
      currentUser.department && candidateUser.department && currentUser.department === candidateUser.department
        ? 0.03
        : 0

    // Composite score calculation (skills and interests weighted equally for team formation)
    const baseScore = skillsScore * 0.5 + interestsScore * 0.5
    const finalScore = Math.min(
      1,
      Math.max(0, baseScore + universityBonus + departmentDiversityBonus + departmentSimilarityBonus),
    )

    return {
      overall: Number(finalScore.toFixed(3)),
      skills: Number(skillsScore.toFixed(3)),
      interests: Number(interestsScore.toFixed(3)),
      breakdown: {
        skillsJaccard: Number(skillsJaccard.toFixed(3)),
        skillsCosine: Number(skillsCosine.toFixed(3)),
        interestsJaccard: Number(interestsJaccard.toFixed(3)),
        interestsCosine: Number(interestsCosine.toFixed(3)),
        universityMatch: currentUser.university === candidateUser.university,
        departmentDiversity: departmentDiversityBonus > 0,
        departmentSimilarity: departmentSimilarityBonus > 0,
        universityBonus,
        departmentDiversityBonus,
        departmentSimilarityBonus,
      },
    }
  } catch (error) {
    console.error("Error calculating compatibility score:", error)
    return { overall: 0, skills: 0, interests: 0, breakdown: {} }
  }
}

/**
 * Get intelligent team recommendations for a user
 */
async function getIntelligentTeamRecommendations(currentUser, allUsers, limit = 10) {
  try {
    if (!currentUser || !Array.isArray(allUsers)) return []

    const recommendations = allUsers
      .filter((user) => {
        // Filter out invalid users
        if (!user || !user._id) return false

        // Filter out current user
        if (user._id.toString() === currentUser._id.toString()) return false

        // Filter out existing friends
        if (currentUser.friends && currentUser.friends.some((friendId) => friendId.toString() === user._id.toString()))
          return false

        // Only same university (for now)
        if (user.university !== currentUser.university) return false

        return true
      })
      .map((user) => {
        const compatibilityScore = calculateTeamCompatibilityScore(currentUser, user)
        return {
          user,
          compatibilityScore,
          reasons: generateCompatibilityReasons(currentUser, user, compatibilityScore),
        }
      })
      .sort((a, b) => b.compatibilityScore.overall - a.compatibilityScore.overall)
      .slice(0, Math.max(1, limit))

    return recommendations
  } catch (error) {
    console.error("Error getting intelligent team recommendations:", error)
    return []
  }
}

/**
 * Generate human-readable reasons for the compatibility
 */
function generateCompatibilityReasons(currentUser, candidateUser, compatibilityScore) {
  const reasons = []

  try {
    if (compatibilityScore.skills > 0.7) {
      reasons.push("Excellent skill synergy")
    } else if (compatibilityScore.skills > 0.4) {
      reasons.push("Good skill compatibility")
    } else if (compatibilityScore.skills > 0.1) {
      reasons.push("Complementary skills")
    }

    if (compatibilityScore.interests > 0.6) {
      reasons.push("Strong shared interests")
    } else if (compatibilityScore.interests > 0.3) {
      reasons.push("Similar project interests")
    }

    if (compatibilityScore.breakdown && compatibilityScore.breakdown.universityMatch) {
      reasons.push("Same university")
    }

    if (compatibilityScore.breakdown && compatibilityScore.breakdown.departmentDiversity) {
      reasons.push("Diverse expertise")
    }

    if (compatibilityScore.breakdown && compatibilityScore.breakdown.departmentSimilarity) {
      reasons.push("Shared domain knowledge")
    }

    // Add specific skill/interest matches
    const sharedSkills = (currentUser.skills || []).filter((skill) =>
      (candidateUser.skills || []).some((cs) => cs.toLowerCase() === skill.toLowerCase()),
    )

    const sharedInterests = (currentUser.interests || []).filter((interest) =>
      (candidateUser.interests || []).some((ci) => ci.toLowerCase() === interest.toLowerCase()),
    )

    if (sharedSkills.length > 0) {
      reasons.push(`Shared skills: ${sharedSkills.slice(0, 2).join(", ")}`)
    }

    if (sharedInterests.length > 0) {
      reasons.push(`Common interests: ${sharedInterests.slice(0, 2).join(", ")}`)
    }

    if (reasons.length === 0) {
      reasons.push("Potential for collaboration")
    }

    return reasons.slice(0, 4) // Limit to 4 reasons for UI
  } catch (error) {
    console.error("Error generating compatibility reasons:", error)
    return ["Potential teammate"]
  }
}

module.exports = {
  calculateTeamCompatibilityScore,
  getIntelligentTeamRecommendations,
  calculateJaccardSimilarity,
  calculateCosineSimilarity,
  generateCompatibilityReasons,
  createSkillVector,
}
