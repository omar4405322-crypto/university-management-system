---
name: useUniversityStats endpoint
description: The landing page stats hook calls /api/dashboard/stats, not /api/university/stats which doesn't exist.
---

## Rule
`useUniversityStats` hook in `artifacts/university-app/src/hooks/useUniversityStats.ts` must call `/api/dashboard/stats`, not `/api/university/stats`.

**Why:** `/api/university/stats` was a placeholder comment in the original code. The real endpoint is `/api/dashboard/stats`. The hook maps the response shape (using `data.totalStudents`, `data.totalDoctors` → `totalFaculty`, `data.totalDepartments` → `totalSpecializations`).

**How to apply:** If the landing page ever shows blank stats cards, check this hook first.
