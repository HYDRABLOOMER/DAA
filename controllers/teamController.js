const User = require("../models/userSchema")
const Team = require("../models/Team")

// Get team members
exports.getTeamMembers = async (req, res) => {
  try {
    const team = await Team.findOne({ leader: req.cookies.userId })
      .populate("members", "name department university")
      .populate("leader", "name department university")

    if (!team) {
      return res.json({ success: true, members: [], leader: null })
    }

    res.json({
      success: true,
      members: team.members,
      leader: team.leader,
      project: team.project,
      description: team.description,
    })
  } catch (error) {
    console.error("Error getting team members:", error)
    res.status(500).json({ success: false, message: "Error getting team members" })
  }
}

// Get team recommendations (FIXED - excludes current user)
exports.getTeamRecommendations = async (req, res) => {
  try {
    const currentUserId = req.cookies.userId
    const team = await Team.findOne({ leader: currentUserId })
    const currentMembers = team ? [...team.members, team.leader] : [currentUserId]

    // Get users who are not already in the team AND not the current user
    const recommendations = await User.find({
      _id: {
        $nin: currentMembers,
        $ne: currentUserId, // FIXED: Explicitly exclude current user
      },
      university: { $exists: true }, // Only users with university set
    })
      .select("name department university bio")
      .limit(10)

    res.json({
      success: true,
      recommendations: recommendations.map((user) => ({
        _id: user._id,
        name: user.name,
        department: user.department,
        university: user.university,
        bio: user.bio,
        commonFriends: 0, // Simplified for now
        score: 1,
      })),
    })
  } catch (error) {
    console.error("Error getting team recommendations:", error)
    res.status(500).json({ success: false, message: "Error getting team recommendations" })
  }
}

// Add team member (FIXED - better error handling)
exports.addTeamMember = async (req, res) => {
  try {
    const { userId } = req.body
    const currentUserId = req.cookies.userId

    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required" })
    }

    // Prevent adding self
    if (userId === currentUserId) {
      return res.status(400).json({ success: false, message: "Cannot add yourself to the team" })
    }

    // Check if user exists
    const userToAdd = await User.findById(userId)
    if (!userToAdd) {
      return res.status(404).json({ success: false, message: "User not found" })
    }

    let team = await Team.findOne({ leader: currentUserId })

    if (!team) {
      team = new Team({
        leader: currentUserId,
        members: [],
      })
    }

    if (team.members.length >= 3) {
      return res
        .status(400)
        .json({ success: false, message: "Team is already full (maximum 4 members including leader)" })
    }

    if (team.members.includes(userId)) {
      return res.status(400).json({ success: false, message: "User is already in the team" })
    }

    team.members.push(userId)
    await team.save()

    // Populate the updated team data
    const updatedTeam = await Team.findById(team._id)
      .populate("members", "name department university")
      .populate("leader", "name department university")

    res.json({
      success: true,
      message: "Team member added successfully",
      team: updatedTeam,
    })
  } catch (error) {
    console.error("Error adding team member:", error)
    res.status(500).json({ success: false, message: "Error adding team member" })
  }
}

// Remove team member
exports.removeTeamMember = async (req, res) => {
  try {
    const currentUserId = req.cookies.userId
    const team = await Team.findOne({ leader: currentUserId })

    if (!team) {
      return res.status(404).json({ success: false, message: "Team not found" })
    }

    const memberId = req.params.userId
    if (!team.members.includes(memberId)) {
      return res.status(400).json({ success: false, message: "User is not a member of this team" })
    }

    team.members = team.members.filter((member) => member.toString() !== memberId)
    await team.save()

    // Populate the updated team data
    const updatedTeam = await Team.findById(team._id)
      .populate("members", "name department university")
      .populate("leader", "name department university")

    res.json({
      success: true,
      message: "Team member removed successfully",
      team: updatedTeam,
    })
  } catch (error) {
    console.error("Error removing team member:", error)
    res.status(500).json({ success: false, message: "Error removing team member" })
  }
}

// Search users for team
exports.searchUsers = async (req, res) => {
  try {
    const query = req.query.q
    const currentUserId = req.cookies.userId
    const team = await Team.findOne({ leader: currentUserId })
    const currentMembers = team ? team.members : []

    const users = await User.find({
      _id: {
        $nin: [...currentMembers, currentUserId], // Exclude current user and team members
      },
      $or: [{ name: { $regex: query, $options: "i" } }, { department: { $regex: query, $options: "i" } }],
    }).select("name department university")

    res.json({ success: true, users })
  } catch (error) {
    console.error("Error searching users:", error)
    res.status(500).json({ success: false, message: "Error searching users" })
  }
}
