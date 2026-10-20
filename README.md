# DailyDigest: a morning news brief from RSS to Telegram
**Why I built it**

I stopped reading news a while ago, but I still felt I was missing current events. Traditional media felt sensational and rarely neutral. News apps added paywalls and endless scrolling. 

I also tried Inoreader, but I could not keep up with everything. I was chasing notifications instead of information. 

So I built DailyDigest. I can read the digest in five minutes, and I no longer start my day scrolling.

**What it does**

Every morning, an n8n workflow collects items from ten RSS sources, selects them in code, groups them into five sections, and sends a short brief to a Telegram group. The code decides what gets in. The language model only rewrites the selected items. It does not choose them.

<img width="582" height="180" alt="Screenshot 2026-10-18 105618" src="https://github.com/user-attachments/assets/b8366bb5-433b-45ab-8a22-95aa96e9f915" />


The n8n workflow, from Schedule Trigger to Telegram.


**How it’s built**

- Schedule Trigger starts the workflow each morning.

- RSS Feed and RSS Loop fetch the ten sources.

- XML to JSON converts the feeds to structured data.

- A Code node filters by recency (articles older than 36 hours are dropped; 7 days for the arts sources, due to their different publishing timelines), removes banned terms (such as sports, which I do not follow), scores items by keyword, and keeps up to 7 items per section. Items are kept by highest score, and ties are decided by recency.

- A Basic LLM Chain (Mistral) rewrites each selected item as one sentence, keeping the source name.

- Telegram sends the brief.

**Tools and why:**

- n8n: visual workflows that are easy to inspect and debug. Self-hosted through Docker Desktop, with no monthly fees.

- RSS: free, structured, and needs no API key for the sources.

- Mistral: Cloud API, free tier, which is rate-limited. Used only for rewriting, so the model’s role stays small.

- Telegram: readable on the phone, with no extra app for the reader.

All the sources and tools are used on **free plans**. The setup was time-consuming and needs manual maintenance. 

I had to change some of my habits so the workflow runs reliably. Free plans were crucial given my situation. 

The obvious upgrade would be a paid VPS, which would remove the maintenance problem and keep the workflow running 24/7.

**The code**

The Code node is in code/digest_code_node.js. Its purpose is to decide what gets in. It has four parts:

- Settings: time windows, per-section cap, and text length. These are the knobs to tune.

- Feeds: the list of sources, each assigned to a section. EconomyUp articles are assigned to Tech or Europe depending on their keywords.

- Scoring: each section has its own keyword list. The arts sources have separate lists: Atlas Obscura uses curiosity terms, and Animenomics uses anime business terms. Articles with more matching keywords rank higher.

- Output: sorts each section, keeps the top items, and adds a debug record showing how many items were received, kept, and skipped, and why.

Scoring orders items; it does not remove them. Removal happens through the age filter, the banned-word filter, and the per-section cap.

**A note on how this was built:** 

I did not write this code. An AI wrote it, and I acted as the supervisor: I defined the goal and the rules, tested each version against the real output, and corrected what did not work. 

The code is shared so that reviewers can judge it and suggest improvements.

**Sources**

- BBC News (world)

- Reuters, via a Google News search for reuters.com. I could not find a public Reuters RSS feed. 

- EconomyUp (Italian startups and business; assigned to Europe or Tech by keyword) |

- Euronews

- Stratechery

- Import AI

- AI Rundown, via Kill the Newsletter (an email-to-feed bridge)

- Focus Taiwan (CNA)

- Atlas Obscura

- Animenomics

**Limitations**
The model can paraphrase. Check the source link before acting on an item.

Source matching uses text in article links. A feed that changes its domain will be misattributed or dropped.

Keyword scoring orders items; it does not judge quality.

Arts sources publish less often, so their window is 7 days.

The system is recent, and some fine-tuning is still needed.

**Links - Feel free to reach out**

Linkedin: linkedin.com/in/lorenzopardini

Kaggle: https://www.kaggle.com/lorenzopardini

Telegram group: https://t.me/+JMDqw4_7ji1lYjA0

Lovable portfolio: https://lorenzopardini.lovable.app
