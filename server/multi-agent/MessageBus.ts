/**
 * 消息总线 - Agent间通信的中枢
 * P1改进：支持多Agent的异步通信和消息路由
 */

import { db } from "../db";
import { agentMessages } from "../../drizzle/schema";
import { AgentMessage, AgentMessageType, MessageStatus } from "../config/types";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import EventEmitter from "events";

export interface MessageHandler {
  (message: AgentMessage): Promise<void>;
}

export class MessageBus extends EventEmitter {
  private handlers: Map<AgentMessageType, MessageHandler[]> = new Map();
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000;

  constructor() {
    super();
  }

  /**
   * 发送消息
   */
  async sendMessage(
    fromAgentId: string,
    toAgentId: string,
    messageType: AgentMessageType,
    messageData: Record<string, any>
  ): Promise<AgentMessage> {
    const messageId = nanoid();

    const message: AgentMessage = {
      messageId,
      fromAgentId,
      toAgentId,
      messageType,
      messageData,
      status: MessageStatus.PENDING,
      retryCount: 0,
    };

    // 保存消息到数据库
    await db.insert(agentMessages).values(message);

    // 发出消息事件
    this.emit("message:sent", message);

    // 异步处理消息
    this.processMessage(message).catch((error) => {
      console.error(`Failed to process message ${messageId}:`, error);
    });

    return message;
  }

  /**
   * 处理消息
   */
  private async processMessage(message: AgentMessage): Promise<void> {
    try {
      // 获取消息类型的处理器
      const handlers = this.handlers.get(message.messageType) || [];

      if (handlers.length === 0) {
        // 没有处理器，标记为已处理
        await this.updateMessageStatus(message.messageId, MessageStatus.PROCESSED);
        return;
      }

      // 执行所有处理器
      for (const handler of handlers) {
        try {
          await handler(message);
        } catch (error) {
          console.error(`Handler error for message ${message.messageId}:`, error);
        }
      }

      // 标记消息为已处理
      await this.updateMessageStatus(message.messageId, MessageStatus.PROCESSED);

      // 发出消息处理完成事件
      this.emit("message:processed", message);
    } catch (error) {
      console.error(`Failed to process message ${message.messageId}:`, error);

      // 重试处理
      await this.retryMessage(message);
    }
  }

  /**
   * 重试消息
   */
  private async retryMessage(message: AgentMessage): Promise<void> {
    if (!message.id) return;

    const retryCount = (message.retryCount || 0) + 1;

    if (retryCount >= this.MAX_RETRIES) {
      // 达到最大重试次数，标记为失败
      await this.updateMessageStatus(message.messageId, MessageStatus.FAILED);
      this.emit("message:failed", message);
      return;
    }

    // 更新重试次数
    await db
      .update(agentMessages)
      .set({
        retryCount,
      })
      .where(eq(agentMessages.messageId, message.messageId));

    // 延迟后重试
    const delay = this.RETRY_DELAY * Math.pow(2, retryCount - 1);
    setTimeout(() => {
      this.processMessage({ ...message, retryCount }).catch((error) => {
        console.error(`Failed to retry message ${message.messageId}:`, error);
      });
    }, delay);
  }

  /**
   * 更新消息状态
   */
  private async updateMessageStatus(
    messageId: string,
    status: MessageStatus
  ): Promise<void> {
    await db
      .update(agentMessages)
      .set({
        status,
        processedAt: new Date(),
      })
      .where(eq(agentMessages.messageId, messageId));
  }

  /**
   * 注册消息处理器
   */
  subscribe(messageType: AgentMessageType, handler: MessageHandler): void {
    if (!this.handlers.has(messageType)) {
      this.handlers.set(messageType, []);
    }

    this.handlers.get(messageType)!.push(handler);
  }

  /**
   * 注销消息处理器
   */
  unsubscribe(messageType: AgentMessageType, handler: MessageHandler): void {
    const handlers = this.handlers.get(messageType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * 获取待处理消息
   */
  async getPendingMessages(toAgentId: string): Promise<AgentMessage[]> {
    return await db
      .select()
      .from(agentMessages)
      .where(
        and(
          eq(agentMessages.toAgentId, toAgentId),
          eq(agentMessages.status, MessageStatus.PENDING)
        )
      );
  }

  /**
   * 获取消息历史
   */
  async getMessageHistory(
    fromAgentId?: string,
    toAgentId?: string,
    limit: number = 100
  ): Promise<AgentMessage[]> {
    let query = db.select().from(agentMessages);

    const conditions: any[] = [];
    if (fromAgentId) {
      conditions.push(eq(agentMessages.fromAgentId, fromAgentId));
    }
    if (toAgentId) {
      conditions.push(eq(agentMessages.toAgentId, toAgentId));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    return await query.limit(limit).orderBy((t) => t.createdAt);
  }

  /**
   * 清理旧消息
   */
  async cleanup(olderThanDays: number = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    // 这里应该删除旧消息
    // 暂时为空，后续集成真实的清理逻辑
  }
}

// 导出单例
export const messageBus = new MessageBus();
