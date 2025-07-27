const User = require("../models/userSchema")
const { Heap } = require("heap-js")
const { calculateJaccardSimilarity, calculateAdamicAdarIndex } = require("../utils/recommendationAlgorithm")
const {
  calculateDeptScore,
  calculateSkillSimilarity,
  calculateInterestSimilarity,
  calculateCompositeSimilarity,
} = require("../utils/findPotentialFriendsWithMetrics")

/**
 * Enhanced friend recommendation using BFS network traversal with efficient top-K retrieval
 * Uses heap for O(n log k) complexity instead of O(n log n)
 */
async function findPotentialFriends(userId, maxDepth = 2, maxRecommendations = 20) {
  console.log(`=== Starting friend recommendations for user ${userId} (top ${maxRecommendations}) ===`)

  const user = await User.findById(userId).populate("friends", "name")
  if (!user) {
    console.log("User not found")
    return []
  }

  console.log(`User: ${user.name}, Direct friends: ${user.friends.length}`)

  // Create comprehensive exclusion sets (preserve existing logic)
  const myFriends = new Set(user.friends.map((f) => f._id.toString()))
  const myRequests = new Set(user.friendRequests.map((id) => id.toString()))

  // Get sent requests - users who have received friend requests from current user
  const sentRequests = await User.find({ friendRequests: userId }).select("_id")
  const sentRequestIds = new Set(sentRequests.map((u) => u._id.toString()))

  // Enhanced exclusion logic from features version
  const excludedUserIds = new Set([userId.toString()])

  // Add direct friends to exclusion
  myFriends.forEach((id) => excludedUserIds.add(id))

  console.log(`Excluded users: ${excludedUserIds.size} (self + direct friends)`)

  // Initialize heaps for efficient top-K retrieval
  // Separate heaps for different priority levels
  const pendingRequestsHeap = new Heap((a, b) => b.similarity.composite - a.similarity.composite) // max-heap for pending
  const regularRecommendationsHeap = new Heap((a, b) => a.similarity.composite - b.similarity.composite) // min-heap for regular

  const processedCandidates = new Set() // Prevent duplicate processing

  // For each direct friend, get their friends (depth 2)
  for (const directFriend of user.friends) {
    try {
      const friendOfFriend = await User.findById(directFriend._id).populate(
        "friends",
        "name email university department skills interests bio profilePicture",
      )
      if (!friendOfFriend) continue

      console.log(`Processing friends of ${directFriend.name}: ${friendOfFriend.friends.length} friends`)

      // Check each friend-of-friend as a potential recommendation
      for (const candidate of friendOfFriend.friends) {
        const candidateId = candidate._id.toString()

        // Skip if already excluded or processed
        if (excludedUserIds.has(candidateId) || processedCandidates.has(candidateId)) continue
        processedCandidates.add(candidateId) // Prevent duplicate processing

        // Get full candidate details with populated friends - FIXED
        const candidateDetails = await User.findById(candidateId).populate("friends", "name _id").lean()
        if (!candidateDetails) continue

        // Only filter by university if both have university defined (preserve existing logic)
        if (user.university && candidateDetails.university && user.university !== candidateDetails.university) continue

        console.log(`Evaluating candidate: ${candidateDetails.name}`)

        // Determine friendship status (preserve existing logic)
        let friendshipStatus = "none"
        if (myRequests.has(candidateId)) {
          friendshipStatus = "pending_received" // They sent us a request
        } else if (sentRequestIds.has(candidateId)) {
          friendshipStatus = "pending_sent" // We sent them a request
        }

        // Get mutual friends - FIXED calculation with proper name resolution
        const candidateFriendIds = (candidateDetails.friends || []).map((f) =>
          f._id ? f._id.toString() : f.toString(),
        )

        // Get mutual friend details with names - FIXED
        const mutualFriendsList = []
        if (candidateDetails.friends && candidateDetails.friends.length > 0) {
          for (const candidateFriend of candidateDetails.friends) {
            const candidateFriendId = candidateFriend._id ? candidateFriend._id.toString() : candidateFriend.toString()
            if (myFriends.has(candidateFriendId)) {
              // Find the actual friend object with name from user's friends
              const mutualFriendWithName = user.friends.find((f) => f._id.toString() === candidateFriendId)
              if (mutualFriendWithName) {
                mutualFriendsList.push({
                  _id: mutualFriendWithName._id,
                  name: mutualFriendWithName.name,
                })
              }
            }
          }
        }

        // Enhanced similarity calculations with individual error handling (features version approach)
        let jaccard = 0,
          adamicAdar = 0,
          deptScore = 0,
          skillSimilarity = 0,
          interestSimilarity = 0

        try {
          // Calculate all similarity metrics with error resilience
          const userFriendIds = Array.from(myFriends)

          const getFriendsCount = async (id) => {
            try {
              const u = await User.findById(id)
              return u ? u.friends.length : 0
            } catch (error) {
              console.error(`Error getting friends count for ${id}:`, error)
              return 0
            }
          }

          // Individual metric calculations with error handling
          try {
            jaccard = calculateJaccardSimilarity(userFriendIds, candidateFriendIds) || 0
          } catch (error) {
            console.error(`Error calculating Jaccard for ${candidateId}:`, error)
          }

          try {
            adamicAdar = (await calculateAdamicAdarIndex(userFriendIds, candidateFriendIds, getFriendsCount)) || 0
          } catch (error) {
            console.error(`Error calculating Adamic/Adar for ${candidateId}:`, error)
          }

          try {
            deptScore = calculateDeptScore(user.department || "", candidateDetails.department || "") || 0
          } catch (error) {
            console.error(`Error calculating department score for ${candidateId}:`, error)
          }

          try {
            skillSimilarity = calculateSkillSimilarity(user.skills || [], candidateDetails.skills || []) || 0
          } catch (error) {
            console.error(`Error calculating skill similarity for ${candidateId}:`, error)
          }

          try {
            interestSimilarity =
              calculateInterestSimilarity(user.interests || [], candidateDetails.interests || []) || 0
          } catch (error) {
            console.error(`Error calculating interest similarity for ${candidateId}:`, error)
          }
        } catch (error) {
          console.error(`Error in similarity calculations for ${candidateId}:`, error)
          // Continue with default values
        }

        // Calculate composite score with all metrics (enhanced from features version)
        const composite = calculateCompositeSimilarity({
          jaccard,
          adamicAdar,
          deptScore,
          skillSimilarity,
          interestSimilarity,
        })

        console.log(
          `${candidateDetails.name} - Composite: ${composite.toFixed(3)}, Jaccard: ${jaccard.toFixed(3)}, Skills: ${skillSimilarity.toFixed(3)}, Interests: ${interestSimilarity.toFixed(3)}`,
        )

        // Enhanced minimum similarity threshold filter (preserve existing logic but improve)
        if (friendshipStatus === "none") {
          const MIN_COMPOSITE_THRESHOLD = 0.1 // Minimum 10% similarity
          const MIN_INDIVIDUAL_THRESHOLD = 0.05 // At least one metric should be > 5%

          const hasMinimumSimilarity =
            composite >= MIN_COMPOSITE_THRESHOLD ||
            jaccard >= MIN_INDIVIDUAL_THRESHOLD ||
            adamicAdar >= MIN_INDIVIDUAL_THRESHOLD ||
            deptScore >= MIN_INDIVIDUAL_THRESHOLD ||
            skillSimilarity >= MIN_INDIVIDUAL_THRESHOLD ||
            interestSimilarity >= MIN_INDIVIDUAL_THRESHOLD

          // Skip if similarity is too low (all scores near zero)
          if (!hasMinimumSimilarity) {
            console.log(`Skipping ${candidateDetails.name} - similarity too low (composite: ${composite.toFixed(3)})`)
            continue
          }
        }

        // Create recommendation object
        const recommendation = {
          ...candidateDetails,
          similarity: {
            jaccard,
            adamicAdar,
            composite,
            // Add individual metrics from features version
            deptScore,
            skillSimilarity,
            interestSimilarity,
          },
          // Enhanced similarity score object (features version structure)
          similarityScore: {
            jaccard,
            adamicAdar,
            deptScore,
            skillSimilarity,
            interestSimilarity,
            composite,
          },
          mutualFriends: mutualFriendsList.map((f) => ({
            _id: f._id,
            name: f.name,
          })),
          friendshipStatus, // Preserve existing functionality
        }

        // Efficient top-K insertion using heaps
        if (friendshipStatus.includes("pending")) {
          // Always include pending requests (they have priority)
          pendingRequestsHeap.push(recommendation)
        } else {
          // For regular recommendations, maintain only top K using min-heap
          if (regularRecommendationsHeap.size() < maxRecommendations) {
            regularRecommendationsHeap.push(recommendation)
          } else if (composite > regularRecommendationsHeap.peek().similarity.composite) {
            // Replace lowest scoring recommendation with this better one
            regularRecommendationsHeap.pop()
            regularRecommendationsHeap.push(recommendation)
          }
        }
      }
    } catch (error) {
      console.error(`Error processing friends of ${directFriend.name}:`, error)
      // Continue with next friend
    }
  }

  // Combine results: pending requests first, then top regular recommendations
  const finalRecommendations = []

  // Add all pending requests (sorted by similarity)
  const pendingRequests = []
  while (pendingRequestsHeap.size() > 0) {
    pendingRequests.push(pendingRequestsHeap.pop())
  }
  finalRecommendations.push(...pendingRequests)

  // Add top regular recommendations (extract from min-heap and reverse for descending order)
  const regularRecommendations = []
  while (regularRecommendationsHeap.size() > 0) {
    regularRecommendations.push(regularRecommendationsHeap.pop())
  }
  // Reverse because min-heap gives us lowest first, we want highest first
  regularRecommendations.reverse()
  finalRecommendations.push(...regularRecommendations)

  console.log(`=== Generated ${finalRecommendations.length} recommendations using efficient top-K retrieval ===`)
  console.log(`Pending requests: ${pendingRequests.length}, Regular recommendations: ${regularRecommendations.length}`)

  // Enhanced logging (features version approach)
  finalRecommendations.slice(0, 5).forEach((rec, index) => {
    console.log(
      `${index + 1}. ${rec.name} - Score: ${rec.similarity.composite.toFixed(3)}, Mutual: ${rec.mutualFriends.length}, Status: ${rec.friendshipStatus}`,
    )
  })

  return finalRecommendations
}

exports.getRecommendations = async (req, res) => {
  try {
    console.log("=== RECOMMENDATIONS ENDPOINT CALLED ===")

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      })
    }

    // Use efficient top-K retrieval
    const recommendations = await findPotentialFriends(req.user._id, 2, 20) // depth=2, maxRecommendations=20

    res.json({
      success: true,
      recommendations,
    })
  } catch (error) {
    console.error("Error getting recommendations:", error)
    res.status(500).json({
      success: false,
      message: "Error getting recommendations",
    })
  }
}
