# SCHEDULING-CONTROLLER-SNIPPETS.md

## updateSchedule (`schedules.controller.ts:268-357`)

```typescript
268: export const updateSchedule = catchAsync(
269:   async (req: Request, res: Response, next: NextFunction) => {
270:     const { dayOfWeek, startTime, endTime, room, teachingAssistantId, courseId, doctorId, groupId, slotType } = req.body;
271:     const slotId = parseInt(req.params.id as string);
272: 
273:     const existing = await prisma.scheduleSlot.findUnique({
274:       where: { id: slotId },
275:       include: { course: true }
276:     });
277:     if (!existing) return next(new NotFoundError('ScheduleSlot not found'));
278: 
279:     const newCourseId = courseId ? parseInt(courseId as string) : existing.courseId;
280:     const newDoctorId = doctorId !== undefined ? (doctorId ? parseInt(doctorId as string) : null) : existing.doctorId;
281:     const newGroupId = groupId !== undefined ? (groupId ? parseInt(groupId as string) : null) : existing.groupId;
282:     const newTeachingAssistantId = teachingAssistantId !== undefined ? teachingAssistantId : existing.teachingAssistantId;
283: 
284:     if (req.user!.role === 'DOCTOR') {
285:       const myDoctor = await prisma.doctor.findUnique({ where: { userId: req.user!.id } });
286:       if (!myDoctor || existing.doctorId !== myDoctor.id) {
287:         return next(new AuthorizationError('You can only modify slots for your own sections'));
288:       }
289:     }
290:     if (req.user!.role === 'TEACHING_ASSISTANT') {
291:       if (existing.teachingAssistantId !== req.user!.teachingAssistant?.id) {
292:         return next(new AuthorizationError('You can only modify slots assigned to you'));
293:       }
294:       if (newTeachingAssistantId !== req.user!.teachingAssistant?.id) {
295:         return next(new AuthorizationError('You cannot reassign to another TA'));
296:       }
297:     }
298: 
299:     let targetTimetableId = existing.timetableId;
300: 
301:     if (courseId && newCourseId !== existing.courseId) {
302:       const course = await prisma.course.findUnique({ where: { id: newCourseId } });
303:       if (!course) return next(new NotFoundError('Course not found'));
304: 
305:       const foundTb = await prisma.timetable.findFirst({
306:         where: {
307:           departmentId: course.departmentId!,
308:           academicYear: course.year,
309:           semester: course.semester,
310:         }
311:       });
312:       targetTimetableId = foundTb ? foundTb.id : null;
313:     } else if (!targetTimetableId && existing.course) {
314:       const foundTb = await prisma.timetable.findFirst({
315:         where: {
316:           departmentId: existing.course.departmentId!,
317:           academicYear: existing.course.year,
318:           semester: existing.course.semester,
319:         }
320:       });
321:       if (foundTb) targetTimetableId = foundTb.id;
322:     }
323: 
324:     const scheduleSlot = await prisma.$transaction(async (tx) => {
325:       await TimetableService.checkConflicts({
326:         dayOfWeek: dayOfWeek || existing.dayOfWeek,
327:         startTime: startTime || existing.startTime,
328:         endTime: endTime || existing.endTime,
329:         room: room !== undefined ? room : existing.room,
330:         courseId: newCourseId,
331:         doctorId: newDoctorId,
332:         groupId: newGroupId,
333:         teachingAssistantId: newTeachingAssistantId,
334:         excludeSlotId: slotId,
335:       }, tx);
336: 
337:       return tx.scheduleSlot.update({
338:         where: { id: slotId },
339:         data: {
340:           dayOfWeek,
341:           startTime,
342:           endTime,
343:           room,
344:           teachingAssistantId,
345: 
346:           courseId: newCourseId,
347:           doctorId: newDoctorId,
348:           groupId: newGroupId,
349:           slotType: slotType || undefined,
350:           timetableId: targetTimetableId,
351:         },
352:       });
353:     }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
354: 
355:     res.json({ success: true, data: scheduleSlot });
356:   }
357: );
```

