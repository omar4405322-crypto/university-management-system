const prisma = require('../utils/prismaClient');

(async () => {
  try {
	const users = await prisma.user.findMany({
	  where: { role: 'SUPER_ADMIN' },
	  select: { id: true, email: true, role: true, managedCollegeId: true, managedDepartmentId: true, createdAt: true }
	});
	console.log(JSON.stringify(users, null, 2));
	process.exit(0);
  } catch (err) {
	console.error('ERR', err);
	process.exit(1);
  }
})();