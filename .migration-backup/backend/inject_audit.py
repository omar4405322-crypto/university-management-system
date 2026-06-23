import os
import re

d = r'c:\Users\omar4\Desktop\University management system\backend\src\controllers'

targets = {
    'college.controller.js': [
        ('deleteCollege', 'DELETE_COLLEGE', 'College', 'req.params.id', None),
        ('assignAdmin', 'ASSIGN_COLLEGE_ADMIN', 'College', 'req.params.id', None),
    ],
    'courses.controller.js': [
        ('deleteCourse', 'DELETE_COURSE', 'Course', 'req.params.id', None),
    ],
    'department.controller.js': [
        ('deleteDepartment', 'DELETE_DEPARTMENT', 'Department', 'req.params.id', None),
    ],
    'doctors.controller.js': [
        ('deleteDoctor', 'DELETE_DOCTOR', 'Doctor', 'req.params.id', None),
        ('resetDoctorPassword', 'RESET_DOCTOR_PASSWORD', 'Doctor', 'req.params.id', None),
    ],
    'exams.controller.js': [
        ('deleteExam', 'DELETE_EXAM', 'Exam', 'req.params.id', None),
    ],
    'notification.controller.js': [
        ('deleteNotification', 'DELETE_NOTIFICATION', 'Notification', 'req.params.id', None),
    ],
    'payments.controller.js': [
        ('deletePayment', 'DELETE_PAYMENT', 'Payment', 'req.params.id', None),
        ('updatePayment', 'UPDATE_PAYMENT', 'Payment', 'req.params.id', None),
        ('markAsPaid', 'MARK_PAYMENT_PAID', 'Payment', 'req.params.id', None),
    ],
    'schedules.controller.js': [
        ('deleteSchedule', 'DELETE_SCHEDULE', 'Schedule', 'req.params.id', None),
    ],
    'students.controller.js': [
        ('deleteStudent', 'DELETE_STUDENT', 'Student', 'req.params.id', None),
        ('toggleStudentStatus', 'TOGGLE_STUDENT_STATUS', 'Student', 'req.params.id', None),
        ('resetStudentPassword', 'RESET_STUDENT_PASSWORD', 'Student', 'req.params.id', None),
    ],
    'task.controller.js': [
        ('gradeSubmission', 'UPDATE_GRADE', 'TaskSubmission', 'req.params.id', None),
    ],
    'timetable.controller.js': [
        ('deleteTimetable', 'DELETE_TIMETABLE', 'Timetable', 'req.params.id', None),
    ],
    'user.controller.js': [
        ('deleteUser', 'DELETE_USER', 'User', 'req.params.id', None),
        ('createAdmin', 'CREATE_ADMIN', 'User', 'admin ? admin.id : null', None),
        ('setup2FA', 'SETUP_2FA', 'User', 'req.user.id', None),
        ('disable2FA', 'DISABLE_2FA', 'User', 'req.user.id', None),
    ]
}

for f, funcs in targets.items():
    path = os.path.join(d, f)
    if not os.path.exists(path): continue
    
    with open(path, 'r', encoding='utf-8') as file:
        content = file.read()
        
    original = content
    
    if "const { auditLog }" not in content:
        content = re.sub(r"(const [^\n]+require[^\n]+;)\n", r"\1\nconst { auditLog } = require('../utils/audit.utils');\n", content, count=1)
        
    matches = list(re.finditer(r'^\s*exports\.(\w+)', content, re.MULTILINE))
    
    for idx in range(len(matches)-1, -1, -1):
        match = matches[idx]
        func_name = match.group(1)
        target = next((t for t in funcs if t[0] == func_name), None)
        if target:
            func, action, res_type, id_var, changes = target
            start_pos = match.start()
            end_pos = matches[idx+1].start() if idx+1 < len(matches) else len(content)
            
            block = content[start_pos:end_pos]
            
            # The issue last time was that I used `rfind` which found the LAST `res.json` or `res.status`
            # which could be inside a catch block!
            # Let's use a regex to find all `res.json` or `res.status` and we want the one NOT in a catch block.
            # A simple heuristic for these controllers: the success response is usually the last one, BUT if there's a try/catch,
            # the success is right BEFORE `} catch` or `catch`.
            # Let's search for the first `res.status(2` or `res.json({ success: true` 
            # Or we can just look for the last `res.json` that is NOT preceded immediately by `status(4` or `status(5`.
            
            # Find all `res.json` or `res.status` lines.
            lines = block.split('\n')
            insert_line_idx = -1
            indent_str = ""
            for i, line in reversed(list(enumerate(lines))):
                if ('res.json' in line or 'res.status' in line) and ('status(4' not in line and 'status(5' not in line):
                    # check if it looks like success:
                    if 'success: false' not in line and 'message: error.message' not in line:
                        insert_line_idx = i
                        indent_str = line[:len(line) - len(line.lstrip())]
                        break
            
            if insert_line_idx != -1 and action not in block:
                if changes:
                    audit_code = f"{indent_str}auditLog('{action}', '{res_type}', {id_var}, req, {changes});"
                else:
                    audit_code = f"{indent_str}auditLog('{action}', '{res_type}', {id_var}, req);"
                
                lines.insert(insert_line_idx, audit_code)
                new_block = '\n'.join(lines)
                content = content[:start_pos] + new_block + content[end_pos:]

    if content != original:
        with open(path, 'w', encoding='utf-8') as file:
            file.write(content)
        print(f"Updated {f}")
