/**
 * Friend Recommendation Algorithms - Consolidated Utility
 *
 * This module contains all the core algorithms for calculating similarity between users
 * and generating friend recommendations. Consolidated from the features directory.
 *
 * Algorithms included:
 * - Jaccard Similarity Coefficient
 * - Adamic/Adar Index
 * - Composite Similarity Scoring
 *
 * @module RecommendationAlgorithm
 */

/**
 * Friend Recommendation - Recommendation Algorithms
 *
 * Implements various algorithms for calculating similarity between users
 * and generating friend recommendations
 */

/**
 * Custom implementation of array intersection
 * Time Complexity: O(n*m) where n and m are the lengths of the arrays
 * Space Complexity: O(min(n,m)) for the result array
 */
const findIntersection = (arr1, arr2) => {
  // Native Set-based intersection
  const set2 = new Set(arr2)
  return [...new Set(arr1)].filter((x) => set2.has(x))
}

/**
 * Custom implementation of array union
 * Time Complexity: O(n+m) where n and m are the lengths of the arrays
 * Space Complexity: O(n+m) in the worst case
 */
const findUnion = (arr1, arr2) => {
  // Native Set-based union
  return [...new Set([...arr1, ...arr2])]
}

/**
 * Calculate Jaccard similarity coefficient between two users
 *
 * The Jaccard similarity coefficient measures the similarity between two users
 * based on their mutual friends. It is calculated as the size of the intersection
 * divided by the size of the union of their friend sets:
 *
 * J(A,B) = |A∩B| / |A∪B|
 *
 * This metric ranges from 0 (no mutual friends) to 1 (exactly the same friends).
 *
 * Example:
 * - User A has friends: [1, 2, 3, 4]
 * - User B has friends: [3, 4, 5, 6]
 * - Intersection: [3, 4] (2 mutual friends)
 * - Union: [1, 2, 3, 4, 5, 6] (6 unique friends)
 * - Jaccard similarity: 2/6 = 0.33
 *
 * Time Complexity: O(n+m) where n and m are the number of friends of each user
 * Space Complexity: O(n+m) for storing friend IDs and result sets
 *
 * @param {Array} userFriendIds - Array of friend IDs for first user
 * @param {Array} candidateFriendIds - Array of friend IDs for second user
 *
 * @returns {number} - Jaccard similarity coefficient (0-1)
 */
const calculateJaccardSimilarity = (userFriendIds, candidateFriendIds) => {
  try {
    if (!userFriendIds.length || !candidateFriendIds.length) return 0

    // Find intersection (mutual friends) using custom implementation
    const intersection = findIntersection(userFriendIds, candidateFriendIds)

    // Find union (all unique friends) using custom implementation
    const union = findUnion(userFriendIds, candidateFriendIds)

    // Calculate Jaccard coefficient
    return intersection.length / union.length
  } catch (error) {
    console.error("Error calculating Jaccard similarity:", error)
    return 0
  }
}

/**
 * Calculate Adamic/Adar index between two users
 *
 * The Adamic/Adar index measures the similarity between two users based on their mutual friends,
 * but gives more weight to mutual friends who have fewer connections. This is based on the
 * intuition that sharing a rare connection is more significant than sharing a common one.
 *
 * Formula: AA(A,B) = Σ(z∈A∩B) 1/log(deg(z))
 *
 * Where:
 * - A and B are the sets of friends for the two users
 * - z is a mutual friend
 * - deg(z) is the number of connections that mutual friend has
 *
 * Example:
 * - User A and B have mutual friends X, Y, Z
 * - X has 10 connections, Y has 5, Z has 100
 * - AA(A,B) = 1/log(10) + 1/log(5) + 1/log(100) = 0.43 + 0.62 + 0.2 = 1.25
 *
 * Time Complexity: O(n+m+k) where n and m are the friend counts and k is mutual friends
 * Space Complexity: O(n+m) for storing friend IDs and intermediate results
 *
 * @param {Array} userFriendIds - Array of friend IDs for first user
 * @param {Array} candidateFriendIds - Array of friend IDs for second user
 * @param {Function} getFriendsCount - Function to get friend count for a user
 *
 * @returns {Promise<number>} - Adamic/Adar index (higher values indicate stronger similarity)
 */
const calculateAdamicAdarIndex = async (userFriendIds, candidateFriendIds, getFriendsCount) => {
  try {
    if (!userFriendIds.length || !candidateFriendIds.length) return 0

    // Find intersection (mutual friends) using custom implementation
    const mutualFriendIds = findIntersection(userFriendIds, candidateFriendIds)

    if (mutualFriendIds.length === 0) return 0

    // Calculate Adamic/Adar index
    let aaIndex = 0

    for (let i = 0; i < mutualFriendIds.length; i++) {
      const friendId = mutualFriendIds[i]
      // Get the number of connections this mutual friend has
      let connections = 0
      try {
        connections = await getFriendsCount(friendId)
      } catch (err) {
        // If there's an error, default to 1 connection
        connections = 1
      }

      // Skip if connections is 0 to avoid log(0)
      if (connections > 0) {
        aaIndex += 1 / Math.log(connections)
      }
    }

    return aaIndex
  } catch (error) {
    console.error("Error calculating Adamic/Adar index:", error)
    return 0
  }
}

/**
 * Calculate a composite similarity score
 * Combines Jaccard coefficient and Adamic/Adar index with weights
 *
 * Time Complexity: O(1) - simple weighted calculation
 * Space Complexity: O(1) - uses constant space
 */
const calculateCompositeSimilarity = (jaccardScore, adamicAdarScore) => {
  // Weight parameters - can be adjusted based on effectiveness
  const jaccardWeight = 0.6
  const adamicAdarWeight = 0.4

  return jaccardScore * jaccardWeight + adamicAdarScore * adamicAdarWeight
}

module.exports = {
  calculateJaccardSimilarity,
  calculateAdamicAdarIndex,
  calculateCompositeSimilarity,
  findIntersection,
  findUnion,
}
