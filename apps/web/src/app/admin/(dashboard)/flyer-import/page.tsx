import { FlyerImportForm } from "./flyer-import-form";

export default function FlyerImportPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-2 text-2xl font-bold text-gray-900">Flyer Import</h1>
      <p className="mb-8 text-sm text-gray-500">
        Paste a Facebook post and upload the flyer image. Claude extracts the
        fields; review, confirm the venue, and save a private draft to share with
        the organizer.
      </p>
      <FlyerImportForm />
    </div>
  );
}
