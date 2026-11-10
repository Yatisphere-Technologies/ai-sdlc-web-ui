import { z } from "zod";

const Env = z.object({
  VITE_API_MOCKS: z.enum(["true", "false"]).default("true"),
  VITE_TENANT_BASE_DOMAIN: z.string().default(""),
});

const env = Env.parse(import.meta.env);

export const config = {
  /** Serve the API from MSW in the browser */
  useMocks: env.VITE_API_MOCKS === "true",
  /** e.g. "throughline.app" enables acme.throughline.app → /t/acme */
  tenantBaseDomain: env.VITE_TENANT_BASE_DOMAIN,
} as const;
