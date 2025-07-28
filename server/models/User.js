const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  profile: {
    firstName: {
      type: String,
      required: true,
      trim: true
    },
    lastName: {
      type: String,
      required: true,
      trim: true
    },
    avatar: {
      type: String,
      default: null
    },
    bio: {
      type: String,
      maxlength: 500,
      default: ''
    },
    location: {
      city: String,
      state: String,
      country: String,
      coordinates: {
        lat: Number,
        lng: Number
      }
    },
    dateOfBirth: Date,
    phoneNumber: String,
    socialLinks: {
      instagram: String,
      facebook: String,
      twitter: String,
      youtube: String
    }
  },
  gamification: {
    points: {
      type: Number,
      default: 0
    },
    level: {
      type: Number,
      default: 1
    },
    experience: {
      type: Number,
      default: 0
    },
    badges: [{
      type: String,
      enum: [
        'FIRST_RIDE', 'EVENT_ORGANIZER', 'SPOT_HUNTER', 'CREW_LEADER',
        'MILESTONE_DRIVER', 'COMMUNITY_BUILDER', 'PHOTOGRAPHER', 'ROAD_TRIPPER',
        'SPEED_DEMON', 'ECO_DRIVER', 'NIGHT_RIDER', 'WEEKEND_WARRIOR'
      ]
    }],
    achievements: [{
      name: String,
      description: String,
      earnedAt: {
        type: Date,
        default: Date.now
      },
      points: Number
    }],
    stats: {
      totalRides: { type: Number, default: 0 },
      totalDistance: { type: Number, default: 0 },
      eventsAttended: { type: Number, default: 0 },
      eventsOrganized: { type: Number, default: 0 },
      spotsVisited: { type: Number, default: 0 },
      photosShared: { type: Number, default: 0 },
      crewMemberships: { type: Number, default: 0 }
    }
  },
  preferences: {
    carTypes: [String],
    drivingStyle: {
      type: String,
      enum: ['CASUAL', 'SPIRITED', 'TRACK', 'CRUISING', 'OFF_ROAD'],
      default: 'CASUAL'
    },
    notificationSettings: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      rideInvites: { type: Boolean, default: true },
      eventUpdates: { type: Boolean, default: true },
      achievementAlerts: { type: Boolean, default: true }
    },
    privacySettings: {
      profileVisibility: {
        type: String,
        enum: ['PUBLIC', 'FRIENDS', 'PRIVATE'],
        default: 'PUBLIC'
      },
      locationSharing: {
        type: String,
        enum: ['ALWAYS', 'RIDES_ONLY', 'NEVER'],
        default: 'RIDES_ONLY'
      },
      showOnlineStatus: { type: Boolean, default: true }
    }
  },
  cars: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Car'
  }],
  crews: [{
    crew: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Crew'
    },
    role: {
      type: String,
      enum: ['MEMBER', 'MODERATOR', 'LEADER'],
      default: 'MEMBER'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  friends: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'BLOCKED'],
      default: 'PENDING'
    },
    requestedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isOnline: {
    type: Boolean,
    default: false
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isPremium: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for better performance
userSchema.index({ username: 1 });
userSchema.index({ email: 1 });
userSchema.index({ 'gamification.points': -1 });
userSchema.index({ 'profile.location.coordinates': '2dsphere' });

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to add points and level up
userSchema.methods.addPoints = function(points, reason = '') {
  this.gamification.points += points;
  this.gamification.experience += points;
  
  // Level up logic (every 1000 points = 1 level)
  const newLevel = Math.floor(this.gamification.experience / 1000) + 1;
  if (newLevel > this.gamification.level) {
    this.gamification.level = newLevel;
  }
  
  // Add achievement if reason provided
  if (reason) {
    this.gamification.achievements.push({
      name: reason,
      description: `Earned ${points} points`,
      points: points
    });
  }
  
  return this.save();
};

// Method to add badge
userSchema.methods.addBadge = function(badgeType) {
  if (!this.gamification.badges.includes(badgeType)) {
    this.gamification.badges.push(badgeType);
    return this.save();
  }
  return Promise.resolve(this);
};

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.profile.firstName} ${this.profile.lastName}`;
});

// Virtual for display name
userSchema.virtual('displayName').get(function() {
  return this.username;
});

module.exports = mongoose.model('User', userSchema);