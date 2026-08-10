import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth/auth";

const http = httpRouter();

// Register auth routes
authComponent.registerRoutes(http, createAuth);

// Handle CORS preflight requests
http.route({
  path: "/api/auth/:path*",
  method: "OPTIONS",
  handler: async (ctx) => {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  },
});

// Add CORS headers to all responses via route decorator pattern
http.route({
  path: "/api/auth/:path*",
  method: "GET",
  handler: async (ctx) => {
    const response = await authComponent.handleRequest(ctx, createAuth);
    response.headers.set("Access-Control-Allow-Origin", "*");
    return response;
  },
});

http.route({
  path: "/api/auth/:path*",
  method: "POST",
  handler: async (ctx) => {
    const response = await authComponent.handleRequest(ctx, createAuth);
    response.headers.set("Access-Control-Allow-Origin", "*");
    return response;
  },
});

export default http;
