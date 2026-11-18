
module.exports = async (req, res) => {
  try {
    const response = await fetch(
      "https://itunes.apple.com/lookup?id=1786055860&entity=album&limit=50"
    );

    if (!response.ok) {
      return res.status(502).json({ error: "Apple Music request failed" });
    }

    const data = await response.json();

    const releases = data.results
      .filter(item => item.wrapperType === "collection" && item.artistId === 1786055860)
      .sort((a, b) => new Date(b.releaseDate) - new Date(a.releaseDate))
      .slice(0, 6)
      .map(item => ({
        id: item.collectionId,
        name: item.collectionName,
        date: item.releaseDate,
        dateLabel: item.releaseDate.slice(0, 10),
        image: item.artworkUrl100?.replace("100x100bb", "600x600bb") || "",
        url: item.collectionViewUrl
      }));

    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");

    return res.status(200).json({ releases });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }

  res.setHeader("Cache-Control", `s-maxage=${cacheSeconds}, stale-while-revalidate=3600`);
  return res.status(200).json({ releases });
};
