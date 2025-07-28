/*
 * Global script for Car Crew Network
 * This file defines helper functions for retrieving and saving user data
 * to localStorage. Pages can import this file and access common utilities.
 */

// Default user structure used when no data is present in localStorage
const DEFAULT_USER = {
  name: '',
  car: '',
  points: 0,
  tasks: {},
  clubs: [],
  visited: [],
  blogs: []
};

// Retrieve user from localStorage or create default
function getUser() {
  try {
    const stored = localStorage.getItem('carCrewUser');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (err) {
    console.warn('Error reading user from localStorage', err);
  }
  return { ...DEFAULT_USER };
}

// Save user back to localStorage
function saveUser(user) {
  try {
    localStorage.setItem('carCrewUser', JSON.stringify(user));
  } catch (err) {
    console.warn('Error saving user to localStorage', err);
  }
}

// Add points and optionally record task name
function addPoints(points, taskName) {
  const user = getUser();
  user.points = (user.points || 0) + points;
  if (taskName) {
    user.tasks[taskName] = true;
  }
  saveUser(user);
}

// Check if a task has been completed
function hasCompleted(taskName) {
  const user = getUser();
  return !!user.tasks[taskName];
}

// Join a club by name
function joinClub(clubName) {
  const user = getUser();
  if (!user.clubs.includes(clubName)) {
    user.clubs.push(clubName);
    // Save the updated club membership before awarding points
    saveUser(user);
    // Award points for joining a club. addPoints will persist the updated user internally.
    addPoints(50, `joinClub-${clubName}`);
  }
}

// Record a visited location by id
function markVisited(locationId) {
  const user = getUser();
  if (!user.visited.includes(locationId)) {
    user.visited.push(locationId);
    addPoints(25, `visit-${locationId}`);
  }
  saveUser(user);
}

// Create a blog post
function createBlogPost(title, content) {
  const user = getUser();
  user.blogs.push({ title, content, date: new Date().toISOString() });
  addPoints(30, `blog-${title}`);
  saveUser(user);
}

// Utility to generate a random blog post tailored to the user
function generatePersonalBlog() {
  const user = getUser();
  const name = user.name || 'Driver';
  const car = user.car || 'my car';
  const adjectives = ['thrilling', 'serene', 'memorable', 'vibrant', 'inspiring'];
  const activities = ['cruised along the coast', 'climbed winding mountains', 'explored hidden backroads', 'enjoyed city night rides', 'visited scenic viewpoints'];
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const activity = activities[Math.floor(Math.random() * activities.length)];
  const title = `${name}'s ${adjective} journey`;
  const content = `Today I took ${car} and ${activity}. It was a ${adjective} experience that reminded me why I love driving. Looking forward to the next adventure!`;
  return { title, content };
}

// Generate the leaderboard using dummy data and the current user
function getLeaderboard() {
  const user = getUser();
  const sample = [
    { name: 'Alex', points: 1500 },
    { name: 'Maria', points: 1200 },
    { name: 'Sofia', points: 900 },
    { name: 'Lucas', points: 700 }
  ];
  // Insert or update current user into sample list
  const existing = sample.findIndex((u) => u.name === user.name);
  if (user.name) {
    if (existing >= 0) {
      sample[existing].points = user.points;
    } else {
      sample.push({ name: user.name, points: user.points });
    }
  }
  // Sort descending by points
  return sample.sort((a, b) => b.points - a.points);
}

// Expose some functions globally for pages to use
window.carCrew = {
  getUser,
  saveUser,
  addPoints,
  hasCompleted,
  joinClub,
  markVisited,
  createBlogPost,
  generatePersonalBlog,
  getLeaderboard
};