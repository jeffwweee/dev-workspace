# Phase 5: RSS Integration - Multi-Agent Orchestrator

> **For Claude:** REQUIRED SUB-SKILL: Use `executing-plans` or `subagent-driven-development` skill to implement this plan task-by-task.
> **Depends on:** Phase 4 - Queuing & Learning
> **Status:** Future/Optional

**Goal:** Implement RSS feed polling and integration with the orchestrator task queue for automated content monitoring and processing.

**Architecture:** Cron-triggered RSS poller script fetches feeds, filters by keywords, and writes to queue file. Orchestrator picks up RSS items and routes to appropriate agents.

**Tech Stack:** Node.js, RSS parsers, cron, file-based queue

---

## Task 5.1: Create RSS Configuration

**Files:**
- Create: `config/rss.feeds.yml`

**Step 1: Write RSS config**

```yaml
feeds:
  - name: "tech-news"
    url: "https://example.com/rss/tech.xml"
    poll_interval: "*/30 * * * *"   # Every 30 minutes (cron format)
    processor: "summarize"          # How to handle
    notify_on_match:
      keywords: ["AI", "Claude", "LLM", "Anthropic"]
      notify_chat: 195061634

  - name: "github-releases"
    url: "https://github.com/anthropics/claude-code/releases.atom"
    poll_interval: "0 */2 * * *"      # Every 2 hours
    processor: "changelog"
    notify_on_match:
      keywords: ["release", "update"]
      notify_chat: 195061634

  - name: "hacker-news"
    url: "https://hnrss.org/frontpage"
    poll_interval: "0 * * * *"        # Every hour
    processor: "summarize"
    filters:
      min_score: 100
    notify_on_match:
      keywords: ["startup", "programming", "AI"]
      notify_chat: 195061634

settings:
  max_items_per_poll: 10
  retention_days: 30
  user_agent: "Dev-Workspace RSS Poller/1.0"
```

**Step 2: Commit**

```bash
git add config/rss.feeds.yml
git commit -m "feat(orchestrator): add RSS feed configuration"
```

---

## Task 5.2: Create RSS Poller Script

**Files:**
- Create: `scripts/rss-poll.cjs`

**Step 1: Write RSS poller**

```javascript
#!/usr/bin/env node

/**
 * RSS Poller Script
 *
 * Usage: node scripts/rss-poll.cjs [--feed <name>]
 *
 * Designed to be run via cron.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const yaml = require('js-yaml');

const CONFIG_PATH = path.join(__dirname, '..', 'config', 'rss.feeds.yml');
const STATE_DIR = path.join(__dirname, '..', 'state', 'rss');
const QUEUE_PATH = path.join(STATE_DIR, 'queue.json');
const PROCESSED_PATH = path.join(STATE_DIR, 'processed.json');

/**
 * Loads RSS configuration
 */
function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.log('No RSS configuration found');
    return null;
  }

  const content = fs.readFileSync(CONFIG_PATH, 'utf-8');
  return yaml.load(content);
}

/**
 * Loads processed item IDs
 */
function loadProcessed() {
  if (!fs.existsSync(PROCESSED_PATH)) {
    return new Set();
  }

  const content = fs.readFileSync(PROCESSED_PATH, 'utf-8');
  const data = JSON.parse(content);
  return new Set(data.items || []);
}

/**
 * Saves processed item IDs
 */
function saveProcessed(processed) {
  // Keep only last 1000 items
  const items = [...processed].slice(-1000);

  const data = {
    lastUpdated: new Date().toISOString(),
    items
  };

  if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true });
  }

  fs.writeFileSync(PROCESSED_PATH, JSON.stringify(data, null, 2));
}

/**
 * Loads RSS queue
 */
function loadQueue() {
  if (!fs.existsSync(QUEUE_PATH)) {
    return [];
  }

  const content = fs.readFileSync(QUEUE_PATH, 'utf-8');
  return JSON.parse(content);
}

/**
 * Saves RSS queue
 */
function saveQueue(queue) {
  if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true });
  }

  fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2));
}

/**
 * Fetches RSS feed
 */
async function fetchFeed(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;

    client.get(url, {
      headers: {
        'User-Agent': 'Dev-Workspace RSS Poller/1.0'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

/**
 * Parses RSS/Atom feed
 */
function parseFeed(content, feedName) {
  const items = [];

  // Simple XML parsing (for RSS 2.0 and Atom)
  // Extract items/entries
  const itemMatches = content.match(/<item[\s\S]*?<\/item>|<entry[\s\S]*?<\/entry>/gi) || [];

  for (const itemXml of itemMatches) {
    const item = {
      feed: feedName,
      id: extractTag(itemXml, 'guid') || extractTag(itemXml, 'id') || extractTag(itemXml, 'link'),
      title: extractTag(itemXml, 'title'),
      link: extractTag(itemXml, 'link'),
      description: extractTag(itemXml, 'description') || extractTag(itemXml, 'summary') || extractTag(itemXml, 'content'),
      pubDate: extractTag(itemXml, 'pubDate') || extractTag(itemXml, 'published') || extractTag(itemXml, 'updated')
    };

    if (item.id && item.title) {
      items.push(item);
    }
  }

  return items;
}

/**
 * Extracts tag content
 */
function extractTag(xml, tag) {
  // Handle self-closing and regular tags
  const match = xml.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i')) ||
                xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')) ||
                xml.match(new RegExp(`<${tag}[^>]*href="([^"]+)"`, 'i'));

  return match ? match[1].trim() : null;
}

