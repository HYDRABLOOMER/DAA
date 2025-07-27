const express = require('express'); const router = express.Router();
const Conversation = require('../models/conversationSchema');
const Message = require('../models/messageSchema');
const User = require('../models/userSchema');

// Get all conversations for the current user
router.get('/conversations', async (req, res) => {
  try {
    const userId = req.cookies.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const conversations = await Conversation.find({
      participants: userId
    }).populate('participants', 'name');

    // Format conversations to include other user's info
    const formattedConversations = conversations.map(conv => {
      const otherUser = conv.participants.find(p => p._id.toString() !== userId);
      return {
        _id: conv._id,
        otherUser: {
          _id: otherUser._id,
          name: otherUser.name
        },
        lastMessage: conv.lastMessage,
        lastMessageTime: conv.lastMessageTime
      };
    });

    res.json(formattedConversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get messages for a specific conversation
router.get('/messages/:conversationId', async (req, res) => {
  try {
    const userId = req.cookies.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const conversation = await Conversation.findById(req.params.conversationId);
    if (!conversation || !conversation.participants.includes(userId)) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const messages = await Message.find({
      conversation: req.params.conversationId
    })
    .sort({ createdAt: 1 })
    .populate('sender', 'name');

    // Format messages to indicate if they were sent by the current user
    const formattedMessages = messages.map(msg => ({
      _id: msg._id,
      content: msg.content,
      timestamp: msg.createdAt,
      sender: msg.sender._id.toString() === userId ? 'me' : 'other',
      senderName: msg.sender.name
    }));

    res.json(formattedMessages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a new conversation
router.post('/conversations', async (req, res) => {
  try {
    const userId = req.cookies.userId;
    const { otherUserId } = req.body;

    if (!userId || !otherUserId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Check if conversation already exists
    const existingConversation = await Conversation.findOne({
      participants: { $all: [userId, otherUserId] }
    });

    if (existingConversation) {
      return res.json(existingConversation);
    }

    // Create new conversation
    const newConversation = new Conversation({
      participants: [userId, otherUserId]
    });

    await newConversation.save();
    res.status(201).json(newConversation);
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});



// Get current user's friends (for chat sidebar)
router.get('/friends', async (req, res) => {
  try {
    const userId = req.cookies.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    const currentUser = await User.findById(userId).populate('friends', 'name university');
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(currentUser.friends);
  } catch (error) {
    console.error('Error fetching friends:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all users (for friend requests)
router.get('/users', async (req, res) => {
  try {
    const userId = req.cookies.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    // Get current user's friends
    const currentUser = await User.findById(userId).populate('friends', 'name university');
    const friendIds = currentUser.friends.map(friend => friend._id);

    // Get all users except current user, friends, and those with pending friend requests (sent or received)
    const excludeIds = [currentUser._id, ...currentUser.friends, ...currentUser.friendRequests];
    // Find users who I have sent a request to (reverse requests)
    const sentRequests = await User.find({ friendRequests: currentUser._id }).select('_id');
    const sentRequestIds = sentRequests.map(u => u._id);
    const allExcludeIds = [...excludeIds, ...sentRequestIds];
    const users = await User.find({ _id: { $nin: allExcludeIds } })
      .select('name university')
      .sort({ name: 1 });

    res.json(users);

  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Search users
router.get('/users/search', async (req, res) => {
  try {
    const userId = req.cookies.userId;
    const { query } = req.query;

    if (!userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    if (!query) {
      return res.json([]);
    }

    // Search users by name or university
    const users = await User.find({
      _id: { $ne: userId },
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { university: { $regex: query, $options: 'i' } }
      ]
    })
    .select('name university')
    .sort({ name: 1 });

    res.json(users);
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Send friend request
router.post('/friends/request', async (req, res) => {
  try {
    const userId = req.cookies.userId;
    const { userId: targetUserId } = req.body;

    if (!userId || !targetUserId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Check if users exist
    const [currentUser, targetUser] = await Promise.all([
      User.findById(userId),
      User.findById(targetUserId)
    ]);

    if (!currentUser || !targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if friend request already exists
    if (currentUser.friendRequests.includes(targetUserId)) {
      return res.status(400).json({ message: 'Friend request already sent' });
    }

    // Add friend request to target user
    targetUser.friendRequests.push(userId);
    await targetUser.save();

    res.json({ success: true, message: 'Friend request sent successfully' });
  } catch (error) {
    console.error('Error sending friend request:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get friend requests
router.get('/friends/requests', async (req, res) => {
  try {
    const userId = req.cookies.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const user = await User.findById(userId).populate('friendRequests', 'name university');
    res.json(user.friendRequests);
  } catch (error) {
    console.error('Error fetching friend requests:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Reject friend request
router.post('/friends/reject', async (req, res) => {
  try {
    const userId = req.cookies.userId;
    const { userId: requesterId } = req.body;

    if (!userId || !requesterId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const currentUser = await User.findById(userId);
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Remove friend request
    currentUser.friendRequests = currentUser.friendRequests.filter(
      id => id.toString() !== requesterId
    );
    await currentUser.save();

    res.json({ success: true, message: 'Friend request rejected' });
  } catch (error) {
    console.error('Error rejecting friend request:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Accept friend request
router.post('/friends/accept', async (req, res) => {
  try {
    const userId = req.cookies.userId;
    const { userId: requesterId } = req.body;

    if (!userId || !requesterId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const [currentUser, requester] = await Promise.all([
      User.findById(userId),
      User.findById(requesterId)
    ]);

    if (!currentUser || !requester) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Remove friend request
    currentUser.friendRequests = currentUser.friendRequests.filter(
      id => id.toString() !== requesterId
    );

    // Add to friends list for both users, only if not already present
    if (!currentUser.friends.includes(requesterId)) {
      currentUser.friends.push(requesterId);
    }
    if (!requester.friends.includes(userId)) {
      requester.friends.push(userId);
    }

    await Promise.all([currentUser.save(), requester.save()]);

    res.json({ success: true, message: 'Friend request accepted' });
  } catch (error) {
    console.error('Error accepting friend request:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get friends list
router.get('/friends', async (req, res) => {
  try {
    const userId = req.cookies.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const user = await User.findById(userId).populate('friends', 'name university');
    res.json(user.friends);
  } catch (error) {
    console.error('Error fetching friends:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
