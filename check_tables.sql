SELECT table_name, 
       (SELECT COUNT(*) FROM information_schema.tables t2 WHERE t2.table_name = t.table_name) as exists
FROM information_schema.tables t
WHERE table_schema = 'public'
ORDER BY table_name;
