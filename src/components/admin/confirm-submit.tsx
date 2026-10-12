"use client";

/** Submit button that asks for confirmation before a destructive action. */
export function ConfirmSubmit({
  children,
  question,
  className,
}: {
  children: React.ReactNode;
  question: string;
  className?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(question)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
