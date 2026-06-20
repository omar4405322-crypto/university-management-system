import re

with open('frontend/src/pages/LandingPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Imports
content = content.replace("import { Link } from 'react-router-dom';", "import { Link } from 'react-router-dom';\nimport { CollegesSection, colleges } from '../components/CollegesSection';\nimport { CountUp } from '../components/ui/CountUp';")

# 2. Stats definition replacement
old_stats = """  const stats = [
    { 
      label: 'طالب مسجل', 
      value: universityStats ? `+${universityStats.totalStudents.toLocaleString('ar-EG')}` : null,
      icon: <Users size={24} strokeWidth={2} /> 
    },
    { 
      label: 'كلية أكاديمية', 
      value: universityStats ? universityStats.totalColleges.toLocaleString('ar-EG') : null,
      icon: <Building2 size={24} strokeWidth={2} /> 
    },
    { 
      label: 'عضو هيئة تدريس', 
      value: universityStats ? `+${universityStats.totalFaculty.toLocaleString('ar-EG')}` : null,
      icon: <GraduationCap size={24} strokeWidth={2} /> 
    },
    { 
      label: 'تخصص دراسي', 
      value: universityStats ? `+${universityStats.totalSpecializations.toLocaleString('ar-EG')}` : null,
      icon: <BookOpen size={24} strokeWidth={2} /> 
    },
  ];"""

new_stats = """  const stats = [
    { 
      label: 'طالب مسجل', 
      value: universityStats ? <CountUp end={universityStats.totalStudents} prefix="+" /> : null,
      icon: <Users size={24} strokeWidth={2} /> 
    },
    { 
      label: 'كلية أكاديمية', 
      value: universityStats ? <CountUp end={universityStats.totalColleges} /> : null,
      icon: <Building2 size={24} strokeWidth={2} /> 
    },
    { 
      label: 'عضو هيئة تدريس', 
      value: universityStats ? <CountUp end={universityStats.totalFaculty} prefix="+" /> : null,
      icon: <GraduationCap size={24} strokeWidth={2} /> 
    },
    { 
      label: 'تخصص دراسي', 
      value: universityStats ? <CountUp end={universityStats.totalSpecializations} prefix="+" /> : null,
      icon: <BookOpen size={24} strokeWidth={2} /> 
    },
  ];"""
content = content.replace(old_stats, new_stats)

# 3. Remove old colleges array
# We need to find the old array and remove it.
start_str = "  const colleges = ["
end_str = "  const features = ["
start_idx = content.find(start_str)
end_idx = content.find(end_str)
if start_idx != -1 and end_idx != -1:
    content = content[:start_idx] + content[end_idx:]

# 4. Replace 4. Colleges Grid section with Component
start_str_grid = "{/* 4. Colleges Grid */}"
end_str_grid = "{/* 5. Why Choose Us Section */}"
start_idx_grid = content.find(start_str_grid)
end_idx_grid = content.find(end_str_grid)
if start_idx_grid != -1 and end_idx_grid != -1:
    new_colleges_grid = "{/* 4. Colleges Grid */}\n      <CollegesSection isLoading={isLoading} />\n\n      "
    content = content[:start_idx_grid] + new_colleges_grid + content[end_idx_grid:]

with open('frontend/src/pages/LandingPage.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
