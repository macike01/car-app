const mongoose = require('mongoose');

const rideSchema = new mongoose.Schema({
  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    maxlength: 1000
  },
  type: {
    type: String,
    enum: ['CASUAL', 'SPIRITED', 'TRACK', 'SCENIC', 'ROAD_TRIP', 'MEETUP'],
    default: 'CASUAL'
  },
  status: {
    type: String,
    enum: ['PLANNING', 'ACTIVE', 'COMPLETED', 'CANCELLED'],
    default: 'PLANNING'
  },
  route: {
    startLocation: {
      name: String,
      address: String,
      coordinates: {
        lat: Number,
        lng: Number
      }
    },
    endLocation: {
      name: String,
      address: String,
      coordinates: {
        lat: Number,
        lng: Number
      }
    },
    waypoints: [{
      name: String,
      coordinates: {
        lat: Number,
        lng: Number
      },
      order: Number
    }],
    estimatedDistance: Number, // miles
    estimatedDuration: Number, // minutes
    routePolyline: String // Google Maps polyline
  },
  schedule: {
    startTime: {
      type: Date,
      required: true
    },
    endTime: Date,
    timezone: {
      type: String,
      default: 'UTC'
    }
  },
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    car: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Car'
    },
    status: {
      type: String,
      enum: ['INVITED', 'CONFIRMED', 'DECLINED', 'JOINED', 'LEFT'],
      default: 'INVITED'
    },
    joinedAt: Date,
    leftAt: Date,
    currentLocation: {
      coordinates: {
        lat: Number,
        lng: Number
      },
      timestamp: Date,
      speed: Number, // mph
      heading: Number // degrees
    },
    isOnline: {
      type: Boolean,
      default: false
    }
  }],
  settings: {
    maxParticipants: {
      type: Number,
      default: 20,
      min: 1,
      max: 100
    },
    isPublic: {
      type: Boolean,
      default: true
    },
    allowLateJoin: {
      type: Boolean,
      default: true
    },
    requireApproval: {
      type: Boolean,
      default: false
    },
    locationSharing: {
      type: String,
      enum: ['ALL_PARTICIPANTS', 'ORGANIZER_ONLY', 'OFF'],
      default: 'ALL_PARTICIPANTS'
    }
  },
  stats: {
    totalDistance: {
      type: Number,
      default: 0
    },
    averageSpeed: {
      type: Number,
      default: 0
    },
    maxSpeed: {
      type: Number,
      default: 0
    },
    duration: {
      type: Number,
      default: 0
    },
    fuelUsed: {
      type: Number,
      default: 0
    }
  },
  photos: [{
    url: String,
    caption: String,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    location: {
      coordinates: {
        lat: Number,
        lng: Number
      }
    }
  }],
  chat: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    message: {
      type: String,
      required: true,
      maxlength: 500
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    type: {
      type: String,
      enum: ['TEXT', 'SYSTEM', 'LOCATION'],
      default: 'TEXT'
    }
  }],
  tags: [String],
  weather: {
    condition: String,
    temperature: Number,
    humidity: Number,
    windSpeed: Number,
    visibility: Number
  }
}, {
  timestamps: true
});

// Indexes
rideSchema.index({ organizer: 1 });
rideSchema.index({ status: 1 });
rideSchema.index({ 'schedule.startTime': 1 });
rideSchema.index({ 'route.startLocation.coordinates': '2dsphere' });
rideSchema.index({ 'route.endLocation.coordinates': '2dsphere' });
rideSchema.index({ 'participants.user': 1 });

// Virtual for ride duration
rideSchema.virtual('duration').get(function() {
  if (this.schedule.startTime && this.schedule.endTime) {
    return this.schedule.endTime - this.schedule.startTime;
  }
  return null;
});

// Virtual for participant count
rideSchema.virtual('participantCount').get(function() {
  return this.participants.filter(p => p.status === 'CONFIRMED' || p.status === 'JOINED').length;
});

// Virtual for is full
rideSchema.virtual('isFull').get(function() {
  return this.participantCount >= this.settings.maxParticipants;
});

// Method to add participant
rideSchema.methods.addParticipant = function(userId, carId = null) {
  const existingParticipant = this.participants.find(p => p.user.toString() === userId.toString());
  
  if (existingParticipant) {
    existingParticipant.status = 'CONFIRMED';
    if (carId) existingParticipant.car = carId;
  } else {
    this.participants.push({
      user: userId,
      car: carId,
      status: 'CONFIRMED'
    });
  }
  
  return this.save();
};

// Method to remove participant
rideSchema.methods.removeParticipant = function(userId) {
  const participant = this.participants.find(p => p.user.toString() === userId.toString());
  if (participant) {
    participant.status = 'LEFT';
    participant.leftAt = new Date();
  }
  return this.save();
};

// Method to update participant location
rideSchema.methods.updateParticipantLocation = function(userId, locationData) {
  const participant = this.participants.find(p => p.user.toString() === userId.toString());
  if (participant) {
    participant.currentLocation = {
      coordinates: locationData.coordinates,
      timestamp: new Date(),
      speed: locationData.speed || 0,
      heading: locationData.heading || 0
    };
    participant.isOnline = true;
  }
  return this.save();
};

// Method to add chat message
rideSchema.methods.addChatMessage = function(userId, message, type = 'TEXT') {
  this.chat.push({
    user: userId,
    message,
    type
  });
  return this.save();
};

// Method to start ride
rideSchema.methods.startRide = function() {
  this.status = 'ACTIVE';
  this.schedule.startTime = new Date();
  return this.save();
};

// Method to end ride
rideSchema.methods.endRide = function() {
  this.status = 'COMPLETED';
  this.schedule.endTime = new Date();
  return this.save();
};

// Pre-save middleware to update stats
rideSchema.pre('save', function(next) {
  if (this.schedule.startTime && this.schedule.endTime) {
    this.stats.duration = this.schedule.endTime - this.schedule.startTime;
  }
  next();
});

module.exports = mongoose.model('Ride', rideSchema);