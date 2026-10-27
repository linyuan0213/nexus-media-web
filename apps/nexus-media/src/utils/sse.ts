export interface SseParser {
  end: () => void;
  push: (chunk: string) => void;
}

/** 按 SSE 块边界解析跨网络分块事件，兼容 CRLF 和多行 data。 */
export function createSseParser(onEvent: (data: any) => void): SseParser {
  let buffer = '';

  function parseBlock(block: string) {
    const data = block
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n');
    if (!data) return;
    try {
      onEvent(JSON.parse(data));
    } catch {
      // 非 JSON 心跳或无效块直接忽略
    }
  }

  function drain(final = false) {
    buffer = buffer.replaceAll('\r\n', '\n');
    let index = buffer.indexOf('\n\n');
    while (index !== -1) {
      parseBlock(buffer.slice(0, index));
      buffer = buffer.slice(index + 2);
      index = buffer.indexOf('\n\n');
    }
    if (final && buffer.trim()) parseBlock(buffer);
  }

  return {
    push(chunk: string) {
      buffer += chunk;
      drain();
    },
    end() {
      drain(true);
    },
  };
}
