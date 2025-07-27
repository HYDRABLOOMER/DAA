const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
    leader: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    members: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    name: {
        type: String,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    project: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

// Ensure team size doesn't exceed 4 members (including leader)
teamSchema.pre('save', function(next) {
    if (this.members.length > 3) {
        next(new Error('Team cannot have more than 4 members (including leader)'));
    }
    next();
});

module.exports = mongoose.model('Team', teamSchema);
