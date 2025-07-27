const mongoose = require("mongoose")

/**
 * Project Collaboration Schema - Extended project schema for collaboration features
 * This complements the main projectSchema.js with additional collaboration-specific fields
 */
const projectCollaborationSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      unique: true,
    },
    skillRequirements: [
      {
        skill: {
          type: String,
          required: true,
        },
        proficiency: {
          type: String,
          enum: ["Beginner", "Intermediate", "Advanced", "Expert"],
          required: true,
        },
        required: {
          type: Boolean,
          default: false,
        },
        weight: {
          type: Number,
          min: 0.1,
          max: 2.0,
          default: 1.0,
        },
      },
    ],
    interestPreferences: [
      {
        interest: {
          type: String,
          required: true,
        },
        importance: {
          type: Number,
          min: 1,
          max: 5,
          default: 3,
        },
      },
    ],
    collaborationSettings: {
      allowInvitations: {
        type: Boolean,
        default: true,
      },
      requireApproval: {
        type: Boolean,
        default: true,
      },
      maxApplications: {
        type: Number,
        min: 1,
        max: 100,
        default: 20,
      },
      autoAcceptThreshold: {
        type: Number,
        min: 0,
        max: 1,
        default: 0.8,
      },
    },
    matchingCriteria: {
      skillWeight: {
        type: Number,
        min: 0,
        max: 1,
        default: 0.4,
      },
      interestWeight: {
        type: Number,
        min: 0,
        max: 1,
        default: 0.3,
      },
      feedbackWeight: {
        type: Number,
        min: 0,
        max: 1,
        default: 0.2,
      },
      availabilityWeight: {
        type: Number,
        min: 0,
        max: 1,
        default: 0.1,
      },
    },
    analytics: {
      totalApplications: {
        type: Number,
        default: 0,
      },
      acceptedApplications: {
        type: Number,
        default: 0,
      },
      averageMatchScore: {
        type: Number,
        default: 0,
      },
      lastRecommendationUpdate: {
        type: Date,
        default: Date.now,
      },
    },
  },
  {
    timestamps: true,
  },
)

// Indexes
projectCollaborationSchema.index({ project: 1 })
projectCollaborationSchema.index({ "collaborationSettings.allowInvitations": 1 })

// Static methods
projectCollaborationSchema.statics.findByProject = async function (projectId) {
  return await this.findOne({ project: projectId }).populate("project")
}

projectCollaborationSchema.statics.updateAnalytics = async function (projectId, updates) {
  return await this.updateOne({ project: projectId }, { $set: { analytics: updates } })
}

// Instance methods
projectCollaborationSchema.methods.calculateRequiredSkillsMatch = function (userSkills) {
  if (!this.skillRequirements.length) return 1

  let totalWeight = 0
  let matchedWeight = 0

  this.skillRequirements.forEach((req) => {
    totalWeight += req.weight
    const userSkill = userSkills.find((skill) => skill.name.toLowerCase() === req.skill.toLowerCase())

    if (userSkill) {
      const proficiencyLevels = ["Beginner", "Intermediate", "Advanced", "Expert"]
      const requiredLevel = proficiencyLevels.indexOf(req.proficiency)
      const userLevel = proficiencyLevels.indexOf(userSkill.proficiency)

      if (userLevel >= requiredLevel) {
        matchedWeight += req.weight
      } else {
        // Partial credit for lower proficiency
        matchedWeight += req.weight * (userLevel / requiredLevel)
      }
    }
  })

  return totalWeight > 0 ? matchedWeight / totalWeight : 0
}

projectCollaborationSchema.methods.calculateInterestMatch = function (userInterests) {
  if (!this.interestPreferences.length) return 1

  let totalImportance = 0
  let matchedImportance = 0

  this.interestPreferences.forEach((pref) => {
    totalImportance += pref.importance
    const userInterest = userInterests.find((interest) => interest.name.toLowerCase() === pref.interest.toLowerCase())

    if (userInterest) {
      // Weight by both preference importance and user interest intensity
      matchedImportance += pref.importance * (userInterest.intensity / 5)
    }
  })

  return totalImportance > 0 ? matchedImportance / totalImportance : 0
}

module.exports = mongoose.model("ProjectCollaboration", projectCollaborationSchema)
