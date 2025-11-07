const BASE = "http://localhost:5000";

export async function fetchPredictions(range = "current") {
  const res = await fetch(`${BASE}/predictions?range=${range}`);
  return res.json();
}

export async function fetchData(range = "current") {
  const res = await fetch(`${BASE}/data?range=${range}`);
  return res.json();
}
