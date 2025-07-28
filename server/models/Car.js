const mongoose = require('mongoose');

const carSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  basicInfo: {
    make: {
      type: String,
      required: true,
      trim: true
    },
    model: {
      type: String,
      required: true,
      trim: true
    },
    year: {
      type: Number,
      required: true,
      min: 1900,
      max: new Date().getFullYear() + 1
    },
    trim: String,
    bodyStyle: {
      type: String,
      enum: [
        'SEDAN', 'COUPE', 'HATCHBACK', 'WAGON', 'SUV', 'CROSSOVER',
        'PICKUP', 'CONVERTIBLE', 'ROADSTER', 'VAN', 'MINIVAN', 'OTHER'
      ]
    },
    color: {
      name: String,
      hexCode: String
    },
    vin: {
      type: String,
      unique: true,
      sparse: true,
      uppercase: true
    },
    licensePlate: {
      type: String,
      uppercase: true,
      trim: true
    }
  },
  specifications: {
    engine: {
      displacement: Number, // in liters
      cylinders: Number,
      fuelType: {
        type: String,
        enum: ['GASOLINE', 'DIESEL', 'HYBRID', 'ELECTRIC', 'PLUGIN_HYBRID', 'HYDROGEN']
      },
      horsepower: Number,
      torque: Number,
      transmission: {
        type: String,
        enum: ['MANUAL', 'AUTOMATIC', 'CVT', 'DCT', 'SEMI_AUTO']
      },
      drivetrain: {
        type: String,
        enum: ['FWD', 'RWD', 'AWD', '4WD']
      }
    },
    performance: {
      zeroToSixty: Number, // seconds
      topSpeed: Number, // mph
      quarterMile: Number, // seconds
      fuelEconomy: {
        city: Number, // mpg
        highway: Number, // mpg
        combined: Number // mpg
      }
    },
    dimensions: {
      length: Number, // inches
      width: Number,
      height: Number,
      wheelbase: Number,
      weight: Number // lbs
    }
  },
  modifications: [{
    category: {
      type: String,
      enum: [
        'ENGINE', 'EXHAUST', 'SUSPENSION', 'WHEELS_TIRES', 'BRAKES',
        'INTERIOR', 'EXTERIOR', 'ELECTRONICS', 'AERODYNAMICS', 'OTHER'
      ]
    },
    name: {
      type: String,
      required: true
    },
    brand: String,
    partNumber: String,
    description: String,
    installedDate: {
      type: Date,
      default: Date.now
    },
    cost: Number,
    photos: [String],
    performance: {
      horsepowerGain: Number,
      torqueGain: Number,
      weightChange: Number
    }
  }],
  maintenance: [{
    type: {
      type: String,
      enum: [
        'OIL_CHANGE', 'BRAKE_SERVICE', 'TIRE_ROTATION', 'AIR_FILTER',
        'SPARK_PLUGS', 'TIMING_BELT', 'TRANSMISSION', 'COOLANT',
        'POWER_STEERING', 'OTHER'
      ]
    },
    description: String,
    date: {
      type: Date,
      required: true
    },
    mileage: Number,
    cost: Number,
    shop: String,
    notes: String,
    nextDue: {
      date: Date,
      mileage: Number
    }
  }],
  photos: [{
    url: {
      type: String,
      required: true
    },
    caption: String,
    isPrimary: {
      type: Boolean,
      default: false
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  ownership: {
    purchaseDate: Date,
    purchasePrice: Number,
    purchaseMileage: Number,
    currentMileage: Number,
    isForSale: {
      type: Boolean,
      default: false
    },
    salePrice: Number,
    saleDescription: String
  },
  stats: {
    totalMiles: {
      type: Number,
      default: 0
    },
    averageSpeed: {
      type: Number,
      default: 0
    },
    fuelUsed: {
      type: Number,
      default: 0
    },
    ridesCount: {
      type: Number,
      default: 0
    },
    eventsAttended: {
      type: Number,
      default: 0
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  tags: [String]
}, {
  timestamps: true
});

// Indexes
carSchema.index({ owner: 1 });
carSchema.index({ 'basicInfo.make': 1, 'basicInfo.model': 1 });
carSchema.index({ 'basicInfo.vin': 1 });
carSchema.index({ tags: 1 });

// Virtual for full car name
carSchema.virtual('fullName').get(function() {
  return `${this.basicInfo.year} ${this.basicInfo.make} ${this.basicInfo.model}`;
});

// Virtual for car age
carSchema.virtual('age').get(function() {
  return new Date().getFullYear() - this.basicInfo.year;
});

// Method to add modification
carSchema.methods.addModification = function(modData) {
  this.modifications.push(modData);
  return this.save();
};

// Method to add maintenance record
carSchema.methods.addMaintenance = function(maintenanceData) {
  this.maintenance.push(maintenanceData);
  return this.save();
};

// Method to add photo
carSchema.methods.addPhoto = function(photoData) {
  if (photoData.isPrimary) {
    // Remove primary flag from other photos
    this.photos.forEach(photo => photo.isPrimary = false);
  }
  this.photos.push(photoData);
  return this.save();
};

// Method to update mileage
carSchema.methods.updateMileage = function(newMileage) {
  const oldMileage = this.ownership.currentMileage || 0;
  this.ownership.currentMileage = newMileage;
  this.stats.totalMiles += (newMileage - oldMileage);
  return this.save();
};

// Pre-save middleware to ensure only one primary photo
carSchema.pre('save', function(next) {
  const primaryPhotos = this.photos.filter(photo => photo.isPrimary);
  if (primaryPhotos.length > 1) {
    // Keep only the first primary photo
    let foundPrimary = false;
    this.photos.forEach(photo => {
      if (photo.isPrimary && !foundPrimary) {
        foundPrimary = true;
      } else if (photo.isPrimary) {
        photo.isPrimary = false;
      }
    });
  }
  next();
});

module.exports = mongoose.model('Car', carSchema);