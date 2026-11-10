export function ErrorNote({ error }: { error: Error | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="text-caption text-risk-fg">
      {error.message}
    </p>
  );
}
