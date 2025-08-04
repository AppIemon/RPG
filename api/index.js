export default async function handler(req, res) {
  const isProduction = process.env.NODE_ENV === 'production';
  let apiUrl;
  
  if (isProduction) {
    apiUrl = req.url;
  } else {
    apiUrl = `http://127.0.0.1:3000${req.url}`;
  }
  
  try {
    const response = await fetch(apiUrl, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        ...req.headers,
      },
      body: JSON.stringify(req.body),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      res.status(response.status).json({ success: false, message: data.message || 'Failed to fetch data' });
      return;
    }

    res.status(200).json(data);
  } catch (error) {
    console.error("API error:", error);
    res.status(500).json({ success: false, message: "Server error occurred" });
  }
}