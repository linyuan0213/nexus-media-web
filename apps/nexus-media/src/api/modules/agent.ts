/**
 * Agent 消息交互 API
 * 对应后端: /api/agent/*
 */
import { requestClient } from '#/api/request';

export namespace AgentApi {
  /** 对话 SSE 事件 */
  export interface ChatEvent {
    type:
      | 'answer'
      | 'confirm_required'
      | 'error'
      | 'reasoning'
      | 'token'
      | 'tool_call'
      | 'tool_result';
    content?: string;
    tool?: string;
    parameters?: Record<string, any>;
    arguments?: Record<string, any>;
    message?: string;
    success?: boolean;
    need_confirm?: boolean;
    step?: number;
  }

  /** 消息流条目（命令回复 + 事件通知） */
  export interface MessageStreamItem {
    id?: number;
    cursor: number;
    kind: 'list' | 'notify' | 'reply';
    title: string;
    content: string;
    image?: string;
    items?: AgentApi.ListItem[];
    url?: string;
    read?: boolean;
    time: string;
    ts?: number;
  }

  /** 列表消息条目 */
  export interface ListItem {
    index: number;
    title: string;
    vote?: string;
    type?: string;
    year?: string;
    image?: string;
    url?: string;
  }
}

/** SSE data 块解析（处理单条完整事件块） */
function parseSseBlock(block: string, onEvent: (data: any) => void) {
  const trimmed = block.trim();
  if (!trimmed) return;
  for (const line of trimmed.split('\n')) {
    if (line.startsWith(':')) break; // 心跳注释
    if (line.startsWith('data:')) {
      try {
        onEvent(JSON.parse(line.slice(5).trim()));
      } catch {
        // ignore parse errors
      }
    }
  }
}

/** Agent 对话（POST SSE 流式） */
export function streamAgentChat(
  payload: {
    disable_thinking?: boolean;
    question: string;
    /** 推理强度：low | high | max（空 = 使用后端配置默认） */
    reasoning_effort?: '' | 'high' | 'low' | 'max';
    session_id?: string;
  },
  callbacks: {
    onEnd?: () => void;
    onError?: (error: any) => void;
    onEvent: (event: AgentApi.ChatEvent) => void;
  },
  signal?: AbortSignal,
) {
  // 跨网络块缓冲：事件可能被 TCP 分块拆开，按 \n\n 边界拼完整后再解析
  let buffer = '';
  return requestClient
    .postSSE('/agent/chat', payload, {
      signal,
      headers: { 'Content-Type': 'application/json' },
      onMessage: (content: string) => {
        buffer += content;
        let idx = buffer.indexOf('\n\n');
        while (idx !== -1) {
          parseSseBlock(buffer.slice(0, idx), callbacks.onEvent);
          buffer = buffer.slice(idx + 2);
          idx = buffer.indexOf('\n\n');
        }
      },
    })
    .catch((error) => {
      callbacks.onError?.(error);
    })
    .finally(() => {
      // 流结束时处理残留的未闭合事件
      if (buffer.trim()) parseSseBlock(buffer, callbacks.onEvent);
      callbacks.onEnd?.();
    });
}

/** 危险操作确认 */
export function confirmAgentChat(data: {
  arguments: Record<string, any>;
  session_id?: string;
  tool: string;
}) {
  return requestClient.post('/agent/chat/confirm', data);
}

/** 清空会话 */
export function clearAgentChat(sessionId: string) {
  return requestClient.post('/agent/chat/clear', { session_id: sessionId });
}

/** 知识库状态 */
export function getAgentKbStatus() {
  return requestClient.post<{ namespaces: Record<string, number> }>(
    '/agent/kb/status',
    {},
  );
}

/** 内置命令交互（agent 未启用时：订阅/下载/搜索等命令） */
export function interactMessage(text: string) {
  return requestClient.post('/agent/message/interact', { text });
}

/** 未读消息数（通知栏红点徽标） */
export function getMessageUnreadCount() {
  return requestClient.get<{ unread: number }>('/agent/message/unread-count');
}

/** 未读消息列表 + 未读数（通知栏下拉，轻量接口） */
export function getMessageUnreadList(limit = 100) {
  return requestClient.get<{
    messages: AgentApi.MessageStreamItem[];
    unread: number;
  }>('/agent/message/unread', { params: { limit } });
}

/** 标记已读（ids 为空则全部已读） */
export function markMessageRead(ids?: number[]) {
  return requestClient.post<{ marked: number }>('/agent/message/read', {
    ids: ids ?? null,
  });
}

/** 长程记忆列表 */
export function getAgentMemories() {
  return requestClient.get<{ memories: { source: string; text: string }[] }>(
    '/agent/memory',
  );
}

/** 删除长程记忆 */
export function deleteAgentMemory(text: string) {
  return requestClient.post('/agent/memory/delete', { text });
}

/** 会话历史（刷新后恢复对话） */
export function getConversation(sessionId = '') {
  return requestClient.get<{
    messages: { content: string; role: 'assistant' | 'user' }[];
  }>('/agent/conversation', { params: { session_id: sessionId } });
}

/** 通知历史（刷新后恢复显示） */
export function getMessageHistory(limit = 50) {
  return requestClient.get<{
    messages: AgentApi.MessageStreamItem[];
  }>('/agent/message/history', { params: { limit } });
}

/** 消息流（GET SSE：命令回复 + 事件通知） */
export function streamMessages(
  cursor: number,
  callbacks: {
    onEnd?: () => void;
    onEvent: (item: AgentApi.MessageStreamItem) => void;
  },
  signal?: AbortSignal,
) {
  let buffer = '';
  return requestClient
    .requestSSE(`/agent/message/stream?cursor=${cursor}`, undefined, {
      method: 'GET',
      signal,
      onMessage: (content: string) => {
        buffer += content;
        let idx = buffer.indexOf('\n\n');
        while (idx !== -1) {
          parseSseBlock(buffer.slice(0, idx), callbacks.onEvent);
          buffer = buffer.slice(idx + 2);
          idx = buffer.indexOf('\n\n');
        }
      },
    })
    .catch(() => {
      // 断线由调用方重连
    })
    .finally(() => {
      if (buffer.trim()) parseSseBlock(buffer, callbacks.onEvent);
      callbacks.onEnd?.();
    });
}

/** 知识库重建索引（可指定命名空间） */
export function reindexAgentKb(namespace?: string) {
  return requestClient.post<{ indexed: Record<string, number> }>(
    '/agent/kb/reindex',
    { namespace: namespace ?? null },
  );
}

/** 知识库检索（调试） */
export function searchAgentKb(query: string, namespace?: string) {
  return requestClient.post<{
    citations: {
      heading?: string;
      score?: number;
      snippet: string;
      source: string;
    }[];
    hit: boolean;
  }>('/agent/kb/search', { query, namespace: namespace ?? null });
}

/** 读取内置文档 Markdown（消息中心"相关文档"链接查看） */
export function readAgentDoc(name: string) {
  return requestClient.post<{ content: string; name: string }>(
    '/system/docs/read',
    { name },
  );
}
