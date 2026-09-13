export function Container({
  children,
  className = 'max-w-6xl',
}: {
  children: React.ReactNode;
  className?: string;
}): React.ReactElement {
  return <div className={`mx-auto w-full px-4 ${className}`}>{children}</div>;
}