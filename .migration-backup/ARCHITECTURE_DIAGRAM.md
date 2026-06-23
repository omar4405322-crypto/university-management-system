# Architecture & Error Handling Flow

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER INTERACTION                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. User clicks "Add College" button                                │
│  2. Modal opens with form                                           │
│  3. User fills form: { name, nameAr, description }                 │
│  4. User clicks "Add College" submit button                         │
│                                                                     │
└────────────────────┬────────────────────────────────────────────────┘
					 │
					 ▼
┌─────────────────────────────────────────────────────────────────────┐
│              AddCollegeModal.jsx (handleSubmit)                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ✅ Validate: name.trim() not empty?                               │
│      NO ──→ Show "Please enter college name" toast + STOP          │
│      YES ──→ Continue                                              │
│                                                                     │
│  ✅ Set loading = true (disable form, change button text)          │
│                                                                     │
│  ✅ Call: collegeService.createCollege(formData)                   │
│                                                                     │
└────────────────────┬────────────────────────────────────────────────┘
					 │
					 ▼
┌─────────────────────────────────────────────────────────────────────┐
│         college.service.js (createCollege method)                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ✅ POST /api/colleges with { name, nameAr, description }          │
│     (via api.axios instance with interceptors)                     │
│                                                                     │
│  Try-Catch block:                                                   │
│      ├─ Success: Response 201 ──→ return { success: true }        │
│      │                                                              │
│      └─ Error: Any status (401, 403, 500, etc.)                    │
│          ├─ BEFORE: return { success: false } ❌ ERROR SWALLOWED!  │
│          └─ AFTER:  throw error ✅ PROPAGATED                     │
│                                                                     │
└────────────────────┬────────────────────────────────────────────────┘
					 │
			┌────────┴─────────┐
			│                  │
			▼ (Success)        ▼ (Error)
	  ┌──────────────┐    ┌──────────────────────┐
	  │ return {     │    │ throw error          │
	  │   success: ✅│    │ (caught by try-catch)│
	  │ }            │    └──────────────────────┘
	  └──────┬───────┘              │
			 │                      │
			 ▼                      ▼
┌──────────────────────────┐  ┌─────────────────────────────────────┐
│ if (result.success) ✅   │  │ catch (error) ✅ NOW WORKS!         │
├──────────────────────────┤  ├─────────────────────────────────────┤
│                          │  │                                     │
│ • Show success toast     │  │ • getErrorMessage(error):           │
│ • onSuccess()            │  │   ├─ status 403? Permission error   │
│ • Reset form             │  │   ├─ status 401? Session expired    │
│ • Close modal            │  │   ├─ data.message? Use it           │
│                          │  │   └─ else: Generic error            │
└──────────────────────────┘  │                                     │
							  │ • Show error toast                  │
							  │ • Keep modal open                   │
							  │ • Allow retry                       │
							  │                                     │
							  └─────────────────────────────────────┘
									  │
									  ▼
							  ┌──────────────────┐
							  │ Show error toast │
							  │ (red, 4 seconds) │
							  └──────────────────┘
									  │
									  ▼
							  ┌──────────────────┐
							  │ Set loading=false│
							  │ Re-enable form   │
							  │ Re-enable buttons│
							  └──────────────────┘
```

---

## Error Status Handling

```
┌────────────────────────────────────────────────────────────────┐
│              API Response Status Codes                          │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  201 Created ✅                                                │
│  ├─ Response: { success: true, data: college }                │
│  └─ Action: Show success toast, close modal, refresh list    │
│                                                                │
│  400 Bad Request ⚠️                                            │
│  ├─ Response: { success: false, message: "..." }             │
│  └─ Action: Show validation error from backend                │
│                                                                │
│  401 Unauthorized ⚠️                                          │
│  ├─ Interceptor: Auto-retry with token refresh               │
│  ├─ If refresh fails: Redirect to /login?expired=true        │
│  └─ Modal: "Your session has expired. Please login again."   │
│                                                                │
│  403 Forbidden ⚠️                                             │
│  ├─ Response: { success: false, message: "..." }             │
│  └─ Modal: "You don't have permission..." (SUPER_ADMIN only) │
│                                                                │
│  500 Internal Server Error ❌                                 │
│  ├─ Response: { success: false, message: "..." }             │
│  └─ Modal: Backend error message or "Please try again"       │
│                                                                │
│  Network Error (ERR_NETWORK) ❌                               │
│  ├─ Interceptor: Returns custom message                       │
│  └─ Modal: "Unable to connect to server..."                  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## API Interceptor Error Formatting

