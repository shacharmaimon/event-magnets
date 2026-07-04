import { getPublicAlbumData } from "@/lib/public-album";
import AlbumGallery from "@/components/album/AlbumGallery";
import { labels } from "@/lib/labels";

// Prevent caching of the page (its signed image URLs are short-lived).
export const dynamic = "force-dynamic";

// Public, read-only album for hosts. Resolved by album_token; works even when
// the event is closed.
export default async function AlbumPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getPublicAlbumData(token);

  if (!data) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gradient-to-b from-white to-zinc-100 px-6 text-center dark:from-zinc-950 dark:to-black">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          {labels.album.unavailableTitle}
        </h1>
        <p className="max-w-sm text-zinc-500 dark:text-zinc-400">
          {labels.album.unavailableBody}
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-black">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
        <header className="text-center">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            {data.welcome_heading || data.name}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {labels.album.heading}
          </p>
        </header>

        <AlbumGallery
          token={token}
          eventName={data.name}
          photos={data.photos}
        />
      </div>
    </main>
  );
}
