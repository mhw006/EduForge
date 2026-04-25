// Redirect to single Prisma instance — all files should use this or lib/prisma.js
const prisma = require('./lib/prisma');
module.exports = { prisma };