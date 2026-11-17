import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";

/** Labelled field wrapper: label, control, hint and error are all programmatically linked. */
export function Field({ label, error, hint, children }: {
  label: string; error?: string; hint?: string; children: (a: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
}) {
  const id = useId();
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      {children({ id, describedBy, invalid: !!error })}
      {hint && !error && <p id={`${id}-hint`} className="mt-1 text-xs text-ink-soft">{hint}</p>}
      {error && <p id={`${id}-err`} className="mt-1 text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}

export function TextInput({ label, error, hint, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string }) {
  return (
    <Field label={label} error={error} hint={hint}>
      {({ id, describedBy, invalid }) => <input id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} className="input" {...rest} />}
    </Field>
  );
}

export function TextArea({ label, error, hint, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string; hint?: string }) {
  return (
    <Field label={label} error={error} hint={hint}>
      {({ id, describedBy, invalid }) => <textarea id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} className="input" {...rest} />}
    </Field>
  );
}
