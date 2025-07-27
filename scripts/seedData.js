const mongoose = require("mongoose")
const bcrypt = require("bcrypt")
const User = require("../models/userSchema")
const Project = require("../models/projectSchema")
require("dotenv").config()

const seedData = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/connectApp")
    console.log("Connected to MongoDB")

    // Clear existing data
    await User.deleteMany({})
    await Project.deleteMany({})
    console.log("Cleared existing data")

    // Create sample users
    const hashedPassword = await bcrypt.hash("password123", 10)

    const users = await User.create([
      {
        name: "Alice Johnson",
        email: "alice@university.edu",
        password: hashedPassword,
        studentId: "STU001",
        university: "Tech University",
        department: "Computer Science",
        skills: ["JavaScript", "React", "Node.js", "Python"],
        interests: ["Web Development", "AI", "Machine Learning"],
        bio: "Passionate about full-stack development and AI applications.",
      },
      {
        name: "Bob Smith",
        email: "bob@university.edu",
        password: hashedPassword,
        studentId: "STU002",
        university: "Tech University",
        department: "Data Science",
        skills: ["Python", "Machine Learning", "TensorFlow", "SQL"],
        interests: ["Data Science", "AI", "Research"],
        bio: "Data science enthusiast with experience in ML projects.",
      },
      {
        name: "Carol Davis",
        email: "carol@university.edu",
        password: hashedPassword,
        studentId: "STU003",
        university: "Tech University",
        department: "Design",
        skills: ["UI/UX Design", "Figma", "Adobe Creative Suite"],
        interests: ["Design", "User Experience", "Mobile Apps"],
        bio: "Creative designer focused on user-centered design.",
      },
    ])

    console.log("Created sample users")

    // Create sample projects
    const projects = await Project.create([
      {
        title: "E-commerce Web Application",
        description:
          "Building a modern e-commerce platform with React and Node.js. Looking for developers passionate about creating seamless shopping experiences.",
        creator: users[0]._id,
        requiredSkills: ["JavaScript", "React", "Node.js", "MongoDB"],
        preferredInterests: ["Web Development", "E-commerce"],
        maxMembers: 4,
        category: "web-development",
        university: "Tech University",
        currentMembers: [{ user: users[0]._id, role: "creator" }],
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      },
      {
        title: "AI-Powered Study Assistant",
        description:
          "Developing an intelligent study assistant using machine learning to help students optimize their learning process.",
        creator: users[1]._id,
        requiredSkills: ["Python", "Machine Learning", "TensorFlow", "Natural Language Processing"],
        preferredInterests: ["AI", "Education", "Machine Learning"],
        maxMembers: 3,
        category: "ai-ml",
        university: "Tech University",
        currentMembers: [{ user: users[1]._id, role: "creator" }],
        deadline: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // 45 days from now
      },
      {
        title: "Mobile Fitness Tracker",
        description:
          "Creating a comprehensive fitness tracking mobile app with social features and personalized workout plans.",
        creator: users[2]._id,
        requiredSkills: ["React Native", "UI/UX Design", "Mobile Development"],
        preferredInterests: ["Mobile Apps", "Health", "Design"],
        maxMembers: 5,
        category: "mobile-app",
        university: "Tech University",
        currentMembers: [{ user: users[2]._id, role: "creator" }],
        deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
      },
    ])

    console.log("Created sample projects")
    console.log("Seed data created successfully!")

    console.log("\nSample login credentials:")
    console.log("Email: alice@university.edu, Password: password123")
    console.log("Email: bob@university.edu, Password: password123")
    console.log("Email: carol@university.edu, Password: password123")
  } catch (error) {
    console.error("Error seeding data:", error)
  } finally {
    await mongoose.connection.close()
    console.log("Database connection closed")
  }
}

// Run the seed function
seedData()
