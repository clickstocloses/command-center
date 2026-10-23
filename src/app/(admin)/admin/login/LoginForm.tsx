"use client";

import { useActionState } from "react";
import { requestCodeAction, startOverAction, verifyCodeAction } from "./actions";
import { initialLoginState } from "./state";

export function LoginForm() {
  const [requestState, requestCode, requesting] = useActionState(requestCodeAction, initialLoginState);
  const [verifyState, verifyCode, verifying] = useActionState(verifyCodeAction, initialLoginState);
  const [, startOver] = useActionState(startOverAction, initialLoginState);

  // The verify step takes over once a code has been requested.
  const state = requestState.step === "code" ? { ...requestState, ...verifyState, step: "code" as const } : requestState;
  const message = verifyState.message ?? requestState.message;
  const isError = verifyState.message ? verifyState.isError : requestState.isError;

  if (state.step === "email") {
    return (
      <form action={requestCode} className="form">
        <label className="field">
          <span className="mono muted">Email</span>
          <input
            className="input"
            type="email"
            name="email"
            autoComplete="email"
            required
            autoFocus
            placeholder="you@clickstocloses.com"
            defaultValue={requestState.email}
          />
        </label>
        {message ? <p className={isError ? "notice notice-error" : "notice"}>{message}</p> : null}
        <button className="button" type="submit" disabled={requesting}>
          {requesting ? "Sending" : "Send me a code"}
        </button>
      </form>
    );
  }

  return (
    <form action={verifyCode} className="form">
      <input type="hidden" name="email" value={requestState.email} />
      <p className="muted">
        Code sent to <strong>{requestState.email}</strong>
      </p>
      <label className="field">
        <span className="mono muted">6-digit code</span>
        <input
          className="input input-code"
          type="text"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]*"
          maxLength={7}
          required
          autoFocus
        />
      </label>
      {message ? <p className={isError ? "notice notice-error" : "notice"}>{message}</p> : null}
      <div className="row">
        <button className="button" type="submit" disabled={verifying}>
          {verifying ? "Checking" : "Sign in"}
        </button>
        <button className="button button-ghost" type="button" onClick={() => startOver()}>
          Use a different email
        </button>
      </div>
    </form>
  );
}
