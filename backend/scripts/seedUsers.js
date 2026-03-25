require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

// Seed admin and organizer accounts
const seedUsers = async () => {
  try {
    await connectDB();

    const seeds = [
      {
        firstName: 'System',
        lastName: 'Admin',
        email: 'admin@iiit.ac.in',
        password: 'admin123',
        role: 'Admin',
        isActive: true,
      },
      {
        firstName: 'Fest',
        lastName: 'Organizer',
        email: 'organizer@iiit.ac.in',
        password: 'organizer123',
        role: 'Organizer',
        contactNumber: '9999999999',
        isActive: true,
        organizerProfile: {
          name: 'Fest Club',
          category: 'Cultural',
          description: 'Default organizer seeded for testing',
          contactEmail: 'organizer@iiit.ac.in',
          contactNumber: '9999999999'
        }
      }
    ];

    for (const seed of seeds) {
      const existing = await User.findOne({ email: seed.email.toLowerCase() }).select('_id role');
      if (existing) {
        console.log(`Skipping ${seed.email} (already exists as ${existing.role})`);
        continue;
      }

      const user = await User.create(seed);
      console.log(`Created ${seed.role}: ${seed.email}`);
    }

    console.log('Seeding complete');
  } catch (err) {
    console.error('Seeding failed:', err.message);
  } finally {
    mongoose.connection.close();
  }
};

seedUsers();
