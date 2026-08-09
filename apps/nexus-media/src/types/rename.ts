/**
 * 重命名格式构建器类型定义
 */
export interface FormatVariable {
  /** 变量标识，如 'title' */
  key: string;
  /** 中文名，如 '标题' */
  label: string;
  /** 示例值 */
  example?: string;
  /** 是否依赖媒体服务（en_title / episode_title） */
  requiresMs?: boolean;
}

export interface FormatChip {
  id: number;
  /** 变量 or 固定文本 */
  type: 'static' | 'variable';
  /** 变量标识 */
  key?: string;
  /** 固定文本内容 */
  text?: string;
}

export interface RenameFormat {
  template: FormatChip[];
  separator: string;
}
