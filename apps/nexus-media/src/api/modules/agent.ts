/**
 * Agent 消息交互 API
 * 对应后端: /api/agent/*
 */
import { requestClient } from '#/api/request';
import { createSseParser } from '#/utils/sse';

export namespace AgentApi {
  /** 对话 SSE 事件 */
  export interface ChatEvent {
    type:
      | 'answer'
      | 'cancelled'
      | 'confirm_required'
      | 'error'
      | 'reasoning'
      | 'token'
      | 'tool_call'
      | 'tool_result'
      | 'turn_start'
      | 'usage';
    id?: number;
    session_id?: string;
    turn_id?: string;
    ts?: number;
    payload?: Record<string, any>;
    pending_action_id?: string;
    status?: string;
    content?: string;
    tool?: string;
    parameters?: Record<string, any>;
    arguments?: Record<string, any>;
    message?: string;
    success?: boolean;
    need_confirm?: boolean;
    result_summary?: string;
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
    requests?: number;
    tool_calls?: number;
    step?: number;
  }

  export interface ChatAttachment {
    name: string;
    kind?: string;
    size?: number;
    truncated?: boolean;
    text?: string;
    image_data?: string;
    media_type?: string;
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

/** 上传文本类附件并提取上下文 */
export async function uploadAgentAttachment(file: File) {
  if (file.size > 25 * 1024 * 1024) {
    throw new Error('附件不能超过 25 MB');
  }
  const response: any = await requestClient.upload('/agent/chat/attachment', {
    file,
  });
  return response?.data ?? response;
}
/** Agent 对话（POST SSE 流式） */
export function streamAgentChat(
  payload: {
    attachments?: AgentApi.ChatAttachment[];
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
  const parser = createSseParser(callbacks.onEvent);
  return requestClient
    .postSSE('/agent/chat', payload, {
      signal,
      headers: { 'Content-Type': 'application/json' },
      onMessage: parser.push,
    })
    .catch((error) => {
      if (typeof error?.data === 'string') {
        try {
          const parsed = JSON.parse(error.data);
          error.detail = parsed.detail || parsed.message || error.data;
        } catch {
          error.detail = error.data;
        }
      }
      callbacks.onError?.(error);
    })
    .finally(() => {
      // 流结束时处理残留的未闭合事件
      parser.end();
      callbacks.onEnd?.();
    });
}

/** 危险操作确认 */
export function confirmAgentChat(pendingActionId: string) {
  return requestClient.post('/agent/chat/confirm', {
    pending_action_id: pendingActionId,
  });
}

/** 拒绝危险操作 */
export function rejectAgentChat(pendingActionId: string) {
  return requestClient.post('/agent/chat/reject', {
    pending_action_id: pendingActionId,
  });
}

/** 协作式取消 Turn */
export function cancelAgentChat(turnId: string) {
  return requestClient.post('/agent/chat/cancel', { turn_id: turnId });
}

/** 会话列表 */
export function getAgentSessions() {
  return requestClient.get<{
    sessions: {
      preview: string;
      session_id: string;
      title?: string;
      updated_at?: string;
    }[];
  }>('/agent/chat/sessions');
}

/** 重命名会话 */
export function renameAgentSession(sessionId: string, title: string) {
  return requestClient.post('/agent/chat/session/rename', {
    session_id: sessionId,
    title,
  });
}

/** 创建会话 */
export function createAgentSession() {
  return requestClient.post<{ session_id: string }>('/agent/chat/session', {});
}

/** 删除会话 */
export function deleteAgentSession(sessionId: string) {
  return requestClient.delete('/agent/chat/session', {
    data: { session_id: sessionId },
  });
}

/** 轻量 Agent 状态 */
export function getAgentStatus() {
  return requestClient.get<{
    conversation_enabled: boolean;
    enabled: boolean;
    long_term_memory_enabled: boolean;
    model: string;
    provider: string;
    rag_enabled: boolean;
    reasoning_effort: 'high' | 'low' | 'max';
    thinking_enabled: boolean;
  }>('/agent/status');
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
  const parser = createSseParser(callbacks.onEvent);
  return requestClient
    .requestSSE(`/agent/message/stream?cursor=${cursor}`, undefined, {
      method: 'GET',
      signal,
      onMessage: parser.push,
    })
    .catch(() => {
      // 断线由调用方重连
    })
    .finally(() => {
      parser.end();
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
