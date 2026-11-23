import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
// Authenticated client (adds the login token; base URL /api).
import api from '../services/api';

interface SentimentTrend {
  date: string;
  score: number;
}

interface Issue {
  category: string;
  count: number;
}

interface Warning {
  issue: string;
  confidence: number;
}


// The /tenant/* analytics endpoints answer `{ success, data: { ... } }`; map
// them to the simple shapes this page charts. Anything unexpected becomes [].
const payload = (body: any) => (body && typeof body === 'object' && 'data' in body ? body.data : body) ?? {};
const toTrends = (body: any): SentimentTrend[] =>
  (Array.isArray(payload(body).trends) ? payload(body).trends : []).map((t: any) => ({
    date: String(t.date),
    score: Number(t.averageScore ?? t.score ?? 0),
  }));
const toIssues = (body: any): Issue[] =>
  (Array.isArray(payload(body).commonIssues) ? payload(body).commonIssues : []).map((i: any) => ({
    category: String(i.category),
    count: Number(i.count ?? 0),
  }));
const toWarnings = (body: any): Warning[] =>
  (Array.isArray(payload(body).activeWarnings) ? payload(body).activeWarnings : []).map((w: any) => ({
    issue: [w.tenant, w.property].filter(Boolean).join(' · ') + (w.message ? `: ${w.message}` : ''),
    confidence: Math.min(1, Math.abs(Number(w.sentimentScore ?? 0))),
  }));
const toSuggestions = (body: any): string[] =>
  (Array.isArray(payload(body).suggestions) ? payload(body).suggestions : []).map((x: any) =>
    typeof x === 'string' ? x : String(x?.suggestion ?? x?.title ?? x?.message ?? ''),
  ).filter(Boolean);

const TenantSentimentDashboard: React.FC = () => {
  const [trends, setTrends] = useState<SentimentTrend[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    // Fetch sentiment trends
    api.get('/tenant/sentiment-trends').then(res => setTrends(toTrends(res.data))).catch(() => setTrends([]));
    // Fetch common issues
    api.get('/tenant/common-issues').then(res => setIssues(toIssues(res.data))).catch(() => setIssues([]));
    // Fetch early warnings
    api.get('/tenant/early-warnings').then(res => setWarnings(toWarnings(res.data))).catch(() => setWarnings([]));
    // Fetch proactive suggestions
    api.get('/tenant/proactive-suggestions').then(res => setSuggestions(toSuggestions(res.data))).catch(() => setSuggestions([]));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Tenant Sentiment Dashboard</h1>

      {/* Sentiment Trend Analysis */}
      <div className="mb-8 bg-white p-4 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-2">Sentiment Trends</h2>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={trends}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis domain={[-1, 1]} />
            <Tooltip />
            <Line type="monotone" dataKey="score" stroke="#8884d8" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Issue Tracking */}
      <div className="mb-8 bg-white p-4 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-2">Common Issues</h2>
        {issues.length ? (
          <ul className="list-disc pl-5">
            {issues.map((i, idx) => (
              <li key={idx}>{i.category} — {i.count}</li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">No issues found.</p>
        )}
      </div>

      {/* Early Warning System */}
      <div className="mb-8 bg-white p-4 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-2">Early Warnings</h2>
        {warnings.length ? (
          <ul className="list-disc pl-5">
            {warnings.map((w, idx) => (
              <li key={idx}>{w.issue} — Confidence: {(w.confidence * 100).toFixed(1)}%</li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">No warnings at the moment.</p>
        )}
      </div>

      {/* Proactive Communication Suggestions */}
      <div>
        <h2 className="text-xl font-semibold mb-2">Proactive Communication Suggestions</h2>
        <div className="bg-white p-4 rounded-lg shadow">
          {suggestions.length ? (
            <ul className="list-disc pl-5">
              {suggestions.map((s, idx) => (
                <li key={idx}>{s}</li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500">No suggestions at this time.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default TenantSentimentDashboard;