## deleteSchedule (`schedules.controller.ts:359-381`)

```typescript
359: export const deleteSchedule = catchAsync(
360:   async (req: Request, res: Response, next: NextFunction) => {
361:     const slotId = parseInt(req.params.id as string);
362:     const existing = await prisma.scheduleSlot.findUnique({
363:       where: { id: slotId },
364:     });
365:     if (!existing) return next(new NotFoundError('ScheduleSlot not found'));
366: 
367:     if (req.user!.role === 'DOCTOR') {
368:       const myDoctor = await prisma.doctor.findUnique({ where: { userId: req.user!.id } });
369:       if (!myDoctor || existing.doctorId !== myDoctor.id) {
370:         return next(new AuthorizationError('You can only delete slots for your own sections'));
371:       }
372:     }
373:     if (req.user!.role === 'TEACHING_ASSISTANT' && existing.teachingAssistantId !== req.user!.teachingAssistant?.id) {
374:       return next(new AuthorizationError('You can only delete slots assigned to you'));
375:     }
376: 
377:     await prisma.scheduleSlot.delete({ where: { id: slotId } });
378:     auditLog('DELETE_SCHEDULE', 'ScheduleSlot', req.params.id as string, req);
379:     res.json({ success: true, message: 'ScheduleSlot deleted' });
380:   }
381: );
```

## updateOverride (`overrides.controller.ts:93-152`)

```typescript
93: export const updateOverride = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
94:   const overrideId = parseInt(req.params.overrideId as string);
95:   const { startDate, endDate, room, dayOfWeek, startTime, endTime, doctorId, teachingAssistantId, reason } = req.body;
96: 
97:   const existing = await prisma.scheduleOverride.findUnique({
98:     where: { id: overrideId },
99:     include: { scheduleSlot: true }
100:   });
101:   if (!existing) return next(new NotFoundError('Override not found'));
102: 
103:   if (req.user!.role === 'DOCTOR') {
104:     const myDoctor = await prisma.doctor.findUnique({ where: { userId: req.user!.id } });
105:     if (!myDoctor || existing.scheduleSlot.doctorId !== myDoctor.id) {
106:       return next(new AuthorizationError('You can only update overrides for your own sections'));
107:     }
108:   }
109:   if (req.user!.role === 'TEACHING_ASSISTANT' && existing.scheduleSlot.teachingAssistantId !== req.user!.teachingAssistant?.id) {
110:     return next(new AuthorizationError('You can only update overrides for slots assigned to you'));
111:   }
112: 
113:   const newStartDate = startDate ? new Date(startDate) : existing.startDate;
114:   const newEndDate = endDate ? new Date(endDate) : existing.endDate;
115: 
116:   if (newStartDate > newEndDate) {
117:     return next(new ValidationError('startDate must be before or equal to endDate'));
118:   }
119: 
120:   const override = await prisma.$transaction(async (tx) => {
121:     // Conflict Check
122:     await TimetableService.checkConflicts({
123:       dayOfWeek: dayOfWeek || existing.dayOfWeek || existing.scheduleSlot.dayOfWeek,
124:       startTime: startTime || existing.startTime || existing.scheduleSlot.startTime,
125:       endTime: endTime || existing.endTime || existing.scheduleSlot.endTime,
126:       room: room !== undefined ? room : (existing.room || existing.scheduleSlot.room),
127:       courseId: existing.scheduleSlot.courseId,
128:       doctorId: doctorId ? parseInt(doctorId) : (existing.doctorId || existing.scheduleSlot.doctorId),
129:       groupId: existing.scheduleSlot.groupId,
130:       teachingAssistantId: teachingAssistantId !== undefined ? teachingAssistantId : (existing.teachingAssistantId || existing.scheduleSlot.teachingAssistantId),
131:       excludeSlotId: existing.scheduleSlotId,
132:     }, tx);
133: 
134:     return tx.scheduleOverride.update({
135:       where: { id: overrideId },
136:       data: {
137:         startDate: newStartDate,
138:         endDate: newEndDate,
139:         room,
140:         dayOfWeek,
141:         startTime,
142:         endTime,
143:         doctorId: doctorId ? parseInt(doctorId) : null,
144:         teachingAssistantId,
145:         reason,
146:       },
147:     });
148:   }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
149: 
150:   auditLog('UPDATE_OVERRIDE', 'ScheduleOverride', override.id.toString(), req);
151:   res.json({ success: true, data: override });
152: });
```

