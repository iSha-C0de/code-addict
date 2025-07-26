// app/api/hello.ts
export async function GET(_request: Request) {
  try {
    // Example: Proxy to Express backend
    const response = await fetch('https://mern-backend.onrender.com/api/test');
    if (!response.ok) throw new Error('Backend request failed');
    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}