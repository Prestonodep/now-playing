export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;

  if (!clientId || !refreshToken) {
    return res.status(500).json({ error: 'Not configured' });
  }

  // Exchange refresh token for a fresh access token
  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    return res.status(401).json({ error: 'Token refresh failed' });
  }

  // Fetch currently playing
  const npRes = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (npRes.status === 204 || npRes.status === 200 && (await npRes.clone().text()) === '') {
    return res.status(200).json({ is_playing: false });
  }

  if (!npRes.ok) {
    return res.status(200).json({ is_playing: false });
  }

  const data = await npRes.json();

  if (!data || !data.item || data.currently_playing_type !== 'track') {
    return res.status(200).json({ is_playing: false });
  }

  return res.status(200).json(data);
}
