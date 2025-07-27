/**
 * Consolidated Recommendation Algorithms
 * Combines logic from recommendationAlgorithm.js, teamRecommendationAlgorithm.js, and findPotentialFriendsWithMetrics.js
 */

const { calculateProjectMatchScore, calculateTeamCompatibilityScore } = require("./consolidatedProjectMatching")

/**
 * Calculate Jaccard similarity between two arrays
 */
function calculateJaccardSimilarity(arr1 = [], arr2 = []) {
  if (!arr1.length && !arr2.length) return 0
  const set1 = new Set(arr1.map((item) => item.toLowerCase()))
  const set2 = new Set(arr2.map((item) => item.toLowerCase()))
  const intersection = [...set1].filter((x) => set2.has(x))
  const union = new Set([...arr1.map((item) => item.toLowerCase()), ...arr2.map((item) => item.toLowerCase())])
  return intersection.length / union.size
}

/**
 * Calculate Adamic/Adar index between two arrays of friend IDs
 */
async function calculateAdamicAdarIndex(user1FriendIds = [], user2FriendIds = [], getFriendsCount) {
  const set1 = new Set(user1FriendIds)
  const set2 = new Set(user2FriendIds)
  const mutualFriendIds = [...set1].filter((x) => set2.has(x))
  if (mutualFriendIds.length === 0) return 0

  let aaIndex = 0
  for (const friendId of mutualFriendIds) {
    const degree = await getFriendsCount(friendId)
    if (degree > 1) {
      aaIndex += 1 / Math.log(degree)
    }
  }
  return aaIndex
}

/**
 * Calculate department similarity score
 */
function calculateDeptScore(userDept, candidateDept) {
  return userDept === candidateDept ? 1 : 0
}

/**
 * Calculate skill similarity score using Jaccard index
 */
function calculateSkillSimilarity(userSkills = [], candidateSkills = []) {
  return calculateJaccardSimilarity(userSkills, candidateSkills)
}

/**
 * Calculate interest similarity score using Jaccard index
 */
function calculateInterestSimilarity(userInterests = [], candidateInterests = []) {
  return calculateJaccardSimilarity(userInterests, candidateInterests)
}

/**
 * Combines individual metrics into a composite similarity score
 */
function calculateCompositeSimilarity(
  { jaccard, adamicAdar, deptScore, skillSimilarity, interestSimilarity },
  weights = {
    jaccard: 0.3,
    adamic: 0.2,
    dept: 0.1,
    skills: 0.2,
    interests: 0.2,
  },
) {
  return (
    weights.jaccard * jaccard +
    weights.adamic * adamicAdar +
    weights.dept * deptScore +
    weights.skills * skillSimilarity +
    weights.interests * interestSimilarity
  )
}

/**
 * Find potential collaborators for a project
 */
async function findProjectCollaborators(project, availableUsers, options = {}) {
  const { limit = 10, minSkillMatch = 0.1, minOverallScore = 0.2, feedbackScores = {} } = options

  try {
    const recommendations = []

    for (const user of availableUsers) {
      const userFeedback = feedbackScores[user._id] || 0.5
      const matchScore = calculateProjectMatchScore(user, project, userFeedback)

      // Filter by minimum thresholds
      if (matchScore.overall >= minOverallScore && matchScore.skills >= minSkillMatch) {
        recommendations.push({
          user,
          score: matchScore,
          reasons: generateRecommendationReasons(user, project, matchScore),
        })
      }
    }

    // Sort by overall score and return top matches
    recommendations.sort((a, b) => b.score.overall - a.score.overall)
    return recommendations.slice(0, limit)
  } catch (error) {
    console.error("Error finding project collaborators:", error)
    return []
  }
}

/**
 * Find potential friends/connections for a user
 */
async function findPotentialFriends(targetUser, allUsers, options = {}) {
  const { limit = 10, minSimilarity = 0.3, sameUniversityBonus = 0.1, feedbackScores = {} } = options

  try {
    const friendRecommendations = []

    for (const user of allUsers) {
      if (user._id.toString() === targetUser._id.toString()) continue

      // Calculate similarity
      const skillSimilarity = calculateSkillSimilarity(targetUser.skills || [], user.skills || [])

      const interestSimilarity = calculateInterestSimilarity(targetUser.interests || [], user.interests || [])

      let overallSimilarity = skillSimilarity * 0.4 + interestSimilarity * 0.6

      // University bonus
      if (targetUser.university === user.university) {
        overallSimilarity += sameUniversityBonus
      }

      // Feedback bonus
      const userFeedback = feedbackScores[user._id] || 0.5
      overallSimilarity += (userFeedback - 0.5) * 0.2 // Adjust based on feedback

      overallSimilarity = Math.min(1, Math.max(0, overallSimilarity))

      if (overallSimilarity >= minSimilarity) {
        friendRecommendations.push({
          user,
          similarity: overallSimilarity,
          breakdown: {
            skills: skillSimilarity,
            interests: interestSimilarity,
            feedback: userFeedback,
            sameUniversity: targetUser.university === user.university,
          },
          reasons: generateFriendRecommendationReasons(targetUser, user, {
            skills: skillSimilarity,
            interests: interestSimilarity,
            sameUniversity: targetUser.university === user.university,
          }),
        })
      }
    }

    // Sort by similarity and return top matches
    friendRecommendations.sort((a, b) => b.similarity - a.similarity)
    return friendRecommendations.slice(0, limit)
  } catch (error) {
    console.error("Error finding potential friends:", error)
    return []
  }
}

