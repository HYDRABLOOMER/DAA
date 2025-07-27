const Event = require('../models/Event');
const User = require('../models/User');

// Get all events
exports.getEvents = async (req, res) => {
    try {
        const events = await Event.find()
            .populate('creator', 'name')
            .sort({ date: 1 });
        res.json({ success: true, events });
    } catch (error) {
        console.error('Error getting events:', error);
        res.status(500).json({ success: false, message: 'Error getting events' });
    }
};

// Get events for a specific date
exports.getEventsByDate = async (req, res) => {
    try {
        const date = new Date(req.params.date);
        const nextDate = new Date(date);
        nextDate.setDate(date.getDate() + 1);

        const events = await Event.find({
            date: {
                $gte: date,
                $lt: nextDate
            }
        })
        .populate('creator', 'name')
        .sort({ date: 1 });

        res.json({ success: true, events });
    } catch (error) {
        console.error('Error getting events by date:', error);
        res.status(500).json({ success: false, message: 'Error getting events' });
    }
};

// Create a new event
exports.createEvent = async (req, res) => {
    try {
        const { title, date, description, location } = req.body;
        
        if (!title || !date) {
            return res.status(400).json({ success: false, message: 'Title and date are required' });
        }

        const event = new Event({
            title,
            date,
            description,
            location,
            creator: req.user._id
        });

        await event.save();
        res.json({ success: true, event });
    } catch (error) {
        console.error('Error creating event:', error);
        res.status(500).json({ success: false, message: 'Error creating event' });
    }
};

// Update an event
exports.updateEvent = async (req, res) => {
    try {
        const { title, date, description, location } = req.body;
        const event = await Event.findById(req.params.id);

        if (!event) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        if (event.creator.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized to update this event' });
        }

        event.title = title || event.title;
        event.date = date || event.date;
        event.description = description || event.description;
        event.location = location || event.location;

        await event.save();
        res.json({ success: true, event });
    } catch (error) {
        console.error('Error updating event:', error);
        res.status(500).json({ success: false, message: 'Error updating event' });
    }
};

// Delete an event
exports.deleteEvent = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);

        if (!event) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        if (event.creator.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized to delete this event' });
        }

        await event.remove();
        res.json({ success: true, message: 'Event deleted successfully' });
    } catch (error) {
        console.error('Error deleting event:', error);
        res.status(500).json({ success: false, message: 'Error deleting event' });
    }
};
