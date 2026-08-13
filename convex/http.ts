import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth/auth";

const http = httpRouter();

// Register all Better Auth routes (handles /api/auth/* automatically)
authComponent.registerRoutes(http, createAuth);

export default http;
