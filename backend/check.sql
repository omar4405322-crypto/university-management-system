SELECT 'users' as tbl, COUNT(*) as rows FROM "User"
UNION ALL SELECT 'students', COUNT(*) FROM "Student"  
UNION ALL SELECT 'doctors', COUNT(*) FROM "Doctor"
UNION ALL SELECT 'courses', COUNT(*) FROM "Course"
UNION ALL SELECT 'departments', COUNT(*) FROM "Department"
UNION ALL SELECT 'colleges', COUNT(*) FROM "College"
UNION ALL SELECT 'exams', COUNT(*) FROM "Exam"
UNION ALL SELECT 'quizzes', COUNT(*) FROM "Quiz";
