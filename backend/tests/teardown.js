const { PrismaClient } = require('@prisma/client');
const { redis } = require('../src/utils/redis.utils');



module.exports = async () => { 
  const prisma = new PrismaClient(); 
  await prisma.$disconnect(); 
  if (redis) {
    await redis.quit();
  }
};
