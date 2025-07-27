/**
 * Utility functions for calculating similarity metrics between users
 */

/**
 * Calculates Jaccard similarity between two arrays
 * Measures similarity based on overlap (intersection over union)
 */
function calculateJaccardSimilarity(arr1 = [], arr2 = []) {
    if (!arr1.length && !arr2.length) return 0;
    // Convert all items to lowercase for case-insensitive comparison
    const set1 = new Set(arr1.map(item => item.toLowerCase()));
    const set2 = new Set(arr2.map(item => item.toLowerCase()));
    const intersection = [...set1].filter(x => set2.has(x));
    const union = new Set([...arr1.map(item => item.toLowerCase()), ...arr2.map(item => item.toLowerCase())]);
    return intersection.length / union.size;
}

/**
 * Calculates Adamic/Adar index between two arrays of friend IDs
 * Gives more weight to mutual friends who have fewer connections
 */
async function calculateAdamicAdarIndex(user1FriendIds = [], user2FriendIds = [], getFriendsCount) {
    const set1 = new Set(user1FriendIds);
    const set2 = new Set(user2FriendIds);
    const mutualFriendIds = [...set1].filter(x => set2.has(x));
    if (mutualFriendIds.length === 0) return 0;
    let aaIndex = 0;
    for (const friendId of mutualFriendIds) {
        const degree = await getFriendsCount(friendId);
        if (degree > 1) {
            aaIndex += 1 / Math.log(degree);
        }
    }
    return aaIndex;
}

/**
 * Calculates department similarity score
 */
function calculateDeptScore(userDept, candidateDept) {
    return userDept === candidateDept ? 1 : 0;
}

/**
 * Calculates skill similarity score using Jaccard index
 */
function calculateSkillSimilarity(userSkills = [], candidateSkills = []) {
    return calculateJaccardSimilarity(userSkills, candidateSkills);
}

/**
 * Calculates interest similarity score using Jaccard index
 */
function calculateInterestSimilarity(userInterests = [], candidateInterests = []) {
    return calculateJaccardSimilarity(userInterests, candidateInterests);
}

/**
 * Combines individual metrics into a composite similarity score
 * Weights can be adjusted based on desired importance of each factor
 */
function calculateCompositeSimilarity({
    jaccard,
    adamicAdar,
    deptScore,
    skillSimilarity,
    interestSimilarity
}, weights = {
    jaccard: 0.3,      // Reduced from 0.5
    adamic: 0.2,       // Reduced from 0.3
    dept: 0.1,         // Reduced from 0.2
    skills: 0.2,       // New weight for skills
    interests: 0.2     // New weight for interests
}) {
    return (
        (weights.jaccard * jaccard) +
        (weights.adamic * adamicAdar) +
        (weights.dept * deptScore) +
        (weights.skills * skillSimilarity) +
        (weights.interests * interestSimilarity)
    );
}

module.exports = {
    calculateJaccardSimilarity,
    calculateAdamicAdarIndex,
    calculateDeptScore,
    calculateSkillSimilarity,
    calculateInterestSimilarity,
    calculateCompositeSimilarity
};
