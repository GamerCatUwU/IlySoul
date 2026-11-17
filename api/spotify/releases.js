module.exports = async (req, res) => {
  const fail = (stage, status, details) => {
    return res.status(500).json({ stage, spotifyStatus: status, details });
  };

  try {
    const id = process.env.SPOTIFY_CLIENT_ID;
    const secret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!id || !secret) {
      return fail("environment", null, "Missing Spotify environment variables");
    }

    const credentials = Buffer.from(`${id}:${secret}`).toString("base64");

    const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials"
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      return fail("authentication", tokenResponse.status, tokenData);
    }

    const response = await fetch(
      "https://api.spotify.com/v1/artists/1SoHACsKpxkyefWjj2xQOa/albums?include_groups=album,single,compilation&market=DE&limit=10",
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`
        }
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return fail("releases", response.status, data);
    }

    const releases = data.items
      .sort((a, b) => new Date(b.release_date) - new Date(a.release_date))
      .slice(0, 6)
      .map(album => ({
        id: album.id,
        name: album.name,
        date: album.release_date,
        dateLabel: album.release_date,
        image: album.images?.[0]?.url || "",
        url: album.external_urls.spotify
      }));

    res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=3600");
    return res.status(200).json({ releases });
  } catch (error) {
    return fail("server", null, error.message);
  }
};
