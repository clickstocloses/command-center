// Shared by the client form and the server actions. Lives apart from actions.ts
// because a "use server" file may only export async functions.
export type LoginFormState = {
  step: "email" | "code";
  email: string;
  message: string | null;
  isError: boolean;
};

export const initialLoginState: LoginFormState = { step: "email", email: "", message: null, isError: false };
