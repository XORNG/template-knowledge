import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createLogger, registerTools, type Logger } from '@xorng/template-base';
import { BaseKnowledgeProvider } from './base/BaseKnowledgeProvider.js';

/**
 * Options for creating a knowledge provider server
 */
export interface KnowledgeServerOptions {
  provider: BaseKnowledgeProvider;
  logLevel?: string;
}

/**
 * Create and start an MCP server for a knowledge provider
 */
export function createKnowledgeServer(options: KnowledgeServerOptions): {
  server: McpServer;
  transport: StdioServerTransport;
  logger: Logger;
  start: () => Promise<void>;
} {
  const { provider, logLevel = 'info' } = options;
  const metadata = provider.getMetadata();
  
  const logger = createLogger(logLevel, metadata.name);

  const server = new McpServer({
    name: metadata.name,
    version: metadata.version,
  });

  const transport = new StdioServerTransport();

  // Register all provider tools
  registerTools(server, provider.getTools(), logger);

  const start = async () => {
    await provider.initialize();
    
    logger.info({
      name: metadata.name,
      version: metadata.version,
      sources: Array.from(provider.getSources().keys()),
    }, 'Starting knowledge provider MCP server');

    await server.connect(transport);
    
    logger.info('Knowledge provider MCP server connected');

    // Handle shutdown
    process.on('SIGINT', async () => {
      logger.info('Shutting down...');
      await provider.shutdown();
      process.exit(0);
    });
  };

  return { server, transport, logger, start };
}

/**
 * Quick start helper for knowledge providers
 */
export async function startKnowledgeProvider(provider: BaseKnowledgeProvider): Promise<void> {
  const { start } = createKnowledgeServer({ provider });
  await start();
}
