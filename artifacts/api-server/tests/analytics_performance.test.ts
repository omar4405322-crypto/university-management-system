import assert from "node:assert/strict";
import prisma from "../src/utils/prismaClient";
import {
  ANALYTICS_CACHE_TTL_SECONDS,
  getGeneralAnalytics,
  withAnalyticsCache,
} from "../src/controllers/analytics.controller";

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

async function runAnalyticsPerformanceTests() {
  let cached: unknown = null;
  let loadCount = 0;
  let writtenTtl = 0;
  const cache = {
    get: async () => cached,
    set: async (_key: string, value: unknown, ttl: number) => {
      cached = value;
      writtenTtl = ttl;
    },
  };
  const load = async () => {
    loadCount += 1;
    return { marker: "database-result" };
  };
  const first = await withAnalyticsCache("analytics:test", load, cache);
  const second = await withAnalyticsCache("analytics:test", load, cache);
  assert.deepEqual(first, second);
  assert.equal(
    loadCount,
    1,
    "Second identical request must be served from cache",
  );
  assert.equal(writtenTtl, ANALYTICS_CACHE_TTL_SECONDS);

  const delegates: Array<[any, string]> = [
    [prisma.college, "findMany"],
    [prisma.payment, "groupBy"],
    [prisma.student, "groupBy"],
    [prisma.department, "findMany"],
    [prisma.exam, "groupBy"],
    [prisma.attendance, "groupBy"],
  ];
  const originals = delegates.map(([delegate, method]) => delegate[method]);
  const originalQueryRaw = prisma.$queryRaw;
  let monthlySql = "";

  try {
    delegates.forEach(([delegate, method]) => {
      delegate[method] = async () => [];
    });
    (prisma as any).$queryRaw = async (query: any) => {
      monthlySql = query.sql || query.text || String(query);
      return [{ month: new Date("2026-01-01T00:00:00.000Z"), count: 250n }];
    };

    const result = await invokeController(getGeneralAnalytics, {
      user: { role: "DEPARTMENT_ADMIN", managedDepartmentId: 7 },
      query: { startDate: "2026-01-01", endDate: "2026-12-31" },
    });
    assert.match(monthlySql, /DATE_TRUNC\('month'/i);
    assert.match(monthlySql, /GROUP BY/i);
    assert.equal(result.data.enrollmentTrends[0].count, 250);
  } finally {
    delegates.forEach(([delegate, method], index) => {
      delegate[method] = originals[index];
    });
    (prisma as any).$queryRaw = originalQueryRaw;
  }
}

await runAnalyticsPerformanceTests();
console.log("Analytics performance checks passed");
