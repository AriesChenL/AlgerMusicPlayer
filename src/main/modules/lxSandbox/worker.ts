/**
 * 落雪音源脚本沙箱 —— 主进程 Node worker_threads 版
 *
 * 与渲染进程的 Web Worker 版（src/renderer/services/workers/lxScriptSandbox.worker.ts）
 * 行为对齐，差异点：
 *  - 消息层用 worker_threads 的 parentPort 取代 self.postMessage/onmessage
 *  - 用户脚本通过 Node `vm` 在隔离上下文执行（取代 Blob URL + 动态 import）
 *  - lx.request 直接在 worker 内用 Node 全局 fetch 完成（无需再桥接回主线程）
 *
 * 注：仅支持以经典脚本（非 ESM）编写的落雪音源；含 import/export 的脚本会在
 * vm.Script 解析阶段抛错，由上层回退到渲染进程 Web Worker 版处理。
 */

import vm from 'node:vm';
import { parentPort } from 'node:worker_threads';

import * as lxCrypto from '../../../shared/lxCrypto';

type HostMessage =
  | { type: 'initialize'; script: string; scriptInfo: any }
  | { type: 'invoke-request'; callId: string; payload: any };

let requestHandler: ((data: any) => Promise<any>) | null = null;
let initialized = false;

const post = (message: any) => parentPort?.postMessage(message);
const postLog = (level: 'log' | 'warn' | 'error' | 'info', ...args: any[]) =>
  post({ type: 'log', level, args });

/** 在 worker 内直接发起 HTTP 请求（Node 全局 fetch） */
const doHttpRequest = async (
  url: string,
  options: any,
  callback: (err: Error | null, resp: any, body: any) => void
) => {
  const timeout = options.timeout || 30000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    ...(options.headers || {})
  };

  let body: any;
  if (options.body) {
    body = options.body;
  } else if (options.form) {
    body = new URLSearchParams(options.form).toString();
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
  } else if (options.formData) {
    const fd = new URLSearchParams();
    for (const [k, v] of Object.entries(options.formData)) fd.append(k, v as string);
    body = fd.toString();
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
  }

  try {
    const resp = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body,
      signal: controller.signal
    });
    clearTimeout(timer);
    const rawBody = await resp.text();

    let parsedBody: any = rawBody;
    const contentType = resp.headers.get('content-type') || '';
    if (contentType.includes('json') || rawBody.startsWith('{') || rawBody.startsWith('[')) {
      try {
        parsedBody = JSON.parse(rawBody);
      } catch {
        // keep raw text
      }
    }

    callback(
      null,
      {
        statusCode: resp.status,
        headers: Object.fromEntries(resp.headers.entries()),
        body: parsedBody
      },
      parsedBody
    );
  } catch (error) {
    clearTimeout(timer);
    callback(error as Error, null, null);
  }
};

