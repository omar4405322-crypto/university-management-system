SELECT s.id, s."courseId", c.name as course_name, s."dayOfWeek", s."startTime", s."endTime", s.room
FROM "Schedule" s
JOIN "Course" c ON c.id = s."courseId"
ORDER BY s."courseId";
