export default function RedesignLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="contents">{children}</div>;
}