/** 构造注入脚本的 lx API（与渲染版一致） */
const createLxApi = (scriptInfo: any) => ({
  version: '2.8.0',
  env: 'desktop',
  appInfo: { version: '2.8.0', versionNum: 208, locale: 'zh-cn' },
  currentScriptInfo: scriptInfo,
  EVENT_NAMES: { inited: 'inited', request: 'request', updateAlert: 'updateAlert' },
  on: (eventName: string, handler: (data: any) => Promise<any>) => {
    if (eventName === 'request') requestHandler = handler;
  },
  send: (eventName: string, data: any) => {
    if (eventName === 'inited') {
      initialized = true;
      post({ type: 'initialized', data });
    } else if (eventName === 'updateAlert') {
      postLog('info', '[LxScript][updateAlert]', data);
    }
  },
  request: (
    url: string,
    options: any,
    callback: (err: Error | null, resp: any, body: any) => void
  ) => {
    void doHttpRequest(url, options, callback);
    return () => {};
  },
  utils: {
    buffer: {
      from: (data: any, _encoding?: string) =>
        typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data),
      bufToString: (buffer: Uint8Array, encoding?: string) =>
        new TextDecoder(encoding || 'utf-8').decode(buffer)
    },
    crypto: {
      md5: lxCrypto.md5,
      sha1: lxCrypto.sha1,
      sha256: lxCrypto.sha256,
      randomBytes: lxCrypto.randomBytes,
      aesEncrypt: lxCrypto.aesEncrypt,
      aesDecrypt: lxCrypto.aesDecrypt,
      rsaEncrypt: lxCrypto.rsaEncrypt,
      rsaDecrypt: lxCrypto.rsaDecrypt,
      base64Encode: lxCrypto.base64Encode,
      base64Decode: lxCrypto.base64Decode
    },
    zlib: {
      inflate: async (buffer: ArrayBuffer) => {
        try {
          const ds = new (globalThis as any).DecompressionStream('deflate');
          const writer = ds.writable.getWriter();
          writer.write(buffer);
          writer.close();
          const reader = ds.readable.getReader();
          const chunks: Uint8Array[] = [];
          let done = false;
          while (!done) {
            const r = await reader.read();
            done = r.done;
            if (r.value) chunks.push(r.value);
          }
          const total = chunks.reduce((a, c) => a + c.length, 0);
          const out = new Uint8Array(total);
          let off = 0;
          for (const c of chunks) {
            out.set(c, off);
            off += c.length;
          }
          return out.buffer;
        } catch {
          return buffer;
        }
      },
      deflate: async (buffer: ArrayBuffer) => {
        try {
          const cs = new (globalThis as any).CompressionStream('deflate');
          const writer = cs.writable.getWriter();
          writer.write(buffer);
          writer.close();
          const reader = cs.readable.getReader();
          const chunks: Uint8Array[] = [];
          let done = false;
          while (!done) {
            const r = await reader.read();
            done = r.done;
            if (r.value) chunks.push(r.value);
          }
          const total = chunks.reduce((a, c) => a + c.length, 0);
          const out = new Uint8Array(total);
          let off = 0;
          for (const c of chunks) {
            out.set(c, off);
            off += c.length;
          }
          return out.buffer;
        } catch {
          return buffer;
        }
      }
    }
  }
});

const resetState = () => {
  requestHandler = null;
  initialized = false;
};

/** 在隔离的 vm 上下文中执行用户脚本 */
const initializeScript = (script: string, scriptInfo: any) => {
  resetState();

  const lx = createLxApi(scriptInfo);
  const sandbox: Record<string, any> = {
    lx,
    console: {
      log: (...a: any[]) => postLog('log', ...a),
      warn: (...a: any[]) => postLog('warn', ...a),
      error: (...a: any[]) => postLog('error', ...a),
      info: (...a: any[]) => postLog('info', ...a)
    },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    TextEncoder,
    TextDecoder,
    URL,
    URLSearchParams,
    Uint8Array,
    ArrayBuffer
    // 刻意不注入 require / process / module / fetch / Buffer，限制脚本能力
  };

  const context = vm.createContext(sandbox);
  // 让脚本内的 globalThis / global 指向沙箱本身
  context.globalThis = context;
  context.global = context;

  const scriptObj = new vm.Script(script, { filename: 'lx-source.js' });
  scriptObj.runInContext(context);

  if (!initialized) {
    throw new Error('脚本未调用 lx.send(EVENT_NAMES.inited, data)');
  }
};

const resolveInvocation = async (callId: string, payload: any) => {
  if (!requestHandler) {
    post({ type: 'invoke-error', callId, message: '脚本未注册请求处理器' });
    return;
  }
  try {
    const result = await requestHandler(payload);
    post({ type: 'invoke-result', callId, result });
  } catch (error) {
    post({
      type: 'invoke-error',
      callId,
      message: error instanceof Error ? error.message : String(error)
    });
  }
};

parentPort?.on('message', (message: HostMessage) => {
  switch (message.type) {
    case 'initialize':
      try {
        initializeScript(message.script, message.scriptInfo);
      } catch (error) {
        post({
          type: 'script-error',
          message: error instanceof Error ? error.message : String(error)
        });
      }
      break;
    case 'invoke-request':
      void resolveInvocation(message.callId, message.payload);
      break;
    default:
      break;
  }
});
