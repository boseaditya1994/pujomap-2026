"use client";

import { startTransition, type FormEvent } from "react";

/**
 * React clears a form after its `action` runs, which throws away what the
 * visitor typed when the server rejects it. Submitting through this handler
 * keeps the fields as they are. The form keeps its `action` prop as well, so
 * it still works before JavaScript has loaded.
 */
export function submitKeepingValues(action: (form: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const data = new FormData(event.currentTarget, submitter);
    startTransition(() => action(data));
  };
}
