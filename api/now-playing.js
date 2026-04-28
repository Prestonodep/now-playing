export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    return res.status(500).json({ error: 'Not configured' });
  }

  // Use client_id:client_secret (Base64) — tokens do not rotate with this method
  const credentials = Buffer.from(clientId + ':' + clientSecret).toString('base64');

  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + credentials,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    return res.status(401).json({ error: 'Token refresh failed' });
  }

  const npRes = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (npRes.status === 204) {
    return res.status(200).json({ is_playing: false });
  }

  if (!npRes.ok) {
    return res.status(200).json({ is_playing: false });
  }

  const text = await npRes.text();
  if (!text) return res.status(200).json({ is_playing: false });

  const data = JSON.parse(text);
  if (!data || !data.item || data.currently_playing_type !== 'track') {
    return res.status(200).json({ is_playing: false });
  }

  return res.status(200).json(data);
}