/**
 * Checks if item matches keywords
 */
function matchesKeywords(item, keywords) {
  if (!keywords || keywords.length === 0) return true;

  const text = `${item.title} ${item.description}`.toLowerCase();
  return keywords.some(kw => text.includes(kw.toLowerCase()));
}

/**
 * Polls a single feed
 */
async function pollFeed(feedConfig, processed) {
  console.log(`\nPolling: ${feedConfig.name}`);

  try {
    const content = await fetchFeed(feedConfig.url);
    const items = parseFeed(content, feedConfig.name);

    console.log(`  Found ${items.length} items`);

    const newItems = [];

    for (const item of items) {
      // Skip already processed
      if (processed.has(item.id)) {
        continue;
      }

      // Check keyword filter
      if (!matchesKeywords(item, feedConfig.notify_on_match?.keywords)) {
        continue;
      }

      // Check score filter (for Hacker News style feeds)
      if (feedConfig.filters?.min_score) {
        const scoreMatch = item.description?.match(/(\d+)\s*points/i);
        if (scoreMatch && parseInt(scoreMatch[1]) < feedConfig.filters.min_score) {
          continue;
        }
      }

      newItems.push({
        ...item,
        processor: feedConfig.processor,
        notify_chat: feedConfig.notify_on_match?.notify_chat,
        polled_at: new Date().toISOString()
      });
    }

    console.log(`  New matching items: ${newItems.length}`);

    return newItems;
  } catch (error) {
    console.error(`  Error polling ${feedConfig.name}:`, error.message);
    return [];
  }
}

/**
 * Main poll function
 */
async function main() {
  const feedName = process.argv.find(a => a === '--feed') ? process.argv[process.argv.indexOf('--feed') + 1] : null;

  const config = loadConfig();
  if (!config) {
    console.log('No RSS configuration, exiting');
    return;
  }

  const processed = loadProcessed();
  const queue = loadQueue();
  let totalNew = 0;

  const feeds = feedName
    ? config.feeds.filter(f => f.name === feedName)
    : config.feeds;

  for (const feed of feeds) {
    const newItems = await pollFeed(feed, processed);

    // Add to queue
    for (const item of newItems) {
      queue.push(item);
      processed.add(item.id);
      totalNew++;
    }
  }

  // Save queue and processed
  saveQueue(queue);
  saveProcessed(processed);

  console.log(`\nTotal new items queued: ${totalNew}`);
  console.log(`Queue size: ${queue.length}`);
}

main().catch(console.error);
```

**Step 2: Make executable**

Run: `chmod +x scripts/rss-poll.cjs`

**Step 3: Create state directory**

```bash
mkdir -p state/rss
echo '{"lastUpdated": null, "items": []}' > state/rss/processed.json
echo '[]' > state/rss/queue.json
```

**Step 4: Commit**

```bash
git add scripts/rss-poll.cjs state/rss/
git commit -m "feat(orchestrator): add RSS poller script"
```

---

## Task 5.3: Integrate RSS with Orchestrator

**Files:**
- Modify: `lib/orchestrator.cjs`

**Step 1: Add RSS queue check to runLoop**

Add this function:

```javascript
/**
 * Checks RSS queue for new items
 */
