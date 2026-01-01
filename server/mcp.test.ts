import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };

  return { ctx };
}

describe("mcp router", () => {
  it("should return available MCP servers", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const servers = await caller.mcp.servers();

    expect(Array.isArray(servers)).toBe(true);
    // 应该至少有notion服务器
    const notionServer = servers.find(s => s.name === 'notion');
    expect(notionServer).toBeDefined();
    expect(notionServer?.enabled).toBe(true);
  });

  it("should return MCP call logs", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const logs = await caller.mcp.logs({ limit: 10 });

    expect(Array.isArray(logs)).toBe(true);
  });
});
