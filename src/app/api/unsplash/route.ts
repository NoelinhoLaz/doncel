import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "travel";
  const page = req.nextUrl.searchParams.get("page") ?? "1";

  const res = await fetch(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=12&page=${page}&orientation=landscape`,
    {
      headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` },
      next: { revalidate: 60 },
    }
  );

  if (!res.ok) return NextResponse.json({ results: [] }, { status: res.status });
  const data = await res.json();

  const results = data.results.map((p: any) => ({
    id: p.id,
    thumb: p.urls.small,
    full: p.urls.regular,
    alt: p.alt_description ?? p.description ?? "",
    author: p.user.name,
    authorUrl: p.user.links.html,
  }));

  return NextResponse.json({ results, total: data.total });
}
