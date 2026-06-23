SELECT doc.id, doc."firstName", doc."lastName", doc."departmentId", d.name as dept_name
FROM "Doctor" doc
LEFT JOIN "Department" d ON d.id = doc."departmentId"
ORDER BY doc."departmentId", doc.id
LIMIT 20;
