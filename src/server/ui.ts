import type { ServerResponse } from "http";

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>x2kobo</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0a0a0a;
      color: #e5e5e5;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 1rem;
    }
    .container {
      max-width: 480px;
      width: 100%;
    }
    h1 {
      font-size: 1.5rem;
      font-weight: 600;
      margin-bottom: 0.25rem;
    }
    .subtitle {
      color: #888;
      font-size: 0.9rem;
      margin-bottom: 1.5rem;
    }
    .form-group {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }
    input[type="text"] {
      flex: 1;
      padding: 0.75rem 1rem;
      border: 1px solid #333;
      border-radius: 8px;
      background: #1a1a1a;
      color: #e5e5e5;
      font-size: 1rem;
      outline: none;
      transition: border-color 0.2s;
    }
    input[type="text"]:focus {
      border-color: #555;
    }
    input[type="text"]::placeholder {
      color: #555;
    }
    button {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 8px;
      background: #fff;
      color: #000;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s;
      white-space: nowrap;
    }
    button:hover { opacity: 0.9; }
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .status {
      padding: 0.75rem 1rem;
      border-radius: 8px;
      font-size: 0.9rem;
      display: none;
    }
    .status.visible { display: block; }
    .status.converting {
      background: #1a1a2e;
      border: 1px solid #2a2a4e;
      color: #8888ff;
    }
    .status.done {
      background: #0a1a0a;
      border: 1px solid #1a3a1a;
      color: #4ade80;
    }
    .status.error {
      background: #1a0a0a;
      border: 1px solid #3a1a1a;
      color: #f87171;
    }
    .history {
      margin-top: 2rem;
      border-top: 1px solid #222;
      padding-top: 1rem;
    }
    .history h2 {
      font-size: 0.85rem;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.75rem;
    }
    .history-item {
      padding: 0.5rem 0;
      border-bottom: 1px solid #1a1a1a;
      font-size: 0.85rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.5rem;
    }
    .history-url {
      color: #888;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .history-status {
      font-size: 0.75rem;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      white-space: nowrap;
    }
    .history-status.done { background: #0a1a0a; color: #4ade80; }
    .history-status.error { background: #1a0a0a; color: #f87171; }
    .history-status.converting { background: #1a1a2e; color: #8888ff; }
  </style>
</head>
<body>
  <div class="container">
    <h1>x2kobo</h1>
    <p class="subtitle">Paste an X article URL to send it to your Kobo</p>
    <div class="form-group">
      <input type="text" id="url" placeholder="https://x.com/user/article/..." autofocus>
      <button id="btn" onclick="submitConvert()">Convert</button>
    </div>
    <div id="status" class="status"></div>
    <div id="history-section" class="history" style="display:none">
      <h2>Recent</h2>
      <div id="history"></div>
    </div>
  </div>
  <script>
    const urlInput = document.getElementById('url');
    const btn = document.getElementById('btn');
    const statusEl = document.getElementById('status');
    const historySection = document.getElementById('history-section');
    const historyEl = document.getElementById('history');
    const conversions = [];

    urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitConvert();
    });

    async function submitConvert() {
      const url = urlInput.value.trim();
      if (!url) return;

      btn.disabled = true;
      urlInput.disabled = true;
      setStatus('converting', 'Converting article...');

      try {
        const res = await fetch('/api/convert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });
        const data = await res.json();

        if (!res.ok) {
          setStatus('error', data.error || 'Request failed');
          addHistory(url, 'error');
          return;
        }

        // Poll for job completion
        const jobId = data.jobId;
        pollJob(jobId, url);
      } catch (err) {
        setStatus('error', 'Could not reach server');
        addHistory(url, 'error');
      } finally {
        btn.disabled = false;
        urlInput.disabled = false;
        urlInput.value = '';
        urlInput.focus();
      }
    }

    async function pollJob(jobId, url) {
      const poll = async () => {
        try {
          const res = await fetch('/api/jobs/' + jobId);
          const job = await res.json();
          if (job.status === 'done') {
            setStatus('done', job.message || 'Done! Article sent to Kobo.');
            addHistory(url, 'done');
          } else if (job.status === 'error') {
            setStatus('error', job.message || 'Conversion failed');
            addHistory(url, 'error');
          } else {
            setTimeout(poll, 2000);
          }
        } catch {
          setStatus('error', 'Lost connection to server');
          addHistory(url, 'error');
        }
      };
      setTimeout(poll, 2000);
    }

    function setStatus(type, message) {
      statusEl.className = 'status visible ' + type;
      statusEl.textContent = message;
    }

    function addHistory(url, status) {
      conversions.unshift({ url, status });
      historySection.style.display = 'block';
      historyEl.innerHTML = conversions.slice(0, 10).map(c =>
        '<div class="history-item">' +
          '<span class="history-url">' + escapeHtml(c.url) + '</span>' +
          '<span class="history-status ' + c.status + '">' + c.status + '</span>' +
        '</div>'
      ).join('');
    }

    function escapeHtml(s) {
      const d = document.createElement('div');
      d.textContent = s;
      return d.innerHTML;
    }
  </script>
</body>
</html>`;

export function serveUI(res: ServerResponse): void {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(HTML);
}

export { HTML };