async function checkRssQueue() {
  const rssQueuePath = path.join(STATE_DIR, 'rss', 'queue.json');

  if (!fs.existsSync(rssQueuePath)) {
    return;
  }

  const content = fs.readFileSync(rssQueuePath, 'utf-8');
  const queue = JSON.parse(content);

  if (queue.length === 0) {
    return;
  }

  // Take first item
  const item = queue.shift();

  // Create task from RSS item
  const task = {
    id: `RSS-${Date.now()}`,
    type: item.processor, // "summarize" or "changelog"
    source: item.feed,
    title: item.title,
    url: item.link,
    description: item.description,
    notify_chat: item.notify_chat
  };

  console.log(`[Orchestrator] Processing RSS item: ${task.title}`);

  // Route based on processor type
  if (task.type === 'summarize') {
    // Route to backend agent for summarization
    await submitTask({
      id: task.id,
      description: `Summarize: ${task.title}`,
      workflow: 'backend_only',
      metadata: {
        type: 'rss_summarize',
        url: task.url,
        source: task.source
      }
    });
  } else if (task.type === 'changelog') {
    // Route to backend agent for changelog processing
    await submitTask({
      id: task.id,
      description: `Process changelog: ${task.title}`,
      workflow: 'backend_only',
      metadata: {
        type: 'rss_changelog',
        url: task.url,
        source: task.source
      }
    });
  }

  // Save updated queue
  fs.writeFileSync(rssQueuePath, JSON.stringify(queue, null, 2));

  // Notify if configured
  if (item.notify_chat) {
    const { sendMessage } = require('./telegram_notifier.cjs');
    await sendMessage(item.notify_chat, `📰 Processing: ${task.title}`);
  }
}
```

**Step 2: Add to runLoop**

Add this after `checkEntryPoints()`:

```javascript
// 1.5. Check RSS queue
if (config.orchestration.rss_enabled !== false) {
  await checkRssQueue();
}
```

**Step 3: Commit**

```bash
git add lib/orchestrator.cjs
git commit -m "feat(orchestrator): integrate RSS queue processing"
```

---

## Task 5.4: Add Cron Configuration

**Files:**
- Create: `docs/cron-setup.md`

**Step 1: Write cron setup documentation**

```markdown
# Cron Setup for RSS Polling

## Crontab Configuration

Add these entries to your crontab (`crontab -e`):

```cron
# RSS feed polling
# Tech news - every 30 minutes
*/30 * * * * /path/to/dev-workspace/scripts/rss-poll.cjs --feed tech-news >> /var/log/rss-poll.log 2>&1

# GitHub releases - every 2 hours
0 */2 * * * /path/to/dev-workspace/scripts/rss-poll.cjs --feed github-releases >> /var/log/rss-poll.log 2>&1

# Hacker News - every hour
0 * * * * /path/to/dev-workspace/scripts/rss-poll.cjs --feed hacker-news >> /var/log/rss-poll.log 2>&1

# Poll all feeds (alternative to individual)
# */30 * * * * /path/to/dev-workspace/scripts/rss-poll.cjs >> /var/log/rss-poll.log 2>&1
```

## Manual Testing

Test the poller manually:

```bash
# Poll all feeds
node scripts/rss-poll.cjs

# Poll specific feed
node scripts/rss-poll.cjs --feed tech-news

# Check queue
cat state/rss/queue.json | jq

# Check processed items
cat state/rss/processed.json | jq
```

## Log Rotation

Add to `/etc/logrotate.d/rss-poll`:

```
/var/log/rss-poll.log {
    daily
    rotate 7
    compress
    missingok
    notifempty
}
```
```

**Step 2: Commit**

```bash
git add docs/cron-setup.md
git commit -m "docs(orchestrator): add cron setup for RSS polling"
```

---

## Task 5.5: Update CLI with RSS Commands

**Files:**
- Modify: `bin/orchestrator.js`

**Step 1: Add RSS commands**

```javascript
program.command('rss-poll')
  .description('Run RSS poller')
  .option('-f, --feed <name>', 'Poll specific feed')
  .action((options) => {
    const { execSync } = require('child_process');
    const cmd = options.feed
      ? `node scripts/rss-poll.cjs --feed ${options.feed}`
      : 'node scripts/rss-poll.cjs';

    try {
      const result = execSync(cmd, { encoding: 'utf-8' });
      console.log(result);
    } catch (error) {
      console.error('RSS poll failed:', error.message);
    }
  });

program.command('rss-queue')
  .description('Show RSS queue')
  .action(() => {
    const fs = require('fs');
    const path = require('path');
    const queuePath = path.join(__dirname, '..', 'state', 'rss', 'queue.json');

    if (!fs.existsSync(queuePath)) {
      console.log('RSS queue is empty');
      return;
    }

    const queue = JSON.parse(fs.readFileSync(queuePath, 'utf-8'));
    console.log(`\n=== RSS Queue (${queue.length} items) ===`);

    queue.forEach((item, i) => {
      console.log(`\n${i + 1}. ${item.title}`);
      console.log(`   Feed: ${item.feed}`);
      console.log(`   URL: ${item.link}`);
      console.log(`   Processor: ${item.processor}`);
    });
  });

program.command('rss-clear')
  .description('Clear RSS queue')
  .action(() => {
    const fs = require('fs');
    const path = require('path');
    const queuePath = path.join(__dirname, '..', 'state', 'rss', 'queue.json');
    fs.writeFileSync(queuePath, '[]');
    console.log('RSS queue cleared');
  });
```

**Step 2: Commit**

```bash
git add bin/orchestrator.js
git commit -m "feat(orchestrator): add RSS CLI commands"
```

---

## Phase 5 Complete Checklist

- [ ] RSS configuration file created
- [ ] RSS poller script created
- [ ] Integrated with orchestrator loop
- [ ] Cron setup documentation
- [ ] CLI commands added

**All Phases Complete!** The multi-agent orchestrator is now fully implemented.
