export default function Loading() {
  return (
    <div className="py-16 text-center">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-green-600" />
      <p className="mt-4 text-sm text-gray-500">Loading tournaments...</p>
    </div>
  );
}
