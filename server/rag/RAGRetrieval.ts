/**
 * RAG检索服务 - 混合检索和重排序
 * P1改进：支持BM25+向量混合检索和智能重排序
 */

import { db } from "../db";
import { knowledgeChunks, knowledge } from "../../drizzle/schema";
import { eq, like, sql } from "drizzle-orm";

export interface SearchQuery {
  text: string;
  limit?: number;
  threshold?: number;
}

export interface SearchResult {
  chunkId: number;
  knowledgeId: number;
  content: string;
  score: number;
  source: "bm25" | "vector" | "hybrid";
  metadata?: Record<string, any>;
}

export interface RerankConfig {
  enabled: boolean;
  model?: string;
  topK?: number;
  threshold?: number;
}

export class RAGRetrieval {
  private readonly DEFAULT_LIMIT = 10;
  private readonly DEFAULT_THRESHOLD = 0.3;
  private readonly BM25_WEIGHT = 0.4;
  private readonly VECTOR_WEIGHT = 0.6;

  /**
   * BM25全文检索
   */
  async searchBM25(query: SearchQuery): Promise<SearchResult[]> {
    const limit = query.limit || this.DEFAULT_LIMIT;

    // 使用MySQL的全文搜索
    // 注意：这需要在knowledge_chunks表上创建FULLTEXT索引
    const results = await db
      .select({
        id: knowledgeChunks.id,
        knowledgeId: knowledgeChunks.knowledgeId,
        content: knowledgeChunks.content,
        metadata: knowledgeChunks.metadata,
        score: sql<number>`MATCH(${knowledgeChunks.content}) AGAINST(${query.text} IN BOOLEAN MODE)`,
      })
      .from(knowledgeChunks)
      .where(
        sql`MATCH(${knowledgeChunks.content}) AGAINST(${query.text} IN BOOLEAN MODE)`
      )
      .limit(limit);

    return results.map((r) => ({
      chunkId: r.id,
      knowledgeId: r.knowledgeId,
      content: r.content,
      score: r.score || 0,
      source: "bm25" as const,
      metadata: r.metadata,
    }));
  }

  /**
   * 向量相似度检索
   */
  async searchVector(
    queryEmbedding: number[],
    query: SearchQuery
  ): Promise<SearchResult[]> {
    const limit = query.limit || this.DEFAULT_LIMIT;
    const threshold = query.threshold || this.DEFAULT_THRESHOLD;

    // 使用pgvector或MySQL向量扩展进行相似度搜索
    // 这里使用MySQL 8.0.14+的向量功能
    // 实际实现需要根据数据库类型调整
    const results = await db
      .select({
        id: knowledgeChunks.id,
        knowledgeId: knowledgeChunks.knowledgeId,
        content: knowledgeChunks.content,
        metadata: knowledgeChunks.metadata,
        embedding: knowledgeChunks.embedding,
      })
      .from(knowledgeChunks)
      .limit(limit);

    // 计算相似度（余弦相似度）
    const scored = results
      .map((r) => {
        const score = this.cosineSimilarity(queryEmbedding, this.parseEmbedding(r.embedding));
        return {
          chunkId: r.id,
          knowledgeId: r.knowledgeId,
          content: r.content,
          score,
          source: "vector" as const,
          metadata: r.metadata,
        };
      })
      .filter((r) => r.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored;
  }

  /**
   * 混合检索 - BM25 + 向量
   */
  async searchHybrid(
    queryEmbedding: number[],
    query: SearchQuery
  ): Promise<SearchResult[]> {
    // 并行执行BM25和向量检索
    const [bm25Results, vectorResults] = await Promise.all([
      this.searchBM25(query),
      this.searchVector(queryEmbedding, query),
    ]);

    // 使用倒数融合排序 (RRF) 合并结果
    const merged = this.reciprocalRankFusion(bm25Results, vectorResults);

    // 应用权重
    const weighted = merged.map((r) => ({
      ...r,
      score:
        r.source === "bm25"
          ? r.score * this.BM25_WEIGHT
          : r.source === "vector"
            ? r.score * this.VECTOR_WEIGHT
            : r.score,
    }));

    // 排序并返回
    return weighted
      .sort((a, b) => b.score - a.score)
      .slice(0, query.limit || this.DEFAULT_LIMIT);
  }

  /**
   * 倒数融合排序 (RRF)
   */
  private reciprocalRankFusion(
    bm25Results: SearchResult[],
    vectorResults: SearchResult[]
  ): SearchResult[] {
    const merged = new Map<number, SearchResult>();
    const k = 60; // RRF参数

    // 处理BM25结果
    bm25Results.forEach((r, index) => {
      const score = 1 / (k + index + 1);
      merged.set(r.chunkId, {
        ...r,
        score,
        source: "bm25",
      });
    });

    // 处理向量结果
    vectorResults.forEach((r, index) => {
      const score = 1 / (k + index + 1);
      if (merged.has(r.chunkId)) {
        const existing = merged.get(r.chunkId)!;
        existing.score += score;
        existing.source = "hybrid";
      } else {
        merged.set(r.chunkId, {
          ...r,
          score,
          source: "vector",
        });
      }
    });

    return Array.from(merged.values());
  }

  /**
   * 重排序
   */
  async rerank(
    results: SearchResult[],
    query: string,
    config: RerankConfig = { enabled: false }
  ): Promise<SearchResult[]> {
    if (!config.enabled) {
      return results;
    }

    // 这里应该调用重排序模型（如bge-reranker-v2-m3）
    // 暂时返回原始结果，后续集成真实的重排序逻辑
    return results.sort((a, b) => b.score - a.score).slice(0, config.topK || 10);
  }

  /**
   * 完整检索流程
   */
  async search(
    queryEmbedding: number[],
    query: SearchQuery,
    rerankConfig?: RerankConfig
  ): Promise<SearchResult[]> {
    // 执行混合检索
    const results = await this.searchHybrid(queryEmbedding, query);

    // 执行重排序
    if (rerankConfig?.enabled) {
      return await this.rerank(results, query.text, rerankConfig);
    }

    return results;
  }

  /**
   * 获取检索配置
   */
  async getRetrievalConfig(): Promise<{
    bm25Weight: number;
    vectorWeight: number;
    defaultLimit: number;
    defaultThreshold: number;
  }> {
    return {
      bm25Weight: this.BM25_WEIGHT,
      vectorWeight: this.VECTOR_WEIGHT,
      defaultLimit: this.DEFAULT_LIMIT,
      defaultThreshold: this.DEFAULT_THRESHOLD,
    };
  }

  /**
   * 更新检索配置
   */
  async updateRetrievalConfig(config: {
    bm25Weight?: number;
    vectorWeight?: number;
    defaultLimit?: number;
    defaultThreshold?: number;
  }): Promise<void> {
    // 这里应该将配置保存到数据库
    // 暂时为空，后续集成真实的配置保存逻辑
  }

  /**
   * 计算余弦相似度
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * 解析嵌入向量
   */
  private parseEmbedding(embedding: string | null): number[] {
    if (!embedding) {
      return [];
    }

    try {
      return JSON.parse(embedding);
    } catch {
      return [];
    }
  }
}

// 导出单例
export const ragRetrieval = new RAGRetrieval();
