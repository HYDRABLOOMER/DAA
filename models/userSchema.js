const mongoose = require("mongoose")

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [50, "Name cannot exceed 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, "Please enter a valid email"],
    },
    studentId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
    },
    university: {
      type: String,
      required: [true, "University is required"],
      trim: true,
    },
    department: {
      type: String,
      trim: true,
      default: "",
    },
    major: {
      type: String,
      trim: true,
      default: "",
    },
    year: {
      type: String,
      trim: true,
      default: "",
    },
    skills: [
      {
        type: String,
        trim: true,
      },
    ],
    interests: [
      {
        type: String,
        trim: true,
      },
    ],
    bio: {
      type: String,
      maxlength: [500, "Bio cannot exceed 500 characters"],
      default: "",
    },
    friends: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    friendRequests: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    profilePicture: {
      type: String,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
)

// Indexes for better performance
userSchema.index({ email: 1 })
userSchema.index({ university: 1 })
userSchema.index({ skills: 1 })
userSchema.index({ interests: 1 })

// Virtual for user's full profile
userSchema.virtual("fullProfile").get(function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    university: this.university,
    department: this.department,
    skills: this.skills,
    interests: this.interests,
    bio: this.bio,
  }
})

module.exports = mongoose.model("User", userSchema)
