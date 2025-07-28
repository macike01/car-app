const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Ride = require('../models/Ride');

const connectedUsers = new Map(); // userId -> socket
const rideRooms = new Map(); // rideId -> Set of userIds

const handleSocketConnection = (socket, io) => {
  console.log('New socket connection:', socket.id);

  // Authenticate socket connection
  socket.on('authenticate', async (data) => {
    try {
      const { token } = data;
      if (!token) {
        socket.emit('auth_error', { message: 'No token provided' });
        return;
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      const user = await User.findById(decoded.userId);
      
      if (!user) {
        socket.emit('auth_error', { message: 'Invalid token' });
        return;
      }

      // Store user connection
      socket.userId = user._id;
      socket.user = user;
      connectedUsers.set(user._id.toString(), socket);

      // Update user online status
      await User.findByIdAndUpdate(user._id, {
        isOnline: true,
        lastSeen: new Date()
      });

      // Join user's active rides
      const activeRides = await Ride.find({
        'participants.user': user._id,
        status: 'ACTIVE'
      });

      activeRides.forEach(ride => {
        socket.join(`ride_${ride._id}`);
        if (!rideRooms.has(ride._id.toString())) {
          rideRooms.set(ride._id.toString(), new Set());
        }
        rideRooms.get(ride._id.toString()).add(user._id.toString());
      });

      socket.emit('authenticated', {
        userId: user._id,
        username: user.username,
        activeRides: activeRides.map(ride => ride._id)
      });

      // Notify friends that user is online
      const friends = await User.find({
        'friends.user': user._id,
        'friends.status': 'ACCEPTED'
      });

      friends.forEach(friend => {
        const friendSocket = connectedUsers.get(friend._id.toString());
        if (friendSocket) {
          friendSocket.emit('friend_online', {
            userId: user._id,
            username: user.username
          });
        }
      });

    } catch (error) {
      console.error('Socket authentication error:', error);
      socket.emit('auth_error', { message: 'Authentication failed' });
    }
  });

  // Join ride room
  socket.on('join_ride', async (data) => {
    try {
      const { rideId } = data;
      if (!socket.userId) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }

      const ride = await Ride.findById(rideId);
      if (!ride) {
        socket.emit('error', { message: 'Ride not found' });
        return;
      }

      // Check if user is participant
      const isParticipant = ride.participants.some(
        p => p.user.toString() === socket.userId.toString()
      );

      if (!isParticipant) {
        socket.emit('error', { message: 'Not a participant of this ride' });
        return;
      }

      socket.join(`ride_${rideId}`);
      if (!rideRooms.has(rideId)) {
        rideRooms.set(rideId, new Set());
      }
      rideRooms.get(rideId).add(socket.userId.toString());

      socket.emit('joined_ride', { rideId });

      // Notify other participants
      socket.to(`ride_${rideId}`).emit('participant_joined', {
        userId: socket.userId,
        username: socket.user.username
      });

    } catch (error) {
      console.error('Join ride error:', error);
      socket.emit('error', { message: 'Failed to join ride' });
    }
  });

  // Leave ride room
  socket.on('leave_ride', async (data) => {
    try {
      const { rideId } = data;
      if (!socket.userId) return;

      socket.leave(`ride_${rideId}`);
      
      if (rideRooms.has(rideId)) {
        rideRooms.get(rideId).delete(socket.userId.toString());
        if (rideRooms.get(rideId).size === 0) {
          rideRooms.delete(rideId);
        }
      }

      socket.emit('left_ride', { rideId });

      // Notify other participants
      socket.to(`ride_${rideId}`).emit('participant_left', {
        userId: socket.userId,
        username: socket.user.username
      });

    } catch (error) {
      console.error('Leave ride error:', error);
    }
  });

  // Update location during ride
  socket.on('update_location', async (data) => {
    try {
      const { rideId, location } = data;
      if (!socket.userId) return;

      const ride = await Ride.findById(rideId);
      if (!ride) return;

      // Update participant location
      await ride.updateParticipantLocation(socket.userId, location);

      // Broadcast to other participants
      socket.to(`ride_${rideId}`).emit('participant_location', {
        userId: socket.userId,
        username: socket.user.username,
        location: {
          coordinates: location.coordinates,
          timestamp: new Date(),
          speed: location.speed || 0,
          heading: location.heading || 0
        }
      });

    } catch (error) {
      console.error('Update location error:', error);
    }
  });

  // Send chat message
  socket.on('send_message', async (data) => {
    try {
      const { rideId, message, type = 'TEXT' } = data;
      if (!socket.userId) return;

      const ride = await Ride.findById(rideId);
      if (!ride) return;

      // Add message to ride chat
      await ride.addChatMessage(socket.userId, message, type);

      // Broadcast to all participants
      io.to(`ride_${rideId}`).emit('new_message', {
        userId: socket.userId,
        username: socket.user.username,
        message,
        type,
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Send message error:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Start ride
  socket.on('start_ride', async (data) => {
    try {
      const { rideId } = data;
      if (!socket.userId) return;

      const ride = await Ride.findById(rideId);
      if (!ride) return;

      // Check if user is organizer
      if (ride.organizer.toString() !== socket.userId.toString()) {
        socket.emit('error', { message: 'Only organizer can start ride' });
        return;
      }

      await ride.startRide();

      // Notify all participants
      io.to(`ride_${rideId}`).emit('ride_started', {
        rideId,
        startTime: ride.schedule.startTime
      });

    } catch (error) {
      console.error('Start ride error:', error);
      socket.emit('error', { message: 'Failed to start ride' });
    }
  });

  // End ride
  socket.on('end_ride', async (data) => {
    try {
      const { rideId } = data;
      if (!socket.userId) return;

      const ride = await Ride.findById(rideId);
      if (!ride) return;

      // Check if user is organizer
      if (ride.organizer.toString() !== socket.userId.toString()) {
        socket.emit('error', { message: 'Only organizer can end ride' });
        return;
      }

      await ride.endRide();

      // Notify all participants
      io.to(`ride_${rideId}`).emit('ride_ended', {
        rideId,
        endTime: ride.schedule.endTime,
        stats: ride.stats
      });

    } catch (error) {
      console.error('End ride error:', error);
      socket.emit('error', { message: 'Failed to end ride' });
    }
  });

  // Typing indicator
  socket.on('typing', (data) => {
    const { rideId, isTyping } = data;
    if (!socket.userId) return;

    socket.to(`ride_${rideId}`).emit('user_typing', {
      userId: socket.userId,
      username: socket.user.username,
      isTyping
    });
  });

  // Disconnect handling
  socket.on('disconnect', async () => {
    try {
      if (socket.userId) {
        // Remove from connected users
        connectedUsers.delete(socket.userId.toString());

        // Update user offline status
        await User.findByIdAndUpdate(socket.userId, {
          isOnline: false,
          lastSeen: new Date()
        });

        // Remove from ride rooms
        rideRooms.forEach((users, rideId) => {
          users.delete(socket.userId.toString());
          if (users.size === 0) {
            rideRooms.delete(rideId);
          }
        });

        // Notify friends that user is offline
        const friends = await User.find({
          'friends.user': socket.userId,
          'friends.status': 'ACCEPTED'
        });

        friends.forEach(friend => {
          const friendSocket = connectedUsers.get(friend._id.toString());
          if (friendSocket) {
            friendSocket.emit('friend_offline', {
              userId: socket.userId,
              username: socket.user.username
            });
          }
        });
      }

      console.log('Socket disconnected:', socket.id);
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  });
};

module.exports = {
  handleSocketConnection,
  connectedUsers,
  rideRooms
};