## deleteOverride (`overrides.controller.ts:154-175`)

```typescript
154: export const deleteOverride = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
155:   const overrideId = parseInt(req.params.overrideId as string);
156:   const existing = await prisma.scheduleOverride.findUnique({ 
157:     where: { id: overrideId },
158:     include: { scheduleSlot: true }
159:   });
160:   if (!existing) return next(new NotFoundError('Override not found'));
161: 
162:   if (req.user!.role === 'DOCTOR') {
163:     const myDoctor = await prisma.doctor.findUnique({ where: { userId: req.user!.id } });
164:     if (!myDoctor || existing.scheduleSlot.doctorId !== myDoctor.id) {
165:       return next(new AuthorizationError('You can only delete overrides for your own sections'));
166:     }
167:   }
168:   if (req.user!.role === 'TEACHING_ASSISTANT' && existing.scheduleSlot.teachingAssistantId !== req.user!.teachingAssistant?.id) {
169:     return next(new AuthorizationError('You can only delete overrides for slots assigned to you'));
170:   }
171: 
172:   await prisma.scheduleOverride.delete({ where: { id: overrideId } });
173:   auditLog('DELETE_OVERRIDE', 'ScheduleOverride', overrideId.toString(), req);
174:   res.json({ success: true, message: 'Override deleted' });
175: });
```

## createTimetable (`timetable.controller.ts:111-180`)

```typescript
111: export const createTimetable = catchAsync(
112:   async (req: Request, res: Response, next: NextFunction) => {
113:     const {
114:       collegeId,
115:       departmentId,
116:       academicYear,
117:       semester,
118:       title,
119:       description,
120:       fileUrl,
121:       status,
122:     } = req.body;
123: 
124:     // Validation
125:     if (!collegeId || !departmentId || !academicYear || !semester || !title) {
126:       return next(
127:         new AppError('Faculty, Department, Academic Year, Semester, and Title are required', 400)
128:       );
129:     }
130: 
131:     // Enforce scope for creation
132:     const deptScope: any = getScopeWhere(req.user!, 'department');
133:     if (deptScope && Object.keys(deptScope).length) {
134:       if (deptScope.collegeId && parseInt(collegeId as string) !== deptScope.collegeId)
135:         return next(new AuthorizationError('Access denied'));
136:       if (deptScope.id && parseInt(departmentId as string) !== deptScope.id)
137:         return next(new AuthorizationError('Access denied'));
138:     }
139: 
140:     // Check for duplicates (handled by unique constraint in DB, but better to check)
141:     const existing = await prisma.timetable.findUnique({
142:       where: {
143:         collegeId_departmentId_academicYear_semester: {
144:           collegeId: parseInt(collegeId as string),
145:           departmentId: parseInt(departmentId as string),
146:           academicYear: parseInt(academicYear as string),
147:           semester: parseInt(semester as string),
148:         },
149:       },
150:     });
151: 
152:     if (existing) {
153:       return next(
154:         new AppError(
155:           'A timetable for this Faculty, Department, Year, and Semester combination already exists.',
156:           400
157:         )
158:       );
159:     }
160: 
161:     const timetable = await prisma.$transaction(async (tx) => {
162:       const created = await tx.timetable.create({
163:         data: {
164:           collegeId: parseInt(collegeId as string),
165:           departmentId: parseInt(departmentId as string),
166:           academicYear: parseInt(academicYear as string),
167:           semester: parseInt(semester as string),
168:           title,
169:           description,
170:           fileUrl,
171:           status: status || 'DRAFT',
172:         },
173:       });
174: 
175:       return created;
176:     });
177: 
178:     res.status(201).json({ success: true, data: timetable });
179:   }
180: );
```