```javascript
┌─────────────────────────────────────────┐
│   Axios Error (raw)                     │
├─────────────────────────────────────────┤
│                                         │
│  {                                      │
│    response: {                          │
│      status: 403,                       │
│      data: {                            │
│        success: false,                  │
│        message: "Insufficient rights"   │
│      }                                  │
│    },                                   │
│    message: "Request failed...",        │
│    code: "ERR_BAD_REQUEST"              │
│  }                                      │
│                                         │
└──────────────┬──────────────────────────┘
			   │
			   │ (transformed by interceptor)
			   │
			   ▼
┌──────────────────────────────────────────────┐
│   Standardized Error (what modal receives)   │
├──────────────────────────────────────────────┤
│                                              │
│  {                                           │
│    message: "Insufficient rights",           │
│    status: 403,                              │
│    data: {                                   │
│      success: false,                         │
│      message: "Insufficient rights"          │
│    }                                         │
│  }                                           │
│                                              │
│  ✅ Easy to access:                          │
│     • error.status         → 403             │
│     • error.data.message   → "Insufficient..│
│     • error.message        → "Insufficient..│
│                                              │
└──────────────────────────────────────────────┘
```

---

## Authorization Flow

```
┌─────────────────────────────────────────────────────────────┐
│            College Service Authorization                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Backend Route: POST /api/colleges                          │
│  ├─ Middleware 1: protect        → Check if logged in      │
│  ├─ Middleware 2: authorize('SUPER_ADMIN') → Check role    │
│  ├─ Middleware 3: collegeValidation → Validate fields      │
│  ├─ Middleware 4: validate       → Check validator results │
│  └─ Controller: createCollege    → Save to database         │
│                                                             │
│  ✅ Success (all pass):                                    │
│     201 Created + { success: true, data: college }          │
│                                                             │
│  ❌ Failure - Not logged in:                               │
│     401 Unauthorized                                        │
│     (Axios interceptor catches, tries refresh)             │
│                                                             │
│  ❌ Failure - Not SUPER_ADMIN:                             │
│     403 Forbidden                                           │
│     (Modal shows: "Only Super Admins can create colleges") │
│                                                             │
│  ❌ Failure - Invalid fields:                              │
│     422 Unprocessable Entity                               │
│     Response: { message: "Field 'name' is required" }       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Component State During Request

```
IDLE STATE (Before click)
┌─────────────────────────────┐
│ Form Inputs:  ENABLED       │
│ Submit Button: ENABLED      │
│  └─ Text: "Add College"     │
│  └─ Icon: No spinner        │
│ Cancel Button: ENABLED      │
│ Loading Toast: NONE         │
└─────────────────────────────┘
			│ User clicks button
			▼
LOADING STATE (Request in progress)
┌─────────────────────────────┐
│ Form Inputs:  DISABLED ✋    │
│  └─ Opacity: 50%            │
│  └─ Cursor: not-allowed     │
│ Submit Button: DISABLED ✋   │
│  └─ Text: "Creating..."     │
│  └─ Icon: Spinner (animated)│
│ Cancel Button: DISABLED ✋   │
│ Loading Toast: NONE         │
└─────────────────────────────┘
   ┌─────────────────┬────────────────┐
   │ 1-3 seconds     │                │
   ▼                 ▼                ▼
SUCCESS           TIMEOUT/ERROR    NETWORK ERROR
┌───────────────┐ ┌──────────────┐ ┌──────────────┐
│ Green toast   │ │ Red toast    │ │ Red toast    │
│ "College      │ │ "Failed to   │ │ "Unable to   │
│  added..."    │ │  create..."  │ │  connect..." │
│               │ │ Keep modal   │ │ Keep modal   │
│ Modal closes  │ │ Open for     │ │ Open for     │
│ (2 sec delay) │ │ retry        │ │ retry        │
│               │ │              │ │              │
│ Form ENABLED  │ │ Form ENABLED │ │ Form ENABLED │
└───────────────┘ └──────────────┘ └──────────────┘
```

---

## Code Flow Comparison

### ❌ BEFORE (Broken)
```
Button Click
	↓ handleSubmit
Form Validation (basic)
	↓
collegeService.createCollege()
	↓
try {
  API.post() → ERROR
  return { success: false }  ← Returns, doesn't throw!
}
	↓
const result = { success: false }
	↓
if (result.success) { ... }  ← False, so nothing happens
	↓
catch (error) { ... }  ← Never executes
	↓
User sees: NOTHING (button goes back to normal state)
```

### ✅ AFTER (Fixed)
```
Button Click
	↓ handleSubmit
Form Validation (with .trim())
	↓
if (!formData.name.trim()) {
  showToast("Please enter...", "error")
  return  ← Exit early
}
	↓
collegeService.createCollege()
	↓
try {
  API.post() → ERROR
  throw error  ← Properly throws!
}
	↓
finally {
  setLoading(false)  ← Always executes
}
	↓
catch (error) {  ← NOW CATCHES!
  getErrorMessage(error) → Specific message
  showToast(message, "error")
}
	↓
User sees: 
  • During request: "Creating..." with spinner
  • After success: Green toast, modal closes
  • After error: Red toast with specific reason
```
