# Registration Flow Issues & Resolutions

This document provides a detailed summary of the problems encountered during the registration flow setup and how they were resolved.

---

## 1. AuthContext Global Loading State Disruption

### Symptom
When submitting the registration form, the page would abruptly close or redirect to the login page instead of displaying the pending registration/success screen.

### Root Cause
In `AuthContext.tsx`, the `register` function was modifying the global `loading` state:
```typescript
const register = async (data: any) => {
  try {
    setLoading(true); // <-- Disrupted global state
    ...
  } finally {
    setLoading(false);
  }
};
```
The global `loading` state is reserved for initial session hydration (`initAuth`). Toggling it to `true` during registration caused components tracking auth loading (such as routing guards and wrappers) to re-render, causing the `Register` component to unmount prematurely.

### Resolution
Removed the `setLoading(true)` and `setLoading(false)` calls from the `register` function. Form submitting state is already safely handled locally via React Hook Form's `isSubmitting` property.
* **File modified:** [AuthContext.tsx](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/university-app/src/context/AuthContext.tsx)

---

## 2. Public APIs for Colleges and Departments Protected Behind Auth (Router & App Level)

### Symptom
Dropdowns for "College" and "Department" failed to load options. The browser console showed:
* `GET /api/colleges` → `401 Unauthorized`
* `GET /api/departments` → `401 Unauthorized`

### Root Cause
1. **Router Level:** The backend routes in `college.routes.ts` and `department.routes.ts` had the `protect` middleware applied to the read (`GET`) endpoints.
2. **App Level:** In `app.ts`, the router mount points themselves applied the `protect` middleware globally:
   ```typescript
   app.use('/api/colleges', protect, collegeRoutes);
   app.use('/api/departments', protect, departmentRoutes);
   ```
   Because unregistered users do not yet have an authentication token, these requests were blocked.

### Resolution
1. Removed `protect` from individual GET routes in `college.routes.ts` and `department.routes.ts`.
2. Removed `protect` from the mount point middleware inside `app.ts` so that public read operations are accessible. Write operations (POST, PUT, DELETE) remain fully secure and protected by inline middleware inside the respective routes.
* **Files modified:**
  * [app.ts](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/app.ts)
  * [college.routes.ts](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/routes/college.routes.ts)
  * [department.routes.ts](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/routes/department.routes.ts)

---

## 3. Unauthenticated Scope Filtering on Public Departments Query

### Symptom
Even after removing the `protect` middleware, the "Department" list API query returned an empty array `[]` when requested without an active login token.

### Root Cause
In `department.controller.ts`, the query utilizes the `getScopeWhere` utility function to determine scope rules.
For unauthenticated requests (where `user` is undefined/null), `getScopeWhere` returned `{ id: -1 }` by default:
```typescript
if (!user) return { id: -1 };
```
This query criteria returned no results for public users attempting to look up departments.

### Resolution
Modified `getScopeWhere` in `scope.utils.ts` to return an empty filter `{}` instead of `{ id: -1 }` when requested for the `department` entity without a token. This allows public lookups while keeping other entities fully protected.
* **File modified:** [scope.utils.ts](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/utils/scope.utils.ts)

---

## 4. Response Interceptor Redirecting to Login Page

### Symptom
Upon encountering any `401 Unauthorized` response on the Register page (such as the failed token refresh or fetching colleges), the user was booted back to the Login page.

### Root Cause
The global Axios response interceptor in `api.ts` was configured to automatically redirect the user to `/login?expired=true` if any API request returned a `401` status and the refresh token attempt failed:
```typescript
if (!window.location.pathname.includes('/login') && !(window as any).__isRedirecting) {
  (window as any).__isRedirecting = true;
  window.location.href = '/login?expired=true';
}
```
Since `/register` is a public page where requests are expected to lack a token, this redirect was incorrectly triggered.

### Resolution
Updated the interceptor redirect logic to check if the user is already on a public page (`/login` or `/register`). If they are on a public page, the redirect is bypassed, allowing the page to handle the error status gracefully.
* **File modified:** [api.ts](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/university-app/src/services/api.ts)

---

## 5. Non-localized English Options in Dropdowns under Arabic Locale

### Symptom
In Arabic locale, the fetched list of colleges and departments loaded the English column (`college.name` / `dept.name`) instead of the Arabic localization values.

### Root Cause
In `Register.tsx`, the mapping logic for option tags was hardcoded to display `{college.name}` and `{dept.name}` regardless of the active language locale.

### Resolution
Imported `useLanguage` into `Register.tsx` to read the global `isRTL` setting and dynamically render option text labels:
* `{isRTL ? college.nameAr || college.name : college.name}`
* `{isRTL ? dept.nameAr || dept.name : dept.name}`
* **File modified:** [Register.tsx](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/university-app/src/pages/Register.tsx)
