const express = require("express")
const mongoose = require("mongoose")
const path = require("path")
const http = require("http")
const { Server } = require("socket.io")
const cookieParser = require("cookie-parser")
require("dotenv").config()

// Import routes - using your existing route files
const userRoutes = require("./routes/userRoutes")
const chatRoutes = require("./routes/chatRoutes")
const recommendationRoutes = require("./routes/recommendationRoutes")
const profileRoutes = require("./routes/profileRoutes")
const projectRoutes = require("./routes/projectRoutes")
const feedbackRoutes = require("./routes/feedbackRoutes")
const teamRoutes = require("./routes/teamRoutes")
// Add the new consolidated routes
const friendRoutes = require("./routes/friendRoutes")
const collaborationRoutes = require("./routes/collaborationRoutes")

// Import models for Socket.io
const Message = require("./models/messageSchema")
const Conversation = require("./models/conversationSchema")

const app = express()
const PORT = process.env.PORT || 3000

// Body parsing middleware
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))
app.use(cookieParser())

// Static files
app.use(express.static(path.join(__dirname, "public")))

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
})

// Serve main pages
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"))
})

app.get("/profile", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "profile.html"))
})

// Authentication status endpoint
app.get("/api/auth/status", async (req, res) => {
  try {
    if (req.cookies.userId) {
      const User = require("./models/userSchema")
      const user = await User.findById(req.cookies.userId).select("name email university department")

      if (user) {
        res.json({
          isAuthenticated: true,
          user: {
            _id: user._id,
            name: user.name,
            email: user.email,
            university: user.university,
            department: user.department,
          },
        })
      } else {
        res.clearCookie("userId")
        res.clearCookie("userName")
        res.json({ isAuthenticated: false })
      }
    } else {
      res.json({ isAuthenticated: false })
    }
  } catch (error) {
    console.error("Auth status error:", error)
    res.status(500).json({ isAuthenticated: false, error: "Server error" })
  }
})

// Logout endpoint
app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("userId")
  res.clearCookie("userName")
  res.json({ success: true, message: "Logged out successfully" })
})

// Create HTTP server
const server = http.createServer(app)

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
})

// Database connection
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || "mongodb://localhost:27017/connectApp"
    await mongoose.connect(mongoURI)
    console.log("✅ MongoDB connected successfully")
  } catch (error) {
    console.error("❌ MongoDB connection error:", error)
    process.exit(1)
  }
}

// Connect to database
connectDB()

// Routes - using your existing routes
app.use("/", userRoutes)
app.use("/api", chatRoutes)
app.use("/api", recommendationRoutes)
app.use("/api", profileRoutes)
app.use("/api", projectRoutes)
app.use("/api", feedbackRoutes)
app.use("/api", teamRoutes)

// Add new consolidated routes (only if the files exist)
try {
  app.use("/api/friends", friendRoutes)
  console.log("✅ Friend routes loaded")
} catch (error) {
  console.log("⚠️ Friend routes not found, skipping...")
}

try {
  app.use("/api/collaboration", collaborationRoutes)
  console.log("✅ Collaboration routes loaded")
} catch (error) {
  console.log("⚠️ Collaboration routes not found, skipping...")
}

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("👤 User connected:", socket.id)

  socket.on("joinConversation", (conversationId) => {
    socket.join(conversationId)
    console.log(`📞 User ${socket.id} joined conversation: ${conversationId}`)
  })

  socket.on("leaveConversation", (conversationId) => {
    socket.leave(conversationId)
    console.log(`📞 User ${socket.id} left conversation: ${conversationId}`)
  })

  socket.on("chatMessage", async (msg) => {
    try {
      if (!msg || typeof msg !== "object" || !msg.content || !msg.chatId) {
        console.error("❌ Invalid message format:", msg)
        socket.emit("error", { message: "Invalid message format" })
        return
      }

      const userId = socket.handshake.auth.userId
      if (!userId) {
        console.error("❌ No user ID provided")
        socket.emit("error", { message: "Authentication required" })
        return
      }

      const newMessage = new Message({
        conversation: msg.chatId,
        sender: userId,
        content: msg.content,
      })

      await newMessage.save()

      await Conversation.findByIdAndUpdate(msg.chatId, {
        lastMessage: msg.content,
        lastMessageTime: new Date(),
      })

      const conversation = await Conversation.findById(msg.chatId)
      if (!conversation) {
        console.error("❌ Conversation not found")
        socket.emit("error", { message: "Conversation not found" })
        return
      }

      const messageData = {
        chatId: msg.chatId,
        content: msg.content,
        timestamp: newMessage.createdAt,
        sender: userId,
      }

      io.in(msg.chatId).emit("chatMessage", messageData)

      console.log("✅ Message sent successfully")
    } catch (error) {
      console.error("❌ Chat message error:", error)
      socket.emit("error", { message: "Failed to send message" })
    }
  })

  socket.on("disconnect", () => {
    console.log("👤 User disconnected:", socket.id)
  })
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("❌ Server error:", err.stack)
  res.status(500).json({
    success: false,
    message: "Something went wrong!",
    ...(process.env.NODE_ENV === "development" && { error: err.message }),
  })
})

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  })
})

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`🌐 Access your app at: http://localhost:${PORT}`)
  console.log(`📊 Health check: http://localhost:${PORT}/health`)
})

module.exports = app
