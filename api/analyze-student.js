const fetch = require("node-fetch");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const QUICKCHART_BASE = process.env.QUICKCHART_BASE || "https://quickchart.io/chart";

async function callOpenAI(prompt) {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are an educational analyst." },
        { role: "user", content: prompt }
      ],
      max_tokens: 600,
      temperature: 0.2
    })
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`OpenAI error ${resp.status}: ${txt}`);
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content ?? "";
}

function buildQuickChartUrl(labels, values) {
  const config = {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Score", data: values }
      ]
    }
  };

  return `${QUICKCHART_BASE}?c=${encodeURIComponent(JSON.stringify(config))}&w=800&h=400`;
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Only POST allowed" });
    }

    const payload = req.body;

    if (!payload || !Array.isArray(payload.subjects)) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    const labels = payload.subjects.map(s => s.name);
    const scores = payload.subjects.map(s => Number(s.score) || 0);

    const prompt = `
Analyze this student's performance. Return JSON with:
- summary
- weaknesses
- strengths
- recommendations

Subjects:
${payload.subjects.map(s => `${s.name}: ${s.score}`).join("\n")}
    `;

    const raw = await callOpenAI(prompt);

    let analysis;
    try { analysis = JSON.parse(raw); }
    catch { analysis = { raw }; }

    const chartUrl = buildQuickChartUrl(labels, scores);

    return res.status(200).json({
      ok: true,
      analysis,
      chartUrl
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
