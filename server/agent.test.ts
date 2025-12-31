import { describe, expect, it, vi, beforeEach } from "vitest";
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

describe("ticket router", () => {
  it("should return ticket stats", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const stats = await caller.ticket.stats();

    expect(stats).toHaveProperty("total");
    expect(stats).toHaveProperty("resolved");
    expect(stats).toHaveProperty("resolveRate");
    expect(typeof stats.total).toBe("number");
    expect(typeof stats.resolved).toBe("number");
    expect(typeof stats.resolveRate).toBe("number");
  });

  it("should list tickets with pagination", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ticket.list({ limit: 10 });

    expect(result).toHaveProperty("tickets");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result.tickets)).toBe(true);
  });
});

describe("tool router", () => {
  it("should return tool stats", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const stats = await caller.tool.stats();

    expect(stats).toHaveProperty("totalTools");
    expect(stats).toHaveProperty("totalUsage");
    expect(stats).toHaveProperty("avgSuccessRate");
    expect(typeof stats.totalTools).toBe("number");
    expect(typeof stats.totalUsage).toBe("number");
  });

  it("should list tools", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const tools = await caller.tool.list({});

    expect(Array.isArray(tools)).toBe(true);
  });

  it("should initialize preset tools", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.tool.initPreset();

    expect(result).toHaveProperty("results");
    expect(Array.isArray(result.results)).toBe(true);
    
    // Each result should have name and status
    result.results.forEach(r => {
      expect(r).toHaveProperty("name");
      expect(r).toHaveProperty("status");
      expect(["created", "exists", "error"]).toContain(r.status);
    });
  });
});

describe("knowledge router", () => {
  it("should list knowledge items", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.knowledge.list({});

    expect(result).toHaveProperty("items");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result.items)).toBe(true);
  });

  it("should create knowledge item", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const newKnowledge = await caller.knowledge.create({
      title: "Test Knowledge",
      content: "This is test content for knowledge base",
      category: "fault_case",
      systemType: "mes",
      tags: ["test", "demo"]
    });

    expect(newKnowledge).toHaveProperty("id");
    expect(newKnowledge.title).toBe("Test Knowledge");
    expect(newKnowledge.category).toBe("fault_case");
  });
});
