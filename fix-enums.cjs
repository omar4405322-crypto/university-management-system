const fs = require('fs');
const files = ['artifacts/api-server/prisma/seed-realistic-data.ts', 'artifacts/api-server/prisma/seed-timetable.ts', 'artifacts/api-server/prisma/seed.ts', 'artifacts/api-server/src/controllers/requests.controller.ts', 'artifacts/api-server/tests/integration_test.mjs', 'artifacts/api-server/tests/phase5_validation.ts'];
files.forEach(f => {
    let c = fs.readFileSync(f, 'utf8');
    c = c.replace(/'SEMINAR'/g, "'SECTION'").replace(/'TUTORIAL'/g, "'SECTION'").replace(/"SEMINAR"/g, '"SECTION"').replace(/"TUTORIAL"/g, '"SECTION"');
    fs.writeFileSync(f, c);
});
