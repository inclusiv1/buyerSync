import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js';
import type { McpExecutionContext, McpToolRegistry } from './registry';

export type McpContextProvider = (
  extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
) => McpExecutionContext | Promise<McpExecutionContext>;

export function createMcpServer(registry: McpToolRegistry, contextProvider: McpContextProvider): McpServer {
  const server = new McpServer({ name: 'buyer-sync', version: '1.0.0' });
  for (const definition of registry.definitions) {
    server.registerTool(definition.name, {
      description: definition.description,
      inputSchema: definition.inputSchema,
      annotations: {
        readOnlyHint: !definition.isWrite,
        destructiveHint: false,
        idempotentHint: true,
      },
    }, async (input: unknown, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      try {
        const result = await registry.execute(definition.name, input, await contextProvider(extra));
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result) }],
          structuredContent: result as unknown as Record<string, unknown>,
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: error instanceof Error ? error.message : 'Tool execution failed' }],
        };
      }
    });
  }
  return server;
}

export function connectMcpTransport(server: McpServer, transport: Transport): Promise<void> {
  return server.connect(transport);
}
