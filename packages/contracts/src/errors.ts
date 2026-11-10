import { z } from "zod";

export const ApiErrorBody = z.object({
  error: z.object({
    code: z.enum([
      "tenant_mismatch",
      "not_found",
      "forbidden",
      "invalid",
      "unauthenticated",
      "conflict",
      "internal",
    ]),
    message: z.string(),
  }),
});
export type ApiErrorBody = z.infer<typeof ApiErrorBody>;
