const User = require('../models/userSchema');

// Get profile
exports.getProfile = async (req, res) => {
    try {
        console.log('Getting profile for user:', req.user._id);
        const user = await User.findById(req.user._id)
            .select('-password')
            .populate('friends', 'name university');

        if (!user) {
            console.error('User not found:', req.user._id);
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        console.log('Profile retrieved successfully:', {
            name: user.name,
            bio: user.bio,
            department: user.department,
            year: user.year,
            friendsCount: user.friends ? user.friends.length : 0
        });

        res.json({
            success: true,
            user
        });
    } catch (error) {
        console.error('Error getting profile:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting profile'
        });
    }
};

// Update profile
exports.updateProfile = async (req, res) => {
    try {
        const { bio, department, year, studentId, university, major, skills, interests } = req.body;
        console.log('Updating profile for user:', req.user._id, { bio, department, year, studentId, university, major, skills, interests });
        
        // Validate input
        if (bio && typeof bio !== 'string') {
            console.error('Invalid bio type:', typeof bio);
            return res.status(400).json({
                success: false,
                message: 'Bio must be a string'
            });
        }
        if (department && typeof department !== 'string') {
            console.error('Invalid department type:', typeof department);
            return res.status(400).json({
                success: false,
                message: 'Department must be a string'
            });
        }
        if (year && typeof year !== 'string') {
            console.error('Invalid year type:', typeof year);
            return res.status(400).json({
                success: false,
                message: 'Year must be a string'
            });
        }
        if (studentId && typeof studentId !== 'string') {
            console.error('Invalid studentId type:', typeof studentId);
            return res.status(400).json({
                success: false,
                message: 'Student ID must be a string'
            });
        }
        if (university && typeof university !== 'string') {
            console.error('Invalid university type:', typeof university);
            return res.status(400).json({
                success: false,
                message: 'University must be a string'
            });
        }
        if (major && typeof major !== 'string') {
            console.error('Invalid major type:', typeof major);
            return res.status(400).json({
                success: false,
                message: 'Major must be a string'
            });
        }
        if (skills && !Array.isArray(skills)) {
            console.error('Invalid skills type:', typeof skills);
            return res.status(400).json({
                success: false,
                message: 'Skills must be an array of strings'
            });
        }
        if (skills && Array.isArray(skills) && skills.some(s => typeof s !== 'string')) {
            console.error('Invalid skill element type');
            return res.status(400).json({
                success: false,
                message: 'Each skill must be a string'
            });
        }
        if (interests && !Array.isArray(interests)) {
            console.error('Invalid interests type:', typeof interests);
            return res.status(400).json({
                success: false,
                message: 'Interests must be an array of strings'
            });
        }
        if (interests && Array.isArray(interests) && interests.some(i => typeof i !== 'string')) {
            console.error('Invalid interest element type');
            return res.status(400).json({
                success: false,
                message: 'Each interest must be a string'
            });
        }

        // Update user
        const user = await User.findByIdAndUpdate(
            req.user._id,
            {
                $set: {
                    bio: bio || '',
                    department: department || '',
                    year: year || '',
                    studentId: studentId || '',
                    university: university || '',
                    major: major || '',
                    skills: skills || [],
                    interests: interests || []
                }
            },
            { 
                new: true,
                runValidators: true
            }
        )
        .select('-password')
        .populate('friends', 'name university');

        if (!user) {
            console.error('User not found during update:', req.user._id);
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        console.log('Profile updated successfully:', {
            name: user.name,
            bio: user.bio,
            department: user.department,
            year: user.year,
            friendsCount: user.friends ? user.friends.length : 0
        });

        res.json({
            success: true,
            user
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating profile'
        });
    }
};
