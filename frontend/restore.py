import subprocess
import os

broken_files = [
    "src/components/ui/Pagination.tsx",
    "src/pages/colleges/AddCollegeModal.tsx",
    "src/pages/colleges/AssignAdminModal.tsx",
    "src/pages/courses/AddCourseModal.tsx",
    "src/pages/courses/CourseModal.tsx",
    "src/pages/courses/CoursesList.tsx",
    "src/pages/courses/EditCourseModal.tsx",
    "src/pages/finance/AddPaymentModal.tsx",
    "src/pages/quizzes/CreateQuiz.tsx",
    "src/pages/registration/AdminsList.tsx",
    "src/pages/schedules/TimetableModal.tsx",
    "src/pages/students/AddStudentModal.tsx",
    "src/pages/students/EditStudentModal.tsx",
    "src/pages/tasks/TasksList.tsx"
]

for file in broken_files:
    git_path_tsx = f"frontend/{file}"
    git_path_jsx = f"frontend/{file.replace('.tsx', '.jsx')}"
    
    try:
        content = subprocess.check_output(['git', 'show', f'HEAD:{git_path_tsx}']).decode('utf-8')
        with open(file, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Restored {file} from .tsx")
    except subprocess.CalledProcessError:
        try:
            content = subprocess.check_output(['git', 'show', f'HEAD:{git_path_jsx}']).decode('utf-8')
            with open(file, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Restored {file} from .jsx")
        except Exception as e:
            print(f"Failed to restore {file}: {e}")
