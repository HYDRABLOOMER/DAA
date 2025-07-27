const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const userController = require('../controllers/userController');
const eventController = require('../controllers/eventController');
const teamController = require('../controllers/teamController');

// Auth routes
router.post('/auth/register', userController.register);
router.post('/auth/login', userController.login);
router.get('/auth/status', auth, userController.getAuthStatus);
router.post('/auth/logout', auth, userController.logout);

// User routes
router.get('/users', auth, userController.getUsers);
router.get('/users/search', auth, userController.searchUsers);
router.get('/profile', auth, userController.getProfile);
router.put('/profile', auth, userController.updateProfile);
router.post('/users/:id/friend', auth, userController.addFriend);
router.delete('/users/:id/friend', auth, userController.removeFriend);
router.get('/users/recommendations', auth, userController.getFriendRecommendations);

// Event routes
router.get('/events', auth, eventController.getEvents);
router.get('/events/date/:date', auth, eventController.getEventsByDate);
router.post('/events', auth, eventController.createEvent);
router.put('/events/:id', auth, eventController.updateEvent);
router.delete('/events/:id', auth, eventController.deleteEvent);

// Team routes
router.get('/team/members', auth, teamController.getTeamMembers);
router.get('/team/recommendations', auth, teamController.getTeamRecommendations);
router.post('/team/members', auth, teamController.addTeamMember);
router.delete('/team/members/:userId', auth, teamController.removeTeamMember);
router.get('/users/search', auth, teamController.searchUsers);

module.exports = router;
