SELECT d.id, d.name, d."nameAr", d."collegeId", c.name as college_name 
FROM "Department" d 
LEFT JOIN "College" c ON c.id = d."collegeId" 
ORDER BY d."collegeId", d.id;
