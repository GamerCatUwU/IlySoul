module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=3600");
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return res.status(500).json({ error: "Spotify credentials are not configured." });
  try {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials"
    });
    if (!tokenResponse.ok) return res.status(502).json({ error: "Spotify authentication failed." });
    const tokenData = await tokenResponse.json();
    const releasesResponse = await fetch("https://api.spotify.com/v1/artists/1SoHACsKpxkyefWjj2xQOa/albums?include_groups=album,single,compilation&market=DE&limit=50", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    if (!releasesResponse.ok) return res.status(502).json({ error: "Spotify releases could not be fetched." });
    const releasesData = await releasesResponse.json();
    const unique = new Map();
    for (const item of releasesData.items || []) if (!unique.has(item.id)) unique.set(item.id, item);
    const items = [...unique.values()]
      .sort((a, b) => new Date(b.release_date) - new Date(a.release_date))
      .slice(0, 6)
      .map(item => ({
        id: item.id,
        name: item.name,
        date: item.release_date,
        dateLabel: item.release_date,
        image: item.images?.[0]?.url || "",
        url: item.external_urls?.spotify || `https://open.spotify.com/album/${item.id}`
      }));
    return res.status(200).json({ items });
  } catch {
    return res.status(500).json({ error: "Unexpected error loading Spotify releases." });
  }
};
