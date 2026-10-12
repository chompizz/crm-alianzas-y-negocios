import { handleMcpRequest } from "@/lib/mcp/server";

// Variante con "Authorization: Bearer <token>", para clientes MCP que permiten cabeceras.
async function handler(req: Request) {
  const auth = req.headers.get("authorization");
  return handleMcpRequest(req, auth?.startsWith("Bearer ") ? auth.slice(7) : null);
}

export { handler as GET, handler as POST, handler as DELETE };
