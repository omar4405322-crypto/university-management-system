import assert from "node:assert/strict";
import http from "node:http";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "critical-route-validation-test-secret-2026";

const [{ default: app }, { default: prisma }, { generateAccessToken }] =
  await Promise.all([
    import("../src/app"),
    import("../src/utils/prismaClient"),
    import("../src/utils/jwt.utils"),
  ]);

const originalUserFindUnique = prisma.user.findUnique;
(prisma.user.findUnique as any) = async () => ({
  id: 1,
  email: "route-validation@example.test",
  role: "SUPER_ADMIN",
  adminRole: null,
  collegeId: null,
  departmentId: null,
  managedCollegeId: null,
  managedDepartmentId: null,
  tokenVersion: 0,
  profilePicture: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  isActive: true,
  student: null,
  doctor: null,
  teachingAssistant: null,
});

const server = http.createServer(app);
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert.ok(address && typeof address === "object");
const baseUrl = `http://127.0.0.1:${address.port}/api`;
const token = generateAccessToken(1, 0);

const request = (path: string, method: string, body?: unknown) =>
  fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

try {
  const cases: Array<[string, string, unknown?]> = [
    [
      "/doctors/not-an-id/reset-password",
      "PATCH",
      { newPassword: "StrongPass!2026" },
    ],
    [
      "/enrollments",
      "POST",
      { studentId: "invalid", courseId: 1, semester: 1, academicYear: 2026 },
    ],
    ["/enrollments/not-an-id", "DELETE"],
    ["/enrollments/not-an-id/grade", "PATCH", { finalGrade: 90 }],
    ["/enrollments/1/grade", "PATCH", { finalGrade: "not-a-grade" }],
    ["/timetable", "POST", { collegeId: "invalid" }],
    ["/timetable/not-an-id", "PUT", { title: "Updated" }],
    ["/exams/questions/not-an-id", "DELETE"],
    ["/exams/not-an-id/start", "POST"],
    ["/exams/submissions/not-an-id/grade", "PUT", { score: 10 }],
  ];

  for (const [path, method, body] of cases) {
    const response = await request(path, method, body);
    assert.equal(
      response.status,
      422,
      `${method} ${path} must reject malformed input in the route validation layer`,
    );
  }
} finally {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  prisma.user.findUnique = originalUserFindUnique;
}

console.log("Critical route validation security checks passed");