## updateTimetable (`timetable.controller.ts:187-221`)

```typescript
187: export const updateTimetable = catchAsync(
188:   async (req: Request, res: Response, next: NextFunction) => {
189:     const { title, description, fileUrl, status, academicYear, semester } = req.body;
190:     const id = parseInt(req.params.id as string);
191: 
192:     // Enforce scope on update
193:     const deptScope: any = getScopeWhere(req.user!, 'department');
194:     const existing = await prisma.timetable.findUnique({ where: { id } });
195:     if (!existing) return next(new NotFoundError('Timetable not found'));
196:     if (deptScope && Object.keys(deptScope).length) {
197:       if (deptScope.collegeId && existing.collegeId !== deptScope.collegeId)
198:         return next(new AuthorizationError('Access denied'));
199:       if (deptScope.id && existing.departmentId !== deptScope.id)
200:         return next(new AuthorizationError('Access denied'));
201:     }
202: 
203:     const timetable = await prisma.$transaction(async (tx) => {
204:       const updated = await tx.timetable.update({
205:         where: { id },
206:         data: {
207:           title,
208:           description,
209:           fileUrl,
210:           status,
211:           academicYear: academicYear !== undefined ? parseInt(academicYear as string) : undefined,
212:           semester: semester !== undefined ? parseInt(semester as string) : undefined,
213:         },
214:       });
215: 
216:       return updated;
217:     });
218: 
219:     res.json({ success: true, data: timetable });
220:   }
221: );
```

## deleteTimetable (`timetable.controller.ts:228-248`)

```typescript
228: export const deleteTimetable = catchAsync(
229:   async (req: Request, res: Response, next: NextFunction) => {
230:     const existing = await prisma.timetable.findUnique({
231:       where: { id: parseInt(req.params.id as string) },
232:     });
233:     if (!existing) return next(new NotFoundError('Timetable not found'));
234:     const deptScope: any = getScopeWhere(req.user!, 'department');
235:     if (deptScope && Object.keys(deptScope).length) {
236:       if (deptScope.collegeId && existing.collegeId !== deptScope.collegeId)
237:         return next(new AuthorizationError('Access denied'));
238:       if (deptScope.id && existing.departmentId !== deptScope.id)
239:         return next(new AuthorizationError('Access denied'));
240:     }
241: 
242:     await prisma.timetable.delete({
243:       where: { id: parseInt(req.params.id as string) },
244:     });
245:     auditLog('DELETE_TIMETABLE', 'Timetable', req.params.id as string, req);
246:     res.json({ success: true, message: 'Timetable deleted successfully' });
247:   }
248: );
```

## publishTimetable (`timetable.controller.ts:250-261`)

```typescript
250: export const publishTimetable = catchAsync(
251:   async (req: Request, res: Response, next: NextFunction) => {
252:     const timetable = await prisma.$transaction(async (tx) => {
253:       const updated = await tx.timetable.update({
254:         where: { id: parseInt(req.params.id as string) },
255:         data: { status: 'PUBLISHED' },
256:       });
257:       return updated;
258:     });
259:     res.json({ success: true, data: timetable });
260:   }
261: );
```

## unpublishTimetable (`timetable.controller.ts:263-274`)

```typescript
263: export const unpublishTimetable = catchAsync(
264:   async (req: Request, res: Response, next: NextFunction) => {
265:     const timetable = await prisma.$transaction(async (tx) => {
266:       const updated = await tx.timetable.update({
267:         where: { id: parseInt(req.params.id as string) },
268:         data: { status: 'DRAFT' },
269:       });
270:       return updated;
271:     });
272:     res.json({ success: true, data: timetable });
273:   }
274: );
```
