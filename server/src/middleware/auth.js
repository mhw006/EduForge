const { clerkMiddleware, requireAuth } = require('@clerk/express');

// Apply to all routes
const clerk = clerkMiddleware();

// Protect specific routes
const protect = requireAuth();

module.exports = { clerk, protect };