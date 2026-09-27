import assert from "node:assert/strict";
import prisma from "../src/utils/prismaClient";
import { getAllUsers } from "../src/controllers/user.controller";

async function invokeController(
  controller: any,
  request: Record<string, unknown>,
) {
  return new Promise<any>((resolve, reject) => {
    const response: any = {
      status: () => response,
      json: (body: unknown) => resolve(body),
    };
    controller(request, response, (error?: unknown) => reject(error));
  });
}

async function runUserListPerformanceTests() {
  const originalFindMany = prisma.user.findMany;
  const originalCount = prisma.user.count;
  const originalGroupBy = prisma.user.groupBy;
  const originalCollegeFindUnique = prisma.college.findUnique;
  const calls: Array<{ method: string; args: any }> = [];

  try {
    (prisma.user as any).findMany = async (args: any) => {
      calls.push({ method: "findMany", args });
      return [
        {
          id: 1,
          role: "ADMIN",
          managedCollege: { id: 4, name: "Engineering" },
        },
      ];
    };
    (prisma.user as any).count = async (args: any) => {
      calls.push({ method: "count", args });
      return 21;
    };
    (prisma.user as any).groupBy = async (args: any) => {
      calls.push({ method: "groupBy", args });
      return [{ role: "ADMIN", isActive: true, _count: { _all: 21 } }];
    };
    (prisma.college as any).findUnique = async () => {
      throw new Error("Per-user college lookup must not run");
    };

    const result = await invokeController(getAllUsers, {
      user: { role: "SUPER_ADMIN" },
      query: {
        role: "SUPER_ADMIN,ADMIN,COLLEGE_ADMIN,DEPARTMENT_ADMIN",
        search: "eng",
        status: "active",
        page: "3",
        limit: "10",
      },
    });

    assert.equal(calls.length, 3, "User list must use a fixed query count");
    const listCall = calls.find((call) => call.method === "findMany")!;
    assert.equal(listCall.args.skip, 20);
    assert.equal(listCall.args.take, 10);
    assert.deepEqual(listCall.args.where.role, {
      in: ["SUPER_ADMIN", "ADMIN", "COLLEGE_ADMIN", "DEPARTMENT_ADMIN"],
    });
    assert.equal(listCall.args.where.isActive, true);
    assert.ok(
      listCall.args.where.AND,
      "Search must be applied by Prisma before pagination",
    );
    assert.deepEqual(listCall.args.select.managedCollege, {
      select: { id: true, name: true },
    });
    assert.equal(result.data.length, 1);
    assert.deepEqual(result.pagination, {
      page: 3,
      limit: 10,
      total: 21,
      totalPages: 3,
    });
  } finally {
    (prisma.user as any).findMany = originalFindMany;
    (prisma.user as any).count = originalCount;
    (prisma.user as any).groupBy = originalGroupBy;
    (prisma.college as any).findUnique = originalCollegeFindUnique;
  }
}

await runUserListPerformanceTests();
console.log("User list performance checks passed");
