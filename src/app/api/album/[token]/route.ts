import { NextResponse } from "next/server";
import { getPublicAlbumData } from "@/lib/public-album";

export const runtime = "nodejs";

type Params = { params: Promise<{ token: string }> };

// GET /api/album/[token] — PUBLIC. Album data authorized purely by the token.
export async function GET(_request: Request, { params }: Params) {
  const { token } = await params;
  const data = await getPublicAlbumData(token);
  if (!data) {
    return NextResponse.json({ error: "not_available" }, { status: 404 });
  }
  return NextResponse.json(data);
}
