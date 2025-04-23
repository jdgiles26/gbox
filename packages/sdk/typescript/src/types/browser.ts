// Definitions for browser related types

// Mouse button type using string literal union
export type MouseButtonType = 'left' | 'right' | 'wheel' | 'back' | 'forward';

// --- Context related interfaces ---

export interface CreateContextParams {
  userAgent?: string;
  locale?: string;
  timezone?: string;
  permissions?: string[];
  viewportWidth?: number;
  viewportHeight?: number;
}

export interface CreateContextResult {
  contextId: string;
}

// --- Page related interfaces ---

export interface CreatePageParams {
  url: string;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  timeout?: number;
}

export interface CreatePageResult {
  pageId: string;
  url: string;
  title: string;
}

export interface ListPagesResult {
  pages: {
    pageId: string;
    url: string;
    title: string;
  }[];
}

export interface GetPageResult {
  pageId: string;
  url: string;
  title: string;
  content?: string;
  contentType?: string;
}

// --- Vision action related interfaces ---

// Base result interface
export interface VisionBaseResult {
  success: boolean;
  error?: string;
}

// Click action
export interface VisionClickParams {
  x: number;
  y: number;
  button?: MouseButtonType;
}

export interface VisionClickResult extends VisionBaseResult {}

// Double click action
export interface VisionDoubleClickParams {
  x: number;
  y: number;
}

export interface VisionDoubleClickResult extends VisionBaseResult {}

// Type action
export interface VisionTypeParams {
  text: string;
}

export interface VisionTypeResult extends VisionBaseResult {}

// Drag action
export interface Point {
  x: number;
  y: number;
}

export interface VisionDragParams {
  path: Point[];
}

export interface VisionDragResult extends VisionBaseResult {}

// KeyPress action
export interface VisionKeyPressParams {
  keys: string[];
}

export interface VisionKeyPressResult extends VisionBaseResult {}

// Mouse move action
export interface VisionMoveParams {
  x: number;
  y: number;
}

export interface VisionMoveResult extends VisionBaseResult {}

// Scroll action
export interface VisionScrollParams {
  scrollX: number;
  scrollY: number;
}

export interface VisionScrollResult extends VisionBaseResult {}

// Screenshot action
export interface ClipRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VisionScreenshotParams {
  type?: 'png' | 'jpeg';
  fullPage?: boolean;
  quality?: number;
  omitBackground?: boolean;
  timeout?: number;
  clip?: ClipRect;
  scale?: 'css' | 'device';
  animations?: 'disabled' | 'allow';
  caret?: 'hide' | 'initial';
  outputFormat?: 'base64' | 'url';
}

export interface VisionScreenshotResult extends VisionBaseResult {
  base64Content?: string;
  url?: string;
}

// Error result
export interface VisionErrorResult {
  success: false;
  error: string;
} 