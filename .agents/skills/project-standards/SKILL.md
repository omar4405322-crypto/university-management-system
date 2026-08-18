---
name: project-standards
description: Standard rules for the University Management System project. Use them in any code modifications or reviews.
---

# Project Standards
- Design: bg-slate-50/slate-900, rounded-2xl, RTL logical CSS properties, basic green buttons
- Prohibited: Adding a new @ts-nocheck. If the file already contains one and you are modifying it, I suggest removing it.
- Prohibited: Using window.prompt in the interface
- Static libraries: Prisma only as an ORM, date-fns-tz locked to Africa/Cairo, Redis for TOTP
- Any modification must check user permissions (SuperAdmin/College Admin/Department Admin/Doctor/TA/Student) before execution