/**
 * Recommend optimal team composition for a project
 */
function recommendTeamComposition(project, availableUsers, options = {}) {
  const { maxTeamSize = project.maxMembers || 5, diversityWeight = 0.3, skillCoverageWeight = 0.7 } = options

  try {
    // Get individual match scores
    const userScores = availableUsers.map((user) => ({
      user,
      score: calculateProjectMatchScore(user, project),
      skills: user.skills || [],
    }))

    // Sort by individual scores
    userScores.sort((a, b) => b.score.overall - a.score.overall)

    const recommendedTeam = []
    const coveredSkills = new Set()
    const requiredSkills = new Set((project.requiredSkills || project.skills || []).map((s) => s.toLowerCase()))

    // Greedy selection algorithm
    for (const candidate of userScores) {
      if (recommendedTeam.length >= maxTeamSize) break

      // Calculate value of adding this user
      const newSkills = candidate.skills.filter((skill) => !coveredSkills.has(skill.toLowerCase()))

      const skillCoverageValue = newSkills.length / Math.max(1, requiredSkills.size)
      const individualValue = candidate.score.overall

      // Team compatibility check
      let teamCompatibility = 1
      if (recommendedTeam.length > 0) {
        const compatibilityScores = recommendedTeam.map((member) =>
          calculateTeamCompatibilityScore(candidate.user, member.user, project),
        )
        teamCompatibility = compatibilityScores.reduce((sum, score) => sum + score, 0) / compatibilityScores.length
      }

      const totalValue =
        skillCoverageValue * skillCoverageWeight +
        individualValue * (1 - skillCoverageWeight) +
        teamCompatibility * diversityWeight

      // Add to team if value is high enough
      if (totalValue > 0.4 || recommendedTeam.length === 0) {
        recommendedTeam.push({
          ...candidate,
          teamValue: totalValue,
          newSkillsAdded: newSkills,
          teamCompatibility,
        })

        // Update covered skills
        candidate.skills.forEach((skill) => coveredSkills.add(skill.toLowerCase()))
      }
    }

    return {
      recommendedTeam,
      teamSize: recommendedTeam.length,
      skillCoverage: coveredSkills.size / Math.max(1, requiredSkills.size),
      averageCompatibility:
        recommendedTeam.length > 1
          ? recommendedTeam.reduce((sum, member) => sum + member.teamCompatibility, 0) / recommendedTeam.length
          : 1,
    }
  } catch (error) {
    console.error("Error recommending team composition:", error)
    return {
      recommendedTeam: [],
      teamSize: 0,
      skillCoverage: 0,
      averageCompatibility: 0,
    }
  }
}

/**
 * Generate human-readable reasons for project recommendations
 */
function generateRecommendationReasons(user, project, matchScore) {
  const reasons = []

  if (matchScore.skills > 0.7) {
    reasons.push("Excellent skill match")
  } else if (matchScore.skills > 0.4) {
    reasons.push("Good skill compatibility")
  } else if (matchScore.skills > 0.1) {
    reasons.push("Some relevant skills")
  }

  if (matchScore.interests > 0.5) {
    reasons.push("Strong interest alignment")
  } else if (matchScore.interests > 0.2) {
    reasons.push("Shared interests")
  }

  if (matchScore.feedback > 0.7) {
    reasons.push("Excellent collaboration history")
  } else if (matchScore.feedback > 0.6) {
    reasons.push("Good peer ratings")
  }

  if (matchScore.breakdown?.universityMatch) {
    reasons.push("Same university")
  }

  if (matchScore.breakdown?.departmentRelevance) {
    reasons.push("Relevant academic background")
  }

  if (reasons.length === 0) {
    reasons.push("Potential for growth and learning")
  }

  return reasons
}

/**
 * Generate reasons for friend recommendations
 */
function generateFriendRecommendationReasons(user1, user2, breakdown) {
  const reasons = []

  if (breakdown.skills > 0.6) {
    reasons.push("Similar technical skills")
  } else if (breakdown.skills > 0.3) {
    reasons.push("Complementary skills")
  }

  if (breakdown.interests > 0.5) {
    reasons.push("Shared interests and passions")
  }

  if (breakdown.sameUniversity) {
    reasons.push("Same university - easy to meet")
  }

  if (breakdown.feedback > 0.7) {
    reasons.push("Highly rated collaborator")
  }

  if (reasons.length === 0) {
    reasons.push("Potential for meaningful connection")
  }

  return reasons
}

// Helper functions (imported from consolidatedProjectMatching)
const {} = require("./consolidatedProjectMatching")

module.exports = {
  calculateJaccardSimilarity,
  calculateAdamicAdarIndex,
  calculateDeptScore,
  calculateSkillSimilarity,
  calculateInterestSimilarity,
  calculateCompositeSimilarity,
  findProjectCollaborators,
  findPotentialFriends,
  recommendTeamComposition,
  generateRecommendationReasons,
  generateFriendRecommendationReasons,
}
