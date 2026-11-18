const fallback = require("../../assets/releases.json");

async function spotifyJSON(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const error = new Error(`Spotify returned ${response.status}`);
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("Retry-After"));
      if (Number.isFinite(retryAfter) && retryAfter > 0) error.retryAfter = Math.ceil(retryAfter);
    }
    throw error;
  }
  return response.json();
}

module.exports = async (_req, res) => {
  let releases = fallback.releases;
  let cacheSeconds = 300;
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;

  if (id && secret) {
    try {
      const signal = AbortSignal.timeout(3000);
      const credentials = Buffer.from(`${id}:${secret}`).toString("base64");
      const token = await spotifyJSON("https://accounts.spotify.com/api/token", {
        signal,
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: "grant_type=client_credentials"
      });
      if (!token.access_token) throw new Error("Spotify returned no access token");

      const { items } = await spotifyJSON(
        "https://api.spotify.com/v1/artists/1SoHACsKpxkyefWjj2xQOa/albums?include_groups=album,single,compilation&market=DE&limit=10",
        { signal, headers: { Authorization: `Bearer ${token.access_token}` } }
      );
      const live = (Array.isArray(items) ? items : [])
        .filter(album => album?.id && album.name && album.release_date && album.external_urls?.spotify)
        .sort((a, b) => b.release_date.localeCompare(a.release_date))
        .slice(0, 6)
        .map(album => ({
          id: album.id,
          name: album.name,
          date: album.release_date,
          dateLabel: album.release_date,
          image: album.images?.[0]?.url || "",
          url: album.external_urls.spotify
        }));

      if (live.length) {
        releases = live;
        cacheSeconds = 1800;
      }
    } catch (error) {
      cacheSeconds = Math.max(cacheSeconds, error.retryAfter || 0);
      console.warn("Spotify releases unavailable:", error.message);
    }
  }

  res.setHeader("Cache-Control", `s-maxage=${cacheSeconds}, stale-while-revalidate=3600`);
  return res.status(200).json({ releases });
};
