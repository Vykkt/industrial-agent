/**
 * RAG检索API路由
 * P1改进：支持混合检索、重排序、配置管理
 */

import { Router, Request, Response } from "express";
import { ragRetrieval, RerankConfig } from "./RAGRetrieval";

const router = Router();

/**
 * 检索操作
 */

// 执行混合检索
router.post("/search", async (req: Request, res: Response) => {
  try {
    const { query, embedding, limit, threshold, rerank } = req.body;

    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    if (!embedding || !Array.isArray(embedding)) {
      return res.status(400).json({ error: "Valid embedding array is required" });
    }

    const results = await ragRetrieval.search(
      embedding,
      { text: query, limit, threshold },
      rerank as RerankConfig
    );

    res.json({
      query,
      results,
      count: results.length,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// BM25检索
router.post("/search/bm25", async (req: Request, res: Response) => {
  try {
    const { query, limit, threshold } = req.body;

    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    const results = await ragRetrieval.searchBM25({
      text: query,
      limit,
      threshold,
    });

    res.json({
      query,
      results,
      count: results.length,
      source: "bm25",
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// 向量检索
router.post("/search/vector", async (req: Request, res: Response) => {
  try {
    const { embedding, limit, threshold } = req.body;

    if (!embedding || !Array.isArray(embedding)) {
      return res.status(400).json({ error: "Valid embedding array is required" });
    }

    const results = await ragRetrieval.searchVector(
      embedding,
      { text: "", limit, threshold }
    );

    res.json({
      results,
      count: results.length,
      source: "vector",
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// 重排序
router.post("/rerank", async (req: Request, res: Response) => {
  try {
    const { results, query, config } = req.body;

    if (!results || !Array.isArray(results)) {
      return res.status(400).json({ error: "Results array is required" });
    }

    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    const reranked = await ragRetrieval.rerank(results, query, config);

    res.json({
      query,
      results: reranked,
      count: reranked.length,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * 配置管理
 */

// 获取检索配置
router.get("/config", async (req: Request, res: Response) => {
  try {
    const config = await ragRetrieval.getRetrievalConfig();
    res.json(config);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// 更新检索配置
router.put("/config", async (req: Request, res: Response) => {
  try {
    const config = req.body;

    // 验证配置
    if (config.bm25Weight !== undefined && (config.bm25Weight < 0 || config.bm25Weight > 1)) {
      return res.status(400).json({ error: "bm25Weight must be between 0 and 1" });
    }

    if (config.vectorWeight !== undefined && (config.vectorWeight < 0 || config.vectorWeight > 1)) {
      return res.status(400).json({ error: "vectorWeight must be between 0 and 1" });
    }

    if (config.defaultLimit !== undefined && config.defaultLimit < 1) {
      return res.status(400).json({ error: "defaultLimit must be at least 1" });
    }

    if (
      config.defaultThreshold !== undefined &&
      (config.defaultThreshold < 0 || config.defaultThreshold > 1)
    ) {
      return res.status(400).json({ error: "defaultThreshold must be between 0 and 1" });
    }

    await ragRetrieval.updateRetrievalConfig(config);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
