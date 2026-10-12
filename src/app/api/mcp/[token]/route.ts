import { handleMcpRequest } from "@/lib/mcp/server";

// Conector con el token en la dirección: es lo que se pega en Claude como conector personalizado.
async function handler(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return handleMcpRequest(req, token);
}

export { handler as GET, handler as POST, handler as DELETE };
